/** Hàm thuần cho màn chênh lệch điều chuyển: kiểm tra form kết luận và tạo dữ liệu gửi API. */
import { codeAndName, idOf } from '../shared/slipHelpers';

export const emptyResolveForm = () => ({
  outcome: 'found',
  quantity: '',
  itemIds: [],
  target: '',
  targetStorageId: '',
  responsibleParty: '',
  note: '',
});

/** Bộ lọc trạng thái; `pending` = đang điều tra, gồm cả phiếu đã xử lý một phần. */
export const DISCREPANCY_FILTER_OPTIONS = [
  ['pending', 'Đang điều tra (gồm xử lý một phần)'],
  ['open', 'Đang điều tra'],
  ['partially_resolved', 'Đã xử lý một phần'],
  ['resolved', 'Đã xử lý'],
  ['', 'Tất cả'],
];

/** Hiển thị thông điệp lỗi dễ hiểu (403 → không có quyền). */
export function permissionMessage(error) {
  if (error?.status === 403) return 'Bạn không có quyền thực hiện thao tác này với phiếu chênh lệch.';
  return error?.message || 'Đã có lỗi xảy ra.';
}

/** Số lượng còn đang điều tra (chưa kết luận). */
export const remainingQuantity = (discrepancy) => {
  if (!discrepancy) return 0;
  return discrepancy.quantityMissing - (discrepancy.quantityResolved || 0);
};

export const isIndividualDiscrepancy = (discrepancy) => discrepancy?.trackingType === 'individual';

/** Nơi nhập lại hàng tìm thấy: nơi nhận ban đầu (nếu không phải kho tổng) hoặc kho tổng. */
export function targetOptions(discrepancy, centralId) {
  if (!discrepancy) return [];
  const original = codeAndName(discrepancy.toLocationId);
  const originalIsCentral = idOf(discrepancy.toLocationId) === centralId;
  if (originalIsCentral) return [{ value: 'central', label: `Kho tổng — nơi nhận ban đầu (${original})` }];
  return [
    { value: 'original', label: `Nơi nhận ban đầu (${original})` },
    { value: 'central', label: 'Kho tổng' },
  ];
}

/** Số lượng đang kết luận: hàng theo mã = số món đã chọn, hàng số lượng = số đã nhập. */
export function resolveQuantity(discrepancy, form) {
  if (isIndividualDiscrepancy(discrepancy)) return form.itemIds.length;
  return Number(form.quantity);
}

function quantityError(discrepancy, quantity) {
  if (isIndividualDiscrepancy(discrepancy)) {
    if (quantity < 1) return 'Chọn ít nhất một món hàng.';
  } else if (!Number.isInteger(quantity) || quantity < 1) {
    return 'Nhập số lượng nguyên lớn hơn 0.';
  }
  const remaining = remainingQuantity(discrepancy);
  if (quantity > remaining) return `Số lượng không được vượt số còn đang điều tra (${remaining}).`;
  return '';
}

function outcomeError(form, centralId) {
  if (form.outcome === 'found') {
    if (!form.target) return 'Chọn nơi nhập lại.';
    if (form.target === 'central' && !centralId) return 'Chưa xác định duy nhất một kho tổng đang hoạt động.';
    if (form.target === 'central' && !form.targetStorageId) return 'Chọn kệ trong kho tổng.';
    return '';
  }
  if (!form.responsibleParty) return 'Chọn bên chịu trách nhiệm.';
  if (!form.note.trim()) return 'Nhập ghi chú cho kết luận mất hàng.';
  return '';
}

/** Kiểm tra form kết luận; trả message cần sửa hoặc ''. */
export function validateResolveForm(discrepancy, form, centralId) {
  if (!discrepancy) return '';
  const quantity = resolveQuantity(discrepancy, form);
  const message = quantityError(discrepancy, quantity) || outcomeError(form, centralId);
  if (message) return message;
  if (form.note.trim().length > 1000) return 'Ghi chú tối đa 1000 ký tự.';
  return '';
}

/** Dữ liệu gửi API kết luận (giữ đúng định dạng backend đang nhận). */
export function buildResolvePayload(discrepancy, form, centralId) {
  const amount = isIndividualDiscrepancy(discrepancy)
    ? { itemIds: form.itemIds }
    : { quantity: resolveQuantity(discrepancy, form) };
  const note = form.note.trim();
  if (form.outcome === 'lost') {
    return { outcome: 'lost', ...amount, responsibleParty: form.responsibleParty, note };
  }
  const toCentral = form.target === 'central';
  return {
    outcome: 'found',
    ...amount,
    targetLocationId: toCentral ? centralId : idOf(discrepancy.toLocationId),
    targetStorageId: toCentral ? form.targetStorageId : null,
    note,
  };
}
