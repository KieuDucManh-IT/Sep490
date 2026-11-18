// Phiếu nhập kho từ nhà cung cấp vào kho tổng.
// Luồng trạng thái: awaiting_receiving → received → approved → completed
//                   (received có thể bị rejected; các trạng thái chưa completed có thể bị cancelled).
// Ai làm bước nào:
// - Quản lý kho: tạo phiếu và giao nhân viên, duyệt / từ chối kết quả ghi nhận, hủy phiếu.
// - Nhân viên kho được giao: ghi nhận số thực nhận / hỏng, xếp hàng lên kệ.
// Tồn chỉ được cộng ở bước xếp hàng lên kệ (completed); trước đó phiếu chỉ "giữ chỗ" sức chứa kho.
import mongoose from 'mongoose';
import { InboundReceipt } from '../../models/warehouse/inbound/InboundReceipt.js';
import { InboundReceiptDetail } from '../../models/warehouse/inbound/InboundReceiptDetail.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { Supplier } from '../../models/masterdata/Supplier.js';
import User from '../../models/system/User.js';
import {
  validateCancelReason, validateCreateInboundReceipt, validatePutaway, validateReceiptCheck,
} from '../../validations/warehouse/inboundReceiptValidation.js';
import { increaseInventoryBalance, recordStockMovement } from './inventoryLedgerService.js';
import { assertCentralWarehouse } from './centralWarehouseService.js';
import { createItems } from './itemStateService.js';
import { refreshOutOfStockStatus, markRestockRequested } from './productStockStatusService.js';
import { appError } from './shared/errors.js';
import { WAREHOUSE_STAFF_ROLE_PATTERN, isSameUser, isWarehouseManagerOrAdmin, isWarehouseStaff } from './shared/roles.js';
import { addToStorageChain } from './shared/capacity.js';
import { parsePaging } from './shared/pagination.js';
import { andFilter, buildSearchFilter, listSlips } from './shared/listing.js';

export const RECEIPT_STATUS = {
  AWAITING_RECEIVING: 'awaiting_receiving',
  RECEIVED: 'received',
  APPROVED: 'approved',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};
/** Phiếu còn mở: đang chiếm chỗ sức chứa kho và còn hủy được. */
const OPEN_STATUSES = [RECEIPT_STATUS.AWAITING_RECEIVING, RECEIPT_STATUS.RECEIVED, RECEIPT_STATUS.APPROVED];
const RECEIPT_STATUSES = Object.values(RECEIPT_STATUS);
const SUPPLIER_RECEIPT = { receiptType: 'supplier' };
const NOT_ASSIGNED_MESSAGE = 'Phiếu này chưa được giao cho bạn.';

