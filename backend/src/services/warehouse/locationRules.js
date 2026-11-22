// Quy tắc "Thiết lập kho tổng" (TASK-014 A1) — hàm thuần, không đụng DB để unit test chạy độc lập.
import { appError } from './shared/errors.js';

/** Các field Quản lý kho được sửa trên kho tổng. Mã kho, loại kho, trạng thái, chi nhánh... chỉ đọc. */
export const CENTRAL_WAREHOUSE_EDITABLE_FIELDS = ['name', 'address', 'maxCapacity', 'note'];

/** Giữ lại các field được sửa (bỏ qua mọi field khác client gửi lên). */
export const pickCentralWarehouseChanges = (payload) => Object.fromEntries(
  Object.entries(payload && typeof payload === 'object' ? payload : {})
    .filter(([key]) => CENTRAL_WAREHOUSE_EDITABLE_FIELDS.includes(key)),
);

/**
 * Sức chứa kho tổng: số nguyên dương, không nhỏ hơn số đang chứa (tổng quantityOnHand) và không nhỏ hơn
 * tổng sức chứa các khu đã khai báo. Vi phạm số nguyên dương → 400; nhỏ hơn số đang chứa / tổng khu → 409.
 */
export const assertWarehouseCapacity = ({ maxCapacity, currentQuantity = 0, childrenCapacity = 0 }) => {
  if (!Number.isInteger(maxCapacity) || maxCapacity <= 0) throw appError('Sức chứa tối đa phải là số nguyên dương.', 400);
  if (maxCapacity < currentQuantity) {
    throw appError(`Sức chứa tối đa không được nhỏ hơn số lượng đang chứa trong kho tổng (${currentQuantity} cái).`, 409);
  }
  if (maxCapacity < childrenCapacity) {
    throw appError(`Sức chứa tối đa phải từ ${childrenCapacity} cái trở lên để chứa các khu hiện có.`, 409);
  }
};
