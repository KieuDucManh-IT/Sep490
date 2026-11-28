// Tìm kho tổng. Hệ thống chỉ có đúng MỘT kho tổng đang hoạt động (type = 'warehouse', status = 'active');
// nếu chưa cấu hình hoặc có nhiều hơn một thì mọi nghiệp vụ kho tổng phải dừng (409).
import { InventoryLocation } from '../../../models/warehouse/location/InventoryLocation.js';
import { appError } from './errors.js';

const DEFAULT_MISSING_MESSAGE = 'Chưa cấu hình kho tổng đang hoạt động.';
const DEFAULT_MULTIPLE_MESSAGE = 'Cần xác định duy nhất một kho tổng đang hoạt động trước khi tạo phiếu.';

/**
 * Trả về kho tổng đang hoạt động (lean). Mỗi nghiệp vụ có câu báo lỗi riêng nên cho phép truyền message:
 * - `message`: dùng cho cả trường hợp 0 kho và nhiều kho.
 * - `missingMessage` / `multipleMessage`: tách riêng từng trường hợp.
 * - `select`: chỉ lấy một số field (mặc định lấy cả document).
 */
export const getCentralWarehouse = async (session = null, options = {}) => {
  const { message, missingMessage, multipleMessage, select } = options;
  let query = InventoryLocation.find({ type: 'warehouse', status: 'active' }).sort({ createdAt: 1, _id: 1 });
  if (select) query = query.select(select);
  const warehouses = await query.session(session || null).lean();
  if (!warehouses.length) throw appError(message || missingMessage || DEFAULT_MISSING_MESSAGE, 409);
  if (warehouses.length > 1) throw appError(message || multipleMessage || DEFAULT_MULTIPLE_MESSAGE, 409);
  return warehouses[0];
};
