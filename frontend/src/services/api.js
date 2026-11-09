/**
 * Core API Client (100% Native Fetch - Zero Axios)
 * Tuân thủ triệt để quy chuẩn CLAUDE.md: 100% Native Fetch API (Zero-Axios)
 */

const rawBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000').trim();
const API_BASE = rawBase.replace(/\/api\/?$/, '').replace(/\/+$/, '');

function buildUrl(endpoint, params) {
  let cleanUrl = endpoint;
  // Xử lý chống trùng lặp /api/api
  cleanUrl = cleanUrl.replace(/^\/?api\/api\//, '/api/');
  // Đảm bảo request luôn có tiền tố /api nếu không phải URL tuyệt đối
  if (!cleanUrl.startsWith('/api') && !cleanUrl.startsWith('http')) {
    cleanUrl = `/api${cleanUrl.startsWith('/') ? '' : '/'}${cleanUrl}`;
  }

  const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `${API_BASE}${cleanUrl}`;

  if (params && Object.keys(params).length > 0) {
    const urlObj = new URL(fullUrl);
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        urlObj.searchParams.append(key, val);
      }
    });
    return urlObj.toString();
  }

  return fullUrl;
}

function getAuthHeaders(customHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };
  try {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (_) {}
  return headers;
}

async function nativeFetchRequest(method, endpoint, body = null, config = {}) {
  const { params, headers: customHeaders, timeout = 60000, signal: customSignal, ...restConfig } = config;
  const url = buildUrl(endpoint, params);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const signal = customSignal || controller.signal;

  try {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const headers = getAuthHeaders(customHeaders);
    if (isFormData) {
      delete headers['Content-Type'];
    }

    const fetchOptions = {
      method,
      credentials: 'include',
      headers,
      signal,
      ...restConfig,
    };

    if (body !== null && body !== undefined && method !== 'GET' && method !== 'HEAD') {
      fetchOptions.body = isFormData ? body : JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timer);

    const contentType = response.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => null);
    } else {
      data = await response.text().catch(() => null);
    }

    if (!response.ok) {
      const errorMsg =
        data?.error ||
        data?.message ||
        `Yêu cầu thất bại với mã lỗi ${response.status} (${response.statusText})`;
      const error = new Error(errorMsg);
      error.status = response.status;
      error.response = {
        status: response.status,
        statusText: response.statusText,
        data,
      };
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      const timeoutError = new Error('Thời gian chờ phản hồi quá 60s, vui lòng bấm thử lại.');
      timeoutError.code = 'ECONNABORTED';
      throw timeoutError;
    }
    throw err;
  }
}

export const apiClient = {
  get: (url, config = {}) => nativeFetchRequest('GET', url, null, config),
  post: (url, data = null, config = {}) => nativeFetchRequest('POST', url, data, config),
  put: (url, data = null, config = {}) => nativeFetchRequest('PUT', url, data, config),
  patch: (url, data = null, config = {}) => nativeFetchRequest('PATCH', url, data, config),
  delete: (url, config = {}) => nativeFetchRequest('DELETE', url, null, config),
  interceptors: {
    request: { use: () => {} },
    response: { use: () => {} },
  },
};

export default apiClient;
export { API_BASE };
