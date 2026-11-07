import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';

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

/**
 * Tra cứu công khai thông tin hành trình vận chuyển từ MongoDB (100% bằng mã vận đơn GHN)
 */
export const trackPublicShipmentHandler = async (req, res, next) => {
  try {
    const { trackingCode } = req.params;
    const cleanCode = String(trackingCode || '').trim();

    if (!cleanCode) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mã vận đơn GHN.',
      });
    }

    // Tìm trực tiếp theo mã vận đơn duy nhất do GHN cấp
    const shipment = await OrderShipment.findOne({ trackingCode: cleanCode }).lean();

    // Nếu không có bản ghi trong MongoDB -> báo lỗi 404
    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin vận đơn khớp với mã vận đơn GHN đã cung cấp.',
      });
    }

    // Trả về dữ liệu chuẩn xác lấy từ đúng bản ghi MongoDB OrderShipment
    const sanitizedData = {
      trackingCode: shipment.trackingCode,
      carrierName: shipment.carrierName || 'Giao Hàng Nhanh',
      shipmentStatus: shipment.shipmentStatus,
      shipmentType: shipment.shipmentType || 'outbound',
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
  } catch (error) {
    return next(error);
  }
};
