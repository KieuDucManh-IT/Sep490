import api from '../services/api';

export const createCrudService = (path) => ({
  list: async () => (await api.get(path)).data || [],
  create: async (payload) => (await api.post(path, payload)).data,
  update: async (id, payload) => (await api.patch(`${path}/${id}`, payload)).data,
  remove: async (id) => (await api.delete(`${path}/${id}`)).data,
});
