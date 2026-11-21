/**
 * Hàm thuần cho phiếu "Di chuyển hàng giữa các kệ" trong kho tổng.
 * Mỗi dòng: Biến thể · Từ kệ · Đến kệ · Số lượng. "Thêm kệ đích" (tách) và "Dùng kệ đích cho mọi kệ nguồn"
 * (gộp) chỉ là cách điền nhanh nhiều dòng; mọi dòng gửi lên cùng một kiểu.
 */
import { idOf } from '../shared/slipHelpers';

export const PICKER_PAGE_SIZE = 10;

let lineSeq = 0;
const nextKey = () => {
  lineSeq += 1;
  return `line-${lineSeq}`;
};

/** Tên dòng tồn: "Tên · SKU · size · màu". */
export const inventoryRowName = (row) => [row.productName, row.sku, row.size, row.color].filter(Boolean).join(' · ');

/** Dòng tồn còn hàng khả dụng ở một kệ, khớp từ khóa tìm (tên, mã, SKU, size, màu, vị trí). */
export function filterAvailable(inventory, query) {
  const keyword = query.toLowerCase();
  return inventory
    .filter((row) => row.storageId && Number(row.quantityAvailable) > 0)
    .filter((row) => {
      if (!keyword) return true;
      const text = [row.productName, row.productCode, row.sku, row.size, row.color, row.storagePath].join(' ');
      return text.toLowerCase().includes(keyword);
    });
}

/** Mỗi dòng tồn chọn từ bảng (biến thể tại một kệ) thành một dòng di chuyển chưa có kệ đích. */
export function addInventoryRows(lines, rows) {
  const next = [...lines];
  rows.forEach((row) => {
    const exists = next.some((line) => idOf(line.variantId) === idOf(row.variantId)
      && idOf(line.fromStorageId) === idOf(row.storageId) && !line.toStorageId);
    if (exists) return;
    next.push({
      key: nextKey(),
      variantId: idOf(row.variantId),
      label: inventoryRowName(row),
      fromStorageId: idOf(row.storageId),
      fromLabel: row.storagePath || '',
      available: Number(row.quantityAvailable),
      toStorageId: '',
      quantity: 1,
    });
  });
  return next;
}

/** Tách: thêm một dòng cùng biến thể, cùng kệ nguồn để chọn thêm một kệ đích. */
export function addTargetLine(lines, index) {
  const source = lines[index];
  if (!source) return lines;
  const copy = { ...source, key: nextKey(), toStorageId: '', quantity: 1 };
  return [...lines.slice(0, index + 1), copy, ...lines.slice(index + 1)];
}

/** Gộp: dùng kệ đích của dòng này cho mọi dòng cùng biến thể (các kệ nguồn khác). */
export function applyTargetToVariant(lines, index) {
  const source = lines[index];
  if (!source?.toStorageId) return lines;
  return lines.map((line) => {
    if (line.variantId !== source.variantId || line.fromStorageId === source.toStorageId) return line;
    return { ...line, toStorageId: source.toStorageId };
  });
}

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) > 0;

/** Kiểm tra form trước khi tạo phiếu; trả message lỗi đầu tiên hoặc ''. */
export function validateMoveLines(lines) {
  if (!lines.length) return 'Vui lòng thêm ít nhất một dòng hàng.';
  const seen = new Set();
  const usedBySource = new Map();
  for (const line of lines) {
    if (!line.toStorageId) return `Chọn kệ đích cho ${line.label}.`;
    if (line.toStorageId === line.fromStorageId) return `Kệ đích phải khác kệ nguồn (${line.label}).`;
    if (!isPositiveInteger(line.quantity)) return `Số lượng của ${line.label} phải là số nguyên lớn hơn 0.`;
    const key = `${line.variantId}|${line.fromStorageId}|${line.toStorageId}`;
    if (seen.has(key)) return `Có hai dòng ${line.label} cùng kệ nguồn và kệ đích; hãy gộp số lượng vào một dòng.`;
    seen.add(key);
    const sourceKey = `${line.variantId}|${line.fromStorageId}`;
    const used = (usedBySource.get(sourceKey) || 0) + Number(line.quantity);
    usedBySource.set(sourceKey, used);
    if (used > Number(line.available)) {
      return `Tổng số lượng lấy từ ${line.fromLabel || 'kệ nguồn'} của ${line.label} vượt khả dụng (${line.available}).`;
    }
  }
  return '';
}

/** Dòng phiếu gửi API (giữ đúng định dạng backend: biến thể, kệ nguồn, kệ đích, số lượng). */
export const buildRelocationItems = (lines) => lines.map((line) => ({
  variantId: line.variantId,
  fromStorageId: line.fromStorageId,
  toStorageId: line.toStorageId,
  quantity: Number(line.quantity),
}));

/* ---------------- Nhân viên xác nhận hoàn tất ---------------- */

export const isIndividualLine = (line) => line.variantId?.productId?.trackingType === 'individual';

/** Giá trị xác nhận ban đầu: số lượng thực tế = số được giao, món = các món đã giữ cho dòng. */
export const initialConfirmations = (relocation) => Object.fromEntries((relocation.items || []).map((line) => [
  idOf(line),
  { quantity: String(line.quantity), itemIds: (line.itemIds || []).map(idOf) },
]));

/** Lỗi xác nhận của một dòng (trả '' nếu hợp lệ). Server vẫn kiểm lại. */
export function confirmationError(line, value) {
  if (!value) return 'Chưa xác nhận dòng này.';
  if (isIndividualLine(line)) {
    if (value.itemIds.length !== line.quantity) return `Cần đánh dấu đủ ${line.quantity} món đã chuyển.`;
    return '';
  }
  const quantity = Number(value.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) return 'Số lượng thực tế phải là số nguyên không âm.';
  if (quantity !== Number(line.quantity)) {
    return 'Số thực tế khác số được giao: hãy báo quản lý kho xử lý phiếu (hủy và tạo lại) thay vì hoàn tất.';
  }
  return '';
}

/** Payload hoàn tất: [{ detailId, quantityMoved, itemIds }]. */
export const buildCompletePayload = (relocation, confirmations) => ({
  items: (relocation.items || []).map((line) => {
    const value = confirmations[idOf(line)];
    const individual = isIndividualLine(line);
    return {
      detailId: idOf(line),
      quantityMoved: individual ? value.itemIds.length : Number(value.quantity),
      itemIds: individual ? value.itemIds : [],
    };
  }),
});
