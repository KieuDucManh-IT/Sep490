// TASK-011 — Đọc số lượng tồn dùng chung cho mọi màn (kho, chi nhánh, khách) và mọi loại hàng (quantity + individual).
// Nguồn duy nhất là InventoryBalance; công thức khả dụng chỉ viết ở đây:
//   khả dụng = max(0, quantityOnHand − quantityReserved − quantityUnavailable)   (quantityRenting không tham gia)
// InventoryItem chỉ đọc ở chỗ chọn/liệt kê từng món; nếu chọn không đủ món so với balance → stockMismatchError (409).
import { InventoryBalance } from '../../models/warehouse/inventory/InventoryBalance.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';

const num = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
const idOf = (value) => String(value?._id || value || '');

/* ------------------------------------------------ Hàm thuần ------------------------------------------------ */

/** Khả dụng của một dòng balance. */
export const availableOf = (row) => Math.max(0, num(row?.quantityOnHand) - num(row?.quantityReserved) - num(row?.quantityUnavailable));

/** Σ khả dụng các dòng (mỗi dòng tự chặn 0, như giữ chỗ nguyên tử theo từng dòng). */
export const sumAvailable = (rows = []) => (rows || []).reduce((sum, row) => sum + availableOf(row), 0);

/** Σ onHand các dòng (dùng cho sức chứa / itemCount; không gồm renting). */
export const sumOnHand = (rows = []) => (rows || []).reduce((sum, row) => sum + num(row?.quantityOnHand), 0);

/**
 * Gom balance theo biến thể → địa điểm:
 * `{ [variantId]: { total, byLocation: { [locationId]: { onHand, reserved, unavailable, available, renting } } } }`.
 * `total` = Σ available của mọi địa điểm có trong `rows` (người gọi tự lọc địa điểm trước).
 */
export const sumByVariantLocation = (rows = []) => {
  const result = {};
  for (const row of rows || []) {
    const variantId = idOf(row?.variantId);
    const locationId = idOf(row?.locationId);
    if (!variantId || !locationId) continue;
    result[variantId] ??= { total: 0, byLocation: {} };
    const entry = result[variantId];
    entry.byLocation[locationId] ??= { onHand: 0, reserved: 0, unavailable: 0, available: 0, renting: 0 };
    const cell = entry.byLocation[locationId];
    const available = availableOf(row);
    cell.onHand += num(row.quantityOnHand);
    cell.reserved += num(row.quantityReserved);
    cell.unavailable += num(row.quantityUnavailable);
    cell.renting += num(row.quantityRenting);
    cell.available += available;
    entry.total += available;
  }
  return result;
};

/** Lỗi 409 khi số món chọn được khác số trên balance (dữ liệu lệch). Có ghi log cảnh báo kèm locationId/variantId. */
export const stockMismatchError = ({ locationId, storageId = null, variantId, expected, found, context = '' } = {}) => {
  console.warn('[TASK-011] Lệch tồn kho món/balance', {
    context, locationId: idOf(locationId), storageId: storageId ? idOf(storageId) : null, variantId: idOf(variantId), balanceAvailable: expected, itemsFound: found,
  });
  return Object.assign(new Error('Dữ liệu tồn kho chưa khớp, vui lòng báo quản lý kho'), {
    statusCode: 409, status: 409, code: 'ERR_STOCK_MISMATCH', details: { locationId: idOf(locationId), variantId: idOf(variantId), expected, found },
  });
};

/** Dựng filter Mongo cho InventoryBalance từ danh sách id (bỏ qua tham số rỗng). `storageIds` có thể chứa null. */
export const balanceFilter = ({ locationIds, variantIds, storageIds } = {}) => {
  const filter = {};
  if (Array.isArray(locationIds)) filter.locationId = { $in: locationIds };
  if (Array.isArray(variantIds)) filter.variantId = { $in: variantIds };
  if (Array.isArray(storageIds)) filter.storageId = { $in: storageIds };
  return filter;
};

/* ------------------------------------------------ Đọc DB ------------------------------------------------ */

/**
 * Đọc các dòng balance (lean). `locationType` (warehouse|store) lọc thêm theo InventoryLocation.type, chỉ địa điểm active.
 * Mảng rỗng truyền vào nghĩa là "không có id nào" → trả [].
 */
export const getBalances = async ({ locationIds, variantIds, storageIds, locationType } = {}, session = null) => {
  if ([locationIds, variantIds, storageIds].some((list) => Array.isArray(list) && !list.length)) return [];
  let ids = locationIds;
  if (locationType) {
    const locationQuery = InventoryLocation.find({ type: locationType, status: 'active', ...(Array.isArray(locationIds) ? { _id: { $in: locationIds } } : {}) }).select('_id');
    if (session) locationQuery.session(session);
    ids = (await locationQuery.lean()).map((row) => row._id);
    if (!ids.length) return [];
  }
  const query = InventoryBalance.find(balanceFilter({ locationIds: ids, variantIds, storageIds }));
  if (session) query.session(session);
  return query.lean();
};

/** Khả dụng của một biến thể tại một địa điểm (mọi kệ, hoặc chỉ `storageIds`). */
export const getAvailable = async ({ locationId, variantId, storageIds } = {}, session = null) =>
  sumAvailable(await getBalances({ locationIds: [locationId], variantIds: [variantId], storageIds }, session));
