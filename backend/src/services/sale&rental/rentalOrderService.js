import { resolveProductPricing, isActiveProduct, isActiveVariant } from '../masterdata/productPricing.js';
import { refreshOutOfStockStatus } from '../warehouse/productStockStatusService.js';
/**
 * Rental Order Core Service
 * Layered Monolith Service handling Rental Lifecycle
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-001
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-002
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-003
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-004
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-005
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-006
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-007
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-008
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-018
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-019
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-020
 */

import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { RentalOrderDetail } from '../../models/sale&rental/RentalOrderDetail.js';
import { RentalOrderItem } from '../../models/sale&rental/RentalOrderItem.js';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { ProductVariant } from '../../models/masterdata/ProductVariant.js';
import { Product } from '../../models/masterdata/Product.js';
import { InventoryReservation } from '../../models/warehouse/inventory/InventoryReservation.js';
import { InventoryItem } from '../../models/warehouse/inventory/InventoryItem.js';
import {
  reserveStock, closeReservations, releaseReserved,
  reserveItemsForOrder, releaseItemsFromOrder, handoverItems, withStatus,
} from '../warehouse/orderStockService.js';
import { StockMovement } from '../../models/warehouse/inventory/StockMovement.js';
import { Wallet } from '../../models/finance/Wallet.js';
import { WalletTransaction } from '../../models/finance/WalletTransaction.js';
import {
  readyWallet,
  readBalances,
  changeFunds,
} from '../walletService.js';
import { checkRentalAvailability } from '../warehouse/productInventoryHelper.js';
import {
  createRentalOrderSchema,
  assignPhysicalItemsSchema,
  cancelRentalOrderSchema,
  computeCalendarRentalDays,
} from '../../validations/sale&rental/rentalOrderValidation.js';
import { enrichRentalOrdersPartialProgress, resolvePrimaryShipment } from '../order/orderMonitoringService.js';
import { createNotification, notifyRoles } from '../system/notificationService.js';
import { InventoryLocation } from '../../models/warehouse/location/InventoryLocation.js';
import { Shop } from '../../models/shop/Shop.js';
import User from '../../models/system/User.js';

/**
 * Phát thông báo bất đồng bộ khi đơn thuê mới được tạo thành công
 */
async function notifyNewRentalOrder(order, customerId) {
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
      title: 'Đặt đơn thuê thành công',
      message: `Đơn thuê #${order.orderCode} đã được khởi tạo thành công tại ${branchName}. VESTORA sẽ sớm chuẩn bị và liên hệ giao trang phục cho bạn!`,
      link: '/rental-orders',
      referenceType: 'RentalOrder',
      referenceId: order._id,
      metadata: { orderCode: order.orderCode },
    }).catch((err) => console.error('[Notification] Lỗi gửi thông báo cho khách hàng:', err.message));

    // 2. Thông báo cho Branch Manager của chi nhánh
    const branchManagerId = shop?.managerId || location?.managerId;
    if (branchManagerId) {
      createNotification({
        userId: branchManagerId,
        type: 'order_created',
        title: 'Đơn thuê mới từ khách hàng',
        message: `Khách hàng ${customerName} vừa đặt đơn thuê #${order.orderCode} tại ${branchName}. Vui lòng kiểm tra và chuẩn bị trang phục!`,
        link: '/branch/rental-orders',
        referenceType: 'RentalOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo cho Branch Manager:', err.message));
    } else {
      // Nếu chi nhánh chưa có quản lý chỉ định, phát cho tất cả tài khoản Quản lý chi nhánh
      notifyRoles(['branch_manager'], {
        type: 'order_created',
        title: 'Đơn thuê mới từ khách hàng',
        message: `Khách hàng ${customerName} vừa đặt đơn thuê #${order.orderCode} tại ${branchName}. Vui lòng kiểm tra và chuẩn bị trang phục!`,
        link: '/branch/rental-orders',
        referenceType: 'RentalOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo cho Branch Managers:', err.message));
    }

    // 3. Thông báo cho Shop Owner / Owner
    if (shop?.ownerId && String(shop.ownerId) !== String(branchManagerId)) {
      createNotification({
        userId: shop.ownerId,
        type: 'order_created',
        title: 'Đơn thuê mới tại hệ thống',
        message: `Khách hàng ${customerName} vừa đặt đơn thuê #${order.orderCode} tại ${branchName}.`,
        link: '/owner/rental-orders',
        referenceType: 'RentalOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo cho Shop Owner:', err.message));
    } else if (!shop?.ownerId) {
      notifyRoles(['shopOwner', 'owner'], {
        type: 'order_created',
        title: 'Đơn thuê mới tại hệ thống',
        message: `Khách hàng ${customerName} vừa đặt đơn thuê #${order.orderCode} tại ${branchName}.`,
        link: '/owner/rental-orders',
        referenceType: 'RentalOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo cho Shop Owner:', err.message));
    }
  } catch (err) {
    console.error('[Notification] Lỗi xử lý thông báo đơn thuê mới:', err.message);
  }
}

/**
 * Phát thông báo khi đơn thuê bị hủy
 */
