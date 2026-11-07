import mongoose from 'mongoose';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { RentalOrderDetail } from '../../models/sale&rental/RentalOrderDetail.js';
import { SalesOrderDetail } from '../../models/sale&rental/SalesOrderDetail.js';
import { resolveLocationScope } from '../order/orderMonitoringService.js';
import * as ghnService from './ghnService.js';
import { mapGhnStatus } from './ghnStatusMapper.js';
import { resolveGpsToGhn } from './storeGpsResolver.js';

// ============================================================================
// 1. CÁC HÀM TIỆN ÍCH & TRỢ GIÚP NỘI BỘ (INTERNAL HELPERS)
// ============================================================================

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

/**
 * Chuẩn hóa đối tượng người gửi / người nhận (Chỉ còn cấp Tỉnh và cấp Xã/Phường)
 */
const formatPartyInfo = ({ name, phone, address, provinceId, wardCode, latitude, longitude }) => ({
  name: name || '',
  phone: phone || '',
  address: address || '',
  latitude: latitude ? Number(latitude) : null,
  longitude: longitude ? Number(longitude) : null,
  provinceId: provinceId ? Number(provinceId) : undefined,
  wardCode: wardCode ? String(wardCode) : undefined,
});

/**
 * Lấy đơn hàng và kiểm tra quyền quản lý theo chi nhánh
 */
const fetchOrderAndValidateScope = async (user, orderType, orderId) => {
  if (!mongoose.isValidObjectId(orderId)) {
    throw fail('Mã đơn hàng không hợp lệ.', 400);
  }

  const isRental = orderType === 'rental';
  const Model = isRental ? RentalOrder : SalesOrder;

  const order = await Model.findById(orderId)
    .populate({
      path: 'customerId',
      select: 'FullName Email AvatarUrl Information',
    })
    .populate({
      path: 'locationId',
      select: 'name code address type shopId phone provinceId districtId wardCode ghnShopId',
      populate: {
        path: 'shopId',
        select: 'name code address phone managerId isHQ provinceId districtId wardCode ghnShopId city ward latitude longitude',
      },
    })
    .lean();

  if (!order) {
    throw fail(`Không tìm thấy ${isRental ? 'đơn thuê' : 'đơn bán'} yêu cầu.`, 404);
  }

  // Kiểm tra quyền theo chi nhánh
  const scope = await resolveLocationScope(user);
  const shopManagerId = order.locationId?.shopId?.managerId;
  const isManagerOfThisShop = shopManagerId && String(shopManagerId) === String(user._id);

  if (!isManagerOfThisShop && scope.locationFilter) {
    const locId = String(order.locationId?._id || order.locationId || '');
    const allowed = Array.isArray(scope.locationFilter.$in)
      ? scope.locationFilter.$in.some((id) => String(id) === locId)
      : String(scope.locationFilter) === locId;

    if (!allowed) {
      throw fail('Bạn không có quyền thao tác vận đơn của chi nhánh khác.', 403);
    }
  }

  return order;
};

/**
 * Xác định thông tin Cửa hàng gửi/nhận hàng và tọa độ GHN
 */
export const resolveBranchShippingInfo = async (order) => {
  const loc = order?.locationId || {};
  const shop = loc.shopId || {};

  const name = shop.name || loc.name || 'Cửa hàng Vestora';
  const phone = shop.phone || loc.phone || '0848026847';
  const address = shop.address || loc.address || 'Cửa hàng Vestora';
  const latitude = shop.latitude ?? loc.latitude ?? null;
  const longitude = shop.longitude ?? loc.longitude ?? null;

  let provinceId = shop.provinceId || loc.provinceId;
  let districtId = shop.districtId || loc.districtId;
  let wardCode = shop.wardCode || loc.wardCode;
  const ghnShopId = shop.ghnShopId || loc.ghnShopId || null;

  // Nếu chi nhánh chưa có ID địa giới GHN, tự động suy luận từ GPS/Địa chỉ
  if (!districtId || !wardCode) {
    const resolvedGhn = await resolveGpsToGhn(latitude, longitude, {
      city: shop.city,
      ward: shop.ward,
      address,
      provinceId,
      districtId,
      wardCode,
    });
    provinceId = resolvedGhn.provinceId;
    districtId = resolvedGhn.districtId;
    wardCode = resolvedGhn.wardCode;
  }

  return {
    name,
    phone,
    address,
    latitude: latitude ? Number(latitude) : null,
    longitude: longitude ? Number(longitude) : null,
    provinceId: Number(provinceId),
    districtId: Number(districtId),
    wardCode: String(wardCode),
    ghnShopId: ghnShopId ? Number(ghnShopId) : undefined,
  };
};

