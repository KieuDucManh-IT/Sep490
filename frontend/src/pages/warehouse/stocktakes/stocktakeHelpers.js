/**
 * Hàm tính toán thuần cho màn kiểm kê (không gọi API, không có state).
 * Tách riêng để component chỉ lo hiển thị.
 */
import { idOf } from '../shared/slipHelpers';

/** Các tình trạng chọn được khi kiểm từng món; `missing` = không tìm thấy món khi đếm. */
export const COUNT_CONDITION_OPTIONS = [
  ['new', 'Mới'],
  ['good', 'Tốt'],
  ['worn', 'Đã qua sử dụng'],
  ['damaged', 'Hỏng'],
  ['unrepairable', 'Không thể sửa'],
  ['missing', 'Mất / không tìm thấy'],
];

/** Tình trạng chọn được cho món mới phát hiện khi kiểm (không có `missing`). */
export const NEW_ITEM_CONDITION_OPTIONS = COUNT_CONDITION_OPTIONS.filter(([value]) => value !== 'missing');

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

export const emptyNewItem = () => ({ variantId: '', storageId: '', itemCode: '', serialNumber: '', countedCondition: 'good' });

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

/**
 * Mọi sản phẩm quản lý theo món (TASK-015): mỗi dòng chụp số là một món (`itemId`).
 * Dòng không có `itemId` là món lạ đã ghi nhận thêm (qua `newItems`), số đếm 0 hoặc 1.
 */
export const isItemLine = (line) => Boolean(line.itemId);

/** Tình trạng đang chọn của một dòng món; mặc định = tình trạng hiện có của món ("như cũ"). */
export function lineCondition(line, itemConditions) {
  return itemConditions[line._id] || line.countedCondition || line.itemId?.condition || 'good';
}

/** Số lượng thực tế của một dòng: món thiếu = 0, món còn = 1, món lạ = số đã ghi (0 / 1). */
export function actualQuantity(line, counts, itemConditions) {
  if (isItemLine(line)) return lineCondition(line, itemConditions) === 'missing' ? 0 : 1;
  return Number(counts[line._id] || 0);
}

/** Chênh lệch = thực tế - tồn sổ. */
export const lineVariance = (line, actual) => actual - Number(line.systemQuantity || 0);

/** Dòng khác thường: món thiếu, đổi tình trạng so với hiện có, hoặc món lạ. */
export function isUnusualLine(line, itemConditions) {
  if (!isItemLine(line)) return true;
  const condition = lineCondition(line, itemConditions);
  return condition === 'missing' || condition !== (line.itemId?.condition || 'good');
}

/** Số liệu tổng của phiếu đang mở cho hàng thẻ KPI. */
export function countSummary(lines, counts, itemConditions) {
  return lines.reduce((summary, line) => {
    const condition = isItemLine(line) ? lineCondition(line, itemConditions) : line.countedCondition;
    summary.expected += Number(line.systemQuantity || 0);
    summary.counted += actualQuantity(line, counts, itemConditions);
    if (condition === 'missing') summary.missing += 1;
    if (['damaged', 'unrepairable'].includes(condition)) summary.damaged += 1;
    return summary;
  }, { expected: 0, counted: 0, missing: 0, damaged: 0 });
}

/** Mã kệ dùng để nhóm / sắp xếp dòng kiểm kê. */
const storageCodeOf = (line) => line.storageId?.code || '';

/**
 * Nhóm dòng kiểm kê theo kệ (sắp theo mã kệ), lọc theo mã hàng / SKU và tùy chọn chỉ dòng khác thường.
 * @returns {{ key: string, label: string, lines: object[] }[]}
 */
