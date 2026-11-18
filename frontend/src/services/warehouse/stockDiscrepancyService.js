import api from '../api';

const unwrap = (promise) => promise.then((response) => response?.data ?? response);

const stockDiscrepancyService = {
  list: (params = {}) => unwrap(api.get('/warehouse/discrepancies', { params })).then((rows) => rows || []),
  get: (id) => unwrap(api.get(`/warehouse/discrepancies/${id}`)),
  resolve: (id, payload) => unwrap(api.post(`/warehouse/discrepancies/${id}/resolve`, payload)),
};

export default stockDiscrepancyService;
