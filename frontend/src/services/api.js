import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

apiClient.interceptors.request.use(
  (config) => {
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
