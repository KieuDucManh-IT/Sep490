import api from '../api';

export default {
  list: async () => (await api.get('/warehouse/inbound-receipts')).data || [],
  listStaff: async () => (await api.get('/warehouse/inbound-receipts/staff')).data || [],
  get: async (id) => (await api.get('/warehouse/inbound-receipts/' + id)).data,
  create: async (payload) => (await api.post('/warehouse/inbound-receipts', payload)).data,
  receive: async (id, payload) => (await api.post('/warehouse/inbound-receipts/' + id + '/receive', payload)).data,
  approve: async (id, decision, note) => (await api.post('/warehouse/inbound-receipts/' + id + '/approve', { decision, note })).data,
  putaway: async (id, payload) => (await api.post('/warehouse/inbound-receipts/' + id + '/putaway', payload)).data,
};
