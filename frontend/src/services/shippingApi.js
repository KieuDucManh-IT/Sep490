import api from './api';

export const calculateShippingFeeApi = async (payload) => {
  return await api.post('/shipping/calculate-fee', payload);
};

export const createOutboundShipmentApi = async (payload) => {
  return await api.post('/shipping/create-outbound', payload);
};

export const createReturnShipmentApi = async (payload) => {
  return await api.post('/shipping/create-return', payload);
};

export const cancelShipmentApi = async (id, reason) => {
  return await api.put(`/shipping/${id}/cancel`, { reason });
};

export const getShipmentsByOrderApi = async (orderType, orderId) => {
  return await api.get(`/shipping/order/${orderType}/${orderId}`);
};

export const getPrintTokenApi = async (trackingCode) => {
  return await api.get(`/shipping/print-token/${trackingCode}`);
};

export const getGHNProvincesApi = async () => {
  return await api.get('/shipping/master-data/provinces');
};

export const getGHNDistrictsApi = async (provinceId) => {
  return await api.get(`/shipping/master-data/districts/${provinceId}`);
};

export const getGHNWardsApi = async (districtId) => {
  return await api.get(`/shipping/master-data/wards/${districtId}`);
};

export const trackPublicShipmentApi = async (trackingCode) => {
  return await api.get(`/public/shipping/track/${trackingCode}`);
};

const shippingApi = {
  calculateShippingFeeApi,
  createOutboundShipmentApi,
  createReturnShipmentApi,
  cancelShipmentApi,
  getShipmentsByOrderApi,
  getPrintTokenApi,
  getGHNProvincesApi,
  getGHNDistrictsApi,
  getGHNWardsApi,
  trackPublicShipmentApi,
};

export default shippingApi;

