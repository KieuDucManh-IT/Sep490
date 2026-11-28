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
  return await api.get(`/shipping/print-token/${encodeURIComponent(trackingCode)}`);
};

export const getGHNProvincesApi = async () => {
  return await api.get('/shipping/master-data/provinces');
};

// GHN v3 master data (mô hình địa chỉ 2 cấp sau 01/07/2025).
export const getGHNNewProvincesApi = async () => {
  return await api.get('/shipping/master-data/provinces-new');
};

export const getGHNNewWardsApi = async (provinceId) => {
  return await api.get(`/shipping/master-data/wards-new/${provinceId}`);
};

export const getGHNDistrictsApi = async (provinceId) => {
  return await api.get(`/shipping/master-data/districts/${provinceId}`);
};

export const getGHNWardsApi = async (districtId) => {
  return await api.get(`/shipping/master-data/wards/${districtId}`);
};

export const getGHNWardsByProvinceApi = async (provinceId) => {
  return await api.get(`/shipping/master-data/wards-by-province/${provinceId}`);
};

export const trackShipmentApi = async (trackingCode, options = {}) => {
  const params = options?.force ? { force: 'true' } : {};
  return await api.get(`/shipping/track/${encodeURIComponent(trackingCode)}`, { params });
};

export const trackPublicShipmentApi = trackShipmentApi;

export const updateManualShipmentStatusApi = async (id, payload) => {
  return await api.put(`/shipping/${id}/manual-status`, payload);
};

export const uploadShipmentProofApi = async (file) => {
  const formData = new FormData();
  formData.append('image', file);
  return await api.post('/shipping/upload-proof', formData);
};

export const simulateGhnApi = async (payload) => {
  return await api.post('/shipping/dev/simulate-ghn', payload);
};

const shippingApi = {
  calculateShippingFeeApi,
  createOutboundShipmentApi,
  createReturnShipmentApi,
  cancelShipmentApi,
  updateManualShipmentStatusApi,
  simulateGhnApi,
  uploadShipmentProofApi,
  getShipmentsByOrderApi,
  getPrintTokenApi,
  getGHNProvincesApi,
  getGHNNewProvincesApi,
  getGHNNewWardsApi,
  getGHNDistrictsApi,
  getGHNWardsApi,
  getGHNWardsByProvinceApi,
  trackShipmentApi,
  trackPublicShipmentApi,
};

export default shippingApi;

