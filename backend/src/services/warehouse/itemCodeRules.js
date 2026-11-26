// TASK-015 — Mẫu mã món hàng `<SKU>-<số thứ tự 4 chữ số>` (quyết định 3), đánh tiếp sau số lớn nhất của SKU.
// Hàm thuần, không đọc DB: dùng chung cho service kho (nhập kho, điều chỉnh tạo món) và script chuyển đổi.

export const ITEM_CODE_DIGITS = 4;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Mẫu mã `<SKU>-<số>` của một SKU (số có thể dài hơn 4 chữ số khi vượt 9999). */
export const itemCodePattern = (sku) => new RegExp(`^${escapeRegex(sku)}-(\\d+)$`);

export const formatItemCode = (sku, number) => `${sku}-${String(number).padStart(ITEM_CODE_DIGITS, '0')}`;

/** Số thứ tự lớn nhất đang có của SKU trong danh sách mã (0 nếu chưa có). */
export const maxItemCodeNumber = (sku, codes = []) => {
  const pattern = itemCodePattern(sku);
  let max = 0;
  for (const code of codes) {
    const match = pattern.exec(String(code || ''));
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
};

/** `count` mã liên tiếp cho SKU, bắt đầu sau số lớn nhất trong `existingCodes`. */
export const nextItemCodesFrom = (sku, count, existingCodes = []) => {
  const start = maxItemCodeNumber(sku, existingCodes);
  return Array.from({ length: Math.max(0, count) }, (_, index) => formatItemCode(sku, start + index + 1));
};
