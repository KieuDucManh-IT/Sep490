// Kiểm kê (Stocktake) và điều chỉnh tồn (StockAdjustment) tại kho tổng.
// Kiểm kê:    draft → in_progress → counted → approved   (draft / in_progress / counted có thể bị cancelled).
// Điều chỉnh: requested → approved | rejected; approved → applied.
// Ai làm bước nào:
// - Quản lý kho: tạo phiếu kiểm kê + giao nhân viên, bắt đầu (chụp số hệ thống), duyệt kết quả
//   (sinh phiếu điều chỉnh nếu lệch), duyệt / áp dụng điều chỉnh, hủy kiểm kê.
// - Nhân viên kho được giao (hoặc quản lý): ghi số đếm thực tế, gửi kết quả.
// Lúc duyệt, số lệch được tính lại theo sổ biến động phát sinh SAU thời điểm đếm, để hàng xuất / nhập trong lúc
// kiểm kê không bị coi là chênh lệch. Tồn chỉ thay đổi ở bước áp dụng điều chỉnh.
// TASK-015: mọi sản phẩm quản lý theo món — mỗi dòng kiểm kê là một món (`itemId`), tình trạng hỏng ghi theo món
// (`countedCondition`), món lạ phát hiện thêm dùng `newItems`; mỗi dòng điều chỉnh gắn một món.
import mongoose from 'mongoose';
import { refreshOutOfStockStatus } from './productStockStatusService.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { StockMovement } from '../../models/warehouse/inventory/StockMovement.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { Product } from '../../models/masterdata/Product.js';
import User from '../../models/system/User.js';
import { Stocktake } from '../../models/warehouse/stocktake/Stocktake.js';
import { StocktakeDetail } from '../../models/warehouse/stocktake/StocktakeDetail.js';
import { StockAdjustment } from '../../models/warehouse/adjustment/StockAdjustment.js';
import { StockAdjustmentDetail } from '../../models/warehouse/adjustment/StockAdjustmentDetail.js';
import {
  validateCancelReason, validateCreateStocktakeInput, validateStocktakeCountInput,
} from '../../validations/warehouse/stockControlValidation.js';
import { recordStockMovement } from './inventoryLedgerService.js';
import {
  filterRowsByLines, groupRowsToPairs, pairsOutOfScope, stocktakePairKey,
} from './stocktakeRules.js';
import { assertCentralWarehouse } from './centralWarehouseService.js';
import { createItems, generateItemCodes, moveItem } from './itemStateService.js';
import { appError } from './shared/errors.js';
import { WAREHOUSE_STAFF_ROLE_PATTERN, isWarehouseManagerOrAdmin, isWarehouseStaff } from './shared/roles.js';
import { addToStorageChain } from './shared/capacity.js';
import { parsePaging } from './shared/pagination.js';
import { andFilter, buildSearchFilter, listSlips } from './shared/listing.js';

export const STOCKTAKE_STATUS = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  COUNTED: 'counted',
  APPROVED: 'approved',
  CANCELLED: 'cancelled',
};
export const ADJUSTMENT_STATUS = {
  REQUESTED: 'requested',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  APPLIED: 'applied',
  CANCELLED: 'cancelled',
};
/** Món ở các trạng thái này không còn nằm trong kho nên không được kiểm kê / điều chỉnh. */
const NOT_IN_STOCK_STATUSES = ['disposed', 'renting', 'in_transit', 'sold'];
const DAMAGED_CONDITIONS = ['damaged', 'unrepairable'];
const STAFF_NOT_ASSIGNED_MESSAGE = 'Phiếu kiểm kê này chưa được giao cho bạn.';

const idValid = (id) => mongoose.Types.ObjectId.isValid(id);
const cleanIds = (value = []) => [...new Set((Array.isArray(value) ? value : []).map(String))];
const makeCode = (prefix) => {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `${prefix}-${day}-${new mongoose.Types.ObjectId().toString().slice(-6).toUpperCase()}`;
};
const isManager = isWarehouseManagerOrAdmin;
const isStaff = isWarehouseStaff;
const isStorageInScope = (storageId, scopedStorageIds) => !scopedStorageIds || scopedStorageIds.has(String(storageId || ''));
const hasProductScopeOf = (stocktake) => stocktake.productIds?.length || stocktake.variantIds?.length;

/**
 * Phạm vi kệ được kiểm: các vị trí được chọn và mọi vị trí con của chúng (chọn Khu → kiểm mọi Dãy, Kệ trong Khu).
 */
const storageScope = async (locationId, requestedIds) => {
  if (!requestedIds?.length) throw appError('Chọn ít nhất một vị trí lưu trữ để kiểm kê.');
  const all = await StorageLocation.find({ locationId, status: 'active' }).select('_id parentStorageId status').lean();
  const allById = new Map(all.map((item) => [String(item._id), item]));
  const requested = cleanIds(requestedIds);
  if (requested.some((id) => !idValid(id) || !allById.has(id) || allById.get(id).status !== 'active')) {
    throw appError('Vị trí kiểm kê không thuộc kho hoặc không hoạt động.');
  }
  const selected = new Set(requested);
  const expanded = new Set(requested);
  for (const storage of all) {
    const ancestors = new Map();
    addToStorageChain(ancestors, allById, String(storage._id), 1);
    if ([...ancestors.keys()].some((id) => selected.has(id))) expanded.add(String(storage._id));
  }
  return { all, expanded };
};

const stocktakePopulation = [
  { path: 'locationId', select: 'code name type' },
  { path: 'storageIds', select: 'code name type parentStorageId' },
  { path: 'productIds', select: 'productCode name' },
  { path: 'variantIds', select: 'sku size color productId', populate: { path: 'productId', select: 'productCode name' } },
  { path: 'createdBy', select: 'FullName Email' },
  { path: 'assignedStaffId', select: 'FullName Email' },
  { path: 'approvedBy', select: 'FullName Email' },
  { path: 'cancelledBy', select: 'FullName Email' },
];