/**
 * Lấy danh sách sản phẩm của đơn hàng để đóng gói gửi GHN
 */
const fetchOrderItemsForGHN = async (orderType, orderId, totalWeight = 500) => {
  const DetailModel = orderType === 'rental' ? RentalOrderDetail : SalesOrderDetail;
  const detailKey = orderType === 'rental' ? 'rentalOrderId' : 'salesOrderId';

  const orderItems = await DetailModel.find({ [detailKey]: orderId })
    .populate({
      path: 'variantId',
      select: 'variantName sku productId',
      populate: { path: 'productId', select: 'name productCode' },
    })
    .lean();

  if (!orderItems.length) {
    return [
      {
        name: 'Trang phục thời trang cao cấp Vestora',
        sku: 'SKU-VESTORA',
        quantity: 1,
        price: 0,
      },
    ];
  }

  return orderItems.map((item) => ({
    name: item.variantId?.variantName || item.variantId?.productId?.name || 'Sản phẩm Vestora',
    sku: item.variantId?.sku || item.variantId?.productId?.productCode || 'SKU-VESTORA',
    quantity: item.quantity || 1,
    price: item.lineTotal || 0,
  }));
};

/**
 * Tính số tiền thu hộ COD của đơn hàng
 */
const calculateCodAmount = (order, orderType, customCod) => {
  if (customCod !== undefined && customCod !== null && customCod !== '') {
    return Math.max(0, Number(customCod) || 0);
  }
  if (order.paymentStatus === 'paid') return 0;

  if (orderType === 'sale') {
    return Math.max(0, (order.totalAmount || 0) - (order.paidAmount || 0));
  }
  const totalDue = (order.rentalFee || 0) + (order.depositAmount || 0);
  return Math.max(0, totalDue - (order.paidAmount || 0));
};

/**
 * Lưu bản ghi vận đơn vào MongoDB
 */
const saveShipmentRecord = async ({
  user,
  order,
  orderType,
  shipmentType,
  ghnRes,
  senderInfo,
  receiverInfo,
  codAmount = 0,
  weight = 500,
  length = 30,
  width = 20,
  height = 10,
  note = '',
  initialDescription = 'Đơn hàng đã được tạo thành công, đang chờ bàn giao cho bưu tá vận chuyển',
}) => {
  // Gộp mã đơn nội bộ ăn theo trực tiếp mã đơn GHN
  const canonicalTrackingCode = ghnRes.order_code;
  const initialHistory = [
    {
      status: 'preparing',
      ghnStatus: 'ready_to_pick',
      description: initialDescription,
      timestamp: new Date(),
    },
  ];

  // Tham chiếu chính xác đến Shop (Cửa hàng nơi shipper đến lấy hàng, bỏ tham chiếu kho)
  const fromShopId = order.locationId?.shopId?._id || order.locationId?.shopId || order.locationId;

  return await OrderShipment.create({
    trackingCode: canonicalTrackingCode,
    orderType,
    orderId: order._id,
    fromShopId,
    carrierName: 'Giao Hàng Nhanh',
    shipmentType,
    shipmentStatus: 'preparing',
    shippingFee: ghnRes.total_fee || 0,
    codAmount,
    weight: Number(weight) || 500,
    length: Number(length) || 30,
    width: Number(width) || 20,
    height: Number(height) || 10,
    expectedDeliveryTime: ghnRes.expected_delivery_time,
    senderInfo,
    receiverInfo,
    statusHistory: initialHistory,
    note,
    createdBy: user._id,
    lastSyncedAt: new Date(),
  });
};

