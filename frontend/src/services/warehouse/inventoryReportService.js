import api from '../api';

const inventoryReportService = {
  get: async (filters = {}) => (await api.get('/warehouse/reports/inventory', { params: filters })).data,
  getItemDetails: async ({ locationId, storageId, variantId, productId, itemLevel, availableOnly }) => (await api.get('/warehouse/reports/inventory/details', { params: { locationId, storageId: storageId || 'none', variantId, productId, itemLevel, availableOnly } })).data,
  getBranchInventory: async ({ branchId } = {}) => (await api.get('/warehouse/reports/branch/inventory', { params: branchId ? { branchId } : {} })).data,
  getBranchItemDetails: async ({ branchId, storageId, variantId, productId, itemLevel }) => (await api.get('/warehouse/reports/branch/inventory/details', { params: { branchId, storageId: storageId || 'none', variantId, productId, itemLevel } })).data,
  /** Khả dụng tại chi nhánh của nhiều biến thể → Map<variantId, number> (một lần gọi). */
  getBranchAvailability: async ({ branchId, variantIds = [] } = {}) => {
    if (!variantIds.length) return new Map();
    const data = (await api.get('/warehouse/reports/branch/availability', {
      params: { ...(branchId ? { branchId } : {}), variantIds: variantIds.join(',') },
    })).data;
    return new Map(Object.entries(data?.availability || {}).map(([id, value]) => [id, Number(value) || 0]));
  },
};

export default inventoryReportService;
