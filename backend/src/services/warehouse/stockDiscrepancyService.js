// Phiếu chênh lệch điều chuyển (UC-29): ghi nhận hàng bị THIẾU khi nhận điều chuyển và kết luận về sau.
// Luồng trạng thái: open → partially_resolved → resolved (kết luận từng phần cho tới khi hết số thiếu).
// - Hệ thống tự mở phiếu khi chi nhánh chốt nhận hàng thiếu (stockTransferService) hoặc kho tổng xếp
//   hàng trả về bị thiếu (branchReturnService).
// - Quản lý kho tổng (hoặc admin) kết luận: "tìm thấy" → nhập lại về nơi nhận ban đầu hoặc kệ kho tổng;
//   "mất" → món chuyển disposed (hàng số lượng chỉ ghi số, vì lúc xuất đã trừ tồn).
// - Quản lý chi nhánh chỉ xem phiếu liên quan tới chi nhánh mình.
import mongoose from 'mongoose';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { Shop } from '../../models/shop/Shop.js';
import { StockDiscrepancy } from '../../models/warehouse/transfer/StockDiscrepancy.js';
import { discrepancyStatuses, validateResolveDiscrepancy } from '../../validations/warehouse/stockDiscrepancyValidation.js';
import { increaseInventoryBalance, recordStockMovement } from './inventoryLedgerService.js';
import { moveItem, moveItems } from './itemStateService.js';
import { appError } from './shared/errors.js';
import { isBranchManager, isWarehouseManagerOrAdmin } from './shared/roles.js';
import { getCentralWarehouse } from './shared/locations.js';
import { assertBranchCapacity, capacitySnapshot } from './shared/capacity.js';
import { parsePaging } from './shared/pagination.js';
import { andFilter, buildSearchFilter, listSlips } from './shared/listing.js';

export const DISCREPANCY_STATUS = {
  OPEN: 'open',
  PARTIALLY_RESOLVED: 'partially_resolved',
  RESOLVED: 'resolved',
};
const UNRESOLVED_STATUSES = [DISCREPANCY_STATUS.OPEN, DISCREPANCY_STATUS.PARTIALLY_RESOLVED];
/** Bộ lọc "chưa kết luận xong" dùng ở màn hình (open + partially_resolved). */
const PENDING_FILTER = 'pending';

