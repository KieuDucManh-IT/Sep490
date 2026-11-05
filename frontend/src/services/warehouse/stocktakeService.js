import api from '../api';
const unwrap = (promise) => promise.then((response) => response.data?.data ?? response.data);
export default {
  list: (params = {}) => unwrap(api.get('/warehouse/stocktakes', { params })),
  get: (id) => unwrap(api.get(`/warehouse/stocktakes/${id}`)),
  listStaff: () => unwrap(api.get('/warehouse/stocktakes/staff')),
  create: (payload) => unwrap(api.post('/warehouse/stocktakes', payload)),
  start: (id) => unwrap(api.post(`/warehouse/stocktakes/${id}/start`)),
  saveCounts: (id, payload) => unwrap(api.post(`/warehouse/stocktakes/${id}/counts`, payload)),
  submit: (id) => unwrap(api.post(`/warehouse/stocktakes/${id}/submit`)),
  approve: (id) => unwrap(api.post(`/warehouse/stocktakes/${id}/approve`)),
};
