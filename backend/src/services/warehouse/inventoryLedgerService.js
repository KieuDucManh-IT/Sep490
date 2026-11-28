// Ghi sổ biến động (StockMovement) cho các luồng kho.
// TASK-015: mọi sản phẩm quản lý theo từng món, nên file này KHÔNG còn ghi InventoryBalance; mọi thay đổi tồn
// đi qua itemStateService (đổi trạng thái / vị trí từng món, cập nhật balance trong cùng transaction).
// Các hàm cộng / trừ / giữ / nhả balance trực tiếp của hàng số lượng đã xóa.
import { StockMovement } from '../../models/warehouse/inventory/StockMovement.js';

/** Ghi một dòng sổ biến động (trong transaction nếu có session). */
export const recordStockMovement = async (movement, session) => {
  if (session) return (await StockMovement.create([movement], { session }))[0];
  return StockMovement.create(movement);
};
