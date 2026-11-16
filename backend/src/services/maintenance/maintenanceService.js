import mongoose from 'mongoose';
import { ItemMaintenanceRecord } from '../../models/maintenance/ItemMaintenanceRecord.js';
import { ItemDisposal } from '../../models/maintenance/ItemDisposal.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { StockRelocation } from '../../models/warehouse/transfer/StockRelocation.js';
import { StockRelocationDetail } from '../../models/warehouse/transfer/StockRelocationDetail.js';
import User from '../../models/system/User.js';
import { recordStockMovement } from '../warehouse/inventoryLedgerService.js';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const roleOf = (user) => String(user?.Role || user?.role || '').toLowerCase().replace(/[\s_-]/g, '');
const isManager = (user) => ['warehousemanager', 'admin'].includes(roleOf(user));
const isStaff = (user) => roleOf(user) === 'warehousestaff';
const validId = mongoose.isValidObjectId;

// Trạng thái món được phép đưa vào giặt/sửa hoặc đề xuất thanh lý.
const ELIGIBLE_STATUSES = ['unavailable', 'available'];
const CANDIDATE_CONDITIONS = ['damaged', 'worn'];
const BLOCKED_STATUSES = ['renting', 'in_transit', 'reserved', 'disposed', 'maintenance'];
const OPEN_STATUSES = ['pending', 'in_progress'];