/** Chi tiết kiểm kê của một hoặc nhiều phiếu (một truy vấn $in). */
const findStocktakeDetails = (stocktakeIds) => StocktakeDetail.find({ stocktakeId: { $in: stocktakeIds } })
  .sort({ createdAt: 1 })
  .populate({
    path: 'variantId',
    select: 'sku size color productId',
    populate: { path: 'productId', select: 'productCode name' },
  })
  .populate('itemId', 'itemCode serialNumber condition status')
  .populate('storageId', 'code name type');

const adjustmentPopulation = [
  { path: 'locationId', select: 'code name' },
  { path: 'stocktakeId', select: 'stocktakeCode status' },
  { path: 'createdBy', select: 'FullName Email' },
  { path: 'approvedBy', select: 'FullName Email' },
];

/** Chi tiết điều chỉnh của một hoặc nhiều phiếu (một truy vấn $in). */
const findAdjustmentDetails = (adjustmentIds) => StockAdjustmentDetail.find({ adjustmentId: { $in: adjustmentIds } })
  .sort({ createdAt: 1 })
  .populate({ path: 'variantId', select: 'sku productId', populate: { path: 'productId', select: 'productCode name' } })
  .populate('itemId', 'itemCode serialNumber status')
  .populate('storageId', 'code name type');

const assertStaffAssigned = (stocktake, user) => {
  const assignedId = stocktake.assignedStaffId?._id || stocktake.assignedStaffId || '';
  if (isStaff(user) && String(assignedId) !== String(user._id)) throw appError(STAFF_NOT_ASSIGNED_MESSAGE, 403);
};

const loadStocktake = async (id, requester) => {
  if (!idValid(id)) throw appError('Mã phiếu kiểm kê không hợp lệ.');
  const stocktake = await Stocktake.findById(id).populate(stocktakePopulation);
  if (!stocktake) throw appError('Không tìm thấy phiếu kiểm kê.', 404);
  assertStaffAssigned(stocktake, requester);
  return { ...stocktake.toObject(), items: await findStocktakeDetails([id]) };
};

/* ======================================== Kiểm kê ======================================== */

export const listWarehouseStaffForStocktake = () => User.find({ Role: WAREHOUSE_STAFF_ROLE_PATTERN, Status: /^active$/i })
  .select('FullName Email').sort({ FullName: 1 }).lean();

/** Sản phẩm / biến thể được chọn vào phạm vi phải còn hoạt động. */
const assertScopeProductsActive = async (productIds, variantIds) => {
  if (productIds.length) {
    const count = await Product.countDocuments({ _id: { $in: productIds }, status: 'active', isDeleted: { $ne: true } });
    if (count !== productIds.length) throw appError('Một hoặc nhiều sản phẩm không tồn tại hoặc đã ngừng hoạt động.');
  }
  if (!variantIds.length) return;
  const rows = await ProductVariant.find({ _id: { $in: variantIds }, status: 'active', isDeleted: { $ne: true } })
    .select('productId').lean();
  if (rows.length !== variantIds.length) throw appError('Một hoặc nhiều biến thể không tồn tại hoặc đã ngừng hoạt động.');
  const variantProductIds = [...new Set(rows.map((variant) => String(variant.productId)))];
  const activeProductCount = await Product.countDocuments({ _id: { $in: variantProductIds }, status: 'active', isDeleted: { $ne: true } });
  if (activeProductCount !== variantProductIds.length) {
    throw appError('Một hoặc nhiều sản phẩm chứa biến thể đã ngừng hoạt động.');
  }
};

/** Kiểm phạm vi gửi lên (kho tổng, vị trí, sản phẩm còn hoạt động); dùng chung cho tạo phiếu và xem trước. */
const validateScope = async (payload) => {
  const input = validateCreateStocktakeInput(payload);
  const location = await InventoryLocation.findOne({ _id: input.locationId, status: 'active' }).lean();
  if (!location) throw appError('Kho/cửa hàng không tồn tại hoặc không hoạt động.');
  await assertCentralWarehouse(location._id);
  if (input.storageIds.length) await storageScope(input.locationId, input.storageIds);
  await assertScopeProductsActive(input.productIds, input.variantIds);
  return input;
};

/** Mỗi cặp WM chọn phải nằm trong phạm vi phiếu: biến thể thuộc phạm vi sản phẩm, vị trí thuộc phạm vi kệ. */
const assertLinesInScope = async (scope, lines) => {
  const selectedVariants = await resolveScopeVariants(scope, null);
  let expanded = null;
  if (scope.storageIds?.length) ({ expanded } = await storageScope(scope.locationId, scope.storageIds.map(String)));
  if (pairsOutOfScope(lines, { variantIds: selectedVariants, storageIds: expanded }).length) {
    throw appError('Có dòng hàng nằm ngoài phạm vi kiểm kê đã chọn.');
  }
  const variantIds = [...new Set(lines.map((line) => line.variantId))];
  const activeVariants = await ProductVariant.countDocuments({ _id: { $in: variantIds }, status: 'active', isDeleted: { $ne: true } });
  if (activeVariants !== variantIds.length) throw appError('Có dòng hàng chứa biến thể không tồn tại hoặc đã ngừng hoạt động.');
  const storageIds = [...new Set(lines.map((line) => line.storageId).filter(Boolean))];
  const activeStorages = await StorageLocation.countDocuments({ _id: { $in: storageIds }, locationId: scope.locationId, status: 'active' });
  if (activeStorages !== storageIds.length) throw appError('Có dòng hàng chứa vị trí không thuộc kho hoặc không hoạt động.');
};

/**
 * Tạo phiếu kiểm kê nháp tại kho tổng với phạm vi kệ / sản phẩm. Chưa chụp số hệ thống.
 * `lines` (tùy chọn): chỉ kiểm các cặp (biến thể, vị trí) này; mỗi cặp phải nằm trong phạm vi, không thì 400.
 */
