// TASK-015 — Hàm thuần cho trả hàng bán theo món (không đọc DB, có unit test).
// Món được trả phải nằm trong số món đã bán của đơn (StockMovement `sale` của đơn có itemId), còn ở trạng thái
// `sold` và chưa nằm trong phiếu trả khác. Số món của mỗi dòng = `quantityReturned`.

export const RETURN_CONDITIONS = Object.freeze(['new', 'good', 'worn', 'damaged', 'unrepairable']);
export const RETURN_DISPOSITIONS = Object.freeze(['restock', 'quarantine', 'repair', 'dispose']);

/** Trạng thái món sau khi nhận trả: `restock` → available; còn lại → unavailable để WM xử lý tiếp. */
export const returnedItemStatus = (disposition) => (disposition === 'restock' ? 'available' : 'unavailable');

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400, status: 400 });
const conflict = (message) => Object.assign(new Error(message), { statusCode: 409, status: 409 });
const idOf = (value) => String(value?._id || value || '');
const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

/**
 * Đọc payload tạo phiếu trả: { returnReason, items: [{ salesOrderDetailId, itemIds, conditionOnReturn, disposition,
 * unitRefundAmount?, note? }] }. Trả về dữ liệu đã chuẩn hóa hoặc ném 400.
 */
export const parseSalesReturnPayload = (payload) => {
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  const returnReason = String(body.returnReason || '').trim();
  if (!returnReason) throw badRequest('Vui lòng nhập lý do trả hàng.');
  if (returnReason.length > 1000) throw badRequest('Lý do trả hàng tối đa 1000 ký tự.');
  if (!Array.isArray(body.items) || !body.items.length) throw badRequest('Phiếu trả cần ít nhất một dòng hàng.');
  const seenItems = new Set();
  const items = body.items.map((line) => {
    if (!line || typeof line !== 'object' || !isObjectId(line.salesOrderDetailId)) throw badRequest('Dòng trả hàng không hợp lệ.');
    if (!Array.isArray(line.itemIds) || !line.itemIds.length) throw badRequest('Chọn các món được trả cho từng dòng hàng.');
    const itemIds = line.itemIds.map(String);
    const duplicated = new Set(itemIds).size !== itemIds.length || itemIds.some((itemId) => seenItems.has(itemId));
    if (duplicated || itemIds.some((itemId) => !isObjectId(itemId))) throw badRequest('Danh sách món trả không hợp lệ hoặc bị trùng.');
    itemIds.forEach((itemId) => seenItems.add(itemId));
    if (line.quantityReturned != null && Number(line.quantityReturned) !== itemIds.length) {
      throw badRequest('Số lượng trả phải bằng số món đã chọn.');
    }
    if (!RETURN_CONDITIONS.includes(line.conditionOnReturn)) throw badRequest('Tình trạng khi trả không hợp lệ.');
    if (!RETURN_DISPOSITIONS.includes(line.disposition)) throw badRequest('Cách xử lý hàng trả không hợp lệ.');
    const unitRefundAmount = line.unitRefundAmount == null ? 0 : Number(line.unitRefundAmount);
    if (!Number.isFinite(unitRefundAmount) || unitRefundAmount < 0) throw badRequest('Số tiền hoàn mỗi món không hợp lệ.');
    const note = String(line.note || '').trim();
    if (note.length > 500) throw badRequest('Ghi chú dòng trả tối đa 500 ký tự.');
    return {
      salesOrderDetailId: String(line.salesOrderDetailId),
      itemIds,
      quantityReturned: itemIds.length,
      conditionOnReturn: line.conditionOnReturn,
      disposition: line.disposition,
      unitRefundAmount,
      note,
    };
  });
  return { returnReason, items };
};

/**
 * Kiểm từng dòng trả với dữ liệu của đơn:
 * - `detailById`: Map id dòng đơn → { _id, variantId, quantity }
 * - `soldItemIdsByVariant`: Map variantId → Set id món đã bán của đơn (từ StockMovement `sale`)
 * - `returnedCountByDetail`: Map id dòng đơn → số món đã nằm trong phiếu trả khác (chưa hủy/từ chối)
 * - `returnedItemIds`: Set id món đã nằm trong phiếu trả khác
 * - `itemById`: Map id món → { _id, variantId, status }
 */
export const checkReturnLines = (lines, {
  detailById, soldItemIdsByVariant, returnedCountByDetail = new Map(), returnedItemIds = new Set(), itemById,
}) => {
  for (const line of lines) {
    const detail = detailById.get(line.salesOrderDetailId);
    if (!detail) throw badRequest('Dòng trả hàng không thuộc đơn bán này.');
    const variantKey = idOf(detail.variantId);
    const sold = soldItemIdsByVariant.get(variantKey) || new Set();
    for (const itemId of line.itemIds) {
      if (!sold.has(itemId)) throw conflict('Có món không nằm trong số món đã bán của dòng hàng này.');
      if (returnedItemIds.has(itemId)) throw conflict('Có món đã được trả ở phiếu trả khác.');
      const item = itemById.get(itemId);
      if (!item || item.status !== 'sold' || idOf(item.variantId) !== variantKey) {
        throw conflict('Có món không còn ở trạng thái đã bán, vui lòng tải lại.');
      }
    }
    const alreadyReturned = returnedCountByDetail.get(line.salesOrderDetailId) || 0;
    if (alreadyReturned + line.quantityReturned > Number(detail.quantity || 0)) {
      throw conflict(`Số lượng trả vượt số đã mua (đã trả ${alreadyReturned}/${detail.quantity}).`);
    }
  }
  return lines;
};

/** Tổng tiền hoàn ghi trên phiếu (chỉ ghi nhận, không thực hiện hoàn tiền). */
export const totalRefundAmount = (lines) => lines.reduce((total, line) => total + line.unitRefundAmount * line.quantityReturned, 0);
