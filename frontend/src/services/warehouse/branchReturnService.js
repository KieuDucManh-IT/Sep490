import api from '../api';

const branchReturnService = {
  list: async () => (await api.get('/warehouse/returns')).data || [],
  listStaff: async () => (await api.get('/warehouse/returns/staff')).data || [],
  get: async (id) => (await api.get(`/warehouse/returns/${id}`)).data,
  create: async (payload) => (await api.post('/warehouse/returns', payload)).data,
  decide: async (id, payload) => (await api.post(`/warehouse/returns/${id}/decision`, payload)).data,
  dispatch: async (id) => (await api.post(`/warehouse/returns/${id}/dispatch`)).data,
  cancel: async (id) => (await api.post(`/warehouse/returns/${id}/cancel`)).data,
  receive: async (id, payload) => (await api.post(`/warehouse/returns/${id}/receive`, payload)).data,
  decideReceipt: async (id, payload) => (await api.post(`/warehouse/returns/${id}/receipt-decision`, payload)).data,
  putaway: async (id, payload) => (await api.post(`/warehouse/returns/${id}/putaway`, payload)).data,
};

export default branchReturnService;