export const createStocktake = async (payload, user) => {
  const scope = await validateScope(payload);
  const { locationId, scopeType, productIds, variantIds, storageIds, assignedStaffId, lines } = scope;
  if (lines) await assertLinesInScope(scope, lines);
  if (assignedStaffId) {
    const staffOk = await User.exists({ _id: assignedStaffId, Role: WAREHOUSE_STAFF_ROLE_PATTERN, Status: /^active$/i });
    if (!staffOk) throw appError('Nhân viên được giao không hợp lệ.');
  }
  const stocktake = await Stocktake.create({
    stocktakeCode: makeCode('KK'),
    locationId,
    scopeType,
    productIds,
    variantIds,
    storageIds,
    selectedLines: lines || [],
    createdBy: user._id,
    assignedStaffId,
    status: STOCKTAKE_STATUS.DRAFT,
  });
  return loadStocktake(stocktake._id, user);
};

/**
 * Danh sách phiếu kiểm kê. Query: status, search, page, limit. Nhân viên chỉ thấy phiếu giao cho mình.
 * Có page/limit → { items, total, page, limit } (lineCount = số dòng, totalQuantity = tổng số hệ thống);
 * không có → mảng phiếu kèm `items` đầy đủ như API cũ.
 */
export const listStocktakes = async (user, query = {}) => {
  const filter = {};
  if (query.status && Object.values(STOCKTAKE_STATUS).includes(query.status)) filter.status = query.status;
  if (isStaff(user)) filter.assignedStaffId = user._id;
  const searchFilter = await buildSearchFilter(query.search, {
    codeField: 'stocktakeCode',
    locationFields: ['locationId'],
    userFields: ['createdBy', 'assignedStaffId'],
  });
  return listSlips({
    Model: Stocktake,
    filter: andFilter(filter, searchFilter),
    decorate: (find) => find.populate(stocktakePopulation),
    paging: parsePaging(query),
    attachDetails: { findDetails: findStocktakeDetails, parentField: 'stocktakeId' },
    summary: { DetailModel: StocktakeDetail, parentField: 'stocktakeId', quantityField: 'systemQuantity' },
  });
};

export const getStocktake = loadStocktake;

/** Các biến thể trong phạm vi sản phẩm (biến thể chọn trực tiếp + mọi biến thể của sản phẩm chọn). */
const resolveScopeVariants = async (stocktake, session) => {
  const selectedVariants = new Set((stocktake.variantIds || []).map(String));
  if (stocktake.productIds?.length) {
    const activeProductCount = await Product.countDocuments({ _id: { $in: stocktake.productIds }, status: 'active', isDeleted: { $ne: true } })
      .session(session);
    if (activeProductCount !== stocktake.productIds.length) {
      throw appError('Một hoặc nhiều sản phẩm trong phạm vi đã ngừng hoạt động; hãy tạo lại phiếu với phạm vi mới.');
    }
    const productVariants = await ProductVariant.find({ productId: { $in: stocktake.productIds }, status: 'active', isDeleted: { $ne: true } })
      .distinct('_id').session(session);
    productVariants.forEach((id) => selectedVariants.add(String(id)));
  }
  if (!hasProductScopeOf(stocktake)) return null;
  if (selectedVariants.size === 0) throw appError('Không tìm thấy biến thể đang hoạt động trong phạm vi sản phẩm đã chọn.');
  const activeCount = await ProductVariant.countDocuments({ _id: { $in: [...selectedVariants] }, status: 'active', isDeleted: { $ne: true } })
    .session(session);
  if (activeCount !== selectedVariants.size) {
    throw appError('Một hoặc nhiều biến thể trong phạm vi đã ngừng hoạt động; hãy tạo lại phiếu với phạm vi mới.');
  }
  return selectedVariants;
};

/** Chụp số hệ thống: mỗi món còn trong kho (trong phạm vi) một dòng, số hệ thống = 1. */
const buildSnapshotRows = async (stocktake, scopeFilter, session) => {
  const items = await InventoryItem.find({ locationId: stocktake.locationId, status: { $nin: NOT_IN_STOCK_STATUSES }, ...scopeFilter })
    .session(session).lean();
  return items.map((item) => ({
    stocktakeId: stocktake._id, variantId: item.variantId, itemId: item._id, storageId: item.storageId,
    systemQuantity: 1, countedQuantity: 0, isCounted: false,
  }));
};

/**
 * Chọn các dòng sẽ kiểm của một phạm vi — MỘT logic dùng chung cho lúc bắt đầu kiểm (chụp số) và lúc xem trước:
 * kệ đã chọn + cấp con, biến thể của phạm vi sản phẩm, rồi lọc theo cặp WM đã chọn (`selectedLines`) nếu có.
 */
const selectStocktakeRows = async (scope, session) => {
  let expanded = null;
  if (scope.storageIds?.length) ({ expanded } = await storageScope(scope.locationId, scope.storageIds.map(String)));
  const selectedVariants = await resolveScopeVariants(scope, session);
  const scopeFilter = {};
  if (selectedVariants) scopeFilter.variantId = { $in: [...selectedVariants] };
  if (expanded) scopeFilter.storageId = { $in: [...expanded] };
  const rows = await buildSnapshotRows(scope, scopeFilter, session);
  return filterRowsByLines(rows, scope.selectedLines);
};

const previewSortKey = (item) => `${item.storage?.code || '~'}|${item.variant?.productId?.name || ''}|${item.variant?.sku || ''}`;

/**
 * Xem trước (chỉ đọc): các cặp (biến thể, vị trí) sẽ có trong phiếu nếu bắt đầu kiểm ngay lúc này,
 * kèm tồn sổ hiện tại. Body = phạm vi như khi tạo phiếu (`lines` bị bỏ qua).
 */
