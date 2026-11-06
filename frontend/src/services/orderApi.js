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

const orderApi = {
  getRentalOrdersApi,
  getRentalOrderDetailApi,
  getSaleOrdersApi,
  getSaleOrderDetailApi,
  getOrderMetricsApi,
};

export default orderApi;

