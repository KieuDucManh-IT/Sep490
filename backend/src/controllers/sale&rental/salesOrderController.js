/**
 * Sales Order Controller
 * Tiếp nhận HTTP requests, kiểm tra quyền truy cập và điều phối Sales Order Service
 */

import * as salesOrderService from '../../services/sale&rental/salesOrderService.js';

const normalizedRole = (user) => String(user?.role || user?.Role || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]/g, '');

const ensureCustomer = (req, res) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Bạn cần đăng nhập để xem lịch sử đơn mua',
    });
    return false;
  }

  if (normalizedRole(req.user) !== 'customer') {
    res.status(403).json({
      success: false,
      message: 'Lịch sử đơn mua chỉ dành cho khách hàng',
    });
    return false;
  }

  return true;
};

export const createOrder = async (req, res, next) => {
  const service = req?.deps?.salesOrderService || salesOrderService;
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Bạn cần đăng nhập để đặt mua sản phẩm',
      });
    }

    const customerId = req.user._id;
    const {
      locationId,
      items,
      note,
      paymentMethod = 'cod',
      shippingAddress,
      expectedTotalAmount,
    } = req.body;

    const result = await service.createSalesOrder({
      customerId,
      createdBy: customerId,
      locationId,
      items,
      note,
      paymentMethod,
      shippingAddress,
      expectedTotalAmount,
    });

    return res.status(201).json({
      success: true,
      message: 'Đặt mua sản phẩm thành công',
      data: result.order,
      items: result.items,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code,
        details: error.details,
      });
    }
    next(error);
  }
};

export const getMyOrders = async (req, res, next) => {
  const service = req?.deps?.salesOrderService || salesOrderService;
  try {
    if (!ensureCustomer(req, res)) return;

    const customerId = req.user._id;
    const { page, limit, status, orderStatus } = req.query;

    const result = await service.getMySalesOrders({
      customerId,
      page,
      limit,
      orderStatus: orderStatus || status,
    });

    return res.status(200).json({
      success: true,
      data: result.orders,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const getOrderById = async (req, res, next) => {
  const service = req?.deps?.salesOrderService || salesOrderService;
  try {
    if (!ensureCustomer(req, res)) return;

    const { id } = req.params;
    const order = await service.getSalesOrderById(id, req.user);

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const getBranchOrders = async (req, res, next) => {
  const service = req?.deps?.salesOrderService || salesOrderService;
  try {
    const locationId = req.params.locationId || req.query.locationId;
    const { page, limit, orderStatus, paymentStatus, paymentMethod, search } = req.query;

    const result = await service.getBranchSalesOrders({
      locationId,
      page,
      limit,
      orderStatus,
      paymentStatus,
      paymentMethod,
      search,
    });

    return res.status(200).json({
      success: true,
      data: result.orders,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

export const updateOrderStatus = async (req, res, next) => {
  const service = req?.deps?.salesOrderService || salesOrderService;
  try {
    const { id } = req.params;
    const { orderStatus, note } = req.body;

    const updatedOrder = await service.updateSalesOrderStatus({
      orderId: id,
      orderStatus,
      note,
      user: req.user,
    });

    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái đơn mua thành công',
      data: updatedOrder,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};
