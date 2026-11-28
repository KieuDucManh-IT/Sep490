/**
 * Hàm tính toán thuần cho màn kiểm kê (không gọi API, không có state).
 * TASK-016 B: mỗi dòng là một món; nhân viên ghi kết quả (mặc định "Có mặt – dùng được"), kệ thực tế nếu khác,
 * và món lạ (mã gặp trên kệ). Duyệt = áp dụng ngay, không còn phiếu điều chỉnh.
 */
import { idOf } from '../shared/slipHelpers';

export const emptyCreateForm = (locationId = '') => ({
  locationId,
  scopeType: 'custom',
  productIds: [],
  variantIds: [],
  storageIds: [],
  assignedStaffId: '',
});

/** Phần phạm vi của form tạo phiếu (body của API xem trước). */
export const previewScopePayload = (form) => ({
  locationId: form.locationId,
  scopeType: form.scopeType,
  productIds: form.productIds,
  variantIds: form.variantIds,
  storageIds: form.storageIds,
});

/** Các cặp (biến thể, vị trí) còn được chọn trong bảng xem trước → `lines` khi tạo phiếu. */
export const selectedPreviewLines = (items, excludedKeys) => items
  .filter((item) => !excludedKeys.has(item.key))
  .map((item) => ({ variantId: item.variantId, storageId: item.storageId || null }));

/** Món lạ: mã gặp trên kệ (có trong hệ thống → dùng món đó; chưa có → chọn biến thể để tạo món mới). */
export const emptyNewItem = (storageId = '') => ({ itemCode: '', variantId: '', storageId, serialNumber: '', countedResult: 'ok' });

const isWholeWarehouse = (row) => {
  if (row.scopeType === 'full') return true;
  const noStorage = !row.storageIds?.length;
  const noProduct = !row.productIds?.length && !row.variantIds?.length;
  return row.scopeType === 'custom' && noStorage && noProduct;
};

/** Mô tả ngắn phạm vi kiểm kê của phiếu. */
export function scopeLabel(row) {
  if (isWholeWarehouse(row)) return 'Toàn kho';
  if (row.scopeType === 'product') return `${row.variantIds?.length || 0} biến thể`;
  if (row.scopeType === 'storage_location') return `${row.storageIds?.length || 0} vị trí và cấp con`;
  const parts = [];
  if (row.storageIds?.length) parts.push(`${row.storageIds.length} vị trí`);
  if (row.productIds?.length) parts.push(`${row.productIds.length} sản phẩm`);
  if (row.variantIds?.length) parts.push(`${row.variantIds.length} biến thể riêng`);
  return parts.join(' · ');
}

/** Kết quả đang chọn của một dòng: { countedResult, foundStorageId }; mặc định "ok", kệ như hệ thống. */
export function lineResult(line, results) {
  const draft = results[line._id];
  if (draft) return draft;
  return { countedResult: line.countedResult || 'ok', foundStorageId: idOf(line.foundStorageId) || '' };
}

/** Kệ thực tế khác kệ hệ thống của dòng (chỉ dòng thường). */
export const isMovedLine = (line, result) => !line.isExtra && Boolean(result.foundStorageId)
  && result.foundStorageId !== idOf(line.storageAtStart || line.storageId);

/** Dòng khác thường: cần xử lý, không thấy, khác kệ, hoặc món lạ. */
export function isUnusualLine(line, results) {
  if (line.isExtra) return true;
  const result = lineResult(line, results);
  return result.countedResult !== 'ok' || isMovedLine(line, result);
}

/** Số liệu tổng của phiếu đang kiểm cho hàng thẻ KPI. */
export function countSummary(lines, results) {
  return lines.reduce((summary, line) => {
    const result = lineResult(line, results);
    summary.total += line.isExtra ? 0 : 1;
    if (line.isExtra) summary.extra += 1;
    else if (result.countedResult === 'not_found') summary.notFound += 1;
    else if (result.countedResult === 'needs_service') summary.needsService += 1;
    if (isMovedLine(line, result)) summary.moved += 1;
    return summary;
  }, { total: 0, needsService: 0, notFound: 0, moved: 0, extra: 0 });
}