export function groupLinesByStorage(lines, { query = '', onlyUnusual = false, itemConditions = {} } = {}) {
  const keyword = query.trim().toLowerCase();
  const groups = new Map();
  const sorted = [...lines].sort((a, b) => storageCodeOf(a).localeCompare(storageCodeOf(b))
    || String(a.itemId?.itemCode || '').localeCompare(String(b.itemId?.itemCode || '')));
  for (const line of sorted) {
    const text = [line.itemId?.itemCode, line.itemId?.serialNumber, line.countedItemCode, line.variantId?.sku]
      .filter(Boolean).join(' ').toLowerCase();
    if (keyword && !text.includes(keyword)) continue;
    if (onlyUnusual && !isUnusualLine(line, itemConditions)) continue;
    const key = idOf(line.storageId) || 'none';
    if (!groups.has(key)) groups.set(key, { key, label: storageCodeOf(line) ? `Kệ ${storageCodeOf(line)}` : 'Chưa gán kệ', lines: [] });
    groups.get(key).lines.push(line);
  }
  return [...groups.values()];
}

/** Số đếm và tình trạng ban đầu khi mở phiếu: món có mặt, tình trạng như cũ (hoặc kết quả đã lưu). */
export function initialCounts(stocktake) {
  const lines = stocktake.items || [];
  const counts = Object.fromEntries(lines.map((line) => {
    if (line.isCounted) return [line._id, String(line.countedQuantity)];
    if (line.itemId) return [line._id, '1'];
    return [line._id, ''];
  }));
  const conditions = Object.fromEntries(lines
    .filter((line) => line.itemId)
    .map((line) => [line._id, line.countedCondition || line.itemId.condition || 'good']));
  return { counts, conditions };
}

/** Biến thể được phép ghi nhận là hàng mới phát hiện: thuộc phạm vi sản phẩm của phiếu (nếu có). */
export function variantsInScope(variants, stocktake) {
  const productIds = (stocktake?.productIds || []).map(idOf);
  const variantIds = (stocktake?.variantIds || []).map(idOf);
  if (!productIds.length && !variantIds.length) return variants;
  return variants.filter((variant) => productIds.includes(idOf(variant.productId))
    || variantIds.includes(idOf(variant)));
}

const hasValue = (value) => value !== '' && value !== null && value !== undefined;

/** Kiểm tra món lạ trước khi lưu (mã hàng không bắt buộc — trống thì hệ thống tự sinh); trả message lỗi hoặc ''. */
export function validateCounts(lines, counts, newItems) {
  const badCount = lines.some((line) => !line.itemId && hasValue(counts[line._id])
    && !['0', '1'].includes(String(counts[line._id])));
  const badNewItem = newItems.some((item) => !item.variantId || !item.storageId);
  if (badCount || badNewItem) return 'Món lạ cần chọn đủ biến thể và vị trí.';
  return '';
}

/** Còn dòng món lạ chưa ghi số đếm thì chưa được gửi kết quả. */
export function hasMissingCount(lines, counts) {
  return lines.some((line) => !line.itemId && !hasValue(counts[line._id]));
}

/** Dữ liệu gửi API lưu số đếm: dòng món gửi tình trạng (`missing` = mất), món lạ mỗi phần tử một món. */
export function buildCountPayload(lines, counts, itemConditions, newItems) {
  const items = lines
    .filter((line) => line.itemId || hasValue(counts[line._id]))
    .map((line) => {
      if (!line.itemId) return { detailId: line._id, countedQuantity: Number(counts[line._id]) };
      const condition = lineCondition(line, itemConditions);
      return { detailId: line._id, countedQuantity: condition === 'missing' ? 0 : 1, countedCondition: condition };
    });
  const validNewItems = newItems
    .filter((item) => item.variantId && item.storageId)
    .map(({ variantId, storageId, itemCode, serialNumber, countedCondition }) => ({
      variantId,
      storageId,
      itemCode: itemCode?.trim() || undefined,
      serialNumber: serialNumber?.trim() || undefined,
      countedCondition: countedCondition || 'good',
    }));
  return { items, newItems: validNewItems };
}