const itemPopulate = {
  path: 'itemId',
  select: 'itemCode serialNumber condition status storageId variantId locationId',
  populate: [
    { path: 'variantId', select: 'sku size color productId', populate: { path: 'productId', select: 'name productCode trackingType' } },
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

const centralWarehouse = async (session) => {
  const rows = await InventoryLocation.find({ type: 'warehouse', status: 'active' }).select('_id code name').session(session || null).lean();
  if (!rows.length) throw fail('Chưa cấu hình kho tổng đang hoạt động.', 409);
  if (rows.length > 1) throw fail('Cần có đúng một kho tổng đang hoạt động.', 409);
  return rows[0];
};

const requireManager = (user, message) => { if (!isManager(user)) throw fail(message, 403); };
const requireWarehouseUser = (user) => { if (!isManager(user) && !isStaff(user)) throw fail('Bạn không có quyền xem phiếu giặt/sửa.', 403); };

const isIndividualVariant = async (variantId, session) => {
  const variant = await ProductVariant.findById(variantId).select('productId').populate('productId', 'trackingType').session(session || null).lean();
  return variant?.productId?.trackingType === 'individual';
};

// Lấy món ở kho tổng và kiểm tra có thể khóa để xử lý. Trả về item (lean) hoặc ném 404/409.
const loadEligibleItem = async (itemId, centralId, session) => {
  const item = await InventoryItem.findById(itemId).session(session).lean();
  if (!item) throw fail('Không tìm thấy món hàng.', 404);
  if (String(item.locationId) !== String(centralId)) throw fail('Món hàng không nằm ở kho tổng.', 409);
  if (BLOCKED_STATUSES.includes(item.status)) throw fail('Món hàng đang được thuê, giữ chỗ, điều chuyển, xử lý hoặc đã thanh lý.', 409);
  if (!ELIGIBLE_STATUSES.includes(item.status) || item.condition === 'missing') throw fail('Món hàng không ở trạng thái có thể xử lý.', 409);
  if (!(await isIndividualVariant(item.variantId, session))) throw fail('Chỉ xử lý được hàng quản lý theo từng món.', 409);
  const [openRecord, pendingDisposal] = await Promise.all([
    ItemMaintenanceRecord.exists({ itemId: item._id, isOpen: true }).session(session),
    ItemDisposal.exists({ itemId: item._id, isPending: true }).session(session),
  ]);
  if (openRecord) throw fail('Món hàng đã có phiếu giặt/sửa đang mở.', 409);
  if (pendingDisposal) throw fail('Món hàng đang có đề xuất thanh lý chờ duyệt.', 409);
  return item;
};

// Chuyển món sang maintenance bằng lệnh có điều kiện để tránh tranh chấp.
const lockItemForProcessing = async (item, centralId, session) => {
  const locked = await InventoryItem.findOneAndUpdate(
    { _id: item._id, locationId: centralId, status: item.status, condition: { $ne: 'missing' } },
    { $set: { status: 'maintenance' } },
    { new: true, session },
  );
  if (!locked) throw fail('Món hàng vừa thay đổi trạng thái, vui lòng tải lại.', 409);
  return locked;
};

const duplicateGuard = (error, message) => {
  if (error?.code === 11000) throw fail(message, 409);
  throw error;
};

/* ----------------------------- Danh sách món cần xử lý ----------------------------- */
export const listMaintenanceCandidates = async (user) => {
  requireManager(user, 'Chỉ quản lý kho mới được xem danh sách món cần xử lý.');
  const central = await centralWarehouse();
  const [openItemIds, pendingItemIds] = await Promise.all([
    ItemMaintenanceRecord.distinct('itemId', { isOpen: true }),
    ItemDisposal.distinct('itemId', { isPending: true }),
  ]);
  const excluded = [...openItemIds, ...pendingItemIds];
  const rows = await InventoryItem.find({
    locationId: central._id,
    status: { $in: ELIGIBLE_STATUSES },
    condition: { $in: CANDIDATE_CONDITIONS },
    ...(excluded.length ? { _id: { $nin: excluded } } : {}),
  })
    .select('itemCode serialNumber condition status storageId variantId locationId updatedAt')
    .populate({ path: 'variantId', select: 'sku size color productId', populate: { path: 'productId', select: 'name productCode trackingType' } })
    .populate('storageId', 'code name type')
    .sort({ status: -1, updatedAt: -1 })
    .lean();
  return rows.filter((row) => row.variantId?.productId?.trackingType === 'individual');
};

export const listMaintenanceStaff = (user) => {
  requireManager(user, 'Chỉ quản lý kho mới được xem danh sách nhân viên.');
  return User.find({ Role: /^warehouse[\s_-]?staff$/i, Status: /^active$/i }).select('FullName Email').sort({ FullName: 1 }).lean();
};

/* ----------------------------- Phiếu giặt / sửa ----------------------------- */
const attachDisposals = async (records) => {
  const ids = records.map((row) => row._id);
  if (!ids.length) return records;
  const disposals = await ItemDisposal.find({ maintenanceRecordId: { $in: ids } }).select('maintenanceRecordId status method reason decisionNote').lean();
  const byRecord = new Map(disposals.map((row) => [String(row.maintenanceRecordId), row]));
  return records.map((row) => ({ ...row, disposal: byRecord.get(String(row._id)) || null }));
};

export const listMaintenanceRecords = async (user, { status = '' } = {}) => {
  requireWarehouseUser(user);
  const filter = isManager(user) ? {} : { assignedTo: user._id };
  if (['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) filter.status = status;
  const rows = await populateRecord(ItemMaintenanceRecord.find(filter).sort({ createdAt: -1 })).lean();
  return attachDisposals(rows);
};

export const getMaintenanceRecord = async (id, user, session) => {
  requireWarehouseUser(user);
  if (!validId(id)) throw fail('Mã phiếu giặt/sửa không hợp lệ.');
  const row = await populateRecord(ItemMaintenanceRecord.findById(id).session(session || null)).lean();
  if (!row) throw fail('Không tìm thấy phiếu giặt/sửa.', 404);
  if (!isManager(user) && String(row.assignedTo?._id || row.assignedTo) !== String(user._id)) throw fail('Phiếu này không được giao cho bạn.', 403);
  const [withDisposal] = await attachDisposals([row]);
  return withDisposal;
};

export const createMaintenanceRecord = async (user, validated) => {
  requireManager(user, 'Chỉ quản lý kho mới được tạo phiếu giặt/sửa.');
  const session = await mongoose.startSession(); let id;
  try {
    await session.withTransaction(async () => {
      const central = await centralWarehouse(session);
      const staff = await User.findOne({ _id: validated.assignedTo, Role: /^warehouse[\s_-]?staff$/i, Status: /^active$/i }).session(session);
      if (!staff) throw fail('Nhân viên kho được giao không tồn tại hoặc đã ngừng hoạt động.');
      const item = await loadEligibleItem(validated.itemId, central._id, session);
      await lockItemForProcessing(item, central._id, session);
      const [doc] = await ItemMaintenanceRecord.create([{
        itemId: item._id, locationId: central._id, sourceType: 'warehouse_inspection',
        maintenanceType: validated.maintenanceType, issueDescription: validated.issueDescription,
        beforeCondition: item.condition === 'missing' ? undefined : item.condition,
        previousItemStatus: item.status, status: 'pending', isOpen: true,
        reportedBy: user._id, assignedTo: staff._id, note: validated.note || undefined,
      }], { session });
      id = doc._id;
    });
  } catch (error) { duplicateGuard(error, 'Món hàng đã có phiếu giặt/sửa đang mở.'); }
  finally { await session.endSession(); }
  return getMaintenanceRecord(id, user);
};

// Kiểm tra quyền thao tác của WS: WM/admin luôn được, WS chỉ phiếu giao cho mình.
const assertCanOperate = async (id, user) => {
  if (!validId(id)) throw fail('Mã phiếu giặt/sửa không hợp lệ.');
  if (!isManager(user) && !isStaff(user)) throw fail('Bạn không có quyền thao tác phiếu giặt/sửa.', 403);
  const row = await ItemMaintenanceRecord.findById(id).select('assignedTo status').lean();
  if (!row) throw fail('Không tìm thấy phiếu giặt/sửa.', 404);
  if (!isManager(user) && String(row.assignedTo) !== String(user._id)) throw fail('Phiếu này không được giao cho bạn.', 403);
  return row;
};

export const startMaintenance = async (id, user) => {
  await assertCanOperate(id, user);
  const updated = await ItemMaintenanceRecord.findOneAndUpdate(
    { _id: id, status: 'pending', isOpen: true },
    { $set: { status: 'in_progress', startedAt: new Date() } },
    { new: true },
  );
  if (!updated) throw fail('Phiếu không còn ở trạng thái chờ làm.', 409);
  return getMaintenanceRecord(id, user);
};

// Kiểm tra sức chứa kệ đích và các cấp cha khi xếp 1 món từ fromStorageId sang toStorageId.
// Cách tính "đã dùng" giống stockRelocationService.checkCapacity: hàng số lượng tính theo InventoryBalance, hàng từng món tính theo InventoryItem.
const assertShelfCapacity = async (locationId, fromStorageId, toStorageId, session) => {
  const storages = await StorageLocation.find({ locationId }).select('_id code parentStorageId maxCapacity').session(session).lean();
  const byId = new Map(storages.map((row) => [String(row._id), row]));
  const chainOf = (storageId) => {
    const chain = []; const visited = new Set(); let cursor = storageId ? byId.get(String(storageId)) : null;
    while (cursor && !visited.has(String(cursor._id))) { visited.add(String(cursor._id)); chain.push(cursor); cursor = cursor.parentStorageId ? byId.get(String(cursor.parentStorageId)) : null; }
    return chain;
  };
  const fromIds = new Set(chainOf(fromStorageId).map((row) => String(row._id)));
  const affected = chainOf(toStorageId).filter((row) => !fromIds.has(String(row._id)) && row.maxCapacity != null);
  if (!affected.length) return;
  const affectedIds = new Set(affected.map((row) => String(row._id)));
  const variants = await ProductVariant.find({}).select('productId').populate('productId', 'trackingType').session(session).lean();
  const quantityIds = variants.filter((row) => row.productId?.trackingType !== 'individual').map((row) => row._id);
  const individualIds = variants.filter((row) => row.productId?.trackingType === 'individual').map((row) => row._id);
  const [balances, itemRows] = await Promise.all([
    quantityIds.length ? InventoryBalance.find({ locationId, storageId: { $ne: null }, variantId: { $in: quantityIds } }).select('storageId quantityOnHand').session(session).lean() : [],
    individualIds.length ? InventoryItem.aggregate([
      { $match: { locationId: new mongoose.Types.ObjectId(String(locationId)), variantId: { $in: individualIds }, storageId: { $ne: null }, status: { $nin: ['disposed', 'in_transit'] }, condition: { $ne: 'missing' } } },
      { $group: { _id: '$storageId', count: { $sum: 1 } } },
    ]).session(session) : [],
  ]);
  const used = new Map();
  const add = (storageId, amount) => { for (const node of chainOf(storageId)) if (affectedIds.has(String(node._id))) used.set(String(node._id), (used.get(String(node._id)) || 0) + amount); };
  for (const row of balances) add(row.storageId, Math.max(0, row.quantityOnHand || 0));
  for (const row of itemRows) add(row._id, row.count);
  // Phiếu tách/gộp đang mở sẽ đưa thêm hàng vào kệ đích.
  const pendingIds = await StockRelocation.find({ locationId, status: { $in: ['assigned', 'in_progress'] } }).distinct('_id').session(session);
  if (pendingIds.length) {
    const lines = await StockRelocationDetail.find({ relocationId: { $in: pendingIds } }).select('fromStorageId toStorageId quantity').session(session).lean();
    for (const line of lines) { add(line.toStorageId, line.quantity); add(line.fromStorageId, -line.quantity); }
  }
  for (const node of affected) {
    const projected = (used.get(String(node._id)) || 0) + 1;
    if (projected > node.maxCapacity) throw fail(`Kệ hoặc khu vực ${node.code} đã đầy (${projected}/${node.maxCapacity}).`, 409);
  }
};

// Đổi kệ cho món đã sửa xong. Theo quy ước stockRelocationService: ghi cặp transfer_out/transfer_in
// và dời InventoryBalance của món theo kệ nếu kệ cũ có balance cho món (hàng nhập qua phiếu nhập).
const moveItemToShelf = async ({ item, toStorageId, locationId, recordId, user, session }) => {
  const fromStorageId = item.storageId || null;
  if (fromStorageId && String(fromStorageId) === String(toStorageId)) return;
  const source = await InventoryBalance.findOne({ locationId, storageId: fromStorageId, variantId: item.variantId }).session(session);
  // Chỉ dời khi balance nguồn còn phần dư cho món này (không đụng phần đang giữ chỗ/không khả dụng của món khác).
  if (source && source.quantityOnHand - 1 >= source.quantityReserved + source.quantityUnavailable) {
    source.quantityOnHand -= 1; await source.save({ session });
    await InventoryBalance.findOneAndUpdate(
      { locationId, storageId: toStorageId, variantId: item.variantId },
      { $inc: { quantityOnHand: 1 } },
      { upsert: true, new: true, session, setDefaultsOnInsert: true, runValidators: true },
    );
  }
  const base = { variantId: item.variantId, itemId: item._id, locationId, referenceType: 'item_maintenance', referenceId: recordId, createdBy: user._id };
  await recordStockMovement({ ...base, storageId: fromStorageId, movementType: 'transfer_out', quantityChange: -1 }, session);
  await recordStockMovement({ ...base, storageId: toStorageId, movementType: 'transfer_in', quantityChange: 1 }, session);
};

export const completeMaintenance = async (id, user, validated) => {
  await assertCanOperate(id, user);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const central = await centralWarehouse(session);
      const record = await ItemMaintenanceRecord.findOne({ _id: id, status: 'in_progress', isOpen: true }).session(session);
      if (!record) throw fail('Phiếu chưa được bắt đầu hoặc đã kết thúc.', 409);
      if (String(record.locationId) !== String(central._id)) throw fail('Phiếu không thuộc kho tổng.', 409);
      const item = await InventoryItem.findOne({ _id: record.itemId, locationId: central._id, status: 'maintenance' }).session(session);
      if (!item) throw fail('Món hàng không còn ở trạng thái đang xử lý.', 409);
      const now = new Date();

      if (validated.repairResult === 'success') {
        const shelf = await StorageLocation.findOne({ _id: validated.targetStorageId, locationId: central._id, type: 'shelf', status: 'active' }).session(session).lean();
        if (!shelf) throw fail('Vị trí xếp lại phải là kệ đang hoạt động thuộc kho tổng.');
        await assertShelfCapacity(central._id, item.storageId, shelf._id, session);
        await moveItemToShelf({ item, toStorageId: shelf._id, locationId: central._id, recordId: record._id, user, session });
        const updated = await InventoryItem.findOneAndUpdate(
          { _id: item._id, status: 'maintenance' },
          { $set: { status: 'available', condition: validated.afterCondition, storageId: shelf._id } },
          { new: true, session },
        );
        if (!updated) throw fail('Món hàng vừa thay đổi trạng thái, vui lòng tải lại.', 409);
        record.afterCondition = validated.afterCondition;
        record.targetStorageId = shelf._id;
      } else if (validated.repairResult === 'failed') {
        const updated = await InventoryItem.findOneAndUpdate(
          { _id: item._id, status: 'maintenance' },
          { $set: { status: 'unavailable', condition: 'damaged' } },
          { new: true, session },
        );
        if (!updated) throw fail('Món hàng vừa thay đổi trạng thái, vui lòng tải lại.', 409);
        record.afterCondition = 'damaged';
      } else {
        const updated = await InventoryItem.findOneAndUpdate(
          { _id: item._id, status: 'maintenance' },
          { $set: { condition: 'unrepairable' } },
          { new: true, session },
        );
        if (!updated) throw fail('Món hàng vừa thay đổi trạng thái, vui lòng tải lại.', 409);
        record.afterCondition = 'unrepairable';
        await ItemDisposal.create([{
          itemId: item._id, locationId: central._id, maintenanceRecordId: record._id,
          reason: validated.repairDescription || record.issueDescription,
          method: validated.disposalMethod, requestedBy: user._id, status: 'requested', isPending: true,
        }], { session });
      }

      record.repairResult = validated.repairResult;
      record.repairDescription = validated.repairDescription || undefined;
      record.cost = validated.cost;
      record.status = 'completed';
      record.isOpen = false;
      record.completedAt = now;
      await record.save({ session });
    });
  } catch (error) { duplicateGuard(error, 'Món hàng đã có đề xuất thanh lý chờ duyệt.'); }
  finally { await session.endSession(); }
  return getMaintenanceRecord(id, user);
};

export const cancelMaintenance = async (id, user, validated = {}) => {
  requireManager(user, 'Chỉ quản lý kho mới được hủy phiếu giặt/sửa.');
  if (!validId(id)) throw fail('Mã phiếu giặt/sửa không hợp lệ.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const record = await ItemMaintenanceRecord.findOneAndUpdate(
        { _id: id, status: { $in: OPEN_STATUSES }, isOpen: true },
        { $set: { status: 'cancelled', isOpen: false, cancelledAt: new Date(), cancelledBy: user._id, ...(validated.reason ? { note: validated.reason } : {}) } },
        { new: true, session },
      );
      if (!record) throw fail('Chỉ có thể hủy phiếu đang chờ làm hoặc đang làm.', 409);
      const restoreStatus = ELIGIBLE_STATUSES.includes(record.previousItemStatus) ? record.previousItemStatus : 'unavailable';
      const item = await InventoryItem.findOneAndUpdate(
        { _id: record.itemId, status: 'maintenance' },
        { $set: { status: restoreStatus } },
        { new: true, session },
      );
      if (!item) throw fail('Món hàng không còn ở trạng thái đang xử lý.', 409);
    });
  } finally { await session.endSession(); }
  return getMaintenanceRecord(id, user);
};

