// Giặt / sửa và thanh lý món hàng (UC-24) tại kho tổng. Mọi sản phẩm quản lý theo từng món (TASK-015).
// Phiếu giặt/sửa:     pending → in_progress → completed   (pending / in_progress có thể bị cancelled).
// Đề xuất thanh lý:   requested → completed (duyệt) | rejected (từ chối).
// Ai làm bước nào:
// - Quản lý kho: xem món cần xử lý, tạo phiếu giặt/sửa và giao nhân viên, hủy phiếu, tạo / duyệt đề xuất thanh lý.
// - Nhân viên kho được giao: bắt đầu và hoàn tất phiếu (sửa được → xếp lại lên kệ; sửa hỏng → không khả dụng;
//   không sửa được → tự sinh đề xuất thanh lý).
// Trong lúc xử lý, món ở trạng thái maintenance: vẫn tính trong tồn thực tế nhưng không khả dụng.
import mongoose from 'mongoose';
import { ItemMaintenanceRecord } from '../../models/maintenance/ItemMaintenanceRecord.js';
import { ItemDisposal } from '../../models/maintenance/ItemDisposal.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { StockRelocation } from '../../models/warehouse/transfer/StockRelocation.js';
import { StockRelocationDetail } from '../../models/warehouse/transfer/StockRelocationDetail.js';
import User from '../../models/system/User.js';
import { recordStockMovement } from '../warehouse/inventoryLedgerService.js';
import { moveItem } from '../warehouse/itemStateService.js';
import { appError } from '../warehouse/shared/errors.js';
import { WAREHOUSE_STAFF_ROLE_PATTERN, isWarehouseManagerOrAdmin, isWarehouseStaff } from '../warehouse/shared/roles.js';
import { getCentralWarehouse } from '../warehouse/shared/locations.js';
import { addToStorageChain } from '../warehouse/shared/capacity.js';

export const MAINTENANCE_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};
export const DISPOSAL_STATUS = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  COMPLETED: 'completed',
};

const isManager = isWarehouseManagerOrAdmin;
const isStaff = isWarehouseStaff;
const validId = mongoose.isValidObjectId;

// Trạng thái món được phép đưa vào giặt/sửa hoặc đề xuất thanh lý.
const ELIGIBLE_STATUSES = ['unavailable', 'available'];
const BLOCKED_STATUSES = ['renting', 'in_transit', 'reserved', 'disposed', 'maintenance'];
const OPEN_STATUSES = [MAINTENANCE_STATUS.PENDING, MAINTENANCE_STATUS.IN_PROGRESS];

const itemPopulate = {
  path: 'itemId',
  select: 'itemCode serialNumber status storageId variantId locationId',
  populate: [
    { path: 'variantId', select: 'sku size color productId', populate: { path: 'productId', select: 'name productCode' } },
    { path: 'storageId', select: 'code name type' },
  ],
};
const populateRecord = (query) => query
  .populate(itemPopulate)
  .populate('assignedTo', 'FullName Email')
  .populate('reportedBy', 'FullName Email')
  .populate('cancelledBy', 'FullName Email')
  .populate('targetStorageId', 'code name type');
const populateDisposal = (query) => query
  .populate(itemPopulate)
  .populate('requestedBy', 'FullName Email')
  .populate('approvedBy', 'FullName Email')
  .populate('decidedBy', 'FullName Email')
  .populate('maintenanceRecordId', 'maintenanceType issueDescription repairDescription repairResult cost completedAt');

const centralWarehouse = (session) => getCentralWarehouse(session, {
  select: '_id code name',
  missingMessage: 'Chưa cấu hình kho tổng đang hoạt động.',
  multipleMessage: 'Cần có đúng một kho tổng đang hoạt động.',
});

const requireManager = (user, message) => {
  if (!isManager(user)) throw appError(message, 403);
};
const requireWarehouseUser = (user) => {
  if (!isManager(user) && !isStaff(user)) throw appError('Bạn không có quyền xem phiếu giặt/sửa.', 403);
};