const capacityOf = (value) => (Number.isInteger(value) && value > 0 ? value : 0);
const sum = (rows, field) => rows.reduce((total, row) => total + (row[field] || 0), 0);
const makeCode = () => {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `PN-${day}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
};

const receiptPopulation = [
  { path: 'locationId', select: 'code name maxCapacity' },
  { path: 'supplierId', select: 'supplierCode name' },
  { path: 'createdBy', select: 'FullName Email' },
  { path: 'assignedStaffId', select: 'FullName Email' },
  { path: 'receivedBy', select: 'FullName Email' },
  { path: 'approvedBy', select: 'FullName Email' },
  { path: 'putawayBy', select: 'FullName Email' },
  { path: 'cancelledBy', select: 'FullName Email' },
];

/** Chi tiết đầy đủ của một hoặc nhiều phiếu (một truy vấn $in). */
const findDetails = (receiptIds) => InboundReceiptDetail.find({ receiptId: { $in: receiptIds } }).sort({ createdAt: 1 })
  .populate({
    path: 'variantId',
    select: 'sku size color productId',
    populate: { path: 'productId', select: 'name productCode trackingType' },
  })
  .populate('storageAllocations.storageId', 'code name type')
  .populate('storageId', 'code name type');

/**
 * Cập nhật cờ hết hàng của các sản phẩm trong phiếu sau khi phiếu đổi trạng thái.
 * Chạy ngoài transaction và không chặn nghiệp vụ: lỗi chỉ ghi log.
 */
const refreshStockStatusOfReceipt = async (receiptId, stepLabel) => {
  try {
    const detailsForStock = await InboundReceiptDetail.find({ receiptId })
      .populate({ path: 'variantId', select: 'productId' }).lean();
    const productIds = [...new Set(detailsForStock.map((d) => String(d.variantId?.productId)).filter(Boolean))];
    if (productIds.length) await refreshOutOfStockStatus(productIds);
  } catch (err) {
    console.error(`[TASK-012] Lỗi refreshOutOfStockStatus sau ${stepLabel}:`, err.message);
  }
};

/* ------------------------------ Sức chứa ------------------------------ */

/** Đã dùng của toàn kho và từng kệ (cộng dồn lên cấp cha), chỉ đọc InventoryBalance.quantityOnHand. */
const getPhysicalCapacity = async (locationId, session = null) => {
  const location = await InventoryLocation.findById(locationId).session(session).lean();
  if (!location) throw appError('Không tìm thấy kho/cửa hàng.', 404);
  const storageLocations = await StorageLocation.find({ locationId })
    .select('_id parentStorageId maxCapacity type status').session(session).lean();
  const storageById = new Map(storageLocations.map((storage) => [String(storage._id), storage]));
  const balanceRows = await InventoryBalance.aggregate([
    { $match: { locationId: new mongoose.Types.ObjectId(String(locationId)) } },
    { $group: { _id: '$storageId', quantity: { $sum: '$quantityOnHand' } } },
  ]).session(session);
  const usedByStorage = new Map();
  let used = 0;
  for (const row of balanceRows) {
    const quantity = Math.max(0, row.quantity || 0);
    used += quantity;
    if (row._id) addToStorageChain(usedByStorage, storageById, String(row._id), quantity);
  }
  return { location, storageLocations, storageById, usedByStorage, used };
};

/** Phiếu nhập khác đang mở cũng chiếm chỗ: chờ nhận tính số dự kiến, đã nhận tính số đạt chất lượng. */
const getOpenCommitment = async (locationId, excludeReceiptId = null, session = null) => {
  const query = { locationId, status: { $in: OPEN_STATUSES } };
  if (excludeReceiptId) query._id = { $ne: excludeReceiptId };
  const receipts = await InboundReceipt.find(query).select('_id status').session(session).lean();
  if (!receipts.length) return 0;
  const acceptedExpr = { $subtract: ['$quantityReceived', '$quantityDamaged'] };
  const details = await InboundReceiptDetail.aggregate([
    { $match: { receiptId: { $in: receipts.map((receipt) => receipt._id) } } },
    {
      $group: {
        _id: '$receiptId',
        expected: { $sum: '$quantityExpected' },
        accepted: { $sum: { $cond: [{ $gt: [acceptedExpr, 0] }, acceptedExpr, 0] } },
      },
    },
  ]).session(session);
  const receiptById = new Map(receipts.map((receipt) => [String(receipt._id), receipt]));
  return details.reduce((total, detail) => {
    const receipt = receiptById.get(String(detail._id));
    if (receipt.status === RECEIPT_STATUS.AWAITING_RECEIVING) return total + detail.expected;
    return total + detail.accepted;
  }, 0);
};

/* ------------------------------ Đọc phiếu ------------------------------ */

export const listWarehouseStaff = async () => User.find({ Role: WAREHOUSE_STAFF_ROLE_PATTERN, Status: /^active$/i })
  .select('FullName Email').sort({ FullName: 1 }).lean();

/**
 * Danh sách phiếu nhập. Query: status, staffId (controller tự gắn cho nhân viên), search, page, limit.
 * Có page/limit → { items, total, page, limit } (kèm lineCount, totalQuantity = tổng số dự kiến);
 * không có → mảng phiếu kèm `items` đầy đủ như API cũ.
 */
export const listInboundReceipts = async (query = {}) => {
  const filter = { ...SUPPLIER_RECEIPT };
  if (query.status && RECEIPT_STATUSES.includes(query.status)) filter.status = query.status;
  if (query.staffId) filter.assignedStaffId = query.staffId;
  const searchFilter = await buildSearchFilter(query.search, {
    codeField: 'receiptCode',
    locationFields: ['locationId'],
    userFields: ['createdBy', 'assignedStaffId'],
  });
  return listSlips({
    Model: InboundReceipt,
    filter: andFilter(filter, searchFilter),
    decorate: (find) => find.populate(receiptPopulation),
    paging: parsePaging(query),
    attachDetails: { findDetails, parentField: 'receiptId' },
    summary: { DetailModel: InboundReceiptDetail, parentField: 'receiptId', quantityField: 'quantityExpected' },
  });
};

/** Chi tiết phiếu. Nhân viên kho chỉ xem được phiếu giao cho mình. */
export const getInboundReceipt = async (receiptId, requester = null) => {
  const receipt = await InboundReceipt.findOne({ _id: receiptId, ...SUPPLIER_RECEIPT }).populate(receiptPopulation);
  if (!receipt) throw appError('Không tìm thấy phiếu nhập.', 404);
  if (isWarehouseStaff(requester) && !isSameUser(receipt.assignedStaffId, requester)) {
    throw appError(NOT_ASSIGNED_MESSAGE, 403);
  }
  return { ...receipt.toObject(), items: await findDetails([receipt._id]) };
};

/* ------------------------------ Tạo phiếu ------------------------------ */

const loadCreateReferences = (data) => Promise.all([
  InventoryLocation.findById(data.locationId),
  Supplier.findOne({ _id: data.supplierId, status: 'active' }),
  User.findOne({ _id: data.assignedStaffId, Role: WAREHOUSE_STAFF_ROLE_PATTERN, Status: /^active$/i }),
  ProductVariant.find({ _id: { $in: data.items.map((item) => item.variantId) }, status: 'active' })
    .populate('productId', 'status'),
]);

const checkCreateReferences = async (data, [location, supplier, staff, variants]) => {
  if (!location || location.status !== 'active') {
    throw appError('Kho/cửa hàng không tồn tại hoặc đang ngừng hoạt động.', 400);
  }
  await assertCentralWarehouse(location._id);
  if (!supplier) throw appError('Nhà cung cấp không tồn tại hoặc đang ngừng hoạt động.', 400);
  if (!staff) throw appError('Nhân viên được giao không tồn tại, không phải nhân viên kho hoặc đã ngừng hoạt động.', 400);
  const uniqueVariantCount = new Set(data.items.map((item) => item.variantId)).size;
  const inactive = variants.some((variant) => !variant.productId || variant.productId.status !== 'active');
  if (variants.length !== uniqueVariantCount || inactive) {
    throw appError('Một hoặc nhiều biến thể không tồn tại hoặc đang ngừng kinh doanh.', 400);
  }
};

/**
 * Quản lý kho tạo phiếu nhập và giao nhân viên. Phiếu và các dòng được tạo trong cùng một transaction,
 * nên nếu một dòng lỗi thì không còn phiếu "mồ côi" không có chi tiết.
 */
export const createInboundReceipt = async (payload, userId) => {
  const data = validateCreateInboundReceipt(payload);
  await checkCreateReferences(data, await loadCreateReferences(data));
  const code = makeCode();
  const session = await mongoose.startSession();
  let receiptId;
  try {
    await session.withTransaction(async () => {
      const [receipt] = await InboundReceipt.create([{
        receiptCode: code,
        locationId: data.locationId,
        supplierId: data.supplierId,
        ...SUPPLIER_RECEIPT,
        status: RECEIPT_STATUS.AWAITING_RECEIVING,
        createdBy: userId,
        assignedStaffId: data.assignedStaffId,
        note: data.note,
      }], { session });
      receiptId = receipt._id;
      await InboundReceiptDetail.insertMany(data.items.map((item, index) => ({
        receiptId,
        receiptDetailCode: `${code}-${String(index + 1).padStart(2, '0')}`,
        ...item,
      })), { session });
    });
  } finally {
    await session.endSession();
  }

  // TASK-012: Branch manager tạo phiếu nhập → hiển thị lại sản phẩm cho khách ngay lập tức
  await markRestockRequested(data.items.map((item) => item.variantId));

  return getInboundReceipt(receiptId);
};

/* ------------------------------ Ghi nhận / duyệt ------------------------------ */

/** Nhân viên được giao ghi số thực nhận / hỏng từng dòng. Chưa cộng tồn. */
export const recordReceipt = async (receiptId, payload, user) => {
  const existing = await InboundReceipt.findOne({ _id: receiptId, ...SUPPLIER_RECEIPT }).select('status assignedStaffId')
    .lean();
  if (!existing || existing.status !== RECEIPT_STATUS.AWAITING_RECEIVING) {
    throw appError('Phiếu không ở trạng thái chờ ghi nhận hàng.', 409);
  }
  if (String(existing.assignedStaffId) !== String(user._id)) throw appError(NOT_ASSIGNED_MESSAGE, 403);
  const details = await InboundReceiptDetail.find({ receiptId }).select('_id');
  const changes = validateReceiptCheck(payload, details.map((item) => String(item._id)));
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Chuyển trạng thái có điều kiện để không ghi đè phiếu vừa bị hủy.
      const receipt = await InboundReceipt.findOneAndUpdate(
        { _id: receiptId, ...SUPPLIER_RECEIPT, status: RECEIPT_STATUS.AWAITING_RECEIVING, assignedStaffId: user._id },
        { $set: { status: RECEIPT_STATUS.RECEIVED, receivedBy: user._id, receivedAt: new Date() } },
        { new: true, session },
      );
      if (!receipt) throw appError('Phiếu không ở trạng thái chờ ghi nhận hàng.', 409);
      for (const item of changes) {
        await InboundReceiptDetail.findOneAndUpdate(
          { _id: item.detailId, receiptId },
          { $set: { quantityReceived: item.quantityReceived, quantityDamaged: item.quantityDamaged, note: item.note } },
          { runValidators: true, session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  // TASK-012: sau khi ghi nhận số hàng thực nhận, kiểm tra lại trạng thái hết hàng của các sản phẩm trong phiếu.
  await refreshStockStatusOfReceipt(receiptId, 'ghi nhận hàng');

  return getInboundReceipt(receiptId);
};

/** Quản lý duyệt kết quả ghi nhận (cho phép xếp hàng lên kệ) hoặc từ chối phiếu. */
export const approveReceipt = async (receiptId, userId, decision, note = '') => {
  const notReceivedMessage = 'Chỉ có thể duyệt hoặc từ chối phiếu đã được nhân viên ghi nhận.';
  const receipt = await InboundReceipt.findOne({ _id: receiptId, ...SUPPLIER_RECEIPT }).select('status note').lean();
  if (!receipt || receipt.status !== RECEIPT_STATUS.RECEIVED) throw appError(notReceivedMessage, 409);
  let changes = { status: RECEIPT_STATUS.APPROVED, approvedAt: new Date() };
  if (decision === 'reject') {
    changes = { status: RECEIPT_STATUS.REJECTED, note: note ? `${receipt.note || ''}\nTừ chối: ${note}`.trim() : receipt.note };
  }
  const updated = await InboundReceipt.findOneAndUpdate(
    { _id: receiptId, ...SUPPLIER_RECEIPT, status: RECEIPT_STATUS.RECEIVED },
    { $set: { ...changes, approvedBy: userId } },
    { new: true },
  );
  if (!updated) throw appError(notReceivedMessage, 409);
  return getInboundReceipt(receiptId);
};

/* ------------------------------ Xếp hàng lên kệ ------------------------------ */

/** Số đạt chất lượng của từng dòng phải được phân bổ hết lên kệ. Trả về các dòng kèm phân bổ. */
const matchAllocationsToAcceptedLines = (details, allocations) => {
  const allocationByDetail = new Map(allocations.map((item) => [item.detailId, item.allocations]));
  const acceptedLines = details.map((detail) => ({
    detail,
    quantity: Math.max(0, detail.quantityReceived - detail.quantityDamaged),
    allocations: allocationByDetail.get(String(detail._id)) || [],
  }));
  for (const line of acceptedLines) {
    if (sum(line.allocations, 'quantity') !== line.quantity) {
      throw appError(`Tổng số lượng phân bổ cho ${line.detail.variantId} phải bằng số lượng hàng đạt chất lượng (${line.quantity}).`, 400);
    }
  }
  return acceptedLines;
};

const assertShelvesValid = async (receipt, toStore, session) => {
  const shelfIds = toStore.map((line) => line.storageId);
  const shelves = await StorageLocation.find({
    _id: { $in: shelfIds }, type: 'shelf', status: 'active', locationId: receipt.locationId,
  }).session(session).lean();
  if (shelves.length !== new Set(shelfIds).size) {
    throw appError('Một hoặc nhiều kệ không hợp lệ, ngừng hoạt động hoặc thuộc kho khác.', 400);
  }
};

/** Kệ (và các cấp cha) cùng toàn kho phải đủ chỗ cho hàng sắp xếp, tính cả phiếu nhập khác đang mở. */
const assertReceiptCapacity = async (receipt, toStore, snapshot, session) => {
  const addedByStorage = new Map();
  for (const line of toStore) addToStorageChain(addedByStorage, snapshot.storageById, String(line.storageId), line.quantity);
  for (const storage of snapshot.storageLocations) {
    const id = String(storage._id);
    if (!addedByStorage.has(id)) continue;
    const used = snapshot.usedByStorage.get(id) || 0;
    const limit = capacityOf(storage.maxCapacity);
    if (used + addedByStorage.get(id) > limit) {
      throw appError(`Không đủ sức chứa tại ${storage.code}: còn ${Math.max(0, limit - used)} cái.`, 409);
    }
  }
  const otherCommitted = await getOpenCommitment(receipt.locationId, receipt._id, session);
  const locationLimit = capacityOf(snapshot.location.maxCapacity);
  if (snapshot.used + otherCommitted + sum(toStore, 'quantity') > locationLimit) {
    const left = Math.max(0, locationLimit - snapshot.used - otherCommitted);
    throw appError(`Không đủ sức chứa toàn kho: còn ${left} cái.`, 409);
  }
};

/** Hàng individual tạo món mới trên kệ (balance cộng theo món); hàng quantity cộng thẳng balance. Rồi ghi sổ. */
const storeOnShelf = async ({ receipt, line, individual, user, session }) => {
  if (individual) {
    const items = Array.from({ length: line.quantity }, () => ({
      variantId: line.detail.variantId,
      locationId: receipt.locationId,
      storageId: line.storageId,
      inboundReceiptDetail: line.detail._id,
      itemCode: `ITM-${new mongoose.Types.ObjectId().toString().toUpperCase()}`,
      condition: 'new',
      status: 'available',
    }));
    await createItems(items, session);
  } else {
    await increaseInventoryBalance({
      locationId: receipt.locationId, storageId: line.storageId, variantId: line.detail.variantId, quantity: line.quantity, session,
    });
  }
  await recordStockMovement({
    variantId: line.detail.variantId,
    locationId: receipt.locationId,
    storageId: line.storageId,
    movementType: 'inbound',
    quantityChange: line.quantity,
    referenceType: 'inbound_receipt',
    referenceId: receipt._id,
    createdBy: user._id,
  }, session);
};

const saveDetailAllocations = async (acceptedLines, session) => {
  for (const { detail, allocations } of acceptedLines) {
    await InboundReceiptDetail.findByIdAndUpdate(detail._id, {
      $set: {
        storageId: allocations.length === 1 ? allocations[0].storageId : null,
        storageAllocations: allocations,
      },
    }, { session });
  }
};

/**
 * Nhân viên xếp hàng đạt chất lượng lên kệ: kiểm kệ và sức chứa, cộng tồn, ghi sổ, lưu vị trí từng dòng.
 * Trạng thái được giành (approved → completed) ngay đầu transaction để không cộng tồn cho phiếu vừa bị hủy.
 */
export const putawayReceipt = async (receiptId, payload, user) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Nếu hủy chạy song song sau bước này thì hai transaction xung đột ghi và chỉ một bên được commit.
      const receipt = await InboundReceipt.findOneAndUpdate(
        { _id: receiptId, ...SUPPLIER_RECEIPT, status: RECEIPT_STATUS.APPROVED },
        { $set: { status: RECEIPT_STATUS.COMPLETED, putawayBy: user._id, putawayAt: new Date() } },
        { new: true, session },
      );
      if (!receipt) throw appError('Chỉ có thể sắp xếp kho cho phiếu đã được duyệt.', 409);
      if (String(receipt.assignedStaffId) !== String(user._id)) throw appError(NOT_ASSIGNED_MESSAGE, 403);
      const details = await InboundReceiptDetail.find({ receiptId }).session(session);
      const allocations = validatePutaway(payload, details.map((item) => String(item._id)));
      const acceptedLines = matchAllocationsToAcceptedLines(details, allocations);
      const toStore = acceptedLines.flatMap((line) => line.allocations.map((allocation) => ({ detail: line.detail, ...allocation })));
      const snapshot = await getPhysicalCapacity(receipt.locationId, session);
      await assertShelvesValid(receipt, toStore, session);
      await assertReceiptCapacity(receipt, toStore, snapshot, session);
      const variants = await ProductVariant.find({ _id: { $in: toStore.map((line) => line.detail.variantId) } })
        .select('productId').populate('productId', 'trackingType').session(session).lean();
      const tracking = new Map(variants.map((variant) => [String(variant._id), variant.productId?.trackingType || 'quantity']));
      for (const line of toStore) {
        const individual = tracking.get(String(line.detail.variantId)) === 'individual';
        await storeOnShelf({ receipt, line, individual, user, session });
      }
      await saveDetailAllocations(acceptedLines, session);
    });
  } finally {
    await session.endSession();
  }

  // TASK-012: Sau khi xếp hàng lên kệ hoàn tất, hàng đã vào kho → kiểm tra lại trạng thái hết hàng
  await refreshStockStatusOfReceipt(receiptId, 'putaway');

  return getInboundReceipt(receiptId);
};

/* ------------------------------ Hủy ------------------------------ */

/** Quản lý kho hủy phiếu chưa xếp kho. Không đổi tồn vì tồn chỉ được cộng ở bước xếp hàng lên kệ. */
export const cancelInboundReceipt = async (receiptId, payload, user) => {
  if (!mongoose.isValidObjectId(receiptId)) throw appError('Mã phiếu nhập không hợp lệ.');
  if (!isWarehouseManagerOrAdmin(user)) throw appError('Chỉ quản lý kho mới được hủy phiếu nhập.', 403);
  const { reason } = validateCancelReason(payload);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const cancelled = await InboundReceipt.findOneAndUpdate(
        { _id: receiptId, ...SUPPLIER_RECEIPT, status: { $in: OPEN_STATUSES } },
        { $set: { status: RECEIPT_STATUS.CANCELLED, cancelledBy: user._id, cancelledAt: new Date(), cancelReason: reason } },
        { new: true, session },
      );
      if (cancelled) return;
      const exists = await InboundReceipt.exists({ _id: receiptId, ...SUPPLIER_RECEIPT }).session(session);
      if (!exists) throw appError('Không tìm thấy phiếu nhập.', 404);
      throw appError('Chỉ hủy được phiếu nhập đang chờ nhận, đã ghi nhận hoặc đã duyệt nhưng chưa xếp kho.', 409);
    });
  } finally {
    await session.endSession();
  }

  // TASK-012: phiếu bị hủy thì hàng sẽ không về nữa → kiểm tra lại trạng thái hết hàng của các sản phẩm trong phiếu.
  await refreshStockStatusOfReceipt(receiptId, 'hủy phiếu nhập');

  return getInboundReceipt(receiptId);
};
