// TASK-015 — Hàm thuần cho bước xếp hàng nhập kho lên kệ (không đọc DB, có unit test).
// Mọi đơn vị thực nhận đều thành món trên kệ:
//   phần nhận tốt (thực nhận − hỏng) → món `available`, tình trạng `new`;
//   phần hỏng → món `unavailable`, tình trạng `damaged` (quyết định 2), xếp kệ và tính sức chứa như hàng thường.

const sumQuantity = (rows) => rows.reduce((total, row) => total + (row.quantity || 0), 0);

/** Trạng thái / tình trạng của món sinh ra theo phần nhận tốt hoặc phần hỏng. */
export const INBOUND_ITEM_STATE = Object.freeze({
  good: Object.freeze({ status: 'available', condition: 'new' }),
  damaged: Object.freeze({ status: 'unavailable', condition: 'damaged' }),
});

/** Số nhận tốt và số hỏng của một dòng phiếu (hỏng không vượt thực nhận). */
export const receivedParts = (detail) => {
  const received = Math.max(0, Number(detail.quantityReceived) || 0);
  const damaged = Math.min(received, Math.max(0, Number(detail.quantityDamaged) || 0));
  return { good: received - damaged, damaged };
};

/**
 * Ghép phân bổ kệ với từng dòng phiếu và kiểm tổng:
 * tổng `allocations` = số nhận tốt, tổng `damagedAllocations` = số hỏng.
 * @param {object[]} details dòng phiếu (có _id, variantId, quantityReceived, quantityDamaged)
 * @param {{ detailId, allocations, damagedAllocations }[]} allocations kết quả validatePutaway
 * @param {(detail) => string} labelOf tên dòng hiển thị trong thông báo lỗi
 * @returns {{ lines: { detail, allocations, damagedAllocations }[], toStore: { detail, storageId, quantity, damaged }[] }}
 */
export const buildPutawayPlan = (details, allocations, labelOf = (detail) => String(detail.variantId)) => {
  const byDetail = new Map(allocations.map((item) => [String(item.detailId), item]));
  const lines = details.map((detail) => {
    const entry = byDetail.get(String(detail._id)) || {};
    return { detail, allocations: entry.allocations || [], damagedAllocations: entry.damagedAllocations || [] };
  });
  for (const line of lines) {
    const parts = receivedParts(line.detail);
    if (sumQuantity(line.allocations) !== parts.good) {
      throw Object.assign(new Error(`Tổng số lượng phân bổ cho ${labelOf(line.detail)} phải bằng số lượng hàng đạt chất lượng (${parts.good}).`), { statusCode: 400 });
    }
    if (sumQuantity(line.damagedAllocations) !== parts.damaged) {
      throw Object.assign(new Error(`Tổng số lượng phân bổ hàng hỏng cho ${labelOf(line.detail)} phải bằng số lượng hỏng (${parts.damaged}).`), { statusCode: 400 });
    }
  }
  const toStore = lines.flatMap((line) => [
    ...line.allocations.map((allocation) => ({ detail: line.detail, ...allocation, damaged: false })),
    ...line.damagedAllocations.map((allocation) => ({ detail: line.detail, ...allocation, damaged: true })),
  ]);
  return { lines, toStore };
};

/** Document InventoryItem cho một phân bổ kệ, mã món lấy từ `itemCodes` (đã sinh theo mẫu `<SKU>-<4 số>`). */
export const inboundItemDocs = ({ line, locationId, itemCodes }) => {
  const state = line.damaged ? INBOUND_ITEM_STATE.damaged : INBOUND_ITEM_STATE.good;
  return itemCodes.slice(0, line.quantity).map((itemCode) => ({
    variantId: line.detail.variantId,
    locationId,
    storageId: line.storageId,
    inboundReceiptDetail: line.detail._id,
    itemCode,
    ...state,
  }));
};