/** Món ở kho tổng, đang available/unavailable, không có phiếu giặt/sửa hay đề xuất thanh lý đang mở. */
const loadEligibleItem = async (itemId, centralId, session) => {
  const item = await InventoryItem.findById(itemId).session(session).lean();
  if (!item) throw appError('Không tìm thấy món hàng.', 404);
  if (String(item.locationId) !== String(centralId)) throw appError('Món hàng không nằm ở kho tổng.', 409);
  if (BLOCKED_STATUSES.includes(item.status)) {
    throw appError('Món hàng đang được thuê, giữ chỗ, điều chuyển, xử lý hoặc đã thanh lý.', 409);
  }
  if (!ELIGIBLE_STATUSES.includes(item.status)) {
    throw appError('Món hàng không ở trạng thái có thể xử lý.', 409);
  }
  const [openRecord, pendingDisposal] = await Promise.all([
    ItemMaintenanceRecord.exists({ itemId: item._id, isOpen: true }).session(session),
    ItemDisposal.exists({ itemId: item._id, isPending: true }).session(session),
  ]);
  if (openRecord) throw appError('Món hàng đã có phiếu giặt/sửa đang mở.', 409);
  if (pendingDisposal) throw appError('Món hàng đang có đề xuất thanh lý chờ duyệt.', 409);
  return item;
};

/**
 * Khóa món sang maintenance qua itemStateService (ghi có điều kiện → 409 nếu tranh chấp).
 * Balance: maintenance vẫn tính onHand nhưng là không khả dụng (unavailable +1 nếu món đang available).
 */
const lockItemForProcessing = async (item, centralId, session) => {
  if (String(item.locationId) !== String(centralId)) {
    throw appError('Món hàng vừa thay đổi trạng thái, vui lòng tải lại.', 409);
  }
  // Truyền bản sao để `item` của caller giữ trạng thái cũ (dùng cho previousItemStatus).
  return moveItem({ ...item }, { status: 'maintenance' }, session);
};

/** Index unique (một phiếu mở / một đề xuất chờ duyệt cho mỗi món) bị vi phạm khi hai người tạo cùng lúc → 409. */
const duplicateGuard = (error, message) => {
  if (error?.code === 11000) throw appError(message, 409);
  throw error;
};

/* ----------------------------- Danh sách món cần xử lý ----------------------------- */

/** Món ở kho tổng đang `unavailable` (cần xử lý — TASK-016) và chưa có phiếu xử lý nào đang mở. */
export const listMaintenanceCandidates = async (user) => {
  requireManager(user, 'Chỉ quản lý kho mới được xem danh sách món cần xử lý.');
  const central = await centralWarehouse();
  const [openItemIds, pendingItemIds] = await Promise.all([
    ItemMaintenanceRecord.distinct('itemId', { isOpen: true }),
    ItemDisposal.distinct('itemId', { isPending: true }),
  ]);
  const excluded = [...openItemIds, ...pendingItemIds];
  const filter = { locationId: central._id, status: 'unavailable' };
  if (excluded.length) filter._id = { $nin: excluded };
  const rows = await InventoryItem.find(filter)
    .select('itemCode serialNumber status storageId variantId locationId updatedAt')
    .populate({ path: 'variantId', select: 'sku size color productId', populate: { path: 'productId', select: 'name productCode' } })
    .populate('storageId', 'code name type')
    .sort({ status: -1, updatedAt: -1 })
    .lean();
  return rows;
};

export const listMaintenanceStaff = (user) => {
  requireManager(user, 'Chỉ quản lý kho mới được xem danh sách nhân viên.');
  return User.find({ Role: WAREHOUSE_STAFF_ROLE_PATTERN, Status: /^active$/i }).select('FullName Email')
    .sort({ FullName: 1 }).lean();
};

/* ----------------------------- Phiếu giặt / sửa ----------------------------- */

/** Gắn đề xuất thanh lý (nếu có) vào từng phiếu bằng một truy vấn $in. */
const attachDisposals = async (records) => {
  const ids = records.map((row) => row._id);
  if (!ids.length) return records;
  const disposals = await ItemDisposal.find({ maintenanceRecordId: { $in: ids } })
    .select('maintenanceRecordId status method reason decisionNote').lean();
  const byRecord = new Map(disposals.map((row) => [String(row.maintenanceRecordId), row]));
  return records.map((row) => ({ ...row, disposal: byRecord.get(String(row._id)) || null }));
};

