import apiClient from './api';

export const tryOnApi = {
  /**
   * Lấy danh sách người mẫu chuẩn có sẵn
   */
  getSampleModels: async () => {
    const res = await apiClient.get('/try-on/sample-models');
    return res.data || [];
  },

  /**
   * Gọi AI IDM-VTON ghép trang phục
   * @param {FormData} formData - Chứa photo (file) hoặc humanImageUrl, kèm productId hoặc garmentImageUrl, category, crop, v.v.
   */
  generate: async (formData) => {
    const res = await apiClient.post('/try-on/generate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 180000, // 3 phút đề phòng Replicate cold start
    });
    return res;
  },
};

export default tryOnApi;