/**
 * 1. Tính cước phí giao hàng ước tính theo vị trí Cửa hàng chi nhánh
 */
export const calculateOrderShippingFee = async (user, params = {}) => {
  const { orderType, orderId, toProvinceId, toDistrictId, toWardCode, weight, length, width, height } = params;

  let resolvedToDistrictId = toDistrictId;
  if (!resolvedToDistrictId && (toProvinceId || toWardCode)) {
    const resolved = await resolveGpsToGhn(null, null, {
      provinceId: toProvinceId,
      wardCode: toWardCode,
    });
    resolvedToDistrictId = resolved.districtId;
  }

  if (!resolvedToDistrictId) {
    throw fail('Vui lòng chọn Tỉnh/Thành và Phường/Xã giao hàng để tính cước phí.', 400);
  }

  let fromDistrictId;
  let fromWardCode;

  if (orderId && orderType) {
    const order = await fetchOrderAndValidateScope(user, orderType, orderId);
    const branchInfo = await resolveBranchShippingInfo(order);
    fromDistrictId = branchInfo.districtId;
    fromWardCode = branchInfo.wardCode;
  }

  if (!fromDistrictId) {
    throw fail('Không xác định được địa giới hành chính của chi nhánh gửi hàng.', 400);
  }

  return ghnService.calculateShippingFee({
    fromDistrictId,
    fromWardCode,
    toDistrictId: Number(resolvedToDistrictId),
    toWardCode: String(toWardCode || ''),
    weight: Number(weight) || 500,
    length: Number(length) || 30,
    width: Number(width) || 20,
    height: Number(height) || 10,
  });
};

/**
 * 2. Tạo vận đơn xuất hàng (Outbound: Cửa hàng -> Khách hàng)
 */
export const createOutboundShipment = async (user, payload = {}) => {
  const {
    orderType,
    orderId,
    toName,
    toPhone,
    toAddress,
    toProvinceId,
    toDistrictId,
    toWardCode,
    weight = 500,
    length = 30,
    width = 20,
    height = 10,
    note = 'Cho khách xem hàng không cho thử đồ',
    customCodAmount,
  } = payload;

  const order = await fetchOrderAndValidateScope(user, orderType, orderId);

  // Kiểm tra trạng thái đơn hợp lệ
  if (orderType === 'rental' && ['renting', 'returned', 'cancelled'].includes(order.rentalStatus)) {
    throw fail(`Không thể tạo vận đơn giao cho đơn thuê đang ở trạng thái "${order.rentalStatus}".`, 400);
  }
  if (orderType === 'sale' && ['completed', 'cancelled'].includes(order.orderStatus)) {
    throw fail(`Không thể tạo vận đơn giao cho đơn bán đang ở trạng thái "${order.orderStatus}".`, 400);
  }

  // Kiểm tra vận đơn đang active
  const activeShipment = await OrderShipment.findOne({
    orderType,
    orderId: order._id,
    shipmentType: 'outbound',
    shipmentStatus: { $in: ['preparing', 'shipped'] },
  }).lean();

  if (activeShipment) {
    throw fail(`Đơn hàng đã có vận đơn đang xử lý (Mã vận đơn GHN: ${activeShipment.trackingCode || 'Chờ bưu tá'}).`, 400);
  }

  // Chuẩn hóa người gửi (Cửa hàng sở hữu đơn) & người nhận (Khách hàng)
  const storeSender = await resolveBranchShippingInfo(order);
  const senderInfo = formatPartyInfo(storeSender);

  // Tự động suy luận District cho GHN API nếu hệ thống chỉ truyền cấp Tỉnh & cấp Xã
  let resolvedDistrictId = toDistrictId;
  if (!resolvedDistrictId && (toProvinceId || toWardCode)) {
    const resolved = await resolveGpsToGhn(null, null, {
      provinceId: toProvinceId,
      wardCode: toWardCode,
      address: toAddress,
    });
    resolvedDistrictId = resolved.districtId;
  }

  if (!resolvedDistrictId) throw fail('Vui lòng chọn Tỉnh/Thành người nhận.', 400);
  if (!toWardCode) throw fail('Vui lòng chọn Phường/Xã người nhận.', 400);

  const customer = order.customerId || {};
  const customerInfo = Array.isArray(customer.Information) ? customer.Information[0] : (customer.Information || {});
  const shipAddr = order.shippingAddress || {};

  const receiverInfo = formatPartyInfo({
    name: toName || shipAddr.receiverName || shipAddr.toName || customer.FullName || 'Khách Hàng',
    phone: toPhone || shipAddr.phone || shipAddr.toPhone || customerInfo?.Phone || customer.phone || '',
    address: toAddress || shipAddr.street || customerInfo?.AddressDetail || customerInfo?.Address || customer.address || '',
    provinceId: toProvinceId,
    wardCode: toWardCode,
  });

  if (!receiverInfo.phone) throw fail('Số điện thoại người nhận không được để trống.', 400);
  if (!receiverInfo.address) throw fail('Địa chỉ giao hàng không được để trống.', 400);

  const calculatedCod = calculateCodAmount(order, orderType, customCodAmount);
  const ghnItems = await fetchOrderItemsForGHN(orderType, order._id, weight);

  // Gọi GHN API tạo đơn
  const ghnRes = await ghnService.createGHNOrder({
    shopId: storeSender.ghnShopId,
    fromName: senderInfo.name,
    fromPhone: senderInfo.phone,
    fromAddress: senderInfo.address,
    fromDistrictId: storeSender.districtId,
    fromWardCode: storeSender.wardCode,
    toName: receiverInfo.name,
    toPhone: receiverInfo.phone,
    toAddress: receiverInfo.address,
    toWardCode: receiverInfo.wardCode || toWardCode,
    toDistrictId: Number(resolvedDistrictId),
    codAmount: calculatedCod,
    weight: Number(weight) || 500,
    length: Number(length) || 30,
    width: Number(width) || 20,
    height: Number(height) || 10,
    note,
    items: ghnItems,
    clientOrderCode: order.orderCode,
  });

  // Lưu vận đơn
  return await saveShipmentRecord({
    user,
    order,
    orderType,
    shipmentType: 'outbound',
    ghnRes,
    senderInfo,
    receiverInfo,
    codAmount: calculatedCod,
    weight,
    length,
    width,
    height,
    note,
    initialDescription: 'Đơn hàng đã được tạo thành công, đang chờ bàn giao cho bưu tá vận chuyển',
  });
};

