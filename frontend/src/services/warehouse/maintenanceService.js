import api from '../api';

const unwrap = (promise) => promise.then((response) => response?.data ?? response);

const maintenanceService = {
  candidates: () => unwrap(api.get('/warehouse/maintenance/candidates')),
  list: (params = {}) => unwrap(api.get('/warehouse/maintenance', { params })),
  get: (id) => unwrap(api.get(`/warehouse/maintenance/${id}`)),
  staff: () => unwrap(api.get('/warehouse/maintenance/staff')),
  create: (payload) => unwrap(api.post('/warehouse/maintenance', payload)),
  start: (id) => unwrap(api.post(`/warehouse/maintenance/${id}/start`)),
  complete: (id, payload) => unwrap(api.post(`/warehouse/maintenance/${id}/complete`, payload)),
  cancel: (id, payload = {}) => unwrap(api.post(`/warehouse/maintenance/${id}/cancel`, payload)),
  listDisposals: (params = {}) => unwrap(api.get('/warehouse/disposals', { params })),
  createDisposal: (payload) => unwrap(api.post('/warehouse/disposals', payload)),
  decideDisposal: (id, payload) => unwrap(api.post(`/warehouse/disposals/${id}/decision`, payload)),
};

export default maintenanceService;
