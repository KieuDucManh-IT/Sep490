// TASK-011 — Hàm thuần gom báo cáo tồn kho từ InventoryBalance (không truy vấn DB, có unit test).
// Mọi sản phẩm (quản lý theo món, TASK-015) lấy số từ balance; "Đang cho thuê" = balance.quantityRenting;
// "Quá hạn trả" tính lúc đọc (RentalOrderItem handed_over của đơn quá dueDate) và gắn vào dòng storageId null.
import { availableOf } from './balanceQueryService.js';

const num = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
const idOf = (value) => String(value?._id || value || '');
export const reportKey = (locationId, storageId, variantId) => `${idOf(locationId)}:${storageId ? idOf(storageId) : 'none'}:${idOf(variantId)}`;
export const EMPTY_SUMMARY = Object.freeze({ totalOnHand: 0, totalAvailable: 0, totalReserved: 0, totalUnavailable: 0, totalRenting: 0, totalOverdue: 0 });
const QUANTITY_FIELDS = ['quantityOnHand', 'quantityAvailable', 'quantityReserved', 'quantityUnavailable', 'quantityRenting', 'quantityOverdue'];

export const categoryNamesForProduct = (product) => {
  const categories = Array.isArray(product?.categoryId) ? product.categoryId : product?.categoryId ? [product.categoryId] : [];
  return categories.map((category) => category?.name).filter(Boolean).join(', ');
};

export const storageNodeAtLevel = (storageId, level, storageById) => {
  if (!storageId) return null;
  let cursor = storageById.get(String(storageId));
  const fallback = cursor || null;
  const visited = new Set();
  while (cursor && !visited.has(String(cursor._id))) {
    visited.add(String(cursor._id));
    if (cursor.type === level || cursor.type === 'temporary_area') return cursor;
    cursor = cursor.parentStorageId ? storageById.get(String(cursor.parentStorageId)) : null;
  }
  return fallback;
};

export const storagePathFor = (storageId, storageById) => {
  if (!storageId) return 'Chưa gán vị trí';
  const parts = [];
  const visited = new Set();
  let cursor = storageById.get(String(storageId));
  while (cursor && !visited.has(String(cursor._id))) {
    visited.add(String(cursor._id));
    parts.unshift(cursor.code || cursor.name);
    cursor = cursor.parentStorageId ? storageById.get(String(cursor.parentStorageId)) : null;
  }
  return parts.length ? parts.join(' / ') : 'Không tìm thấy vị trí';
};

/**
 * Dòng cơ sở (location, kệ, biến thể) từ balance.
 * - `overdue`: [{ locationId, variantId, quantity }] → cộng vào dòng `storageId: null` (nơi ghi quantityRenting).
 * - `itemCount` = quantityOnHand của balance (mọi sản phẩm quản lý theo món, TASK-015) — không đếm món.
 */
export const buildBalanceReportRows = ({ balances = [], overdue = [], variantById, locationById, storageById = new Map() }) => {
  const rows = new Map();
  const ensureRow = (location, storageId, variant) => {
    const key = reportKey(location._id, storageId, variant._id);
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        locationId: location._id,
        locationCode: location.code,
        locationName: location.name,
        locationType: location.type,
        managerName: location.managerId?.FullName || '',
        storageId: storageId || null,
        storagePath: storagePathFor(storageId, storageById),
        productCode: variant.productId?.productCode || '',
        productName: variant.productId?.name || 'Sản phẩm đã xóa',
        categoryName: categoryNamesForProduct(variant.productId),
        productId: variant.productId?._id || variant.productId || null,
        variantId: variant._id,
        sku: variant.sku,
        size: variant.size || '',
        color: variant.color || '',
        itemCode: '',
        serialNumber: '',
        itemStatus: '',
        itemCount: 0,
        quantityOnHand: 0,
        quantityAvailable: 0,
        quantityReserved: 0,
        quantityUnavailable: 0,
        quantityRenting: 0,
        quantityOverdue: 0,
      });
    }
    return rows.get(key);
  };
  const resolve = (row) => {
    const variant = variantById.get(idOf(row.variantId));
    const location = locationById.get(idOf(row.locationId));
    return variant && location ? { variant, location } : null;
  };
  for (const balance of balances) {
    const found = resolve(balance);
    if (!found) continue;
    const row = ensureRow(found.location, balance.storageId, found.variant);
    row.quantityOnHand += num(balance.quantityOnHand);
    row.quantityReserved += num(balance.quantityReserved);
    row.quantityUnavailable += num(balance.quantityUnavailable);
    row.quantityRenting += num(balance.quantityRenting);
    row.quantityAvailable += availableOf(balance);
  }
  for (const entry of overdue) {
    const found = resolve(entry);
    if (!found || !num(entry.quantity)) continue;
    ensureRow(found.location, null, found.variant).quantityOverdue += num(entry.quantity);
  }
  for (const row of rows.values()) row.itemCount = row.quantityOnHand;
  return [...rows.values()];
};

/** Gom dòng cơ sở theo cấp vị trí (zone/row/shelf) và cấp mặt hàng (product/variant), lọc dòng trống, sắp xếp. */
export const rollupReportRows = (baseRows, { storageLevel = 'shelf', itemLevel = 'variant', storageById = new Map() } = {}) => {
  const rollups = new Map();
  for (const source of baseRows) {
    const storage = storageNodeAtLevel(source.storageId, storageLevel, storageById);
    const dimensionId = itemLevel === 'product' ? source.productId : source.variantId;
    const key = `${source.locationId}:${storage?._id || 'none'}:${dimensionId || 'unknown'}`;
    if (!rollups.has(key)) {
      rollups.set(key, {
        ...source,
        key,
        itemLevel,
        storageLevel,
        storageId: storage?._id || null,
        storagePath: storagePathFor(storage?._id, storageById),
        sku: itemLevel === 'product' ? '' : source.sku,
        size: itemLevel === 'product' ? '' : source.size,
        color: itemLevel === 'product' ? '' : source.color,
        variantId: itemLevel === 'product' ? null : source.variantId,
        itemCount: 0,
        ...Object.fromEntries(QUANTITY_FIELDS.map((field) => [field, 0])),
      });
    }
    const row = rollups.get(key);
    for (const field of QUANTITY_FIELDS) row[field] += source[field] || 0;
    row.itemCount += source.itemCount || 0;
  }
  return [...rollups.values()]
    .filter((row) => row.quantityOnHand > 0 || row.quantityReserved > 0 || row.quantityUnavailable > 0 || row.quantityRenting > 0 || row.quantityOverdue > 0)
    .sort((a, b) => `${a.locationCode} ${a.storagePath} ${a.productName} ${a.sku} ${a.key}`.localeCompare(`${b.locationCode} ${b.storagePath} ${b.productName} ${b.sku} ${b.key}`, 'vi'));
};

export const summarizeReport = (items) => items.reduce((total, row) => ({
  totalOnHand: total.totalOnHand + row.quantityOnHand,
  totalAvailable: total.totalAvailable + row.quantityAvailable,
  totalReserved: total.totalReserved + row.quantityReserved,
  totalUnavailable: total.totalUnavailable + row.quantityUnavailable,
  totalRenting: total.totalRenting + row.quantityRenting,
  totalOverdue: total.totalOverdue + row.quantityOverdue,
}), { ...EMPTY_SUMMARY });