/* ----------------------------- Thanh lý ----------------------------- */
export const listDisposals = async (user, { status = '' } = {}) => {
  requireManager(user, 'Chỉ quản lý kho mới được xem đề xuất thanh lý.');
  const filter = {};
  if (['requested', 'approved', 'rejected', 'completed'].includes(status)) filter.status = status;
  return populateDisposal(ItemDisposal.find(filter).sort({ createdAt: -1 })).lean();
};

const getDisposal = async (id) => {
  const row = await populateDisposal(ItemDisposal.findById(id)).lean();
  if (!row) throw fail('Không tìm thấy đề xuất thanh lý.', 404);
  return row;
};

// WM đề xuất thanh lý trực tiếp: món bị khóa ở trạng thái maintenance cho tới khi duyệt/từ chối,
// để không bị điều chuyển hoặc gán đơn trong lúc chờ.
export const createDisposal = async (user, validated) => {
  requireManager(user, 'Chỉ quản lý kho mới được tạo đề xuất thanh lý.');
  const session = await mongoose.startSession(); let id;
  try {
    await session.withTransaction(async () => {
      const central = await centralWarehouse(session);
      const item = await loadEligibleItem(validated.itemId, central._id, session);
      await lockItemForProcessing(item, central._id, session);
      const [doc] = await ItemDisposal.create([{
        itemId: item._id, locationId: central._id, reason: validated.reason, method: validated.method,
        estimatedValue: validated.estimatedValue ?? null, requestedBy: user._id, status: 'requested', isPending: true,
      }], { session });
      id = doc._id;
    });
  } catch (error) { duplicateGuard(error, 'Món hàng đang có đề xuất thanh lý chờ duyệt.'); }
  finally { await session.endSession(); }
  return getDisposal(id);
};

