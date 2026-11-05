import api from '../api';

export default {
  list: async () => (await api.get('/users', { params: { role: 'warehouse_manager', status: 'active' } })).data || [],
};
