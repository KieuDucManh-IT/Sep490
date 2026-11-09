import api from './api';

export const getRentalOrdersApi = async (params = {}) => {
  return await api.get('/orders/rentals', { params });
};

export const getRentalOrderDetailApi = async (id) => {
  return await api.get(`/orders/rentals/${id}`);
};

export const getSaleOrdersApi = async (params = {}) => {
  return await api.get('/orders/sales', { params });
};

export const getSaleOrderDetailApi = async (id) => {
  return await api.get(`/orders/sales/${id}`);
};

export const getOrderMetricsApi = async (params = {}) => {
  return await api.get('/orders/metrics', { params });
};

export const getMyRentalOrdersApi = async (params = {}) => {
  return await api.get('/orders/my-rentals', { params });
};

export const getMySaleOrdersApi = async (params = {}) => {
  return await api.get('/orders/my-sales', { params });
};

export const checkoutCartApi = async (data = {}) => {
  return await api.post('/orders/checkout', data);
};

const orderApi = {
  getRentalOrdersApi,
  getRentalOrderDetailApi,
  getSaleOrdersApi,
  getSaleOrderDetailApi,
  getOrderMetricsApi,
  getMyRentalOrdersApi,
  getMySaleOrdersApi,
  checkoutCartApi,
};

export default orderApi;

