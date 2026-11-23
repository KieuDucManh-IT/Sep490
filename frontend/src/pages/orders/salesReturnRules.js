/**
 * Hàm thuần cho form trả hàng bán (TASK-015/016): chọn món trong số món đã bán của dòng đơn và ghi kết quả kiểm
 * theo món (Đạt / Cần xử lý, mặc định Đạt). Không dùng JSX / React để chạy được bằng node khi test.
 */
import { fillItemIds } from '../../components/warehouse/itemSelectionRules';

const idOf = (value) => String(value?._id || value || '');

/** Một dòng trả trống: chưa chọn món, kết quả theo món (món không ghi = Đạt). */
export const emptyReturnLine = () => ({ itemIds: [], results: {}, note: '' });

export const initialReturnLines = (returnable = []) => Object.fromEntries(returnable.map((line) => [
  idOf(line.salesOrderDetailId), emptyReturnLine(),
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

/** Kết quả kiểm của một món: 'ok' (mặc định) hoặc 'needs_service'. */
export const resultOf = (value, itemId) => value.results?.[itemId] || 'ok';

export const setItemResult = (value, itemId, result) => ({ ...value, results: { ...(value.results || {}), [itemId]: result } });

/** Kiểm tra form; trả message lỗi hoặc ''. */
export function validateReturnForm(reason, lines) {
  if (!String(reason || '').trim()) return 'Nhập lý do trả hàng.';
  if (!Object.values(lines).some((value) => value.itemIds.length > 0)) return 'Chọn ít nhất một món khách trả.';
  return '';
}

/** Dữ liệu gửi `POST /sales-orders/:id/returns` (chỉ dòng có món được chọn; chỉ gửi kết quả của món đã chọn). */
export const buildReturnPayload = (reason, lines) => ({
  returnReason: String(reason).trim(),
  items: Object.entries(lines)
    .filter(([, value]) => value.itemIds.length > 0)
    .map(([salesOrderDetailId, value]) => ({
      salesOrderDetailId,
      itemIds: value.itemIds,
      inspectionResults: value.itemIds.map((itemId) => ({ itemId, result: resultOf(value, itemId) })),
      note: value.note?.trim() || undefined,
    })),
});
