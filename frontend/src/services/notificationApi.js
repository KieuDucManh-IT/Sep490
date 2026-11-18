let rawApiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
if (rawApiUrl.includes(':5001')) {
  rawApiUrl = rawApiUrl.replace(':5001', ':5000');
}
const API_ROOT = rawApiUrl
  .replace(/\/api\/?$/, '')
  .replace(/\/+$/, '');

async function fetchJson(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const isJwt = typeof token === 'string' && token.split('.').length === 3;
  const headers = {
    'Content-Type': 'application/json',
    ...(isJwt ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const url = `${API_ROOT}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  let response;
  try {
    response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers,
    });
  } catch (netErr) {
    if (netErr?.name === 'AbortError' || options?.signal?.aborted) {
      throw netErr;
    }
    throw new Error(netErr.message || 'Lỗi kết nối mạng.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Lỗi yêu cầu (mã ${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

/**
 * Lấy danh sách thông báo của người dùng
 */
export const fetchNotificationsApi = async ({ page = 1, limit = 20, isRead = null } = {}) => {
  const params = new URLSearchParams({ page, limit });
  if (isRead !== null) {
    params.append('isRead', isRead);
  }
  return fetchJson(`/api/notifications?${params.toString()}`);
};

/**
 * Lấy số lượng thông báo chưa đọc
 */
export const fetchUnreadCountApi = async () => {
  return fetchJson('/api/notifications/unread-count');
};

/**
 * Đánh dấu 1 thông báo là đã đọc
 */
export const markNotificationReadApi = async (id) => {
  return fetchJson(`/api/notifications/${id}/read`, {
    method: 'PATCH',
  });
};

/**
 * Đánh dấu tất cả thông báo là đã đọc
 */
export const markAllNotificationsReadApi = async () => {
  return fetchJson('/api/notifications/read-all', {
    method: 'PATCH',
  });
};

/**
 * Xóa 1 thông báo
 */
export const deleteNotificationApi = async (id) => {
  return fetchJson(`/api/notifications/${id}`, {
    method: 'DELETE',
  });
};
