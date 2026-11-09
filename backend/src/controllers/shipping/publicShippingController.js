import mongoose from 'mongoose';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { syncSingleShipmentFromGHN } from '../../services/shipping/shipmentSyncService.js';

/**
 * Che bớt thông tin nhạy cảm (PII Masking) cho màn hình tra cứu công khai
 */
const maskPhone = (phone) => {
  if (!phone || phone.length < 7) return '***';
  return phone.slice(0, 3) + '****' + phone.slice(-3);
};

const maskName = (name) => {
  if (!name) return 'Khách hàng';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2) + '***';
  return parts[0] + ' ' + parts[parts.length - 1].slice(0, 1) + '***';
};

const maskAddress = (address) => {
  if (!address) return 'Việt Nam';
  const parts = address.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    return `***, ${parts.slice(1).join(', ')}`;
  }
  return address.replace(/^[\d/A-Za-z\s.-]+?\s+(đường|phố|ngõ|ngách|đ\.)/i, '*** $1').replace(/^\d+[\w/]*\s+/, '*** ');
};

/**
 * Chuẩn hóa mô tả hành trình thân thiện với khách hàng, loại bỏ key kỹ thuật và ID nội bộ
 */
const cleanUserFriendlyDescription = (desc) => {
  if (!desc) return 'Cập nhật hành trình vận chuyển';
  return desc
    .replace(/\s*\(Cập nhật trạng thái vận chuyển qua Sandbox\)/gi, '')
    .replace(/\s*\(Sandbox\)/gi, '')
    .replace(/trên Shop ID \d+/gi, 'tại cửa hàng')
    .replace(/trên Shop \d+/gi, 'tại cửa hàng')
    .replace(/sang Shop ID \d+/gi, 'sang thông tin mới')
    .replace(/sang Shop \d+/gi, 'sang thông tin mới')
    .trim();
};

