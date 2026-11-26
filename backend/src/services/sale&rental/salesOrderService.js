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
  inTransaction,
} from '../walletService.js';
import { checkSalesAvailability } from '../warehouse/productInventoryHelper.js';
import {
  reserveStock,
  closeReservations,
  releaseReserved,
  sellItems,
  withStatus,
  aggregateLines,
} from '../warehouse/orderStockService.js';
import {
  createSalesOrderSchema,
  updateSalesOrderStatusSchema,
} from '../../validations/sale&rental/salesOrderValidation.js';
import { resolvePrimaryShipment } from '../order/orderMonitoringService.js';
import { splitItemsByLines } from './salesReturnRules.js';
import cloudinary from '../../config/cloudinary.js';
import { encryptValue } from '../../utils/walletSecurity.js';
import { SalesReturn } from '../../models/sale&rental/SalesReturn.js';
import { SalesReturnDetail } from '../../models/sale&rental/SalesReturnDetail.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import { moveItems } from '../warehouse/itemStateService.js';
import { fetchOrderAndValidateScope } from '../shipping/shipmentHelpers.js';
import { createNotification, notifyRoles } from '../system/notificationService.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { Shop } from '../../models/shop/Shop.js';
import User from '../../models/system/User.js';

/**
 * Phát thông báo bất đồng bộ khi đơn mua hàng mới được tạo thành công
 */
async function notifyNewSalesOrder(order, customerId) {
  try {
    const [location, customer] = await Promise.all([
      InventoryLocation.findById(order.locationId).select('managerId shopId name code').lean().catch(() => null),
      User.findById(customerId).select('FullName Email phone').lean().catch(() => null),
    ]);

    let shop = null;
    if (location?.shopId) {
      shop = await Shop.findById(location.shopId).select('managerId ownerId name').lean().catch(() => null);
    } else if (order.locationId) {
      shop = await Shop.findById(order.locationId).select('managerId ownerId name').lean().catch(() => null);
    }

    const branchName = shop?.name || location?.name || 'Chi nhánh';
    const customerName = customer?.FullName || customer?.Email || 'Khách hàng';

    // 1. Thông báo cho Khách hàng
    createNotification({
      userId: customerId,
      type: 'order_created',
      title: 'Đặt mua hàng thành công',
      message: `Đơn mua hàng #${order.orderCode} đã được khởi tạo thành công tại ${branchName}. VESTORA sẽ sớm chuẩn bị và giao hàng cho bạn!`,
      link: '/rental-orders?tab=sale',
      referenceType: 'SalesOrder',
      referenceId: order._id,
      metadata: { orderCode: order.orderCode },
    }).catch((err) => console.error('[Notification] Lỗi gửi thông báo cho khách hàng:', err.message));

    // 2. Thông báo cho Branch Manager của chi nhánh
    const branchManagerId = shop?.managerId || location?.managerId;
    if (branchManagerId) {
      createNotification({
        userId: branchManagerId,
        type: 'order_created',
        title: 'Đơn mua hàng mới từ khách hàng',
        message: `Khách hàng ${customerName} vừa đặt đơn mua #${order.orderCode} tại ${branchName}. Vui lòng kiểm tra và chuẩn bị sản phẩm!`,
        link: '/branch/sale-orders',
        referenceType: 'SalesOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo cho Branch Manager:', err.message));
    } else {
      // Nếu chi nhánh chưa có quản lý chỉ định, phát cho tất cả tài khoản Quản lý chi nhánh
      notifyRoles(['branch_manager'], {
        type: 'order_created',
        title: 'Đơn mua hàng mới từ khách hàng',
        message: `Khách hàng ${customerName} vừa đặt đơn mua #${order.orderCode} tại ${branchName}. Vui lòng kiểm tra và chuẩn bị sản phẩm!`,
        link: '/branch/sale-orders',
        referenceType: 'SalesOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo cho Branch Managers:', err.message));
    }

    // 3. Thông báo cho Shop Owner / Owner
    if (shop?.ownerId && String(shop.ownerId) !== String(branchManagerId)) {
      createNotification({
        userId: shop.ownerId,
        type: 'order_created',
        title: 'Đơn mua hàng mới tại hệ thống',
        message: `Khách hàng ${customerName} vừa đặt đơn mua #${order.orderCode} tại ${branchName}.`,
        link: '/owner/sale-orders',
        referenceType: 'SalesOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo cho Shop Owner:', err.message));
    } else if (!shop?.ownerId) {
      notifyRoles(['shopOwner', 'owner'], {
        type: 'order_created',
        title: 'Đơn mua hàng mới tại hệ thống',
        message: `Khách hàng ${customerName} vừa đặt đơn mua #${order.orderCode} tại ${branchName}.`,
        link: '/owner/sale-orders',
        referenceType: 'SalesOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo cho Shop Owner:', err.message));
    }
  } catch (err) {
    console.error('[Notification] Lỗi xử lý thông báo đơn mua mới:', err.message);
  }
}