export const previewStocktake = async (payload) => {
  const scope = await validateScope({ ...(payload || {}), lines: undefined });
  const rows = await selectStocktakeRows(scope, null);
  const pairs = groupRowsToPairs(rows);
  const [variants, storages] = await Promise.all([
    ProductVariant.find({ _id: { $in: [...new Set(pairs.map((pair) => pair.variantId))] } })
      .select('sku size color productId').populate('productId', 'productCode name').lean(),
    StorageLocation.find({ _id: { $in: [...new Set(pairs.map((pair) => pair.storageId).filter(Boolean))] } })
      .select('code name type').lean(),
  ]);
  const variantById = new Map(variants.map((row) => [String(row._id), row]));
  const storageById = new Map(storages.map((row) => [String(row._id), row]));
  const items = pairs.map((pair) => ({
    key: stocktakePairKey(pair.variantId, pair.storageId),
    ...pair,
    variant: variantById.get(pair.variantId) || null,
    storage: pair.storageId ? storageById.get(pair.storageId) || null : null,
  }));
  items.sort((left, right) => previewSortKey(left).localeCompare(previewSortKey(right), 'vi'));
  return { items, total: items.length };
};

/** Quản lý bắt đầu kiểm kê: chụp số hệ thống vào chi tiết phiếu. Không khóa tồn. */
export const startStocktake = async (stocktakeId, user) => {
  if (!isManager(user)) throw appError('Chỉ quản lý kho mới được bắt đầu kiểm kê.', 403);
  if (!idValid(stocktakeId)) throw appError('Mã phiếu kiểm kê không hợp lệ.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const stocktake = await Stocktake.findOne({ _id: stocktakeId, status: STOCKTAKE_STATUS.DRAFT }).session(session);
      if (!stocktake) throw appError('Phiếu không ở trạng thái nháp.', 409);
      const startedAt = new Date();
      const snapshotRows = await selectStocktakeRows(stocktake, session);
      await StocktakeDetail.deleteMany({ stocktakeId }, { session });
      if (snapshotRows.length) await StocktakeDetail.insertMany(snapshotRows, { session });
      stocktake.status = STOCKTAKE_STATUS.IN_PROGRESS;
      stocktake.startedAt = startedAt;
      await stocktake.save({ session });
    });
  } finally {
    await session.endSession();
  }
  return loadStocktake(stocktakeId, user);
};

const normalizeCount = (value, label, max = Number.MAX_SAFE_INTEGER) => {
  const quantity = Number(value);
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > max) {
    throw appError(`${label} phải là số nguyên từ 0 đến ${max}.`);
  }
  return quantity;
};

const assertCanCount = (stocktake, user, noPermissionMessage) => {
  if (isStaff(user) && String(stocktake.assignedStaffId || '') !== String(user._id)) {
    throw appError(STAFF_NOT_ASSIGNED_MESSAGE, 403);
  }
  if (!isStaff(user) && !isManager(user)) throw appError(noPermissionMessage, 403);
};

/**
 * Ghi số đếm cho một dòng có sẵn. Dòng của một món: đếm theo tình trạng (mất → 0, còn → 1).
 * Dòng món lạ (ghi qua `newItems`, chưa có itemId): số đếm 0 hoặc 1.
 */
const applyCountToDetail = async ({ detail, line, user, timestamp }) => {
  if (detail.itemId) {
    const itemRecord = await InventoryItem.findById(detail.itemId).select('status condition').lean();
    if (!itemRecord) throw appError('Không tìm thấy món hàng của dòng kiểm kê.', 409);
    detail.countedCondition = line.countedCondition || itemRecord.condition || 'good';
    detail.countedQuantity = detail.countedCondition === 'missing' ? 0 : 1;
    detail.countedItemStatus = itemRecord.status;
  } else {
    detail.countedQuantity = normalizeCount(line.countedQuantity, 'Số lượng thực tế', 1);
  }
  detail.note = String(line.note || '').trim();
  detail.countedBy = user._id;
  detail.countedAt = timestamp;
  detail.isCounted = true;
  await detail.save();
};

/** Hàng phát hiện ngoài hệ thống phải thuộc phạm vi kiểm kê (biến thể / sản phẩm và kệ). */
const assertNewItemInScope = async ({ stocktake, variant, variantId, storageId }) => {
  if (hasProductScopeOf(stocktake)) {
    const allowedByVariant = (stocktake.variantIds || []).some((id) => String(id) === variantId);
    const variantProduct = variant.productId?._id ? String(variant.productId._id) : String(variant.productId);
    const allowedByProduct = (stocktake.productIds || []).some((id) => String(id) === variantProduct);
    if (!allowedByVariant && !allowedByProduct) throw appError('Biến thể mới nằm ngoài phạm vi kiểm kê.');
  }
  if (storageId && !idValid(storageId)) throw appError('Vị trí lưu trữ không hợp lệ.');
  const storageOk = await StorageLocation.exists({ _id: storageId, locationId: stocktake.locationId, status: 'active' });
  if (storageId && !storageOk) throw appError('Vị trí lưu trữ không thuộc kho hoặc không hoạt động.');
  if (!stocktake.storageIds?.length) return;
  const { expanded } = await storageScope(stocktake.locationId, stocktake.storageIds.map(String));
  if (!isStorageInScope(storageId, expanded)) throw appError('Vị trí của mã hàng nằm ngoài phạm vi kiểm kê.');
};

/**
 * Món lạ không được ở trạng thái giữ chỗ; mã nhập tay (nếu có) không được trùng.
 * Không nhập mã → hệ thống sinh mã `<SKU>-<4 số>` lúc áp dụng điều chỉnh (TASK-015).
 */
const assertNewItemNotDuplicated = async ({ stocktakeId, item, code }) => {
  if (item.countedItemStatus === 'reserved') {
    throw appError('Không thể gán trạng thái giữ chỗ cho món hàng mới qua kiểm kê.');
  }
  if (!code) return;
  const exists = await InventoryItem.exists({ itemCode: code });
  const duplicate = await StocktakeDetail.exists({ stocktakeId, countedItemCode: code });
  if (exists || duplicate) throw appError(`Mã hàng ${code} đã tồn tại.`);
};

const newItemStatus = (item, countedCondition) => {
  if (item.countedItemStatus) return item.countedItemStatus;
  return DAMAGED_CONDITIONS.includes(countedCondition) ? 'unavailable' : 'available';
};

