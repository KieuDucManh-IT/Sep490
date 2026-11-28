import { API_BASE } from './api';
const PRESETS = ['TODAY', 'WEEK', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM'];
const messages = { 400: 'Kỳ báo cáo không hợp lệ.', 401: 'Bạn cần đăng nhập để xem báo cáo.', 403: 'Bạn không có quyền xem báo cáo chủ shop.' };

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-004 */
export function ownerPerformanceQuery(filters = {}) {
  const timeRange = filters.timeRange || 'MONTH';
  if (!PRESETS.includes(timeRange)) throw Object.assign(new Error(messages[400]), { status: 400 });
  const params = new URLSearchParams({ timeRange });
  if (timeRange === 'CUSTOM') {
    for (const key of ['startDate', 'endDate']) {
      if (typeof filters[key] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(filters[key])) throw Object.assign(new Error(messages[400]), { status: 400 });
      params.set(key, filters[key]);
    }
  }
  return params.toString();
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-019 */
export async function fetchOwnerPerformanceReport(filters, { signal } = {}) {
  const query = ownerPerformanceQuery(filters), headers = { Accept: 'application/json' };
  try { const token = localStorage.getItem('token'); if (token) headers.Authorization = `Bearer ${token}`; } catch (_) {}
  try {
    const response = await fetch(`${API_BASE}/api/shops/reports/owner-performance?${query}`, { method: 'GET', credentials: 'include', headers, signal });
    if (!response.ok) throw Object.assign(new Error(messages[response.status] || 'Không thể tải báo cáo. Vui lòng thử lại.'), { status: response.status });
    const payload = await response.json();
    if (payload?.success !== true || !payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) throw new Error('Invalid report');
    return payload.data;
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw Object.assign(new Error(messages[error.status] || 'Không thể tải báo cáo. Vui lòng thử lại.'), { status: error.status || 0 });
  }
}
