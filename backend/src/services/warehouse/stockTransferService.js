// Điều chuyển hàng từ kho tổng xuống chi nhánh (bổ sung hàng cho cửa hàng).
// Luồng trạng thái: requested → approved → preparing → shipped → (partially_received) → received
//                   (requested có thể bị rejected; requested/approved/preparing có thể bị cancelled).
// Ai làm bước nào:
// - Quản lý chi nhánh: tạo yêu cầu, nhận hàng (ghi số nhận / hỏng), hủy khi còn chờ duyệt.
// - Quản lý kho tổng: duyệt số lượng + giao nhân viên kho, hủy trước khi xuất.
// - Nhân viên kho được giao: soạn hàng (chọn kệ / món) và xác nhận xuất kho.
// Tồn chỉ thay đổi ở bước xuất (trừ kho tổng) và nhận (cộng chi nhánh). Nhận thiếu → mở phiếu chênh lệch.
import mongoose from 'mongoose';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { Shop } from '../../models/shop/Shop.js';
import { StockTransfer } from '../../models/warehouse/transfer/StockTransfer.js';
import { StockTransferDetail } from '../../models/warehouse/transfer/StockTransferDetail.js';
import User from '../../models/system/User.js';
import { decreaseInventoryBalance, increaseInventoryBalance, recordStockMovement } from './inventoryLedgerService.js';
import { openTransferDiscrepancies } from './stockDiscrepancyService.js';
import { moveItem, moveItems } from './itemStateService.js';
import { availableOf, getAvailable, getBalances, sumAvailable } from './balanceQueryService.js';
import { buildPickSuggestion } from './pickSuggestionRules.js';
import { appError } from './shared/errors.js';
import {
  ROLES, WAREHOUSE_STAFF_ROLE_PATTERN, hasRole, isAdmin, isBranchManager, isSameUser,
  isWarehouseManagerOrAdmin, isWarehouseStaff,
} from './shared/roles.js';
import { getCentralWarehouse } from './shared/locations.js';
import { assertBranchCapacity } from './shared/capacity.js';
import { parsePaging } from './shared/pagination.js';
import { andFilter, buildSearchFilter, listSlips } from './shared/listing.js';
import {
  validateCreateTransferRequest,
  validateTransferDecision,
  validateTransferPick,
  validateTransferReceipt,
  validateCancelReason,
} from '../../validations/warehouse/stockTransferValidation.js';

// Giữ lại export cũ: một số nơi vẫn import assertBranchCapacity từ file này.
export { assertBranchCapacity };

export const TRANSFER_STATUS = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PREPARING: 'preparing',
  SHIPPED: 'shipped',
  PARTIALLY_RECEIVED: 'partially_received',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
};
const LISTABLE_STATUSES = Object.values(TRANSFER_STATUS);
/** Phiếu trả hàng chi nhánh dùng chung bảng StockTransfer nhưng có direction riêng; file này bỏ qua chúng. */
const NOT_RETURN = { direction: { $ne: 'branch_to_central' } };
const PICKER_ROLES = [ROLES.WAREHOUSE_STAFF, ROLES.WAREHOUSE_MANAGER, ROLES.ADMIN];
const NOT_ASSIGNED_MESSAGE = 'Phiếu này chưa được giao cho bạn.';

