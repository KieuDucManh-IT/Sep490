/**
 * Hàm thuần cho form trả hàng bán (TASK-015): chọn món trong số món đã bán của đơn,
 * tình trạng khi trả và cách xử lý. Không dùng JSX / React để chạy được bằng node khi test.
 */
import { fillItemIds } from '../../components/warehouse/itemSelectionRules';

const idOf = (value) => String(value?._id || value || '');

/** Mặc định mỗi dòng: chưa chọn món, tình trạng "Tốt", xử lý "Nhập lại kho". */
export const initialReturnLines = (returnable = []) => Object.fromEntries(returnable.map((line) => [
  idOf(line.salesOrderDetailId),
  { itemIds: [], conditionOnReturn: 'good', disposition: 'restock', note: '' },
]));

/** Nhập số món trả: tự chọn các món đầu danh sách (giữ món đã chọn), người dùng sửa được. */
export const setReturnCount = (value, line, count) => ({
  ...value,
  itemIds: fillItemIds(value.itemIds, line.items || [], Math.min(Number(count) || 0, (line.items || []).length)),
});

/** Bật / tắt một món trong dòng trả. */
export const toggleReturnItem = (value, itemId, checked) => ({
  ...value,
  itemIds: checked ? [...value.itemIds, itemId] : value.itemIds.filter((id) => id !== itemId),
});

/** Kiểm tra form; trả message lỗi hoặc ''. */
export function validateReturnForm(reason, lines) {
  if (!String(reason || '').trim()) return 'Nhập lý do trả hàng.';
  if (!Object.values(lines).some((value) => value.itemIds.length > 0)) return 'Chọn ít nhất một món khách trả.';
  return '';
}

/** Dữ liệu gửi `POST /sales-orders/:id/returns` (chỉ dòng có món được chọn). */
export const buildReturnPayload = (reason, lines) => ({
  returnReason: String(reason).trim(),
  items: Object.entries(lines)
    .filter(([, value]) => value.itemIds.length > 0)
    .map(([salesOrderDetailId, value]) => ({
      salesOrderDetailId,
      itemIds: value.itemIds,
      conditionOnReturn: value.conditionOnReturn,
      disposition: value.disposition,
      note: value.note?.trim() || undefined,
    })),
});
