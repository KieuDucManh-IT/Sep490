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

/** Dòng ghi nhận thực nhận ban đầu cho từng dòng phiếu. */
export const initialReceiveLines = (receipt) => receipt.items.map((item) => ({
  detailId: item._id,
  quantityReceived: '',
  quantityDamaged: 0,
  note: item.note || '',
}));

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

/** Phân bổ kệ đã lưu trước đó (nếu có), nếu không thì một dòng trống chứa toàn bộ hàng tốt. */
function savedAllocations(item, accepted) {
  if (item.storageAllocations?.length) {
    return item.storageAllocations.map((allocation) => ({
      storageId: idOf(allocation.storageId),
      quantity: allocation.quantity,
    }));
  }
  if (item.storageId) return [{ storageId: idOf(item.storageId), quantity: accepted }];
  return [];
}

export const initialPutawayLines = (receipt) => receipt.items.map((item) => {
  const accepted = acceptedQuantity(item);
  const saved = savedAllocations(item, accepted);
  let allocations = saved;
  if (!saved.length && accepted > 0) allocations = [{ storageId: '', quantity: accepted }];
  return { detailId: item._id, allocations, accepted };
});

/** Tổng phân bổ phải khớp số hàng tốt và mọi dòng phân bổ phải có kệ, số lượng > 0. */
export function validatePutaway(lines) {
  const invalid = lines.find((line) => sumAllocated(line.allocations) !== line.accepted
    || line.allocations.some((allocation) => !allocation.storageId || !(Number(allocation.quantity) > 0)));
  if (invalid) return 'Tổng số lượng phân bổ và kệ phải khớp với số lượng hàng đạt chất lượng.';
  return '';
}

export const buildPutawayPayload = (lines) => ({
  items: lines.map(({ detailId, allocations }) => ({
    detailId,
    allocations: allocations.map(({ storageId, quantity }) => ({ storageId, quantity: Number(quantity) })),
  })),
});

/** Vị trí đã xếp của một dòng, ví dụ "K-01 (5), K-02 (3)". */
export function storedPositions(item) {
  if (item.storageAllocations?.length) {
    return item.storageAllocations
      .map((allocation) => `${allocation.storageId?.code || 'Kệ'} (${allocation.quantity})`)
      .join(', ');
  }
  return item.storageId?.code || 'Chưa xếp';
}

export const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} ₫`;
