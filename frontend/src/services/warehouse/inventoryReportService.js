import api from '../api';

export default {
  get: async (filters = {}) => (await api.get('/warehouse/reports/inventory', { params: filters })).data,
  getItemDetails: async ({ locationId, storageId, variantId, productId, itemLevel }) => (await api.get('/warehouse/reports/inventory/details', { params: { locationId, storageId: storageId || 'none', variantId, productId, itemLevel } })).data,
  getBranchInventory: async ({ branchId } = {}) => (await api.get('/warehouse/reports/branch/inventory', { params: branchId ? { branchId } : {} })).data,
  getBranchItemDetails: async ({ branchId, storageId, variantId, productId, itemLevel }) => (await api.get('/warehouse/reports/branch/inventory/details', { params: { branchId, storageId: storageId || 'none', variantId, productId, itemLevel } })).data,
};