async function notifyCancelledRentalOrder(order, cancelReason) {
  try {
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
    const msg = `Khách hàng ${customerName} đã hủy đơn thuê #${order.orderCode} tại ${branchName}. Lý do: ${cancelReason || 'Không có lý do'}.`;

    // 1. Khách hàng
    createNotification({
      userId: order.customerId,
      type: 'order_status',
      title: 'Hủy đơn thuê thành công',
      message: `Đơn thuê #${order.orderCode} đã được hủy thành công. Tiền hoàn đã được chuyển về ví của bạn.`,
      link: '/rental-orders',
      referenceType: 'RentalOrder',
      referenceId: order._id,
      metadata: { orderCode: order.orderCode },
    }).catch((err) => console.error('[Notification] Lỗi gửi thông báo hủy cho khách:', err.message));

    // 2. Branch Manager
    const branchManagerId = shop?.managerId || location?.managerId;
    if (branchManagerId) {
      createNotification({
        userId: branchManagerId,
        type: 'order_status',
        title: `Đơn thuê #${order.orderCode} đã bị hủy`,
        message: msg,
        link: '/branch/rental-orders',
        referenceType: 'RentalOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo hủy cho Branch Manager:', err.message));
    } else {
      notifyRoles(['branch_manager'], {
        type: 'order_status',
        title: `Đơn thuê #${order.orderCode} đã bị hủy`,
        message: msg,
        link: '/branch/rental-orders',
        referenceType: 'RentalOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo hủy cho Branch Managers:', err.message));
    }

    // 3. Shop Owner
    if (shop?.ownerId && String(shop.ownerId) !== String(branchManagerId)) {
      createNotification({
        userId: shop.ownerId,
        type: 'order_status',
        title: `Đơn thuê #${order.orderCode} đã bị hủy`,
        message: msg,
        link: '/owner/rental-orders',
        referenceType: 'RentalOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo hủy cho Shop Owner:', err.message));
    }
  } catch (err) {
    console.error('[Notification] Lỗi xử lý thông báo hủy đơn thuê:', err.message);
  }
}

/**
 * Phát thông báo khi đơn thuê được bàn giao trang phục (renting)
 */
async function notifyHandoverRentalOrder(order) {
  try {
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
    const dueDateStr = order.dueDate ? new Date(order.dueDate).toLocaleDateString('vi-VN') : '';

    // 1. Khách hàng
    createNotification({
      userId: order.customerId,
      type: 'order_status',
      title: 'Trang phục đã được bàn giao',
      message: `Đơn thuê #${order.orderCode} đã được bàn giao thành công. Vui lòng kiểm tra và hoàn trả trang phục đúng hạn trước ngày ${dueDateStr}. Chúc bạn có trải nghiệm tuyệt vời cùng VESTORA!`,
      link: '/rental-orders',
      referenceType: 'RentalOrder',
      referenceId: order._id,
      metadata: { orderCode: order.orderCode },
    }).catch((err) => console.error('[Notification] Lỗi gửi thông báo bàn giao cho khách:', err.message));

    // 2. Branch Manager
    const branchManagerId = shop?.managerId || location?.managerId;
    const mgrMsg = `Đơn thuê #${order.orderCode} của khách ${customerName} tại ${branchName} đã được bàn giao thành công (Trạng thái: Đang thuê). Hạn trả đồ: ${dueDateStr}.`;
    if (branchManagerId) {
      createNotification({
        userId: branchManagerId,
        type: 'order_status',
        title: `Đơn thuê #${order.orderCode} đã được bàn giao`,
        message: mgrMsg,
        link: '/branch/rental-orders',
        referenceType: 'RentalOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo bàn giao cho Branch Manager:', err.message));
    } else {
      notifyRoles(['branch_manager'], {
        type: 'order_status',
        title: `Đơn thuê #${order.orderCode} đã được bàn giao`,
        message: mgrMsg,
        link: '/branch/rental-orders',
        referenceType: 'RentalOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo bàn giao cho Branch Managers:', err.message));
    }

    // 3. Shop Owner
    if (shop?.ownerId && String(shop.ownerId) !== String(branchManagerId)) {
      createNotification({
        userId: shop.ownerId,
        type: 'order_status',
        title: `Đơn thuê #${order.orderCode} đã được bàn giao`,
        message: mgrMsg,
        link: '/owner/rental-orders',
        referenceType: 'RentalOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo bàn giao cho Shop Owner:', err.message));
    } else if (!shop?.ownerId) {
      notifyRoles(['shopOwner', 'owner'], {
        type: 'order_status',
        title: `Đơn thuê #${order.orderCode} đã được bàn giao`,
        message: mgrMsg,
        link: '/owner/rental-orders',
        referenceType: 'RentalOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode, locationId: order.locationId },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo bàn giao cho Shop Owner:', err.message));
    }
  } catch (err) {
    console.error('[Notification] Lỗi xử lý thông báo bàn giao:', err.message);
  }
}

/**
 * Phát thông báo khi đơn thuê được chuẩn bị & gán hiện vật trang phục
 */
