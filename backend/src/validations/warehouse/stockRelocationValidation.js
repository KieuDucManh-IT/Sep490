const invalid = (message) => Object.assign(new Error(message), { statusCode: 400 });
const validId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

export const MAX_RELOCATION_LINES = 200;

/**
 * Kiểm các dòng di chuyển (hàm thuần): mỗi dòng Biến thể · Từ kệ · Đến kệ · Số lượng, từ kệ ≠ đến kệ,
 * số nguyên > 0, không trùng (biến thể, từ kệ, đến kệ). Tách (một nguồn → nhiều đích) và gộp (nhiều nguồn
 * → một đích) chỉ là cách điền nhiều dòng cùng kiểu. Kệ có thuộc kho tổng / là kệ hay không kiểm ở service.
 */
export const validateRelocationLines = (lines) => {
  if (!Array.isArray(lines) || !lines.length) throw invalid('Thêm ít nhất một dòng di chuyển.');
  if (lines.length > MAX_RELOCATION_LINES) throw invalid(`Một phiếu di chuyển tối đa ${MAX_RELOCATION_LINES} dòng.`);
  const seen = new Set();
  return lines.map((line) => {
    if (!line || typeof line !== 'object' || !validId(line.variantId) || !validId(line.fromStorageId) || !validId(line.toStorageId)) throw invalid('Mỗi dòng cần có biến thể, kệ nguồn và kệ đích hợp lệ.');
    if (String(line.fromStorageId) === String(line.toStorageId)) throw invalid('Kệ nguồn và kệ đích phải khác nhau.');
    const quantity = Number(line.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) throw invalid('Số lượng di chuyển phải là số nguyên lớn hơn 0.');
    const key = `${line.variantId}|${line.fromStorageId}|${line.toStorageId}`;
    if (seen.has(key)) throw invalid('Có hai dòng trùng biến thể, kệ nguồn và kệ đích; hãy gộp số lượng vào một dòng.');
    seen.add(key);
    return { variantId: String(line.variantId), fromStorageId: String(line.fromStorageId), toStorageId: String(line.toStorageId), quantity };
  });
};

/** Phiếu mới luôn là loại 'move'; 'split' / 'merge' chỉ còn để hiển thị dữ liệu cũ. */
export const validateCreateStockRelocation = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw invalid('Thêm ít nhất một dòng di chuyển.');
  const assignedStaffId = String(payload.assignedStaffId || '');
  if (!validId(assignedStaffId)) throw invalid('Chọn nhân viên kho được giao thực hiện.');
  const operationType = String(payload.operationType || 'move');
  if (operationType !== 'move') throw invalid('Phiếu mới chỉ dùng loại "Di chuyển hàng"; tách / gộp nay là cách điền nhiều dòng.');
  const items = validateRelocationLines(payload.items);
  return { assignedStaffId, operationType, items, note: String(payload.note || '').trim().slice(0, 1000) };
};

export const validateCompleteStockRelocation = (payload) => {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.items)) throw invalid('Dữ liệu xác nhận di chuyển không hợp lệ.');
  return payload.items.map((line) => {
    if (!line || !validId(line.detailId)) throw invalid('Dòng xác nhận di chuyển không hợp lệ.');
    const quantityMoved = Number(line.quantityMoved);
    if (!Number.isInteger(quantityMoved) || quantityMoved < 0) throw invalid('Số lượng thực di chuyển phải là số nguyên không âm.');
    const itemIds = line.itemIds == null ? [] : line.itemIds;
    if (!Array.isArray(itemIds) || itemIds.some((id) => !validId(id))) throw invalid('Danh sách mã hàng xác nhận không hợp lệ.');
    return { detailId: String(line.detailId), quantityMoved, itemIds: [...new Set(itemIds.map(String))] };
  });
};
