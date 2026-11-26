import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { SalesReturn } from '../../models/sale&rental/SalesReturn.js';
import { SalesReturnDetail } from '../../models/sale&rental/SalesReturnDetail.js';
import * as ghnService from './ghnService.js';
import { mapGhnStatus, assertValidSimulatedTransition } from './ghnStatusMapper.js';
import { resolveGpsToGhn } from './storeGpsResolver.js';
import { syncSingleShipmentFromGHN } from './shipmentSyncService.js';
import { getWebhookSecret } from './ghnConfig.js';
import { inTransaction } from '../walletService.js';
import { recordSalesDelivery, prepareSalesReturnRequest } from '../sale&rental/salesOrderService.js';
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
 * 1. Tính cước phí giao hàng ước tính theo vị trí Cửa hàng chi nhánh (Hỗ trợ GHN v3)
 */
export const calculateOrderShippingFee = async (user, params = {}) => {
  const {
    orderType,
    orderId,
    toProvinceId,
    toDistrictId,
    toWardCode,
    toProvinceName,
    toWardName,
    isNewToAddress,
    weight,
    length,
    width,
    height,
  } = params;

  let resolvedToDistrictId = toDistrictId;
  const isV3 = Boolean(
    isNewToAddress ||
    Number(toProvinceId) >= 1000000 ||
    (toProvinceName && (String(toProvinceName).toLowerCase().includes('hà nội') || String(toProvinceName).toLowerCase().includes('ha noi')))
  );

  // GHN v3 bãi bỏ cấp huyện (chỉ có Tỉnh -> Phường/Xã).
  // Nhưng endpoint tính cước v2 của GHN bắt buộc to_district_id.
  // Khu vực Hà Nội dùng flat-rate quận trung tâm (1488 Ba Đình), không cần quét toàn bộ huyện.
  if (isV3) {
    resolvedToDistrictId = resolvedToDistrictId || 1488;
  } else if (!resolvedToDistrictId && (toProvinceId || toWardCode || toProvinceName)) {
    const resolved = await resolveGpsToGhn(null, null, {
      provinceId: toProvinceId,
      wardCode: toWardCode,
      city: toProvinceName,
      ward: toWardName,
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
  } else {
    try {
      const branchInfo = await resolveBranchShippingInfo(null);
      fromDistrictId = branchInfo?.districtId;
      fromWardCode = branchInfo?.wardCode;
    } catch {}
  }

  // Fallback chi nhánh chính nếu chưa xác định được từ DB
  if (!fromDistrictId) {
    fromDistrictId = 1808; // Thạch Thất, Hà Nội (Kho chính / Showroom)
    fromWardCode = '1B1921';
  }

  // GHN v2 calculation endpoint không nhận mã phường v3 dạng số 6+ chữ số
  // Với tính cước nội thành theo quận của GHN, để toWardCode = '' tính ra đúng cước chuẩn
  let feeToWardCode = String(toWardCode || '');
  if (isV3 || /^\d{6,}$/.test(feeToWardCode)) {
    feeToWardCode = '';
  }

  return ghnService.calculateShippingFee({
    fromDistrictId,
    fromWardCode,
    toDistrictId: Number(resolvedToDistrictId),
    toWardCode: feeToWardCode,
    weight: Number(weight) || 500,
    length: Number(length) || 30,
    width: Number(width) || 20,
    height: Number(height) || 10,
  });
};

/**
 * 2. Tạo vận đơn xuất hàng (Outbound: Cửa hàng -> Khách hàng) (Hỗ trợ GHN v3)
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
    toProvinceName,
    toWardName,
    isNewToAddress,
    weight = 500,
    length = 30,
    width = 20,
    height = 10,
    note = 'Cho khách xem hàng không cho thử đồ',
    customCodAmount,
  } = payload;

  const order = await fetchOrderAndValidateScope(
    user,
    orderType,
    orderId
  );

  const isPickup = order.deliveryMethod === 'pickup' || (order.note && order.note.includes('Nhận tại Showroom'));
  if (isPickup) {
    throw fail('Đơn hàng đăng ký nhận tại showroom (pickup), không thể tạo vận đơn giao hàng qua GHN.', 400);
  }

  // Kiểm tra trạng thái đơn hợp lệ
  if (orderType === 'rental') {
    if (['renting', 'returned'].includes(order.rentalStatus)) {
      throw fail(`Không thể tạo vận đơn giao cho đơn thuê đang ở trạng thái "${order.rentalStatus}".`, 400);
    }
  }
  if (orderType === 'sale') {
    if (['completed'].includes(order.orderStatus)) {
      throw fail(`Không thể tạo vận đơn giao cho đơn bán đang ở trạng thái "${order.orderStatus}".`, 400);
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

  const customer = order.customerId || {};
  const customerInfo = Array.isArray(customer.Information) ? customer.Information[0] : (customer.Information || {});
  const shipAddr = order.shippingAddress || {};

  const effectiveProvinceId = toProvinceId || shipAddr.provinceId;
  const effectiveWardCode = toWardCode || shipAddr.wardCode;
  let resolvedDistrictId = toDistrictId || shipAddr.districtId;
  let effectiveProvinceName = toProvinceName || shipAddr.city || shipAddr.province || '';
  let effectiveWardName = toWardName || shipAddr.ward || shipAddr.wardName || '';
  let effectiveDistrictName = shipAddr.district || '';
  const useNewToAddress = Boolean(
    isNewToAddress ||
    shipAddr.isNewAddress ||
    Number(effectiveProvinceId) >= 1000000 ||
    (!resolvedDistrictId && effectiveProvinceName && effectiveWardName)
  );

  // Nếu là GHN v3 mà chưa có tên Tỉnh / Xã (do client chỉ gửi ID), tự động phân giải từ GHN v3 master data
  if (useNewToAddress) {
    if (!effectiveProvinceName && Number(effectiveProvinceId) >= 1000000) {
      try {
        const provs = await ghnService.getNewProvinces();
        const pObj = provs.find((p) => Number(p._id) === Number(effectiveProvinceId));
        if (pObj) effectiveProvinceName = pObj.name;
      } catch {}
    }
    if ((!effectiveWardName || effectiveWardName === effectiveWardCode) && effectiveProvinceId && effectiveWardCode) {
      try {
        const wards = await ghnService.getNewWards(effectiveProvinceId);
        const wObj = wards.find((w) => String(w._id) === String(effectiveWardCode));
        if (wObj) effectiveWardName = wObj.name;
      } catch {}
    }
  }

  // Chỉ suy luận District và DistrictName cho GHN v2 legacy (cần 3 cấp)
  if (!useNewToAddress && (!resolvedDistrictId || !effectiveDistrictName) && (effectiveProvinceId || effectiveWardCode || effectiveWardName)) {
    const resolved = await resolveGpsToGhn(null, null, {
      provinceId: effectiveProvinceId,
      wardCode: effectiveWardCode,
      ward: effectiveWardName,
      city: effectiveProvinceName,
      address: toAddress || shipAddr.street,
    });
    if (!resolvedDistrictId) resolvedDistrictId = resolved.districtId;
    if (!effectiveDistrictName && resolved.districtName) effectiveDistrictName = resolved.districtName;
  }

  if (!useNewToAddress && !resolvedDistrictId) throw fail('Vui lòng chọn Tỉnh/Thành và Quận/Huyện người nhận.', 400);
  if (useNewToAddress && !effectiveProvinceName) throw fail('Vui lòng chọn Tỉnh/Thành phố người nhận.', 400);
  if (!effectiveWardName && !effectiveWardCode) throw fail('Vui lòng chọn Phường/Xã người nhận.', 400);

  const receiverInfo = formatPartyInfo({
    name: toName || shipAddr.receiverName || shipAddr.toName || customer.FullName || 'Khách Hàng',
    phone: toPhone || shipAddr.phone || shipAddr.toPhone || customerInfo?.Phone || customer.phone || '',
    address: toAddress || shipAddr.street || customerInfo?.AddressDetail || customerInfo?.Address || customer.address || '',
    provinceId: effectiveProvinceId,
    districtId: useNewToAddress ? undefined : resolvedDistrictId,
    wardCode: effectiveWardCode,
    provinceName: effectiveProvinceName,
    districtName: useNewToAddress ? '' : (effectiveDistrictName || shipAddr.district || ''),
    wardName: effectiveWardName,
    isNewAddress: useNewToAddress,
  });

  if (!receiverInfo.phone) throw fail('Số điện thoại người nhận không được để trống.', 400);
  if (!receiverInfo.address) throw fail('Địa chỉ giao hàng không được để trống.', 400);

  const calculatedCod = calculateCodAmount(order, orderType, customCodAmount);
  const ghnItems = await fetchOrderItemsForGHN(orderType, order._id, weight);

  // Đếm số lần tạo vận đơn của đơn hàng này để sinh clientOrderCode duy nhất, tránh GHN khóa mã trùng khi retry
  const previousShipmentsCount = await OrderShipment.countDocuments({
    orderId: order._id,
    shipmentType: 'outbound',
  });
  const clientOrderCode = previousShipmentsCount > 0
    ? `${order.orderCode}-R${previousShipmentsCount}`
    : order.orderCode;

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
    toDistrictId: useNewToAddress ? undefined : (resolvedDistrictId ? Number(resolvedDistrictId) : undefined),
    toProvinceName: receiverInfo.provinceName,
    toWardName: receiverInfo.wardName || receiverInfo.wardCode,
    isNewToAddress: receiverInfo.isNewAddress,
    codAmount: calculatedCod,
    weight: Number(weight) || 500,
    length: Number(length) || 30,
    width: Number(width) || 20,
    height: Number(height) || 10,
    note,
    items: ghnItems,
    clientOrderCode,
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
    items: ghnItems,
    initialDescription: 'Đơn hàng đã được tạo thành công, đang chờ bàn giao cho bưu tá vận chuyển',
  });

  // Lưu ngược mã hành chính GHN vào đơn hàng để phục vụ tra cứu và retry
  // Đồng thời khôi phục trạng thái đơn hàng sang active nếu trước đó bị hủy do hủy vận đơn
  const OrderModel = orderType === 'rental' ? RentalOrder : SalesOrder;
  const updateFields = {
    'shippingAddress.provinceId': Number(effectiveProvinceId) || receiverInfo.provinceId,
    'shippingAddress.wardCode': String(effectiveWardCode || receiverInfo.wardCode),
    'shippingAddress.city': effectiveProvinceName || shipAddr.city || '',
    'shippingAddress.ward': effectiveWardName || shipAddr.ward || '',
    'shippingAddress.isNewAddress': useNewToAddress,
  };
  if (!useNewToAddress) {
    updateFields['shippingAddress.districtId'] = resolvedDistrictId ? Number(resolvedDistrictId) : null;
    updateFields['shippingAddress.district'] = effectiveDistrictName || shipAddr.district || '';
  }

  if (orderType === 'rental') {
    updateFields.rentalStatus = 'confirmed';
  } else if (orderType === 'sale') {
    updateFields.orderStatus = 'processing';
    updateFields.cancelledAt = null;
  }

  await OrderModel.updateOne(
    { _id: order._id },
    { $set: updateFields }
  ).catch(() => { });

  return savedShipment;
};

/**
 * 3. Tạo vận đơn thu hồi (Return: Khách hàng -> Cửa hàng) cho Đơn thuê & Đơn mua (Hỗ trợ GHN v3)
 */
export const createReturnShipment = async (user, payload = {}) => {
  const {
    orderId,
    orderType = 'rental',
    reason = '',
    items: requestedItems,
    fromAddress,
    fromPhone,
    fromName,
    fromProvinceId,
    fromDistrictId,
    fromWardCode,
    fromProvinceName,
    fromWardName,
    isNewFromAddress,
    weight,
    length,
    width,
    height,
    note,
  } = payload;

  if (!['rental', 'sale'].includes(orderType)) {
    throw fail('Loại đơn hàng thu hồi không hợp lệ (rental hoặc sale).', 400);
  }

  const isSale = orderType === 'sale';
  const effectiveNote = note || (isSale
    ? 'Thu hồi sản phẩm mua hoàn trả về shop'
    : 'Lấy lại trang phục cho thuê hoàn trả về shop');

  const order = await fetchOrderAndValidateScope(user, orderType, orderId);

  if (!isSale) {
    if (!['renting', 'partially_returned', 'overdue'].includes(order.rentalStatus)) {
      throw fail(`Không thể tạo đơn thu hồi đồ cho đơn thuê ở trạng thái "${order.rentalStatus}".`, 400);
    }
    if (order.rentalStatus === 'returned') {
      throw fail('Đơn thuê đã hoàn tất trả đồ, không thể tạo thêm yêu cầu thu hồi.', 400);
    }
  }

  // Tự động kế thừa thông số kiện hàng từ outbound shipment nếu không truyền (truyền sort qua options để tương thích mock .lean())
  const outboundShipment = await OrderShipment.findOne(
    {
      orderType,
      orderId: order._id,
      shipmentType: 'outbound',
    },
    null,
    { sort: { createdAt: -1 } }
  ).lean();

  let salePrep = null;
  if (isSale) {
    salePrep = await prepareSalesReturnRequest(order, {
      reason,
      requestedItems,
      outboundShipment,
    });
  }

  const effectiveWeight = Number(weight) || outboundShipment?.weight || 500;
  const effectiveLength = Number(length) || outboundShipment?.length || 20;
  const effectiveWidth = Number(width) || outboundShipment?.width || 20;
  const effectiveHeight = Number(height) || outboundShipment?.height || 10;

  // Kiểm tra đơn thu hồi đang active hoặc đã giao về shop
  const activeReturnShipment = await OrderShipment.findOne({
    orderType,
    orderId: order._id,
    shipmentType: 'return',
    shipmentStatus: { $in: ['preparing', 'shipped', 'delivered'] },
  }).lean();

  if (activeReturnShipment) {
    if (activeReturnShipment.shipmentStatus === 'delivered') {
      throw fail(`Hàng đã được giao về cửa hàng (Mã vận đơn GHN: ${activeReturnShipment.trackingCode || 'LY...'}), vui lòng tiến hành nghiệm thu để hoàn tất đơn.`, 400);
    }
    throw fail(`Đơn hàng đã có yêu cầu thu hồi đang xử lý (Mã vận đơn GHN: ${activeReturnShipment.trackingCode || 'Chờ bưu tá'}).`, 400);
  }

  // Tự động suy luận District nếu chỉ có Tỉnh & Xã
  let resolvedDistrictId = fromDistrictId;
  const shipAddr = order.shippingAddress || {};
  let effectiveFromProvinceName = fromProvinceName || shipAddr.city || shipAddr.province || '';
  let effectiveFromWardName = fromWardName || shipAddr.ward || shipAddr.wardName || '';
  let effectiveFromDistrictName = shipAddr.district || '';
  const effectiveFromProvinceId = fromProvinceId || shipAddr.provinceId;
  const effectiveFromWardCode = fromWardCode || shipAddr.wardCode;
  const useNewFromAddress = Boolean(
    isNewFromAddress ||
    shipAddr.isNewAddress ||
    Number(effectiveFromProvinceId) >= 1000000 ||
    (!resolvedDistrictId && effectiveFromProvinceName && effectiveFromWardName)
  );

  if (useNewFromAddress) {
    if (!effectiveFromProvinceName && Number(effectiveFromProvinceId) >= 1000000) {
      try {
        const provs = await ghnService.getNewProvinces();
        const pObj = provs.find((p) => Number(p._id) === Number(effectiveFromProvinceId));
        if (pObj) effectiveFromProvinceName = pObj.name;
      } catch {}
    }
    if ((!effectiveFromWardName || effectiveFromWardName === effectiveFromWardCode) && effectiveFromProvinceId && effectiveFromWardCode) {
      try {
        const wards = await ghnService.getNewWards(effectiveFromProvinceId);
        const wObj = wards.find((w) => String(w._id) === String(effectiveFromWardCode));
        if (wObj) effectiveFromWardName = wObj.name;
      } catch {}
    }
  }

  // Chỉ suy luận District cho GHN v2 legacy (cần 3 cấp)
  if (!useNewFromAddress && (!resolvedDistrictId || !effectiveFromDistrictName) && (effectiveFromProvinceId || effectiveFromWardCode || effectiveFromWardName)) {
    const resolved = await resolveGpsToGhn(null, null, {
      provinceId: effectiveFromProvinceId,
      wardCode: effectiveFromWardCode,
      ward: effectiveFromWardName,
      city: effectiveFromProvinceName,
      address: fromAddress,
    });
    if (!resolvedDistrictId) resolvedDistrictId = resolved.districtId;
    if (!effectiveFromDistrictName && resolved.districtName) effectiveFromDistrictName = resolved.districtName;
  }

  if (!useNewFromAddress && !resolvedDistrictId) throw fail('Vui lòng chọn Tỉnh/Thành lấy hàng trả.', 400);
  if (useNewFromAddress && !effectiveFromProvinceName) throw fail('Tỉnh/Thành phố lấy hàng trả không được để trống.', 400);
  if (!effectiveFromWardName && !effectiveFromWardCode) throw fail('Phường/Xã lấy hàng trả không được để trống.', 400);

  // Đảo chiều: Người gửi là Khách, Người nhận là Cửa hàng
  const customer = order.customerId || {};
  const customerInfo = Array.isArray(customer.Information) ? customer.Information[0] : (customer.Information || {});
  const senderInfo = formatPartyInfo({
    name: fromName || shipAddr.receiverName || shipAddr.toName || customer.FullName || 'Khách Hàng',
    phone: fromPhone || shipAddr.phone || shipAddr.toPhone || customerInfo?.Phone || customer.phone || '',
    address: fromAddress || shipAddr.street || customerInfo?.AddressDetail || customerInfo?.Address || customer.address || '',
    provinceId: effectiveFromProvinceId,
    districtId: useNewFromAddress ? undefined : resolvedDistrictId,
    wardCode: effectiveFromWardCode,
    provinceName: effectiveFromProvinceName,
    districtName: useNewFromAddress ? '' : (effectiveFromDistrictName || shipAddr.district || ''),
    wardName: effectiveFromWardName,
    isNewAddress: useNewFromAddress,
  });

  if (!senderInfo.phone) throw fail('Số điện thoại người trả không được để trống.', 400);
  if (!senderInfo.address) throw fail('Địa chỉ lấy hàng trả không được để trống.', 400);

  const storeReceiver = await resolveBranchShippingInfo(order);
  const receiverInfo = formatPartyInfo(storeReceiver);

  const previousReturnCount = await OrderShipment.countDocuments({
    orderId: order._id,
    orderType,
    shipmentType: 'return',
  });
  const clientOrderCode = previousReturnCount > 0
    ? `RET-${order.orderCode}-R${previousReturnCount}`
    : `RET-${order.orderCode}`;

  const ghnRes = await ghnService.createGHNOrder({
    shopId: storeReceiver.ghnShopId,
    paymentTypeId: 2, // Chiều thu hồi: Shop / Branch Manager (Người nhận) chịu cước và thanh toán cho shipper
    fromName: senderInfo.name,
    fromPhone: senderInfo.phone,
    fromAddress: senderInfo.address,
    fromDistrictId: useNewFromAddress ? undefined : (resolvedDistrictId ? Number(resolvedDistrictId) : undefined),
    fromWardCode: senderInfo.wardCode || effectiveFromWardCode,
    fromProvinceName: senderInfo.provinceName,
    fromWardName: senderInfo.wardName || senderInfo.wardCode,
    isNewFromAddress: senderInfo.isNewAddress,
    toName: receiverInfo.name,
    toPhone: receiverInfo.phone,
    toAddress: receiverInfo.address,
    toWardCode: storeReceiver.wardCode,
    toDistrictId: storeReceiver.districtId,
    returnPhone: storeReceiver.phone || receiverInfo.phone,
    returnAddress: storeReceiver.address || receiverInfo.address,
    returnDistrictId: storeReceiver.districtId,
    returnWardCode: storeReceiver.wardCode,
    codAmount: 0,
    weight: effectiveWeight,
    length: effectiveLength,
    width: effectiveWidth,
    height: effectiveHeight,
    items: isSale ? salePrep.ghnItems : [],
    note: isSale
      ? `[HÀNG MUA HOÀN TRẢ VỀ CỬA HÀNG] ${effectiveNote}`
      : `[ĐỒ THUÊ HOÀN TRẢ VỀ CỬA HÀNG] ${effectiveNote}`,
    clientOrderCode,
  });

  const initialDescription = isSale
    ? 'Đã tạo yêu cầu trả hàng mua qua GHN, đang chờ bưu tá đến lấy hàng'
    : 'Đã tạo yêu cầu thu hồi trang phục, đang chờ bưu tá đến lấy đồ từ khách hàng';

  if (!isSale) {
    return await saveShipmentRecord({
      user,
      order,
      orderType: 'rental',
      shipmentType: 'return',
      ghnRes,
      senderInfo,
      receiverInfo,
      codAmount: 0,
      weight: effectiveWeight,
      length: effectiveLength,
      width: effectiveWidth,
      height: effectiveHeight,
      note: effectiveNote,
      initialDescription,
    });
  }

  try {
    return await inTransaction(async (session) => {
      const locId = order.locationId?._id || order.locationId;
      const [receipt] = await SalesReturn.create([{
        returnCode: `RET-SO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        salesOrderId: order._id,
        locationId: locId,
        createdBy: user._id,
        returnReason: salePrep.reason,
        returnStatus: 'requested',
        refundAmount: salePrep.expectedRefundAmount,
      }], { session });

      await SalesReturnDetail.insertMany(
        salePrep.selectedLines.map((line) => ({
          salesReturnId: receipt._id,
          salesOrderDetailId: line.salesOrderDetailId,
          quantityReturned: line.quantityReturned,
          itemIds: line.itemIds,
          unitRefundAmount: line.unitRefundAmount,
        })),
        { session }
      );

      const claimedOrder = await SalesOrder.updateOne(
        { _id: order._id, returnStatus: 'none' },
        {
          $set: { returnId: receipt._id, returnStatus: 'requested' },
          $inc: { returnFlowVersion: 1 },
        },
        { session }
      );
      if (claimedOrder.matchedCount !== 1) {
        throw fail('Đơn mua vừa được tạo yêu cầu trả hàng trước đó, vui lòng tải lại.', 409);
      }

      return await saveShipmentRecord({
        user,
        order,
        orderType: 'sale',
        shipmentType: 'return',
        ghnRes,
        senderInfo,
        receiverInfo,
        codAmount: 0,
        weight: effectiveWeight,
        length: effectiveLength,
        width: effectiveWidth,
        height: effectiveHeight,
        note: effectiveNote,
        items: salePrep.selectedLines.map((line) => ({
          name: line.ghnItem.name,
          sku: line.ghnItem.sku,
          size: line.detail?.variantId?.size || '',
          color: line.detail?.variantId?.color || '',
          quantity: line.quantityReturned,
          price: line.unitRefundAmount,
          salesOrderDetailId: line.salesOrderDetailId,
        })),
        initialDescription,
        session,
      });
    });
  } catch (dbErr) {
    if (ghnRes?.order_code) {
      await ghnService.cancelGHNOrder(ghnRes.order_code).catch(() => {});
    }
    throw dbErr;
  }
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

  if (shipment.isSimulated) {
    throw fail('Không thể hủy vận đơn mô phỏng qua cổng GHN.', 409);
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

  // Đồng bộ hủy vận đơn outbound hoặc return sang đơn hàng của khách.
  if (shipment.shipmentType === 'return' && shipment.orderType === 'sale') {
    await syncSalesReturnShipmentStatus(shipment, 'cancelled');
  } else if (shipment.shipmentType === 'outbound') {
    const cancelNote = reason ? `[Hủy vận đơn GHN: ${reason}]` : '[Hủy vận đơn GHN]';
    if (shipment.orderType === 'rental') {
      const order = await RentalOrder.findById(shipment.orderId);
      if (order && !['returned', 'renting'].includes(order.rentalStatus)) {
        order.rentalStatus = 'cancelled';
        order.cancelReason = reason || order.cancelReason || null;
        order.cancelledAt = new Date();
        order.note = order.note ? `${order.note} ${cancelNote}` : cancelNote;
        await order.save();
      }
    } else if (shipment.orderType === 'sale') {
      const order = await SalesOrder.findById(shipment.orderId);
      if (order && !['completed'].includes(order.orderStatus)) {
        order.orderStatus = 'cancelled';
        order.cancelReason = reason || order.cancelReason || null;
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
 * Đồng bộ trạng thái vận đơn hoàn trả đơn mua sang SalesOrder & SalesReturn
 */
const syncSalesReturnShipmentStatus = async (shipment, internalStatus) => {
  if (shipment?.orderType !== 'sale' || shipment?.shipmentType !== 'return') return;

  if (internalStatus === 'shipped') {
    await SalesOrder.updateOne(
      { _id: shipment.orderId, returnStatus: { $in: ['requested', 'returning'] } },
      { $set: { returnStatus: 'returning' }, $inc: { returnFlowVersion: 1 } }
    );
  } else if (internalStatus === 'delivered') {
    await SalesOrder.updateOne(
      { _id: shipment.orderId, returnStatus: { $in: ['requested', 'returning', 'received'] } },
      { $set: { returnStatus: 'received' }, $inc: { returnFlowVersion: 1 } }
    );
  } else if (internalStatus === 'cancelled') {
    await SalesReturn.updateMany(
      { salesOrderId: shipment.orderId, returnStatus: 'requested' },
      { $set: { returnStatus: 'cancelled' } }
    );
    await SalesOrder.updateOne(
      { _id: shipment.orderId, returnStatus: { $in: ['requested', 'returning'] } },
      { $set: { returnStatus: 'none', returnId: null }, $inc: { returnFlowVersion: 1 } }
    );
  }
};

/**
 * Tự động cập nhật trạng thái đơn thuê / đơn bán khi bưu tá giao hàng thành công
 */
const updateOrderStatusOnDelivered = async (shipment, actionTime) => {
  if (shipment.orderType === 'sale') {
    if (shipment.shipmentType === 'return') {
      await syncSalesReturnShipmentStatus(shipment, 'delivered');
    } else {
      await recordSalesDelivery(shipment, actionTime);
    }
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
    } else if (shipment.shipmentType === 'return') {
      // Vận đơn thu hồi đã giao đồ về Showroom:
      // - Giữ nguyên depositStatus = 'held' (tuyệt đối KHÔNG tự ý hoàn tiền trước khi Shop KCS)
      // - Ghi nhận mốc bưu tá giao về shop để mở khóa quyền tải returnReceivedVideo
      await RentalOrder.updateOne(
        { _id: shipment.orderId },
        { $set: { lastReturnDeliveredAt: actionTime } }
      );
    }
  }
};

/** Đồng bộ hủy vận đơn outbound hoặc return từ GHN sang trạng thái đơn hàng. */
const updateOrderStatusOnCancelled = async (shipment, actionTime) => {
  if (shipment.shipmentType === 'return' && shipment.orderType === 'sale') {
    await syncSalesReturnShipmentStatus(shipment, 'cancelled');
    return;
  }
  if (shipment.shipmentType !== 'outbound') return;

  if (shipment.orderType === 'sale') {
    await SalesOrder.findOneAndUpdate(
      { _id: shipment.orderId, orderStatus: { $in: ['draft', 'confirmed', 'processing', 'shipped'] } },
      { orderStatus: 'cancelled', cancelledAt: actionTime, cancelReason: shipment.cancellationReason || null }
    );
  } else if (shipment.orderType === 'rental') {
    await RentalOrder.findOneAndUpdate(
      { _id: shipment.orderId, rentalStatus: { $in: ['draft', 'confirmed'] } },
      { rentalStatus: 'cancelled', cancelledAt: actionTime, cancelReason: shipment.cancellationReason || null }
    );
  }
};

/**
 * 6. Xử lý tín hiệu Webhook từ GHN
 */
export const processGHNWebhook = async (payload = {}, secretKey = '', options = {}) => {
  const isSimulated = Boolean(options.skipVerifyBack || payload.isSimulated);

  const expectedSecret = getWebhookSecret();
  if (!isSimulated && expectedSecret && secretKey !== expectedSecret) {
    return {
      success: false,
      message: 'Xác thực Webhook thất bại: Secret Key không hợp lệ hoặc bị thiếu',
    };
  }

  const { order_code, status, time, reason, fee, evidenceImage, failReason } = payload;

  if (!order_code) {
    return { success: false, message: 'Thiếu mã order_code trong payload' };
  }

  const shipment = await OrderShipment.findOne({ trackingCode: order_code });
  if (!shipment) {
    return { success: false, message: 'Không tìm thấy vận đơn để cập nhật' };
  }

  if (shipment.isSimulated) {
    throw fail(
      'Vận đơn mô phỏng trả hàng phải được cập nhật trong cửa sổ trả hàng.',
      409
    );
  }

  if (
    isSimulated &&
    shipment.orderType === 'sale' &&
    shipment.shipmentType === 'outbound' &&
    !await SalesOrder.exists({
      _id: shipment.orderId,
      'packingVideo.publicId': { $type: 'string' },
    })
  ) {
    throw fail(
      'Chi nhánh phải tải video đóng hàng ở mục 5 trước khi giao hàng.',
      422
    );
  }

  const mapped = mapGhnStatus(status);
  const actionTime = time ? new Date(time) : new Date();

  // 1. Rollback Guard & Terminal Guard
  const STATUS_RANK = { preparing: 1, shipped: 2, failed: 2, delivered: 3, cancelled: 3 };
  const TERMINAL_STATUSES = new Set(['delivered', 'cancelled']);

  const currentRank = STATUS_RANK[shipment.shipmentStatus] ?? 0;
  const incomingRank = STATUS_RANK[mapped.internalStatus] ?? 0;

  if (isSimulated) {
    assertValidSimulatedTransition(shipment.shipmentStatus, mapped.internalStatus);
  } else {
    if (TERMINAL_STATUSES.has(shipment.shipmentStatus)) {
      return {
        success: true,
        message: `Bỏ qua webhook: đơn đã ở trạng thái cuối [${shipment.shipmentStatus}]`,
      };
    }

    if (incomingRank < currentRank) {
      return {
        success: true,
        message: `Bỏ qua webhook: trạng thái hiện tại [${shipment.shipmentStatus}] cao hơn trạng thái mới [${mapped.internalStatus}]`,
      };
    }
  }

  // 2. State Machine Rule: Không cho phép chuyển từ 'preparing' thẳng lên 'delivered'
  // mà không qua xác minh ngược trực tiếp với GHN API (bỏ qua nếu là sự kiện mô phỏng)
  if (!isSimulated && shipment.shipmentStatus === 'preparing' && mapped.internalStatus === 'delivered') {
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

  // Idempotency: tránh ghi nhận trùng cùng trạng thái trong 2 phút (chỉ áp dụng Webhook thực tế)
  const isDuplicate =
    !isSimulated &&
    shipment.statusHistory.some(
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
  if (mapped.internalStatus === 'delivered') {
    if (!shipment.deliveredAt) shipment.deliveredAt = actionTime;
    if (evidenceImage) shipment.deliveryProofImage = evidenceImage;
  }
  if (mapped.internalStatus === 'failed') {
    if (failReason || reason) shipment.failureReason = failReason || reason;
  }

  let finalDescription = mapped.description;
  if (mapped.internalStatus === 'failed' && (failReason || reason)) {
    finalDescription = `Giao hàng thất bại: ${failReason || reason}`;
  } else if (reason) {
    finalDescription = `${mapped.description} (${reason})`;
  }

  shipment.statusHistory.push({
    status: mapped.internalStatus,
    ghnStatus: status,
    description: finalDescription,
    timestamp: actionTime,
    evidenceImage: evidenceImage || null,
    failReason: failReason || (mapped.internalStatus === 'failed' ? reason : null),
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

  // Kích hoạt cập nhật trạng thái đơn hàng theo bước vận đơn
  if (mapped.internalStatus === 'shipped') {
    await syncSalesReturnShipmentStatus(shipment, 'shipped');
  } else if (mapped.internalStatus === 'delivered') {
    await updateOrderStatusOnDelivered(shipment, actionTime);
  } else if (mapped.internalStatus === 'cancelled') {
    await updateOrderStatusOnCancelled(shipment, actionTime);
  }

  return { success: true, message: 'Webhook đã được xử lý thành công', shipment };
};

/**
 * 7. Branch Manager cập nhật trạng thái vận đơn thủ công (FSM & Enum Safe)
 */
export const updateManualShipmentStatus = async (user, shipmentId, newStatus, reason = '') => {
  const VALID_MANUAL_TRANSITIONS = {
    preparing: ['shipped', 'failed', 'cancelled'],
    shipped: ['delivered', 'failed'],
    failed: ['shipped', 'cancelled'],
    delivered: [],
    cancelled: [],
  };

  const shipment = await OrderShipment.findById(shipmentId);
  if (!shipment) {
    throw fail('Không tìm thấy thông tin vận đơn', 404);
  }

  // 1. Phân quyền chi nhánh (BOLA protection)
  await fetchOrderAndValidateScope(user, shipment.orderType, shipment.orderId);
  if (shipment.isSimulated) {
    throw fail(
      'Hãy cập nhật vận chuyển mô phỏng trong cửa sổ trả hàng.',
      409
    );
  }

  if (
    shipment.orderType === 'sale' &&
    shipment.shipmentType === 'outbound' &&
    ['shipped', 'delivered'].includes(newStatus) &&
    !await SalesOrder.exists({
      _id: shipment.orderId,
      'packingVideo.publicId': { $type: 'string' },
    })
  ) {
    throw fail(
      'Chi nhánh phải tải video đóng hàng ở mục 5 trước khi giao hàng.',
      422
    );
  }

  // 2. Kiểm tra quy tắc chuyển dịch FSM
  const allowedTransitions = VALID_MANUAL_TRANSITIONS[shipment.shipmentStatus] || [];
  if (!allowedTransitions.includes(newStatus)) {
    throw fail(`Không thể chuyển trạng thái từ [${shipment.shipmentStatus}] sang [${newStatus}]`, 400);
  }

  const actionTime = new Date();
  shipment.shipmentStatus = newStatus;
  if (newStatus === 'shipped' && !shipment.shippedAt) {
    shipment.shippedAt = actionTime;
  }
  if (newStatus === 'delivered' && !shipment.deliveredAt) {
    shipment.deliveredAt = actionTime;
  }

  const managerName = user?.FullName || user?.name || 'Quản lý chi nhánh';
  shipment.statusHistory.push({
    status: newStatus,
    ghnStatus: `MANUAL_${newStatus.toUpperCase()}`,
    description: reason ? `Cập nhật thủ công: ${reason}` : `Cập nhật thủ công bởi ${managerName}`,
    timestamp: actionTime,
  });

  shipment.lastSyncedAt = actionTime;
  await shipment.save();

  // 3. Đồng bộ trạng thái đơn hàng an toàn (Enum Safety Guard)
  if (newStatus === 'shipped') {
    if (shipment.orderType === 'sale' && shipment.shipmentType === 'return') {
      await syncSalesReturnShipmentStatus(shipment, 'shipped');
    } else if (
      shipment.orderType === 'sale' &&
      shipment.shipmentType === 'outbound'
    ) {
      await SalesOrder.findOneAndUpdate(
        { _id: shipment.orderId, orderStatus: { $nin: ['cancelled'] } },
        { orderStatus: 'shipped' }
      );
    }
    // RentalOrder giữ 'confirmed' (không có enum 'shipped')
  } else if (newStatus === 'delivered') {
    await updateOrderStatusOnDelivered(shipment, actionTime);
  } else if (newStatus === 'cancelled') {
    await updateOrderStatusOnCancelled(shipment, actionTime);
  }

  return shipment;
};
