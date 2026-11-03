import apiClient from './api';

/**
 * Lấy cấu hình chính sách kinh doanh của chuỗi (Dành cho Shop Owner)
 */
export const getMyPolicies = async () => {
  try {
    const res = await apiClient.get('/shops/policies/my-policy');
    return res?.data || null;
  } catch (error) {
    throw error;
  }
};

/**
 * Tạo mới một chính sách kinh doanh (Dành cho Shop Owner)
 */
export const createPolicy = async (policyData) => {
  try {
    const res = await apiClient.post('/shops/policies', policyData);
    return res?.data || null;
  } catch (error) {
    throw error;
  }
};

/**
 * Cập nhật toàn bộ hoặc danh sách cấu hình chính sách kinh doanh (Dành cho Shop Owner)
 */
export const updateMyPolicies = async (policiesData) => {
  try {
    const res = await apiClient.put('/shops/policies/my-policy', policiesData);
    return res;
  } catch (error) {
    throw error;
  }
};

/**
 * Cập nhật một chính sách cụ thể theo key (Dành cho Shop Owner)
 */
export const updatePolicyByKey = async (key, policyData) => {
  try {
    const res = await apiClient.put(`/shops/policies/${key}`, policyData);
    return res?.data || null;
  } catch (error) {
    throw error;
  }
};

/**
 * Xóa một chính sách theo key (Dành cho Shop Owner)
 */
export const deletePolicy = async (key) => {
  try {
    const res = await apiClient.delete(`/shops/policies/${key}`);
    return res?.data || null;
  } catch (error) {
    throw error;
  }
};

/**
 * Lấy danh sách chính sách công khai để hiển thị trên Cổng Khách Hàng
 */
export const getPublicPolicies = async (ownerId) => {
  try {
    const params = ownerId ? { ownerId } : {};
    const res = await apiClient.get('/shops/policies/public', { params });
    return res?.data || null;
  } catch (error) {
    throw error;
  }
};

export default {
  getMyPolicies,
  createPolicy,
  updateMyPolicies,
  updatePolicyByKey,
  deletePolicy,
  getPublicPolicies,
};
