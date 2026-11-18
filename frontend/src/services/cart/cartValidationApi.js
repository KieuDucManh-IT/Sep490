import api from '../api';
export const validateCart = payload => api.post('/cart/validate', payload);
