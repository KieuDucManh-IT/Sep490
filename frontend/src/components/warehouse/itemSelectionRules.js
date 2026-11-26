/**
 * Hàm thuần cho giao diện theo món (TASK-015 D): mọi sản phẩm quản lý theo từng món có mã hàng.
 * Người dùng không phải tích từng món: hệ thống tự điền / mặc định, người dùng chỉ sửa chỗ khác thường.
 * Không dùng JSX / React để chạy được bằng node khi test.
 */

const idOf = (value) => String(value?._id || value || '');

/** Mã hiển thị của một món hàng. */
export const itemCodeOf = (item) => item?.itemCode || item?.serialNumber || idOf(item).slice(-6);

/**
 * Tự điền danh sách món cho một vị trí lấy hàng:
 * giữ các món đã chọn còn nằm trong danh sách ứng viên, thêm món ứng viên theo thứ tự (FIFO từ API)
 * cho tới khi đủ `count`, bỏ bớt nếu đang chọn thừa.
 * @param {string[]} currentIds món đang chọn
 * @param {Array<object|string>} candidates món ứng viên tại vị trí (thứ tự API trả)
 * @param {number} count số món cần
 * @returns {string[]}
 */
export function fillItemIds(currentIds = [], candidates = [], count = 0) {
  const candidateIds = candidates.map(idOf);
  const candidateSet = new Set(candidateIds);
  const kept = currentIds.map(String).filter((id) => candidateSet.has(id));
  const keptSet = new Set(kept);
  const extra = candidateIds.filter((id) => !keptSet.has(id));
  return [...kept, ...extra].slice(0, Math.max(0, Number(count) || 0));
}

/**
 * Nhóm món theo kệ để hiển thị gọn "Kệ A-01-03: 4 món".
 * @param {object[]} items món (có `storageId` populate hoặc id)
 * @param {(storage: object|string) => string} [storageLabel] tên hiển thị của kệ
 * @returns {{ key: string, label: string, items: object[] }[]}
 */
export function groupItemsByStorage(items = [], storageLabel) {
  const groups = new Map();
  for (const item of items) {
    const storage = item?.storageId;
    const key = idOf(storage) || 'none';
    if (!groups.has(key)) {
      const label = storageLabel ? storageLabel(storage) : (storage?.code || '');
      groups.set(key, { key, label: label || 'Chưa gán kệ', items: [] });
    }
    groups.get(key).items.push(item);
  }
  return [...groups.values()];
}

/* ---------------- Nhận hàng theo món ---------------- */

/** Trạng thái nhận của một món: nhận tốt / hỏng / thiếu. */
export const RECEIPT_STATES = ['good', 'damaged', 'missing'];

/**
 * Kết quả nhận mặc định của một dòng: nếu đã ghi nhận trước đó thì giữ nguyên,
 * chưa có thì coi mọi món đã xuất là "nhận tốt".
 * @param {{ shippedIds: string[], receivedIds?: string[], damagedIds?: string[] }} input
 * @returns {{ receivedItemIds: string[], damagedItemIds: string[] }}
 */
export function defaultReceipt({ shippedIds = [], receivedIds = [], damagedIds = [] }) {
  if (receivedIds.length) return { receivedItemIds: receivedIds.map(String), damagedItemIds: damagedIds.map(String) };
  return { receivedItemIds: shippedIds.map(String), damagedItemIds: [] };
}

/** Trạng thái nhận hiện tại của một món trong kết quả nhận. */
export function receiptStateOf(entry, itemId) {
  const id = String(itemId);
  if (!(entry?.receivedItemIds || []).includes(id)) return 'missing';
  if ((entry?.damagedItemIds || []).includes(id)) return 'damaged';
  return 'good';
}

/**
 * Đổi trạng thái nhận của một món, giữ thứ tự các danh sách.
 * @returns {{ receivedItemIds: string[], damagedItemIds: string[] }}
 */
export function setReceiptState(entry, itemId, state) {
  const id = String(itemId);
  const received = (entry?.receivedItemIds || []).filter((value) => value !== id);
  const damaged = (entry?.damagedItemIds || []).filter((value) => value !== id);
  if (state === 'good') received.push(id);
  if (state === 'damaged') {
    received.push(id);
    damaged.push(id);
  }
  return { ...entry, receivedItemIds: received, damagedItemIds: damaged };
}

/** Đếm số món nhận tốt / hỏng / thiếu trên tổng số món đã xuất. */
export function receiptCounts(entry, shippedCount) {
  const received = (entry?.receivedItemIds || []).length;
  const damaged = (entry?.damagedItemIds || []).length;
  return { good: received - damaged, damaged, missing: Math.max(0, Number(shippedCount || 0) - received) };
}

/**
 * Món bị khóa trạng thái (đã ghi nhận ở lần nhận trước, không được bỏ):
 * món đã nhận thì không chọn "thiếu"; món đã báo hỏng thì chỉ còn "hỏng".
 * @returns {string[]} các trạng thái được phép
 */
export function allowedReceiptStates(itemId, previous = {}) {
  const id = String(itemId);
  if ((previous.damagedIds || []).map(String).includes(id)) return ['damaged'];
  if ((previous.receivedIds || []).map(String).includes(id)) return ['good', 'damaged'];
  return RECEIPT_STATES;
}