/**
 * 3. Tạo vận đơn thu hồi đồ thuê (Return: Khách hàng -> Cửa hàng)
 */
export const createReturnShipment = async (user, payload = {}) => {
  const {
    orderId,
    fromAddress,
    fromPhone,
    fromName,
    fromProvinceId,
    fromDistrictId,
    fromWardCode,
    weight = 500,
    note = 'Lấy lại trang phục cho thuê hoàn trả về shop',
  } = payload;

  const order = await fetchOrderAndValidateScope(user, 'rental', orderId);

  if (!['renting', 'partially_returned', 'overdue'].includes(order.rentalStatus)) {
    throw fail(`Không thể tạo đơn thu hồi đồ cho đơn thuê ở trạng thái "${order.rentalStatus}".`, 400);
  }

  // Kiểm tra đơn thu hồi đang active
  const activeReturnShipment = await OrderShipment.findOne({
    orderType: 'rental',
    orderId: order._id,
    shipmentType: 'return',
    shipmentStatus: { $in: ['preparing', 'shipped'] },
  }).lean();

  if (activeReturnShipment) {
    throw fail(`Đơn thuê đã có yêu cầu thu hồi đang xử lý (Mã vận đơn GHN: ${activeReturnShipment.trackingCode || 'Chờ bưu tá'}).`, 400);
  }

  // Tự động suy luận District nếu chỉ có Tỉnh & Xã
  let resolvedDistrictId = fromDistrictId;
  if (!resolvedDistrictId && (fromProvinceId || fromWardCode)) {
    const resolved = await resolveGpsToGhn(null, null, {
      provinceId: fromProvinceId,
      wardCode: fromWardCode,
      address: fromAddress,
    });
    resolvedDistrictId = resolved.districtId;
  }

  if (!resolvedDistrictId) throw fail('Vui lòng chọn Tỉnh/Thành lấy hàng trả.', 400);
  if (!fromWardCode) throw fail('Phường/Xã lấy hàng trả không được để trống.', 400);

  // Đảo chiều: Người gửi là Khách, Người nhận là Cửa hàng
  const customer = order.customerId || {};
  const customerInfo = Array.isArray(customer.Information) ? customer.Information[0] : (customer.Information || {});
  const shipAddr = order.shippingAddress || {};

  const senderInfo = formatPartyInfo({
    name: fromName || shipAddr.receiverName || shipAddr.toName || customer.FullName || 'Khách Hàng',
    phone: fromPhone || shipAddr.phone || shipAddr.toPhone || customerInfo?.Phone || customer.phone || '',
    address: fromAddress || shipAddr.street || customerInfo?.AddressDetail || customerInfo?.Address || customer.address || '',
    provinceId: fromProvinceId,
    wardCode: fromWardCode,
  });

  if (!senderInfo.phone) throw fail('Số điện thoại người trả không được để trống.', 400);
  if (!senderInfo.address) throw fail('Địa chỉ lấy hàng trả không được để trống.', 400);

  const storeReceiver = await resolveBranchShippingInfo(order);
  const receiverInfo = formatPartyInfo(storeReceiver);

  const ghnRes = await ghnService.createGHNOrder({
    shopId: storeReceiver.ghnShopId,
    fromName: senderInfo.name,
    fromPhone: senderInfo.phone,
    fromAddress: senderInfo.address,
    fromDistrictId: Number(resolvedDistrictId),
    fromWardCode: senderInfo.wardCode || fromWardCode,
    toName: receiverInfo.name,
    toPhone: receiverInfo.phone,
    toAddress: receiverInfo.address,
    toWardCode: storeReceiver.wardCode,
    toDistrictId: storeReceiver.districtId,
    codAmount: 0,
    weight: Number(weight) || 500,
    note: `[ĐỒ THUÊ HOÀN TRẢ VỀ CỬA HÀNG] ${note}`,
    clientOrderCode: `RET-${order.orderCode}`,
  });

  return await saveShipmentRecord({
    user,
    order,
    orderType: 'rental',
    shipmentType: 'return',
    ghnRes,
    senderInfo,
    receiverInfo,
    codAmount: 0,
    weight,
    note,
    initialDescription: 'Đã tạo yêu cầu thu hồi trang phục, đang chờ bưu tá đến lấy đồ từ khách hàng',
  });
};

