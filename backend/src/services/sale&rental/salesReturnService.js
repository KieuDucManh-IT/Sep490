// TASK-015 — Trả hàng bán theo món (SalesReturn / SalesReturnDetail).
// Bản tối thiểu theo spec C2: quản lý chi nhánh của đơn (hoặc admin) ghi nhận khách trả lại các món đã mua của một
// đơn đã hoàn tất. TASK-016 C: món chọn trong `SalesOrderDetail.itemIds` của dòng đơn, số món = `quantityReturned`.
// Trong MỘT transaction: tạo phiếu (`completed`), món `sold` → tại chi nhánh của đơn, không kệ, theo kết quả kiểm:
//   Đạt (ok) → available; Cần xử lý (needs_service) → unavailable (chờ chuyển về kho tổng xử lý).
// Balance đổi theo món qua itemStateService; sổ biến động `sales_return` mỗi món một dòng có itemId.
// NGOÀI PHẠM VI (cần quyết định nghiệp vụ): duyệt phiếu nhiều bước và hoàn tiền. `refundAmount` chỉ ghi nhận,
// không tạo giao dịch ví, không đổi `paymentStatus` của đơn.
import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { SalesOrderDetail } from '../../models/sale&rental/SalesOrderDetail.js';
import { SalesReturn } from '../../models/sale&rental/SalesReturn.js';
import { SalesReturnDetail } from '../../models/sale&rental/SalesReturnDetail.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { moveItems, recordItemMovements } from '../warehouse/itemStateService.js';
import { assertBranchCapacity } from '../warehouse/shared/capacity.js';
import { isAdmin, isBranchManager } from '../warehouse/shared/roles.js';
import {
  checkReturnLines, parseSalesReturnPayload, returnableItemsOf, returnedItemStatus, totalRefundAmount,
} from './salesReturnRules.js';

/** Phiếu trả ở các trạng thái này không còn giữ món (món có thể được trả lại ở phiếu khác). */
const INACTIVE_RETURN_STATUSES = ['rejected', 'cancelled'];

