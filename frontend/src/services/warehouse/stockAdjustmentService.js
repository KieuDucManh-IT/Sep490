import api from '../api';
const unwrap = (promise) => promise.then((response) => response.data?.data ?? response.data);
export default {
  list: (params = {}) => unwrap(api.get('/warehouse/adjustments', { params })),
  get: (id) => unwrap(api.get(`/warehouse/adjustments/${id}`)),
  decide: (id, decision, note = '') => unwrap(api.post(`/warehouse/adjustments/${id}/decision`, { decision, note })),
  apply: (id) => unwrap(api.post(`/warehouse/adjustments/${id}/apply`)),
};
