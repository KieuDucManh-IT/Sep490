import apiClient from './api';

export const productService = {
  getProducts: async (params = {}) => {
    try {
      const response = await apiClient.get('/products', { params });
      return response;
    } catch (error) {
      console.error('Lỗi khi gọi API /api/products:', error);
      throw error;
    }
  },

  getFilterMeta: async () => {
    try {
      const response = await apiClient.get('/products/meta/filters');
      return response;
    } catch (error) {
      console.error('Lỗi khi gọi API /api/products/meta/filters:', error);
      throw error;
    }
  },

  getProductById: async (id) => {
    try {
      const response = await apiClient.get(`/products/${id}`);
      return response;
    } catch (error) {
      console.error('Lỗi khi gọi API chi tiết sản phẩm /api/products/:id:', error);
      throw error;
    }
  },
};

export default productService;
