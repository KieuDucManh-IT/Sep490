import mongoose from 'mongoose';
import crypto from 'node:crypto';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { RentalOrderDetail } from '../../models/sale&rental/RentalOrderDetail.js';
import { SalesOrderDetail } from '../../models/sale&rental/SalesOrderDetail.js';
import { resolveLocationScope } from '../order/orderMonitoringService.js';
import { resolveGpsToGhn } from './storeGpsResolver.js';
import { Shop } from '../../models/shop/Shop.js';

import { appError as fail } from '../warehouse/shared/errors.js';

export { fail };

export const normalizeAndValidateVnPhone = (rawPhone, partyLabel = 'người nhận') => {
  let phone = String(rawPhone || '').trim().replace(/[\s.-]/g, '');
  if (!phone) throw fail(`Số điện thoại ${partyLabel} không được để trống.`, 400);
  if (phone.startsWith('+84')) phone = `0${phone.slice(3)}`;
  else if (phone.startsWith('84') && phone.length >= 11) phone = `0${phone.slice(2)}`;
  if (!/^(0(3[2-9]|5[25689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}|02[0-9]{8,9})$/.test(phone)) {
    throw fail(`Số điện thoại ${partyLabel} không hợp lệ.`, 400);
  }
  return phone;
};

/**
 * Chuẩn hóa đối tượng người gửi / người nhận (Tỉnh/Thành, Quận/Huyện, Phường/Xã)
 */
export const formatPartyInfo = ({
  name,
  phone,
  address,
  provinceId,
  districtId,
  wardCode,
  provinceName,
  districtName,
  wardName,
  isNewAddress,
  latitude,
  longitude,
}) => ({
  name: name || '',
  phone: phone || '',
  address: address || '',
  latitude: latitude ? Number(latitude) : null,
  longitude: longitude ? Number(longitude) : null,
  provinceId: provinceId ? Number(provinceId) : undefined,
  districtId: districtId ? Number(districtId) : undefined,
  wardCode: wardCode ? String(wardCode) : undefined,
  provinceName: provinceName || '',
  districtName: districtName || '',
  wardName: wardName || '',
  isNewAddress: Boolean(isNewAddress),
});

/**
 * Lấy đơn hàng và kiểm tra quyền quản lý theo chi nhánh
 */
export const fetchOrderAndValidateScope = async (user, orderType, orderId) => {
  if (!['sale', 'rental'].includes(orderType)) {
    throw fail('Loại đơn hàng không hợp lệ (chỉ hỗ trợ sale hoặc rental).', 400);
  }
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
        select: 'name code address phone managerId provinceId districtId wardCode ghnShopId city ward latitude longitude',
      },
    })
    .lean();

  if (!order) {
    throw fail(`Không tìm thấy ${isRental ? 'đơn thuê' : 'đơn bán'} yêu cầu.`, 404);
  }

  // Khách hàng chính chủ chỉ được thao tác đơn của chính mình
  const role = String(user?.Role || user?.role || '').toLowerCase().replace(/[\s_-]/g, '');
  if (role === 'customer') {
    const custId = String(order.customerId?._id || order.customerId || '');
    if (custId !== String(user._id)) {
      throw fail('Bạn không có quyền thao tác đơn hàng này.', 403);
    }
    return order;
  }

  // Kiểm tra quyền theo chi nhánh đối với quản lý và nhân viên
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
  let shop = loc.shopId || {};

  // Nếu shopId là ObjectId chưa populate hoặc rỗng, tra cứu từ DB
  if (shop && mongoose.isValidObjectId(shop) && typeof shop.name === 'undefined') {
    const foundShop = await Shop.findById(shop).lean();
    if (foundShop) shop = foundShop;
  }

  const originalShopId = shop?._id || null;
  const originalHasAddress = Boolean(shop?.address);
  let persistShopId = originalShopId && originalHasAddress ? originalShopId : null;

  // Chỉ tìm shop mặc định khi gọi ước tính phí ẩn danh (order === null); không mượn chéo địa chỉ shop khác cho đơn cụ thể
  if (!order && !originalHasAddress) {
    const fallbackQuery = Shop.findOne({ status: 'ACTIVE', isDeleted: { $ne: true } });
    const fallbackShop = await (typeof fallbackQuery?.sort === 'function'
      ? fallbackQuery.sort({ createdAt: 1, _id: 1 })
      : fallbackQuery
    ).lean();
    if (fallbackShop) {
      if (fallbackShop._id && fallbackShop.address) {
        persistShopId = fallbackShop._id;
      }
      shop = {
        ...fallbackShop,
        ...shop,
        phone: shop?.phone || fallbackShop.phone,
        address: shop?.address || fallbackShop.address,
        provinceId: shop?.provinceId || fallbackShop.provinceId,
        districtId: shop?.districtId || fallbackShop.districtId,
        wardCode: shop?.wardCode || fallbackShop.wardCode,
        ghnShopId: shop?.ghnShopId || fallbackShop.ghnShopId,
      };
    }
  }

  const name = shop.name || loc.name || 'Cửa hàng';
  const rawPhone = shop.phone || loc.phone || '';
  const address = shop.address || loc.address || '';
  const latitude = shop.latitude ?? loc.latitude ?? null;
  const longitude = shop.longitude ?? loc.longitude ?? null;

  if (!rawPhone) {
    throw fail(`Chi nhánh "${name}" chưa được cập nhật số điện thoại liên hệ trên MongoDB Atlas.`, 400);
  }
  if (!address) {
    throw fail(`Chi nhánh "${name}" chưa được cập nhật địa chỉ trên MongoDB Atlas.`, 400);
  }
  const phone = normalizeAndValidateVnPhone(rawPhone, `chi nhánh "${name}"`);

  let provinceId = shop.provinceId || loc.provinceId;
  let districtId = shop.districtId || loc.districtId;
  let wardCode = shop.wardCode || loc.wardCode;
  const ghnShopId = shop.ghnShopId || loc.ghnShopId || null;

  // Nếu chi nhánh chưa có ID địa giới GHN trong MongoDB, tự động tra cứu từ GHN API theo địa chỉ/tọa độ
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

    const numDistrictId = Number(districtId);
    const numProvinceId = Number(provinceId);
    if (persistShopId && Number.isFinite(numDistrictId) && numDistrictId > 0 && wardCode) {
      Shop.updateOne(
        { _id: persistShopId },
        {
          $set: {
            districtId: numDistrictId,
            wardCode: String(wardCode),
            ...(Number.isFinite(numProvinceId) && numProvinceId > 0 && numProvinceId < 1000000
              ? { provinceId: numProvinceId }
              : {}),
          },
        }
      ).catch(() => { });
    }
  }

  if (!districtId || !wardCode) {
    throw fail(`Không thể xác định mã Quận/Huyện hoặc Phường/Xã GHN cho chi nhánh "${name}". Vui lòng cập nhật địa chỉ cửa hàng.`, 400);
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
export const fetchOrderItemsForGHN = async (orderType, orderId) => {
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

  return orderItems.map((item) => {
    const qty = Math.max(1, Number(item.quantity) || 1);
    const unitPrice = item.unitPrice ?? item.unitRentalFee ?? Math.round((Number(item.lineTotal) || 0) / qty);
    return {
      name: item.variantId?.variantName || item.variantId?.productId?.name || 'Sản phẩm Vestora',
      sku: item.variantId?.sku || item.variantId?.productId?.productCode || 'SKU-VESTORA',
      quantity: qty,
      price: Math.max(0, Math.round(Number(unitPrice) || 0)),
    };
  });
};

/**
 * Tính số tiền thu hộ COD của đơn hàng
 */
export const calculateCodAmount = (order, orderType, customCod) => {
  if (!['sale', 'rental'].includes(orderType)) {
    throw fail('Loại đơn hàng không hợp lệ (chỉ hỗ trợ sale hoặc rental).', 400);
  }
  const hasCustomCod = customCod !== undefined && customCod !== null && customCod !== '';
  let parsedCustomCod = null;
  if (hasCustomCod) {
    if (
      typeof customCod === 'boolean' ||
      typeof customCod === 'object' ||
      (typeof customCod === 'string' && customCod.trim() === '')
    ) {
      throw fail('Số tiền thu hộ COD không hợp lệ.', 400);
    }
    parsedCustomCod = Number(customCod);
    if (!Number.isInteger(parsedCustomCod) || parsedCustomCod < 0) {
      throw fail('Số tiền thu hộ COD không hợp lệ.', 400);
    }
  }

  if (order.paymentStatus === 'paid') {
    if (hasCustomCod && parsedCustomCod > 0) {
      throw fail('Đơn hàng đã thanh toán đủ, không thể đặt tiền thu hộ COD lớn hơn 0.', 400);
    }
    return 0;
  }

  if (hasCustomCod) return parsedCustomCod;

  if (orderType === 'sale') {
    return Math.max(0, (order.totalAmount || 0) - (order.paidAmount || 0));
  }
  const totalDue = (order.rentalFee || 0) + (order.depositAmount || 0);
  return Math.max(0, totalDue - (order.paidAmount || 0));
};

/**
 * Lưu bản ghi vận đơn vào MongoDB
 */
export const saveShipmentRecord = async ({
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
  items = [],
  initialDescription = 'Đơn hàng đã được tạo thành công, đang chờ bàn giao cho bưu tá vận chuyển',
  session = null,
}) => {
  const canonicalTrackingCode = ghnRes.order_code;
  const initialHistory = [
    {
      status: 'preparing',
      ghnStatus: 'ready_to_pick',
      description: initialDescription,
      timestamp: new Date(),
    },
  ];

  const fromShopId = order.locationId?.shopId?._id || order.locationId?.shopId || order.locationId;
  const fromLocationId = order.locationId?._id || (order.locationId && typeof order.locationId === 'object' ? order.locationId._id : order.locationId) || null;
  const deliveryAddress = receiverInfo?.address || order.shippingAddress?.street || '';
  const deliveryMethod = order.deliveryMethod || 'carrier';

  const shipmentDateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  const shipmentCode = `SHP-${shipmentDateStr}-${randomHex}`;

  const doc = {
    trackingCode: canonicalTrackingCode,
    shipmentCode,
    orderCode: order.orderCode,
    orderType,
    orderId: order._id,
    fromShopId,
    fromLocationId,
    deliveryAddress,
    deliveryMethod,
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
    items: Array.isArray(items) ? items : [],
    note,
    createdBy: user._id,
    lastSyncedAt: new Date(),
  };

  if (session) {
    const [created] = await OrderShipment.create([doc], { session });
    return created;
  }
  return await OrderShipment.create(doc);
};