/** Ghi một món lạ (có trên kệ nhưng hệ thống không có): mỗi dòng một món, số đếm 1. */
const recordFoundExtra = async ({ stocktake, item, variants, user, timestamp }) => {
  const stocktakeId = stocktake._id;
  const variantId = String(item.variantId || '');
  const storageId = item.storageId ? String(item.storageId) : null;
  if (!idValid(variantId)) throw appError('Biến thể ghi nhận ngoài hệ thống không hợp lệ.');
  if (!storageId) throw appError('Cần chọn vị trí cho mã hàng cá thể mới.');
  const variant = variants.find((row) => String(row._id) === variantId);
  if (!variant || variant.status !== 'active') throw appError('Biến thể kiểm kê không hợp lệ hoặc đã ngừng hoạt động.');
  await assertNewItemInScope({ stocktake, variant, variantId, storageId });
  const countedCondition = item.countedCondition || 'good';
  if (countedCondition === 'missing') throw appError('Món hàng mới không thể được ghi nhận là bị mất.');
  const code = String(item.itemCode || '').trim();
  if (code.length > 100) throw appError('Mã hàng/serial mới tối đa 100 ký tự.');
  await assertNewItemNotDuplicated({ stocktakeId, item, code });
  await StocktakeDetail.create({
    stocktakeId, variantId, storageId, itemId: null, systemQuantity: 0, countedQuantity: 1,
    countedBy: user._id, countedAt: timestamp, isCounted: true,
    countedItemCode: code || null,
    countedSerialNumber: String(item.serialNumber || '').trim() || null,
    countedItemStatus: newItemStatus(item, countedCondition),
    countedCondition,
    note: String(item.note || '').trim(),
  });
};

/** Nhân viên ghi số đếm thực tế và các món / số lượng thừa phát hiện thêm. Có thể ghi nhiều lần. */
export const recordStocktakeCounts = async (stocktakeId, payload, user) => {
  const stocktake = await Stocktake.findById(stocktakeId);
  if (!stocktake || stocktake.status !== STOCKTAKE_STATUS.IN_PROGRESS) {
    throw appError('Phiếu kiểm kê không còn nhận số đếm.', 409);
  }
  assertCanCount(stocktake, user, 'Bạn không có quyền ghi nhận kiểm kê.');
  const { items: lines, newItems } = validateStocktakeCountInput(payload);
  const details = await StocktakeDetail.find({ stocktakeId });
  const detailById = new Map(details.map((detail) => [String(detail._id), detail]));
  const variantIds = [...new Set([
    ...details.map((detail) => String(detail.variantId)),
    ...newItems.map((item) => String(item.variantId || '')),
  ])].filter(Boolean);
  const variants = await ProductVariant.find({ _id: { $in: variantIds } }).select('productId status').lean();
  const timestamp = new Date();
  for (const line of lines) {
    const detail = detailById.get(String(line.detailId || ''));
    if (!detail) throw appError('Có dòng đếm không thuộc phiếu kiểm kê này.');
    await applyCountToDetail({ detail, line, user, timestamp });
  }
  for (const item of newItems) {
    await recordFoundExtra({ stocktake, item, variants, user, timestamp });
  }
  return loadStocktake(stocktakeId, user);
};

/** Gửi kết quả kiểm kê cho quản lý duyệt; mọi dòng phải đã được đếm. */
export const submitStocktake = async (stocktakeId, user) => {
  const stocktake = await Stocktake.findById(stocktakeId);
  if (!stocktake || stocktake.status !== STOCKTAKE_STATUS.IN_PROGRESS) {
    throw appError('Phiếu kiểm kê không ở trạng thái đang kiểm.', 409);
  }
  assertCanCount(stocktake, user, 'Bạn không có quyền gửi kết quả kiểm kê.');
  const uncounted = await StocktakeDetail.countDocuments({ stocktakeId, isCounted: false });
  if (uncounted) throw appError(`Còn ${uncounted} dòng chưa được kiểm đếm.`);
  // Chuyển trạng thái có điều kiện để không ghi đè phiếu vừa bị hủy.
  const updated = await Stocktake.findOneAndUpdate(
    { _id: stocktakeId, status: STOCKTAKE_STATUS.IN_PROGRESS },
    { $set: { status: STOCKTAKE_STATUS.COUNTED, completedAt: new Date() } },
    { new: true },
  );
  if (!updated) throw appError('Phiếu kiểm kê không ở trạng thái đang kiểm.', 409);
  return loadStocktake(stocktakeId, user);
};

/** Hủy kiểm kê. Không cần nhả gì vì bắt đầu kiểm kê chỉ chụp số, không khóa tồn. */
export const cancelStocktake = async (stocktakeId, payload, user) => {
  if (!isManager(user)) throw appError('Chỉ quản lý kho mới được hủy phiếu kiểm kê.', 403);
  if (!idValid(stocktakeId)) throw appError('Mã phiếu kiểm kê không hợp lệ.');
  const { reason } = validateCancelReason(payload);
  const cancellable = [STOCKTAKE_STATUS.DRAFT, STOCKTAKE_STATUS.IN_PROGRESS, STOCKTAKE_STATUS.COUNTED];
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const cancelled = await Stocktake.findOneAndUpdate(
        { _id: stocktakeId, status: { $in: cancellable } },
        { $set: { status: STOCKTAKE_STATUS.CANCELLED, cancelledBy: user._id, cancelledAt: new Date(), cancelReason: reason } },
        { new: true, session },
      );
      if (cancelled) return;
      const exists = await Stocktake.exists({ _id: stocktakeId }).session(session);
      if (!exists) throw appError('Không tìm thấy phiếu kiểm kê.', 404);
      throw appError('Chỉ hủy được phiếu kiểm kê ở trạng thái nháp, đang kiểm hoặc đã đếm xong.', 409);
    });
  } finally {
    await session.endSession();
  }
  return loadStocktake(stocktakeId, user);
};

/* ------------------------------ Duyệt kiểm kê ------------------------------ */

