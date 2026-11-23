// Trả hàng từ chi nhánh về kho tổng (phiếu StockTransfer có direction = 'branch_to_central').
// Luồng trạng thái: requested → approved → shipped → receipt_submitted → receipt_approved → completed
//                   (requested có thể bị rejected; requested / approved có thể bị cancelled; receipt_submitted bị trả lại → shipped).
// TASK-016 D2: chỉ hủy trước khi gửi (requested / approved), người hủy là quản lý chi nhánh tạo phiếu hoặc WM, bắt buộc lý do.
// Ai làm bước nào:
// - Quản lý chi nhánh: tạo phiếu, gửi hàng (trừ tồn chi nhánh), hủy trước khi gửi.
// - Quản lý kho tổng: duyệt số lượng (giữ tồn chi nhánh) + giao nhân viên, duyệt kết quả kiểm nhận.
// - Nhân viên kho tổng được giao: ghi nhận số nhận / hỏng, xếp hàng lên kệ (cộng tồn kho tổng).
// Hàng thiếu khi xếp lên kệ → mở phiếu chênh lệch thay vì loại bỏ ngay.
// TASK-015: mọi dòng theo món (giữ món FIFO khi duyệt, nhận / hỏng / xếp kệ theo danh sách món).
import mongoose from 'mongoose';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { Shop } from '../../models/shop/Shop.js';
import { StockTransfer } from '../../models/warehouse/transfer/StockTransfer.js';
import { StockTransferDetail } from '../../models/warehouse/transfer/StockTransferDetail.js';
import User from '../../models/system/User.js';
import { recordStockMovement } from './inventoryLedgerService.js';
import { openTransferDiscrepancies } from './stockDiscrepancyService.js';
import { moveItem, moveItems } from './itemStateService.js';
import { getAvailable, stockMismatchError } from './balanceQueryService.js';
import { appError } from './shared/errors.js';
import {
  WAREHOUSE_STAFF_ROLE_PATTERN, isAdmin, isBranchManager, isSameUser, isWarehouseManagerOrAdmin, isWarehouseStaff,
} from './shared/roles.js';
import { getCentralWarehouse } from './shared/locations.js';
import { addToStorageChain, capacitySnapshot } from './shared/capacity.js';
import { parsePaging } from './shared/pagination.js';
import { andFilter, buildSearchFilter, listSlips } from './shared/listing.js';
import { validateCancelReason } from '../../validations/warehouse/stockTransferValidation.js';

// Giữ export cũ cho nơi khác còn import capacitySnapshot từ file này.
export { capacitySnapshot };

export const RETURN_STATUS = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SHIPPED: 'shipped',
  RECEIPT_SUBMITTED: 'receipt_submitted',
  RECEIPT_APPROVED: 'receipt_approved',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};
const LISTABLE_STATUSES = Object.values(RETURN_STATUS);
const RETURN_DIRECTION = { direction: 'branch_to_central' };
const NOT_ASSIGNED_MESSAGE = 'Phiếu này chưa được giao cho bạn.';