export const trackPublicShipmentHandler = async (req, res, next) => {
  try {
    const { trackingCode } = req.params;
    const cleanCode = String(trackingCode || '').trim();
    const upperCode = cleanCode.toUpperCase();
    const codeCandidates = Array.from(new Set([cleanCode, upperCode])).filter(Boolean);

    if (!cleanCode) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mã vận đơn GHN hoặc mã đơn hàng.',
      });
    }

    // 1. Tìm trong bảng OrderShipment theo mã vận đơn GHN HOẶC mã đơn sàn (hỗ trợ hoa/thường)
    const shipmentQuery = {
      $or: [
        { trackingCode: { $in: codeCandidates } },
        { orderCode: { $in: codeCandidates } },
      ],
    };
    if (req.query?.type) {
      shipmentQuery.shipmentType = req.query.type;
    }

    const matchingShipments = await OrderShipment.find(shipmentQuery).sort({ createdAt: -1 });
    // Ưu tiên vận đơn đang hoạt động (chưa hủy) nếu có nhiều vận đơn cho cùng mã đơn
    let shipment = matchingShipments.find((s) => s.shipmentStatus !== 'cancelled') || matchingShipments[0] || null;

    // Tự động đồng bộ thời gian thực từ GHN nếu có mã vận đơn
    if (shipment && shipment.trackingCode) {
      const forceSync = req.query?.force === 'true' || req.query?.sync === 'true';
      const synced = await syncSingleShipmentFromGHN(shipment, forceSync);
      if (synced) {
        shipment = synced.toObject ? synced.toObject() : synced;
      }
    }

    // 2. Nếu đã có bản ghi vận đơn GHN trong MongoDB
    if (shipment) {
      const orderType = shipment.orderType || (shipment.orderCode?.startsWith('SAL') ? 'sale' : 'rental');
      const isReturn = shipment.shipmentType === 'return';

      let displayStatusText = undefined;
      if (shipment.shipmentStatus === 'preparing') {
        displayStatusText = isReturn ? 'Chờ lấy hàng thu hồi' : 'Chờ lấy hàng';
      } else if (shipment.shipmentStatus === 'shipped') {
        displayStatusText = isReturn ? 'Đang thu hồi về shop' : 'Đang giao hàng';
      } else if (shipment.shipmentStatus === 'delivered') {
        if (isReturn) {
          displayStatusText = 'Đã giao trả về cửa hàng';
        } else if (orderType === 'rental') {
          displayStatusText = 'Giao thành công (Đang thuê)';
        } else {
          displayStatusText = 'Giao hàng thành công';
        }
      } else if (shipment.shipmentStatus === 'cancelled') {
        displayStatusText = 'Đã hủy';
      } else if (shipment.shipmentStatus === 'failed') {
        displayStatusText = 'Giao hàng thất bại';
      }

      const sanitizedData = {
        trackingCode: shipment.trackingCode,
        orderCode: shipment.orderCode || null,
        hasGhnShipment: true,
        carrierName: shipment.carrierName || 'Giao Hàng Nhanh',
        shipmentStatus: shipment.shipmentStatus,
        displayStatusText,
        shipmentType: shipment.shipmentType || 'outbound',
        orderType,
        expectedDeliveryTime: shipment.expectedDeliveryTime,
        shippedAt: shipment.shippedAt,
        deliveredAt: shipment.deliveredAt,
        receiverInfo: {
          name: maskName(shipment.receiverInfo?.name),
          phone: maskPhone(shipment.receiverInfo?.phone),
          maskedAddress: maskAddress(shipment.receiverInfo?.address),
        },
        storeInfo: {
          name: shipment.shipmentType === 'return' ? shipment.receiverInfo?.name : shipment.senderInfo?.name,
          address: shipment.shipmentType === 'return' ? shipment.receiverInfo?.address : shipment.senderInfo?.address,
          latitude: shipment.shipmentType === 'return' ? shipment.receiverInfo?.latitude : shipment.senderInfo?.latitude,
          longitude: shipment.shipmentType === 'return' ? shipment.receiverInfo?.longitude : shipment.senderInfo?.longitude,
        },
        statusHistory: (shipment.statusHistory || []).map((h) => ({
          status: h.status,
          description: cleanUserFriendlyDescription(h.description),
          location: h.location,
          timestamp: h.timestamp,
        })),
        createdAt: shipment.createdAt,
      };

      return res.json({
        success: true,
        data: sanitizedData,
      });
    }

    // 3. Nếu chưa có bản ghi OrderShipment (Branch Manager chưa kịp gửi đơn cho GHN)
    // Tra cứu trực tiếp từ bảng RentalOrder hoặc SalesOrder theo orderCode hoặc _id
    const orderQuery = {
      $or: [
        { orderCode: { $in: codeCandidates } },
        ...(mongoose.Types.ObjectId.isValid(cleanCode) ? [{ _id: cleanCode }] : []),
      ],
    };

    let order = await RentalOrder.findOne(orderQuery)
      .populate({
        path: 'locationId',
        populate: { path: 'shopId' },
      })
      .populate('customerId')
      .lean();
    let orderType = 'rental';

    if (!order) {
      order = await SalesOrder.findOne(orderQuery)
        .populate({
          path: 'locationId',
          populate: { path: 'shopId' },
        })
        .populate('customerId')
        .lean();
      orderType = 'sale';
    }

    // Nếu không tìm thấy cả đơn hàng lẫn vận đơn
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin đơn hàng hoặc mã vận đơn phù hợp.',
      });
    }

    // 4. Xác định trạng thái chuẩn bị đơn theo yêu cầu:
    // - Đơn thuê hoặc đơn mua đã thanh toán (paymentStatus === 'paid'): "Chờ lấy hàng" (chờ shipper GHN đến lấy)
    // - Đơn ship COD (chưa thanh toán / paymentStatus !== 'paid'): "Chờ xác nhận"
    const isPaid = order.paymentStatus === 'paid';
    const isCancelled = order.rentalStatus === 'cancelled' || order.orderStatus === 'cancelled';

    let currentStatus = 'preparing';
    let displayStatusText = 'Chờ lấy hàng';

    if (isCancelled) {
      currentStatus = 'cancelled';
      displayStatusText = 'Đã hủy';
    } else if (!isPaid) {
      currentStatus = 'pending_confirmation';
      displayStatusText = 'Chờ xác nhận';
    }

    // Trích xuất thông tin khách hàng nhận
    const customer = order.customerId || {};
    const customerInfo = Array.isArray(customer.Information) ? customer.Information[0] : (customer.Information || {});
    const shipAddr = order.shippingAddress || {};

    let receiverName = shipAddr.receiverName || shipAddr.toName || customer.FullName || 'Khách Hàng';
    let receiverPhone = shipAddr.phone || shipAddr.toPhone || customerInfo?.Phone || customer.phone || '';
    let receiverAddress = shipAddr.street || customerInfo?.AddressDetail || customerInfo?.Address || customer.address || '';

    // Fallback bóc tách từ order.note nếu có định dạng "[Giao tận nơi: Name - Phone - Address]"
    if (order.note && (!receiverPhone || !receiverAddress)) {
      const match = order.note.match(/\[Giao tận nơi:\s*([^-]+?)\s*-\s*([^-]+?)\s*-\s*([^\]]+)\]/);
      if (match) {
        if (!shipAddr.receiverName && !customer.FullName) receiverName = match[1].trim();
        if (!receiverPhone) receiverPhone = match[2].trim();
        if (!receiverAddress) receiverAddress = match[3].trim();
      }
    }

    // Trích xuất thông tin chi nhánh / showroom xuất hàng
    let storeName = 'Hệ thống Showroom Vestora';
    let storeAddress = 'Chi nhánh phụ trách đơn';
    let storeLat = null;
    let storeLng = null;

    const loc = order.locationId;
    if (loc) {
      const shop = loc.shopId;
      if (shop) {
        storeName = shop.name || shop.shopName || loc.name || storeName;
        storeAddress = shop.address || loc.address || storeAddress;
        storeLat = shop.latitude ?? loc.latitude ?? null;
        storeLng = shop.longitude ?? loc.longitude ?? null;
      } else {
        storeName = loc.name || storeName;
        storeAddress = loc.address || storeAddress;
        storeLat = loc.latitude ?? null;
        storeLng = loc.longitude ?? null;
      }
    }

    // Xây dựng tiến trình lịch sử khởi tạo
    const statusHistory = [];

    if (isCancelled) {
      statusHistory.push({
        status: 'cancelled',
        description: 'Đơn hàng đã được hủy theo yêu cầu.',
        location: storeName,
        timestamp: order.updatedAt || order.createdAt || new Date(),
      });
    } else if (isPaid) {
      statusHistory.push(
        {
          status: 'confirmed',
          description: orderType === 'rental'
            ? 'Đơn thuê đã thanh toán thành công. Cửa hàng đã tiếp nhận đơn.'
            : 'Đơn hàng đã thanh toán thành công. Cửa hàng đã tiếp nhận đơn.',
          location: storeName,
          timestamp: order.createdAt || new Date(),
        },
        {
          status: 'preparing',
          description: orderType === 'rental'
            ? 'Cửa hàng đang kiểm tra trang phục, chuẩn bị phụ kiện và chờ shipper GHN đến lấy.'
            : 'Cửa hàng đang đóng gói sản phẩm và chờ shipper GHN đến lấy hàng.',
          location: storeName,
          timestamp: order.updatedAt || order.createdAt || new Date(),
        }
      );
    } else {
      // Đơn ship COD
      statusHistory.push({
        status: 'pending_confirmation',
        description: 'Đơn hàng đã đặt thành công (Thanh toán COD). Chờ cửa hàng liên hệ xác nhận đơn.',
        location: storeName,
        timestamp: order.createdAt || new Date(),
      });
    }

    const sanitizedOrderData = {
      trackingCode: order.orderCode,
      orderCode: order.orderCode,
      hasGhnShipment: false, // Báo cho frontend biết chưa đẩy đơn sang GHN
      carrierName: 'Giao Hàng Nhanh',
      shipmentStatus: currentStatus,
      displayStatusText,
      shipmentType: 'outbound',
      orderType,
      expectedDeliveryTime: null,
      shippedAt: null,
      deliveredAt: null,
      receiverInfo: {
        name: maskName(receiverName),
        phone: maskPhone(receiverPhone),
        maskedAddress: maskAddress(receiverAddress),
      },
      storeInfo: {
        name: storeName,
        address: storeAddress,
        latitude: storeLat,
        longitude: storeLng,
      },
      statusHistory,
      createdAt: order.createdAt,
    };

    return res.json({
      success: true,
      data: sanitizedOrderData,
    });
  } catch (error) {
    return next(error);
  }
};