const INBOUND_MOVEMENTS = ['inbound', 'transfer_in', 'rental_return', 'sales_return'];
const OUTBOUND_MOVEMENTS = ['outbound', 'transfer_out', 'sale', 'rental_out', 'disposal'];

/** Đổi một dòng sổ biến động thành số có dấu (+ nhập, − xuất); `adjustment` giữ nguyên dấu đã ghi. */
const signedMovement = (movement) => {
  const amount = Math.abs(Number(movement.quantityChange) || 0);
  if (movement.movementType === 'adjustment') return Number(movement.quantityChange) || 0;
  if (INBOUND_MOVEMENTS.includes(movement.movementType)) return amount;
  if (OUTBOUND_MOVEMENTS.includes(movement.movementType)) return -amount;
  return Number(movement.quantityChange) || 0;
};

/** Tổng biến động của một dòng kiểm kê trong khoảng thời gian (after, before]. */
const movementTotal = async (detail, stocktake, { after, before } = {}) => {
  const filter = { locationId: stocktake.locationId, variantId: detail.variantId };
  if (detail.itemId) filter.itemId = detail.itemId;
  else filter.storageId = detail.storageId || null;
  if (after) filter.createdAt = { $gt: after };
  if (before) filter.createdAt = { ...(filter.createdAt || {}), $lte: before };
  const movements = await StockMovement.find(filter).select('movementType quantityChange').lean();
  return movements.reduce((sum, movement) => sum + signedMovement(movement), 0);
};

/** Số hiện tại trong hệ thống của dòng: món còn ở vị trí trong kho → 1, ngược lại (hoặc món lạ) → 0. */
const currentQuantity = async (detail, locationId, session) => {
  if (!detail.itemId) return 0;
  const item = await InventoryItem.findOne({
    _id: detail.itemId, locationId, storageId: detail.storageId || null, status: { $nin: NOT_IN_STOCK_STATUSES },
  }).select('_id').session(session);
  return item ? 1 : 0;
};

/** Món đã đếm nhưng sau đó rời kệ (không có sổ biến động) thì coi như đã ra khỏi vị trí. */
const itemLeftAfterCount = async (detail, stocktake) => {
  const itemState = await InventoryItem.findById(detail.itemId).select('locationId storageId status').lean();
  const stillPresent = itemState && String(itemState.locationId) === String(stocktake.locationId)
    && String(itemState.storageId || '') === String(detail.storageId || '')
    && !NOT_IN_STOCK_STATUSES.includes(itemState.status);
  return !stillPresent;
};

/** Biến động trước lúc đếm (để tính số hệ thống tại thời điểm đếm) và sau lúc đếm (để tính số đúng hiện tại). */
const movementsAroundCount = async (detail, stocktake) => {
  if (!detail.itemId) return { untilCount: 0, afterCount: 0 };
  const countedAt = detail.countedAt || stocktake.startedAt;
  const untilCount = await movementTotal(detail, stocktake, { after: stocktake.startedAt, before: countedAt });
  let afterCount = await movementTotal(detail, stocktake, { after: countedAt });
  const shouldCheckItem = afterCount === 0 && detail.countedQuantity > 0;
  if (shouldCheckItem && await itemLeftAfterCount(detail, stocktake)) afterCount = -detail.countedQuantity;
  return { untilCount, afterCount };
};

/**
 * Ghi tình trạng đếm được lên món. Chỉ món available mới chuyển unavailable khi hỏng
 * (món reserved đang bị giữ, món maintenance đang có phiếu giặt/sửa thì giữ nguyên trạng thái).
 */
const applyCountedCondition = async (detail, stocktake, session) => {
  const itemRecord = await InventoryItem.findOne({
    _id: detail.itemId, locationId: stocktake.locationId, storageId: detail.storageId || null,
    status: { $nin: NOT_IN_STOCK_STATUSES },
  }).session(session);
  if (!itemRecord) throw appError('Món hàng đã đổi vị trí hoặc trạng thái trong lúc kiểm kê. Tạo lại phiếu kiểm kê.', 409);
  const change = { condition: detail.countedCondition };
  if (DAMAGED_CONDITIONS.includes(detail.countedCondition) && itemRecord.status === 'available') change.status = 'unavailable';
  await moveItem(itemRecord, change, session);
};

const adjustmentLineFor = (detail, before, change) => ({
  adjustmentId: null,
  variantId: detail.variantId,
  itemId: detail.itemId || null,
  storageId: detail.storageId || null,
  quantityBefore: before,
  quantityChange: change,
  quantityAfter: before + change,
  itemCode: detail.countedItemCode || null,
  serialNumber: detail.countedSerialNumber || null,
  itemStatus: detail.countedItemStatus || 'available',
  itemCondition: detail.countedCondition || null,
  reason: detail.note || 'Chênh lệch kiểm kê',
});

/** Đối chiếu một dòng: cập nhật tình trạng món, lưu số hệ thống lúc đếm, trả về dòng điều chỉnh nếu lệch. */
const reconcileDetail = async ({ detail, stocktake, session }) => {
  const { untilCount, afterCount } = await movementsAroundCount(detail, stocktake);
  if (detail.itemId && detail.countedQuantity > 0 && detail.countedCondition) {
    await applyCountedCondition(detail, stocktake, session);
  }
  const expectedNow = Math.max(0, detail.countedQuantity + afterCount);
  detail.systemQuantity = Math.max(0, detail.systemQuantity + untilCount);
  detail.movementAfterCount = afterCount;
  await detail.save({ session });
  const before = await currentQuantity(detail, stocktake.locationId, session);
  const change = expectedNow - before;
  return change ? adjustmentLineFor(detail, before, change) : null;
};

const createAdjustmentFromStocktake = async (stocktake, lines, user, session) => {
  const [adjustment] = await StockAdjustment.create([{
    adjustmentCode: makeCode('DC'),
    locationId: stocktake.locationId,
    stocktakeId: stocktake._id,
    reason: `Điều chỉnh từ kiểm kê ${stocktake.stocktakeCode}`,
    createdBy: user._id,
    status: ADJUSTMENT_STATUS.REQUESTED,
  }], { session });
  await StockAdjustmentDetail.insertMany(lines.map((line) => ({ ...line, adjustmentId: adjustment._id })), { session });
  return adjustment;
};

