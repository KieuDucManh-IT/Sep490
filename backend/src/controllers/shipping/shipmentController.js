import * as shipmentService from '../../services/shipping/shipmentService.js';
import * as ghnService from '../../services/shipping/ghnService.js';
import { uploadToCloudinary } from '../../config/cloudinary.js';

const handleError = (error, res, next) => {
  const status = error.statusCode || error.status || 400;
  return res.status(status).json({
    success: false,
    message: error.message || 'Lỗi xử lý vận đơn',
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
    const { trackingCode } = req.params;
    const result = await ghnService.generatePrintToken(trackingCode);
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


