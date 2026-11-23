// Kiểm kê (Stocktake) và điều chỉnh tồn (StockAdjustment) tại kho tổng.
// Kiểm kê:    draft → in_progress → counted → approved   (draft / in_progress / counted có thể bị cancelled).
// Điều chỉnh: requested → approved | rejected; approved → applied.
// Ai làm bước nào:
// - Quản lý kho: tạo phiếu kiểm kê + giao nhân viên, bắt đầu (chụp trạng thái + kệ từng món), duyệt = áp dụng, hủy kiểm kê.
// - Nhân viên kho được giao (hoặc quản lý): ghi kết quả theo món (mặc định "Có mặt – dùng được"), gửi kết quả.
// TASK-016: duyệt áp dụng ngay theo bảng B3 (stocktakeApplyRules.js), dòng có món đã đổi sau lúc bắt đầu bị bỏ qua.
// Kiểm kê KHÔNG sinh phiếu điều chỉnh nữa; StockAdjustment chỉ còn cho phiếu cũ (xem / duyệt / áp dụng).
import mongoose from 'mongoose';
import { refreshOutOfStockStatus } from './productStockStatusService.js';
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
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
import {
  NOT_IN_STOCK_STATUSES, OUTCOMES, capacityDeltasOf, capacityViolations, planStocktakeLine, snapshotOf, summarizeOutcomes,
} from './stocktakeApplyRules.js';
import { StockRelocation } from '../../models/warehouse/transfer/StockRelocation.js';
import { StockRelocationDetail } from '../../models/warehouse/transfer/StockRelocationDetail.js';
import { createNotification } from '../system/notificationService.js';
import { appError } from './shared/errors.js';
import { WAREHOUSE_STAFF_ROLE_PATTERN, isWarehouseManagerOrAdmin, isWarehouseStaff } from './shared/roles.js';
import { addToStorageChain, capacitySnapshot } from './shared/capacity.js';
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
  .populate('itemId', 'itemCode serialNumber status locationId storageId')
  .populate('storageId', 'code name type')
  .populate('foundStorageId', 'code name type')
  .populate('storageAtStart', 'code name type');

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
  const items = await findStocktakeDetails([id]);
  const summary = stocktake.status === 'approved' ? summarizeOutcomes(items) : null;
  return { ...stocktake.toObject(), items, summary };
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