/**
 * Quản lý duyệt kết quả kiểm kê. Dòng nào lệch sau khi trừ biến động trong lúc kiểm thì gom vào
 * một phiếu điều chỉnh chờ duyệt (chưa đổi tồn ở bước này).
 */
export const approveStocktake = async (stocktakeId, user) => {
  if (!isManager(user)) throw appError('Chỉ quản lý kho mới được duyệt kiểm kê.', 403);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      // Giành trạng thái ngay đầu transaction để duyệt và hủy loại trừ nhau.
      const stocktake = await Stocktake.findOneAndUpdate(
        { _id: stocktakeId, status: STOCKTAKE_STATUS.COUNTED },
        { $set: { status: STOCKTAKE_STATUS.APPROVED, approvedBy: user._id } },
        { new: true, session },
      );
      if (!stocktake) throw appError('Phiếu kiểm kê chưa gửi kết quả, đã được xử lý hoặc đã bị hủy.', 409);
      const details = await StocktakeDetail.find({ stocktakeId }).session(session);
      if (details.some((detail) => !detail.isCounted)) throw appError('Tất cả dòng phải được kiểm đếm trước khi duyệt.');
      const adjustmentLines = [];
      for (const detail of details) {
        const line = await reconcileDetail({ detail, stocktake, session });
        if (line) adjustmentLines.push(line);
      }
      let adjustment = null;
      if (adjustmentLines.length) adjustment = await createAdjustmentFromStocktake(stocktake, adjustmentLines, user, session);
      result = { stocktakeId: stocktake._id, adjustmentId: adjustment?._id || null };
    });
  } finally {
    await session.endSession();
  }
  const stocktake = await loadStocktake(result.stocktakeId, user);
  const adjustment = result.adjustmentId ? await getStockAdjustment(result.adjustmentId) : null;
  return { stocktake, adjustment };
};

/* ======================================== Điều chỉnh tồn ======================================== */

/**
 * Danh sách phiếu điều chỉnh. Query: status, search, page, limit.
 * Có page/limit → { items, total, page, limit } (totalQuantity = tổng chênh có dấu); không có → mảng như cũ.
 */
export const listStockAdjustments = async (query = {}) => {
  const filter = {};
  if (query.status && Object.values(ADJUSTMENT_STATUS).includes(query.status)) filter.status = query.status;
  const searchFilter = await buildSearchFilter(query.search, {
    codeField: 'adjustmentCode',
    locationFields: ['locationId'],
    userFields: ['createdBy', 'approvedBy'],
  });
  return listSlips({
    Model: StockAdjustment,
    filter: andFilter(filter, searchFilter),
    decorate: (find) => find.populate(adjustmentPopulation),
    paging: parsePaging(query),
    attachDetails: { findDetails: findAdjustmentDetails, parentField: 'adjustmentId' },
    summary: { DetailModel: StockAdjustmentDetail, parentField: 'adjustmentId', quantityField: 'quantityChange' },
  });
};

export const getStockAdjustment = async (adjustmentId) => {
  if (!idValid(adjustmentId)) throw appError('Mã phiếu điều chỉnh không hợp lệ.');
  const adjustment = await StockAdjustment.findById(adjustmentId).populate(adjustmentPopulation);
  if (!adjustment) throw appError('Không tìm thấy phiếu điều chỉnh.', 404);
  return { ...adjustment.toObject(), items: await findAdjustmentDetails([adjustmentId]) };
};

/** Quản lý duyệt hoặc từ chối phiếu điều chỉnh. Chưa đổi tồn. */
export const decideStockAdjustment = async (adjustmentId, user, decision, note = '') => {
  if (!isManager(user)) throw appError('Chỉ quản lý kho mới được duyệt điều chỉnh.', 403);
  if (!['approve', 'reject'].includes(decision)) throw appError('Quyết định không hợp lệ.');
  const adjustment = await StockAdjustment.findOne({ _id: adjustmentId, status: ADJUSTMENT_STATUS.REQUESTED });
  if (!adjustment) throw appError('Phiếu điều chỉnh không ở trạng thái chờ duyệt.', 409);
  const approve = decision === 'approve';
  adjustment.status = approve ? ADJUSTMENT_STATUS.APPROVED : ADJUSTMENT_STATUS.REJECTED;
  adjustment.approvedBy = user._id;
  adjustment.approvedAt = new Date();
  if (note) adjustment.reason = `${adjustment.reason}\n${approve ? 'Duyệt' : 'Từ chối'}: ${String(note).trim()}`;
  await adjustment.save();
  return getStockAdjustment(adjustmentId);
};

/** Đã dùng của toàn kho và từng kệ (kể cả cấp cha), chỉ đọc InventoryBalance.quantityOnHand. */
const getCapacitySnapshot = async (locationId, session) => {
  const [location, storages, balances] = await Promise.all([
    InventoryLocation.findById(locationId).session(session).lean(),
    StorageLocation.find({ locationId }).select('_id parentStorageId maxCapacity').session(session).lean(),
    InventoryBalance.find({ locationId }).select('storageId quantityOnHand').session(session).lean(),
  ]);
  const storageById = new Map(storages.map((storage) => [String(storage._id), storage]));
  const usedByStorage = new Map();
  let used = 0;
  for (const row of balances) {
    const amount = Math.max(0, row.quantityOnHand || 0);
    used += amount;
    if (row.storageId) addToStorageChain(usedByStorage, storageById, String(row.storageId), amount);
  }
  return { location, storageById, usedByStorage, used };
};

