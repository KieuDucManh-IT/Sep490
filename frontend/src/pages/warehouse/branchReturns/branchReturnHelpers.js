/**
 * Hàm thuần cho luồng trả hàng chi nhánh → kho tổng:
 * requested → approved → shipped → receipt_submitted → receipt_approved → completed.
 */
import { idOf } from '../shared/slipHelpers';

export const emptyReturnLine = () => ({ variantId: '', quantityRequested: 1 });

/** Dòng hàng theo mã (mỗi món có mã riêng) thì kiểm nhận bằng cách tick từng món. */
export const isIndividualLine = (line) => line.variantId?.productId?.trackingType === 'individual';

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

export const initialReceipt = (transfer) => Object.fromEntries((transfer.items || []).map((line) => [line._id, {
  quantityReceived: String(line.quantityReceived || 0),
  quantityDamaged: String(line.quantityDamaged || 0),
  receivedItemIds: (line.receivedItemIds || []).map(idOf),
  damagedItemIds: (line.damagedItemIds || []).map(idOf),
}]));

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

/** Kết quả nhận: hàng theo mã lấy số món đã tick, hàng số lượng lấy số đã nhập. */
export const buildReceiptItems = (transfer, receipt) => transfer.items.map((line) => {
  const data = receipt[line._id] || {};
  const individual = isIndividualLine(line);
  const receivedItemIds = individual ? (data.receivedItemIds || []) : [];
  const damagedItemIds = individual ? (data.damagedItemIds || []) : [];
  return {
    detailId: line._id,
    quantityReceived: individual ? receivedItemIds.length : Number(data.quantityReceived || 0),
    quantityDamaged: individual ? damagedItemIds.length : Number(data.quantityDamaged || 0),
    receivedItemIds,
    damagedItemIds,
  };
});

/** Xếp kệ: với hàng theo mã, chia lần lượt các món tốt (đã nhận, không hỏng) vào từng kệ theo số lượng. */
export const buildPutawayItems = (transfer, allocations) => transfer.items.map((line) => {
  const individual = isIndividualLine(line);
  const damagedIds = (line.damagedItemIds || []).map(idOf);
  const acceptedIds = (line.receivedItemIds || []).map(idOf).filter((itemId) => !damagedIds.includes(itemId));
  let cursor = 0;
  const rows = (allocations[line._id] || [])
    .filter((row) => row.storageId && Number(row.quantity) > 0)
    .map((row) => {
      const count = Number(row.quantity);
      const itemIds = individual ? acceptedIds.slice(cursor, cursor + count) : [];
      cursor += count;
      return { storageId: row.storageId, quantity: count, itemIds };
    });
  return { detailId: line._id, allocations: rows };
});

/** Bật / tắt một món trong danh sách id (giữ thứ tự). */
export const toggleId = (ids, id, checked) => (checked ? [...ids, id] : ids.filter((value) => value !== id));
