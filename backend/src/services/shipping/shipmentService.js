import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { RentalOrderDetail } from '../../models/sale&rental/RentalOrderDetail.js';
import { RentalOrderItem } from '../../models/sale&rental/RentalOrderItem.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { SalesReturn } from '../../models/sale&rental/SalesReturn.js';
import { SalesReturnDetail } from '../../models/sale&rental/SalesReturnDetail.js';
import { RentalReturn } from '../../models/sale&rental/RentalReturn.js';
import * as ghnService from './ghnService.js';
import { mapGhnStatus, assertValidSimulatedTransition } from './ghnStatusMapper.js';
import { resolveGpsToGhn } from './storeGpsResolver.js';
import { syncSingleShipmentFromGHN } from './shipmentSyncService.js';
import { getWebhookSecret } from './ghnConfig.js';
import { inTransaction } from '../walletService.js';
import { recordSalesDelivery, prepareSalesReturnRequest } from '../sale&rental/salesOrderService.js';
import { prepareRentalReturnRequest } from '../sale&rental/rentalReturnService.js';
import {
  validateShippingInput,
  calculateFeeSchema,
  createOutboundSchema,
} from '../../validations/shipping/shipmentValidation.js';
import {
  fail,
  normalizeAndValidateVnPhone,
  formatPartyInfo,
  fetchOrderAndValidateScope,
  resolveBranchShippingInfo,
  fetchOrderItemsForGHN,
  calculateCodAmount,
  saveShipmentRecord,
} from './shipmentHelpers.js';

export { resolveBranchShippingInfo };

const inFlightOutboundLocks = new Set();

const withOutboundOrderLock = async (lockKey, fn) => {
  if (inFlightOutboundLocks.has(lockKey)) {
    throw fail('Đang xử lý tạo vận đơn GHN cho đơn hàng này, vui lòng đợi.', 409);
  }
  inFlightOutboundLocks.add(lockKey);
  try {
    return await fn();
  } finally {
    inFlightOutboundLocks.delete(lockKey);
  }
};

const rollbackGhnOrder = async (orderCode, shopId) => {
  if (!orderCode) return true;
  try {
    await ghnService.cancelGHNOrder(orderCode, shopId);
    return true;
  } catch (cancelErr) {
    const msg = String(cancelErr?.message || '').toLowerCase();
    if (msg.includes('too many') || msg.includes('processing')) {
      await new Promise((r) => setTimeout(r, 1200));
      try {
        await ghnService.cancelGHNOrder(orderCode, shopId);
        return true;
      } catch (retryErr) {
        console.error(`[CRITICAL][ORPHAN_GHN_SHIPMENT] Không thể hủy vận đơn ${orderCode}:`, retryErr?.message || retryErr);
        return false;
      }
    }
    console.error(`[CRITICAL][ORPHAN_GHN_SHIPMENT] Không thể hủy vận đơn ${orderCode}:`, cancelErr?.message || cancelErr);
    return false;
  }
};

const rollbackSavedShipmentAndGhn = async ({ savedShipmentId, orderCode, shopId, OrderModel, orderId }) => {
  const ghnCanceled = await rollbackGhnOrder(orderCode, shopId);
  if (ghnCanceled) {
    await OrderShipment.deleteOne({ _id: savedShipmentId }).catch((delErr) => {
      console.error(`[GHN Rollback Error] Không thể xóa OrderShipment ${savedShipmentId}:`, delErr?.message || delErr);
    });
  } else if (OrderModel && orderId) {
    await OrderModel.updateOne({ _id: orderId }, { $inc: { ghnCreateAttempts: 1 } }).catch(() => {});
  }
};