/**
 * 4. Hủy vận đơn trên GHN
 */
export const cancelShipment = async (user, shipmentId, reason = '') => {
  if (!mongoose.isValidObjectId(shipmentId)) {
    throw fail('Mã vận đơn không hợp lệ.', 400);
  }

  const shipment = await OrderShipment.findById(shipmentId);
  if (!shipment) {
    throw fail('Không tìm thấy bản ghi vận đơn.', 404);
  }

  // Kiểm tra quyền theo chi nhánh
  const scope = await resolveLocationScope(user);
  if (scope.locationFilter) {
    const locId = String(shipment.fromShopId);
    const allowed = Array.isArray(scope.locationFilter.$in)
      ? scope.locationFilter.$in.some((id) => String(id) === locId)
      : String(scope.locationFilter) === locId;
    if (!allowed) {
      throw fail('Bạn không có quyền hủy vận đơn của chi nhánh khác.', 403);
    }
  }

  if (shipment.shipmentStatus !== 'preparing') {
    throw fail(`Không thể hủy vận đơn đang ở trạng thái "${shipment.shipmentStatus}". Chỉ có thể hủy khi đơn đang chuẩn bị lấy hàng.`, 400);
  }

  if (shipment.trackingCode) {
    await ghnService.cancelGHNOrder(shipment.trackingCode);
  }

  shipment.shipmentStatus = 'cancelled';
  shipment.cancellationReason = reason || 'Quản lý chi nhánh hủy đơn';
  shipment.statusHistory.push({
    status: 'cancelled',
    ghnStatus: 'cancel',
    description: `Đã hủy vận đơn: ${reason || 'Theo yêu cầu của cửa hàng'}`,
    timestamp: new Date(),
  });

  await shipment.save();
  return shipment;
};

