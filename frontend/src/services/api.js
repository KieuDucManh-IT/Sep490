import axios from 'axios';

// Chuẩn hóa Base URL: Mặc định cổng 5000 trùng với Backend server
// Tự động cắt bỏ /api ở cuối (nếu có trong .env) để tránh bị lặp thành /api/api
const rawBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000').trim();
const API_BASE = rawBase.replace(/\/api\/?$/, '').replace(/\/+$/, '');

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

apiClient.interceptors.request.use(
  (config) => {
    if (config.url) {
      // Xử lý chống trùng lặp /api/api
      config.url = config.url.replace(/^\/?api\/api\//, '/api/');
      // Đảm bảo request luôn có tiền tố /api
      if (!config.url.startsWith('/api') && !config.url.startsWith('http')) {
        config.url = `/api${config.url.startsWith('/') ? '' : '/'}${config.url}`;
      }
    }
    try {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (_) {}
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorData = error.response?.data;
    const message = errorData?.message || error.message || 'Có lỗi kết nối, vui lòng thử lại sau.';
    const customError = new Error(message);
    customError.response = error.response;
    customError.data = errorData;
    return Promise.reject(customError);
  }
);

export default apiClient;
export { apiClient, API_BASE };
