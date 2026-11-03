import api from '../api';

export default {
  getBranchContext: async () => {
    const branchId = localStorage.getItem('vestora_active_branch_id') || '';
    return (await api.get('/warehouse/transfers/branch-context', { params: branchId ? { branchId } : {} })).data;
  },
  list: async (params = {}) => (await api.get('/warehouse/transfers', { params })).data || [],
  get: async (id) => (await api.get(`/warehouse/transfers/${id}`)).data,
  createRequest: async (payload) => (await api.post('/warehouse/transfers/requests', payload)).data,
  decide: async (id, payload) => (await api.post(`/warehouse/transfers/${id}/decision`, payload)).data,
  ship: async (id) => (await api.post(`/warehouse/transfers/${id}/ship`)).data,
  receive: async (id, payload) => (await api.post(`/warehouse/transfers/${id}/receive`, payload)).data,
};
