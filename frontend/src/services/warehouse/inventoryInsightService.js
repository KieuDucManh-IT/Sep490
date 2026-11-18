import api from '../api';

/** Màn tồn kho (TASK-014 G): lịch sử một mã hàng và sức chứa kho tổng. Chỉ đọc. */
const inventoryInsightService = {
  /** tab: 'movements' | 'maintenance' → { item, entries, total, page, limit, earliestAt?, incomplete? } */
  getItemHistory: async (itemId, { tab = 'movements', page = 1, limit = 10 } = {}) => (
    await api.get(`/warehouse/items/${itemId}/history`, { params: { tab, page, limit } })
  ).data,
  /** → { summary: { used, maxCapacity, percent, tone, committed }, tree: [{ code, used, maxCapacity, percent, tone, children }] } */
  getCapacity: async () => (await api.get('/warehouse/capacity')).data,
};

export default inventoryInsightService;
