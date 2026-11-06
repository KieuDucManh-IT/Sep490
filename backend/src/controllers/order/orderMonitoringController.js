import {
  getRentalOrders,
  getRentalOrderById,
  getSalesOrders,
  getSalesOrderById,
  getOrderMetrics,
} from '../../services/order/orderMonitoringService.js';

const handleError = (error, res, next) => {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }
  return next(error);
};

export const getRentalOrdersHandler = async (req, res, next) => {
  try {
    const result = await getRentalOrders(req.user, req.query);
    return res.json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
      scope: result.scope,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getRentalOrderByIdHandler = async (req, res, next) => {
  try {
    const result = await getRentalOrderById(req.user, req.params.id);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getSalesOrdersHandler = async (req, res, next) => {
  try {
    const result = await getSalesOrders(req.user, req.query);
    return res.json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
      scope: result.scope,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getSalesOrderByIdHandler = async (req, res, next) => {
  try {
    const result = await getSalesOrderById(req.user, req.params.id);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

export const getOrderMetricsHandler = async (req, res, next) => {
  try {
    const result = await getOrderMetrics(req.user, req.query);
    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    handleError(error, res, next);
  }
};

