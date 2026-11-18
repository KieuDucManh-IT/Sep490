// Di chuyển hàng giữa các kệ trong kho tổng (phiếu nội bộ, không đổi tổng tồn của kho).
// Mỗi dòng là một lệnh tổng quát: biến thể · từ kệ → đến kệ · số lượng; xử lý không phụ thuộc operationType
// (phiếu mới 'move'; 'split' / 'merge' là dữ liệu cũ, đi cùng một đường xử lý).
// Luồng trạng thái: assigned → in_progress → completed   (assigned / in_progress có thể bị cancelled).
// Ai làm bước nào:
// - Quản lý kho: tạo phiếu (giữ hàng ở kệ nguồn ngay lúc tạo) và giao nhân viên, hủy khi phiếu chưa hoàn tất.
// - Nhân viên kho được giao: bắt đầu thực hiện, xác nhận đã chuyển (kệ nguồn giảm, kệ đích tăng).
// Sức chứa kệ đích (và các cấp cha) được kiểm lúc tạo phiếu, tính cả các phiếu di chuyển khác đang mở.
import mongoose from 'mongoose';
import { StockRelocation } from '../../models/warehouse/transfer/StockRelocation.js';
import { StockRelocationDetail } from '../../models/warehouse/transfer/StockRelocationDetail.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import User from '../../models/system/User.js';
import {
  increaseInventoryBalance, recordStockMovement, releaseReservedBalance, reserveInventoryBalance,
} from './inventoryLedgerService.js';
import { moveItems } from './itemStateService.js';
import { availableOf, stockMismatchError } from './balanceQueryService.js';
import { appError } from './shared/errors.js';
import { WAREHOUSE_STAFF_ROLE_PATTERN, isSameUser, isWarehouseManagerOrAdmin, isWarehouseStaff } from './shared/roles.js';
import { getCentralWarehouse } from './shared/locations.js';
import { addToStorageChain } from './shared/capacity.js';
import { parsePaging } from './shared/pagination.js';
import { andFilter, buildSearchFilter, listSlips } from './shared/listing.js';

export const RELOCATION_STATUS = {
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};
const OPEN_STATUSES = [RELOCATION_STATUS.ASSIGNED, RELOCATION_STATUS.IN_PROGRESS];
const OPERATION_TYPES = ['move', 'split', 'merge'];
/** Món có tình trạng này không được chọn để dời kệ. */
const UNMOVABLE_CONDITIONS = ['damaged', 'unrepairable', 'missing'];

