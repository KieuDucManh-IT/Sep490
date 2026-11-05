import api from '../api';

export default {
  getBranchContext: async () => {
    const branchId = localStorage.getItem('vestora_active_branch_id') || '';
    return (await api.get('/warehouse/transfers/branch-context', { params: branchId ? { branchId } : {} })).data;
  },
  list: async (params = {}) => (await api.get('/warehouse/transfers', { params })).data || [],
  listStaff: async () => (await api.get('/warehouse/transfers/staff')).data || [],
  get: async (id) => (await api.get(`/warehouse/transfers/${id}`)).data,
  createRequest: async (payload) => (await api.post('/warehouse/transfers/requests', payload)).data,
  decide: async (id, payload) => (await api.post(`/warehouse/transfers/${id}/decision`, payload)).data,
  pickCandidates: async (id, detailId, storageId) => (await api.get(`/warehouse/transfers/${id}/pick-candidates`, { params: { detailId, storageId: storageId || 'none' } })).data,
  savePick: async (id, payload) => (await api.post(`/warehouse/transfers/${id}/pick`, payload)).data,
  ship: async (id) => (await api.post(`/warehouse/transfers/${id}/ship`)).data,
  receive: async (id, payload) => (await api.post(`/warehouse/transfers/${id}/receive`, payload)).data,
};