const serviceError = (status, message) => Object.assign(new Error(message), { name: 'ServiceError', status, statusCode: status });
const idOf = (value) => String(value?._id || value || '');
const makeReturnCode = () => {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `SR-${day}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

/* ------------------------------ Quyền và đọc đơn ------------------------------ */

/** Admin, hoặc quản lý chi nhánh đang phụ trách chi nhánh của đơn. */
const assertCanManageReturns = async (order, user, session = null) => {
  if (isAdmin(user)) return;
  if (!isBranchManager(user)) throw serviceError(403, 'Chỉ quản lý chi nhánh của đơn mới được xử lý trả hàng.');
  const location = await InventoryLocation.findById(order.locationId).populate('shopId', 'managerId status isDeleted')
    .session(session).lean();
  const shop = location?.shopId;
  const owned = shop && shop.status === 'ACTIVE' && !shop.isDeleted && idOf(shop.managerId) === idOf(user._id);
  if (!owned) throw serviceError(403, 'Đơn bán không thuộc chi nhánh bạn quản lý.');
};

const loadOrder = async (orderId, session = null) => {
  if (!mongoose.isValidObjectId(orderId)) throw serviceError(400, 'Mã đơn bán không hợp lệ.');
  const order = await SalesOrder.findById(orderId).session(session).lean();
  if (!order) throw serviceError(404, 'Không tìm thấy đơn bán.');
  return order;
};

/** Các dòng trả đang có hiệu lực của đơn: số món đã trả theo dòng đơn và tập id món đã trả. */
const previousReturnsOfOrder = async (orderId, session) => {
  const returns = await SalesReturn.find({ salesOrderId: orderId, returnStatus: { $nin: INACTIVE_RETURN_STATUSES } })
    .select('_id').session(session).lean();
  const returnedCountByDetail = new Map();
  const returnedItemIds = new Set();
  if (!returns.length) return { returnedCountByDetail, returnedItemIds };
  const details = await SalesReturnDetail.find({ salesReturnId: { $in: returns.map((row) => row._id) } })
    .select('salesOrderDetailId quantityReturned itemIds').session(session).lean();
  for (const detail of details) {
    const key = idOf(detail.salesOrderDetailId);
    returnedCountByDetail.set(key, (returnedCountByDetail.get(key) || 0) + Number(detail.quantityReturned || 0));
    for (const itemId of detail.itemIds || []) returnedItemIds.add(idOf(itemId));
  }
  return { returnedCountByDetail, returnedItemIds };
};

/* ------------------------------ Đọc ------------------------------ */

/** Danh sách phiếu trả của một đơn (kèm dòng và mã món). */
export const listSalesReturns = async (orderId, user) => {
  const order = await loadOrder(orderId);
  await assertCanManageReturns(order, user);
  const returns = await SalesReturn.find({ salesOrderId: order._id }).sort({ createdAt: -1 })
    .populate('createdBy', 'FullName Email').lean();
  if (!returns.length) return [];
  const details = await SalesReturnDetail.find({ salesReturnId: { $in: returns.map((row) => row._id) } })
    .populate('itemIds', 'itemCode serialNumber status').lean();
  return returns.map((row) => ({ ...row, items: details.filter((detail) => idOf(detail.salesReturnId) === idOf(row._id)) }));
};

/**
 * Món còn trả được của đơn, theo dòng đơn: món đã bán của đơn, đang `sold`, chưa nằm trong phiếu trả có hiệu lực.
 * Dùng cho màn chọn món khi tạo phiếu trả.
 */
export const getReturnableItems = async (orderId, user) => {
  const order = await loadOrder(orderId);
  await assertCanManageReturns(order, user);
  const [details, previous] = await Promise.all([
    SalesOrderDetail.find({ salesOrderId: order._id }).populate('variantId', 'sku size color').lean(),
    previousReturnsOfOrder(order._id, null),
  ]);
  const soldIds = details.flatMap((detail) => detail.itemIds || []);
  const items = soldIds.length
    ? await InventoryItem.find({ _id: { $in: soldIds }, status: 'sold' }).select('_id itemCode serialNumber status variantId').lean()
    : [];
  return details.map((detail) => ({
    salesOrderDetailId: detail._id,
    variant: detail.variantId,
    quantity: detail.quantity,
    quantityReturned: previous.returnedCountByDetail.get(idOf(detail._id)) || 0,
    hasItemList: Boolean(detail.itemIds?.length),
    items: returnableItemsOf(detail, items, previous.returnedItemIds),
  }));
};

/* ------------------------------ Tạo phiếu trả ------------------------------ */

/** Đổi trạng thái các món trả của một dòng theo kết quả kiểm và ghi sổ `sales_return`. */
const restockReturnLine = async ({ order, line, variantId, salesReturn, items, user, session }) => {
  const resultByItem = new Map(line.inspectionResults.map((row) => [row.itemId, row.result]));
  await moveItems(items, (item) => ({
    status: returnedItemStatus(resultByItem.get(idOf(item._id))),
    locationId: order.locationId,
    storageId: null,
  }), session);
  await recordItemMovements(items, {
    variantId,
    locationId: order.locationId,
    storageId: null,
    movementType: 'sales_return',
    quantityChange: 1,
    referenceType: 'sales_return',
    referenceId: salesReturn._id,
    createdBy: user._id,
  }, session);
};

/**
 * Tạo phiếu trả hàng bán theo món và nhập lại kho chi nhánh của đơn (một transaction).
 * Chỉ áp dụng cho đơn `completed`. Trả về phiếu kèm các dòng.
 */
export const createSalesReturn = async (orderId, payload, user) => {
  const data = parseSalesReturnPayload(payload);
  const session = await mongoose.startSession();
  let returnId;
  try {
    await session.withTransaction(async () => {
      const order = await loadOrder(orderId, session);
      await assertCanManageReturns(order, user, session);
      if (order.orderStatus !== 'completed') throw serviceError(409, 'Chỉ trả hàng cho đơn bán đã hoàn tất.');

      const details = await SalesOrderDetail.find({ salesOrderId: order._id }).session(session).lean();
      const itemIds = data.items.flatMap((line) => line.itemIds);
      const [previous, items] = await Promise.all([
        previousReturnsOfOrder(order._id, session),
        InventoryItem.find({ _id: { $in: itemIds } }).session(session),
      ]);
      const itemById = new Map(items.map((item) => [idOf(item._id), item]));
      checkReturnLines(data.items, {
        detailById: new Map(details.map((detail) => [idOf(detail._id), detail])),
        returnedCountByDetail: previous.returnedCountByDetail,
        returnedItemIds: previous.returnedItemIds,
        itemById,
      });
      const location = await InventoryLocation.findById(order.locationId).session(session).lean();
      await assertBranchCapacity(location, data.items.map((line) => ({ quantity: line.quantityReturned })), session);

      const now = new Date();
      const [salesReturn] = await SalesReturn.create([{
        returnCode: makeReturnCode(),
        salesOrderId: order._id,
        locationId: order.locationId,
        createdBy: user._id,
        approvedBy: user._id,
        approvedAt: now,
        returnStatus: 'completed',
        returnReason: data.returnReason,
        refundAmount: totalRefundAmount(data.items),
      }], { session });
      returnId = salesReturn._id;
      const detailById = new Map(details.map((detail) => [idOf(detail._id), detail]));
      for (const line of data.items) {
        await SalesReturnDetail.create([{ salesReturnId: salesReturn._id, ...line }], { session });
        const lineItems = line.itemIds.map((itemId) => itemById.get(itemId));
        const variantId = detailById.get(line.salesOrderDetailId).variantId;
        await restockReturnLine({ order, line, variantId, salesReturn, items: lineItems, user, session });
      }
    });
  } finally {
    await session.endSession();
  }
  const salesReturn = await SalesReturn.findById(returnId).lean();
  const items = await SalesReturnDetail.find({ salesReturnId: returnId }).populate('itemIds', 'itemCode serialNumber status').lean();
  return { ...salesReturn, items };
};
