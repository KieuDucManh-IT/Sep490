import mongoose from 'mongoose';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import * as ghnService from './ghnService.js';
import { mapGhnStatus } from './ghnStatusMapper.js';
import { resolveGpsToGhn } from './storeGpsResolver.js';
import { syncSingleShipmentFromGHN } from './shipmentSyncService.js';
import { getWebhookSecret } from './ghnConfig.js';
import {
  fail,
  formatPartyInfo,
  fetchOrderAndValidateScope,
  resolveBranchShippingInfo,
  fetchOrderItemsForGHN,
  calculateCodAmount,
  saveShipmentRecord,
} from './shipmentHelpers.js';

export { resolveBranchShippingInfo };

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

  // Ràng buộc nghiệp vụ: Đơn hàng nhận tại showroom (pickup) không thể tạo vận đơn GHN
  const isPickup = order.deliveryMethod === 'pickup' || (order.note && order.note.includes('Nhận tại Showroom'));
  if (isPickup) {
    throw fail('Đơn hàng đăng ký nhận tại showroom (pickup), không thể tạo vận đơn giao hàng qua GHN.', 400);
  }

  // Kiểm tra trạng thái đơn hợp lệ
  if (orderType === 'rental') {
    if (['renting', 'returned'].includes(order.rentalStatus)) {
      throw fail(`Không thể tạo vận đơn giao cho đơn thuê đang ở trạng thái "${order.rentalStatus}".`, 400);
    }
    if (order.rentalStatus === 'cancelled') {
      throw fail('Đơn thuê đã bị hủy theo trạng thái vận đơn GHN, không thể tạo vận đơn mới.', 400);
    }
  }
  if (orderType === 'sale') {
    if (['completed'].includes(order.orderStatus)) {
      throw fail(`Không thể tạo vận đơn giao cho đơn bán đang ở trạng thái "${order.orderStatus}".`, 400);
    }
    if (order.orderStatus === 'cancelled') {
      throw fail('Đơn bán đã bị hủy theo trạng thái vận đơn GHN, không thể tạo vận đơn mới.', 400);
    }
  }

  // Kiểm tra vận đơn GHN thật đang active (loại bỏ các mã tạm SHP-/TRK-)
  const activeShipment = await OrderShipment.findOne({
    orderType,
    orderId: order._id,
    shipmentType: 'outbound',
    shipmentStatus: { $in: ['preparing', 'shipped'] },
    trackingCode: { $exists: true, $ne: '', $not: /^(SHP|TRK)-/ },
  }).lean();

  if (activeShipment) {
    throw fail(`Đơn hàng đã có vận đơn đang xử lý (Mã vận đơn GHN: ${activeShipment.trackingCode}).`, 400);
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
  const savedShipment = await saveShipmentRecord({
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

  // Lưu ngược mã hành chính GHN vào đơn hàng để phục vụ tra cứu và retry
  const OrderModel = orderType === 'rental' ? RentalOrder : SalesOrder;
  await OrderModel.updateOne(
    { _id: order._id },
    {
      $set: {
        'shippingAddress.provinceId': Number(toProvinceId) || receiverInfo.provinceId,
        'shippingAddress.districtId': Number(resolvedDistrictId),
        'shippingAddress.wardCode': String(toWardCode || receiverInfo.wardCode),
      },
    }
  ).catch(() => {});

  return savedShipment;
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

  // Kiểm tra quyền theo chi nhánh thông qua đơn hàng
  if (shipment.orderType && shipment.orderId) {
    await fetchOrderAndValidateScope(user, shipment.orderType, shipment.orderId);
  }

  if (shipment.shipmentStatus !== 'preparing') {
    throw fail(`Không thể hủy vận đơn đang ở trạng thái "${shipment.shipmentStatus}". Chỉ có thể hủy khi đơn đang chuẩn bị lấy hàng.`, 400);
  }

  if (shipment.trackingCode) {
    try {
      await ghnService.cancelGHNOrder(shipment.trackingCode);
    } catch (ghnErr) {
      const errMsg = String(ghnErr?.message || '');
      const isNotFoundOrCancelled = errMsg.includes('không tồn tại') || errMsg.includes('tenant_order_detail') || errMsg.includes('cancel');
      if (!isNotFoundOrCancelled) {
        throw ghnErr;
      }
    }
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

  // Đồng bộ hủy vận đơn outbound sang đơn hàng của khách.
  if (shipment.shipmentType === 'outbound') {
    const cancelNote = reason ? `[Hủy vận đơn GHN: ${reason}]` : '[Hủy vận đơn GHN]';
    if (shipment.orderType === 'rental') {
      const order = await RentalOrder.findById(shipment.orderId);
      if (order && !['returned', 'renting'].includes(order.rentalStatus)) {
        order.rentalStatus = 'cancelled';
        order.note = order.note ? `${order.note} ${cancelNote}` : cancelNote;
        await order.save();
      }
    } else if (shipment.orderType === 'sale') {
      const order = await SalesOrder.findById(shipment.orderId);
      if (order && !['completed'].includes(order.orderStatus)) {
        order.orderStatus = 'cancelled';
        order.cancelledAt = new Date();
        order.note = order.note ? `${order.note} ${cancelNote}` : cancelNote;
        await order.save();
      }
    }
  }

  return shipment;
};

/**
 * 5. Lấy danh sách vận đơn theo Order ID
 */
export const getShipmentsByOrderId = async (user, orderType, orderId) => {
  await fetchOrderAndValidateScope(user, orderType, orderId);

  const shipments = await OrderShipment.find({ orderType, orderId })
    .sort({ createdAt: -1 })
    .populate({ path: 'createdBy', select: 'FullName Email' });

  // Tự động đồng bộ các đơn đang trong hành trình trực tiếp từ GHN
  const syncPromises = shipments
    .filter((s) => s.trackingCode && ['preparing', 'shipped'].includes(s.shipmentStatus))
    .map((s) => syncSingleShipmentFromGHN(s).catch(() => null));

  if (syncPromises.length > 0) {
    await Promise.all(syncPromises);
  }

  return shipments.map((s) => (s.toObject ? s.toObject() : s));
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
  } else if (shipment.orderType === 'rental') {
    if (shipment.shipmentType === 'outbound') {
      const rental = await RentalOrder.findOne({ _id: shipment.orderId });
      // Chỉ kích hoạt chu kỳ thuê một lần khi bưu tá giao thành công thực tế
      if (rental && !rental.actualDeliveryDate && rental.rentalStatus !== 'renting') {
        const durationMs = rental.dueDate && rental.startDate
          ? Math.max(86400000, new Date(rental.dueDate).getTime() - new Date(rental.startDate).getTime())
          : 3 * 86400000;
        rental.rentalStatus = 'renting';
        rental.actualDeliveryDate = actionTime;
        rental.actualPickupDate = actionTime;
        rental.startDate = actionTime;
        rental.dueDate = new Date(actionTime.getTime() + durationMs);
        await rental.save();
      }
    }
  }
};

/** Đồng bộ hủy vận đơn outbound từ GHN sang trạng thái đơn hàng. */
const updateOrderStatusOnCancelled = async (shipment, actionTime) => {
  if (shipment.shipmentType !== 'outbound') return;

  if (shipment.orderType === 'sale') {
    await SalesOrder.findOneAndUpdate(
      { _id: shipment.orderId, orderStatus: { $in: ['draft', 'confirmed', 'processing', 'shipped'] } },
      { orderStatus: 'cancelled', cancelledAt: actionTime }
    );
  } else if (shipment.orderType === 'rental') {
    await RentalOrder.findOneAndUpdate(
      { _id: shipment.orderId, rentalStatus: { $in: ['draft', 'confirmed'] } },
      { rentalStatus: 'cancelled' }
    );
  }
};

/**
 * 6. Xử lý tín hiệu Webhook từ GHN
 */
export const processGHNWebhook = async (payload = {}, secretKey = '') => {
  const expectedSecret = getWebhookSecret();
  if (expectedSecret && secretKey !== expectedSecret) {
    return {
      success: false,
      message: 'Xác thực Webhook thất bại: Secret Key không hợp lệ hoặc bị thiếu',
    };
  }

  const { order_code, status, time, reason, fee } = payload;

  if (!order_code) {
    return { success: false, message: 'Thiếu mã order_code trong payload' };
  }

  const shipment = await OrderShipment.findOne({ trackingCode: order_code });
  if (!shipment) {
    return { success: true, message: 'Không tìm thấy vận đơn, bỏ qua an toàn' };
  }

  const mapped = mapGhnStatus(status);
  const actionTime = time ? new Date(time) : new Date();

  // State Machine Rule: Không cho phép chuyển từ 'preparing' thẳng lên 'delivered'
  // mà không qua xác minh ngược trực tiếp với GHN API
  if (shipment.shipmentStatus === 'preparing' && mapped.internalStatus === 'delivered') {
    try {
      const ghnDetail = await ghnService.getGHNOrderDetail(order_code);
      if (!ghnDetail || !['delivered'].includes(ghnDetail.status)) {
        return {
          success: false,
          message: 'Từ chối cập nhật: Trạng thái trên GHN API không xác nhận đơn đã delivered',
        };
      }
    } catch {
      return {
        success: false,
        message: 'Từ chối cập nhật: Không thể xác minh trạng thái đơn với GHN API',
      };
    }
  }

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
  try {
    await shipment.save();
  } catch {
    await OrderShipment.updateOne(
      { _id: shipment._id },
      {
        $set: {
          shipmentStatus: shipment.shipmentStatus,
          shippingFee: shipment.shippingFee,
          shippedAt: shipment.shippedAt,
          deliveredAt: shipment.deliveredAt,
          lastSyncedAt: shipment.lastSyncedAt,
          statusHistory: shipment.statusHistory,
        },
      }
    );
  }

  // Kích hoạt cập nhật trạng thái đơn hàng nếu giao thành công
  if (mapped.internalStatus === 'delivered') {
    await updateOrderStatusOnDelivered(shipment, actionTime);
  } else if (mapped.internalStatus === 'cancelled') {
    await updateOrderStatusOnCancelled(shipment, actionTime);
  }

  return { success: true, message: 'Webhook đã được xử lý thành công', shipment };
};