export const listMaintenanceRecords = async (user, { status = '' } = {}) => {
  requireWarehouseUser(user);
  const filter = isManager(user) ? {} : { assignedTo: user._id };
  if (Object.values(MAINTENANCE_STATUS).includes(status)) filter.status = status;
  const rows = await populateRecord(ItemMaintenanceRecord.find(filter).sort({ createdAt: -1 })).lean();
  return attachDisposals(rows);
};

export const getMaintenanceRecord = async (id, user, session) => {
  requireWarehouseUser(user);
  if (!validId(id)) throw appError('Mã phiếu giặt/sửa không hợp lệ.');
  const row = await populateRecord(ItemMaintenanceRecord.findById(id).session(session || null)).lean();
  if (!row) throw appError('Không tìm thấy phiếu giặt/sửa.', 404);
  if (!isManager(user) && String(row.assignedTo?._id || row.assignedTo) !== String(user._id)) {
    throw appError('Phiếu này không được giao cho bạn.', 403);
  }
  const [withDisposal] = await attachDisposals([row]);
  return withDisposal;
};

/** Quản lý tạo phiếu giặt/sửa cho một món và giao nhân viên; món bị khóa ở trạng thái maintenance. */
export const createMaintenanceRecord = async (user, validated) => {
  requireManager(user, 'Chỉ quản lý kho mới được tạo phiếu giặt/sửa.');
  const session = await mongoose.startSession();
  let id;
  try {
    await session.withTransaction(async () => {
      const central = await centralWarehouse(session);
      const staff = await User.findOne({ _id: validated.assignedTo, Role: WAREHOUSE_STAFF_ROLE_PATTERN, Status: /^active$/i })
        .session(session);
      if (!staff) throw appError('Nhân viên kho được giao không tồn tại hoặc đã ngừng hoạt động.');
      const item = await loadEligibleItem(validated.itemId, central._id, session);
      await lockItemForProcessing(item, central._id, session);
      const [doc] = await ItemMaintenanceRecord.create([{
        itemId: item._id,
        locationId: central._id,
        sourceType: 'warehouse_inspection',
        maintenanceType: validated.maintenanceType,
        issueDescription: validated.issueDescription,
        previousItemStatus: item.status,
        status: MAINTENANCE_STATUS.PENDING,
        isOpen: true,
        reportedBy: user._id,
        assignedTo: staff._id,
        note: validated.note || undefined,
      }], { session });
      id = doc._id;
    });
  } catch (error) {
    duplicateGuard(error, 'Món hàng đã có phiếu giặt/sửa đang mở.');
  } finally {
    await session.endSession();
  }
  return getMaintenanceRecord(id, user);
};

/** Quản lý / admin luôn được thao tác; nhân viên chỉ thao tác phiếu giao cho mình. */
const assertCanOperate = async (id, user) => {
  if (!validId(id)) throw appError('Mã phiếu giặt/sửa không hợp lệ.');
  if (!isManager(user) && !isStaff(user)) throw appError('Bạn không có quyền thao tác phiếu giặt/sửa.', 403);
  const row = await ItemMaintenanceRecord.findById(id).select('assignedTo status').lean();
  if (!row) throw appError('Không tìm thấy phiếu giặt/sửa.', 404);
  if (!isManager(user) && String(row.assignedTo) !== String(user._id)) {
    throw appError('Phiếu này không được giao cho bạn.', 403);
  }
  return row;
};

export const startMaintenance = async (id, user) => {
  await assertCanOperate(id, user);
  const updated = await ItemMaintenanceRecord.findOneAndUpdate(
    { _id: id, status: MAINTENANCE_STATUS.PENDING, isOpen: true },
    { $set: { status: MAINTENANCE_STATUS.IN_PROGRESS, startedAt: new Date() } },
    { new: true },
  );
  if (!updated) throw appError('Phiếu không còn ở trạng thái chờ làm.', 409);
  return getMaintenanceRecord(id, user);
};

