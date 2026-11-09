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

export const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

/**
 * Chuẩn hóa đối tượng người gửi / người nhận (Chỉ còn cấp Tỉnh và cấp Xã/Phường)
 */
export const formatPartyInfo = ({ name, phone, address, provinceId, wardCode, latitude, longitude }) => ({
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
export const fetchOrderAndValidateScope = async (user, orderType, orderId) => {
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
  let shop = loc.shopId || {};

  // Nếu shopId là ObjectId chưa populate hoặc rỗng, tra cứu từ DB
  if (shop && mongoose.isValidObjectId(shop) && typeof shop.name === 'undefined') {
    const foundShop = await Shop.findById(shop).lean();
    if (foundShop) shop = foundShop;
  }

  // Nếu vẫn chưa có phone hoặc address, fallback tìm Shop chính (isHQ: true) hoặc Shop bất kỳ đang active
  if (!shop?.phone || !shop?.address) {
    const fallbackShop = (await Shop.findOne({ isHQ: true, status: 'ACTIVE' }).lean())
      || (await Shop.findOne({ status: 'ACTIVE' }).lean());
    if (fallbackShop) {
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
  const phone = shop.phone || loc.phone || '';
  const address = shop.address || loc.address || '';
  const latitude = shop.latitude ?? loc.latitude ?? null;
  const longitude = shop.longitude ?? loc.longitude ?? null;

  if (!phone) {
    throw fail(`Chi nhánh "${name}" chưa được cập nhật số điện thoại liên hệ trên MongoDB Atlas.`, 400);
  }
  if (!address) {
    throw fail(`Chi nhánh "${name}" chưa được cập nhật địa chỉ trên MongoDB Atlas.`, 400);
  }

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
export const fetchOrderItemsForGHN = async (orderType, orderId, totalWeight = 500) => {
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
export const calculateCodAmount = (order, orderType, customCod) => {
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
  initialDescription = 'Đơn hàng đã được tạo thành công, đang chờ bàn giao cho bưu tá vận chuyển',
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
  const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
  const shipmentCode = `SHP-${shipmentDateStr}-${randomHex}`;

  return await OrderShipment.create({
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
    note,
    createdBy: user._id,
    lastSyncedAt: new Date(),
  });
};