const isBranchManagerOrAdmin = (user) => isBranchManager(user) || isAdmin(user);
const validId = (id) => mongoose.isValidObjectId(id);
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const makeCode = () => {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `TH-${day}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
};
const integer = (value, label, min = 0) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min) throw appError(`${label} phải là số nguyên từ ${min} trở lên.`);
  return number;
};
const appendNote = (current, label, note) => `${current || ''}\n${label}: ${String(note).trim()}`.trim();

const population = [
  { path: 'fromLocationId', select: 'code name type shopId', populate: { path: 'shopId', select: 'name managerId' } },
  { path: 'toLocationId', select: 'code name type' },
  { path: 'createdBy', select: 'FullName Email' },
  { path: 'assignedStaffId', select: 'FullName Email' },
  { path: 'approvedBy', select: 'FullName Email' },
  { path: 'receiptApprovedBy', select: 'FullName Email' },
  { path: 'shippedBy', select: 'FullName Email' },
  { path: 'receivedBy', select: 'FullName Email' },
];

/** Chi tiết đầy đủ của một hoặc nhiều phiếu (một truy vấn $in). */
const findDetails = (ids) => StockTransferDetail.find({ transferId: { $in: ids } }).sort({ createdAt: 1 })
  .populate({
    path: 'variantId',
    select: 'sku size color productId',
    populate: { path: 'productId', select: 'name productCode' },
  })
  .populate('itemIds', 'itemCode serialNumber status')
  .populate('receivedItemIds', 'itemCode serialNumber status')
  .populate('damagedItemIds', 'itemCode serialNumber status')
  .populate('putawayAllocations.storageId', 'code name type')
  .populate('discrepancyId', 'discrepancyCode status quantityMissing quantityResolved');

/* ------------------------------ Quyền và đọc phiếu ------------------------------ */

const branchLocationFor = async (branchId, user) => {
  const shops = await Shop.find({ managerId: user._id, status: 'ACTIVE', isDeleted: { $ne: true } }).select('_id').lean();
  if (!shops.some((shop) => String(shop._id) === String(branchId))) {
    throw appError('Chi nhánh không thuộc quyền quản lý của bạn.', 403);
  }
  const locations = await InventoryLocation.find({ shopId: branchId, type: 'store', status: 'active' })
    .select('_id shopId code name').lean();
  if (locations.length !== 1) throw appError('Chi nhánh phải có đúng một kho cửa hàng đang hoạt động.', 409);
  return locations[0];
};

const assertBranchAccess = async (transfer, user) => {
  if (isWarehouseManagerOrAdmin(user)) return;
  if (isWarehouseStaff(user) && isSameUser(transfer.assignedStaffId, user)) return;
  if (!isBranchManagerOrAdmin(user)) throw appError('Bạn không có quyền xem phiếu trả hàng.', 403);
  const branch = await InventoryLocation.findById(transfer.fromLocationId).populate('shopId', 'managerId status isDeleted')
    .lean();
  const shop = branch?.shopId;
  const owned = shop && shop.status === 'ACTIVE' && !shop.isDeleted && String(shop.managerId) === String(user._id);
  if (!owned) throw appError('Phiếu không thuộc chi nhánh bạn quản lý.', 403);
};

const assertAssignedStaff = (transfer, user) => {
  if (isWarehouseStaff(user) && !isSameUser(transfer.assignedStaffId, user)) throw appError(NOT_ASSIGNED_MESSAGE, 403);
};

const loadReturn = async (id, user) => {
  if (!validId(id)) throw appError('Mã phiếu trả hàng không hợp lệ.');
  const transfer = await StockTransfer.findOne({ _id: id, ...RETURN_DIRECTION }).populate(population);
  if (!transfer) throw appError('Không tìm thấy phiếu trả hàng.', 404);
  await assertBranchAccess(transfer, user);
  return { ...transfer.toObject(), items: await findDetails([id]) };
};

/** Phiếu đang ở đúng trạng thái trong transaction, nếu không → 409 với message của bước. */
const loadReturnInStatus = async (id, status, session, message) => {
  const transfer = await StockTransfer.findOne({ _id: id, ...RETURN_DIRECTION, status }).session(session);
  if (!transfer) throw appError(message, 409);
  return transfer;
};

/* ------------------------------ Danh sách ------------------------------ */

const scopeFilterFor = async (user) => {
  if (isWarehouseStaff(user)) return { assignedStaffId: user._id };
  if (isWarehouseManagerOrAdmin(user)) return {};
  if (!isBranchManagerOrAdmin(user)) throw appError('Bạn không có quyền xem phiếu trả hàng.', 403);
  const shops = await Shop.find({ managerId: user._id, status: 'ACTIVE', isDeleted: { $ne: true } }).distinct('_id');
  return { fromLocationId: { $in: await InventoryLocation.find({ shopId: { $in: shops }, type: 'store' })
    .distinct('_id') } };
};

/**
 * Danh sách phiếu trả hàng. Query: status, search, page, limit.
 * Có page/limit → { items, total, page, limit } (kèm lineCount, totalQuantity); không có → mảng như cũ.
 */
export const listBranchReturns = async (user, query = {}) => {
  const filter = { ...RETURN_DIRECTION };
  if (query.status && LISTABLE_STATUSES.includes(query.status)) filter.status = query.status;
  Object.assign(filter, await scopeFilterFor(user));
  const searchFilter = await buildSearchFilter(query.search, {
    codeField: 'transferCode',
    locationFields: ['fromLocationId', 'toLocationId'],
    userFields: ['createdBy', 'assignedStaffId'],
  });
  return listSlips({
    Model: StockTransfer,
    filter: andFilter(filter, searchFilter),
    decorate: (find) => find.populate(population),
    paging: parsePaging(query),
    attachDetails: { findDetails, parentField: 'transferId' },
    summary: { DetailModel: StockTransferDetail, parentField: 'transferId', quantityField: 'quantityRequested' },
  });
};

export const getBranchReturn = loadReturn;
export const listBranchReturnStaff = () => User.find({ Role: WAREHOUSE_STAFF_ROLE_PATTERN, Status: /^active$/i })
  .select('FullName Email').sort({ FullName: 1 }).lean();

/* ------------------------------ Tạo phiếu ------------------------------ */

const parseReturnLines = (payload) => {
  if (!payload || !validId(payload.branchId) || !Array.isArray(payload.items) || !payload.items.length) {
    throw appError('Chọn chi nhánh và ít nhất một mặt hàng cần trả.');
  }
  const seen = new Set();
  return payload.items.map((line) => {
    if (!validId(line?.variantId)) throw appError('Biến thể trong phiếu trả không hợp lệ.');
    if (seen.has(String(line.variantId))) throw appError('Mỗi biến thể chỉ được xuất hiện một lần trong phiếu.');
    seen.add(String(line.variantId));
    return {
      variantId: line.variantId,
      quantityRequested: integer(line.quantityRequested, 'Số lượng trả', 1),
      note: String(line.note || '').trim().slice(0, 500),
    };
  });
};

const assertVariantsActive = (variants, expectedCount) => {
  const inactive = (variant) => !variant.productId || variant.productId.status !== 'active' || variant.productId.isDeleted;
  if (variants.length !== expectedCount || variants.some(inactive)) {
    throw appError('Có biến thể không tồn tại hoặc đã ngừng kinh doanh.');
  }
};

/** Quản lý chi nhánh tạo phiếu trả. Chưa giữ tồn (giữ ở bước kho tổng duyệt). */
export const createBranchReturn = async (payload, user) => {
  if (!isBranchManagerOrAdmin(user)) throw appError('Chỉ quản lý chi nhánh mới được tạo phiếu trả hàng.', 403);
  const items = parseReturnLines(payload);
  const [branch, central, variants] = await Promise.all([
    branchLocationFor(payload.branchId, user),
    getCentralWarehouse(null, { select: '_id code name maxCapacity', message: 'Hệ thống cần có đúng một kho tổng đang hoạt động.' }),
    ProductVariant.find({ _id: { $in: items.map((item) => item.variantId) }, status: 'active' })
      .populate('productId', 'status isDeleted').lean(),
  ]);
  assertVariantsActive(variants, items.length);
  const session = await mongoose.startSession();
  let transferId;
  try {
    await session.withTransaction(async () => {
      const [transfer] = await StockTransfer.create([{
        transferCode: makeCode(),
        ...RETURN_DIRECTION,
        fromLocationId: branch._id,
        toLocationId: central._id,
        createdBy: user._id,
        status: RETURN_STATUS.REQUESTED,
        note: String(payload.note || '').trim().slice(0, 1000),
      }], { session });
      transferId = transfer._id;
      await StockTransferDetail.insertMany(items.map((item) => ({ transferId, ...item })), { session });
    });
  } finally {
    await session.endSession();
  }
  return loadReturn(transferId, user);
};

/* ------------------------------ Duyệt phiếu ------------------------------ */

const rejectReturn = async (transfer, payload, user, session) => {
  transfer.status = RETURN_STATUS.REJECTED;
  transfer.approvedBy = user._id;
  transfer.approvedAt = new Date();
  if (payload.note) transfer.note = appendNote(transfer.note, 'Từ chối', payload.note);
  await transfer.save({ session });
};

const loadReturnStaffOrThrow = async (staffId, session) => {
  if (!validId(staffId)) throw appError('Chọn nhân viên kho tổng phụ trách nhận hàng.');
  const staff = await User.findOne({ _id: staffId, Role: WAREHOUSE_STAFF_ROLE_PATTERN, Status: /^active$/i })
    .session(session);
  if (!staff) throw appError('Nhân viên kho không tồn tại hoặc đã ngừng hoạt động.');
  return staff;
};

/** Mỗi dòng phiếu phải có đúng một dòng duyệt. Trả về Map(detailId → số duyệt thô). */
const readApprovalLines = (payload, details) => {
  const lines = Array.isArray(payload.items) ? payload.items : [];
  if (lines.some((line) => !isRecord(line) || !validId(line.detailId))) throw appError('Dòng duyệt không hợp lệ.');
  const approved = new Map(lines.map((line) => [String(line.detailId), line.quantityApproved]));
  const complete = approved.size === details.length && lines.length === details.length
    && details.every((row) => approved.has(String(row._id)));
  if (!complete) throw appError('Cần duyệt số lượng cho toàn bộ mặt hàng, mỗi dòng một lần.');
  return approved;
};

/** Kiểm khả dụng trên balance trước, rồi giữ các món cũ nhất (FIFO). Chọn thiếu = dữ liệu lệch. */
const reserveReturnItems = async ({ transfer, detail, quantity, session }) => {
  const place = { locationId: transfer.fromLocationId, variantId: detail.variantId };
  const available = await getAvailable(place, session);
  if (available < quantity) throw appError(`Chi nhánh chỉ còn ${available} cái khả dụng để trả.`, 409);
  const locked = await InventoryItem.find({ ...place, status: 'available' })
    .sort({ createdAt: 1 }).limit(quantity).session(session);
  if (locked.length < quantity) {
    throw stockMismatchError({ ...place, expected: available, found: locked.length, context: 'decideBranchReturn' });
  }
  detail.itemIds = locked.map((item) => item._id);
  await moveItems(locked, { status: 'reserved', warehouseHold: 1 }, session);
};

/** Quản lý kho tổng duyệt số lượng trả (giữ tồn chi nhánh) và giao nhân viên nhận, hoặc từ chối. */
export const decideBranchReturn = async (id, payload, user) => {
  if (!validId(id)) throw appError('Mã phiếu trả hàng không hợp lệ.');
  if (!isWarehouseManagerOrAdmin(user)) throw appError('Chỉ quản lý kho tổng mới được duyệt phiếu trả.', 403);
  if (!['approve', 'reject'].includes(payload?.decision)) throw appError('Quyết định duyệt không hợp lệ.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await loadReturnInStatus(id, RETURN_STATUS.REQUESTED, session, 'Phiếu không còn ở trạng thái chờ duyệt.');
      if (payload.decision === 'reject') {
        await rejectReturn(transfer, payload, user, session);
        return;
      }
      const staff = await loadReturnStaffOrThrow(payload.assignedStaffId, session);
      const details = await StockTransferDetail.find({ transferId: id }).session(session);
      const approved = readApprovalLines(payload, details);
      for (const detail of details) {
        const quantity = integer(approved.get(String(detail._id)), 'Số lượng duyệt');
        if (quantity > detail.quantityRequested) {
          throw appError('Số lượng duyệt không được lớn hơn số lượng chi nhánh yêu cầu.');
        }
        detail.quantityApproved = quantity;
        if (quantity > 0) await reserveReturnItems({ transfer, detail, quantity, session });
        await detail.save({ session });
      }
      if (!details.some((row) => row.quantityApproved > 0)) {
        throw appError('Cần duyệt số lượng lớn hơn 0 cho ít nhất một mặt hàng.');
      }
      transfer.status = RETURN_STATUS.APPROVED;
      transfer.assignedStaffId = staff._id;
      transfer.approvedBy = user._id;
      transfer.approvedAt = new Date();
      if (payload.note) transfer.note = appendNote(transfer.note, 'Duyệt', payload.note);
      await transfer.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return loadReturn(id, user);
};

/* ------------------------------ Gửi hàng / hủy ------------------------------ */

const findReservedItems = (transfer, detail, session) => InventoryItem.find({
  _id: { $in: detail.itemIds },
  locationId: transfer.fromLocationId,
  variantId: detail.variantId,
  status: 'reserved',
}).session(session);

const transferOutMovement = (transfer, detail, user, extra) => ({
  variantId: detail.variantId,
  locationId: transfer.fromLocationId,
  movementType: 'transfer_out',
  referenceType: 'stock_transfer',
  referenceId: transfer._id,
  createdBy: user._id,
  ...extra,
});

/** Món đang giữ → in_transit và nhả giữ (chi nhánh onHand -1, reserved -1 mỗi món). */
const dispatchReturnItems = async ({ transfer, detail, quantity, user, session }) => {
  const locked = await findReservedItems(transfer, detail, session);
  if (locked.length !== quantity) throw appError('Một số món đã thay đổi trạng thái, không thể gửi phiếu.', 409);
  await moveItems(locked, { status: 'in_transit', warehouseHold: -1 }, session);
  for (const item of locked) {
    await recordStockMovement(transferOutMovement(transfer, detail, user, { itemId: item._id, quantityChange: -1 }), session);
  }
};

/** Chi nhánh xác nhận đã gửi hàng về kho tổng: phần đã giữ rời khỏi tồn chi nhánh. */
export const dispatchBranchReturn = async (id, user) => {
  if (!validId(id)) throw appError('Mã phiếu trả hàng không hợp lệ.');
  if (!isBranchManagerOrAdmin(user)) throw appError('Chỉ quản lý chi nhánh mới xác nhận gửi hàng về kho tổng.', 403);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await loadReturnInStatus(id, RETURN_STATUS.APPROVED, session, 'Phiếu chưa được duyệt hoặc đã gửi hàng.');
      await assertBranchAccess(transfer, user);
      const details = await StockTransferDetail.find({ transferId: id }).session(session);
      for (const detail of details) {
        const quantity = detail.quantityApproved || 0;
        if (!quantity) continue;
        await dispatchReturnItems({ transfer, detail, quantity, user, session });
        detail.quantityShipped = quantity;
        await detail.save({ session });
      }
      transfer.status = RETURN_STATUS.SHIPPED;
      transfer.shippedBy = user._id;
      transfer.shippedAt = new Date();
      await transfer.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return loadReturn(id, user);
};

/** Phiếu trả chỉ hủy được trước khi chi nhánh gửi hàng (TASK-016 D2). */
export const CANCELLABLE_RETURN_STATUSES = Object.freeze([RETURN_STATUS.REQUESTED, RETURN_STATUS.APPROVED]);

/** WM / admin hủy mọi phiếu; quản lý chi nhánh chỉ hủy phiếu mình tạo của chi nhánh mình. */
const assertCanCancelReturn = async (transfer, user) => {
  if (isWarehouseManagerOrAdmin(user)) return;
  if (!isBranchManager(user)) throw appError('Chỉ quản lý chi nhánh tạo phiếu hoặc quản lý kho mới được hủy phiếu trả hàng.', 403);
  if (!isSameUser(transfer.createdBy, user)) throw appError('Chỉ quản lý chi nhánh đã tạo phiếu mới được hủy phiếu này.', 403);
  await assertBranchAccess(transfer, user);
};

/**
 * Hủy phiếu trả trước khi gửi hàng: requested / approved → cancelled (cập nhật có điều kiện; sai trạng thái → 409).
 * Phiếu đã duyệt đang giữ món ở chi nhánh → nhả về `available`.
 */
export const cancelBranchReturn = async (id, payload, user) => {
  if (!validId(id)) throw appError('Mã phiếu trả hàng không hợp lệ.');
  const { reason } = validateCancelReason(payload);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await StockTransfer.findOne({ _id: id, ...RETURN_DIRECTION }).session(session);
      if (!current) throw appError('Không tìm thấy phiếu trả hàng.', 404);
      await assertCanCancelReturn(current, user);
      const previous = await StockTransfer.findOneAndUpdate(
        { _id: id, ...RETURN_DIRECTION, status: { $in: CANCELLABLE_RETURN_STATUSES } },
        { $set: { status: RETURN_STATUS.CANCELLED, cancelledBy: user._id, cancelledAt: new Date(), cancelReason: reason } },
        { returnDocument: 'before', session },
      );
      if (!previous) throw appError('Chỉ hủy được phiếu trả đang chờ duyệt hoặc đã duyệt nhưng chưa gửi hàng.', 409);
      if (previous.status !== RETURN_STATUS.APPROVED) return;
      const details = await StockTransferDetail.find({ transferId: id }).session(session);
      for (const detail of details) {
        if (!detail.quantityApproved) continue;
        const locked = await findReservedItems(previous, detail, session);
        await moveItems(locked, { status: 'available', warehouseHold: -1 }, session);
      }
    });
  } finally {
    await session.endSession();
  }
  return loadReturn(id, user);
};

/* ------------------------------ Kiểm nhận tại kho tổng ------------------------------ */

/** Map(detailId → dòng gửi lên); mỗi dòng phiếu phải có đúng một dòng. */
const readLinesByDetail = (payload, details, invalidMessage, incompleteMessage) => {
  const lines = Array.isArray(payload?.items) ? payload.items : [];
  if (lines.some((line) => !isRecord(line) || !validId(line.detailId))) throw appError(invalidMessage);
  const byId = new Map(lines.map((line) => [String(line.detailId), line]));
  if (byId.size !== details.length || details.some((detail) => !byId.has(String(detail._id)))) {
    throw appError(incompleteMessage);
  }
  return byId;
};

/** Danh sách món nhận / hỏng không trùng, thuộc phiếu gửi và khớp số lượng. */
const readReceivedItemIds = (line, detail, quantityReceived, quantityDamaged) => {
  const receivedRaw = line.receivedItemIds ?? [];
  const damagedRaw = line.damagedItemIds ?? [];
  if (!Array.isArray(receivedRaw) || !Array.isArray(damagedRaw)) throw appError('Danh sách món nhận/hỏng không hợp lệ.');
  const receivedIds = [...new Set(receivedRaw.map(String))];
  const damagedIds = [...new Set(damagedRaw.map(String))];
  if (receivedIds.length !== receivedRaw.length || damagedIds.length !== damagedRaw.length) {
    throw appError('Danh sách món hàng không được trùng.');
  }
  const shippedIds = new Set((detail.itemIds || []).map(String));
  if (receivedIds.length !== quantityReceived || receivedIds.some((itemId) => !shippedIds.has(itemId))) {
    throw appError('Danh sách món nhận không khớp số lượng đã gửi.');
  }
  if (damagedIds.length !== quantityDamaged || damagedIds.some((itemId) => !receivedIds.includes(itemId))) {
    throw appError('Danh sách món hỏng không khớp số lượng nhận.');
  }
  return { receivedIds, damagedIds };
};

const recordReceiptLine = async ({ detail, line, session }) => {
  const quantityReceived = integer(line.quantityReceived, 'Số lượng nhận');
  const quantityDamaged = integer(line.quantityDamaged || 0, 'Số lượng hỏng');
  if (quantityReceived > detail.quantityShipped || quantityDamaged > quantityReceived) {
    throw appError('Số lượng nhận hoặc hỏng vượt số lượng đã gửi.');
  }
  const { receivedIds, damagedIds } = readReceivedItemIds(line, detail, quantityReceived, quantityDamaged);
  detail.receivedItemIds = receivedIds;
  detail.damagedItemIds = damagedIds;
  detail.quantityReceived = quantityReceived;
  detail.quantityDamaged = quantityDamaged;
  detail.quantityMissing = detail.quantityShipped - quantityReceived;
  await detail.save({ session });
};

/** Nhân viên kho tổng ghi số nhận / hỏng thực tế. Chưa cộng tồn, chờ quản lý duyệt kết quả. */
export const submitBranchReturnReceipt = async (id, payload, user) => {
  if (!validId(id)) throw appError('Mã phiếu trả hàng không hợp lệ.');
  if (!(isWarehouseStaff(user) || isWarehouseManagerOrAdmin(user))) {
    throw appError('Chỉ nhân viên kho tổng mới ghi nhận hàng trả. ', 403);
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await loadReturnInStatus(id, RETURN_STATUS.SHIPPED, session, 'Phiếu chưa được gửi từ chi nhánh hoặc đã ghi nhận.');
      assertAssignedStaff(transfer, user);
      const details = await StockTransferDetail.find({ transferId: id }).session(session);
      const byId = readLinesByDetail(payload, details, 'Dòng nhận hàng không hợp lệ.', 'Cần ghi nhận đầy đủ các dòng hàng trong phiếu.');
      for (const detail of details) {
        const line = byId.get(String(detail._id));
        await recordReceiptLine({ detail, line, session });
      }
      transfer.status = RETURN_STATUS.RECEIPT_SUBMITTED;
      transfer.receivedBy = user._id;
      transfer.receivedAt = new Date();
      transfer.receiptApprovedBy = null;
      transfer.receiptApprovedAt = null;
      if (payload.note) transfer.note = appendNote(transfer.note, 'Ghi nhận nhận hàng', payload.note);
      await transfer.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return loadReturn(id, user);
};

/** Trả kết quả kiểm nhận về cho nhân viên làm lại: xóa số đã ghi. */
const resetReceiptResult = async (transfer, id) => {
  transfer.status = RETURN_STATUS.SHIPPED;
  transfer.receivedBy = null;
  transfer.receivedAt = null;
  const details = await StockTransferDetail.find({ transferId: id });
  for (const detail of details) {
    detail.quantityReceived = 0;
    detail.quantityDamaged = 0;
    detail.quantityMissing = 0;
    detail.receivedItemIds = [];
    detail.damagedItemIds = [];
    await detail.save();
  }
};

/** Quản lý kho tổng duyệt kết quả kiểm nhận (cho phép xếp lên kệ) hoặc yêu cầu kiểm nhận lại. */
export const decideBranchReturnReceipt = async (id, payload, user) => {
  if (!validId(id)) throw appError('Mã phiếu trả hàng không hợp lệ.');
  if (!isWarehouseManagerOrAdmin(user)) throw appError('Chỉ quản lý kho tổng mới duyệt kết quả nhận hàng.', 403);
  if (!['approve', 'reject'].includes(payload?.decision)) throw appError('Quyết định duyệt không hợp lệ.');
  const transfer = await StockTransfer.findOne({ _id: id, ...RETURN_DIRECTION, status: RETURN_STATUS.RECEIPT_SUBMITTED });
  if (!transfer) throw appError('Phiếu chưa có kết quả nhận hàng chờ duyệt.', 409);
  const approve = payload.decision === 'approve';
  if (approve) transfer.status = RETURN_STATUS.RECEIPT_APPROVED;
  else await resetReceiptResult(transfer, id);
  transfer.receiptApprovedBy = user._id;
  transfer.receiptApprovedAt = new Date();
  if (payload.note) transfer.note = appendNote(transfer.note, approve ? 'Duyệt nhận hàng' : 'Yêu cầu kiểm nhận lại', payload.note);
  await transfer.save();
  return loadReturn(id, user);
};

/* ------------------------------ Xếp hàng lên kệ ------------------------------ */

/** Kiểm một vị trí xếp: phải là kệ đang hoạt động của kho tổng và chọn đúng món đạt. */
const checkPutawayAllocation = ({ allocation, detail, snapshot }) => {
  if (!validId(allocation.storageId)) throw appError('Chọn kệ hợp lệ trong kho tổng.');
  const rawItemIds = allocation.itemIds ?? [];
  if (!Array.isArray(rawItemIds)) throw appError('Danh sách món hàng theo kệ không hợp lệ.');
  const storage = snapshot.storageById.get(String(allocation.storageId));
  if (!storage || storage.type !== 'shelf' || storage.status !== 'active') {
    throw appError('Vị trí xếp phải là kệ đang hoạt động thuộc kho tổng.');
  }
  const ids = [...new Set(rawItemIds.map(String))];
  if (ids.length !== rawItemIds.length) throw appError('Món hàng không được phân bổ trùng kệ.');
  const received = detail.receivedItemIds.map(String);
  const damaged = detail.damagedItemIds.map(String);
  const wrongItem = ids.some((itemId) => !received.includes(itemId) || damaged.includes(itemId));
  if (ids.length !== allocation.quantity || wrongItem) throw appError('Chọn đúng số món đạt chất lượng cho từng kệ.');
  return { storage, itemIds: ids };
};

/** Kiểm phân bổ một dòng và cộng dồn số sắp thêm vào từng kệ / cấp cha (`storageAdds`). */
const planPutawayLine = ({ detail, line, snapshot, storageAdds }) => {
  if (!Array.isArray(line.allocations)) throw appError('Danh sách vị trí xếp hàng không hợp lệ.');
  if (line.allocations.some((allocation) => !isRecord(allocation))) throw appError('Phân bổ kệ không hợp lệ.');
  const accepted = detail.quantityReceived - detail.quantityDamaged;
  const allocated = line.allocations.reduce((sum, row) => sum + integer(row.quantity, 'Số lượng xếp', 1), 0);
  if (allocated !== accepted) {
    throw appError(`Số lượng phân bổ cho ${detail.variantId} phải bằng số lượng hàng đạt (${accepted}).`);
  }
  const assignedItems = [];
  for (const allocation of line.allocations) {
    const { storage, itemIds } = checkPutawayAllocation({ allocation, detail, snapshot });
    assignedItems.push(...itemIds);
    addToStorageChain(storageAdds, snapshot.storageById, String(storage._id), allocation.quantity);
  }
  if (new Set(assignedItems).size !== assignedItems.length || assignedItems.length !== accepted) {
    throw appError('Mỗi món đạt chất lượng cần được gán đúng một kệ.');
  }
  detail.putawayAllocations = line.allocations.map((row) => ({
    storageId: row.storageId,
    quantity: Number(row.quantity),
    itemIds: row.itemIds || [],
  }));
};

const assertPutawayCapacity = (snapshot, storageAdds, totalAdded) => {
  for (const [storageId, added] of storageAdds) {
    const storage = snapshot.storageById.get(storageId);
    const used = snapshot.usedWithAncestors.get(storageId) || 0;
    if (storage?.maxCapacity != null && used + added > storage.maxCapacity) {
      throw appError(`Không đủ sức chứa tại ${storage.code}.`, 409);
    }
  }
  const maxCapacity = snapshot.location.maxCapacity;
  if (maxCapacity != null && snapshot.used + snapshot.committed + totalAdded > maxCapacity) {
    throw appError('Kho tổng không đủ sức chứa cho hàng trả về và các phiếu nhập đang mở.', 409);
  }
};

const transferInMovement = (transfer, detail, user, extra) => ({
  variantId: detail.variantId,
  locationId: transfer.toLocationId,
  movementType: 'transfer_in',
  referenceType: 'stock_transfer',
  referenceId: transfer._id,
  createdBy: user._id,
  ...extra,
});

/** Món nhận: in_transit → available trên kệ đã chọn, món hỏng → unavailable (không kệ) ở kho tổng. */
const putawayReturnItems = async ({ transfer, detail, line, user, session }) => {
  const shelfByItem = new Map(line.allocations.flatMap((row) => (row.itemIds || []).map((itemId) => [String(itemId), row.storageId])));
  const received = new Set(detail.receivedItemIds.map(String));
  const damaged = new Set(detail.damagedItemIds.map(String));
  for (const itemId of received) {
    const item = await InventoryItem.findOne({ _id: itemId, status: 'in_transit', locationId: transfer.fromLocationId })
      .session(session);
    if (!item) throw appError('Một món hàng không còn ở trạng thái đang điều chuyển.', 409);
    let change = { locationId: transfer.toLocationId, storageId: shelfByItem.get(itemId), status: 'available' };
    if (damaged.has(itemId)) change = { locationId: transfer.toLocationId, storageId: null, status: 'unavailable' };
    await moveItem(item, change, session);
    await recordStockMovement(transferInMovement(transfer, detail, user, {
      itemId: item._id, storageId: item.storageId, quantityChange: 1,
    }), session);
  }
};

/**
 * Xếp hàng trả về lên kệ kho tổng (sau khi kết quả kiểm nhận được duyệt): kiểm sức chứa toàn bộ trước,
 * rồi mới đổi trạng thái món (balance theo món). Dòng thiếu mở phiếu chênh lệch thay vì chuyển món thiếu sang disposed.
 */
export const putawayBranchReturn = async (id, payload, user) => {
  if (!validId(id)) throw appError('Mã phiếu trả hàng không hợp lệ.');
  if (!(isWarehouseStaff(user) || isWarehouseManagerOrAdmin(user))) {
    throw appError('Bạn không có quyền xếp hàng trả vào kho.', 403);
  }
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await loadReturnInStatus(id, RETURN_STATUS.RECEIPT_APPROVED, session, 'Kết quả nhận hàng chưa được quản lý kho duyệt.');
      assertAssignedStaff(transfer, user);
      const details = await StockTransferDetail.find({ transferId: id }).session(session);
      const byId = readLinesByDetail(payload, details, 'Dòng phân bổ vị trí không hợp lệ.', 'Cần phân bổ vị trí cho toàn bộ mặt hàng.');
      const snapshot = await capacitySnapshot(transfer.toLocationId, session, transfer._id);
      if (!snapshot.location) throw appError('Không tìm thấy kho tổng.', 404);
      const storageAdds = new Map();
      let totalAdded = 0;
      for (const detail of details) {
        const line = byId.get(String(detail._id));
        planPutawayLine({ detail, line, snapshot, storageAdds });
        totalAdded += detail.quantityReceived;
      }
      assertPutawayCapacity(snapshot, storageAdds, totalAdded);
      for (const detail of details) {
        await putawayReturnItems({ transfer, detail, line: byId.get(String(detail._id)), user, session });
        await detail.save({ session });
      }
      await openTransferDiscrepancies({ transfer, details, user, session });
      transfer.status = RETURN_STATUS.COMPLETED;
      transfer.putawayBy = user._id;
      transfer.putawayAt = new Date();
      await transfer.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return loadReturn(id, user);
};
