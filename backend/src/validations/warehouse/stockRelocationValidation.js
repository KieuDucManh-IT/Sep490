const invalid = (message) => Object.assign(new Error(message), { statusCode: 400 });
const validId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

export const validateCreateStockRelocation = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Array.isArray(payload.items) || !payload.items.length) throw invalid('Thêm ít nhất một dòng di chuyển.');
  const assignedStaffId = String(payload.assignedStaffId || '');
  if (!validId(assignedStaffId)) throw invalid('Chọn nhân viên kho được giao thực hiện.');
  const operationType = String(payload.operationType || '');
  if (!['split', 'merge'].includes(operationType)) throw invalid('Loại nghiệp vụ phải là tách tồn hoặc gộp tồn.');
  const items = payload.items.map((line) => {
    if (!line || typeof line !== 'object' || !validId(line.variantId) || !validId(line.fromStorageId) || !validId(line.toStorageId)) throw invalid('Mỗi dòng cần có biến thể, kệ nguồn và kệ đích hợp lệ.');
    if (String(line.fromStorageId) === String(line.toStorageId)) throw invalid('Kệ nguồn và kệ đích phải khác nhau.');
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) throw invalid('Số lượng di chuyển phải là số nguyên lớn hơn 0.');
    return { variantId: String(line.variantId), fromStorageId: String(line.fromStorageId), toStorageId: String(line.toStorageId), quantity };
  });
  if (items.length < 2) throw invalid('Phiếu tách hoặc gộp tồn cần ít nhất hai dòng.');
  const byVariant = new Map();
  items.forEach((item) => byVariant.set(item.variantId, [...(byVariant.get(item.variantId) || []), item]));
  for (const variantItems of byVariant.values()) {
    if (variantItems.length < 2) throw invalid('Mỗi nhóm biến thể trong phiếu cần ít nhất hai kệ để tách hoặc gộp tồn.');
    const sourceIds = new Set(variantItems.map((item) => item.fromStorageId));
    const targetIds = new Set(variantItems.map((item) => item.toStorageId));
    if (operationType === 'split' && (sourceIds.size !== 1 || targetIds.size !== variantItems.length)) throw invalid('Mỗi biến thể tách tồn cần một kệ nguồn và các kệ đích khác nhau.');
    if (operationType === 'merge' && (targetIds.size !== 1 || sourceIds.size !== variantItems.length)) throw invalid('Mỗi biến thể gộp tồn cần các kệ nguồn khác nhau và một kệ đích.');
  }
  return { assignedStaffId, operationType, items, note: String(payload.note || '').trim().slice(0, 1000) };
};

export const validateCompleteStockRelocation = (payload) => {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) throw invalid('Dữ liệu xác nhận di chuyển không hợp lệ.');
  return payload.items.map((line) => {
    if (!line || !validId(line.detailId)) throw invalid('Dòng xác nhận di chuyển không hợp lệ.');
    const quantityMoved = Number(line.quantityMoved);
    if (!Number.isInteger(quantityMoved) || quantityMoved < 0) throw invalid('Số lượng thực di chuyển phải là số nguyên không âm.');
    const itemIds = line.itemIds == null ? [] : line.itemIds;
    if (!Array.isArray(itemIds) || itemIds.some((id) => !validId(id))) throw invalid('Danh sách InventoryItem xác nhận không hợp lệ.');
    return { detailId: String(line.detailId), quantityMoved, itemIds: [...new Set(itemIds.map(String))] };
  });
};
