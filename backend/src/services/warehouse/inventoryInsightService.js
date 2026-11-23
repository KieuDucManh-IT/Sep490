// Màn tồn kho (TASK-014 G), chỉ đọc:
// - Lịch sử một mã hàng: sổ biến động có itemId, và giặt / sửa / thanh lý của món.
// - Sức chứa kho tổng: dùng lại capacitySnapshot (shared/capacity.js) — không có công thức "đang chứa" thứ hai.
import mongoose from 'mongoose';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { StockMovement } from '../../models/warehouse/inventory/StockMovement.js';
import { ItemMaintenanceRecord } from '../../models/maintenance/ItemMaintenanceRecord.js';
import { ItemDisposal } from '../../models/maintenance/ItemDisposal.js';
import { InboundReceipt } from '../../models/warehouse/inbound/InboundReceipt.js';
import { StockTransfer } from '../../models/warehouse/transfer/StockTransfer.js';
import { StockRelocation } from '../../models/warehouse/transfer/StockRelocation.js';
import { StockDiscrepancy } from '../../models/warehouse/transfer/StockDiscrepancy.js';
import { StockAdjustment } from '../../models/warehouse/adjustment/StockAdjustment.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { RentalReturn } from '../../models/sale&rental/RentalReturn.js';
import { SalesReturn } from '../../models/sale&rental/SalesReturn.js';
import { SalesOrderDetail } from '../../models/sale&rental/SalesOrderDetail.js';
import { Stocktake } from '../../models/warehouse/stocktake/Stocktake.js';
import { appError } from './shared/errors.js';
import { getCentralWarehouse } from './shared/locations.js';
import { capacitySnapshot } from './shared/capacity.js';
import {
  buildCapacityTree, capacitySummary, isHistoryIncomplete, pairItemMovements, parseHistoryQuery,
} from './inventoryInsightRules.js';

/** referenceType → model + field mã phiếu (để hiện "phiếu liên quan"). */
const REFERENCE_MODELS = {
  inbound_receipt: [InboundReceipt, 'receiptCode'],
  stock_transfer: [StockTransfer, 'transferCode'],
  stock_relocation: [StockRelocation, 'relocationCode'],
  stock_discrepancy: [StockDiscrepancy, 'discrepancyCode'],
  stock_adjustment: [StockAdjustment, 'adjustmentCode'],
  sales_order: [SalesOrder, 'orderCode'],
  rental_order: [RentalOrder, 'orderCode'],
  rental_return: [RentalReturn, 'returnCode'],
  sales_return: [SalesReturn, 'returnCode'],
  stocktake: [Stocktake, 'stocktakeCode'],
};

/** Mã phiếu của các dòng sổ: mỗi loại phiếu một truy vấn $in (không N+1). */
const referenceCodes = async (rows) => {
  const idsByType = new Map();
  for (const row of rows) {
    if (!row.referenceId || !REFERENCE_MODELS[row.referenceType]) continue;
    if (!idsByType.has(row.referenceType)) idsByType.set(row.referenceType, new Set());
    idsByType.get(row.referenceType).add(String(row.referenceId));
  }
  const codes = new Map();
  await Promise.all([...idsByType].map(async ([type, ids]) => {
    const [Model, field] = REFERENCE_MODELS[type];
    const docs = await Model.find({ _id: { $in: [...ids] } }).select(field).lean();
    docs.forEach((doc) => codes.set(`${type}:${doc._id}`, doc[field]));
  }));
  return codes;
};