export const decideDisposal = async (id, user, validated) => {
  requireManager(user, 'Chỉ quản lý kho mới được duyệt thanh lý.');
  if (!validId(id)) throw fail('Mã đề xuất thanh lý không hợp lệ.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const central = await centralWarehouse(session);
      const now = new Date();
      const approve = validated.decision === 'approve';
      const set = approve
        ? {
          status: 'completed', isPending: false, approvedBy: user._id, approvedAt: now, completedAt: now,
          decidedBy: user._id, decidedAt: now, decisionNote: validated.decisionNote || '',
          ...(validated.method ? { method: validated.method } : {}),
          ...(validated.actualValue != null ? { actualValue: validated.actualValue } : {}),
        }
        : { status: 'rejected', isPending: false, decidedBy: user._id, decidedAt: now, decisionNote: validated.decisionNote || '' };
      // Lệnh có điều kiện status=requested: duyệt lặp lại hoặc đồng thời chỉ một lần khớp.
      const disposal = await ItemDisposal.findOneAndUpdate({ _id: id, status: 'requested', isPending: true }, { $set: set }, { new: true, session });
      if (!disposal) throw fail('Đề xuất thanh lý đã được xử lý trước đó.', 409);
      if (String(disposal.locationId) !== String(central._id)) throw fail('Đề xuất thanh lý không thuộc kho tổng.', 409);
      const item = await InventoryItem.findOneAndUpdate(
        { _id: disposal.itemId, locationId: central._id, status: 'maintenance' },
        { $set: { status: approve ? 'disposed' : 'unavailable' } },
        { new: true, session },
      );
      if (!item) throw fail('Món hàng không còn ở trạng thái chờ thanh lý.', 409);
      if (approve) {
        // Theo quy ước applyStockAdjustment: hàng từng món khi loại bỏ chỉ đổi trạng thái + ghi StockMovement, không trừ InventoryBalance.
        await recordStockMovement({
          variantId: item.variantId, itemId: item._id, locationId: central._id, storageId: item.storageId || null,
          movementType: 'disposal', quantityChange: -1, referenceType: 'item_disposal', referenceId: disposal._id, createdBy: user._id,
        }, session);
      }
    });
  } finally { await session.endSession(); }
  return getDisposal(id);
};