const validId = (id) => mongoose.isValidObjectId(id);
const idOf = (value) => String(value?._id || value || '');
const makeCode = () => {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `CL-${day}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
};

const population = [
  { path: 'transferId', select: 'transferCode direction status' },
  { path: 'fromLocationId', select: 'code name type' },
  { path: 'toLocationId', select: 'code name type' },
  {
    path: 'variantId',
    select: 'sku size color productId',
    populate: { path: 'productId', select: 'productCode name trackingType' },
  },
  { path: 'itemIds', select: 'itemCode serialNumber condition status locationId storageId' },
  { path: 'createdBy', select: 'FullName Email' },
  { path: 'resolutions.resolvedBy', select: 'FullName Email' },
  { path: 'resolutions.targetLocationId', select: 'code name type' },
  { path: 'resolutions.targetStorageId', select: 'code name type' },
  { path: 'resolutions.itemIds', select: 'itemCode serialNumber' },
];

/* ------------------------------ Mở phiếu khi nhận thiếu ------------------------------ */

/** Món thiếu = món đã xuất nhưng không có trong danh sách nhận; đánh dấu missing, nhớ condition cũ. */
const markMissingItems = async (detail, missing, session) => {
  const received = new Set((detail.receivedItemIds || []).map(String));
  const missingIds = (detail.itemIds || []).map(String).filter((id) => !received.has(id));
  const items = await InventoryItem.find({ _id: { $in: missingIds }, status: 'in_transit' })
    .select('_id itemCode variantId locationId storageId status condition').session(session).lean();
  if (items.length !== missing) throw appError('Số món thiếu không khớp với danh sách mã hàng đang điều chuyển.', 409);
  // Món vẫn in_transit (không nằm trong balance), chỉ đổi tình trạng; đi qua itemStateService cho thống nhất.
  await moveItems(items, { condition: 'missing' }, session);
  return {
    itemIds: items.map((item) => item._id),
    itemPreviousConditions: items.map((item) => ({ itemId: item._id, condition: item.condition || 'good' })),
  };
};

/**
 * Mở phiếu chênh lệch cho các dòng điều chuyển bị thiếu. Gọi trong transaction của bước chốt nhận hàng.
 * Hàng individual: món thiếu giữ `in_transit` nhưng đặt `condition: 'missing'` để không bị chọn nhầm,
 * condition cũ được lưu lại để khôi phục khi tìm thấy. Hàng quantity chỉ ghi số thiếu.
 * Không ghi sổ biến động vì lúc xuất đã ghi transfer_out đủ số lượng.
 */
export const openTransferDiscrepancies = async ({ transfer, details, tracking, user, session }) => {
  const created = [];
  for (const detail of details) {
    const missing = Number(detail.quantityMissing || 0);
    if (missing <= 0 || detail.discrepancyId) continue;
    const individual = tracking.get(String(detail.variantId)) === 'individual';
    const missingItems = individual
      ? await markMissingItems(detail, missing, session)
      : { itemIds: [], itemPreviousConditions: [] };
    const [discrepancy] = await StockDiscrepancy.create([{
      discrepancyCode: makeCode(),
      transferId: transfer._id,
      transferDetailId: detail._id,
      direction: transfer.direction || 'central_to_branch',
      fromLocationId: transfer.fromLocationId,
      toLocationId: transfer.toLocationId,
      variantId: detail.variantId,
      trackingType: individual ? 'individual' : 'quantity',
      quantityMissing: missing,
      ...missingItems,
      status: DISCREPANCY_STATUS.OPEN,
      createdBy: user._id,
    }], { session });
    detail.discrepancyId = discrepancy._id;
    await detail.save({ session });
    created.push(discrepancy);
  }
  return created;
};

/* ------------------------------ Xem / danh sách ------------------------------ */

const branchLocationIds = async (user) => {
  const shopIds = await Shop.find({ managerId: user._id, status: 'ACTIVE', isDeleted: { $ne: true } }).distinct('_id');
  if (!shopIds.length) return [];
  return InventoryLocation.find({ shopId: { $in: shopIds }, type: 'store' }).distinct('_id');
};

const assertCanView = async (discrepancy, user) => {
  if (isWarehouseManagerOrAdmin(user)) return;
  if (!isBranchManager(user)) throw appError('Bạn không có quyền xem phiếu chênh lệch.', 403);
  const allowed = new Set((await branchLocationIds(user)).map(String));
  const related = allowed.has(idOf(discrepancy.fromLocationId)) || allowed.has(idOf(discrepancy.toLocationId));
  if (!related) throw appError('Phiếu chênh lệch không liên quan tới chi nhánh bạn quản lý.', 403);
};

/** Lọc theo quyền (chi nhánh chỉ thấy phiếu của mình), trạng thái và từ khóa. Dùng chung cho list và count. */
const buildListFilter = async (user, { status = '', search = '' } = {}) => {
  const filter = {};
  if (status === PENDING_FILTER) filter.status = { $in: UNRESOLVED_STATUSES };
  else if (status && discrepancyStatuses.includes(status)) filter.status = status;
  if (!isWarehouseManagerOrAdmin(user)) {
    if (!isBranchManager(user)) throw appError('Bạn không có quyền xem phiếu chênh lệch.', 403);
    const locationIds = await branchLocationIds(user);
    filter.$or = [{ fromLocationId: { $in: locationIds } }, { toLocationId: { $in: locationIds } }];
  }
  const searchFilter = await buildSearchFilter(search, {
    codeField: 'discrepancyCode',
    locationFields: ['fromLocationId', 'toLocationId'],
    userFields: ['createdBy'],
  });
  return andFilter(filter, searchFilter);
};

/**
 * Danh sách phiếu chênh lệch. Có `page`/`limit` → { items, total, page, limit }; không có → mảng như cũ.
 * Phiếu chênh lệch không có bảng chi tiết riêng nên không cần gom chi tiết.
 */
export const listDiscrepancies = async (user, query = {}) => {
  const filter = await buildListFilter(user, query);
  return listSlips({
    Model: StockDiscrepancy,
    filter,
    decorate: (find) => find.populate(population).lean(),
    paging: parsePaging(query),
  });
};

/** Đếm phiếu theo trạng thái cho badge ở sidebar, không tải danh sách. */
export const countDiscrepancies = async (user, query = {}) => {
  const filter = await buildListFilter(user, query);
  return { count: await StockDiscrepancy.countDocuments(filter) };
};

export const getDiscrepancy = async (id, user) => {
  if (!validId(id)) throw appError('Mã phiếu chênh lệch không hợp lệ.');
  const discrepancy = await StockDiscrepancy.findById(id).populate(population).lean();
  if (!discrepancy) throw appError('Không tìm thấy phiếu chênh lệch.', 404);
  await assertCanView(discrepancy, user);
  return discrepancy;
};

/* ------------------------------ Kết luận phiếu ------------------------------ */

const loadOpenDiscrepancyOrThrow = async (id, session) => {
  const discrepancy = await StockDiscrepancy.findOne({ _id: id, status: { $in: UNRESOLVED_STATUSES } }).session(session);
  if (discrepancy) return discrepancy;
  if (!await StockDiscrepancy.exists({ _id: id }).session(session)) throw appError('Không tìm thấy phiếu chênh lệch.', 404);
  throw appError('Phiếu chênh lệch đã được kết luận xong.', 409);
};

/** Hàng individual: món chọn phải thuộc phiếu và chưa được kết luận ở lần trước. */
const pickIndividualItems = (discrepancy, data) => {
  if (!data.itemIds.length) throw appError('Chọn các món hàng cần kết luận.');
  const resolvedIds = new Set(discrepancy.resolutions.flatMap((row) => row.itemIds.map(String)));
  const allowed = new Set(discrepancy.itemIds.map(String));
  if (data.itemIds.some((itemId) => !allowed.has(itemId) || resolvedIds.has(itemId))) {
    throw appError('Có món hàng không thuộc phiếu chênh lệch hoặc đã được kết luận.', 409);
  }
  if (data.quantity != null && data.quantity !== data.itemIds.length) throw appError('Số lượng phải bằng số món đã chọn.');
  return { itemIds: data.itemIds, quantity: data.itemIds.length };
};

const pickResolutionQuantity = (discrepancy, data) => {
  let picked;
  if (discrepancy.trackingType === 'individual') {
    picked = pickIndividualItems(discrepancy, data);
  } else {
    if (data.itemIds.length) throw appError('Mặt hàng quản lý theo số lượng không chọn mã cá thể.');
    if (data.quantity == null) throw appError('Nhập số lượng cần kết luận.');
    picked = { itemIds: [], quantity: data.quantity };
  }
  const remaining = discrepancy.quantityMissing - discrepancy.quantityResolved;
  if (picked.quantity > remaining) throw appError(`Số lượng kết luận vượt số còn đang điều tra (${remaining}).`, 409);
  return picked;
};

/** Cập nhật có điều kiện trên quantityResolved để hai lần kết luận đồng thời không cùng thành công. */
const claimResolution = async ({ discrepancy, data, picked, user, session }) => {
  const nextResolved = discrepancy.quantityResolved + picked.quantity;
  let nextStatus = DISCREPANCY_STATUS.PARTIALLY_RESOLVED;
  if (nextResolved >= discrepancy.quantityMissing) nextStatus = DISCREPANCY_STATUS.RESOLVED;
  const resolution = {
    outcome: data.outcome,
    quantity: picked.quantity,
    itemIds: picked.itemIds,
    targetLocationId: data.targetLocationId || null,
    targetStorageId: data.targetStorageId || null,
    responsibleParty: data.responsibleParty || null,
    note: data.note || '',
    resolvedBy: user._id,
    resolvedAt: new Date(),
  };
  const claimed = await StockDiscrepancy.findOneAndUpdate(
    { _id: discrepancy._id, status: { $in: UNRESOLVED_STATUSES }, quantityResolved: discrepancy.quantityResolved },
    { $set: { quantityResolved: nextResolved, status: nextStatus }, $push: { resolutions: resolution } },
    { new: true, session },
  );
  if (!claimed) throw appError('Phiếu chênh lệch vừa được người khác cập nhật. Hãy tải lại phiếu.', 409);
};

/** Mất: món in_transit → disposed (balance không đổi vì món đã rời sổ lúc xuất). Hàng số lượng không ghi gì. */
const writeOffLostItems = async (discrepancy, itemIds, session) => {
  if (discrepancy.trackingType !== 'individual') return;
  const items = await InventoryItem.find({ _id: { $in: itemIds }, status: 'in_transit' }).session(session);
  if (items.length !== itemIds.length) throw appError('Một số món hàng không còn ở trạng thái đang điều tra.', 409);
  await moveItems(items, { status: 'disposed', condition: 'missing' }, session);
};

/** Nơi nhập lại: kho tổng (bắt buộc chọn kệ) hoặc đúng nơi nhận ban đầu (không chọn kệ). */
const resolveTarget = async (discrepancy, data, session) => {
  const target = await InventoryLocation.findOne({ _id: data.targetLocationId, status: 'active' }).session(session).lean();
  if (!target) throw appError('Nơi nhập lại không tồn tại hoặc đã ngừng hoạt động.');
  if (target.type === 'warehouse') {
    const centralMessage = 'Hệ thống cần đúng một kho tổng đang hoạt động để nhập lại hàng.';
    const central = await getCentralWarehouse(session, { select: '_id', message: centralMessage });
    if (String(central._id) !== String(target._id)) throw appError(centralMessage, 409);
    if (!validId(data.targetStorageId)) throw appError('Nhập lại vào kho tổng phải chọn kệ.');
    return { location: target, central: true };
  }
  if (String(target._id) !== idOf(discrepancy.toLocationId)) {
    throw appError('Chỉ nhập lại vào nơi nhận ban đầu hoặc kho tổng.');
  }
  if (data.targetStorageId) throw appError('Nhập lại về chi nhánh không chọn kệ.');
  return { location: target, central: false };
};

const assertCentralShelfCapacity = async (location, storageId, quantity, session) => {
  const snapshot = await capacitySnapshot(location._id, session, null);
  const storage = snapshot.storageById.get(String(storageId));
  if (!storage || storage.type !== 'shelf' || storage.status !== 'active') {
    throw appError('Vị trí nhập lại phải là kệ đang hoạt động thuộc kho tổng.');
  }
  let cursor = storage;
  const visited = new Set();
  while (cursor && !visited.has(String(cursor._id))) {
    const key = String(cursor._id);
    visited.add(key);
    const used = snapshot.usedWithAncestors.get(key) || 0;
    if (cursor.maxCapacity != null && used + quantity > cursor.maxCapacity) {
      throw appError(`Không đủ sức chứa tại ${cursor.code}.`, 409);
    }
    cursor = cursor.parentStorageId ? snapshot.storageById.get(String(cursor.parentStorageId)) : null;
  }
  const maxCapacity = snapshot.location?.maxCapacity;
  if (maxCapacity != null && snapshot.used + snapshot.committed + quantity > maxCapacity) {
    throw appError('Kho tổng không đủ sức chứa cho hàng tìm thấy và các phiếu nhập đang mở.', 409);
  }
};

/** Món tìm thấy: in_transit → available (hoặc unavailable nếu trước đó hỏng) tại nơi nhập lại. */
const restoreFoundItems = async ({ discrepancy, itemIds, location, storageId, movementBase, session }) => {
  const previous = new Map(discrepancy.itemPreviousConditions.map((row) => [String(row.itemId), row.condition]));
  for (const itemId of itemIds) {
    const condition = previous.get(itemId) || 'good';
    const item = await InventoryItem.findOne({ _id: itemId, status: 'in_transit' }).session(session);
    if (!item) throw appError('Một số món hàng không còn ở trạng thái đang điều tra.', 409);
    const damaged = ['damaged', 'unrepairable'].includes(condition);
    await moveItem(item, {
      status: damaged ? 'unavailable' : 'available',
      condition,
      locationId: location._id,
      storageId,
    }, session);
    await recordStockMovement({ ...movementBase, itemId: item._id, quantityChange: 1 }, session);
  }
};

const restockFoundGoods = async ({ discrepancy, data, picked, user, session }) => {
  const { location, central } = await resolveTarget(discrepancy, data, session);
  const storageId = central ? data.targetStorageId : null;
  if (central) await assertCentralShelfCapacity(location, storageId, picked.quantity, session);
  else await assertBranchCapacity(location, [{ variantId: discrepancy.variantId, quantity: picked.quantity }], session);

  const movementBase = {
    variantId: discrepancy.variantId,
    locationId: location._id,
    storageId,
    movementType: 'transfer_in',
    referenceType: 'stock_discrepancy',
    referenceId: discrepancy._id,
    createdBy: user._id,
  };
  if (discrepancy.trackingType === 'individual') {
    await restoreFoundItems({ discrepancy, itemIds: picked.itemIds, location, storageId, movementBase, session });
    return;
  }
  const { quantity } = picked;
  await increaseInventoryBalance({ locationId: location._id, storageId, variantId: discrepancy.variantId, quantity, session });
  await recordStockMovement({ ...movementBase, quantityChange: quantity }, session);
};

/**
 * Kết luận một phần hoặc toàn bộ số thiếu. Phiếu được "giành" trước bằng cập nhật có điều kiện,
 * sau đó mới đổi trạng thái món / cộng tồn, tất cả trong một transaction.
 */
export const resolveDiscrepancy = async (id, payload, user) => {
  if (!isWarehouseManagerOrAdmin(user)) throw appError('Chỉ quản lý kho tổng mới được kết luận phiếu chênh lệch.', 403);
  if (!validId(id)) throw appError('Mã phiếu chênh lệch không hợp lệ.');
  const data = validateResolveDiscrepancy(payload);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const discrepancy = await loadOpenDiscrepancyOrThrow(id, session);
      const picked = pickResolutionQuantity(discrepancy, data);
      await claimResolution({ discrepancy, data, picked, user, session });
      if (data.outcome === 'lost') {
        await writeOffLostItems(discrepancy, picked.itemIds, session);
        return;
      }
      await restockFoundGoods({ discrepancy, data, picked, user, session });
    });
  } finally {
    await session.endSession();
  }
  return getDiscrepancy(id, user);
};