const isBranchManagerOrAdmin = (user) => isBranchManager(user) || isAdmin(user);
const validId = (id) => mongoose.isValidObjectId(id);
const makeCode = () => {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `DC-${day}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
};
const appendNote = (current, label, note) => `${current || ''}\n${label}: ${note}`.trim();

const transferPopulation = [
  { path: 'fromLocationId', select: 'code name type' },
  { path: 'toLocationId', select: 'code name type shopId', populate: { path: 'shopId', select: 'name managerId' } },
  { path: 'createdBy', select: 'FullName Email' },
  { path: 'assignedStaffId', select: 'FullName Email' },
  { path: 'approvedBy', select: 'FullName Email' },
  { path: 'shippedBy', select: 'FullName Email' },
  { path: 'receivedBy', select: 'FullName Email' },
  { path: 'cancelledBy', select: 'FullName Email' },
];

/** Chi tiết đầy đủ của một hoặc nhiều phiếu (một truy vấn $in). */
const findDetails = (transferIds) => StockTransferDetail.find({ transferId: { $in: transferIds } }).sort({ createdAt: 1 })
  .populate({
    path: 'variantId',
    select: 'sku size color productId',
    populate: { path: 'productId', select: 'productCode name trackingType' },
  })
  .populate('fromStorageId', 'code name type')
  .populate('itemIds', 'itemCode serialNumber condition status')
  .populate('discrepancyId', 'discrepancyCode status quantityMissing quantityResolved');

const centralWarehouse = () => getCentralWarehouse(null, {
  select: '_id code name maxCapacity',
  message: 'Hệ thống cần cấu hình đúng một kho tổng đang hoạt động trước khi điều chuyển hàng.',
});

/** Map variantId → trackingType ('individual' | 'quantity') cho các dòng phiếu. */
const loadTrackingTypes = async (details, session) => {
  const variants = await ProductVariant.find({ _id: { $in: details.map((detail) => detail.variantId) } })
    .select('productId').populate('productId', 'trackingType').session(session).lean();
  return new Map(variants.map((row) => [String(row._id), row.productId?.trackingType || 'quantity']));
};

const isIndividualVariant = async (variantId, session = null) => {
  const variant = await ProductVariant.findById(variantId).select('productId')
    .populate('productId', 'trackingType').session(session).lean();
  return variant?.productId?.trackingType === 'individual';
};

/* ------------------------------ Chi nhánh và quyền xem ------------------------------ */

const getBranchShops = async (user) => {
  if (!isBranchManagerOrAdmin(user)) throw appError('Chỉ quản lý chi nhánh mới có thể tạo yêu cầu bổ sung hàng.', 403);
  return Shop.find({ managerId: user._id, status: 'ACTIVE', isDeleted: { $ne: true } })
    .select('_id name isHQ').sort({ isHQ: -1, name: 1 }).lean();
};

const getShopInventoryLocation = async (shopId) => {
  const locations = await InventoryLocation.find({ shopId, type: 'store', status: 'active' })
    .select('_id shopId code name').lean();
  if (!locations.length) throw appError('Chi nhánh chưa được cấu hình kho cửa hàng.', 409);
  if (locations.length !== 1) throw appError('Chi nhánh phải có đúng một kho cửa hàng đang hoạt động.', 409);
  return locations[0];
};

/** Ưu tiên chi nhánh đang chọn trên thanh điều hướng; nếu không có thì lấy chi nhánh đầu tiên có kho. */
const pickSelectedBranch = (branches, activeBranchId) => {
  const active = branches.find((shop) => String(shop._id) === String(activeBranchId) && shop.inventoryLocation);
  if (active) return active;
  if (branches.length === 1 && branches[0].inventoryLocation) return branches[0];
  return branches.find((shop) => shop.inventoryLocation) || null;
};

/** Các chi nhánh quản lý chi nhánh đang phụ trách (kèm kho cửa hàng) và kho tổng, cho màn tạo yêu cầu. */
export const getBranchTransferContext = async (user, activeBranchId = '') => {
  const shops = await getBranchShops(user);
  let locations = [];
  if (shops.length) {
    locations = await InventoryLocation.find({ shopId: { $in: shops.map((shop) => shop._id) }, type: 'store', status: 'active' })
      .select('_id shopId code name').lean();
  }
  const locationByShop = new Map(locations.map((location) => [String(location.shopId), location]));
  const branches = shops.map((shop) => ({ ...shop, inventoryLocation: locationByShop.get(String(shop._id)) || null }));
  return {
    branches,
    selectedBranch: pickSelectedBranch(branches, activeBranchId),
    centralWarehouse: await centralWarehouse(),
  };
};

const assertBranchOwnsLocation = async (locationId, user) => {
  if (!isBranchManagerOrAdmin(user)) throw appError('Bạn không có quyền tạo hoặc nhận yêu cầu điều chuyển.', 403);
  const location = await InventoryLocation.findOne({ _id: locationId, type: 'store', status: 'active' })
    .populate('shopId', 'managerId status isDeleted name').lean();
  const shop = location?.shopId;
  const owned = shop && shop.status === 'ACTIVE' && !shop.isDeleted && String(shop.managerId) === String(user._id);
  if (!owned) throw appError('Kho chi nhánh không tồn tại, không hoạt động hoặc không thuộc chi nhánh bạn quản lý.', 403);
  return location;
};

const canAccessTransfer = async (transfer, user) => {
  if (isWarehouseManagerOrAdmin(user)) return;
  if (isWarehouseStaff(user) && isSameUser(transfer.assignedStaffId, user)) return;
  await assertBranchOwnsLocation(transfer.toLocationId, user);
};

const assertAssignedStaff = (transfer, user) => {
  if (isWarehouseStaff(user) && !isSameUser(transfer.assignedStaffId, user)) throw appError(NOT_ASSIGNED_MESSAGE, 403);
};

const getTransfer = async (transferId, user = null) => {
  if (!validId(transferId)) throw appError('Mã phiếu điều chuyển không hợp lệ.');
  const transfer = await StockTransfer.findOne({ _id: transferId, ...NOT_RETURN }).populate(transferPopulation);
  if (!transfer) throw appError('Không tìm thấy yêu cầu điều chuyển.', 404);
  if (user) await canAccessTransfer(transfer, user);
  return { ...transfer.toObject(), items: await findDetails([transferId]) };
};

/* ------------------------------ Danh sách ------------------------------ */

/** Nhân viên kho chỉ thấy phiếu giao cho mình; chi nhánh chỉ thấy phiếu gửi tới kho của mình. */
const scopeFilterFor = async (user) => {
  if (isWarehouseStaff(user)) return { assignedStaffId: user._id };
  if (isWarehouseManagerOrAdmin(user)) return {};
  if (!isBranchManagerOrAdmin(user)) throw appError('Bạn không có quyền xem phiếu điều chuyển.', 403);
  const shopIds = await Shop.find({ managerId: user._id, status: 'ACTIVE', isDeleted: { $ne: true } }).distinct('_id');
  const locationIds = await InventoryLocation.find({ shopId: { $in: shopIds }, type: 'store' }).distinct('_id');
  return { toLocationId: { $in: locationIds } };
};

/**
 * Danh sách phiếu điều chuyển. Query: status, search, page, limit.
 * Có page/limit → { items, total, page, limit } (mỗi phiếu kèm lineCount, totalQuantity);
 * không có → mảng phiếu kèm `items` đầy đủ như API cũ.
 */
export const listStockTransfers = async (user, query = {}) => {
  const filter = { ...NOT_RETURN };
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
    decorate: (find) => find.populate(transferPopulation),
    paging: parsePaging(query),
    attachDetails: { findDetails, parentField: 'transferId' },
    summary: { DetailModel: StockTransferDetail, parentField: 'transferId', quantityField: 'quantityRequested' },
  });
};

export const listWarehouseTransferStaff = () => User.find({ Role: WAREHOUSE_STAFF_ROLE_PATTERN, Status: /^active$/i })
  .select('FullName Email').sort({ FullName: 1 }).lean();

export const getStockTransfer = getTransfer;

/* ------------------------------ Tạo yêu cầu ------------------------------ */

const pickRequestShop = (shops, branchId) => {
  let shop = null;
  if (branchId) shop = shops.find((row) => String(row._id) === branchId);
  else if (shops.length === 1) shop = shops[0];
  if (!shop) {
    throw appError('Không xác định được chi nhánh đang thao tác. Hãy chọn chi nhánh trong thanh điều hướng rồi thử lại.', 409);
  }
  return shop;
};

const assertVariantsActive = (variants, expectedCount) => {
  const invalid = variants.length !== expectedCount
    || variants.some((variant) => !variant.productId || variant.productId.status !== 'active');
  if (invalid) throw appError('Có biến thể không tồn tại hoặc đã ngừng kinh doanh.');
};

/** Quản lý chi nhánh gửi yêu cầu bổ sung hàng từ kho tổng. Chưa đụng tới tồn. */
export const createTransferRequest = async (payload, user) => {
  if (!isBranchManagerOrAdmin(user)) throw appError('Chỉ quản lý chi nhánh mới có thể tạo yêu cầu bổ sung hàng.', 403);
  const data = validateCreateTransferRequest(payload);
  const shop = pickRequestShop(await getBranchShops(user), data.branchId);
  const [central, branch, variants] = await Promise.all([
    centralWarehouse(),
    getShopInventoryLocation(shop._id),
    ProductVariant.find({ _id: { $in: data.items.map((item) => item.variantId) }, status: 'active' })
      .populate('productId', 'status').lean(),
  ]);
  assertVariantsActive(variants, data.items.length);
  const session = await mongoose.startSession();
  let transferId;
  try {
    await session.withTransaction(async () => {
      const [transfer] = await StockTransfer.create([{
        transferCode: makeCode(),
        fromLocationId: central._id,
        toLocationId: branch._id,
        createdBy: user._id,
        status: TRANSFER_STATUS.REQUESTED,
        note: data.note,
      }], { session });
      transferId = transfer._id;
      await StockTransferDetail.insertMany(data.items.map((item) => ({ transferId, ...item })), { session });
    });
  } finally {
    await session.endSession();
  }
  return getTransfer(transferId, user);
};

/* ------------------------------ Duyệt ------------------------------ */

const rejectRequest = async (transfer, decision, user, session) => {
  transfer.status = TRANSFER_STATUS.REJECTED;
  transfer.approvedBy = user._id;
  transfer.approvedAt = new Date();
  if (decision.note) transfer.note = appendNote(transfer.note, 'Từ chối', decision.note);
  await transfer.save({ session });
};

const loadActiveStaffOrThrow = async (staffId, session) => {
  const staff = await User.findOne({ _id: staffId, Role: WAREHOUSE_STAFF_ROLE_PATTERN, Status: /^active$/i })
    .session(session);
  if (!staff) throw appError('Nhân viên kho được giao không tồn tại hoặc đã ngừng hoạt động.', 400);
  return staff;
};

/** Ghi số duyệt từng dòng; dòng duyệt > 0 phải còn đủ khả dụng ở kho tổng (món cụ thể chọn ở bước soạn). */
const saveApprovedQuantities = async ({ transfer, details, lines, session }) => {
  const byId = new Map(details.map((detail) => [String(detail._id), detail]));
  if (lines.length !== details.length || lines.some((item) => !byId.has(item.detailId))) {
    throw appError('Cần duyệt đầy đủ các dòng trong yêu cầu.');
  }
  let anyApproved = false;
  for (const line of lines) {
    const detail = byId.get(line.detailId);
    if (line.quantityApproved > detail.quantityRequested) {
      throw appError('Số lượng duyệt không được lớn hơn số lượng chi nhánh yêu cầu.');
    }
    if (line.quantityApproved > 0) {
      const available = await getAvailable({ locationId: transfer.fromLocationId, variantId: detail.variantId }, session);
      if (available < line.quantityApproved) {
        throw appError(`Kho tổng chỉ còn ${available} cái khả dụng cho biến thể này.`, 409);
      }
      anyApproved = true;
    }
    detail.quantityApproved = line.quantityApproved;
    detail.pickAllocations = [];
    await detail.save({ session });
  }
  if (!anyApproved) throw appError('Cần duyệt số lượng lớn hơn 0 cho ít nhất một mặt hàng.');
};

/** Quản lý kho tổng duyệt (chốt số lượng, giao nhân viên soạn) hoặc từ chối yêu cầu. */
export const decideTransferRequest = async (transferId, payload, user) => {
  if (!isWarehouseManagerOrAdmin(user)) throw appError('Chỉ quản lý kho tổng mới được duyệt yêu cầu điều chuyển.', 403);
  const decision = validateTransferDecision(payload);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await StockTransfer.findOne({ _id: transferId, ...NOT_RETURN, status: TRANSFER_STATUS.REQUESTED })
        .session(session);
      if (!transfer) throw appError('Yêu cầu không còn ở trạng thái chờ duyệt.', 409);
      if (decision.decision === 'reject') {
        await rejectRequest(transfer, decision, user, session);
        return;
      }
      const details = await StockTransferDetail.find({ transferId }).session(session);
      await loadActiveStaffOrThrow(decision.assignedStaffId, session);
      await saveApprovedQuantities({ transfer, details, lines: decision.items, session });
      transfer.status = TRANSFER_STATUS.APPROVED;
      transfer.assignedStaffId = decision.assignedStaffId;
      transfer.approvedBy = user._id;
      transfer.approvedAt = new Date();
      if (decision.note) transfer.note = appendNote(transfer.note, 'Duyệt', decision.note);
      await transfer.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return getTransfer(transferId, user);
};

/* ------------------------------ Soạn hàng ------------------------------ */

const assertCanPick = (user, message) => {
  if (!hasRole(user, PICKER_ROLES)) throw appError(message, 403);
};

/**
 * Gợi ý hàng có thể lấy tại một kệ khi soạn: hàng individual → danh sách món available;
 * hàng quantity → số khả dụng của dòng balance.
 */
export const getTransferPickCandidates = async (transferId, detailId, storageId, user) => {
  assertCanPick(user, 'Bạn không có quyền soạn hàng.');
  const transfer = await StockTransfer.findOne({ _id: transferId, ...NOT_RETURN });
  if (!transfer) throw appError('Không tìm thấy phiếu điều chuyển.', 404);
  assertAssignedStaff(transfer, user);
  if (transfer.status !== TRANSFER_STATUS.APPROVED) throw appError('Phiếu chưa ở trạng thái chờ soạn hàng.', 409);
  const detail = await StockTransferDetail.findOne({ _id: detailId, transferId });
  if (!detail) throw appError('Không tìm thấy dòng hàng.', 404);
  let storage = null;
  if (storageId && storageId !== 'none') storage = storageId;
  if (storage && !await StorageLocation.exists({ _id: storage, locationId: transfer.fromLocationId, status: 'active' })) {
    throw appError('Vị trí không thuộc kho tổng hoặc đã ngừng hoạt động.');
  }
  const place = { locationId: transfer.fromLocationId, storageId: storage, variantId: detail.variantId };
  if (await isIndividualVariant(detail.variantId)) {
    return InventoryItem.find({ ...place, status: 'available' })
      .select('_id itemCode serialNumber condition status').sort({ createdAt: 1 }).lean();
  }
  const balance = await InventoryBalance.findOne(place).select('quantityOnHand quantityReserved quantityUnavailable').lean();
  return { available: availableOf(balance) };
};

/** Phiếu ở các bước này mới cần xem khả dụng / gợi ý lấy hàng. */
const SUGGESTION_STATUSES = [TRANSFER_STATUS.REQUESTED, TRANSFER_STATUS.APPROVED, TRANSFER_STATUS.PREPARING];

const groupBy = (rows, keyOf) => rows.reduce((map, row) => {
  const key = keyOf(row);
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(row);
  return map;
}, new Map());

/**
 * Chỉ đọc: khả dụng kho tổng từng dòng (cho chủ kho khi duyệt) và gợi ý kệ / món lấy hàng (ít kệ nhất,
 * sắp theo mã vị trí). Không giữ chỗ, không ghi DB. Số cần lấy = số duyệt (chờ duyệt: số yêu cầu).
 * Đọc tồn bằng một truy vấn balance `$in` + một truy vấn món `$in` cho cả phiếu.
 * @returns {{ status, lines: { detailId, variantId, trackingType, needed, centralAvailable, picks, shortage }[] }}
 */
export const getTransferPickSuggestion = async (transferId, user) => {
  assertCanPick(user, 'Bạn không có quyền xem gợi ý lấy hàng.');
  if (!validId(transferId)) throw appError('Mã phiếu điều chuyển không hợp lệ.');
  const transfer = await StockTransfer.findOne({ _id: transferId, ...NOT_RETURN })
    .select('status fromLocationId assignedStaffId').lean();
  if (!transfer) throw appError('Không tìm thấy phiếu điều chuyển.', 404);
  assertAssignedStaff(transfer, user);
  if (!SUGGESTION_STATUSES.includes(transfer.status)) throw appError('Phiếu không còn ở bước duyệt / soạn hàng.', 409);
  const details = await StockTransferDetail.find({ transferId }).sort({ createdAt: 1 })
    .select('_id variantId quantityRequested quantityApproved').lean();
  const fromId = transfer.fromLocationId;
  const variantIds = [...new Set(details.map((detail) => String(detail.variantId)))];
  const [tracking, storages, balances] = await Promise.all([
    loadTrackingTypes(details, null),
    StorageLocation.find({ locationId: fromId, status: 'active' }).select('_id code name type').lean(),
    getBalances({ locationIds: [fromId], variantIds }),
  ]);
  const storageById = new Map(storages.map((storage) => [String(storage._id), storage]));
  const individualIds = variantIds.filter((id) => tracking.get(id) === 'individual');
  const shelfIds = storages.filter((storage) => storage.type === 'shelf').map((storage) => storage._id);
  const items = individualIds.length && shelfIds.length
    ? await InventoryItem.find({
      locationId: fromId, variantId: { $in: individualIds }, storageId: { $in: shelfIds }, status: 'available',
    }).select('_id itemCode variantId storageId').lean()
    : [];
  const withCode = (row) => ({ ...row, storageCode: storageById.get(String(row.storageId))?.code || '' });
  // Hàng số lượng: chỉ các dòng balance nằm trên vị trí đang hoạt động của kho tổng (bỏ dòng "chưa gán vị trí").
  const shelfRows = balances
    .filter((row) => row.storageId && storageById.has(String(row.storageId)))
    .map((row) => withCode({ storageId: String(row.storageId), variantId: String(row.variantId), available: availableOf(row) }));
  const balancesByVariant = groupBy(balances, (row) => String(row.variantId));
  const neededOf = (detail) => (transfer.status === TRANSFER_STATUS.REQUESTED
    ? detail.quantityRequested : detail.quantityApproved) || 0;
  const lines = details.map((detail) => ({
    detailId: String(detail._id),
    variantId: String(detail.variantId),
    individual: tracking.get(String(detail.variantId)) === 'individual',
    needed: neededOf(detail),
  }));
  const itemRows = items.map((item) => withCode({ ...item, storageId: String(item.storageId) }));
  const suggestion = buildPickSuggestion(lines, {
    shelvesByVariant: groupBy(shelfRows, (row) => row.variantId),
    itemsByVariant: groupBy(itemRows, (item) => String(item.variantId)),
  });
  return {
    status: transfer.status,
    lines: suggestion.map((line, index) => ({
      ...line,
      trackingType: lines[index].individual ? 'individual' : 'quantity',
      centralAvailable: sumAvailable(balancesByVariant.get(line.variantId) || []),
      picks: line.picks.map((pick) => ({ ...pick, storageName: storageById.get(String(pick.storageId))?.name || '' })),
    })),
  };
};

/** Mã các món trong danh sách chọn nhưng không còn available tại vị trí (để báo lỗi rõ món nào). */
const unavailableItemCodes = async (itemIds, place, session) => {
  const okIds = new Set((await InventoryItem.find({ _id: { $in: itemIds }, ...place, status: 'available' })
    .select('_id').session(session).lean()).map((item) => String(item._id)));
  const missing = itemIds.filter((id) => !okIds.has(String(id)));
  const rows = await InventoryItem.find({ _id: { $in: missing } }).select('itemCode').session(session).lean();
  return rows.map((item) => item.itemCode).filter(Boolean);
};

/** Kiểm một vị trí lấy hàng: kệ thuộc kho tổng, món chọn còn available / tồn còn đủ. */
const checkPickAllocation = async ({ transfer, detail, allocation, individual, session }) => {
  let storageCode = 'chưa gán vị trí';
  if (allocation.storageId) {
    const shelf = await StorageLocation.findOne({ _id: allocation.storageId, locationId: transfer.fromLocationId, status: 'active' })
      .select('code').session(session).lean();
    if (!shelf) throw appError('Vị trí xuất không thuộc kho tổng hoặc đã ngừng hoạt động.');
    storageCode = shelf.code;
  }
  const place = { locationId: transfer.fromLocationId, storageId: allocation.storageId, variantId: detail.variantId };
  if (individual) {
    if (allocation.itemIds.length !== allocation.quantity) throw appError('Chọn đúng số món hàng cho từng vị trí.');
    const count = await InventoryItem.countDocuments({ _id: { $in: allocation.itemIds }, ...place, status: 'available' })
      .session(session);
    if (count !== allocation.quantity) {
      // TASK-014 D2: gợi ý có thể đã cũ → nói rõ món nào ở vị trí nào không còn sẵn sàng.
      const codes = await unavailableItemCodes(allocation.itemIds, place, session);
      const which = codes.length ? `: ${codes.join(', ')}` : '';
      throw appError(`Một số món hàng tại ${storageCode} đã thay đổi vị trí hoặc trạng thái${which}.`, 409);
    }
    return;
  }
  if (allocation.itemIds.length) throw appError('Mặt hàng quản lý theo số lượng không cần chọn mã hàng.');
  const balance = await InventoryBalance.findOne(place).session(session);
  const available = availableOf(balance);
  if (available < allocation.quantity) {
    throw appError(`Vị trí ${storageCode} chỉ còn ${Math.max(0, available)} cái khả dụng (cần ${allocation.quantity}).`, 409);
  }
};

/** Nhân viên kho lưu phân bổ kệ / món cho từng dòng đã duyệt. Chưa trừ tồn (trừ ở bước xuất). */
export const saveTransferPick = async (transferId, payload, user) => {
  assertCanPick(user, 'Bạn không có quyền soạn hàng.');
  const data = validateTransferPick(payload);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await StockTransfer.findOne({ _id: transferId, ...NOT_RETURN, status: TRANSFER_STATUS.APPROVED })
        .session(session);
      if (!transfer) throw appError('Phiếu chưa ở trạng thái chờ soạn hàng.', 409);
      assertAssignedStaff(transfer, user);
      const details = await StockTransferDetail.find({ transferId }).session(session);
      const byId = new Map(details.map((line) => [String(line._id), line]));
      const approvedCount = details.filter((line) => line.quantityApproved > 0).length;
      if (data.items.length !== approvedCount || data.items.some((line) => !byId.has(line.detailId))) {
        throw appError('Phân bổ đầy đủ các dòng hàng đã duyệt.');
      }
      for (const line of data.items) {
        const detail = byId.get(line.detailId);
        const allocated = line.allocations.reduce((sum, row) => sum + row.quantity, 0);
        if (allocated !== detail.quantityApproved) throw appError('Tổng số lượng các vị trí phải bằng số lượng được duyệt.');
        const individual = await isIndividualVariant(detail.variantId, session);
        for (const allocation of line.allocations) {
          await checkPickAllocation({ transfer, detail, allocation, individual, session });
        }
        detail.pickAllocations = line.allocations;
        await detail.save({ session });
      }
      transfer.status = TRANSFER_STATUS.PREPARING;
      await transfer.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return getTransfer(transferId, user);
};

/* ------------------------------ Xuất kho ------------------------------ */

/** Hàng individual: món rời kệ nguồn → in_transit (balance kệ nguồn giảm qua itemStateService). */
const moveShippedItemsToInTransit = async ({ transfer, detail, allocation, storageId, user, session }) => {
  const items = await InventoryItem.find({
    _id: { $in: allocation.itemIds },
    locationId: transfer.fromLocationId,
    storageId,
    variantId: detail.variantId,
    status: 'available',
  }).session(session);
  if (items.length !== allocation.quantity) throw appError('Một số món hàng đã thay đổi vị trí hoặc trạng thái.', 409);
  await moveItems(items, { status: 'in_transit' }, session);
  for (const item of items) {
    await recordStockMovement({
      variantId: detail.variantId,
      itemId: item._id,
      locationId: transfer.fromLocationId,
      storageId,
      movementType: 'transfer_out',
      quantityChange: -1,
      referenceType: 'stock_transfer',
      referenceId: transfer._id,
      createdBy: user._id,
    }, session);
  }
  return items.map((item) => item._id);
};

/** Hàng quantity: trừ tồn khả dụng của kệ bằng một lệnh có điều kiện rồi ghi sổ. */
const shipQuantityFromShelf = async ({ transfer, detail, allocation, storageId, user, session }) => {
  await decreaseInventoryBalance({
    locationId: transfer.fromLocationId,
    storageId,
    variantId: detail.variantId,
    quantity: allocation.quantity,
    session,
    message: 'Tồn khả dụng tại một vị trí đã thay đổi.',
  });
  await recordStockMovement({
    variantId: detail.variantId,
    locationId: transfer.fromLocationId,
    storageId,
    movementType: 'transfer_out',
    quantityChange: -allocation.quantity,
    referenceType: 'stock_transfer',
    referenceId: transfer._id,
    createdBy: user._id,
  }, session);
};

const shipDetailLine = async ({ transfer, detail, individual, user, session }) => {
  const quantity = detail.quantityApproved || 0;
  if (!quantity) return;
  const allocations = detail.pickAllocations || [];
  const allocated = allocations.reduce((sum, allocation) => sum + allocation.quantity, 0);
  if (allocated !== quantity) throw appError('Phân bổ vị trí không khớp số lượng được duyệt.', 409);
  const itemIds = [];
  for (const allocation of allocations) {
    const storageId = allocation.storageId || null;
    const context = { transfer, detail, allocation, storageId, user, session };
    if (individual) itemIds.push(...await moveShippedItemsToInTransit(context));
    else await shipQuantityFromShelf(context);
  }
  detail.itemIds = itemIds;
  detail.quantityShipped = quantity;
  await detail.save({ session });
};

/** Xác nhận xuất kho: trừ tồn kho tổng theo phân bổ đã soạn, món chuyển sang đang vận chuyển. */
export const shipTransfer = async (transferId, user) => {
  assertCanPick(user, 'Bạn không có quyền xác nhận xuất hàng.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Giành trạng thái ngay đầu transaction: nếu phiếu vừa bị hủy hoặc đã xuất thì không trừ tồn.
      const transfer = await StockTransfer.findOneAndUpdate(
        { _id: transferId, ...NOT_RETURN, status: TRANSFER_STATUS.PREPARING },
        { $set: { status: TRANSFER_STATUS.SHIPPED, shippedBy: user._id, shippedAt: new Date() } },
        { new: true, session },
      );
      if (!transfer) throw appError('Phiếu chưa được phân bổ vị trí, đã xuất hàng hoặc đã bị hủy.', 409);
      assertAssignedStaff(transfer, user);
      const details = await StockTransferDetail.find({ transferId }).session(session);
      const tracking = await loadTrackingTypes(details, session);
      for (const detail of details) {
        const individual = tracking.get(String(detail.variantId)) === 'individual';
        await shipDetailLine({ transfer, detail, individual, user, session });
      }
    });
  } finally {
    await session.endSession();
  }
  return getTransfer(transferId, user);
};

/* ------------------------------ Hủy ------------------------------ */

/**
 * Hủy phiếu. Kho tổng hủy được tới trước khi xuất; chi nhánh chỉ hủy khi còn chờ duyệt.
 * Không đổi tồn vì ở các trạng thái này tồn chưa bị trừ.
 */
export const cancelTransfer = async (transferId, payload, user) => {
  if (!validId(transferId)) throw appError('Mã phiếu điều chuyển không hợp lệ.');
  const manager = isWarehouseManagerOrAdmin(user);
  if (!manager && !isBranchManager(user)) throw appError('Bạn không có quyền hủy phiếu điều chuyển.', 403);
  const { reason } = validateCancelReason(payload);
  let allowedStatuses = [TRANSFER_STATUS.REQUESTED];
  if (manager) allowedStatuses = [TRANSFER_STATUS.REQUESTED, TRANSFER_STATUS.APPROVED, TRANSFER_STATUS.PREPARING];
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await StockTransfer.findOne({ _id: transferId, ...NOT_RETURN })
        .select('toLocationId status').session(session).lean();
      if (!current) throw appError('Không tìm thấy phiếu điều chuyển.', 404);
      if (!manager) await assertBranchOwnsLocation(current.toLocationId, user);
      const cancelled = await StockTransfer.findOneAndUpdate(
        { _id: transferId, ...NOT_RETURN, status: { $in: allowedStatuses } },
        { $set: { status: TRANSFER_STATUS.CANCELLED, cancelledBy: user._id, cancelledAt: new Date(), cancelReason: reason } },
        { new: true, session },
      );
      if (cancelled) return;
      if (manager) {
        throw appError('Chỉ hủy được phiếu đang chờ duyệt, đã duyệt hoặc đang soạn hàng. Phiếu có thể vừa được xuất kho.', 409);
      }
      throw appError('Chi nhánh chỉ hủy được yêu cầu đang chờ duyệt.', 409);
    });
  } finally {
    await session.endSession();
  }
  return getTransfer(transferId, user);
};

/* ------------------------------ Nhận hàng ------------------------------ */

const checkReceiptQuantities = (line, detail) => {
  if (line.quantityReceived < detail.quantityReceived || line.quantityReceived > detail.quantityShipped) {
    throw appError('Số lượng nhận phải từ số đã nhận trước đó đến số lượng đã xuất.');
  }
  if (line.quantityDamaged < detail.quantityDamaged || line.quantityDamaged > line.quantityReceived) {
    throw appError('Số lượng hỏng không hợp lệ.');
  }
};

/** Mã món nhận / hỏng phải thuộc phiếu xuất, khớp số lượng và không bỏ món đã xác nhận ở lần nhận trước. */
const checkReceivedItemIds = (line, detail) => {
  const shippedIds = new Set(detail.itemIds.map(String));
  const receivedIds = new Set(line.receivedItemIds);
  const damagedIds = new Set(line.damagedItemIds);
  const previousReceived = (detail.receivedItemIds || []).map(String);
  const previousDamaged = (detail.damagedItemIds || []).map(String);
  if (receivedIds.size !== line.quantityReceived || [...receivedIds].some((id) => !shippedIds.has(id))) {
    throw appError('Danh sách mã cá thể nhận không khớp số lượng hoặc phiếu xuất.');
  }
  if (damagedIds.size !== line.quantityDamaged || [...damagedIds].some((id) => !receivedIds.has(id))) {
    throw appError('Danh sách mã cá thể hỏng không hợp lệ.');
  }
  if (previousReceived.some((id) => !receivedIds.has(id))) {
    throw appError('Không thể bỏ mã hàng đã xác nhận nhận ở lần trước.');
  }
  if (previousDamaged.some((id) => !line.damagedItemIds.includes(id))) {
    throw appError('Không thể bỏ trạng thái hỏng đã ghi nhận ở lần trước.');
  }
};

/** Món mới nhận: in_transit → available/unavailable tại chi nhánh. Món đã nhận trước: chỉ xử lý khi mới báo hỏng. */
const receiveIndividualItems = async ({ transfer, detail, line, previous, destination, user, session }) => {
  for (const itemId of line.receivedItemIds) {
    const isDamaged = line.damagedItemIds.includes(itemId);
    const alreadyReceived = previous.received.has(itemId);
    if (alreadyReceived && (!isDamaged || previous.damaged.has(itemId))) continue;
    let item;
    if (alreadyReceived) {
      item = await InventoryItem.findOne({ _id: itemId, locationId: destination._id, status: 'available' }).session(session);
    } else {
      item = await InventoryItem.findOne({ _id: itemId, locationId: transfer.fromLocationId, status: 'in_transit' })
        .session(session);
    }
    if (!item) throw appError('Một mã hàng cá thể không còn ở trạng thái/vị trí dự kiến.', 409);
    const change = { status: isDamaged ? 'unavailable' : 'available' };
    if (isDamaged) change.condition = 'damaged';
    if (!alreadyReceived) Object.assign(change, { locationId: destination._id, storageId: null });
    await moveItem(item, change, session);
    if (alreadyReceived) continue;
    await recordStockMovement({
      variantId: detail.variantId,
      itemId: item._id,
      locationId: destination._id,
      movementType: 'transfer_in',
      quantityChange: 1,
      referenceType: 'stock_transfer',
      referenceId: transfer._id,
      createdBy: user._id,
    }, session);
  }
};

/** Hàng quantity: cộng phần nhận thêm vào kho chi nhánh, phần hỏng thêm vào "không khả dụng". */
const receiveQuantityGoods = async ({ transfer, detail, receivedDelta, damagedDelta, destination, user, session }) => {
  if (receivedDelta <= 0 && damagedDelta <= 0) return;
  const balance = await increaseInventoryBalance({
    locationId: destination._id,
    storageId: null,
    variantId: detail.variantId,
    quantity: receivedDelta,
    increments: { quantityUnavailable: damagedDelta },
    session,
  });
  if (balance.quantityOnHand < balance.quantityReserved + balance.quantityUnavailable) {
    throw appError('Số lượng khả dụng của chi nhánh không thể âm.', 409);
  }
  await recordStockMovement({
    variantId: detail.variantId,
    locationId: destination._id,
    storageId: null,
    movementType: 'transfer_in',
    quantityChange: receivedDelta,
    referenceType: 'stock_transfer',
    referenceId: transfer._id,
    createdBy: user._id,
  }, session);
};

const receiveDetailLine = async ({ transfer, detail, line, individual, receipt, destination, user, session }) => {
  checkReceiptQuantities(line, detail);
  if (individual) checkReceivedItemIds(line, detail);
  else if (line.receivedItemIds.length || line.damagedItemIds.length) {
    throw appError('Không gửi mã cá thể cho biến thể quản lý theo số lượng.');
  }
  const previous = {
    received: new Set((detail.receivedItemIds || []).map(String)),
    damaged: new Set((detail.damagedItemIds || []).map(String)),
  };
  const receivedDelta = line.quantityReceived - detail.quantityReceived;
  const damagedDelta = line.quantityDamaged - detail.quantityDamaged;
  detail.quantityReceived = line.quantityReceived;
  detail.quantityDamaged = line.quantityDamaged;
  detail.quantityMissing = receipt.complete ? detail.quantityShipped - line.quantityReceived : 0;
  if (individual) {
    detail.receivedItemIds = line.receivedItemIds;
    detail.damagedItemIds = line.damagedItemIds;
  }
  await detail.save({ session });
  const context = { transfer, detail, destination, user, session };
  if (individual) await receiveIndividualItems({ ...context, line, previous });
  else await receiveQuantityGoods({ ...context, receivedDelta, damagedDelta });
};

/** Số hàng nhận thêm lần này, dùng để kiểm sức chứa chi nhánh trước khi ghi. */
const incomingQuantities = (receipt, detailById) => receipt.items
  .map((line) => {
    const detail = detailById.get(line.detailId);
    return { variantId: detail.variantId, quantity: Math.max(0, line.quantityReceived - detail.quantityReceived) };
  })
  .filter((line) => line.quantity > 0);

/**
 * Chi nhánh xác nhận nhận hàng (có thể nhận nhiều lần). `complete = true` chốt phiếu:
 * số còn thiếu mở phiếu chênh lệch (món thiếu giữ in_transit), không loại bỏ ngay.
 */
export const receiveTransfer = async (transferId, payload, user) => {
  if (!isBranchManagerOrAdmin(user)) throw appError('Chỉ quản lý chi nhánh mới được xác nhận nhận hàng.', 403);
  const receipt = validateTransferReceipt(payload);
  const receivable = [TRANSFER_STATUS.SHIPPED, TRANSFER_STATUS.PARTIALLY_RECEIVED];
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const transfer = await StockTransfer.findOne({ _id: transferId, ...NOT_RETURN, status: { $in: receivable } })
        .session(session);
      if (!transfer) throw appError('Phiếu chưa được xuất từ kho tổng hoặc đã hoàn tất nhận hàng.', 409);
      const destination = await assertBranchOwnsLocation(transfer.toLocationId, user);
      const details = await StockTransferDetail.find({ transferId }).session(session);
      const detailById = new Map(details.map((detail) => [String(detail._id), detail]));
      if (receipt.items.length !== details.length || receipt.items.some((line) => !detailById.has(line.detailId))) {
        throw appError('Cần xác nhận đầy đủ các dòng hàng trong phiếu.');
      }
      const tracking = await loadTrackingTypes(details, session);
      await assertBranchCapacity(destination, incomingQuantities(receipt, detailById), session);
      for (const line of receipt.items) {
        const detail = detailById.get(line.detailId);
        const individual = tracking.get(String(detail.variantId)) === 'individual';
        await receiveDetailLine({ transfer, detail, line, individual, receipt, destination, user, session });
      }
      if (receipt.complete) {
        await openTransferDiscrepancies({ transfer, details, tracking, user, session });
        transfer.status = TRANSFER_STATUS.RECEIVED;
        transfer.receivedBy = user._id;
        transfer.receivedAt = new Date();
      } else {
        transfer.status = TRANSFER_STATUS.PARTIALLY_RECEIVED;
      }
      if (receipt.note) transfer.note = appendNote(transfer.note, 'Nhận hàng', receipt.note);
      await transfer.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return getTransfer(transferId, user);
};