/** Chụp số hệ thống: mỗi món còn trong kho (trong phạm vi) một dòng, kèm ảnh chụp trạng thái / kệ lúc bắt đầu. */
const buildSnapshotRows = async (stocktake, scopeFilter, session) => {
  const items = await InventoryItem.find({ locationId: stocktake.locationId, status: { $nin: NOT_IN_STOCK_STATUSES }, ...scopeFilter })
    .session(session).lean();
  return items.map((item) => ({
    stocktakeId: stocktake._id, variantId: item.variantId, itemId: item._id, storageId: item.storageId,
    systemQuantity: 1, countedQuantity: 0, isCounted: false, ...snapshotOf(item),
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

/** Quản lý bắt đầu kiểm kê: chụp trạng thái + kệ từng món vào chi tiết phiếu. Không khóa tồn. */
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

const assertCanCount = (stocktake, user, noPermissionMessage) => {
  if (isStaff(user) && String(stocktake.assignedStaffId || '') !== String(user._id)) {
    throw appError(STAFF_NOT_ASSIGNED_MESSAGE, 403);
  }
  if (!isStaff(user) && !isManager(user)) throw appError(noPermissionMessage, 403);
};

/**
 * Ghi kết quả cho một dòng có sẵn (TASK-016 B2): `countedResult` ok / needs_service / not_found, kệ thực tế tùy chọn.
 * Dòng món lạ (`isExtra`) ghi "not_found" = bỏ ghi nhận (xóa dòng).
 */
const applyCountToDetail = async ({ detail, line, storageIds, user, timestamp }) => {
  const result = line.countedResult;
  if (detail.isExtra && result === 'not_found') {
    await StocktakeDetail.deleteOne({ _id: detail._id, isExtra: true });
    return;
  }
  const foundStorageId = line.foundStorageId ? String(line.foundStorageId) : null;
  if (foundStorageId && !storageIds.has(foundStorageId)) throw appError('Kệ thực tế không thuộc kho hoặc không hoạt động.');
  detail.countedResult = result;
  if (!detail.isExtra) detail.foundStorageId = result === 'not_found' ? null : foundStorageId;
  detail.countedQuantity = result === 'not_found' ? 0 : 1;
  detail.note = String(line.note || '').trim();
  detail.countedBy = user._id;
  detail.countedAt = timestamp;
  detail.isCounted = true;
  await detail.save();
};

/** Kệ đang kiểm của món lạ phải là kệ đang hoạt động trong phạm vi phiếu. */
const assertShelfInScope = async (stocktake, storageId) => {
  if (!idValid(storageId)) throw appError('Chọn kệ đang kiểm cho món lạ.');
  const storageOk = await StorageLocation.exists({ _id: storageId, locationId: stocktake.locationId, status: 'active' });
  if (!storageOk) throw appError('Vị trí lưu trữ không thuộc kho hoặc không hoạt động.');
  if (!stocktake.storageIds?.length) return;
  const { expanded } = await storageScope(stocktake.locationId, stocktake.storageIds.map(String));
  if (!isStorageInScope(storageId, expanded)) throw appError('Kệ của món lạ nằm ngoài phạm vi kiểm kê.');
};

/** Món mới (mã chưa có) phải thuộc phạm vi sản phẩm của phiếu và biến thể còn hoạt động. */
const assertVariantInScope = (stocktake, variant, variantId) => {
  if (!variant || variant.status !== 'active') throw appError('Biến thể của món mới không hợp lệ hoặc đã ngừng hoạt động.');
  if (!hasProductScopeOf(stocktake)) return;
  const allowedByVariant = (stocktake.variantIds || []).some((id) => String(id) === variantId);
  const allowedByProduct = (stocktake.productIds || []).some((id) => String(id) === String(variant.productId?._id || variant.productId));
  if (!allowedByVariant && !allowedByProduct) throw appError('Biến thể của món mới nằm ngoài phạm vi kiểm kê.');
};

const extraResult = (entry) => (entry.countedResult === 'needs_service' ? 'needs_service' : 'ok');

/**
 * Món lạ có mã trong hệ thống: món đã có dòng trong phiếu → ghi "có mặt" ở kệ đang kiểm;
 * chưa có dòng → thêm dòng `isExtra` cho món đó (ảnh chụp trạng thái lấy lúc ghi nhận).
 */
const recordKnownExtra = async ({ stocktake, item, storageId, entry, user, timestamp }) => {
  const counted = {
    countedResult: extraResult(entry), countedQuantity: 1, countedBy: user._id, countedAt: timestamp, isCounted: true,
    note: String(entry.note || '').trim(),
  };
  const existing = await StocktakeDetail.findOne({ stocktakeId: stocktake._id, itemId: item._id });
  if (existing) {
    Object.assign(existing, counted, { foundStorageId: storageId });
    if (existing.isExtra) existing.storageId = storageId;
    await existing.save();
    return;
  }
  await StocktakeDetail.create({
    stocktakeId: stocktake._id, variantId: item.variantId, itemId: item._id, storageId, foundStorageId: storageId,
    systemQuantity: 0, isExtra: true, ...snapshotOf(item), ...counted,
  });
};

/** Món mới (mã chưa tồn tại): lưu biến thể + mã nhập tay (nếu có); món được tạo lúc duyệt. */
const recordNewExtra = async ({ stocktake, entry, code, storageId, variants, user, timestamp }) => {
  const variantId = String(entry.variantId || '');
  if (!idValid(variantId)) throw appError(`Mã ${code || '(trống)'} chưa có trong hệ thống: chọn biến thể để tạo món mới.`);
  assertVariantInScope(stocktake, variants.find((row) => String(row._id) === variantId), variantId);
  if (code && await StocktakeDetail.exists({ stocktakeId: stocktake._id, countedItemCode: code })) {
    throw appError(`Mã hàng ${code} đã được ghi nhận trong phiếu.`);
  }
  await StocktakeDetail.create({
    stocktakeId: stocktake._id, variantId, itemId: null, storageId, foundStorageId: storageId,
    systemQuantity: 0, countedQuantity: 1, isExtra: true, countedResult: extraResult(entry),
    countedBy: user._id, countedAt: timestamp, isCounted: true,
    countedItemCode: code || null,
    countedSerialNumber: String(entry.serialNumber || '').trim() || null,
    note: String(entry.note || '').trim(),
  });
};

/** Ghi một món lạ gặp trên kệ mà không có trong danh sách (dùng lại luồng `newItems`). */
const recordFoundExtra = async ({ stocktake, entry, variants, user, timestamp }) => {
  const storageId = entry.storageId ? String(entry.storageId) : '';
  await assertShelfInScope(stocktake, storageId);
  const code = String(entry.itemCode || '').trim();
  if (code.length > 100) throw appError('Mã hàng tối đa 100 ký tự.');
  const item = code ? await InventoryItem.findOne({ itemCode: code }).lean() : null;
  if (item) {
    await recordKnownExtra({ stocktake, item, storageId, entry, user, timestamp });
    return;
  }
  await recordNewExtra({ stocktake, entry, code, storageId, variants, user, timestamp });
};

/** Nhân viên ghi kết quả theo món và các món lạ phát hiện thêm. Có thể ghi nhiều lần. */
export const recordStocktakeCounts = async (stocktakeId, payload, user) => {
  const stocktake = await Stocktake.findById(stocktakeId);
  if (!stocktake || stocktake.status !== STOCKTAKE_STATUS.IN_PROGRESS) {
    throw appError('Phiếu kiểm kê không còn nhận số đếm.', 409);
  }
  assertCanCount(stocktake, user, 'Bạn không có quyền ghi nhận kiểm kê.');
  const { items: lines, newItems } = validateStocktakeCountInput(payload);
  const details = await StocktakeDetail.find({ stocktakeId });
  const detailById = new Map(details.map((detail) => [String(detail._id), detail]));
  const activeStorageIds = await StorageLocation.find({ locationId: stocktake.locationId, status: 'active' }).distinct('_id');
  const storageIds = new Set(activeStorageIds.map(String));
  const variantIds = [...new Set(newItems.map((item) => String(item.variantId || '')))].filter(idValid);
  const variants = variantIds.length ? await ProductVariant.find({ _id: { $in: variantIds } }).select('productId status').lean() : [];
  const timestamp = new Date();
  for (const line of lines) {
    const detail = detailById.get(String(line.detailId || ''));
    if (!detail) throw appError('Có dòng đếm không thuộc phiếu kiểm kê này.');
    await applyCountToDetail({ detail, line, storageIds, user, timestamp });
  }
  for (const entry of newItems) {
    await recordFoundExtra({ stocktake, entry, variants, user, timestamp });
  }
  return loadStocktake(stocktakeId, user);
};

/** Gửi kết quả kiểm kê cho quản lý duyệt; mọi dòng phải đã có kết quả. */
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

/* ------------------------------ Duyệt = áp dụng (TASK-016 B3) ------------------------------ */

const OPEN_RELOCATION_STATUSES = ['assigned', 'in_progress'];

/**
 * Món `reserved` ở kho tổng chỉ do phiếu di chuyển kệ giữ: bỏ món khỏi dòng phiếu (giảm số lượng; dòng hết món thì xóa,
 * phiếu hết dòng thì tự hủy). Trả về thông tin để báo nhân viên / quản lý phụ trách chọn món khác.
 */
const releaseFromHoldingSlip = async (item, stocktake, session) => {
  const rows = await StockRelocationDetail.find({ itemIds: item._id }).session(session);
  const relocations = rows.length
    ? await StockRelocation.find({ _id: { $in: rows.map((row) => row.relocationId) }, status: { $in: OPEN_RELOCATION_STATUSES } }).session(session)
    : [];
  const relocation = relocations[0];
  const row = relocation && rows.find((line) => String(line.relocationId) === String(relocation._id));
  if (!row) throw appError(`Món ${item.itemCode} đang giữ nhưng không tìm thấy phiếu kho đang giữ; báo quản lý kho đối soát tồn.`, 409);
  if (row.quantity <= 1) await StockRelocationDetail.deleteOne({ _id: row._id }, { session });
  else await StockRelocationDetail.updateOne({ _id: row._id }, { $pull: { itemIds: item._id }, $inc: { quantity: -1 } }, { session });
  const remaining = await StockRelocationDetail.countDocuments({ relocationId: relocation._id }).session(session);
  if (!remaining) {
    relocation.status = 'cancelled';
    relocation.cancelledAt = new Date();
    relocation.note = [relocation.note, `Tự hủy: món cuối cùng bị bỏ ra khi duyệt kiểm kê ${stocktake.stocktakeCode}.`].filter(Boolean).join('\n');
    await relocation.save({ session });
  }
  return {
    userIds: [relocation.assignedStaffId, relocation.createdBy].filter(Boolean).map(String),
    relocationId: relocation._id, relocationCode: relocation.relocationCode, itemCode: item.itemCode, cancelled: !remaining,
  };
};

/** Báo cho người phụ trách phiếu di chuyển kệ (sau khi commit, không chặn nghiệp vụ). */
const notifyReleasedHolds = async (releases, stocktakeCode) => {
  for (const release of releases) {
    const message = release.cancelled
      ? `Kiểm kê ${stocktakeCode}: món ${release.itemCode} cần xử lý nên đã bỏ khỏi phiếu ${release.relocationCode}; phiếu không còn món nên đã tự hủy.`
      : `Kiểm kê ${stocktakeCode}: món ${release.itemCode} cần xử lý nên đã bỏ khỏi phiếu ${release.relocationCode}. Vui lòng chọn món khác nếu cần.`;
    for (const userId of new Set(release.userIds)) {
      await createNotification({
        userId, title: 'Món bị bỏ khỏi phiếu di chuyển kệ', message, type: 'system',
        referenceType: 'StockRelocation', referenceId: release.relocationId,
      });
    }
  }
};

const stocktakeMovement = (stocktake, detail, user, extra) => ({
  variantId: detail.variantId, locationId: stocktake.locationId,
  referenceType: 'stocktake', referenceId: stocktake._id, createdBy: user._id, ...extra,
});

/** Mã cho món mới phát hiện khi kiểm kê: dùng mã đã nhập, không có thì sinh `<SKU>-<4 số>` (TASK-015). */
const itemCodeForNewItem = async (detail, session) => {
  if (detail.countedItemCode) {
    if (await InventoryItem.exists({ itemCode: detail.countedItemCode }).session(session)) {
      throw appError(`Mã hàng ${detail.countedItemCode} đã tồn tại; hãy ghi lại món đó như món có mã trong hệ thống.`, 409);
    }
    return detail.countedItemCode;
  }
  const variant = await ProductVariant.findById(detail.variantId).select('sku').session(session).lean();
  const [code] = await generateItemCodes(variant?.sku, 1, session);
  return code;
};

/** Ghi DB cho một dòng theo kế hoạch (đổi món qua itemStateService + sổ biến động). Trả về thông tin nhả giữ (nếu có). */
const applyStocktakePlan = async ({ stocktake, detail, item, plan, user, session }) => {
  const movement = (extra) => recordStockMovement(stocktakeMovement(stocktake, detail, user, extra), session);
  if (plan.outcome === OUTCOMES.CREATED) {
    const [created] = await createItems([{
      variantId: detail.variantId, locationId: stocktake.locationId, storageId: plan.toStorageId,
      itemCode: await itemCodeForNewItem(detail, session),
      serialNumber: detail.countedSerialNumber || undefined, status: plan.status,
    }], session);
    detail.itemId = created._id;
    await movement({ itemId: created._id, storageId: plan.toStorageId, movementType: 'adjustment', quantityChange: 1 });
    return null;
  }
  if (!plan.change) return null;
  const release = plan.releaseHold ? await releaseFromHoldingSlip(item, stocktake, session) : null;
  await moveItem(item, plan.change, session);
  if (plan.outcome === OUTCOMES.LOST) {
    await movement({ itemId: item._id, storageId: plan.fromStorageId, movementType: 'adjustment', quantityChange: -1 });
  } else if (plan.outcome === OUTCOMES.FOUND) {
    await movement({ itemId: item._id, storageId: plan.toStorageId, movementType: 'adjustment', quantityChange: 1 });
  } else if (plan.moved) {
    await movement({ itemId: item._id, storageId: plan.fromStorageId, movementType: 'transfer_out', quantityChange: -1 });
    await movement({ itemId: item._id, storageId: plan.toStorageId, movementType: 'transfer_in', quantityChange: 1 });
  }
  return release;
};

/** Vượt sức chứa ở kệ / khu / kho nhận thêm hàng → 409, không duyệt. */
const assertStocktakeCapacity = async (stocktake, plans, session) => {
  const snapshot = await capacitySnapshot(stocktake.locationId, session, null);
  const violations = capacityViolations(snapshot, capacityDeltasOf(plans));
  if (!violations.length) return;
  const text = violations.map((row) => `${row.code} (${row.projected}/${row.maxCapacity})`).join(', ');
  throw appError(`Không duyệt được: vượt sức chứa tại ${text}. Hãy chọn kệ khác cho các món chuyển kệ / món lạ.`, 409);
};

/** Cập nhật cờ hết hàng của sản phẩm sau khi tồn đổi; không chặn nghiệp vụ. */
const refreshStockStatusForVariants = async (variantIds) => {
  try {
    if (!variantIds?.length) return;
    const variants = await ProductVariant.find({ _id: { $in: variantIds } }).select('productId').lean();
    const productIds = [...new Set(variants.map((variant) => String(variant.productId)).filter(Boolean))];
    if (!productIds.length) return;
    refreshOutOfStockStatus(productIds).catch((err) => console.error('[TASK-012] stocktake refresh lỗi:', err.message));
  } catch (_) { /* non-blocking */ }
};

/**
 * Quản lý duyệt kết quả kiểm kê = áp dụng ngay trong một transaction (TASK-016 B3). Không sinh phiếu điều chỉnh.
 * Dòng có món đã đổi sau lúc bắt đầu kiểm bị bỏ qua (`skippedReason`). Trả về { stocktake, summary, adjustment: null }.
 */
export const approveStocktake = async (stocktakeId, user) => {
  if (!isManager(user)) throw appError('Chỉ quản lý kho mới được duyệt kiểm kê.', 403);
  if (!idValid(stocktakeId)) throw appError('Mã phiếu kiểm kê không hợp lệ.');
  const session = await mongoose.startSession();
  let releases = [];
  let stocktakeCode = '';
  let changedVariantIds = [];
  try {
    await session.withTransaction(async () => {
      releases = [];
      // Giành trạng thái ngay đầu transaction để duyệt và hủy loại trừ nhau.
      const stocktake = await Stocktake.findOneAndUpdate(
        { _id: stocktakeId, status: STOCKTAKE_STATUS.COUNTED },
        { $set: { status: STOCKTAKE_STATUS.APPROVED, approvedBy: user._id } },
        { new: true, session },
      );
      if (!stocktake) throw appError('Phiếu kiểm kê chưa gửi kết quả, đã được xử lý hoặc đã bị hủy.', 409);
      stocktakeCode = stocktake.stocktakeCode;
      const details = await StocktakeDetail.find({ stocktakeId }).sort({ createdAt: 1, _id: 1 }).session(session);
      if (details.some((detail) => !detail.isCounted)) throw appError('Tất cả dòng phải được kiểm đếm trước khi duyệt.');
      const itemIds = details.map((detail) => detail.itemId).filter(Boolean);
      const items = await InventoryItem.find({ _id: { $in: itemIds } }).session(session);
      const itemById = new Map(items.map((item) => [String(item._id), item]));
      const itemOf = (detail) => (detail.itemId ? itemById.get(String(detail.itemId)) || null : null);
      const plans = details.map((detail) => planStocktakeLine(detail, itemOf(detail), { locationId: stocktake.locationId }));
      await assertStocktakeCapacity(stocktake, plans, session);
      for (let index = 0; index < details.length; index += 1) {
        const detail = details[index];
        const plan = plans[index];
        if (plan.outcome !== OUTCOMES.SKIPPED) {
          const release = await applyStocktakePlan({ stocktake, detail, item: itemOf(detail), plan, user, session });
          if (release) releases.push(release);
        }
        detail.appliedOutcome = plan.outcome;
        detail.skippedReason = plan.skippedReason || null;
        await detail.save({ session });
      }
      const changed = details.filter((_, index) => ![OUTCOMES.SKIPPED, OUTCOMES.UNCHANGED].includes(plans[index].outcome));
      changedVariantIds = [...new Set(changed.map((detail) => String(detail.variantId)))];
    });
  } finally {
    await session.endSession();
  }
  await notifyReleasedHolds(releases, stocktakeCode).catch((error) => console.error('[TASK-016] thông báo kiểm kê lỗi:', error.message));
  await refreshStockStatusForVariants(changedVariantIds);
  const stocktake = await loadStocktake(stocktakeId, user);
  return { stocktake, summary: stocktake.summary, adjustment: null };
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

/** Phiếu điều chỉnh cũ: món thiếu → lost (TASK-016); món thừa → tạo món mới qua itemStateService. Trả về id món để ghi sổ. */
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
    await moveItem(item, { status: 'lost' }, session);
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