const assertRentalItemsAssignedIfPresent = async (orderId) => {
  const rawQuery = RentalOrderDetail.find({ rentalOrderId: orderId });
  const details = typeof rawQuery?.lean === 'function'
    ? await rawQuery.lean()
    : typeof rawQuery?.populate === 'function'
      ? await rawQuery.populate({ path: 'variantId', select: '_id' }).lean()
      : [];
  if (!Array.isArray(details) || details.length === 0) return;

  const detailIds = details.map((d) => d._id).filter(Boolean);
  const totalRequired = details.reduce((sum, d) => sum + Math.max(1, Number(d.quantity) || 1), 0);
  const assignedCount = detailIds.length
    ? await RentalOrderItem.countDocuments({ rentalOrderDetailId: { $in: detailIds }, status: 'assigned' })
    : 0;
  if (assignedCount < totalRequired) {
    throw fail(`Đơn thuê chưa gán đủ hiện vật kho (${assignedCount}/${totalRequired}) để tạo vận đơn GHN.`, 400);
  }
};

const parsePositiveMeasure = (val, defaultVal, label) => {
  const num = val === undefined || val === null || val === '' ? defaultVal : Number(val);
  if (!Number.isFinite(num) || num <= 0) {
    throw fail(`${label} phải lớn hơn 0.`, 400);
  }
  return num;
};

/** Lưu vận đơn vào DB; hoàn tác hủy đơn trên GHN nếu ghi DB thất bại để tránh đơn mồ côi. */
const saveShipmentOrRollbackGhn = async (recordParams, shopId = undefined) => {
  try {
    return await saveShipmentRecord(recordParams);
  } catch (dbErr) {
    await rollbackGhnOrder(recordParams?.ghnRes?.order_code, shopId);
    if (dbErr?.code === 11000) {
      throw fail('Đơn hàng đã có vận đơn đang xử lý hoặc trùng mã vận đơn, vui lòng tải lại.', 409);
    }
    throw dbErr;
  }
};

/**
 * 1. Tính cước phí giao hàng ước tính theo vị trí Cửa hàng chi nhánh (Hỗ trợ GHN v3)
 */