/** Danh sách kệ từ `storageId` lên các cấp cha (Kệ → Dãy → Khu). */
const storageChainOf = (byId, storageId) => {
  const ids = new Map();
  if (storageId) addToStorageChain(ids, byId, String(storageId), 0);
  return [...ids.keys()].map((id) => byId.get(id));
};

/**
 * Kệ đích và các cấp cha (trừ cấp chung với kệ cũ) phải còn chỗ cho 1 món.
 * "Đã dùng" chỉ đọc InventoryBalance.quantityOnHand, cộng phần các phiếu tách/gộp đang mở sẽ đưa vào.
 */
const assertShelfCapacity = async (locationId, fromStorageId, toStorageId, session) => {
  const storages = await StorageLocation.find({ locationId }).select('_id code parentStorageId maxCapacity').session(session)
    .lean();
  const byId = new Map(storages.map((row) => [String(row._id), row]));
  const fromIds = new Set(storageChainOf(byId, fromStorageId).map((row) => String(row._id)));
  const affected = storageChainOf(byId, toStorageId).filter((row) => !fromIds.has(String(row._id)) && row.maxCapacity != null);
  if (!affected.length) return;
  const affectedIds = new Set(affected.map((row) => String(row._id)));
  const used = new Map();
  const add = (storageId, amount) => {
    for (const node of storageChainOf(byId, storageId)) {
      const key = String(node._id);
      if (affectedIds.has(key)) used.set(key, (used.get(key) || 0) + amount);
    }
  };
  const balances = await InventoryBalance.find({ locationId, storageId: { $ne: null } }).select('storageId quantityOnHand')
    .session(session).lean();
  for (const row of balances) add(row.storageId, Math.max(0, row.quantityOnHand || 0));
  const pendingIds = await StockRelocation.find({ locationId, status: { $in: ['assigned', 'in_progress'] } }).distinct('_id')
    .session(session);
  if (pendingIds.length) {
    const lines = await StockRelocationDetail.find({ relocationId: { $in: pendingIds } })
      .select('fromStorageId toStorageId quantity').session(session).lean();
    for (const line of lines) {
      add(line.toStorageId, line.quantity);
      add(line.fromStorageId, -line.quantity);
    }
  }
  for (const node of affected) {
    const projected = (used.get(String(node._id)) || 0) + 1;
    if (projected > node.maxCapacity) {
      throw appError(`Kệ hoặc khu vực ${node.code} đã đầy (${projected}/${node.maxCapacity}).`, 409);
    }
  }
};

/** Ghi cặp sổ transfer_out / transfer_in khi món đã sửa được xếp sang kệ khác (balance do itemStateService dời). */
const recordShelfMove = async ({ item, fromStorageId, toStorageId, locationId, recordId, user, session }) => {
  if (fromStorageId && String(fromStorageId) === String(toStorageId)) return;
  const base = {
    variantId: item.variantId, itemId: item._id, locationId, referenceType: 'item_maintenance', referenceId: recordId, createdBy: user._id,
  };
  await recordStockMovement({ ...base, storageId: fromStorageId || null, movementType: 'transfer_out', quantityChange: -1 }, session);
  await recordStockMovement({ ...base, storageId: toStorageId, movementType: 'transfer_in', quantityChange: 1 }, session);
};

/** Sửa thành công: maintenance (kệ cũ) → available ở kệ mới; balance hai kệ dời đúng 1 món. */
const returnRepairedItemToShelf = async ({ central, record, item, validated, user, session }) => {
  const shelf = await StorageLocation.findOne({ _id: validated.targetStorageId, locationId: central._id, type: 'shelf', status: 'active' })
    .session(session).lean();
  if (!shelf) throw appError('Vị trí xếp lại phải là kệ đang hoạt động thuộc kho tổng.');
  await assertShelfCapacity(central._id, item.storageId, shelf._id, session);
  const fromStorageId = item.storageId || null;
  await moveItem(item, { status: 'available', storageId: shelf._id }, session);
  await recordShelfMove({ item, fromStorageId, toStorageId: shelf._id, locationId: central._id, recordId: record._id, user, session });
  record.targetStorageId = shelf._id;
};

