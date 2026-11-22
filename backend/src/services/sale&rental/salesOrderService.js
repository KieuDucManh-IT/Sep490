import { resolveProductPricing, isActiveProduct, isActiveVariant } from '../masterdata/productPricing.js';
import { refreshOutOfStockStatus } from '../warehouse/productStockStatusService.js';
/**
 * Sales Order Core Service
 * Layered Monolith Service handling Sales / Purchase Lifecycle
 */

import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { SalesOrderDetail } from '../../models/sale&rental/SalesOrderDetail.js';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { Product } from '../../models/masterdata/Product.js';
import { InventoryReservation } from '../../models/warehouse/inventory/InventoryReservation.js';
import { StockMovement } from '../../models/warehouse/inventory/StockMovement.js';
import { Wallet } from '../../models/finance/Wallet.js';
import { WalletTransaction } from '../../models/finance/WalletTransaction.js';
import {
  readyWallet,
  readBalances,
  changeFunds,
} from '../walletService.js';
import { checkSalesAvailability } from '../warehouse/productInventoryHelper.js';
import {
  reserveStock, closeReservations, releaseReserved, sellItems, withStatus,
} from '../warehouse/orderStockService.js';
import {
  createSalesOrderSchema,
  updateSalesOrderStatusSchema,
} from '../../validations/sale&rental/salesOrderValidation.js';
import { resolvePrimaryShipment } from '../order/orderMonitoringService.js';

export class ServiceError extends Error {
  constructor(status, message, code = null, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = 'ServiceError';
  }
}

/**
 * Sinh mã đơn mua ngẫu nhiên định dạng SO-YYYYMMDD-XXXX
 */
export const generateSalesOrderCode = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `SO-${dateStr}-${randomSuffix}`;
};

/**
 * Sinh mã giao dịch ví ngẫu nhiên
 */
export const generateWalletTxCode = (prefix = 'PAY-SO') => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

/**
 * Tính toán đơn giá bán đứt độc lập từ DB (Price Tampering Defense)
 */
export const calculateSalesOrderPrice = async (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ServiceError(400, 'Danh sách sản phẩm mua không được để trống');
  }

  const variantIds = items.map((it) => it.variantId);
  const variants = await ProductVariant.find({ _id: { $in: variantIds }, isDeleted: { $ne: true } })
    .populate('productId')
    .lean();

  const variantMap = new Map();
  for (const v of variants) {
    variantMap.set(String(v._id), v);
  }

  let subtotal = 0;
  const itemsDetail = [];

  for (const item of items) {
    const variant = variantMap.get(String(item.variantId));
    if (!variant) {
      throw new ServiceError(404, `Không tìm thấy biến thể sản phẩm: ${item.variantId}`);
    }
    if (!isActiveVariant(variant)) {
      throw new ServiceError(422, `Biến thể sản phẩm [${variant.sku || variant._id}] hiện đang tạm ngưng`, 'ERR_ITEM_INACTIVE');
    }

    const product = variant.productId || {};

    if (!isActiveProduct(variant.productId)) {
      throw new ServiceError(422, `Sản phẩm [${product.name || variant.sku}] đã ngừng kinh doanh`, 'ERR_ITEM_INACTIVE');
    }
    // TASK-008: sản phẩm chưa được Shop Owner định giá thì chưa mở bán.
    if (product.isSetPrice !== true) {
      throw new ServiceError(422, `Sản phẩm [${product.name || variant.sku}] chưa được mở bán`, 'ERR_ITEM_NOT_PRICED');
    }

    // Kiểm tra type mismatch: sản phẩm chỉ dành cho thuê không thể mua
    // @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-020
    if (String(product.tag).toLowerCase() === 'rental') {
      throw new ServiceError(400, `Sản phẩm [${product.name || variant.sku}] chỉ dành cho thuê, không thể mua`, 'ERR_ITEM_TYPE_MISMATCH');
    }

    const unitPrice = resolveProductPricing(product, variant).salePrice;

    // Kiểm tra giá bán hợp lệ
    // @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-020
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      throw new ServiceError(400, `Sản phẩm [${product.name || variant.sku}] chưa được thiết lập giá bán hợp lệ`, 'ERR_INVALID_PRICE');
    }

    const qty = Math.max(1, Number(item.quantity) || 1);
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;

    itemsDetail.push({
      variantId: variant._id,
      sku: variant.sku,
      productName: product.name || '',
      size: variant.size || '',
      color: variant.color || '',
      quantity: qty,
      unitPrice,
      discountAmount: 0,
      lineTotal,
      note: item.note || '',
    });
  }

  const discountAmount = 0;
  const shippingFee = 0; // Tạm thời miễn phí vận chuyển theo quyết định người dùng
  const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);

  return {
    itemsDetail,
    subtotal,
    discountAmount,
    shippingFee,
    totalAmount,
  };
};

