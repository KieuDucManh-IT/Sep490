/**
 * Rental Order API Service (100% Native Fetch - Zero Axios)
 * Quản lý các cuộc gọi API đơn thuê trang phục Vestora
 * @ears .sdd/features/rental-orders/SPEC.md#NFR-CLI-001
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-001..REQ-RENT-008
 */

const getApiBaseUrl = () => {
  const envUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
  return envUrl.replace(/\/+$/, '');
};

const getAuthHeaders = () => {
  const headers = {
    'Content-Type': 'application/json',
  };
  try {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (_) {}
  return headers;
};

/**
 * Universal Native Fetch Wrapper for Rental Order API
 */
export async function rentalRequest(path = '', options = {}) {
  const { method = 'GET', body, headers: customHeaders = {} } = options;
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/rental-orders${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method,
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        ...getAuthHeaders(),
        ...customHeaders,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error = new Error(
        data?.message || data?.error || `Yêu cầu thất bại với mã lỗi ${response.status}`
      );
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.status) throw error;
    if (controller.signal.aborted) {
      const timeoutErr = new Error('Thời gian chờ phản hồi quá 30 giây, vui lòng thử lại.');
      timeoutErr.status = 408;
      throw timeoutErr;
    }
    const networkErr = new Error(
      error.message || 'Không thể kết nối đến máy chủ Vestora. Vui lòng kiểm tra đường truyền.'
    );
    networkErr.status = 503;
    throw networkErr;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tạo đơn thuê trang phục mới
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-002
 */
export async function createRentalOrder(orderPayload) {
  return rentalRequest('', {
    method: 'POST',
    body: orderPayload,
  });
}

/**
 * Lấy danh sách đơn thuê (theo phân trang & bộ lọc trạng thái)
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-006
 */
export async function getRentalOrders(queryParams = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  const path = queryString ? `?${queryString}` : '';
  return rentalRequest(path, { method: 'GET' });
}

/**
 * Lấy chi tiết đơn thuê theo ID
 */
export async function getRentalOrderById(orderId) {
  return rentalRequest(`/${orderId}`, { method: 'GET' });
}

/**
 * Gán mã vạch hiện vật kho cho các món đồ trong đơn thuê
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-006
 */
export async function assignPhysicalItems(orderId, assignments) {
  return rentalRequest(`/${orderId}/assign-items`, {
    method: 'POST',
    body: { assignments },
  });
}

/**
 * Bàn giao trang phục cho khách hàng
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-007
 */
export async function handoverRentalOrder(orderId, note = '') {
  return rentalRequest(`/${orderId}/handover`, {
    method: 'POST',
    body: { note },
  });
}

/**
 * Hủy đơn thuê trang phục
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-018
 */
export async function cancelRentalOrder(orderId, cancelReason) {
  return rentalRequest(`/${orderId}/cancel`, {
    method: 'POST',
    body: { cancelReason },
  });
}