export const calculateOrderShippingFee = async (user, params = {}) => {
  const validParams = validateShippingInput(calculateFeeSchema, params);
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
  } = validParams;

  const normalizedWeight = parsePositiveMeasure(weight, 500, 'Khối lượng kiện hàng (gram)');
  const normalizedLength = parsePositiveMeasure(length, 30, 'Chiều dài kiện hàng (cm)');
  const normalizedWidth = parsePositiveMeasure(width, 20, 'Chiều rộng kiện hàng (cm)');
  const normalizedHeight = parsePositiveMeasure(height, 10, 'Chiều cao kiện hàng (cm)');

  const cleanProv = String(toProvinceName || '')
    .replace(/đ/gi, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const isHanoi =
    Number(toProvinceId) === 1000000 ||
    Number(toProvinceId) === 201 ||
    cleanProv.includes('ha noi');
  const isV3 = Boolean(isNewToAddress || Number(toProvinceId) >= 1000000);

  let resolvedToDistrictId = toDistrictId ? Number(toDistrictId) : undefined;
  // Chỉ dùng flat-rate 1488 (Ba Đình) cho địa chỉ v3 nội thành Hà Nội; các tỉnh khác giải mã sang quận v2 tương ứng.
  if (isV3 && isHanoi && !resolvedToDistrictId) {
    resolvedToDistrictId = 1488;
  } else if (!resolvedToDistrictId && (toProvinceId || toWardCode || toProvinceName || toWardName)) {
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
  let branchShopId;
  let insuranceValue = 0;

  if (orderId && orderType) {
    const order = await fetchOrderAndValidateScope(user, orderType, orderId);
    const branchInfo = await resolveBranchShippingInfo(order);
    fromDistrictId = branchInfo.districtId;
    fromWardCode = branchInfo.wardCode;
    branchShopId = branchInfo.ghnShopId;
    insuranceValue = orderType === 'sale'
      ? Number(order.totalAmount || 0)
      : Number(order.rentalFee || 0) + Number(order.depositAmount || 0);
  } else {
    try {
      const branchInfo = await resolveBranchShippingInfo(null);
      fromDistrictId = branchInfo?.districtId;
      fromWardCode = branchInfo?.wardCode;
      branchShopId = branchInfo?.ghnShopId;
    } catch {}
  }

  // Fallback chi nhánh chính nếu chưa xác định được từ DB
  if (!fromDistrictId) {
    fromDistrictId = 1808; // Thạch Thất, Hà Nội (Kho chính / Showroom)
    fromWardCode = '1B1921';
  }

  let feeToWardCode = String(toWardCode || '');
  if (isV3 || /^\d{6,}$/.test(feeToWardCode)) {
    feeToWardCode = '';
  }

  return ghnService.calculateShippingFee({
    shopId: branchShopId,
    fromDistrictId,
    fromWardCode,
    toDistrictId: Number(resolvedToDistrictId),
    toWardCode: feeToWardCode,
    weight: normalizedWeight,
    length: normalizedLength,
    width: normalizedWidth,
    height: normalizedHeight,
    insuranceValue,
  });
};

/**
 * 2. Tạo vận đơn xuất hàng (Outbound: Cửa hàng -> Khách hàng) (Hỗ trợ GHN v3)
 */
export const createOutboundShipment = async (user, payload = {}) => {
  const validPayload = validateShippingInput(createOutboundSchema, payload);
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
  } = validPayload;

  return withOutboundOrderLock(`${orderType}:${String(orderId)}`, async () => {
    const order = await fetchOrderAndValidateScope(user, orderType, orderId);

    const isPickup =
      order.deliveryMethod === 'pickup' ||
      order.shippingAddress?.deliveryMethod === 'pickup' ||
      Boolean(order.note && order.note.includes('Nhận tại Showroom'));
    if (isPickup) {
      throw fail('Đơn hàng đăng ký nhận tại showroom (pickup), không thể tạo vận đơn giao hàng qua GHN.', 400);
    }

    // Kiểm tra trạng thái đơn hợp lệ bên trong lock
    if (orderType === 'rental') {
      if (order.rentalStatus !== 'confirmed') {
        throw fail(`Không thể tạo vận đơn giao cho đơn thuê đang ở trạng thái "${order.rentalStatus}".`, 400);
      }
      await assertRentalItemsAssignedIfPresent(order._id);
    } else if (['cancelled', 'shipped', 'completed'].includes(order.orderStatus)) {
      throw fail(`Không thể tạo vận đơn giao cho đơn bán đang ở trạng thái "${order.orderStatus}".`, 400);
    }

    // Kiểm tra vận đơn GHN thật đang active (bao gồm cả delivered, loại bỏ các mã tạm SHP-/TRK-)
    const activeShipment = await OrderShipment.findOne({
      orderType,
      orderId: order._id,
      shipmentType: 'outbound',
      shipmentStatus: { $in: ['preparing', 'shipped', 'delivered'] },
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
    const provinceChanged = Boolean(
      toProvinceId && shipAddr.provinceId && Number(toProvinceId) !== Number(shipAddr.provinceId)
    );
    const wardChanged = Boolean(
      provinceChanged || (toWardCode && shipAddr.wardCode && String(toWardCode) !== String(shipAddr.wardCode))
    );
    const effectiveWardCode = toWardCode || shipAddr.wardCode;
    let resolvedDistrictId = toDistrictId || (provinceChanged ? undefined : shipAddr.districtId);
    let effectiveProvinceName = toProvinceName || (provinceChanged ? '' : (shipAddr.city || shipAddr.province || ''));
    let effectiveWardName = toWardName || (wardChanged ? '' : (shipAddr.ward || shipAddr.wardName || ''));
    let effectiveDistrictName = provinceChanged ? '' : (shipAddr.district || '');
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

    const isNumericWardPlaceholder = Boolean(
      effectiveWardName &&
      effectiveWardCode &&
      String(effectiveWardName).trim() === String(effectiveWardCode).trim() &&
      /^\d+$/.test(String(effectiveWardName).trim())
    );
    if (!useNewToAddress && !resolvedDistrictId) throw fail('Vui lòng chọn Tỉnh/Thành và Quận/Huyện người nhận.', 400);
    if (useNewToAddress && !effectiveProvinceName) throw fail('Vui lòng chọn Tỉnh/Thành phố người nhận.', 400);
    if (useNewToAddress && (!effectiveWardName || isNumericWardPlaceholder)) {
      throw fail('Vui lòng chọn Phường/Xã người nhận hợp lệ.', 400);
    }
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

    receiverInfo.phone = normalizeAndValidateVnPhone(receiverInfo.phone);
    if (!receiverInfo.address) throw fail('Địa chỉ giao hàng không được để trống.', 400);

    const normalizedWeight = parsePositiveMeasure(weight, 500, 'Khối lượng kiện hàng (gram)');
    const normalizedLength = parsePositiveMeasure(length, 30, 'Chiều dài kiện hàng (cm)');
    const normalizedWidth = parsePositiveMeasure(width, 20, 'Chiều rộng kiện hàng (cm)');
    const normalizedHeight = parsePositiveMeasure(height, 10, 'Chiều cao kiện hàng (cm)');

    const calculatedCod = calculateCodAmount(order, orderType, customCodAmount);
    const ghnItems = await fetchOrderItemsForGHN(orderType, order._id);
    const insuranceValue = orderType === 'sale'
      ? Number(order.totalAmount || 0)
      : Number(order.rentalFee || 0) + Number(order.depositAmount || 0);

    const OrderModel = orderType === 'rental' ? RentalOrder : SalesOrder;

    // Đếm số lần tạo vận đơn của đơn hàng này để sinh clientOrderCode duy nhất, tránh GHN khóa mã trùng khi retry/timeout
    const previousShipmentsCount = await OrderShipment.countDocuments({
      orderType,
      orderId: order._id,
      shipmentType: 'outbound',
    });
    const attemptOffset = Math.max(previousShipmentsCount, Number(order.ghnCreateAttempts || 0));
    const clientOrderCode = attemptOffset > 0
      ? `${order.orderCode}-R${attemptOffset}`
      : order.orderCode;

    // Gọi GHN API tạo đơn (nếu GHN timeout -> tăng ghnCreateAttempts để lần retry đổi mã không bị GHN chặn trùng)
    let ghnRes;
    try {
      ghnRes = await ghnService.createGHNOrder({
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
        toWardName: receiverInfo.wardName,
        isNewToAddress: receiverInfo.isNewAddress,
        codAmount: calculatedCod,
        insuranceValue,
        weight: normalizedWeight,
        length: normalizedLength,
        width: normalizedWidth,
        height: normalizedHeight,
        note,
        items: ghnItems,
        clientOrderCode,
      });
    } catch (ghnErr) {
      if (ghnErr?.code === 'GHN_TIMEOUT') {
        await OrderModel.updateOne({ _id: order._id }, { $inc: { ghnCreateAttempts: 1 } }).catch(() => {});
      }
      throw ghnErr;
    }

    // Lưu vận đơn (nếu dính E11000 hoặc lỗi DB -> rollback hủy đơn GHN)
    const savedShipment = await saveShipmentOrRollbackGhn({
      user,
      order,
      orderType,
      shipmentType: 'outbound',
      ghnRes,
      senderInfo,
      receiverInfo,
      codAmount: calculatedCod,
      weight: normalizedWeight,
      length: normalizedLength,
      width: normalizedWidth,
      height: normalizedHeight,
      note,
      items: ghnItems,
      initialDescription: 'Đơn hàng đã được tạo thành công, đang chờ bàn giao cho bưu tá vận chuyển',
    }, storeSender.ghnShopId);

    // Lưu ngược thông tin & mã hành chính vào đơn hàng (sạch v2 nếu chuyển sang v3)
    const updateFields = {
      'shippingAddress.receiverName': receiverInfo.name,
      'shippingAddress.phone': receiverInfo.phone,
      'shippingAddress.street': receiverInfo.address,
      'shippingAddress.city': effectiveProvinceName || shipAddr.city || '',
      'shippingAddress.ward': effectiveWardName || shipAddr.ward || '',
      'shippingAddress.isNewAddress': useNewToAddress,
    };
    const numericProvId = Number(effectiveProvinceId ?? receiverInfo.provinceId);
    if (Number.isInteger(numericProvId) && numericProvId > 0) {
      updateFields['shippingAddress.provinceId'] = numericProvId;
    }
    const cleanWardCode = String(effectiveWardCode || receiverInfo.wardCode || '').trim();
    if (cleanWardCode && cleanWardCode !== 'undefined') {
      updateFields['shippingAddress.wardCode'] = cleanWardCode;
    }
    if (useNewToAddress) {
      updateFields['shippingAddress.districtId'] = null;
      updateFields['shippingAddress.district'] = '';
    } else {
      updateFields['shippingAddress.districtId'] = resolvedDistrictId ? Number(resolvedDistrictId) : null;
      updateFields['shippingAddress.district'] = effectiveDistrictName || shipAddr.district || '';
    }

    if (orderType === 'sale' && ['draft', 'confirmed'].includes(order.orderStatus)) {
      updateFields.orderStatus = 'processing';
    }

    const statusFilter = orderType === 'rental'
      ? { rentalStatus: 'confirmed' }
      : { orderStatus: { $in: ['draft', 'confirmed', 'processing'] } };

    let orderUpdateRes;
    try {
      orderUpdateRes = await OrderModel.updateOne(
        { _id: order._id, ...statusFilter },
        { $set: updateFields }
      );
    } catch (updateErr) {
      await rollbackSavedShipmentAndGhn({
        savedShipmentId: savedShipment._id,
        orderCode: ghnRes?.order_code,
        shopId: storeSender.ghnShopId,
        OrderModel,
        orderId: order._id,
      });
      throw updateErr;
    }

    // Nếu đơn hàng vừa chuyển trạng thái không hợp lệ (VD: cancelled) trong lúc gọi GHN -> hoàn tác xóa vận đơn & hủy trên GHN
    if (orderUpdateRes && orderUpdateRes.matchedCount === 0) {
      await rollbackSavedShipmentAndGhn({
        savedShipmentId: savedShipment._id,
        orderCode: ghnRes?.order_code,
        shopId: storeSender.ghnShopId,
        OrderModel,
        orderId: order._id,
      });
      throw fail('Đơn hàng đã chuyển trạng thái không thể tạo vận đơn GHN.', 409);
    }

    return savedShipment;
  });
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
  let rentalPrep = null;
  if (isSale) {
    salePrep = await prepareSalesReturnRequest(order, {
      reason,
      requestedItems,
      outboundShipment,
    });
  } else if (
    mongoose.connection.readyState === 1 ||
    (Array.isArray(requestedItems) && requestedItems.length > 0)
  ) {
    rentalPrep = await prepareRentalReturnRequest(order, { requestedItems });
  }

  const effectiveWeight = Number(weight) || outboundShipment?.weight || 500;
  const effectiveLength = Number(length) || outboundShipment?.length || 20;
  const effectiveWidth = Number(width) || outboundShipment?.width || 20;
  const effectiveHeight = Number(height) || outboundShipment?.height || 10;

  // Kiểm tra đơn thu hồi đang active hoặc chờ nghiệm thu KCS (vận đơn delivered chưa có RentalReturn completed)
  const activeReturnShipment = await OrderShipment.findOne(
    {
      orderType,
      orderId: order._id,
      shipmentType: 'return',
      shipmentStatus: { $in: ['preparing', 'shipped', 'delivered'] },
    },
    null,
    { sort: { createdAt: -1 } }
  ).lean();

  if (activeReturnShipment) {
    if (activeReturnShipment.shipmentStatus === 'delivered') {
      const settledRentalBatch = !isSale
        ? await RentalReturn.exists({
            rentalOrderId: order._id,
            shipmentId: activeReturnShipment._id,
            returnStatus: 'completed',
          })
        : false;
      if (!settledRentalBatch) {
        throw fail(`Hàng đã được giao về cửa hàng (Mã vận đơn GHN: ${activeReturnShipment.trackingCode || 'LY...'}), vui lòng tiến hành nghiệm thu để hoàn tất đợt trả này.`, 400);
      }
    } else {
      throw fail(`Đơn hàng đã có yêu cầu thu hồi đang xử lý (Mã vận đơn GHN: ${activeReturnShipment.trackingCode || 'Chờ bưu tá'}).`, 400);
    }
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

  if (!isSale && RentalOrder.db?.readyState === 1) {
    const versionFilter = order.returnFlowVersion == null
      ? { $or: [{ returnFlowVersion: 0 }, { returnFlowVersion: null }, { returnFlowVersion: { $exists: false } }] }
      : { returnFlowVersion: order.returnFlowVersion };
    const claimedRental = await RentalOrder.updateOne(
      { _id: order._id, ...versionFilter },
      { $inc: { returnFlowVersion: 1 } }
    );
    if (claimedRental.matchedCount !== 1) {
      throw fail('Đơn thuê vừa có yêu cầu thu hồi khác đang xử lý, vui lòng tải lại.', 409);
    }
  }

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
    items: isSale ? salePrep.ghnItems : (rentalPrep?.ghnItems || []),
    note: isSale
      ? `[HÀNG MUA HOÀN TRẢ VỀ CỬA HÀNG] ${effectiveNote}`
      : `[ĐỒ THUÊ HOÀN TRẢ VỀ CỬA HÀNG] ${effectiveNote}`,
    clientOrderCode,
  });

  const initialDescription = isSale
    ? 'Đã tạo yêu cầu trả hàng mua qua GHN, đang chờ bưu tá đến lấy hàng'
    : 'Đã tạo yêu cầu thu hồi trang phục, đang chờ bưu tá đến lấy đồ từ khách hàng';

  if (!isSale) {
    return await saveShipmentOrRollbackGhn({
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
      items: rentalPrep?.snapshotItems || [],
      initialDescription,
    }, storeReceiver.ghnShopId);
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
    await rollbackGhnOrder(ghnRes?.order_code, storeReceiver.ghnShopId);
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
  let branchShopId;
  if (shipment.orderType && shipment.orderId) {
    const scopedOrder = await fetchOrderAndValidateScope(user, shipment.orderType, shipment.orderId);
    branchShopId = scopedOrder?.locationId?.shopId?.ghnShopId
      || scopedOrder?.locationId?.ghnShopId
      || (await resolveBranchShippingInfo(scopedOrder).catch(() => null))?.ghnShopId;
  }

  if (shipment.isSimulated) {
    throw fail('Không thể hủy vận đơn mô phỏng qua cổng GHN.', 409);
  }

  if (shipment.shipmentStatus !== 'preparing') {
    throw fail(`Không thể hủy vận đơn đang ở trạng thái "${shipment.shipmentStatus}". Chỉ có thể hủy khi đơn đang chuẩn bị lấy hàng.`, 400);
  }

  if (shipment.trackingCode) {
    try {
      await ghnService.cancelGHNOrder(shipment.trackingCode, branchShopId);
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

  // Đồng bộ hủy vận đơn thu hồi (return) sang đơn bán hàng; vận đơn outbound giữ nguyên trạng thái đơn hàng.
  if (shipment.shipmentType === 'return' && shipment.orderType === 'sale') {
    await syncSalesReturnShipmentStatus(shipment, 'cancelled');
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
      // Vận đơn thu hồi đã giao về Showroom; giữ nguyên tiền cọc chờ Shop KCS.
    }
  }
};

/** Đồng bộ hủy vận đơn return từ GHN sang đơn bán hàng; vận đơn outbound giữ nguyên trạng thái đơn hàng. */
const updateOrderStatusOnCancelled = async (shipment) => {
  if (shipment.shipmentType === 'return' && shipment.orderType === 'sale') {
    await syncSalesReturnShipmentStatus(shipment, 'cancelled');
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
