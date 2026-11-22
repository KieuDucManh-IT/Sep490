import mongoose from 'mongoose';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { StorageLocation } from '../../models/warehouse/location/StorageLocation.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { InboundReceiptDetail } from '../../models/warehouse/inbound/InboundReceiptDetail.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { RentalOrderDetail } from '../../models/sale&rental/RentalOrderDetail.js';
import { RentalOrderItem } from '../../models/sale&rental/RentalOrderItem.js';
import { getBalances } from './balanceQueryService.js';
import { EMPTY_SUMMARY, buildBalanceReportRows, rollupReportRows, summarizeReport } from './inventoryReportRules.js';

const invalid = (message) => Object.assign(new Error(message), { statusCode: 400 });
const OPEN_RENTAL_STATUSES = ['renting', 'partially_returned', 'overdue'];

/**
 * Số món QUÁ HẠN trả theo (locationId, variantId), tính lúc đọc, không lưu vào balance:
 * RentalOrder (dueDate < now, chưa trả) → RentalOrderDetail (variantId) → đếm RentalOrderItem `handed_over`.
 * TASK-011: không đếm món; chi nhánh lấy từ RentalOrder.locationId.
 */
const overdueByVariantLocation = async (locationIds, now = new Date()) => {
  const orders = await RentalOrder.find({ locationId: { $in: locationIds }, rentalStatus: { $in: OPEN_RENTAL_STATUSES }, dueDate: { $lt: now } }).select('_id locationId').lean();
  if (!orders.length) return [];
  const locationByOrder = new Map(orders.map((order) => [String(order._id), order.locationId]));
  const details = await RentalOrderDetail.find({ rentalOrderId: { $in: orders.map((order) => order._id) } }).select('_id rentalOrderId variantId').lean();
  if (!details.length) return [];
  const counts = await RentalOrderItem.aggregate([
    { $match: { rentalOrderDetailId: { $in: details.map((detail) => detail._id) }, status: 'handed_over' } },
    { $group: { _id: '$rentalOrderDetailId', quantity: { $sum: 1 } } },
  ]);
  const countByDetail = new Map(counts.map((row) => [String(row._id), row.quantity]));
  return details
    .map((detail) => ({ locationId: locationByOrder.get(String(detail.rentalOrderId)), variantId: detail.variantId, quantity: countByDetail.get(String(detail._id)) || 0 }))
    .filter((row) => row.quantity > 0);
};

/** TASK-011: mọi số lượng đọc từ InventoryBalance; "Đang giữ" gồm giữ chỗ của đơn thuê/bán và phiếu kho. */
export const getInventoryReport = async ({ locationId = '', storageLevel = 'shelf', itemLevel = 'variant' } = {}) => {
  if (locationId && !mongoose.isValidObjectId(locationId)) throw invalid('Kho/cửa hàng không hợp lệ.');
  if (!['zone', 'row', 'shelf'].includes(storageLevel)) throw invalid('Cấp vị trí không hợp lệ.');
  if (!['product', 'variant'].includes(itemLevel)) throw invalid('Cấp mặt hàng không hợp lệ.');
  const locations = await InventoryLocation.find().populate('managerId', 'FullName Email').sort({ name: 1 }).lean();
  const selectedLocations = locationId ? locations.filter((location) => String(location._id) === String(locationId)) : locations;
  const locationIds = selectedLocations.map((location) => location._id);
  const storageLocations = await StorageLocation.find(locationId ? { locationId } : {}).select('_id code name type parentStorageId').lean();
  const locationById = new Map(selectedLocations.map((location) => [String(location._id), location]));
  const storageById = new Map(storageLocations.map((storage) => [String(storage._id), storage]));
  if (!locationIds.length) return { items: [], summary: { ...EMPTY_SUMMARY }, locations };

  const [balances, overdue] = await Promise.all([getBalances({ locationIds }), overdueByVariantLocation(locationIds)]);
  const variantIds = [...new Set([...balances, ...overdue].map((row) => String(row.variantId)))];
  const variants = await ProductVariant.find({ _id: { $in: variantIds } })
    .select('sku size color productId')
    .populate({ path: 'productId', select: 'productCode name tag categoryId', populate: { path: 'categoryId', select: 'name' } })
    .lean();
  const variantById = new Map(variants.map((variant) => [String(variant._id), variant]));
  const baseRows = buildBalanceReportRows({ balances, overdue, variantById, locationById, storageById });
  const items = rollupReportRows(baseRows, { storageLevel, itemLevel, storageById });
  return { items, summary: summarizeReport(items), locations };
};

