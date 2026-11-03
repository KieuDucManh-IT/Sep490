import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';

const fail = (message) => Object.assign(new Error(message), { statusCode: 409 });

export const getCentralWarehouse = async () => {
  const warehouses = await InventoryLocation.find({ type: 'warehouse', status: 'active' }).sort({ createdAt: 1, _id: 1 }).lean();
  if (!warehouses.length) throw fail('Chưa cấu hình kho tổng đang hoạt động.');
  if (warehouses.length > 1) throw fail('Cần xác định duy nhất một kho tổng đang hoạt động trước khi tạo phiếu.');
  return warehouses[0];
};

export const assertCentralWarehouse = async (locationId) => {
  const warehouse = await getCentralWarehouse();
  if (String(warehouse._id) !== String(locationId)) throw fail('Nghiệp vụ này chỉ được thực hiện tại kho tổng.');
  return warehouse;
};
