import mongoose from 'mongoose';
import { OrderShipment } from '../../models/sale&rental/OrderShipment.js';
import { RentalOrder } from '../../models/sale&rental/RentalOrder.js';
import { SalesOrder } from '../../models/sale&rental/SalesOrder.js';
import { syncSingleShipmentFromGHN } from '../../services/shipping/shipmentSyncService.js';
import { fetchOrderAndValidateScope } from '../../services/shipping/shipmentHelpers.js';
import * as shipmentService from '../../services/shipping/shipmentService.js';
import * as ghnService from '../../services/shipping/ghnService.js';
import { uploadToCloudinary } from '../../config/cloudinary.js';

const handleError = (error, res, next) => {
  const status = error.statusCode || error.status || 400;
  return res.status(status).json({
    success: false,
    message: error.message || 'Lỗi xử lý vận đơn',
    code: error.code || null,
    errorData: error.data || null,
  });
};

export const calculateFeeHandler = async (req, res, next) => {
  try {
    const result = await shipmentService.calculateOrderShippingFee(req.user, req.body);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const createOutboundHandler = async (req, res, next) => {
  try {
    const result = await shipmentService.createOutboundShipment(req.user, req.body);
    return res.status(201).json({
      success: true,
      message: 'Tạo vận đơn GHN thành công',
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const createReturnHandler = async (req, res, next) => {
  try {
    const result = await shipmentService.createReturnShipment(req.user, req.body);
    return res.status(201).json({
      success: true,
      message: 'Tạo vận đơn thu hồi đồ thuê thành công',
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const cancelShipmentHandler = async (req, res, next) => {
  try {
    const result = await shipmentService.cancelShipment(req.user, req.params.id, req.body.reason);
    return res.json({
      success: true,
      message: 'Đã hủy vận đơn thành công',
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getShipmentsByOrderHandler = async (req, res, next) => {
  try {
    const { orderType, orderId } = req.params;
    const result = await shipmentService.getShipmentsByOrderId(req.user, orderType, orderId);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getPrintTokenHandler = async (req, res, next) => {
  try {
    const userRole = String(req.user?.Role || req.user?.role || '').toLowerCase().replace(/[\s_-]/g, '');
    if (!['branchmanager', 'shopowner', 'owner', 'admin'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền in phiếu vận đơn GHN.',
      });
    }

    const cleanCode = String(req.params?.trackingCode || '').trim();
    if (!cleanCode) {
      return res.status(400).json({
        success: false,
        message: 'Mã vận đơn không được để trống.',
      });
    }

    const shipment = await OrderShipment.findOne({ trackingCode: cleanCode }).lean();
    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy bản ghi vận đơn.',
      });
    }

    if (
      shipment.isSimulated ||
      /^(SHP|TRK)-/i.test(shipment.trackingCode || '') ||
      shipment.shipmentType === 'return' ||
      !['preparing', 'shipped'].includes(shipment.shipmentStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ hỗ trợ in phiếu A5 cho vận đơn GHN chiều đi đang chờ lấy hoặc đang giao.',
      });
    }

    const order = await fetchOrderAndValidateScope(req.user, shipment.orderType, shipment.orderId);
    const branchShopId = order?.locationId?.shopId?.ghnShopId || order?.locationId?.ghnShopId || undefined;
    const result = await ghnService.generatePrintToken(cleanCode, branchShopId);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getProvincesHandler = async (req, res, next) => {
  try {
    const result = await ghnService.getProvinces();
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getNewProvincesHandler = async (req, res, next) => {
  try {
    const result = await ghnService.getNewProvinces();
    return res.json({ success: true, data: result });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getDistrictsHandler = async (req, res, next) => {
  try {
    const result = await ghnService.getDistricts(req.params.provinceId);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getWardsHandler = async (req, res, next) => {
  try {
    const result = await ghnService.getWards(req.params.districtId);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getNewWardsHandler = async (req, res, next) => {
  try {
    const result = await ghnService.getNewWards(req.params.provinceId);
    return res.json({ success: true, data: result });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getWardsByProvinceHandler = async (req, res, next) => {
  try {
    const result = await ghnService.getWardsByProvince(req.params.provinceId);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const ghnWebhookHandler = async (req, res, next) => {
  try {
    const secretKey =
      req.params.secretKey ||
      req.query.secret ||
      req.headers['x-ghn-secret'] ||
      req.headers['x-webhook-secret'] ||
      '';

    const payload = req.body || {};
    const normalized = {
      order_code: payload.order_code || payload.OrderCode,
      status: payload.status || payload.Status || payload.Type,
      time: payload.time || payload.Time,
      reason: payload.reason || payload.Reason || payload.Description,
      fee: payload.fee || payload.Fee,
      shop_id: payload.shop_id || payload.ShopID || payload.shopId,
      client_id: payload.client_id || payload.ClientID,
    };
    const result = await shipmentService.processGHNWebhook(normalized, secretKey);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const updateManualStatusHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newStatus, reason } = req.body || {};
    const result = await shipmentService.updateManualShipmentStatus(req.user, id, newStatus, reason);
    return res.json({
      success: true,
      message: `Cập nhật trạng thái vận đơn thành công: [${newStatus}]`,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const simulateGhnHandler = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_GHN_SIMULATOR === 'false') {
      return res.status(403).json({
        success: false,
        message: 'Endpoint mô phỏng GHN bị vô hiệu hóa trên môi trường Production',
      });
    }

    const { trackingCode, ghnStatus, reason, evidenceImage, failReason } = req.body || {};
    if (!trackingCode || !ghnStatus) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu trackingCode hoặc ghnStatus trong payload mô phỏng',
      });
    }

    const target = await OrderShipment.findOne({
      trackingCode,
    }).lean();

    if (!target) {
      return res.status(404).json({
        message: 'Không tìm thấy vận đơn.',
      });
    }

    const { fetchOrderAndValidateScope } = await import(
      '../../services/shipping/shipmentHelpers.js'
    );

    await fetchOrderAndValidateScope(
      req.user,
      target.orderType,
      target.orderId
    );

    if (target.isSimulated) {
      return res.status(409).json({
        message:
          'Hãy cập nhật vận đơn này trong cửa sổ Trả đồ.',
      });
    }

    const normalized = {
      order_code: trackingCode,
      status: ghnStatus,
      time: new Date().toISOString(),
      reason: failReason || reason || (evidenceImage ? 'Giao hàng thành công (Có ảnh xác nhận)' : 'Cập nhật trạng thái giao hàng'),
      evidenceImage: evidenceImage || null,
      failReason: failReason || null,
      isSimulated: true,
    };

    const result = await shipmentService.processGHNWebhook(normalized, '', { skipVerifyBack: true });
    if (!result?.success) {
      return res.status(400).json({
        success: false,
        message: result?.message || 'Mô phỏng GHN thất bại',
      });
    }
    return res.json({
      success: true,
      message: `Mô phỏng GHN [${ghnStatus}] hoàn tất`,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const uploadProofHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn file hình ảnh' });
    }
    const uploaded = await uploadToCloudinary(
      req.file.buffer,
      {
        folder: 'vestora/shipping/proofs',
        resource_type: 'image',
      },
      req.file.mimetype || 'image/jpeg'
    );
    return res.json({
      success: true,
      imageUrl: uploaded.secure_url || uploaded.url,
    });
  } catch (error) {
    handleError(error, res, next);
  }
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
 * Tra cứu tiến trình vận chuyển cho người dùng đã xác thực (100% Authenticated In-App Tracking)
 * Chỉ chính chủ đơn hàng hoặc nhân viên (Branch Manager / Shop Owner / Admin) mới có quyền truy cập.
 */
export const trackShipmentHandler = async (req, res, next) => {
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

    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Bạn chưa đăng nhập.',
      });
    }

    const userRole = String(currentUser?.Role || currentUser?.role || '').trim().toLowerCase();
    const isStaffOrAdmin = /branch_?manager|shop_?owner|owner|admin/i.test(userRole);

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
      const OrderModel = orderType === 'rental' ? RentalOrder : SalesOrder;
      const parentOrder = await OrderModel.findById(shipment.orderId).select('customerId').lean();

      // Kiểm tra quyền: Khách hàng chỉ được phép xem đơn của chính mình
      if (!isStaffOrAdmin) {
        const isOwner = parentOrder && String(parentOrder.customerId) === String(currentUser._id);
        if (!isOwner) {
          return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền xem thông tin đơn hàng này.',
          });
        }
      }

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

      const receiverName = shipment.receiverInfo?.name || 'Khách Hàng';
      const receiverPhone = shipment.receiverInfo?.phone || '';
      const receiverAddress = shipment.receiverInfo?.address || '';

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
          name: receiverName,
          phone: receiverPhone,
          address: receiverAddress,
          maskedAddress: receiverAddress,
          isMasked: false,
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
          evidenceImage: h.evidenceImage || null,
          failReason: h.failReason || null,
        })),
        deliveryProofImage: shipment.deliveryProofImage || null,
        failureReason: shipment.failureReason || null,
        cancellationReason: shipment.cancellationReason || null,
        createdAt: shipment.createdAt,
      };

      return res.json({
        success: true,
        data: sanitizedData,
      });
    }

    // 3. Nếu chưa có OrderShipment, tìm từ RentalOrder hoặc SalesOrder
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

    // Kiểm tra quyền: Khách hàng chỉ được phép xem đơn của chính mình
    if (!isStaffOrAdmin) {
      const isOwner = String(order.customerId?._id || order.customerId) === String(currentUser._id);
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xem thông tin đơn hàng này.',
        });
      }
    }

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

    const receiverName = shipAddr.receiverName || shipAddr.toName || customer.FullName || 'Khách Hàng';
    const receiverPhone = shipAddr.phone || shipAddr.toPhone || customerInfo?.Phone || customer.phone || '';
    const receiverAddress = shipAddr.street || customerInfo?.AddressDetail || customerInfo?.Address || customer.address || '';

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
        name: receiverName,
        phone: receiverPhone,
        address: receiverAddress,
        maskedAddress: receiverAddress,
        isMasked: false,
      },
      storeInfo: {
        name: storeName,
        address: storeAddress,
        latitude: storeLat,
        longitude: storeLng,
      },
      statusHistory,
      deliveryProofImage: null,
      failureReason: order.failureReason || order.cancelReason || null,
      cancellationReason: order.cancelReason || order.cancellationReason || null,
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

// Alias tương thích ngược
export const trackPublicShipmentHandler = trackShipmentHandler;