const validId = mongoose.isValidObjectId;
const makeCode = () => {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `DC-${day}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
};
const populated = (query) => query
  .populate('locationId', 'code name')
  .populate('createdBy', 'FullName Email')
  .populate('assignedStaffId', 'FullName Email');

/** Chi tiết đầy đủ của một hoặc nhiều phiếu (một truy vấn $in). */
const findDetails = (ids) => StockRelocationDetail.find({ relocationId: { $in: ids } }).sort({ createdAt: 1 })
  .populate({
    path: 'variantId',
    select: 'sku size color productId',
    populate: { path: 'productId', select: 'name productCode trackingType' },
  })
  .populate('fromStorageId', 'code name type')
  .populate('toStorageId', 'code name type')
  .populate('itemIds', 'itemCode serialNumber condition status')
  .populate('confirmedItemIds', 'itemCode serialNumber condition status');

const isIndividualVariant = async (variantId, session) => {
  const variant = await ProductVariant.findById(variantId).populate('productId', 'trackingType').session(session);
  return variant?.productId?.trackingType === 'individual';
};

const load = async (id, user, session) => {
  if (!validId(id)) throw appError('Mã phiếu di chuyển không hợp lệ.');
  let query = StockRelocation.findById(id);
  if (session) query = query.session(session);
  const doc = await populated(query);
  if (!doc) throw appError('Không tìm thấy phiếu di chuyển.', 404);
  if (!isWarehouseManagerOrAdmin(user) && !isSameUser(doc.assignedStaffId, user)) {
    throw appError('Phiếu này không được giao cho bạn.', 403);
  }
  return { ...doc.toObject(), items: await findDetails([id]) };
};

/* ------------------------------ Danh sách ------------------------------ */

/**
 * Danh sách phiếu di chuyển. Query: operationType (move|split|merge), status, search, page, limit.
 * Có page/limit → { items, total, page, limit } (kèm lineCount, totalQuantity); không có → mảng như cũ.
 */
export const listStockRelocations = async (user, query = {}) => {
  const manager = isWarehouseManagerOrAdmin(user);
  if (!manager && !isWarehouseStaff(user)) throw appError('Bạn không có quyền xem phiếu di chuyển.', 403);
  const filter = manager ? {} : { assignedStaffId: user._id };
  if (OPERATION_TYPES.includes(query.operationType)) filter.operationType = query.operationType;
  if (query.status && Object.values(RELOCATION_STATUS).includes(query.status)) filter.status = query.status;
  const searchFilter = await buildSearchFilter(query.search, {
    codeField: 'relocationCode',
    locationFields: ['locationId'],
    userFields: ['createdBy', 'assignedStaffId'],
  });
  return listSlips({
    Model: StockRelocation,
    filter: andFilter(filter, searchFilter),
    decorate: populated,
    paging: parsePaging(query),
    attachDetails: { findDetails, parentField: 'relocationId' },
    summary: { DetailModel: StockRelocationDetail, parentField: 'relocationId', quantityField: 'quantity' },
  });
};
export const getStockRelocation = load;
export const listRelocationStaff = () => User.find({ Role: WAREHOUSE_STAFF_ROLE_PATTERN, Status: /^active$/i })
  .select('FullName Email').sort({ FullName: 1 }).lean();

/* ------------------------------ Sức chứa và kệ ------------------------------ */

/** Đi từ kệ lên các cấp cha; mọi cấp phải đang hoạt động trong kho tổng và cấp đầu phải là kệ. */
const storageChain = async (storageId, locationId, session) => {
  const chain = [];
  const visited = new Set();
  let currentId = storageId;
  while (currentId) {
    if (visited.has(String(currentId))) throw appError('Cấu trúc vị trí lưu trữ có vòng lặp.', 409);
    visited.add(String(currentId));
    let query = StorageLocation.findOne({ _id: currentId, locationId, status: 'active' });
    if (session) query = query.session(session);
    const current = await query.lean();
    if (!current) throw appError('Vị trí nguồn hoặc đích không thuộc kho tổng đang hoạt động.', 400);
    chain.push(current);
    currentId = current.parentStorageId;
  }
  if (chain[0]?.type !== 'shelf') throw appError('Chỉ có thể di chuyển hàng từ hoặc đến kệ lưu trữ.', 400);
  return chain;
};

/** Cộng phần chênh (nguồn −, đích +) của các dòng di chuyển vào `delta` theo kệ và cấp cha. */
const addMoveDeltas = (delta, byId, lines) => {
  for (const line of lines) {
    addToStorageChain(delta, byId, String(line.fromStorageId), -line.quantity);
    addToStorageChain(delta, byId, String(line.toStorageId), line.quantity);
  }
};

/** Sức chứa sau khi áp phiếu mới và các phiếu đang mở; chỉ đọc InventoryBalance.quantityOnHand. */
const checkCapacity = async (locationId, lines, session) => {
  const storages = await StorageLocation.find({ locationId }).select('_id parentStorageId maxCapacity')
    .session(session || null).lean();
  const byId = new Map(storages.map((x) => [String(x._id), x]));
  const balances = await InventoryBalance.find({ locationId, storageId: { $ne: null } })
    .select('storageId quantityOnHand').session(session || null).lean();
  const used = new Map();
  for (const row of balances) addToStorageChain(used, byId, String(row.storageId), Math.max(0, row.quantityOnHand || 0));
  const delta = new Map();
  const pendingIds = await StockRelocation.find({ locationId, status: { $in: OPEN_STATUSES } }).distinct('_id')
    .session(session || null);
  if (pendingIds.length) {
    const pendingLines = await StockRelocationDetail.find({ relocationId: { $in: pendingIds } })
      .select('fromStorageId toStorageId quantity').session(session || null).lean();
    addMoveDeltas(delta, byId, pendingLines);
  }
  addMoveDeltas(delta, byId, lines);
  for (const storage of storages) {
    if (storage.maxCapacity == null) continue;
    const projected = (used.get(String(storage._id)) || 0) + (delta.get(String(storage._id)) || 0);
    if (projected > storage.maxCapacity) {
      throw appError(`Kệ hoặc khu vực ${storage._id} vượt sức chứa tối đa (${projected}/${storage.maxCapacity}).`, 409);
    }
  }
};

/* ------------------------------ Tạo phiếu ------------------------------ */

const loadVariantTracking = async (items, session) => {
  const variantIds = [...new Set(items.map((x) => x.variantId))];
  const variantRows = await ProductVariant.find({ _id: { $in: variantIds }, status: 'active', isDeleted: { $ne: true } })
    .populate('productId', 'trackingType status isDeleted').session(session).lean();
  const inactive = (v) => !v.productId || v.productId.status !== 'active' || v.productId.isDeleted;
  if (variantRows.length !== variantIds.length || variantRows.some(inactive)) {
    throw appError('Có biến thể không tồn tại hoặc đã ngừng kinh doanh.');
  }
  return new Map(variantRows.map((v) => [String(v._id), v.productId.trackingType || 'quantity']));
};

/**
 * Giữ hàng ở kệ nguồn cho một dòng: kiểm khả dụng trên balance trước; hàng individual giữ các món cũ nhất
 * (chọn thiếu = dữ liệu lệch), hàng quantity tăng reserved bằng lệnh có điều kiện.
 */
const holdSourceStock = async ({ central, line, individual, session }) => {
  const place = { locationId: central._id, storageId: line.fromStorageId, variantId: line.variantId };
  const balance = await InventoryBalance.findOne(place).session(session);
  const available = availableOf(balance);
  const message = `Tồn khả dụng tại kệ nguồn không đủ (${available}/${line.quantity}).`;
  if (!balance || available < line.quantity) throw appError(message, 409);
  if (!individual) {
    await reserveInventoryBalance({ ...place, quantity: line.quantity, session, message });
    line.itemIds = [];
    return;
  }
  const items = await InventoryItem.find({ ...place, status: 'available', condition: { $nin: UNMOVABLE_CONDITIONS } })
    .sort({ createdAt: 1 }).limit(line.quantity).session(session);
  if (items.length !== line.quantity) {
    throw stockMismatchError({ ...place, expected: available, found: items.length, context: 'createStockRelocation' });
  }
  line.itemIds = items.map((x) => x._id);
  await moveItems(items, { status: 'reserved', warehouseHold: 1 }, session);
};

/** Quản lý kho tạo phiếu di chuyển: giữ hàng ở kệ nguồn, kiểm sức chứa kệ đích, giao nhân viên. */
export const createStockRelocation = async (payload, user, validated) => {
  if (!isWarehouseManagerOrAdmin(user)) throw appError('Chỉ quản lý kho mới được tạo và giao phiếu di chuyển.', 403);
  const session = await mongoose.startSession();
  let id;
  try {
    await session.withTransaction(async () => {
      const central = await getCentralWarehouse(session, {
        select: '_id code name', message: 'Cần có đúng một kho tổng đang hoạt động để di chuyển hàng.',
      });
      const staff = await User.findOne({ _id: validated.assignedStaffId, Role: WAREHOUSE_STAFF_ROLE_PATTERN, Status: /^active$/i })
        .session(session);
      if (!staff) throw appError('Nhân viên kho được giao không tồn tại hoặc đã ngừng hoạt động.');
      const tracking = await loadVariantTracking(validated.items, session);
      for (const line of validated.items) {
        await storageChain(line.fromStorageId, central._id, session);
        await storageChain(line.toStorageId, central._id, session);
        const individual = tracking.get(line.variantId) === 'individual';
        await holdSourceStock({ central, line, individual, session });
      }
      await checkCapacity(central._id, validated.items, session);
      const [doc] = await StockRelocation.create([{
        relocationCode: makeCode(),
        locationId: central._id,
        createdBy: user._id,
        assignedStaffId: staff._id,
        operationType: validated.operationType,
        status: RELOCATION_STATUS.ASSIGNED,
        note: validated.note,
      }], { session });
      id = doc._id;
      await StockRelocationDetail.insertMany(validated.items.map((line) => ({ relocationId: id, ...line })), { session });
    });
  } finally {
    await session.endSession();
  }
  return load(id, user);
};

/** Nhân viên được giao bắt đầu thực hiện phiếu. */
export const startStockRelocation = async (id, user) => {
  if (!validId(id)) throw appError('Mã phiếu di chuyển không hợp lệ.');
  const doc = await StockRelocation.findOneAndUpdate(
    { _id: id, assignedStaffId: user._id, status: RELOCATION_STATUS.ASSIGNED },
    { $set: { status: RELOCATION_STATUS.IN_PROGRESS, startedAt: new Date() } },
    { new: true },
  );
  if (!doc) throw appError('Phiếu không còn ở trạng thái được nhận thực hiện hoặc không được giao cho bạn.', 409);
  return load(id, user);
};

/* ------------------------------ Hoàn tất ------------------------------ */

/** Số và món xác nhận phải khớp đúng phần đã giữ cho phiếu; chênh lệch thì báo quản lý xử lý. */
const checkConfirmation = (row, result, individual) => {
  if (result.quantityMoved !== row.quantity) {
    throw appError('Số lượng xác nhận phải khớp số đã được giao; nếu phát hiện chênh lệch hãy báo quản lý kho xử lý phiếu.', 409);
  }
  if (individual) {
    const reserved = new Set(row.itemIds.map(String));
    if (result.itemIds.length !== row.quantity || result.itemIds.some((itemId) => !reserved.has(itemId))) {
      throw appError('Danh sách món đã chọn phải khớp số lượng và các món đã được giữ cho phiếu.', 409);
    }
  } else if (result.itemIds.length) {
    throw appError('Dòng quản lý theo số lượng không nhận danh sách mã hàng.');
  }
};

const relocationMovement = (doc, row, user, extra) => ({
  variantId: row.variantId,
  locationId: doc.locationId,
  referenceType: 'stock_relocation',
  referenceId: doc._id,
  createdBy: user._id,
  ...extra,
});

/** Món đang giữ ở kệ nguồn → available ở kệ đích, nhả giữ. Ghi sổ transfer_out rồi transfer_in. */
const moveReservedItemsToTarget = async ({ doc, row, result, user, session }) => {
  const items = await InventoryItem.find({
    _id: { $in: result.itemIds }, locationId: doc.locationId, storageId: row.fromStorageId, status: 'reserved',
  }).session(session);
  if (items.length !== row.quantity) {
    throw appError('Có món hàng không còn ở kệ nguồn hoặc không còn được giữ cho phiếu.', 409);
  }
  await moveItems(items, { storageId: row.toStorageId, status: 'available', warehouseHold: -1 }, session);
  for (const item of items) {
    await recordStockMovement(relocationMovement(doc, row, user, {
      itemId: item._id, storageId: row.fromStorageId, movementType: 'transfer_out', quantityChange: -1,
    }), session);
  }
  for (const item of items) {
    await recordStockMovement(relocationMovement(doc, row, user, {
      itemId: item._id, storageId: row.toStorageId, movementType: 'transfer_in', quantityChange: 1,
    }), session);
  }
};

/** Hàng quantity: kệ nguồn nhả giữ và giảm tồn, kệ đích tăng tồn. */
const moveReservedQuantityToTarget = async ({ doc, row, user, session }) => {
  await releaseReservedBalance({
    locationId: doc.locationId,
    storageId: row.fromStorageId,
    variantId: row.variantId,
    quantity: row.quantity,
    alsoRemoveOnHand: true,
    session,
    message: 'Tồn kho nguồn đã thay đổi, không thể hoàn tất phiếu.',
  });
  await increaseInventoryBalance({
    locationId: doc.locationId, storageId: row.toStorageId, variantId: row.variantId, quantity: row.quantity, session,
  });
  await recordStockMovement(relocationMovement(doc, row, user, {
    storageId: row.fromStorageId, movementType: 'transfer_out', quantityChange: -row.quantity,
  }), session);
  await recordStockMovement(relocationMovement(doc, row, user, {
    storageId: row.toStorageId, movementType: 'transfer_in', quantityChange: row.quantity,
  }), session);
};

/** Nhân viên xác nhận đã chuyển xong từng dòng: hàng rời kệ nguồn sang kệ đích. */
export const completeStockRelocation = async (id, user, confirmations) => {
  if (!validId(id)) throw appError('Mã phiếu di chuyển không hợp lệ.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Giành trạng thái trước (in_progress → completed) để hủy đồng thời không nhả hàng đã chuyển.
      const doc = await StockRelocation.findOneAndUpdate(
        { _id: id, assignedStaffId: user._id, status: RELOCATION_STATUS.IN_PROGRESS },
        { $set: { status: RELOCATION_STATUS.COMPLETED, completedAt: new Date() } },
        { new: true, session },
      );
      if (!doc) throw appError('Phiếu chưa được bắt đầu, đã bị hủy hoặc không được giao cho bạn.', 409);
      const rows = await StockRelocationDetail.find({ relocationId: id }).session(session);
      const incoming = new Map(confirmations.map((x) => [x.detailId, x]));
      if (incoming.size !== rows.length || rows.some((row) => !incoming.has(String(row._id)))) {
        throw appError('Cần xác nhận đầy đủ từng dòng trên phiếu.');
      }
      for (const row of rows) {
        const result = incoming.get(String(row._id));
        const individual = await isIndividualVariant(row.variantId, session);
        checkConfirmation(row, result, individual);
        if (individual) await moveReservedItemsToTarget({ doc, row, result, user, session });
        else await moveReservedQuantityToTarget({ doc, row, user, session });
        row.confirmedQuantity = result.quantityMoved;
        row.confirmedItemIds = result.itemIds;
        row.confirmedBy = user._id;
        row.confirmedAt = new Date();
        await row.save({ session });
      }
    });
  } finally {
    await session.endSession();
  }
  return load(id, user);
};

/* ------------------------------ Hủy ------------------------------ */

/**
 * Quản lý hủy phiếu chưa hoàn tất (đã giao hoặc đang thực hiện): nhả toàn bộ hàng đã giữ ở kệ nguồn.
 * Hàng chỉ rời kệ nguồn ở bước hoàn tất nên hủy chỉ cần nhả giữ.
 */
export const cancelStockRelocation = async (id, user) => {
  if (!isWarehouseManagerOrAdmin(user)) throw appError('Chỉ quản lý kho mới được hủy phiếu di chuyển.', 403);
  if (!validId(id)) throw appError('Mã phiếu di chuyển không hợp lệ.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Giành trạng thái bằng lệnh có điều kiện để hủy và hoàn tất loại trừ nhau.
      const doc = await StockRelocation.findOneAndUpdate(
        { _id: id, status: { $in: OPEN_STATUSES } },
        { $set: { status: RELOCATION_STATUS.CANCELLED, cancelledAt: new Date() } },
        { new: true, session },
      );
      if (!doc) throw appError('Chỉ có thể hủy phiếu chưa hoàn tất.', 409);
      const rows = await StockRelocationDetail.find({ relocationId: id }).session(session);
      for (const row of rows) {
        const source = { locationId: doc.locationId, storageId: row.fromStorageId };
        if (await isIndividualVariant(row.variantId, session)) {
          const items = await InventoryItem.find({ _id: { $in: row.itemIds }, ...source, status: 'reserved' })
            .session(session);
          if (items.length !== row.itemIds.length) {
            throw appError('Có món hàng của phiếu không còn được giữ ở kệ nguồn; hãy tải lại và báo quản lý kho đối soát.', 409);
          }
          await moveItems(items, { status: 'available', warehouseHold: -1 }, session);
        } else {
          await releaseReservedBalance({
            ...source,
            variantId: row.variantId,
            quantity: row.quantity,
            session,
            message: 'Số đang giữ ở kệ nguồn không khớp phiếu; hãy tải lại và báo quản lý kho đối soát.',
          });
        }
      }
    });
  } finally {
    await session.endSession();
  }
  return load(id, user);
};
