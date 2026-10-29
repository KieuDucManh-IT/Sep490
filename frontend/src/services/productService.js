import apiClient from './api';

export const productService = {
  getProducts: async (params = {}) => {
    try {
      const response = await apiClient.get('/products', { params });
      return response;
    } catch (error) {
      console.error('Lỗi tải danh sách sản phẩm:', error);
      throw error;
    }
  },

  getProductById: async (id) => {
    try {
      const response = await apiClient.get(`/products/${id}`);
      return response;
    } catch (error) {
      console.error('Lỗi tải chi tiết sản phẩm:', error);
      throw error;
    }
  },

  getFilterMeta: async () => {
    try {
      const response = await apiClient.get('/products/meta/filters');
      return response;
    } catch (error) {
      console.error('Lỗi tải metadata bộ lọc:', error);
      throw error;
    }
  },
};

export default productService;

