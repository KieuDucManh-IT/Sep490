import api from '../api';

/** Tên sự kiện window phát ra khi số phiếu chênh lệch có thể đã thay đổi (sidebar nghe để đếm lại). */
export const DISCREPANCY_CHANGED_EVENT = 'vestora:discrepancy_changed';

const unwrap = (promise) => promise.then((response) => response?.data ?? response);

function notifyDiscrepancyChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DISCREPANCY_CHANGED_EVENT));
}

/** Backend có thể trả `{ success, data: { count } }` hoặc `{ count }`; trả về số hoặc null nếu không đọc được. */
function readCount(response) {
  const body = response?.data ?? response;
  const count = Number(body?.count);
  if (Number.isFinite(count)) return count;
  return null;
}

const stockDiscrepancyService = {
  list: (params = {}) => unwrap(api.get('/warehouse/discrepancies', { params })).then((rows) => rows || []),
  get: (id) => unwrap(api.get(`/warehouse/discrepancies/${id}`)),
  /** Đếm phiếu chênh lệch theo trạng thái (mặc định `open`), dùng cho viên đếm ở sidebar. */
  count: (status = 'open') => api.get('/warehouse/discrepancies/count', { params: { status } }).then(readCount),
  resolve: async (id, payload) => {
    const result = await unwrap(api.post(`/warehouse/discrepancies/${id}/resolve`, payload));
    notifyDiscrepancyChanged();
    return result;
  },
};

export default stockDiscrepancyService;
