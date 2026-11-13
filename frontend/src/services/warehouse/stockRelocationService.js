import api from '../api';
const unwrap = (promise) => promise.then((response) => response.data?.data ?? response.data);
export default {
  list: (operationType = '') => unwrap(api.get('/warehouse/relocations', { params: operationType ? { operationType } : {} })),
  get: (id) => unwrap(api.get(`/warehouse/relocations/${id}`)),
  listStaff: () => unwrap(api.get('/warehouse/relocations/staff')),
  create: (payload) => unwrap(api.post('/warehouse/relocations', payload)),
  start: (id) => unwrap(api.post(`/warehouse/relocations/${id}/start`)),
  complete: (id, payload) => unwrap(api.post(`/warehouse/relocations/${id}/complete`, payload)),
  cancel: (id) => unwrap(api.post(`/warehouse/relocations/${id}/cancel`)),
};