/**
 * 5. Lấy danh sách vận đơn theo Order ID
 */
export const getShipmentsByOrderId = async (user, orderType, orderId) => {
  await fetchOrderAndValidateScope(user, orderType, orderId);

  return await OrderShipment.find({ orderType, orderId })
    .sort({ createdAt: -1 })
    .populate({ path: 'createdBy', select: 'FullName Email' })
    .lean();
};

// ============================================================================
// 3. XỬ LÝ ĐỒNG BỘ TRẠNG THÁI & WEBHOOK (WEBHOOK & EVENT SYNCHRONIZATION)
// ============================================================================

/**
 * Tự động cập nhật trạng thái đơn thuê / đơn bán khi bưu tá giao hàng thành công
 */
const updateOrderStatusOnDelivered = async (shipment, actionTime) => {
  if (shipment.orderType === 'sale') {
    await SalesOrder.findOneAndUpdate(
      { _id: shipment.orderId, orderStatus: { $nin: ['cancelled'] } },
      { orderStatus: 'completed' }
    );
    console.log(`[GHN Sync] Đơn bán ${shipment.orderId} tự động chuyển sang COMPLETED`);
  } else if (shipment.orderType === 'rental') {
    if (shipment.shipmentType === 'outbound') {
      await RentalOrder.findOneAndUpdate(
        { _id: shipment.orderId, rentalStatus: { $in: ['confirmed', 'draft'] } },
        {
          rentalStatus: 'renting',
          startDate: actionTime,
        }
      );
      console.log(`[GHN Sync] Đơn thuê ${shipment.orderId} tự động chuyển sang RENTING`);
    } else if (shipment.shipmentType === 'return') {
      console.log(`[GHN Sync] Đơn thuê hoàn trả ${shipment.orderId} đã giao về cửa hàng`);
    }
  }
};

/**
 * 6. Xử lý tín hiệu Webhook từ GHN
 */
export const processGHNWebhook = async (payload = {}) => {
  const { order_code, status, time, reason, fee } = payload;

  if (!order_code) {
    return { success: false, message: 'Thiếu mã order_code trong payload' };
  }

  const shipment = await OrderShipment.findOne({ trackingCode: order_code });
  if (!shipment) {
    console.warn(`[GHN Webhook] Không tìm thấy OrderShipment khớp với mã: ${order_code}`);
    return { success: true, message: 'Không tìm thấy vận đơn, bỏ qua an toàn' };
  }

  const mapped = mapGhnStatus(status);
  const actionTime = time ? new Date(time) : new Date();

  // Idempotency: tránh ghi nhận trùng cùng trạng thái trong 2 phút
  const isDuplicate = shipment.statusHistory.some(
    (entry) =>
      entry.ghnStatus === status &&
      Math.abs(new Date(entry.timestamp).getTime() - actionTime.getTime()) < 120000
  );

  if (isDuplicate) {
    return { success: true, message: 'Sự kiện trùng lặp đã được ghi nhận trước đó' };
  }

  // Cập nhật bản ghi vận đơn
  shipment.shipmentStatus = mapped.internalStatus;
  if (fee && typeof fee.total === 'number') {
    shipment.shippingFee = fee.total;
  }
  if (mapped.internalStatus === 'shipped' && !shipment.shippedAt) {
    shipment.shippedAt = actionTime;
  }
  if (mapped.internalStatus === 'delivered' && !shipment.deliveredAt) {
    shipment.deliveredAt = actionTime;
  }

  shipment.statusHistory.push({
    status: mapped.internalStatus,
    ghnStatus: status,
    description: reason ? `${mapped.description} (${reason})` : mapped.description,
    timestamp: actionTime,
  });

  shipment.lastSyncedAt = new Date();
  await shipment.save();

  // Kích hoạt cập nhật trạng thái đơn hàng nếu giao thành công
  if (mapped.internalStatus === 'delivered') {
    await updateOrderStatusOnDelivered(shipment, actionTime);
  }

  return { success: true, message: 'Webhook đã được xử lý thành công', shipment };
};