/**
 * Phát thông báo khi trạng thái đơn mua hàng thay đổi
 */
async function notifySalesOrderStatusChanged(order, newStatus, note = '') {
  try {
    if (!order) return;

    const [location, customer] = await Promise.all([
      InventoryLocation.findById(order.locationId).select('managerId shopId name code').lean().catch(() => null),
      User.findById(order.customerId).select('FullName Email phone').lean().catch(() => null),
    ]);

    let shop = null;
    if (location?.shopId) {
      shop = await Shop.findById(location.shopId).select('managerId ownerId name').lean().catch(() => null);
    } else if (order.locationId) {
      shop = await Shop.findById(order.locationId).select('managerId ownerId name').lean().catch(() => null);
    }

    const branchName = shop?.name || location?.name || 'Chi nhánh';
    const customerName = customer?.FullName || customer?.Email || 'Khách hàng';

    let custTitle = '';
    let custMessage = '';
    let mgrTitle = '';
    let mgrMessage = '';

    if (newStatus === 'shipped') {
      custTitle = 'Đơn mua hàng đang được vận chuyển';
      custMessage = `Đơn mua hàng #${order.orderCode} của bạn đang trên đường vận chuyển. Vui lòng chú ý điện thoại khi shipper liên hệ!`;
      mgrTitle = `Đơn mua #${order.orderCode} đang được vận chuyển`;
      mgrMessage = `Đơn mua #${order.orderCode} của khách ${customerName} tại ${branchName} đã được chuyển sang trạng thái đang giao hàng.`;
    } else if (newStatus === 'completed') {
      custTitle = 'Đơn mua hàng đã hoàn tất';
      custMessage = `Đơn mua hàng #${order.orderCode} đã được giao thành công. Cảm ơn bạn đã mua sắm tại VESTORA!`;
      mgrTitle = `Đơn mua #${order.orderCode} đã hoàn tất`;
      mgrMessage = `Đơn mua #${order.orderCode} của khách ${customerName} tại ${branchName} đã giao thành công và hoàn tất đơn hàng.`;
    } else if (newStatus === 'cancelled') {
      custTitle = `Đơn mua hàng #${order.orderCode} đã bị hủy`;
      custMessage = `Đơn mua hàng #${order.orderCode} đã bị hủy.${note ? ` Lý do: ${note}.` : ''}${order.paymentMethod === 'wallet' ? ' Tiền hoàn đã được chuyển về ví của bạn.' : ''}`;
      mgrTitle = `Đơn mua #${order.orderCode} đã bị hủy`;
      mgrMessage = `Đơn mua #${order.orderCode} của khách ${customerName} tại ${branchName} đã bị hủy.${note ? ` Lý do: ${note}.` : ''}`;
    }

    // 1. Gửi thông báo cho khách hàng
    if (custTitle && custMessage && order.customerId) {
      createNotification({
        userId: order.customerId,
        type: 'order_status',
        title: custTitle,
        message: custMessage,
        link: '/rental-orders?tab=sale',
        referenceType: 'SalesOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, orderStatus: newStatus },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo đổi trạng thái đơn mua cho khách:', err.message));
    }

    // 2. Gửi thông báo cho Quản lý chi nhánh
    const branchManagerId = shop?.managerId || location?.managerId;
    if (mgrTitle && mgrMessage) {
      if (branchManagerId) {
        createNotification({
          userId: branchManagerId,
          type: 'order_status',
          title: mgrTitle,
          message: mgrMessage,
          link: '/branch/sale-orders',
          referenceType: 'SalesOrder',
          referenceId: order._id,
          metadata: { orderCode: order.orderCode, orderStatus: newStatus, locationId: order.locationId },
        }).catch((err) => console.error('[Notification] Lỗi gửi thông báo đổi trạng thái đơn mua cho Branch Manager:', err.message));
      } else {
        notifyRoles(['branch_manager'], {
          type: 'order_status',
          title: mgrTitle,
          message: mgrMessage,
          link: '/branch/sale-orders',
          referenceType: 'SalesOrder',
          referenceId: order._id,
          metadata: { orderCode: order.orderCode, orderStatus: newStatus, locationId: order.locationId },
        }).catch((err) => console.error('[Notification] Lỗi gửi thông báo đổi trạng thái đơn mua cho Branch Managers:', err.message));
      }

      // 3. Gửi thông báo cho Shop Owner
      if (shop?.ownerId && String(shop.ownerId) !== String(branchManagerId)) {
        createNotification({
          userId: shop.ownerId,
          type: 'order_status',
          title: mgrTitle,
          message: mgrMessage,
          link: '/owner/sale-orders',
          referenceType: 'SalesOrder',
          referenceId: order._id,
          metadata: { orderCode: order.orderCode, orderStatus: newStatus, locationId: order.locationId },
        }).catch((err) => console.error('[Notification] Lỗi gửi thông báo đổi trạng thái đơn mua cho Shop Owner:', err.message));
      } else if (!shop?.ownerId) {
        notifyRoles(['shopOwner', 'owner'], {
          type: 'order_status',
          title: mgrTitle,
          message: mgrMessage,
          link: '/owner/sale-orders',
          referenceType: 'SalesOrder',
          referenceId: order._id,
          metadata: { orderCode: order.orderCode, orderStatus: newStatus, locationId: order.locationId },
        }).catch((err) => console.error('[Notification] Lỗi gửi thông báo đổi trạng thái đơn mua cho Shop Owner:', err.message));
      }
    }
  } catch (err) {
    console.error('[Notification] Lỗi xử lý thông báo trạng thái đơn mua:', err.message);
  }
}

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
    const salesOrderId = new mongoose.Types.ObjectId();

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
            referenceId: salesOrderId,
            businessKey: `sales-payment:${salesOrderId}`,
            completedAt: new Date(),
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
      await walletTx.save({ session });
    }

    // 6. Tạo SalesOrder
    const orderCode = generateSalesOrderCode();
    const [order] = await SalesOrder.create(
      [
        {
          _id: salesOrderId,
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
          paidAmount: paymentMethod === 'wallet' ? priceCalc.totalAmount : 0,
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

    // Phát thông báo real-time tới Khách hàng, Quản lý chi nhánh và Chủ shop
    notifyNewSalesOrder(order, customerId);

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

  const order = await SalesOrder.findById(orderId).select('+packingVideo');
  if (!order) {
    throw new ServiceError(404, 'Không tìm thấy đơn mua hàng');
  }

  if (
    ['shipped', 'completed'].includes(orderStatus) &&
    !order.packingVideo
  ) {
    throw new ServiceError(
      422,
      'Chi nhánh phải tải video đóng hàng ở mục 5 trước khi giao hàng.'
    );
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
        updateFields.paidAmount = order.totalAmount;
      }

      // TASK-010: nhả giữ chỗ (InventoryReservation active → consumed) và trừ tồn thật:
      // chọn FIFO món `available` → `sold` qua itemStateService, gộp reserved −qty;
      // StockMovement mỗi món một dòng có itemId. TASK-016 C: ghi món đã bán vào `itemIds` của từng dòng đơn.
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
        const variantDetails = details.filter((it) => String(it.variantId?._id || it.variantId) === variantId);
        for (const { detailId, itemIds } of splitItemsByLines(variantDetails, soldItems)) {
          await SalesOrderDetail.updateOne({ _id: detailId }, { $set: { itemIds } }, { session });
        }
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

    // Phát thông báo thay đổi trạng thái đơn mua hàng
    notifySalesOrderStatusChanged(updatedOrder, orderStatus, note);

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
export const SALES_EVIDENCE_FIELDS = Object.freeze({
  packing: 'packingVideo',
  receiving: 'receivingVideo',
  return: 'returnVideo',
  'return-received': 'returnReceivedVideo',
});

export const salesReturnSimulatorEnabled = () =>
  process.env.NODE_ENV !== 'production' &&
  process.env.ENABLE_GHN_SIMULATOR === 'true';

const salesManager = user =>
  ['admin', 'owner', 'shopowner', 'branchmanager'].includes(
    String(user?.Role || user?.role || '')
      .toLowerCase()
      .replace(/[\s_-]/g, '')
  );

const saleReturnable = order =>
  order.orderStatus === 'completed' &&
  order.paymentStatus === 'paid' &&
  order.returnStatus !== 'completed';

export async function accessSalesReturnOrder(
  user,
  id,
  staffOnly = false,
  session = null
) {
  if (!mongoose.isValidObjectId(id)) {
    throw new ServiceError(400, 'Mã đơn mua không hợp lệ.');
  }

  const order = await SalesOrder.findById(id)
    .select('+packingVideo +receivingVideo +returnVideo +returnReceivedVideo')
    .session(session);

  if (!order) {
    throw new ServiceError(404, 'Không tìm thấy đơn mua.');
  }

  const manager = salesManager(user);

  if (manager) {
    try {
      await fetchOrderAndValidateScope(user, 'sale', id);
    } catch (error) {
      throw withStatus(error);
    }
  } else if (
    staffOnly ||
    String(order.customerId) !== String(user?._id)
  ) {
    throw new ServiceError(403, 'Bạn không có quyền thao tác đơn mua này.');
  }

  return { order, manager };
}

async function salesEvidencePermissions(order, user, manager, shipment) {
  const owner =
    String(order.customerId?._id || order.customerId) === String(user._id);

  const outboundStarted = await OrderShipment.exists({
    orderType: 'sale',
    orderId: order._id,
    shipmentType: 'outbound',
    shipmentStatus: { $in: ['shipped', 'delivered'] },
  });

  return {
    packing:
      manager &&
      ['draft', 'confirmed', 'processing'].includes(order.orderStatus) &&
      !outboundStarted,

    receiving:
      owner &&
      order.orderStatus === 'completed' &&
      order.returnStatus !== 'completed',

    return:
      owner &&
      saleReturnable(order) &&
      (!shipment || shipment.shipmentStatus === 'preparing'),

    'return-received':
      manager &&
      saleReturnable(order) &&
      shipment?.shipmentStatus === 'delivered',
  };
}

function signedSalesEvidence(video) {
  if (!video) return null;

  const expiresAt = Math.floor(Date.now() / 1000) + 900;

  return {
    uploadedAt: video.uploadedAt,
    expiresAt: expiresAt * 1000,
    url: cloudinary.utils.private_download_url(
      video.publicId,
      video.format,
      {
        resource_type: 'video',
        type: 'authenticated',
        attachment: false,
        expires_at: expiresAt,
      }
    ),
  };
}

export async function getSalesReturnFlow(user, id) {
  const { order, manager } = await accessSalesReturnOrder(user, id);

  await order.populate([
    { path: 'customerId', select: 'FullName Information' },
    { path: 'locationId', populate: { path: 'shopId' } },
  ]);

  const details = await SalesOrderDetail.find({ salesOrderId: id })
    .populate({
      path: 'variantId',
      select: 'sku size color productId',
      populate: {
        path: 'productId',
        select: 'name images image',
      },
    })
    .lean();

  const shipment = await OrderShipment.findOne({
    orderId: id,
    orderType: 'sale',
    shipmentType: 'return',
  })
    .sort({ createdAt: -1 })
    .lean();

  const shop = order.locationId?.shopId || order.locationId || {};

  return {
    orderCode: order.orderCode,
    orderStatus: order.orderStatus,
    returnStatus: order.returnStatus,
    createdAt: order.createdAt,

    customer: {
      name:
        order.shippingAddress?.receiverName ||
        order.customerId?.FullName ||
        '',
      phone: order.shippingAddress?.phone || '',
      address: [
        order.shippingAddress?.street,
        order.shippingAddress?.ward,
        order.shippingAddress?.district,
        order.shippingAddress?.city,
      ].filter(Boolean).join(', '),
    },

    shop: {
      name: shop.name || '',
      phone: shop.phone || '',
      address: shop.address || '',
    },

    items: details.map(d => ({
      id: d._id,
      name: d.variantId?.productId?.name || 'Trang phục',
      sku: d.variantId?.sku || '',
      size: d.variantId?.size || '',
      color: d.variantId?.color || '',
      quantity: d.quantity,
      image:
        d.variantId?.productId?.images?.[0] ||
        d.variantId?.productId?.image ||
        '',
    })),

    ...Object.fromEntries(
      Object.values(SALES_EVIDENCE_FIELDS).map(field => [
        field,
        signedSalesEvidence(order[field]),
      ])
    ),

    videoPermissions: await salesEvidencePermissions(
      order,
      user,
      manager,
      shipment
    ),

    shipment,
    canManage: manager,
    simulatorEnabled: salesReturnSimulatorEnabled(),
    canRequest: saleReturnable(order) && !shipment && !order.returnId,

    requestBlockedReason:
      order.orderStatus !== 'completed'
        ? 'Chỉ tạo yêu cầu trả hàng sau khi khách đã nhận hàng.'
        : order.paymentStatus !== 'paid' &&
          order.returnStatus !== 'completed'
          ? 'Đơn chưa được xác nhận thanh toán đủ; cần đối soát trước khi trả và hoàn tiền.'
          : '',

    completed: order.returnStatus === 'completed',

    refundedAmount:
      order.returnStatus === 'completed' &&
        order.paymentStatus === 'refunded'
        ? order.refundedAmount
        : null,
  };
}

export async function checkSalesEvidenceAccess(user, id, kind) {
  if (!Object.hasOwn(SALES_EVIDENCE_FIELDS, kind)) {
    throw new ServiceError(400, 'Loại video không hợp lệ.');
  }

  const { order, manager } = await accessSalesReturnOrder(user, id);

  const shipment = await OrderShipment.findOne({
    orderId: id,
    orderType: 'sale',
    shipmentType: 'return',
  })
    .sort({ createdAt: -1 })
    .lean();

  const permissions = await salesEvidencePermissions(
    order,
    user,
    manager,
    shipment
  );

  if (!permissions[kind]) {
    throw new ServiceError(
      403,
      'Bạn không thể tải loại video này ở trạng thái hiện tại của đơn.'
    );
  }

  const field = SALES_EVIDENCE_FIELDS[kind];

  if (order[field]) {
    throw new ServiceError(409, 'Video đã được lưu, không ghi đè bằng chứng.');
  }

  return field;
}

export async function requestSalesReturn(user, id, reason = '') {
  if (!salesReturnSimulatorEnabled()) {
    throw new ServiceError(403, 'Luồng trả hàng mô phỏng chưa được bật.');
  }

  if (typeof reason !== 'string' || reason.length > 1000) {
    throw new ServiceError(400, 'Lý do trả hàng tối đa 1.000 ký tự.');
  }

  if (!saleReturnable(order)) {
    throw new ServiceError(409, 'Chỉ trả đơn đã giao và đã thanh toán đủ.');
  }

  const RETURN_LIMIT_DAYS = 7;
  const completedDate = new Date(order.completedAt || order.updatedAt);
  const deadline = new Date(completedDate.getTime() + (RETURN_LIMIT_DAYS * 24 * 60 * 60 * 1000));

  if (new Date() > deadline) {
    throw new ServiceError(400, `Yêu cầu bị từ chối: Đơn hàng đã quá hạn đổi/trả 7 ngày. Hạn chót của bạn là ${deadline.toLocaleDateString('vi-VN')}.`);
  }

  await accessSalesReturnOrder(user, id);

  return inTransaction(async session => {
    const { order } = await accessSalesReturnOrder(
      user,
      id,
      false,
      session
    );

    if (!saleReturnable(order)) {
      throw new ServiceError(409, 'Chỉ trả đơn đã giao và đã thanh toán đủ.');
    }

    await SalesOrder.updateOne(
      { _id: id },
      { $inc: { returnFlowVersion: 1 } },
      { session }
    );

    const existing = await OrderShipment.findOne({
      orderId: id,
      orderType: 'sale',
      shipmentType: 'return',
    }).session(session);

    if (existing && order.returnId) return existing;

    const anotherReturn = await SalesReturn.exists({
      salesOrderId: id,
      returnStatus: { $nin: ['rejected', 'cancelled'] },
    }).session(session);

    if (existing || anotherReturn) {
      throw new ServiceError(
        409,
        'Đơn đã có yêu cầu trả hàng khác; cần đối soát trước.'
      );
    }

    const details = await SalesOrderDetail.find({
      salesOrderId: id,
    }).session(session);

    if (!details.length) {
      throw new ServiceError(409, 'Đơn chưa có chi tiết sản phẩm.');
    }

    await order.populate({
      path: 'locationId',
      populate: { path: 'shopId' },
    });

    const shop = order.locationId?.shopId || order.locationId || {};
    const address = order.shippingAddress || {};

    if (
      !address.phone ||
      !address.street ||
      !shop.phone ||
      !shop.address
    ) {
      throw new ServiceError(
        422,
        'Thiếu địa chỉ hoặc số điện thoại người trả/chi nhánh.'
      );
    }

    const [receipt] = await SalesReturn.create([{
      returnCode: 'RET-SO-' + crypto.randomUUID(),
      salesOrderId: id,
      locationId: order.locationId._id,
      createdBy: user._id,
      returnReason:
        reason.trim() || 'Khách hàng yêu cầu trả toàn bộ đơn mua.',
      returnStatus: 'requested',
    }], { session });

    const [shipment] = await OrderShipment.create([{
      orderId: id,
      orderCode: order.orderCode,
      orderType: 'sale',
      shipmentType: 'return',
      isSimulated: true,
      trackingCode: 'SIM-SRET-' + crypto.randomUUID(),
      carrierName: 'Vận chuyển mô phỏng',
      shipmentStatus: 'preparing',
      codAmount: 0,
      fromLocationId: order.locationId._id,
      createdBy: user._id,

      senderInfo: {
        name: address.receiverName,
        phone: address.phone,
        address: [
          address.street,
          address.ward,
          address.district,
          address.city,
        ].filter(Boolean).join(', '),
      },

      receiverInfo: {
        name: shop.name,
        phone: shop.phone,
        address: shop.address,
      },

      statusHistory: [{
        status: 'preparing',
        description: 'Đã tạo đơn trả hàng mua, chờ lấy hàng (mô phỏng)',
      }],
    }], { session });

    await SalesOrder.updateOne(
      { _id: id },
      {
        $set: {
          returnId: receipt._id,
          returnStatus: 'requested',
        },
      },
      { session }
    );

    return shipment;
  });
}

export async function advanceSalesReturn(user, id, newStatus) {
  if (!salesReturnSimulatorEnabled()) {
    throw new ServiceError(403, 'Mô phỏng chỉ được phép trên dev.');
  }

  await accessSalesReturnOrder(user, id, true);

  return inTransaction(async session => {
    const { order } = await accessSalesReturnOrder(
      user,
      id,
      true,
      session
    );

    if (!saleReturnable(order)) {
      throw new ServiceError(
        409,
        'Đơn không còn ở trạng thái có thể trả hàng.'
      );
    }

    const shipment = await OrderShipment.findOne({
      orderId: id,
      orderType: 'sale',
      shipmentType: 'return',
      isSimulated: true,
    }).session(session);

    if (!shipment) {
      throw new ServiceError(404, 'Chưa có vận đơn trả hàng mô phỏng.');
    }

    if (shipment.shipmentStatus === newStatus) return shipment;

    const nextStatus = {
      preparing: 'shipped',
      shipped: 'delivered',
    };

    if (nextStatus[shipment.shipmentStatus] !== newStatus) {
      throw new ServiceError(409, 'Không được bỏ bước hoặc lùi trạng thái.');
    }

    const now = new Date();

    await SalesOrder.updateOne(
      { _id: id },
      {
        $inc: { returnFlowVersion: 1 },
        $set: {
          returnStatus: newStatus === 'shipped' ? 'returning' : 'received',
        },
      },
      { session }
    );

    const updated = await OrderShipment.findOneAndUpdate(
      {
        _id: shipment._id,
        shipmentStatus: shipment.shipmentStatus,
      },
      {
        $set: {
          shipmentStatus: newStatus,
          [newStatus === 'shipped' ? 'shippedAt' : 'deliveredAt']: now,
        },
        $push: {
          statusHistory: {
            status: newStatus,
            timestamp: now,
            description: newStatus === 'shipped'
              ? 'Đã lấy hàng từ khách, đang chuyển về shop (mô phỏng)'
              : 'Đã giao hàng về shop, chờ nghiệm thu (mô phỏng)',
          },
        },
      },
      { new: true, runValidators: true, session }
    );

    if (!updated) {
      throw new ServiceError(409, 'Vận đơn vừa thay đổi; vui lòng tải lại.');
    }

    return updated;
  });
}
export async function validateSalesRefundPayment(order, wallet, session) {
  const amount = order.totalAmount;

  if (
    !order.customerId ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    order.paymentStatus !== 'paid' ||
    (
      order.paidAmount != null &&
      order.paidAmount !== 0 &&
      order.paidAmount !== amount
    )
  ) {
    throw new ServiceError(
      409,
      'Số tiền đã thanh toán không khớp đơn mua.'
    );
  }

  if (order.paymentMethod === 'wallet') {
    const query = order.paymentRefId
      ? { _id: order.paymentRefId }
      : {
        referenceType: 'SalesOrder',
        referenceId: order._id,
        transactionType: 'payment',
        status: 'success',
      };

    const tx = await WalletTransaction.findOne(query).session(session);

    if (
      !wallet ||
      !tx ||
      String(tx.userId) !== String(order.customerId) ||
      String(tx.walletId) !== String(wallet._id) ||
      tx.amount !== amount ||
      tx.referenceType !== 'SalesOrder' ||
      (tx.referenceId && String(tx.referenceId) !== String(order._id)) ||
      tx.status !== 'success' ||
      tx.direction !== 'debit' ||
      tx.transactionType !== 'payment'
    ) {
      throw new ServiceError(
        409,
        'Không đối soát được giao dịch thanh toán gốc của đơn mua.'
      );
    }
  } else if (order.paymentMethod !== 'cod') {
    throw new ServiceError(
      409,
      'Phương thức thanh toán cần được đối soát trước khi hoàn.'
    );
  }

  const previousRefund = await WalletTransaction.exists({
    referenceType: 'SalesOrder',
    referenceId: order._id,
    transactionType: 'refund',
    status: 'success',
  }).session(session);

  if (previousRefund) {
    throw new ServiceError(
      409,
      'Đơn đã có giao dịch hoàn tiền; cần đối soát trước.'
    );
  }

  return amount;
}

export async function restoreSalesReturnStock(
  order,
  details,
  receiptId,
  user,
  session
) {
  const lines = aggregateLines(details);

  if (
    !lines.length ||
    details.some(d => !Number.isSafeInteger(d.quantity) || d.quantity <= 0)
  ) {
    throw new ServiceError(409, 'Chi tiết sản phẩm trả không hợp lệ.');
  }

  const reservations = await InventoryReservation.find({
    orderId: order._id,
    orderType: 'sale',
  }).session(session);

  const movements = await StockMovement.find({
    referenceType: 'sales_order',
    referenceId: order._id,
    movementType: 'sale',
  }).session(session);

  const expected = new Map(
    lines.map(line => [String(line.variantId), line.quantity])
  );

  const matches = records => {
    const actual = new Map(
      aggregateLines(records).map(line => [
        String(line.variantId),
        line.quantity,
      ])
    );

    return (
      actual.size === expected.size &&
      [...expected].every(([id, quantity]) => actual.get(id) === quantity)
    );
  };

  // Mô phỏng chưa xuất kho: chỉ giải phóng phần giữ chỗ của chính đơn này.
  if (!movements.length) {
    if (
      !salesReturnSimulatorEnabled() ||
      reservations.some(r => r.status !== 'active') ||
      reservations.some(
        r => String(r.locationId) !== String(order.locationId)
      ) ||
      (reservations.length && !matches(reservations))
    ) {
      throw new ServiceError(
        409,
        'Giữ chỗ tồn kho không khớp; cần đối soát trước khi hoàn tiền.'
      );
    }

    const held = await closeReservations(
      { orderId: order._id, orderType: 'sale' },
      'released',
      session
    );

    await releaseReserved({
      locationId: order.locationId,
      reservedByVariant: held,
    }, session);

    return;
  }

  if (
    reservations.some(r => r.status === 'active') ||
    movements.some(m =>
      String(m.locationId) !== String(order.locationId) ||
      !Number.isSafeInteger(m.quantityChange) ||
      m.quantityChange >= 0
    ) ||
    !matches(movements.map(m => ({
      variantId: m.variantId,
      quantity: -m.quantityChange,
    })))
  ) {
    throw new ServiceError(
      409,
      'Xuất kho của đơn không khớp số lượng trả.'
    );
  }

  // TASK-015: mọi sản phẩm quản lý theo món — dòng sổ bán không có itemId là dữ liệu cũ, cần đối soát.
  const itemMovements = movements.filter(m => m.itemId);

  if (
    itemMovements.length !== movements.length ||
    itemMovements.some(m => m.quantityChange !== -1) ||
    new Set(itemMovements.map(m => String(m.itemId))).size !==
    itemMovements.length
  ) {
    throw new ServiceError(
      409,
      'Dữ liệu hiện vật xuất kho cần được đối soát.'
    );
  }

  if (itemMovements.length) {
    const items = await InventoryItem.find({
      _id: { $in: itemMovements.map(m => m.itemId) },
    }).session(session);

    const invalidItems = items.some(item => {
      const movement = itemMovements.find(
        m => String(m.itemId) === String(item._id)
      );

      return (
        item.status !== 'sold' ||
        String(item.variantId) !== String(movement.variantId) ||
        String(item.locationId) !== String(order.locationId)
      );
    });

    if (items.length !== itemMovements.length || invalidItems) {
      throw new ServiceError(
        409,
        'Hiện vật đã thay đổi hoặc không thuộc đơn mua này.'
      );
    }

    // TASK-016: món không còn `condition`; nhận đủ hàng nguyên vẹn → available.
    await moveItems(items, {
      status: 'available',
      locationId: order.locationId,
      storageId: null,
    }, session);
  }

  await StockMovement.insertMany(
    movements.map(m => ({
      variantId: m.variantId,
      itemId: m.itemId || null,
      locationId: order.locationId,
      storageId: null,
      movementType: 'sales_return',
      quantityChange: -m.quantityChange,
      referenceType: 'sales_return',
      referenceId: receiptId,
      createdBy: user._id,
    })),
    { session }
  );
}

export async function completeSalesReturn(user, id) {
  if (!salesReturnSimulatorEnabled()) {
    throw new ServiceError(403, 'Luồng trả hàng mô phỏng chưa được bật.');
  }

  await accessSalesReturnOrder(user, id, true);

  return inTransaction(async session => {
    const { order } = await accessSalesReturnOrder(
      user,
      id,
      true,
      session
    );

    const businessKey = 'sales-return:' + id;

    // Bấm lại không hoàn thêm tiền.
    if (order.returnStatus === 'completed') {
      const tx = await WalletTransaction.findOne({
        businessKey,
        status: 'success',
      }).session(session);

      if (
        order.paymentStatus !== 'refunded' ||
        !tx ||
        tx.amount !== order.refundedAmount ||
        String(tx.userId) !== String(order.customerId)
      ) {
        throw new ServiceError(
          409,
          'Kết quả hoàn tiền cần được đối soát.'
        );
      }

      return {
        refundedAmount: tx.amount,
        alreadyCompleted: true,
      };
    }

    if (
      !saleReturnable(order) ||
      order.returnStatus !== 'received' ||
      !order.returnId
    ) {
      throw new ServiceError(409, 'Đơn chưa sẵn sàng nghiệm thu trả hàng.');
    }

    if (!order.returnReceivedVideo) {
      throw new ServiceError(
        422,
        'Shop phải tải video nhận hàng trả trước khi hoàn tiền.'
      );
    }

    const shipment = await OrderShipment.findOne({
      orderId: id,
      orderType: 'sale',
      shipmentType: 'return',
      isSimulated: true,
      shipmentStatus: 'delivered',
    }).session(session);

    if (!shipment) {
      throw new ServiceError(409, 'Hàng chưa được giao về shop.');
    }

    let wallet = await Wallet.findOne({
      userId: order.customerId,
    })
      .select('+balanceEncrypted +lockedBalanceEncrypted')
      .session(session);

    const amount = await validateSalesRefundPayment(order, wallet, session);

    const claimed = await SalesOrder.updateOne(
      {
        _id: id,
        orderStatus: 'completed',
        paymentStatus: 'paid',
        returnStatus: 'received',
      },
      {
        $set: {
          returnStatus: 'completed',
          paymentStatus: 'refunded',
          refundedAmount: amount,
          returnCompletedAt: new Date(),
        },
        $inc: { returnFlowVersion: 1 },
      },
      { session }
    );

    if (claimed.matchedCount !== 1) {
      throw new ServiceError(
        409,
        'Đơn vừa được quyết toán; vui lòng tải lại.'
      );
    }

    const receipt = await SalesReturn.findOneAndUpdate(
      {
        _id: order.returnId,
        salesOrderId: id,
        returnStatus: 'requested',
      },
      {
        $set: {
          returnStatus: 'completed',
          approvedBy: user._id,
          approvedAt: new Date(),
          refundAmount: amount,
        },
      },
      { new: true, runValidators: true, session }
    );

    if (!receipt) {
      throw new ServiceError(409, 'Phiếu trả hàng đã thay đổi.');
    }

    const details = await SalesOrderDetail.find({
      salesOrderId: id,
    }).session(session);

    await restoreSalesReturnStock(
      order,
      details,
      receipt._id,
      user,
      session
    );

    // TASK-016: dòng trả ghi món theo `itemIds` của dòng đơn, kết quả kiểm "Đạt" (shop xác nhận nguyên vẹn).
    await SalesReturnDetail.insertMany(
      details.map(d => ({
        salesReturnId: receipt._id,
        salesOrderDetailId: d._id,
        quantityReturned: d.quantity,
        itemIds: d.itemIds || [],
        inspectionResults: (d.itemIds || []).map(itemId => ({ itemId, result: 'ok' })),
        unitRefundAmount: d.lineTotal / d.quantity,
        note: 'Shop xác nhận nhận đủ hàng nguyên vẹn.',
      })),
      { session }
    );

    // Khách thanh toán COD có thể chưa mở ví.
    if (!wallet) {
      const walletId = new mongoose.Types.ObjectId();

      [wallet] = await Wallet.create([{
        _id: walletId,
        userId: order.customerId,
        balanceEncrypted: encryptValue(0, walletId + ':balance'),
        lockedBalanceEncrypted: encryptValue(0, walletId + ':locked'),
      }], { session });
    }

    const [tx] = await WalletTransaction.create([{
      walletId: wallet._id,
      userId: order.customerId,
      businessKey,
      code: generateWalletTxCode('REF-SO'),
      transactionType: 'refund',
      direction: 'credit',
      amount,
      status: 'success',
      referenceType: 'SalesOrder',
      referenceId: order._id,
      completedAt: new Date(),
    }], { session });

    await changeFunds(
      wallet,
      tx,
      amount,
      0,
      'sales_return_refund',
      session
    );

    await tx.save({ session });

    return {
      refundedAmount: amount,
      alreadyCompleted: false,
    };
  });
}

export async function recordSalesDelivery(shipment, actionTime) {
  if (
    shipment.orderType !== 'sale' ||
    shipment.shipmentType !== 'outbound'
  ) {
    return;
  }

  const order = await SalesOrder.findById(shipment.orderId);

  if (
    !order ||
    order.orderStatus === 'cancelled' ||
    order.returnStatus === 'completed'
  ) {
    return;
  }

  const updates = {
    orderStatus: 'completed',
    completedAt: order.completedAt || actionTime,
  };

  const cod = Number(shipment.codAmount);

  if (
    order.paymentMethod === 'cod' &&
    ['unpaid', 'partial'].includes(order.paymentStatus) &&
    Number.isSafeInteger(cod) &&
    cod > 0 &&
    (order.paidAmount || 0) + cod === order.totalAmount
  ) {
    updates.paymentStatus = 'paid';
    updates.paidAmount = order.totalAmount;
  }

  await SalesOrder.updateOne(
    {
      _id: order._id,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      returnStatus: { $ne: 'completed' },
    },
    { $set: updates }
  );
}