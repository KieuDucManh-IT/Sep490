/**
 * Hàm thuần cho luồng trả hàng chi nhánh → kho tổng:
 * requested → approved → shipped → receipt_submitted → receipt_approved → completed.
 * Mọi sản phẩm quản lý theo từng món (TASK-015): số lượng nhận / xếp kệ = số món.
 */
import { defaultReceipt } from '../../../components/warehouse/itemSelectionRules';
import { idOf } from '../shared/slipHelpers';

export const emptyReturnLine = () => ({ variantId: '', quantityRequested: 1 });

/** Số lượng hàng tốt cần xếp kệ của một dòng (thực nhận - hỏng). */
export const acceptedQuantity = (line) => Math.max(0, (line.quantityReceived || 0) - (line.quantityDamaged || 0));

export const sumQuantity = (rows = []) => rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);

/** Kiểm tra phiếu trả trước khi gửi; trả message lỗi hoặc ''. */
export function validateCreateLines(branchId, lines) {
  if (!branchId) return 'Chọn chi nhánh hiện tại trên thanh điều hướng trước khi tạo phiếu.';
  const validLines = lines.filter((line) => line.variantId
    && Number.isInteger(Number(line.quantityRequested))
    && Number(line.quantityRequested) > 0);
  if (validLines.length !== lines.length) return 'Chọn đủ biến thể và nhập số lượng nguyên lớn hơn 0 cho từng dòng.';
  const variantIds = validLines.map((line) => line.variantId);
  if (new Set(variantIds).size !== variantIds.length) return 'Mỗi biến thể chỉ được xuất hiện một lần trong phiếu trả.';
  return '';
}

export const buildCreatePayload = (branchId, lines) => ({
  branchId,
  items: lines.map(({ variantId, quantityRequested }) => ({ variantId, quantityRequested: Number(quantityRequested) })),
});

/** Số lượng duyệt mặc định = số đã duyệt trước đó hoặc số yêu cầu. */
export const initialApproval = (transfer) => Object.fromEntries((transfer.items || [])
  .map((line) => [line._id, String(line.quantityApproved ?? line.quantityRequested)]));

/** Kết quả nhận mặc định: giữ kết quả đã ghi, chưa có thì mọi món đã gửi là "nhận tốt". */
export const initialReceipt = (transfer) => Object.fromEntries((transfer.items || []).map((line) => [
  line._id,
  defaultReceipt({
    shippedIds: (line.itemIds || []).map(idOf),
    receivedIds: (line.receivedItemIds || []).map(idOf),
    damagedIds: (line.damagedItemIds || []).map(idOf),
  }),
]));

/** Phân bổ kệ đã lưu, nếu chưa có thì một dòng trống chứa toàn bộ hàng tốt. */
export const initialAllocations = (transfer) => Object.fromEntries((transfer.items || []).map((line) => {
  const accepted = acceptedQuantity(line);
  const saved = (line.putawayAllocations || []).map((row) => ({
    storageId: idOf(row.storageId),
    quantity: String(row.quantity),
    itemIds: (row.itemIds || []).map(idOf),
  }));
  if (saved.length) return [line._id, saved];
  if (accepted) return [line._id, [{ storageId: '', quantity: String(accepted), itemIds: [] }]];
  return [line._id, []];
}));

export const buildDecisionItems = (transfer, approval) => (transfer.items || []).map((line) => ({
  detailId: line._id,
  quantityApproved: Number(approval[line._id] ?? line.quantityRequested),
}));

/** Kết quả nhận: số nhận / hỏng = số món đã đánh dấu. */
export const buildReceiptItems = (transfer, receipt) => transfer.items.map((line) => {
  const data = receipt[line._id] || {};
  const receivedItemIds = data.receivedItemIds || [];
  const damagedItemIds = data.damagedItemIds || [];
  return {
    detailId: line._id,
    quantityReceived: receivedItemIds.length,
    quantityDamaged: damagedItemIds.length,
    receivedItemIds,
    damagedItemIds,
  };
});

/** Món tốt (đã nhận, không hỏng) của một dòng, theo thứ tự nhận. */
export const acceptedItems = (line) => {
  const damagedIds = new Set((line.damagedItemIds || []).map(idOf));
  return (line.receivedItemIds || []).filter((item) => !damagedIds.has(idOf(item)));
};

/**
 * Chia lần lượt các món tốt vào từng kệ theo số lượng nhập.
 * @returns {{ storageId: string, quantity: number, items: Array<object|string> }[]}
 */
export const splitAcceptedItems = (line, rows = []) => {
  const accepted = acceptedItems(line);
  let cursor = 0;
  return rows.map((row) => {
    const count = Math.max(0, Number(row.quantity) || 0);
    const items = accepted.slice(cursor, cursor + count);
    cursor += count;
    return { storageId: row.storageId, quantity: count, items };
  });
};

/** Xếp kệ: mỗi kệ nhận các món tốt theo thứ tự (itemIds bắt buộc). */
export const buildPutawayItems = (transfer, allocations) => transfer.items.map((line) => {
  const rows = (allocations[line._id] || []).filter((row) => row.storageId && Number(row.quantity) > 0);
  return {
    detailId: line._id,
    allocations: splitAcceptedItems(line, rows).map((row) => ({
      storageId: row.storageId, quantity: row.quantity, itemIds: row.items.map(idOf),
    })),
  };
});