/**
 * Không sửa được: món vẫn khóa `maintenance` và sinh đề xuất thanh lý chờ duyệt (như trước TASK-016);
 * duyệt → disposed, từ chối → unavailable (decideDisposal).
 */
const proposeDisposalForUnrepairable = async ({ central, record, item, validated, user, session }) => {
  await ItemDisposal.create([{
    itemId: item._id,
    locationId: central._id,
    maintenanceRecordId: record._id,
    reason: validated.repairDescription || record.issueDescription,
    method: validated.disposalMethod,
    requestedBy: user._id,
    status: DISPOSAL_STATUS.REQUESTED,
    isPending: true,
  }], { session });
};

const applyRepairResult = async (context) => {
  const { item, record, validated, session } = context;
  if (validated.repairResult === 'success') {
    await returnRepairedItemToShelf(context);
    return;
  }
  if (validated.repairResult === 'failed') {
    await moveItem(item, { status: 'unavailable' }, session);
    return;
  }
  await proposeDisposalForUnrepairable(context);
};

/** Nhân viên hoàn tất phiếu với kết quả sửa: thành công / thất bại / không sửa được. */
export const completeMaintenance = async (id, user, validated) => {
  await assertCanOperate(id, user);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const central = await centralWarehouse(session);
      const record = await ItemMaintenanceRecord.findOne({ _id: id, status: MAINTENANCE_STATUS.IN_PROGRESS, isOpen: true })
        .session(session);
      if (!record) throw appError('Phiếu chưa được bắt đầu hoặc đã kết thúc.', 409);
      if (String(record.locationId) !== String(central._id)) throw appError('Phiếu không thuộc kho tổng.', 409);
      const item = await InventoryItem.findOne({ _id: record.itemId, locationId: central._id, status: 'maintenance' })
        .session(session);
      if (!item) throw appError('Món hàng không còn ở trạng thái đang xử lý.', 409);
      const now = new Date();
      await applyRepairResult({ central, record, item, validated, user, session });
      record.repairResult = validated.repairResult;
      record.repairDescription = validated.repairDescription || undefined;
      record.cost = validated.cost;
      record.status = MAINTENANCE_STATUS.COMPLETED;
      record.isOpen = false;
      record.completedAt = now;
      await record.save({ session });
    });
  } catch (error) {
    duplicateGuard(error, 'Món hàng đã có đề xuất thanh lý chờ duyệt.');
  } finally {
    await session.endSession();
  }
  return getMaintenanceRecord(id, user);
};

/** Quản lý hủy phiếu đang mở: món trở lại trạng thái trước khi xử lý. */
export const cancelMaintenance = async (id, user, validated = {}) => {
  requireManager(user, 'Chỉ quản lý kho mới được hủy phiếu giặt/sửa.');
  if (!validId(id)) throw appError('Mã phiếu giặt/sửa không hợp lệ.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const set = { status: MAINTENANCE_STATUS.CANCELLED, isOpen: false, cancelledAt: new Date(), cancelledBy: user._id };
      if (validated.reason) set.note = validated.reason;
      const record = await ItemMaintenanceRecord.findOneAndUpdate(
        { _id: id, status: { $in: OPEN_STATUSES }, isOpen: true },
        { $set: set },
        { new: true, session },
      );
      if (!record) throw appError('Chỉ có thể hủy phiếu đang chờ làm hoặc đang làm.', 409);
      const restoreStatus = ELIGIBLE_STATUSES.includes(record.previousItemStatus) ? record.previousItemStatus : 'unavailable';
      const item = await InventoryItem.findOne({ _id: record.itemId, status: 'maintenance' }).session(session);
      if (!item) throw appError('Món hàng không còn ở trạng thái đang xử lý.', 409);
      await moveItem(item, { status: restoreStatus }, session);
    });
  } finally {
    await session.endSession();
  }
  return getMaintenanceRecord(id, user);
};

/* ----------------------------- Thanh lý ----------------------------- */