export const getIndividualItemDetails = async ({ locationId, storageId, variantId, productId, itemLevel = 'variant', availableOnly = false }) => {
  if (!mongoose.isValidObjectId(locationId)) throw invalid('Kho/cửa hàng không hợp lệ.');
  if (storageId && storageId !== 'none' && !mongoose.isValidObjectId(storageId)) throw invalid('Vị trí lưu trữ không hợp lệ.');
  if (!['product', 'variant'].includes(itemLevel)) throw invalid('Cấp mặt hàng không hợp lệ.');
  let variantIds;
  if (itemLevel === 'product') {
    if (!mongoose.isValidObjectId(productId)) throw invalid('Sản phẩm không hợp lệ.');
    const variants = await ProductVariant.find({ productId }).select('_id');
    if (!variants.length) return [];
    variantIds = variants.map((variant) => variant._id);
  } else {
    if (!mongoose.isValidObjectId(variantId)) throw invalid('Biến thể không hợp lệ.');
    const variant = await ProductVariant.findById(variantId).select('_id');
    if (!variant) throw invalid('Không tìm thấy biến thể.');
    variantIds = [variant._id];
  }
  const onlyAvailable = availableOnly === true || String(availableOnly).toLowerCase() === 'true';
  const query = { locationId, variantId: { $in: variantIds }, status: onlyAvailable ? 'available' : { $nin: ['disposed', 'renting', 'in_transit', 'sold'] } };
  if (storageId === 'none' || !storageId) query.storageId = null;
  else {
    const storageLocations = await StorageLocation.find({ locationId }).select('_id parentStorageId').lean();
    const storageById = new Map(storageLocations.map((storage) => [String(storage._id), storage]));
    if (!storageById.has(String(storageId))) throw invalid('Vị trí không thuộc kho/cửa hàng đã chọn.');
    const descendantIds = storageLocations.filter((storage) => {
      let cursor = storage;
      const visited = new Set();
      while (cursor && !visited.has(String(cursor._id))) {
        if (String(cursor._id) === String(storageId)) return true;
        visited.add(String(cursor._id));
        cursor = cursor.parentStorageId ? storageById.get(String(cursor.parentStorageId)) : null;
      }
      return false;
    }).map((storage) => storage._id);
    query.storageId = { $in: descendantIds };
  }
  const rows = await InventoryItem.find(query).select('itemCode serialNumber condition status inboundReceiptDetail storageId').populate('variantId', 'sku size color').populate({
    path: 'inboundReceiptDetail',
    select: 'receiptDetailCode receiptId unitCost createdAt',
    populate: { path: 'receiptId', select: 'receiptCode supplierId receivedAt createdAt', populate: { path: 'supplierId', select: 'supplierCode name' } },
  }).populate('storageId', 'code name type').sort({ itemCode: 1 }).lean();
  const missingReceiptCodes = rows.filter((row) => row.inboundReceiptDetail && !row.inboundReceiptDetail.receiptDetailCode);
  const receiptIds = [...new Set(missingReceiptCodes.map((row) => String(row.inboundReceiptDetail.receiptId?._id || row.inboundReceiptDetail.receiptId)).filter(Boolean))];
  for (const receiptId of receiptIds) {
    const receiptCode = missingReceiptCodes.find((row) => String(row.inboundReceiptDetail.receiptId?._id || row.inboundReceiptDetail.receiptId) === receiptId)?.inboundReceiptDetail.receiptId?.receiptCode;
    const details = await InboundReceiptDetail.find({ receiptId }).sort({ createdAt: 1, _id: 1 }).select('_id receiptDetailCode').lean();
    const occupied = new Set(details.map((detail) => detail.receiptDetailCode).filter(Boolean));
    const updates = [];
    for (let index = 0; index < details.length; index += 1) {
      const detail = details[index];
      if (detail.receiptDetailCode) continue;
      const prefix = receiptCode || `PND-${String(receiptId).slice(-8).toUpperCase()}`;
      let code = `${prefix}-${String(index + 1).padStart(2, '0')}`;
      let suffix = 2;
      while (occupied.has(code)) code = `${prefix}-${String(index + 1).padStart(2, '0')}-${suffix++}`;
      occupied.add(code);
      updates.push({ updateOne: { filter: { _id: detail._id }, update: { $set: { receiptDetailCode: code } } } });
      for (const row of missingReceiptCodes) {
        if (String(row.inboundReceiptDetail._id) === String(detail._id)) row.inboundReceiptDetail.receiptDetailCode = code;
      }
    }
    if (updates.length) await InboundReceiptDetail.bulkWrite(updates);
  }
  return rows;
};