const loadItem = async (itemId) => {
  if (!mongoose.isValidObjectId(itemId)) throw appError('Mã hàng không hợp lệ.');
  const item = await InventoryItem.findById(itemId)
    .populate({ path: 'variantId', select: 'sku size color productId', populate: { path: 'productId', select: 'productCode name' } })
    .populate('locationId', 'code name type')
    .populate('storageId', 'code name type')
    .lean();
  if (!item) throw appError('Không tìm thấy mã hàng.', 404);
  // TASK-016 C4: món đã bán hiện mã đơn bán.
  if (item.status === 'sold') {
    const detail = await SalesOrderDetail.findOne({ itemIds: item._id }).sort({ createdAt: -1 })
      .populate('salesOrderId', 'orderCode').lean();
    if (detail?.salesOrderId) item.soldOrder = { _id: detail.salesOrderId._id, orderCode: detail.salesOrderId.orderCode };
  }
  return item;
};

const movementHistory = async (item, paging) => {
  const filter = { itemId: item._id };
  const [rows, total, earliest] = await Promise.all([
    StockMovement.find(filter).sort({ createdAt: -1, _id: -1 }).skip(paging.skip).limit(paging.limit)
      .populate('locationId', 'code name type')
      .populate('storageId', 'code name type')
      .populate('createdBy', 'FullName Email')
      .lean(),
    StockMovement.countDocuments(filter),
    StockMovement.findOne(filter).sort({ createdAt: 1 }).select('createdAt').lean(),
  ]);
  const codes = await referenceCodes(rows);
  const entries = pairItemMovements(rows).map((row) => ({
    ...row,
    referenceCode: codes.get(`${row.referenceType}:${row.referenceId}`) || null,
  }));
  return {
    entries,
    total,
    earliestAt: earliest?.createdAt || null,
    incomplete: isHistoryIncomplete(item.createdAt, earliest?.createdAt),
  };
};

/** Giặt / sửa và thanh lý của món, mới nhất trước; phân trang trên danh sách đã gộp (mỗi món ít bản ghi). */
const maintenanceHistory = async (item, paging) => {
  const people = 'FullName Email';
  const [records, disposals] = await Promise.all([
    ItemMaintenanceRecord.find({ itemId: item._id }).populate('reportedBy', people).populate('assignedTo', people).lean(),
    ItemDisposal.find({ itemId: item._id }).populate('requestedBy', people).populate('decidedBy', people).lean(),
  ]);
  const merged = [
    ...records.map((record) => ({ kind: 'maintenance', date: record.completedAt || record.startedAt || record.reportedAt || record.createdAt, ...record })),
    ...disposals.map((disposal) => ({ kind: 'disposal', date: disposal.decidedAt || disposal.createdAt, ...disposal })),
  ].sort((left, right) => new Date(right.date) - new Date(left.date));
  return { entries: merged.slice(paging.skip, paging.skip + paging.limit), total: merged.length };
};

/**
 * GET /warehouse/items/:id/history?tab=movements|maintenance&page=&limit=
 * Trả { item, tab, page, limit, total, entries, earliestAt?, incomplete? }.
 */
export const getItemHistory = async (itemId, query = {}) => {
  const paging = parseHistoryQuery(query);
  const item = await loadItem(itemId);
  const result = paging.tab === 'maintenance' ? await maintenanceHistory(item, paging) : await movementHistory(item, paging);
  return { item, tab: paging.tab, page: paging.page, limit: paging.limit, ...result };
};

/**
 * GET /warehouse/capacity — sức chứa kho tổng: thẻ tổng + cây Khu → Dãy → Kệ.
 * Số "đang chứa" lấy nguyên từ capacitySnapshot (Σ quantityOnHand, cộng dồn lên cấp cha);
 * hàng đang cho thuê / đang vận chuyển không nằm trong onHand của kho tổng nên không tính.
 */
export const getCentralCapacity = async () => {
  const central = await getCentralWarehouse(null, { message: 'Cần có đúng một kho tổng đang hoạt động.' });
  const snapshot = await capacitySnapshot(central._id, null, null);
  const storages = snapshot.storages.filter((storage) => storage.isDeleted !== true);
  return {
    summary: capacitySummary(snapshot.location, snapshot.used, snapshot.committed),
    tree: buildCapacityTree(storages, snapshot.usedWithAncestors),
  };
};
