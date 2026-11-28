/** Hàm thuần cho quy trình nhập kho từ nhà cung cấp: tạo phiếu → tiếp nhận → duyệt → xếp hàng lên kệ. */
import { formatVariantName } from '../../../constants/warehouseLabels';
import { idOf } from '../shared/slipHelpers';

/** Chủ kho được hủy phiếu khi phiếu chưa hoàn tất / chưa bị từ chối. */
export const CANCELLABLE_STATUSES = ['awaiting_receiving', 'received', 'approved'];

export const emptyLine = () => ({ variantId: '', quantityExpected: '', unitCost: '' });

/** Tên mặt hàng của một dòng phiếu: "Tên · SKU · size · màu". */
export const lineName = (line) => formatVariantName(line.variantId) || 'Mặt hàng';

/** Số lượng hàng đạt chất lượng của một dòng (nhận - hỏng), không âm. */
export const acceptedQuantity = (line) => Math.max(0, line.quantityReceived - line.quantityDamaged);

export const sumAllocated = (allocations = []) => allocations
  .reduce((total, allocation) => total + (Number(allocation.quantity) || 0), 0);

const isPositiveInteger = (value) => Number.isInteger(Number(value)) && Number(value) >= 1;
const isNonNegativeInteger = (value) => Number.isInteger(Number(value)) && Number(value) >= 0;
const isNonNegativeNumber = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;

/** Kiểm tra form tạo phiếu; trả message lỗi hoặc ''. */
export function validateCreate({ centralLocation, supplierId, assignedStaffId, lines }) {
  if (!centralLocation?._id) return 'Cần cấu hình duy nhất một kho tổng đang hoạt động.';
  const invalidLine = lines.some((line) => !line.variantId
    || !isPositiveInteger(line.quantityExpected)
    || line.unitCost === ''
    || !isNonNegativeNumber(line.unitCost));
  if (!supplierId || !assignedStaffId || invalidLine) {
    return 'Hãy chọn nhà cung cấp, nhân viên và nhập đầy đủ số lượng / giá hợp lệ cho từng dòng.';
  }
  return '';
}

export function buildCreatePayload({ centralLocation, supplierId, assignedStaffId, note, lines }) {
  return {
    locationId: centralLocation._id,
    supplierId,
    assignedStaffId,
    note,
    items: lines.map((line) => ({
      variantId: line.variantId,
      quantityExpected: Number(line.quantityExpected),
      unitCost: Number(line.unitCost),
    })),
  };
}

/**
 * Dòng ghi nhận ban đầu. Phiếu bị yêu cầu kiểm nhận lại (recountCount > 0) điền sẵn số đã nhận / hỏng lần trước
 * để nhân viên sửa; phiếu mới mặc định nhận đủ số dự kiến, không hỏng (TASK-015: chỉ sửa chỗ khác thường).
 */
export const initialReceiveLines = (receipt) => {
  const prefill = receipt.recountCount > 0;
  return receipt.items.map((item) => ({
    detailId: item._id,
    quantityReceived: prefill ? item.quantityReceived ?? '' : item.quantityExpected ?? '',
    quantityDamaged: prefill ? item.quantityDamaged ?? 0 : 0,
    note: item.note || '',
  }));
};

/** Số nhận và số hỏng phải là số nguyên không âm; số hỏng không lớn hơn số nhận. */
export function validateReceive(lines) {
  const invalid = lines.some((line) => line.quantityReceived === ''
    || line.quantityReceived == null
    || !isNonNegativeInteger(line.quantityReceived)
    || !isNonNegativeInteger(line.quantityDamaged)
    || Number(line.quantityDamaged) > Number(line.quantityReceived));
  if (invalid) return 'Số lượng nhận và hỏng phải là số nguyên không âm; số hỏng không được lớn hơn số nhận.';
  return '';
}

export const buildReceivePayload = (lines) => ({
  items: lines.map((line) => ({
    ...line,
    quantityReceived: Number(line.quantityReceived),
    quantityDamaged: Number(line.quantityDamaged),
  })),
});

/** Phân bổ kệ đã lưu trước đó (nếu có), nếu không thì một dòng trống chứa toàn bộ số cần xếp. */
function savedAllocations(saved = [], total, fallbackStorageId) {
  if (saved.length) {
    return saved.map((allocation) => ({ storageId: idOf(allocation.storageId), quantity: allocation.quantity }));
  }
  if (fallbackStorageId) return [{ storageId: idOf(fallbackStorageId), quantity: total }];
  if (total > 0) return [{ storageId: '', quantity: total }];
  return [];
}

/**
 * Mỗi đơn vị thực nhận thành một món trên kệ (TASK-015): phần tốt xếp theo `allocations`,
 * phần hỏng xếp theo `damagedAllocations` (món hỏng vẫn chiếm chỗ trên kệ).
 */
export const initialPutawayLines = (receipt) => receipt.items.map((item) => {
  const accepted = acceptedQuantity(item);
  const damaged = Math.max(0, Number(item.quantityDamaged || 0));
  return {
    detailId: item._id,
    accepted,
    damaged,
    allocations: savedAllocations(item.storageAllocations, accepted, item.storageId),
    damagedAllocations: savedAllocations(item.damagedStorageAllocations, damaged),
  };
});

const allocationsInvalid = (allocations, total) => sumAllocated(allocations) !== total
  || allocations.some((allocation) => !allocation.storageId || !(Number(allocation.quantity) > 0));

/** Tổng phân bổ phần tốt / phần hỏng phải khớp số tương ứng; mọi dòng phân bổ phải có kệ, số lượng > 0. */
export function validatePutaway(lines) {
  if (lines.some((line) => allocationsInvalid(line.allocations, line.accepted))) {
    return 'Tổng số món phân bổ và kệ phải khớp với số hàng đạt chất lượng.';
  }
  if (lines.some((line) => allocationsInvalid(line.damagedAllocations || [], line.damaged || 0))) {
    return 'Hàng hỏng cũng được xếp lên kệ: tổng số món hỏng phân bổ phải khớp số hỏng.';
  }
  return '';
}

const toPayloadAllocations = (allocations = []) => allocations
  .map(({ storageId, quantity }) => ({ storageId, quantity: Number(quantity) }));

export const buildPutawayPayload = (lines) => ({
  items: lines.map(({ detailId, allocations, damagedAllocations, damaged }) => {
    const item = { detailId, allocations: toPayloadAllocations(allocations) };
    if (damaged > 0) item.damagedAllocations = toPayloadAllocations(damagedAllocations);
    return item;
  }),
});

const positionsText = (allocations) => allocations
  .map((allocation) => `${allocation.storageId?.code || 'Kệ'} (${allocation.quantity})`)
  .join(', ');

/** Vị trí đã xếp của một dòng, ví dụ "K-01 (5), K-02 (3) · hỏng: K-03 (1)". */
export function storedPositions(item) {
  let text = item.storageId?.code || 'Chưa xếp';
  if (item.storageAllocations?.length) text = positionsText(item.storageAllocations);
  if (item.damagedStorageAllocations?.length) text += ` · hỏng: ${positionsText(item.damagedStorageAllocations)}`;
  return text;
}
export const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;
