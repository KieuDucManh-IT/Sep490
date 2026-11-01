import api from '../api';

const unwrap = (promise) => promise.then((response) => response.data?.data ?? response.data);

export default {
  listStocktakes: (params = {}) => unwrap(api.get('/warehouse/stocktakes', { params })),
  getStocktake: (id) => unwrap(api.get(`/warehouse/stocktakes/${id}`)),
  listStaff: () => unwrap(api.get('/warehouse/stocktakes/staff')),
  createStocktake: (payload) => unwrap(api.post('/warehouse/stocktakes', payload)),
  startStocktake: (id) => unwrap(api.post(`/warehouse/stocktakes/${id}/start`)),
  saveCounts: (id, payload) => unwrap(api.post(`/warehouse/stocktakes/${id}/counts`, payload)),
  submitStocktake: (id) => unwrap(api.post(`/warehouse/stocktakes/${id}/submit`)),
  approveStocktake: (id) => unwrap(api.post(`/warehouse/stocktakes/${id}/approve`)),
  listAdjustments: (params = {}) => unwrap(api.get('/warehouse/adjustments', { params })),
  getAdjustment: (id) => unwrap(api.get(`/warehouse/adjustments/${id}`)),
  decideAdjustment: (id, decision, note) => unwrap(api.post(`/warehouse/adjustments/${id}/decision`, { decision, note })),
  applyAdjustment: (id) => unwrap(api.post(`/warehouse/adjustments/${id}/apply`)),
};
