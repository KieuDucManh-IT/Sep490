// Kiểm tra một nghiệp vụ chỉ được làm tại kho tổng (nhập kho từ nhà cung cấp, kiểm kê).
// Việc tìm kho tổng nằm ở shared/locations.js; file này giữ API cũ cho các service đang import.
import { appError } from './shared/errors.js';
import { getCentralWarehouse } from './shared/locations.js';

export { getCentralWarehouse };

/** Ném 409 nếu `locationId` không phải kho tổng đang hoạt động. */
export const assertCentralWarehouse = async (locationId, session = null) => {
  const warehouse = await getCentralWarehouse(session);
  if (String(warehouse._id) !== String(locationId)) throw appError('Nghiệp vụ này chỉ được thực hiện tại kho tổng.', 409);
  return warehouse;
};