async function notifyAssignedRentalOrder(order) {
  try {
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

    // Thông báo cho khách hàng
    if (order.customerId) {
      createNotification({
        userId: order.customerId,
        type: 'order_status',
        title: 'Trang phục đã sẵn sàng bàn giao',
        message: `Đơn thuê #${order.orderCode} đã được nhân viên chuẩn bị trang phục hoàn tất tại ${branchName}. Bạn có thể đến chi nhánh để nhận đồ!`,
        link: '/rental-orders',
        referenceType: 'RentalOrder',
        referenceId: order._id,
        metadata: { orderCode: order.orderCode },
      }).catch((err) => console.error('[Notification] Lỗi gửi thông báo chuẩn bị cho khách:', err.message));
    }
  } catch (err) {
    console.error('[Notification] Lỗi xử lý thông báo chuẩn bị trang phục:', err.message);
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
 * Sinh mã đơn thuê ngẫu nhiên định dạng RNT-YYYYMMDD-XXXX
 */
export const generateOrderCode = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `RNT-${dateStr}-${randomSuffix}`;
};

/**
 * Sinh mã giao dịch ví ngẫu nhiên
 */
export const generateWalletTxCode = (prefix = 'WTX') => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ts}-${rand}`;
};

/**
 * Tính toán đơn giá thuê và tiền cọc độc lập từ DB (Price Tampering Defense)
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-001
 */
export const calculateRentalPriceAndDeposit = async (items, startDate, dueDate) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ServiceError(400, 'Danh sách sản phẩm thuê không được để trống');
  }

  const start = new Date(startDate).getTime();
  const due = new Date(dueDate).getTime();
  // Cho phép same-day (dueDate === startDate) tính là 1 ngày thuê — REQ-CART-022
  if (isNaN(start) || isNaN(due) || due < start) {
    throw new ServiceError(400, 'Ngày trả đồ (dueDate) phải sau hoặc bằng ngày nhận đồ (startDate)');
  }

  // Số ngày thuê tối thiểu 1 ngày
  const rentalDays = computeCalendarRentalDays(startDate, dueDate);

  const variantIds = items.map((it) => it.variantId);
  const variants = await ProductVariant.find({ _id: { $in: variantIds } })
    .populate('productId')
    .lean();

  const variantMap = new Map();
  for (const v of variants) {
    variantMap.set(String(v._id), v);
  }

  let totalRentalFee = 0;
  let totalDeposit = 0;
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

    // Kiểm tra type mismatch: sản phẩm chỉ dành để bán không thể thuê
    // @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-020
    if (String(product.tag).toLowerCase() === 'sale') {
      throw new ServiceError(400, `Sản phẩm [${product.name || variant.sku}] chỉ dành để mua, không thể thuê`, 'ERR_ITEM_TYPE_MISMATCH');
    }

    // Đơn vị giá thuê theo ngày lấy từ variant hoặc product gốc
    const pricing = resolveProductPricing(product, variant);
    const dailyPrice = pricing.rentalPricePerDay;

    // Kiểm tra giá thuê hợp lệ
    // @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-020
    if (!Number.isFinite(dailyPrice) || dailyPrice <= 0) {
      throw new ServiceError(400, `Sản phẩm [${product.name || variant.sku}] chưa được thiết lập giá thuê hợp lệ`, 'ERR_INVALID_PRICE');
    }

    // Tiền cọc lấy từ variant hoặc product gốc
    const unitDeposit = pricing.deposit;
    if (!Number.isFinite(unitDeposit) || unitDeposit < 0) throw new ServiceError(400, 'Tiền cọc không hợp lệ', 'ERR_INVALID_PRICE');

    const qty = Math.max(1, Number(item.quantity) || 1);
    const lineRentalFee = dailyPrice * rentalDays * qty;
    const lineDeposit = unitDeposit * qty;

    totalRentalFee += lineRentalFee;
    totalDeposit += lineDeposit;

    itemsDetail.push({
      variantId: variant._id,
      sku: variant.sku,
      variantName: variant.variantName,
      quantity: qty,
      dailyPrice,
      rentalDays,
      lineRentalFee,
      unitDeposit,
      lineDeposit,
      note: item.note || '',
    });
  }

  return {
    itemsDetail,
    totalRentalFee,
    totalDeposit,
    totalPayable: totalRentalFee + totalDeposit,
    rentalDays,
  };
};

/**
 * Tạo đơn thuê và giữ chỗ kho trong MongoDB ACID Session
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-001
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-002
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-003
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-004
 */
export const createRentalOrder = async ({
  customerId,
  createdBy,
  locationId,
  startDate,
  dueDate,
  items,
  note = '',
  paymentMethod = 'wallet',
  shippingAddress = null,
  expectedTotalAmount,
  session: externalSession = null,
  deps = {},
}) => {
  const stockChecker = deps.checkRentalAvailability || checkRentalAvailability;
  const getWallet = deps.readyWallet || readyWallet;
  const getBalances = deps.readBalances || readBalances;
  const modifyFunds = deps.changeFunds || changeFunds;

  // 1. Validate payload đầu vào
  const validationResult = createRentalOrderSchema.safeParse({
    locationId: String(locationId),
    startDate: typeof startDate === 'string' ? startDate : new Date(startDate).toISOString(),
    dueDate: typeof dueDate === 'string' ? dueDate : new Date(dueDate).toISOString(),
    items: items.map((it) => ({
      variantId: String(it.variantId),
      quantity: Number(it.quantity),
      unitRentalFee: it.unitRentalFee != null ? Number(it.unitRentalFee) : undefined,
      depositPerUnit: it.depositPerUnit != null ? Number(it.depositPerUnit) : undefined,
      note: it.note,
    })),
    note,
    paymentMethod,
    shippingAddress,
  });

  if (!validationResult.success) {
    const errorMsg = validationResult.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new ServiceError(400, `Dữ liệu đơn thuê không hợp lệ: ${errorMsg}`);
  }

  // 2. Tính toán tiền thuê & tiền cọc authoritative từ DB
  const priceCalc = await calculateRentalPriceAndDeposit(items, startDate, dueDate);
  // Reject price changes between the read-only quote and order submission, before payment.
  if (expectedTotalAmount !== undefined && (!Number.isFinite(expectedTotalAmount) || expectedTotalAmount !== priceCalc.totalPayable)) {
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
      it.quantity,
      startDate,
      dueDate
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
    // TASK-010: giữ chỗ NGUYÊN TỬ trên dòng (locationId, storageId: null, variantId), không upsert.
    // Không đủ (kể cả hai request giành món cuối) → 409 ERR_OUT_OF_STOCK, transaction rollback.
    await reserveStock({ locationId, lines: itemsToCheck }, session);

    let orderStatus = 'draft';
    let paymentStatus = 'unpaid';
    let depositStatus = 'pending';
    const rentalOrderId = new mongoose.Types.ObjectId();
    let depositHoldTransactionId = null;

    // 5. Nếu thanh toán qua Ví nội bộ Vestora
    if (paymentMethod === 'wallet') {
      const wallet = await getWallet(customerId);
      const balances = getBalances(wallet);
      const requiredAmount = priceCalc.totalPayable;
      const availableBalance =
        balances.availableBalance ?? balances.available ?? 0;

      if (availableBalance < requiredAmount) {
        throw new ServiceError(
          409,
          `Số dư khả dụng trong Ví (${availableBalance.toLocaleString('vi-VN')} đ) không đủ để thanh toán tiền thuê (${priceCalc.totalRentalFee.toLocaleString('vi-VN')} đ) và cọc (${priceCalc.totalDeposit.toLocaleString('vi-VN')} đ)`,
          'ERR_INSUFFICIENT_WALLET_BALANCE'
        );
      }

      orderStatus = 'confirmed';
      paymentStatus = 'paid';
      depositStatus =
        priceCalc.totalDeposit > 0 ? 'held' : 'pending';

      // Tách giao dịch tiền thuê và tiền cọc.
      // Cả hai cùng liên kết tới đúng đơn thuê.
      const paymentEntries = [
        {
          type: 'rental_payment',
          amount: priceCalc.totalRentalFee,
          balanceDelta: -priceCalc.totalRentalFee,
          lockedDelta: 0,
          phase: 'rental_payment',
        },
        {
          type: 'rental_deposit',
          amount: priceCalc.totalDeposit,
          balanceDelta: 0,
          lockedDelta: priceCalc.totalDeposit,
          phase: 'rental_deposit_hold',
        },
      ];

      for (const entry of paymentEntries) {
        if (entry.amount <= 0) continue;

        const [tx] = await WalletTransaction.create(
          [
            {
              walletId: wallet._id,
              userId: customerId,
              code: generateWalletTxCode('RNT'),
              transactionType: entry.type,
              direction: 'debit',
              amount: entry.amount,
              status: 'success',

              referenceType: 'RentalOrder',
              referenceId: rentalOrderId,

              businessKey: `${entry.type}:${rentalOrderId}`,
              completedAt: new Date(),
            },
          ],
          { session }
        );

        // Tiền thuê: trừ số dư.
        // Tiền cọc: tăng số tiền bị khóa.
        await modifyFunds(
          wallet,
          tx,
          entry.balanceDelta,
          entry.lockedDelta,
          entry.phase,
          session
        );

        // Lưu thông tin số dư trước/sau do modifyFunds cập nhật.
        await tx.save({ session });

        if (entry.type === 'rental_deposit') {
          depositHoldTransactionId = tx._id;
        }
      }
    }

    // 6. Tạo RentalOrder
    const orderCode = generateOrderCode();

    const [order] = await RentalOrder.create(
      [
        {
          _id: rentalOrderId,
          orderCode,
          locationId,
          customerId,
          createdBy: createdBy || customerId,

          rentalStatus: orderStatus,
          paymentStatus,
          depositStatus,

          // Liên kết giao dịch giữ cọc để đối soát khi hoàn tiền.
          depositHoldTransactionId,
          paymentMethod,
          paidAmount:
            paymentMethod === 'wallet'
              ? priceCalc.totalPayable
              : 0,

          startDate: new Date(startDate),
          dueDate: new Date(dueDate),
          rentalFee: priceCalc.totalRentalFee,
          depositAmount: priceCalc.totalDeposit,
          shippingAddress,
          note,
        },
      ],
      { session }
    );

    // 7. Tạo RentalOrderDetail & InventoryReservation
    const detailDocs = [];
    const reservationDocs = [];

    for (const it of priceCalc.itemsDetail) {
      detailDocs.push({
        rentalOrderId: order._id,
        variantId: it.variantId,
        quantity: it.quantity,
        unitRentalFee: it.dailyPrice,
        lineTotal: it.lineRentalFee,
        depositPerUnit: it.unitDeposit,
        startDate: order.startDate,
        dueDate: order.dueDate,
        note: it.note,
      });

      reservationDocs.push({
        variantId: it.variantId,
        locationId: order.locationId,
        orderType: 'rental',
        orderId: order._id,
        quantity: it.quantity,
        status: 'active',
        reservedAt: new Date(),
      });
    }

    const createdDetails = await RentalOrderDetail.insertMany(detailDocs, { session });
    await InventoryReservation.insertMany(reservationDocs, { session });

    // 8. quantityReserved đã tăng ở bước giữ chỗ nguyên tử đầu transaction (reserveStock).

    if (isInternalSession) {
      await session.commitTransaction();
    }

    // Phát thông báo real-time tới Khách hàng, Quản lý chi nhánh (Branch Manager) và Chủ shop
    notifyNewRentalOrder(order, customerId);

    return {
      order,
      details: createdDetails,
      pricing: priceCalc,
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

/**
 * Gán barcode hiện vật kho vật lý cho từng chi tiết đơn thuê
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-006
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-007
 */
export const assignPhysicalItems = async ({
  rentalOrderId,
  assignments,
  operatorId,
  session: externalSession = null,
}) => {
  const validation = assignPhysicalItemsSchema.safeParse({
    rentalOrderId: String(rentalOrderId),
    assignments,
  });
  if (!validation.success) {
    const errorMsg = validation.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new ServiceError(400, `Dữ liệu gán hiện vật không hợp lệ: ${errorMsg}`);
  }

  const order = await RentalOrder.findById(rentalOrderId);
  if (!order) {
    throw new ServiceError(404, 'Không tìm thấy đơn thuê');
  }

  if (!['confirmed', 'draft'].includes(order.rentalStatus)) {
    throw new ServiceError(
      422,
      `Không thể gán hiện vật khi đơn thuê đang ở trạng thái [${order.rentalStatus}]`
    );
  }

  const session = externalSession || (await mongoose.startSession());
  const isInternal = !externalSession;
  if (isInternal) session.startTransaction();

  try {
    const assignedResults = [];

    for (const assign of assignments) {
      const detail = await RentalOrderDetail.findOne({
        _id: assign.rentalOrderDetailId,
        rentalOrderId: order._id,
      }).session(session);

      if (!detail) {
        throw new ServiceError(
          404,
          `Chi tiết đơn thuê không tồn tại: ${assign.rentalOrderDetailId}`
        );
      }

      const itemIds = assign.itemIds || [];
      if (itemIds.length !== detail.quantity) {
        throw new ServiceError(
          422,
          `Số lượng hiện vật gán (${itemIds.length}) không khớp số lượng yêu cầu (${detail.quantity})`
        );
      }

      // Xác thực từng hiện vật (đọc trong session để itemStateService ghi có điều kiện)
      const uniqueIds = [...new Set(itemIds.map(String))];
      if (uniqueIds.length !== itemIds.length) {
        throw new ServiceError(422, 'Danh sách hiện vật gán bị trùng mã');
      }
      const items = await InventoryItem.find({ _id: { $in: uniqueIds } }).session(session);
      if (items.length !== uniqueIds.length) {
        throw new ServiceError(404, 'Một hoặc nhiều hiện vật kho không tồn tại');
      }

      // Món đã gán cho CHÍNH dòng này từ lần gán trước (gán lại) thì giữ nguyên; món cũ bị bỏ khỏi danh sách thì nhả.
      const previous = await RentalOrderItem.find({ rentalOrderDetailId: detail._id, status: 'assigned' }).session(session);
      const previousIds = new Set(previous.map((row) => String(row.itemId)));
      const requestedIds = new Set(uniqueIds);

      const toReserve = [];
      for (const item of items) {
        if (String(item.variantId) !== String(detail.variantId)) {
          throw new ServiceError(
            422,
            `Hiện vật [${item.itemCode || item._id}] không thuộc đúng biến thể sản phẩm yêu cầu`
          );
        }
        if (String(item.locationId) !== String(order.locationId)) {
          throw new ServiceError(
            422,
            `Hiện vật [${item.itemCode || item._id}] không nằm tại chi nhánh của đơn thuê`
          );
        }
        const alreadyMine = previousIds.has(String(item._id)) && item.status === 'reserved';
        // TASK-010: chỉ nhận món `available` (không lấy món `reserved` đang bị phiếu kho/đơn khác giữ).
        if (!alreadyMine && item.status !== 'available') {
          throw new ServiceError(
            422,
            `Hiện vật [${item.itemCode || item._id}] không ở trạng thái sẵn sàng (hiện tại: ${item.status})`
          );
        }
        if (!alreadyMine) toReserve.push(item);
      }

      const dropped = previous.filter((row) => !requestedIds.has(String(row.itemId)));
      if (dropped.length) {
        const droppedItems = await InventoryItem.find({ _id: { $in: dropped.map((row) => row.itemId) } }).session(session);
        await releaseItemsFromOrder(droppedItems, session);
        await RentalOrderItem.deleteMany({ _id: { $in: dropped.map((row) => row._id) } }, { session });
      }

      // Khóa hiện vật: available → reserved qua itemStateService (không warehouseHold; giữ chỗ của đơn đã nằm trên balance).
      await reserveItemsForOrder(toReserve, session);
      for (const item of toReserve) {
        await RentalOrderItem.findOneAndUpdate(
          { rentalOrderDetailId: detail._id, itemId: item._id },
          {
            $set: {
              status: 'assigned',
              note: `Gán bởi thủ kho ${operatorId || ''}`,
            },
          },
          { upsert: true, session }
        );
      }

      assignedResults.push({
        detailId: detail._id,
        assignedItemIds: itemIds,
      });
    }

    if (isInternal) {
      await session.commitTransaction();
      notifyAssignedRentalOrder(order);
    }
    return { success: true, assignedResults };
  } catch (err) {
    if (isInternal) await session.abortTransaction();
    throw withStatus(err);
  } finally {
    if (isInternal) session.endSession();
  }
};

/**
 * Bàn giao trang phục cho khách hàng & chuyển trạng thái sang renting
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-008
 */
export const handoverRentalOrder = async ({
  rentalOrderId,
  operatorId,
  note = '',
  session: externalSession = null,
}) => {
  const order = await RentalOrder.findById(rentalOrderId);
  if (!order) {
    throw new ServiceError(404, 'Không tìm thấy đơn thuê');
  }

  if (order.rentalStatus !== 'confirmed') {
    throw new ServiceError(
      422,
      `Chỉ đơn thuê đã xác nhận (confirmed) mới có thể bàn giao đồ (hiện tại: ${order.rentalStatus})`
    );
  }

  const details = await RentalOrderDetail.find({ rentalOrderId: order._id });
  const detailIds = details.map((d) => d._id);

  // Kiểm tra số lượng đồ đã gán
  const assignedItems = await RentalOrderItem.find({
    rentalOrderDetailId: { $in: detailIds },
    status: 'assigned',
  });

  const totalRequired = details.reduce((sum, d) => sum + d.quantity, 0);
  if (assignedItems.length < totalRequired) {
    throw new ServiceError(
      422,
      `Chưa gán đủ hiện vật kho cho đơn thuê (${assignedItems.length}/${totalRequired}). Vui lòng quét mã gán đồ trước khi bàn giao.`
    );
  }

  const session = externalSession || (await mongoose.startSession());
  const isInternal = !externalSession;
  if (isInternal) session.startTransaction();

  try {
    const itemIds = assignedItems.map((a) => a.itemId);
    const now = new Date();

    // 1. Cập nhật RentalOrder (có điều kiện trạng thái: hai lần bàn giao đồng thời → lần sau 409)
    const claimed = await RentalOrder.updateOne(
      { _id: order._id, rentalStatus: 'confirmed' },
      { $set: { rentalStatus: 'renting', ...(note ? { note: order.note ? `${order.note}; ${note}` : note } : {}) } },
      { session }
    );
    if (claimed.matchedCount !== 1) throw new ServiceError(409, 'Đơn thuê vừa được cập nhật bởi người khác, vui lòng tải lại.');
    order.rentalStatus = 'renting';
    if (note) order.note = order.note ? `${order.note}; ${note}` : note;

    // 2. Cập nhật RentalOrderItem sang handed_over
    await RentalOrderItem.updateMany(
      { _id: { $in: assignedItems.map((a) => a._id) } },
      { $set: { status: 'handed_over', handedOverAt: now } },
      { session }
    );

    // 3. TASK-010: nhả giữ chỗ của đơn (InventoryReservation active → consumed) và lấy số đã giữ theo biến thể.
    const reservedByVariant = await closeReservations({ orderId: order._id, orderType: 'rental' }, 'consumed', session);

    // 4. Món reserved → renting qua itemStateService, GỘP với reserved −qty trong cùng bước (onHand −1, renting +1 mỗi món).
    const items = await InventoryItem.find({ _id: { $in: itemIds } }).session(session);
    if (items.length !== itemIds.length) {
      throw new ServiceError(409, 'Một hoặc nhiều hiện vật đã gán không còn tồn tại, vui lòng gán lại.');
    }
    for (const item of items) {
      if (item.status !== 'reserved' || String(item.locationId) !== String(order.locationId)) {
        throw new ServiceError(409, `Hiện vật [${item.itemCode || item._id}] không còn ở trạng thái đã gán cho đơn (hiện tại: ${item.status}).`);
      }
    }
    await handoverItems({ locationId: order.locationId, items, reservedByVariant }, session);

    // 5. Ghi StockMovement xuất kho thuê (mỗi món một dòng có itemId)
    const itemById = new Map(items.map((item) => [String(item._id), item]));
    const movementDocs = [];
    for (const a of assignedItems) {
      const item = itemById.get(String(a.itemId));
      movementDocs.push({
        variantId: item.variantId,
        itemId: item._id,
        locationId: order.locationId,
        storageId: null,
        movementType: 'rental_out',
        quantityChange: -1,
        referenceType: 'rental_order',
        referenceId: order._id,
        createdBy: operatorId || order.createdBy,
      });
    }
    if (movementDocs.length) await StockMovement.insertMany(movementDocs, { session });

    if (isInternal) await session.commitTransaction();

    // Phát thông báo bàn giao trang phục cho khách hàng
    notifyHandoverRentalOrder(order);

    // TASK-012: Bàn giao → tồn kho renting tăng → kiểm tra hết hàng tại store
    if (isInternal) {
      try {
        const orderDetails = await RentalOrderDetail.find({ rentalOrderId: order._id })
          .populate({ path: 'variantId', select: 'productId' })
          .lean();
        const productIds = [...new Set(
          orderDetails.map((d) => String(d.variantId?.productId)).filter(Boolean)
        )];
        if (productIds.length) {
          refreshOutOfStockStatus(productIds).catch((err) =>
            console.error('[TASK-012] rental handover refresh lỗi:', err.message)
          );
        }
      } catch (_) { /* non-blocking */ }
    }

    return {
      success: true,
      message: 'Bàn giao trang phục cho khách thành công',
      order,
    };
  } catch (err) {
    if (isInternal) await session.abortTransaction();
    throw withStatus(err);
  } finally {
    if (isInternal) session.endSession();
  }
};

/**
 * Hủy đơn thuê trang phục và hoàn trả tiền cọc/tiền thuê theo quy định
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-018
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-019
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-020
 */
export const cancelRentalOrder = async ({
  rentalOrderId,
  userId,
  cancelReason = '',
  session: externalSession = null,
  deps = {},
}) => {
  const getWallet = deps.readyWallet || readyWallet;
  const modifyFunds = deps.changeFunds || changeFunds;

  const validation = cancelRentalOrderSchema.safeParse({
    rentalOrderId: String(rentalOrderId),
    cancelReason,
  });
  if (!validation.success) {
    throw new ServiceError(400, 'Lý do hủy đơn không hợp lệ');
  }

  const order = await RentalOrder.findById(rentalOrderId);
  if (!order) {
    throw new ServiceError(404, 'Không tìm thấy đơn thuê');
  }

  const orderCustomerId = order.customerId?._id || order.customerId;
  if (!userId || String(orderCustomerId) !== String(userId)) {
    throw new ServiceError(403, 'Bạn không có quyền hủy đơn thuê này', 'FORBIDDEN');
  }

  if (order.rentalStatus !== 'confirmed') {
    throw new ServiceError(
      400,
      `Không thể hủy đơn thuê khi đơn đang ở trạng thái [${order.rentalStatus}]`,
      'CANNOT_CANCEL_ACTIVE_RENTAL'
    );
  }

  if (order.paymentStatus !== 'paid' || order.depositStatus !== 'held' ||
      !Number.isSafeInteger(order.rentalFee) || order.rentalFee < 0 ||
      !Number.isSafeInteger(order.depositAmount) || order.depositAmount < 0) {
    throw new ServiceError(409, 'Thông tin thanh toán đơn thuê không khớp, vui lòng liên hệ cửa hàng.', 'INVALID_RENTAL_PAYMENT_STATE');
  }

  const now = Date.now();
  const startDate = new Date(order.startDate);
  const dueDate = new Date(order.dueDate);
  const startTime = startDate.getTime();
  const hoursUntilStart = (startTime - now) / (1000 * 60 * 60);
  const rentalDays = Number.isFinite(startTime) && Number.isFinite(dueDate.getTime())
    ? computeCalendarRentalDays(startDate.toISOString(), dueDate.toISOString())
    : 0;
  if (rentalDays < 1 || dueDate < startDate) {
    throw new ServiceError(409, 'Ngày thuê của đơn không hợp lệ, vui lòng liên hệ cửa hàng.', 'INVALID_RENTAL_DATES');
  }

  // Tính toán hoàn tiền:
  // Nếu hủy >= 24h trước giờ nhận: hoàn 100% tiền thuê + cọc
  // Nếu hủy < 24h: khấu trừ 1 ngày thuê (giữ chỗ), hoàn phần còn lại
  const oneDayRentalFee = Math.round(order.rentalFee / rentalDays);

  let refundRentalFee = order.rentalFee;
  let cancellationFee = 0;

  if (hoursUntilStart < 24) {
    cancellationFee = Math.min(order.rentalFee, oneDayRentalFee);
    refundRentalFee = Math.max(0, order.rentalFee - cancellationFee);
  }
  const totalRefund = refundRentalFee + order.depositAmount;

  const session = externalSession || (await mongoose.startSession());
  const isInternal = !externalSession;
  if (isInternal) session.startTransaction();

  try {
    // 0. Chốt trạng thái có điều kiện: hủy và bàn giao đồng thời → chỉ một bên thành công.
    const claimed = await RentalOrder.updateOne(
      {
        _id: order._id,
        customerId: orderCustomerId,
        rentalStatus: 'confirmed',
        paymentStatus: 'paid',
        depositStatus: 'held',
      },
      { $set: { rentalStatus: 'cancelled' } },
      { session }
    );
    if (claimed.matchedCount !== 1) throw new ServiceError(409, 'Đơn thuê vừa được cập nhật bởi người khác, vui lòng tải lại.');

    // 1. Hoàn tiền và giải phóng tiền cọc trong Ví nếu đã thanh toán
    if (totalRefund > 0) {
      const wallet = await getWallet(order.customerId);

      const [refundTx] = await WalletTransaction.create(
        [
          {
            walletId: wallet._id,
            userId: order.customerId,
            code: generateWalletTxCode('REF-RNT'),
            transactionType: 'refund',
            direction: 'credit',
            // Gồm tiền thuê hoàn lại và tiền cọc được mở khóa vào số dư khả dụng.
            amount: totalRefund,
            currency: 'VND',
            status: 'success',
            referenceType: 'RentalOrder',
            referenceId: order._id,
            businessKey: `rental_cancellation:${order._id}`,
          },
        ],
        { session }
      );

      // balanceDelta = +refundRentalFee (hoàn tiền thuê vào balance)
      // lockedDelta = -order.depositAmount (mở khóa cọc khỏi lockedBalance)
      await modifyFunds(
        wallet,
        refundTx,
        refundRentalFee,
        -order.depositAmount,
        'rental_cancellation_refund',
        session
      );
      await refundTx.save({ session });
    }

    // 2. TASK-010: giải phóng giữ chỗ — đúng bằng số InventoryReservation đang active (→ released) của đơn.
    const reservedByVariant = await closeReservations({ orderId: order._id, orderType: 'rental' }, 'released', session);
    await releaseReserved({ locationId: order.locationId, reservedByVariant }, session);

    // 3. Giải phóng hiện vật kho đã gán: reserved → available qua itemStateService (balance không đổi).
    const details = await RentalOrderDetail.find({ rentalOrderId: order._id }).session(session);
    const assignedItems = await RentalOrderItem.find({
      rentalOrderDetailId: { $in: details.map((d) => d._id) },
    }).session(session);
    if (assignedItems.length > 0) {
      const items = await InventoryItem.find({ _id: { $in: assignedItems.map((a) => a.itemId) } }).session(session);
      await releaseItemsFromOrder(items, session);
      await RentalOrderItem.deleteMany(
        { _id: { $in: assignedItems.map((a) => a._id) } },
        { session }
      );
    }

    // 5. Cập nhật RentalOrder
    order.rentalStatus = 'cancelled';
    order.paymentStatus = totalRefund === 0 ? 'paid' : cancellationFee > 0 ? 'partially_refunded' : 'refunded';
    order.depositStatus = 'refunded';
    order.cancelReason = validation.data.cancelReason;
    order.cancelledAt = new Date();
    order.note = order.note
      ? `${order.note}; Hủy đơn: ${validation.data.cancelReason}`
      : `Hủy đơn: ${validation.data.cancelReason}`;
    await order.save({ session });

    if (isInternal) await session.commitTransaction();

    // Phát thông báo hủy đơn cho khách hàng và quản lý chi nhánh
    notifyCancelledRentalOrder(order, validation.data.cancelReason);

    return {
      success: true,
      message: 'Hủy đơn thuê thành công',
      order,
      refundSummary: {
        totalDepositRefunded: order.depositAmount,
        rentalFeeRefunded: refundRentalFee,
        cancellationFee,
        hoursUntilStart,
      },
    };
  } catch (err) {
    if (isInternal) await session.abortTransaction();
    throw withStatus(err);
  } finally {
    if (isInternal) session.endSession();
  }
};

/**
 * Lấy chi tiết đơn thuê
 */
export const getRentalOrderById = async (orderId) => {
  const order = await RentalOrder.findById(orderId)
    .populate('locationId')
    .populate('customerId', 'name email phone avatar')
    .lean();

  if (!order) {
    throw new ServiceError(404, 'Không tìm thấy đơn thuê');
  }

  const [details, shipments] = await Promise.all([
    RentalOrderDetail.find({ rentalOrderId: order._id })
      .populate({
        path: 'variantId',
        select: 'sku size color productId attributes',
        populate: {
          path: 'productId',
          select: 'name productCode images thumbnail thumbnailImage brand rentalPricePerDay depositRate',
        },
      })
      .lean(),
    OrderShipment.find({ orderId: order._id, orderType: 'rental' })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const detailIds = details.map((d) => d._id);
  const items = await RentalOrderItem.find({ rentalOrderDetailId: { $in: detailIds } })
    .populate('itemId')
    .lean();

  const itemsByDetail = new Map();
  for (const it of items) {
    const k = String(it.rentalOrderDetailId);
    if (!itemsByDetail.has(k)) itemsByDetail.set(k, []);
    itemsByDetail.get(k).push(it);
  }

  const preEnrichedDetails = details.map((d) => ({
    ...d,
    productName: d.variantId?.productId?.name || d.productName,
    assignedItems: itemsByDetail.get(String(d._id)) || [],
  }));

  const { detailsByOrderId, shipmentsByOrderId } = await enrichRentalOrdersPartialProgress(
    [order],
    preEnrichedDetails,
    shipments
  );
  const enrichedDetails = detailsByOrderId.get(String(order._id)) || preEnrichedDetails;
  const resolvedShipments = shipmentsByOrderId.get(String(order._id)) || shipments;

  return {
    ...order,
    details: enrichedDetails,
    items: enrichedDetails,
    shipments: resolvedShipments,
    shipment: resolvePrimaryShipment(resolvedShipments),
  };
};

/**
 * Danh sách đơn thuê với bộ lọc và phân trang
 */
export const listRentalOrders = async ({
  customerId,
  locationId,
  rentalStatus,
  page = 1,
  limit = 20,
}) => {
  const filter = {};
  if (customerId) filter.customerId = customerId;
  if (locationId) filter.locationId = locationId;
  if (rentalStatus) filter.rentalStatus = rentalStatus;

  const skip = (Math.max(1, page) - 1) * limit;

  const [orders, total] = await Promise.all([
    RentalOrder.find(filter)
      .populate('locationId', 'name address')
      .populate('customerId', 'name phone email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RentalOrder.countDocuments(filter),
  ]);

  const orderIds = orders.map((o) => o._id);
  const [details, shipments] = await Promise.all([
    orderIds.length
      ? RentalOrderDetail.find({ rentalOrderId: { $in: orderIds } })
        .populate({
          path: 'variantId',
          select: 'sku size color productId',
          populate: {
            path: 'productId',
            select: 'name productCode images thumbnail thumbnailImage brand',
          },
        })
        .lean()
      : [],
    orderIds.length
      ? OrderShipment.find({ orderId: { $in: orderIds }, orderType: 'rental' })
        .sort({ createdAt: -1 })
        .lean()
      : [],
  ]);

  const { detailsByOrderId: detailsByOrder, shipmentsByOrderId: shipmentsByOrder } =
    await enrichRentalOrdersPartialProgress(
      orders,
      details.map((d) => ({ ...d, productName: d.variantId?.productId?.name || d.productName })),
      shipments
    );

  const enrichedOrders = orders.map((o) => {
    const ordShipments = shipmentsByOrder.get(String(o._id)) || [];
    const ordDetails = detailsByOrder.get(String(o._id)) || [];
    return {
      ...o,
      details: ordDetails,
      items: ordDetails,
      shipments: ordShipments,
      shipment: resolvePrimaryShipment(ordShipments),
    };
  });

  return {
    orders: enrichedOrders,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
