// TASK-015/016 — Hàm thuần cho đơn bán theo món và trả hàng bán (không đọc DB, có unit test).
// TASK-016 C: món đã bán ghi ở `SalesOrderDetail.itemIds`. Món được trả phải nằm trong `itemIds` của dòng đơn,
// còn `sold` và chưa nằm trong phiếu trả khác. Số món của mỗi dòng = `quantityReturned`.
// Kết quả kiểm theo món: Đạt → available; Cần xử lý → unavailable (tại chi nhánh của đơn, không kệ).

export const SALES_RETURN_RESULTS = Object.freeze(['ok', 'needs_service']);

/** Trạng thái món sau khi nhận trả theo kết quả kiểm. */
export const returnedItemStatus = (result) => (result === 'needs_service' ? 'unavailable' : 'available');

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400, status: 400 });
const conflict = (message) => Object.assign(new Error(message), { statusCode: 409, status: 409 });
const idOf = (value) => String(value?._id || value || '');
const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));

/**
 * Chia các món đã bán của MỘT biến thể cho các dòng đơn cùng biến thể, theo thứ tự dòng và `quantity` của từng dòng.
 * Trả về [{ detailId, itemIds }]. Thiếu món → dòng sau nhận ít hơn (caller đã chặn thiếu từ trước).
 */
export const splitItemsByLines = (details, items) => {
  const queue = [...(items || [])];
  return (details || []).map((detail) => ({
    detailId: detail._id,
    itemIds: queue.splice(0, Math.max(0, Number(detail.quantity) || 0)).map((item) => item._id),
  }));
};

/** Kết quả kiểm theo món: `inspectionResults` [{ itemId, result }]; món không ghi → Đạt. */
const parseInspection = (line, itemIds) => {
  const raw = Array.isArray(line.inspectionResults) ? line.inspectionResults : [];
  const byItem = new Map();
  for (const row of raw) {
    const itemId = String(row?.itemId || '');
    if (!itemIds.includes(itemId)) throw badRequest('Kết quả kiểm có món không nằm trong danh sách trả.');
    if (!SALES_RETURN_RESULTS.includes(row.result)) throw badRequest('Kết quả kiểm món trả phải là Đạt hoặc Cần xử lý.');
    byItem.set(itemId, row.result);
  }
  return itemIds.map((itemId) => ({ itemId, result: byItem.get(itemId) || 'ok' }));
};

/**
 * Đọc payload tạo phiếu trả: { returnReason, items: [{ salesOrderDetailId, itemIds, inspectionResults?, unitRefundAmount?, note? }] }.
 * Trả về dữ liệu đã chuẩn hóa hoặc ném 400.
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
    const unitRefundAmount = line.unitRefundAmount == null ? 0 : Number(line.unitRefundAmount);
    if (!Number.isFinite(unitRefundAmount) || unitRefundAmount < 0) throw badRequest('Số tiền hoàn mỗi món không hợp lệ.');
    const note = String(line.note || '').trim();
    if (note.length > 500) throw badRequest('Ghi chú dòng trả tối đa 500 ký tự.');
    return {
      salesOrderDetailId: String(line.salesOrderDetailId),
      itemIds,
      quantityReturned: itemIds.length,
      inspectionResults: parseInspection(line, itemIds),
      unitRefundAmount,
      note,
    };
  });
  return { returnReason, items };
};

/**
 * Kiểm từng dòng trả với dữ liệu của đơn:
 * - `detailById`: Map id dòng đơn → { _id, variantId, quantity, itemIds }
 * - `returnedCountByDetail`: Map id dòng đơn → số món đã nằm trong phiếu trả khác (chưa hủy/từ chối)
 * - `returnedItemIds`: Set id món đã nằm trong phiếu trả khác
 * - `itemById`: Map id món → { _id, variantId, status }
 */
export const checkReturnLines = (lines, {
  detailById, returnedCountByDetail = new Map(), returnedItemIds = new Set(), itemById,
}) => {
  for (const line of lines) {
    const detail = detailById.get(line.salesOrderDetailId);
    if (!detail) throw badRequest('Dòng trả hàng không thuộc đơn bán này.');
    const variantKey = idOf(detail.variantId);
    const sold = new Set((detail.itemIds || []).map(idOf));
    if (!sold.size) throw conflict('Dòng hàng chưa có danh sách món đã bán (đơn cũ chưa được điền món); không trả theo món được.');
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

/** Món còn trả được của một dòng đơn: trong `itemIds`, đang `sold`, chưa nằm trong phiếu trả có hiệu lực. */
export const returnableItemsOf = (detail, items, returnedItemIds = new Set()) => {
  const sold = new Set((detail.itemIds || []).map(idOf));
  return (items || []).filter((item) => sold.has(idOf(item._id)) && item.status === 'sold' && !returnedItemIds.has(idOf(item._id)));
};

/** Tổng tiền hoàn ghi trên phiếu (chỉ ghi nhận, không thực hiện hoàn tiền). */
export const totalRefundAmount = (lines) => lines.reduce((total, line) => total + line.unitRefundAmount * line.quantityReturned, 0);
