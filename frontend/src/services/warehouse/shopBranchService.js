import api from '../api';

export default {
  list: async () => (await api.get('/shops', { params: { status: 'ACTIVE', limit: 100 } })).data || [],
};