export const listDisposals = async (user, { status = '' } = {}) => {
  requireManager(user, 'Chỉ quản lý kho mới được xem đề xuất thanh lý.');
  const filter = {};
  if (Object.values(DISPOSAL_STATUS).includes(status)) filter.status = status;
  return populateDisposal(ItemDisposal.find(filter).sort({ createdAt: -1 })).lean();
};

const getDisposal = async (id) => {
  const row = await populateDisposal(ItemDisposal.findById(id)).lean();
  if (!row) throw appError('Không tìm thấy đề xuất thanh lý.', 404);
  return row;
};

/**
 * Quản lý đề xuất thanh lý trực tiếp: món bị khóa ở trạng thái maintenance cho tới khi duyệt / từ chối,
 * để không bị điều chuyển hoặc gán đơn trong lúc chờ.
 */
export const createDisposal = async (user, validated) => {
  requireManager(user, 'Chỉ quản lý kho mới được tạo đề xuất thanh lý.');
  const session = await mongoose.startSession();
  let id;
  try {
    await session.withTransaction(async () => {
      const central = await centralWarehouse(session);
      const item = await loadEligibleItem(validated.itemId, central._id, session);
      await lockItemForProcessing(item, central._id, session);
      const [doc] = await ItemDisposal.create([{
        itemId: item._id,
        locationId: central._id,
        reason: validated.reason,
        method: validated.method,
        estimatedValue: validated.estimatedValue ?? null,
        requestedBy: user._id,
        status: DISPOSAL_STATUS.REQUESTED,
        isPending: true,
      }], { session });
      id = doc._id;
    });
  } catch (error) {
    duplicateGuard(error, 'Món hàng đang có đề xuất thanh lý chờ duyệt.');
  } finally {
    await session.endSession();
  }
  return getDisposal(id);
};

const disposalDecisionFields = (validated, user, now) => {
  const decided = { isPending: false, decidedBy: user._id, decidedAt: now, decisionNote: validated.decisionNote || '' };
  if (validated.decision !== 'approve') return { ...decided, status: DISPOSAL_STATUS.REJECTED };
  const set = { ...decided, status: DISPOSAL_STATUS.COMPLETED, approvedBy: user._id, approvedAt: now, completedAt: now };
  if (validated.method) set.method = validated.method;
  if (validated.actualValue != null) set.actualValue = validated.actualValue;
  return set;
};

/** Duyệt → món disposed (onHand -1, unavailable -1) và ghi sổ disposal; từ chối → món về unavailable. */
export const decideDisposal = async (id, user, validated) => {
  requireManager(user, 'Chỉ quản lý kho mới được duyệt thanh lý.');
  if (!validId(id)) throw appError('Mã đề xuất thanh lý không hợp lệ.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const central = await centralWarehouse(session);
      const approve = validated.decision === 'approve';
      const set = disposalDecisionFields(validated, user, new Date());
      // Lệnh có điều kiện status=requested: duyệt lặp lại hoặc đồng thời chỉ một lần khớp.
      const disposal = await ItemDisposal.findOneAndUpdate(
        { _id: id, status: DISPOSAL_STATUS.REQUESTED, isPending: true },
        { $set: set },
        { new: true, session },
      );
      if (!disposal) throw appError('Đề xuất thanh lý đã được xử lý trước đó.', 409);
      if (String(disposal.locationId) !== String(central._id)) throw appError('Đề xuất thanh lý không thuộc kho tổng.', 409);
      const item = await InventoryItem.findOne({ _id: disposal.itemId, locationId: central._id, status: 'maintenance' })
        .session(session);
      if (!item) throw appError('Món hàng không còn ở trạng thái chờ thanh lý.', 409);
      await moveItem(item, { status: approve ? 'disposed' : 'unavailable' }, session);
      if (!approve) return;
      await recordStockMovement({
        variantId: item.variantId,
        itemId: item._id,
        locationId: central._id,
        storageId: item.storageId || null,
        movementType: 'disposal',
        quantityChange: -1,
        referenceType: 'item_disposal',
        referenceId: disposal._id,
        createdBy: user._id,
      }, session);
    });
  } finally {
    await session.endSession();
  }
  return getDisposal(id);
};
