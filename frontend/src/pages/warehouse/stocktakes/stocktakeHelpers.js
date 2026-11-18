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

export const emptyNewItem = () => ({ variantId: '', storageId: '', itemCode: '', countedQuantity: 1 });

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

/** Dòng kiểm từng món (hàng quản lý theo mã) có `itemId`; dòng theo số lượng thì không. */
export const isIndividualLine = (line) => Boolean(line.itemId);

/** Tình trạng đang chọn của một dòng kiểm từng món. */
export function lineCondition(line, itemConditions) {
  return itemConditions[line._id] || line.countedCondition || line.itemId?.condition || 'good';
}

/** Số lượng thực tế của một dòng: món thiếu = 0, món còn = 1, dòng số lượng = số đã nhập. */
export function actualQuantity(line, counts, itemConditions) {
  if (isIndividualLine(line)) return lineCondition(line, itemConditions) === 'missing' ? 0 : 1;
  return Number(counts[line._id] || 0);
}

/** Chênh lệch = thực tế + biến động sau lúc đếm - tồn sổ (dòng kiểm từng món không tính biến động). */
export function lineVariance(line, actual) {
  if (isIndividualLine(line)) return actual - Number(line.systemQuantity || 0);
  return actual + Number(line.movementAfterCount || 0) - Number(line.systemQuantity || 0);
}

/** Số liệu tổng của phiếu đang mở cho hàng thẻ KPI. */
export function countSummary(lines, counts, itemConditions) {
  return lines.reduce((summary, line) => {
    const condition = itemConditions[line._id] || line.countedCondition || line.itemId?.condition;
    summary.expected += Number(line.systemQuantity || 0);
    summary.counted += actualQuantity(line, counts, itemConditions);
    if (condition === 'missing') summary.missing += 1;
    if (['damaged', 'unrepairable'].includes(condition)) summary.damaged += 1;
    return summary;
  }, { expected: 0, counted: 0, missing: 0, damaged: 0 });
}

/** Số đếm và tình trạng ban đầu khi mở phiếu (lấy theo kết quả đã lưu). */
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

/** Số vị trí nằm trong phạm vi (tính cả cấp con của vị trí được chọn). */
export function storageScopeSize(storages, selectedStorageIds) {
  const selectedIds = new Set(selectedStorageIds);
  const byId = new Map(storages.map((storage) => [idOf(storage), storage]));
  const isInsideSelection = (storage) => {
    let cursor = storage;
    const visited = new Set();
    while (cursor && !visited.has(idOf(cursor))) {
      if (selectedIds.has(idOf(cursor))) return true;
      visited.add(idOf(cursor));
      cursor = byId.get(idOf(cursor.parentStorageId));
    }
    return false;
  };
  return storages.filter(isInsideSelection).length;
}

/** Số biến thể dự kiến: biến thể của các sản phẩm chọn toàn bộ + biến thể chọn riêng. */
export function variantScopeSize(variants, productIds, variantIds) {
  const fromProducts = variants.filter((variant) => productIds.includes(idOf(variant.productId))).map(idOf);
  return new Set([...fromProducts, ...variantIds]).size;
}

/** Biến thể được phép ghi nhận là hàng mới phát hiện: thuộc phạm vi sản phẩm của phiếu (nếu có). */
export function variantsInScope(variants, stocktake) {
  const productIds = (stocktake?.productIds || []).map(idOf);
  const variantIds = (stocktake?.variantIds || []).map(idOf);
  if (!productIds.length && !variantIds.length) return variants;
  return variants.filter((variant) => productIds.includes(idOf(variant.productId))
    || variantIds.includes(idOf(variant)));
}

/** Biến thể thuộc sản phẩm quản lý theo từng mã hàng (có mã riêng cho mỗi món). */
export function isIndividualVariant(variants, variantId) {
  const variant = variants.find((row) => idOf(row) === variantId);
  return variant?.productId?.trackingType === 'individual';
}

const isNonNegativeInteger = (value) => Number.isInteger(Number(value)) && Number(value) >= 0;
const hasValue = (value) => value !== '' && value !== null && value !== undefined;

/** Kiểm tra số đếm và hàng mới trước khi lưu; trả message lỗi hoặc ''. */
export function validateCounts(lines, counts, newItems, variants) {
  const badCount = lines.some((line) => !line.itemId && hasValue(counts[line._id])
    && !isNonNegativeInteger(counts[line._id]));
  const badNewItem = newItems.some((item) => {
    if (!item.variantId || !item.storageId) return true;
    if (isIndividualVariant(variants, item.variantId)) return !item.itemCode?.trim();
    return !Number.isInteger(Number(item.countedQuantity)) || Number(item.countedQuantity) < 1;
  });
  if (badCount || badNewItem) {
    return 'Số lượng kiểm phải là số nguyên không âm; hàng mới cần đủ biến thể, vị trí và mã / số lượng hợp lệ.';
  }
  return '';
}

/** Còn dòng số lượng chưa nhập số đếm thì chưa được gửi kết quả. */
export function hasMissingCount(lines, counts) {
  return lines.some((line) => !line.itemId && !hasValue(counts[line._id]));
}

/** Dữ liệu gửi API lưu số đếm (giữ đúng định dạng backend đang nhận). */
export function buildCountPayload(lines, counts, itemConditions, newItems, variants) {
  const items = lines
    .filter((line) => line.itemId || hasValue(counts[line._id]))
    .map((line) => {
      if (!line.itemId) {
        return { detailId: line._id, countedQuantity: Number(counts[line._id]), countedCondition: undefined };
      }
      const condition = itemConditions[line._id];
      return { detailId: line._id, countedQuantity: condition === 'missing' ? 0 : 1, countedCondition: condition };
    });
  const validNewItems = newItems
    .filter((item) => item.variantId && item.storageId
      && (!isIndividualVariant(variants, item.variantId) || item.itemCode.trim()))
    .map((item) => ({ ...item, countedQuantity: Number(item.countedQuantity || 1) }));
  return { items, newItems: validNewItems };
}