/**
 * Tạo đơn mua hàng và xử lý thanh toán (Ví hoặc COD) trong MongoDB Transaction
 */
export const createSalesOrder = async ({
  customerId,
  createdBy,
  locationId,
  items,
  paymentMethod = 'cod',
  shippingAddress,
  note = '',
  expectedTotalAmount,
  session: externalSession = null,
  deps = {},
}) => {
  const stockChecker = deps.checkSalesAvailability || checkSalesAvailability;
  const getWallet = deps.readyWallet || readyWallet;
  const getBalances = deps.readBalances || readBalances;
  const modifyFunds = deps.changeFunds || changeFunds;

  // 1. Validate payload đầu vào
  const validationResult = createSalesOrderSchema.safeParse({
    locationId: String(locationId),
    items: items.map((it) => ({
      variantId: String(it.variantId),
      quantity: Number(it.quantity),
      note: it.note,
    })),
    paymentMethod,
    shippingAddress,
    note,
  });

  if (!validationResult.success) {
    const errorMsg = validationResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new ServiceError(400, `Dữ liệu đơn mua không hợp lệ: ${errorMsg}`);
  }

  // 2. Tính toán giá authoritative từ database
  const priceCalc = await calculateSalesOrderPrice(items);
  // Reject price changes between the read-only quote and order submission, before payment.
  if (expectedTotalAmount !== undefined && (!Number.isFinite(expectedTotalAmount) || expectedTotalAmount !== priceCalc.totalAmount)) {
    throw new ServiceError(409, 'Giá đã thay đổi. Vui lòng kiểm tra lại tổng tiền trước khi xác nhận.', 'ERR_PRICE_CHANGED');
  }


  // 3. Kiểm tra khả dụng tồn kho tại chi nhánh chỉ định
  // Aggregate duplicate variantIds trước khi kiểm tra kho — REQ-CART-021 / REQ-CART-023
  const aggregatedItems = new Map();
  for (const it of priceCalc.itemsDetail) {
    const key = String(it.variantId);
    if (aggregatedItems.has(key)) {
      aggregatedItems.get(key).quantity += it.quantity;
    } else {
      aggregatedItems.set(key, { ...it });
    }
  }
  const itemsToCheck = [...aggregatedItems.values()];

  for (const it of itemsToCheck) {
    const stockCheck = await stockChecker(
      it.variantId,
      locationId,
      it.quantity
    );
    if (!stockCheck.available) {
      throw new ServiceError(
        409,
        stockCheck.code === 'ERR_OUT_OF_STOCK'
          ? `Sản phẩm ${it.sku || it.variantId} chỉ còn ${stockCheck.availableQty ?? 0}.`
          : `Chi nhánh không đủ số lượng khả dụng cho sản phẩm [${it.sku || it.variantId}]: ${stockCheck.message}`,
        stockCheck.code || 'ERR_OUT_OF_STOCK',
        { requestedQuantity: it.quantity, availableQuantity: stockCheck.availableQty ?? 0 }
      );
    }
  }

  // 4. Mở MongoDB Session Transaction
  const session = externalSession || (await mongoose.startSession());
  const isInternalSession = !externalSession;
  if (isInternalSession) {
    session.startTransaction();
  }

  try {
    // TASK-010: giữ chỗ NGUYÊN TỬ trên dòng (locationId, storageId: null, variantId), không upsert → 409 ERR_OUT_OF_STOCK.
    await reserveStock({ locationId, lines: itemsToCheck }, session);

    let orderStatus = 'confirmed';
    let paymentStatus = 'unpaid';
    let paymentRefId = null;

    // 5. Nếu thanh toán qua Ví nội bộ Vestora
    if (paymentMethod === 'wallet') {
      const wallet = await getWallet(customerId);
      const balances = getBalances(wallet);
      const requiredAmount = priceCalc.totalAmount;
      const availableBalance = balances.availableBalance ?? balances.available ?? 0;

      if (availableBalance < requiredAmount) {
        throw new ServiceError(
          409,
          `Số dư khả dụng trong Ví (${availableBalance.toLocaleString('vi-VN')} đ) không đủ để thanh toán đơn mua (${priceCalc.totalAmount.toLocaleString('vi-VN')} đ)`,
          'ERR_INSUFFICIENT_WALLET_BALANCE'
        );
      }

      paymentStatus = 'paid';

      // Trừ tiền mua đứt từ ví
      const [walletTx] = await WalletTransaction.create(
        [
          {
            walletId: wallet._id,
            userId: customerId,
            code: generateWalletTxCode('PAY-SO'),
            transactionType: 'payment',
            direction: 'debit',
            amount: priceCalc.totalAmount,
            currency: 'VND',
            status: 'success',
            referenceType: 'SalesOrder',
          },
        ],
        { session }
      );

      paymentRefId = walletTx._id;

      await modifyFunds(
        wallet,
        walletTx,
        -priceCalc.totalAmount,
        0,
        'sales_order_payment',
        session
      );
    }

    // 6. Tạo SalesOrder
    const orderCode = generateSalesOrderCode();
    const [order] = await SalesOrder.create(
      [
        {
          orderCode,
          locationId,
          customerId,
          createdBy: createdBy || customerId,
          orderStatus,
          paymentStatus,
          paymentMethod,
          subtotal: priceCalc.subtotal,
          discountAmount: priceCalc.discountAmount,
          shippingFee: priceCalc.shippingFee,
          totalAmount: priceCalc.totalAmount,
          shippingAddress,
          paymentRefId,
          confirmedAt: new Date(),
          note,
        },
      ],
      { session }
    );

    // 7. Tạo SalesOrderDetail & Giữ chỗ kho (InventoryReservation)
    const detailDocs = priceCalc.itemsDetail.map((it) => ({
      salesOrderId: order._id,
      variantId: it.variantId,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountAmount: it.discountAmount,
      lineTotal: it.lineTotal,
    }));
    await SalesOrderDetail.insertMany(detailDocs, { session });

    // Tạo các bản ghi giữ chỗ tồn kho
    const reservationDocs = priceCalc.itemsDetail.map((it) => ({
      variantId: it.variantId,
      locationId,
      orderType: 'sale',
      orderId: order._id,
      quantity: it.quantity,
      reservedAt: new Date(),
      status: 'active',
    }));
    await InventoryReservation.insertMany(reservationDocs, { session });

    // quantityReserved đã tăng ở bước giữ chỗ nguyên tử đầu transaction (reserveStock).

    if (isInternalSession) {
      await session.commitTransaction();
    }

    return {
      order,
      items: detailDocs,
    };
  } catch (error) {
    if (isInternalSession) {
      await session.abortTransaction();
    }
    throw withStatus(error);
  } finally {
    if (isInternalSession) {
      session.endSession();
    }
  }
};

