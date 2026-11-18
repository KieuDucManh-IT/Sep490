import api from '../api';

export default {
  getBranchContext: async () => {
    const branchId = localStorage.getItem('vestora_active_branch_id') || '';
    return (await api.get('/warehouse/transfers/branch-context', { params: branchId ? { branchId } : {} })).data;
  },
  list: async (params = {}) => (await api.get('/warehouse/transfers', { params })).data || [],
  /**
   * Danh sách phiếu có phân trang phía server. Luôn gửi page/limit để backend trả
   * { items, total, page, limit } (mỗi phiếu có lineCount, totalQuantity, không có chi tiết dòng).
   */
  listPage: async ({ page = 1, limit = 10, status = '', search = '' } = {}) => {
    const data = (await api.get('/warehouse/transfers', { params: { page, limit, status, search } })).data;
    if (Array.isArray(data)) return { items: data, total: data.length, page, limit };
    return { items: data?.items || [], total: Number(data?.total || 0), page: Number(data?.page || page), limit: Number(data?.limit || limit) };
  },
  listStaff: async () => (await api.get('/warehouse/transfers/staff')).data || [],
  get: async (id) => (await api.get(`/warehouse/transfers/${id}`)).data,
  createRequest: async (payload) => (await api.post('/warehouse/transfers/requests', payload)).data,
  decide: async (id, payload) => (await api.post(`/warehouse/transfers/${id}/decision`, payload)).data,
  pickCandidates: async (id, detailId, storageId) => (await api.get(`/warehouse/transfers/${id}/pick-candidates`, { params: { detailId, storageId: storageId || 'none' } })).data,
  savePick: async (id, payload) => (await api.post(`/warehouse/transfers/${id}/pick`, payload)).data,
  ship: async (id) => (await api.post(`/warehouse/transfers/${id}/ship`)).data,
  receive: async (id, payload) => (await api.post(`/warehouse/transfers/${id}/receive`, payload)).data,
  cancel: async (id, reason) => (await api.post(`/warehouse/transfers/${id}/cancel`, { reason })).data,
};
