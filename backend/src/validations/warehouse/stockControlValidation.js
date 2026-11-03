const invalid = (message) => Object.assign(new Error(message), { statusCode: 400 });
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const idList = (value, label) => {
  if (value == null) return [];
  if (!Array.isArray(value)) throw invalid(`${label} phải là một danh sách.`);
  const ids = [...new Set(value.map((id) => String(id)))];
  if (ids.some((id) => !/^[a-f\d]{24}$/i.test(id))) throw invalid(`${label} có mã không hợp lệ.`);
  return ids;
};

export const validateCreateStocktakeInput = (payload) => {
  if (!isObject(payload)) throw invalid('Dữ liệu tạo phiếu kiểm kê không hợp lệ.');
  const locationId = String(payload.locationId || '');
  if (!/^[a-f\d]{24}$/i.test(locationId)) throw invalid('Chọn kho/cửa hàng hợp lệ.');
  if (!['full', 'product', 'storage_location'].includes(payload.scopeType)) throw invalid('Phạm vi kiểm kê không hợp lệ.');
  const variantIds = idList(payload.variantIds, 'Danh sách biến thể');
  const storageIds = idList(payload.storageIds, 'Danh sách vị trí');
  if (payload.scopeType === 'product' && variantIds.length === 0) throw invalid('Chọn ít nhất một biến thể cần kiểm kê.');
  if (payload.scopeType !== 'product' && variantIds.length) throw invalid('Chỉ phạm vi theo sản phẩm mới nhận biến thể.');
  if (payload.scopeType === 'storage_location' && storageIds.length === 0) throw invalid('Chọn ít nhất một vị trí lưu trữ.');
  if (payload.scopeType !== 'storage_location' && storageIds.length) throw invalid('Chỉ phạm vi theo vị trí mới nhận vị trí lưu trữ.');
  const assignedStaffId = payload.assignedStaffId ? String(payload.assignedStaffId) : null;
  if (assignedStaffId && !/^[a-f\d]{24}$/i.test(assignedStaffId)) throw invalid('Nhân viên được giao không hợp lệ.');
  return { locationId, scopeType: payload.scopeType, variantIds, storageIds, assignedStaffId };
};

export const validateStocktakeCountInput = (payload) => {
  if (!isObject(payload)) throw invalid('Dữ liệu kiểm đếm không hợp lệ.');
  const items = payload.items == null ? [] : payload.items;
  const newItems = payload.newItems == null ? [] : payload.newItems;
  if (!Array.isArray(items) || !Array.isArray(newItems)) throw invalid('Các dòng kiểm đếm phải là danh sách.');
  for (const item of items) {
    if (!isObject(item) || !/^[a-f\d]{24}$/i.test(String(item.detailId || ''))) throw invalid('Dòng kiểm đếm có mã không hợp lệ.');
    if (!Number.isInteger(Number(item.countedQuantity)) || Number(item.countedQuantity) < 0) throw invalid('Số lượng thực tế phải là số nguyên không âm.');
    if (item.countedItemStatus != null && !['available', 'reserved', 'maintenance', 'unavailable'].includes(item.countedItemStatus)) throw invalid('Trạng thái InventoryItem kiểm kê không hợp lệ.');
    if (item.countedCondition != null && !['new', 'good', 'worn', 'damaged', 'unrepairable', 'missing'].includes(item.countedCondition)) throw invalid('Tình trạng InventoryItem kiểm kê không hợp lệ.');
  }
  for (const item of newItems) {
    if (!isObject(item) || !/^[a-f\d]{24}$/i.test(String(item.variantId || ''))) throw invalid('Dòng hàng ngoài hệ thống có biến thể không hợp lệ.');
    if (item.countedItemStatus != null && !['available', 'reserved', 'maintenance', 'unavailable'].includes(item.countedItemStatus)) throw invalid('Trạng thái InventoryItem mới không hợp lệ.');
    if (item.countedCondition != null && !['new', 'good', 'worn', 'damaged', 'unrepairable', 'missing'].includes(item.countedCondition)) throw invalid('Tình trạng InventoryItem mới không hợp lệ.');
  }
  return { items, newItems };
};