export const getMySalesOrders = async ({
  customerId,
  page = 1,
  limit = 20,
  orderStatus,
}) => {
  const query = { customerId };
  if (orderStatus && orderStatus !== 'ALL') {
    query.orderStatus = orderStatus;
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [orders, total] = await Promise.all([
    SalesOrder.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('locationId', 'name address city')
      .lean(),
    SalesOrder.countDocuments(query),
  ]);

  const orderIds = orders.map((o) => o._id);
  const [details, shipments] = await Promise.all([
    orderIds.length
      ? SalesOrderDetail.find({ salesOrderId: { $in: orderIds } })
          .populate({
            path: 'variantId',
            select: 'sku size color productId attributes',
            populate: {
              path: 'productId',
              select: 'name productCode images thumbnail thumbnailImage brand',
            },
          })
          .lean()
      : [],
    orderIds.length
      ? OrderShipment.find({ orderId: { $in: orderIds }, orderType: 'sale' })
          .sort({ createdAt: -1 })
          .lean()
      : [],
  ]);

  const detailsByOrder = new Map();
  for (const d of details) {
    const oid = String(d.salesOrderId);
    if (!detailsByOrder.has(oid)) detailsByOrder.set(oid, []);
    detailsByOrder.get(oid).push(d);
  }

  const shipmentsByOrder = new Map();
  for (const s of shipments) {
    const oid = String(s.orderId);
    if (!shipmentsByOrder.has(oid)) shipmentsByOrder.set(oid, []);
    shipmentsByOrder.get(oid).push(s);
  }

  const enrichedOrders = orders.map((o) => {
    const ordShipments = shipmentsByOrder.get(String(o._id)) || [];
    return {
      ...o,
      items: detailsByOrder.get(String(o._id)) || [],
      shipments: ordShipments,
      shipment: resolvePrimaryShipment(ordShipments),
    };
  });

  return {
    orders: enrichedOrders,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

/**
 * Lấy chi tiết đơn mua theo ID
 */
export const getSalesOrderById = async (orderId, currentUser) => {
  const order = await SalesOrder.findById(orderId)
    .populate('locationId', 'name address city shopId')
    .populate('customerId', 'name email phone avatar')
    .lean();

  if (!order) {
    throw new ServiceError(404, 'Không tìm thấy đơn mua hàng');
  }

  // Quyền: Người đặt đơn hoặc Staff/Admin mới được xem
  const isOwner = String(order.customerId?._id || order.customerId) === String(currentUser?._id);
  const isPrivileged = currentUser && ['admin', 'manager', 'staff'].includes(currentUser.role);
  if (!isOwner && !isPrivileged) {
    throw new ServiceError(403, 'Bạn không có quyền xem thông tin đơn hàng này');
  }

  const [items, shipments] = await Promise.all([
    SalesOrderDetail.find({ salesOrderId: order._id })
      .populate({
        path: 'variantId',
        select: 'sku size color productId attributes',
        populate: {
          path: 'productId',
          select: 'name productCode images thumbnail thumbnailImage brand',
        },
      })
      .lean(),
    OrderShipment.find({ orderId: order._id, orderType: 'sale' })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  return {
    ...order,
    items,
    shipments,
    shipment: resolvePrimaryShipment(shipments),
  };
};

/**
 * Lấy danh sách đơn mua tại một chi nhánh cho nhân viên quản lý
 */
export const getBranchSalesOrders = async ({
  locationId,
  page = 1,
  limit = 50,
  orderStatus,
  paymentStatus,
  paymentMethod,
  search,
}) => {
  const query = {};
  if (locationId && locationId !== 'all') {
    query.locationId = locationId;
  }
  if (orderStatus && orderStatus !== 'ALL') {
    query.orderStatus = orderStatus;
  }
  if (paymentStatus && paymentStatus !== 'ALL') {
    query.paymentStatus = paymentStatus;
  }
  if (paymentMethod && paymentMethod !== 'ALL') {
    query.paymentMethod = paymentMethod;
  }
  if (search) {
    query.$or = [
      { orderCode: { $regex: search, $options: 'i' } },
      { 'shippingAddress.receiverName': { $regex: search, $options: 'i' } },
      { 'shippingAddress.phone': { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [orders, total] = await Promise.all([
    SalesOrder.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('customerId', 'name email phone avatar')
      .populate('locationId', 'name address city')
      .lean(),
    SalesOrder.countDocuments(query),
  ]);

  const orderIds = orders.map((o) => o._id);
  const [details, shipments] = await Promise.all([
    orderIds.length
      ? SalesOrderDetail.find({ salesOrderId: { $in: orderIds } })
          .populate({
            path: 'variantId',
            select: 'sku size color productId',
            populate: {
              path: 'productId',
              select: 'name productCode',
            },
          })
          .lean()
      : [],
    orderIds.length
      ? OrderShipment.find({ orderId: { $in: orderIds }, orderType: 'sale' })
          .sort({ createdAt: -1 })
          .lean()
      : [],
  ]);

  const detailsByOrder = new Map();
  for (const d of details) {
    const oid = String(d.salesOrderId);
    if (!detailsByOrder.has(oid)) detailsByOrder.set(oid, []);
    detailsByOrder.get(oid).push(d);
  }

  const shipmentsByOrder = new Map();
  for (const s of shipments) {
    const oid = String(s.orderId);
    if (!shipmentsByOrder.has(oid)) shipmentsByOrder.set(oid, []);
    shipmentsByOrder.get(oid).push(s);
  }

  const enrichedOrders = orders.map((o) => {
    const ordShipments = shipmentsByOrder.get(String(o._id)) || [];
    return {
      ...o,
      items: detailsByOrder.get(String(o._id)) || [],
      shipments: ordShipments,
      shipment: resolvePrimaryShipment(ordShipments),
    };
  });

  return {
    orders: enrichedOrders,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
  };
};

/**
 * Cập nhật trạng thái đơn mua hàng
 */
export const updateSalesOrderStatus = async ({
  orderId,
  orderStatus,
  user,
  note = '',
}) => {
  const validationResult = updateSalesOrderStatusSchema.safeParse({
    salesOrderId: String(orderId),
    orderStatus,
    note,
  });

  if (!validationResult.success) {
    const errorMsg = validationResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new ServiceError(400, `Dữ liệu cập nhật không hợp lệ: ${errorMsg}`);
  }

  const order = await SalesOrder.findById(orderId);
  if (!order) {
    throw new ServiceError(404, 'Không tìm thấy đơn mua hàng');
  }

  if (order.orderStatus === 'cancelled' || order.orderStatus === 'completed') {
    throw new ServiceError(422, `Không thể thay đổi trạng thái đơn hàng đã ${order.orderStatus}`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Chốt trạng thái có điều kiện: hai lần hoàn tất/hủy đồng thời → lần sau 409 (không trừ kho hai lần).
    const claimed = await SalesOrder.updateOne(
      { _id: order._id, orderStatus: order.orderStatus },
      { $set: { orderStatus } },
      { session }
    );
    if (claimed.matchedCount !== 1) throw new ServiceError(409, 'Đơn mua vừa được cập nhật bởi người khác, vui lòng tải lại.');

    const updateFields = { orderStatus };
    if (note) {
      updateFields.note = order.note ? `${order.note} | ${note}` : note;
    }

    if (orderStatus === 'shipped') {
      updateFields.shippedAt = new Date();
    } else if (orderStatus === 'completed') {
      updateFields.completedAt = new Date();
      // Nếu COD, khi completed thì chuyển paymentStatus thành 'paid'
      if (order.paymentMethod === 'cod') {
        updateFields.paymentStatus = 'paid';
      }

      // TASK-010: nhả giữ chỗ (InventoryReservation active → consumed) và trừ tồn thật:
      // chọn FIFO món `available` (condition dùng được) → `sold` qua itemStateService, gộp reserved −qty;
      // StockMovement mỗi món một dòng có itemId (trả hàng bán tra lại món qua các dòng này).
      const details = await SalesOrderDetail.find({ salesOrderId: order._id }).populate('variantId', 'sku').session(session);
      const reservedByVariant = await closeReservations({ orderId: order._id, orderType: 'sale' }, 'consumed', session);
      const lines = new Map();
      for (const it of details) {
        const variantId = String(it.variantId?._id || it.variantId);
        if (!lines.has(variantId)) lines.set(variantId, { variantId: it.variantId?._id || it.variantId, sku: it.variantId?.sku, quantity: 0 });
        lines.get(variantId).quantity += it.quantity;
      }
      for (const [variantId, line] of lines) {
        const reservedQuantity = reservedByVariant.get(variantId) || 0;
        const soldItems = await sellItems({
          locationId: order.locationId, variantId: line.variantId, quantity: line.quantity, reservedQuantity, sku: line.sku,
        }, session);
        await StockMovement.insertMany(soldItems.map((item) => ({
          variantId: line.variantId,
          itemId: item._id,
          locationId: order.locationId,
          storageId: item.storageId ?? null,
          movementType: 'sale',
          quantityChange: -1,
          referenceType: 'sales_order',
          referenceId: order._id,
          createdBy: user._id,
        })), { session });
      }
    } else if (orderStatus === 'cancelled') {
      updateFields.cancelledAt = new Date();

      // TASK-010: giải phóng giữ chỗ đúng bằng số InventoryReservation đang active (→ released). Món không đổi.
      const reservedByVariant = await closeReservations({ orderId: order._id, orderType: 'sale' }, 'released', session);
      await releaseReserved({ locationId: order.locationId, reservedByVariant }, session);

      // Nếu đã thanh toán bằng ví, hoàn tiền lại cho khách hàng
      if (order.paymentStatus === 'paid' && order.paymentMethod === 'wallet' && order.customerId) {
        const wallet = await readyWallet(order.customerId);
        const [refundTx] = await WalletTransaction.create(
          [
            {
              walletId: wallet._id,
              userId: order.customerId,
              code: generateWalletTxCode('REF-SO'),
              transactionType: 'refund',
              direction: 'credit',
              amount: order.totalAmount,
              currency: 'VND',
              status: 'success',
              referenceType: 'SalesOrder',
              referenceId: order._id,
            },
          ],
          { session }
        );

        await changeFunds(
          wallet,
          refundTx,
          order.totalAmount,
          0,
          'sales_order_refund',
          session
        );

        updateFields.paymentStatus = 'refunded';
      }
    }

    const updatedOrder = await SalesOrder.findByIdAndUpdate(
      order._id,
      { $set: updateFields },
      { new: true, session }
    );

    await session.commitTransaction();

    // TASK-012: Sau khi bán (delivered) → kiểm tra lại tồn kho, có thể hết hàng
    if (orderStatus === 'delivered') {
      try {
        const updatedDetails = await SalesOrderDetail.find({ salesOrderId: order._id }).populate({ path: 'variantId', select: 'productId' }).lean();
        const productIds = [...new Set(updatedDetails.map((d) => String(d.variantId?.productId)).filter(Boolean))];
        if (productIds.length) refreshOutOfStockStatus(productIds).catch((err) => console.error('[TASK-012] sales refresh lỗi:', err.message));
      } catch (err) { /* không block kết quả */ }
    }

    return updatedOrder;
  } catch (error) {
    await session.abortTransaction();
    throw withStatus(error);
  } finally {
    session.endSession();
  }
};
