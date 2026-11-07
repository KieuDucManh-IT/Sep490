import * as shipmentService from '../../services/shipping/shipmentService.js';
import * as ghnService from '../../services/shipping/ghnService.js';

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

export const ghnWebhookHandler = async (req, res, next) => {
  try {
    const payload = req.body || {};
    const normalized = {
      order_code: payload.order_code || payload.OrderCode,
      status: payload.status || payload.Status || payload.Type,
      time: payload.time || payload.Time,
      reason: payload.reason || payload.Reason || payload.Description,
      fee: payload.fee || payload.Fee,
    };
    const result = await shipmentService.processGHNWebhook(normalized);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

