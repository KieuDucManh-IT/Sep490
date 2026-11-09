/**
 * Sales Order API Service (100% Native Fetch - Zero Axios)
 * Quản lý các cuộc gọi API đơn mua trang phục Vestora
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
 * Universal Native Fetch Wrapper for Sales Order API
 */
export async function salesRequest(path = '', options = {}) {
  const { method = 'GET', body, headers: customHeaders = {} } = options;
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/sales-orders${path}`;

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
 * Tạo đơn mua sản phẩm mới
 */
export async function createSalesOrder(orderPayload) {
  return salesRequest('', {
    method: 'POST',
    body: orderPayload,
  });
}

/**
 * Lấy danh sách đơn mua của khách hàng đăng nhập
 */
export async function getMySalesOrders(queryParams = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return salesRequest(`/my-orders${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

/**
 * Xem chi tiết đơn mua theo ID
 */
export async function getSalesOrderById(orderId) {
  return salesRequest(`/${orderId}`, {
    method: 'GET',
  });
}

/**
 * Lấy danh sách đơn mua tại một chi nhánh cho quản lý / nhân viên
 */
export async function getBranchSalesOrders(locationId, queryParams = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  const loc = locationId || 'all';
  return salesRequest(`/branch/${loc}${queryString ? `?${queryString}` : ''}`, {
    method: 'GET',
  });
}

/**
 * Cập nhật trạng thái đơn mua hàng
 */
export async function updateSalesOrderStatus(orderId, { orderStatus, note }) {
  return salesRequest(`/${orderId}/status`, {
    method: 'PATCH',
    body: { orderStatus, note },
  });
}