/** Sau điều chỉnh, toàn kho và từng kệ không được vượt sức chứa tối đa. */
const assertCapacity = (snapshot, adjustmentDetails) => {
  const projectedByStorage = new Map(snapshot.usedByStorage);
  let projectedLocation = snapshot.used;
  for (const detail of adjustmentDetails) {
    projectedLocation += detail.quantityChange;
    if (detail.storageId) addToStorageChain(projectedByStorage, snapshot.storageById, String(detail.storageId), detail.quantityChange);
  }
  if (snapshot.location?.maxCapacity != null && projectedLocation > snapshot.location.maxCapacity) {
    throw appError('Điều chỉnh vượt sức chứa tối đa của kho.', 409);
  }
  for (const [id, projected] of projectedByStorage) {
    const storage = snapshot.storageById.get(id);
    if (storage?.maxCapacity != null && projected > storage.maxCapacity) {
      throw appError(`Điều chỉnh vượt sức chứa vị trí ${id}.`, 409);
    }
  }
};

/**
 * Mã cho món lạ phát hiện khi kiểm kê: dùng mã đã nhập, không có thì sinh `<SKU>-<4 số>` (TASK-015).
 */
const itemCodeForFoundItem = async (detail, session) => {
  if (detail.itemCode) return detail.itemCode;
  const variant = await ProductVariant.findById(detail.variantId).select('sku').session(session).lean();
  const [code] = await generateItemCodes(variant?.sku, 1, session);
  return code;
};

/** Món thiếu → disposed; món thừa → tạo món mới qua itemStateService. Trả về id món để ghi sổ. */
const applyItemAdjustment = async (adjustment, detail, session) => {
  if (detail.itemId && detail.quantityChange === -1) {
    const item = await InventoryItem.findOne({
      _id: detail.itemId, locationId: adjustment.locationId, storageId: detail.storageId || null,
      status: { $nin: NOT_IN_STOCK_STATUSES },
    }).session(session);
    if (!item) throw appError('Mã hàng cá thể đã thay đổi vị trí/trạng thái sau khi duyệt. Tạo lại phiếu kiểm kê.', 409);
    if (item.status === 'reserved') {
      throw appError(`Món ${item.itemCode} đang được giữ cho phiếu kho hoặc đơn hàng. Hãy nhả giữ trước khi áp dụng điều chỉnh.`, 409);
    }
    const change = { status: 'disposed' };
    if (detail.itemCondition) change.condition = detail.itemCondition;
    await moveItem(item, change, session);
    return detail.itemId;
  }
  if (!detail.itemId && detail.quantityChange > 0) {
    if (detail.quantityChange !== 1) throw appError('Mỗi dòng điều chỉnh tăng chỉ tạo một món mới.');
    if (detail.itemStatus === 'reserved') throw appError('Không thể tạo món mới ở trạng thái giữ chỗ.', 409);
    const [createdItem] = await createItems([{
      variantId: detail.variantId,
      locationId: adjustment.locationId,
      storageId: detail.storageId || null,
      itemCode: await itemCodeForFoundItem(detail, session),
      serialNumber: detail.serialNumber || undefined,
      condition: detail.itemCondition || 'new',
      status: detail.itemStatus || 'available',
    }], session);
    return createdItem._id;
  }
  if (detail.quantityChange !== 0) throw appError('Chênh lệch cá thể phải là một mã hàng cụ thể.');
  return detail.itemId || null;
};

/** Cập nhật cờ hết hàng của sản phẩm sau khi áp dụng điều chỉnh; không chặn nghiệp vụ. */
const refreshStockStatusAfterAdjustment = async (adjustmentId) => {
  // TASK-012: Điều chỉnh kho → tồn thay đổi → kiểm tra lại hết hàng
  try {
    const adj = await StockAdjustment.findById(adjustmentId).select('_id').lean();
    if (!adj) return;
    const details = await StockAdjustmentDetail.find({ adjustmentId: adj._id }).select('variantId').lean();
    const variantIds = [...new Set(details.map((d) => String(d.variantId)).filter(Boolean))];
    if (!variantIds.length) return;
    const pvs = await ProductVariant.find({ _id: { $in: variantIds } }).select('productId').lean();
    const productIds = [...new Set(pvs.map((v) => String(v.productId)).filter(Boolean))];
    if (!productIds.length) return;
    refreshOutOfStockStatus(productIds).catch((err) => console.error('[TASK-012] stock adjustment refresh lỗi:', err.message));
  } catch (_) { /* non-blocking */ }
};

/** Quản lý áp dụng phiếu điều chỉnh đã duyệt: đổi trạng thái / tạo món theo từng dòng và ghi sổ biến động `adjustment`. */
export const applyStockAdjustment = async (adjustmentId, user) => {
  if (!isManager(user)) throw appError('Chỉ quản lý kho mới được áp dụng điều chỉnh.', 403);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const adjustment = await StockAdjustment.findOne({ _id: adjustmentId, status: ADJUSTMENT_STATUS.APPROVED })
        .session(session);
      if (!adjustment) throw appError('Phiếu điều chỉnh chưa được duyệt hoặc đã được áp dụng.', 409);
      const details = await StockAdjustmentDetail.find({ adjustmentId }).session(session);
      assertCapacity(await getCapacitySnapshot(adjustment.locationId, session), details);
      for (const detail of details) {
        if (detail.quantityAfter < 0 || detail.quantityAfter !== detail.quantityBefore + detail.quantityChange) {
          throw appError('Dữ liệu số lượng điều chỉnh không hợp lệ.');
        }
        const movementItemId = await applyItemAdjustment(adjustment, detail, session);
        await recordStockMovement({
          variantId: detail.variantId,
          itemId: movementItemId,
          locationId: adjustment.locationId,
          storageId: detail.storageId || null,
          movementType: 'adjustment',
          quantityChange: detail.quantityChange,
          referenceType: 'stock_adjustment',
          referenceId: adjustment._id,
          createdBy: user._id,
        }, session);
      }
      adjustment.status = ADJUSTMENT_STATUS.APPLIED;
      await adjustment.save({ session });
    });
  } finally {
    await session.endSession();
  }
  await refreshStockStatusAfterAdjustment(adjustmentId);
  return getStockAdjustment(adjustmentId);
};