/** Mã kệ dùng để nhóm / sắp xếp dòng kiểm kê. */
const storageCodeOf = (line) => line.storageId?.code || '';
const codeOfLine = (line) => line.itemId?.itemCode || line.countedItemCode || '';

/**
 * Nhóm dòng kiểm kê theo kệ (sắp theo mã kệ), lọc theo mã hàng / SKU và tùy chọn chỉ dòng khác thường.
 * @returns {{ key: string, label: string, lines: object[] }[]}
 */
export function groupLinesByStorage(lines, { query = '', onlyUnusual = false, results = {} } = {}) {
  const keyword = query.trim().toLowerCase();
  const groups = new Map();
  const sorted = [...lines].sort((a, b) => storageCodeOf(a).localeCompare(storageCodeOf(b))
    || codeOfLine(a).localeCompare(codeOfLine(b)));
  for (const line of sorted) {
    const text = [codeOfLine(line), line.itemId?.serialNumber, line.variantId?.sku].filter(Boolean).join(' ').toLowerCase();
    if (keyword && !text.includes(keyword)) continue;
    if (onlyUnusual && !isUnusualLine(line, results)) continue;
    const key = idOf(line.storageId) || 'none';
    if (!groups.has(key)) groups.set(key, { key, label: storageCodeOf(line) ? `Kệ ${storageCodeOf(line)}` : 'Chưa gán kệ', lines: [] });
    groups.get(key).lines.push(line);
  }
  return [...groups.values()];
}

/** Biến thể được phép ghi nhận là món mới: thuộc phạm vi sản phẩm của phiếu (nếu có). */
export function variantsInScope(variants, stocktake) {
  const productIds = (stocktake?.productIds || []).map(idOf);
  const variantIds = (stocktake?.variantIds || []).map(idOf);
  if (!productIds.length && !variantIds.length) return variants;
  return variants.filter((variant) => productIds.includes(idOf(variant.productId))
    || variantIds.includes(idOf(variant)));
}

/** Kiểm tra món lạ trước khi lưu; trả message lỗi hoặc ''. */
export function validateCounts(newItems) {
  if (newItems.some((item) => !item.storageId)) return 'Món lạ cần chọn kệ đang kiểm.';
  if (newItems.some((item) => !item.itemCode?.trim() && !item.variantId)) return 'Món lạ cần nhập mã hàng, hoặc chọn biến thể nếu món chưa có mã.';
  return '';
}

/**
 * Dữ liệu gửi API lưu kết quả: mọi dòng gửi `countedResult` (mặc định ok) + kệ thực tế nếu khác;
 * món lạ gửi mã / biến thể / kệ đang kiểm. Dòng món lạ đã lưu chọn "not_found" = bỏ ghi nhận.
 */
export function buildCountPayload(lines, results, newItems) {
  const items = lines.map((line) => {
    const result = lineResult(line, results);
    const row = { detailId: line._id, countedResult: result.countedResult };
    if (!line.isExtra && result.countedResult !== 'not_found' && isMovedLine(line, result)) row.foundStorageId = result.foundStorageId;
    return row;
  });
  const validNewItems = newItems
    .filter((item) => item.storageId && (item.itemCode?.trim() || item.variantId))
    .map(({ itemCode, variantId, storageId, serialNumber, countedResult }) => ({
      itemCode: itemCode?.trim() || undefined,
      variantId: variantId || undefined,
      storageId,
      serialNumber: serialNumber?.trim() || undefined,
      countedResult: countedResult === 'needs_service' ? 'needs_service' : 'ok',
    }));
  return { items, newItems: validNewItems };
}
