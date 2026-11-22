/**
 * Rental Order Controller
 * Tiếp nhận HTTP requests, validate quyền truy cập và điều phối Service
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-001..REQ-RENT-020
 */

import * as rentalOrderService from '../../services/sale&rental/rentalOrderService.js';

const normalizedRole = (user) => String(user?.role || user?.Role || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]/g, '');

const ensureCustomer = (req, res) => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Bạn cần đăng nhập để xem lịch sử đơn thuê',
    });
    return false;
  }

  if (normalizedRole(req.user) !== 'customer') {
    res.status(403).json({
      success: false,
      message: 'Lịch sử đơn thuê chỉ dành cho khách hàng',
    });
    return false;
  }

  return true;
};

export const createOrder = async (req, res, next) => {
  const service = req?.deps?.rentalOrderService || rentalOrderService;
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Bạn cần đăng nhập để đặt thuê trang phục',
      });
    }

    const customerId = req.user._id;
    const {
      locationId,
      startDate,
      dueDate,
      items,
      note,
      paymentMethod = 'wallet',
      shippingAddress,
      expectedTotalAmount,
    } = req.body;

    const result = await service.createRentalOrder({
      customerId,
      createdBy: customerId,
      locationId,
      startDate,
      dueDate,
      items,
      note,
      paymentMethod,
      shippingAddress,
      expectedTotalAmount,
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo đơn thuê trang phục thành công',
      data: result.order,
      details: result.details,
      pricing: result.pricing,
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

export const getOrderById = async (req, res, next) => {
  const service = req?.deps?.rentalOrderService || rentalOrderService;
  try {
    if (!ensureCustomer(req, res)) return;

    const { id } = req.params;
    const order = await service.getRentalOrderById(id);

    // Nếu là khách hàng thường, chỉ được xem đơn của chính mình
    const userRole = (req.user?.role || req.user?.Role || '').toLowerCase();
    if (
      userRole === 'customer' &&
      String(order.customerId?._id || order.customerId) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem thông tin đơn thuê này',
      });
    }

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

export const listOrders = async (req, res, next) => {
  const service = req?.deps?.rentalOrderService || rentalOrderService;
  try {
    if (!ensureCustomer(req, res)) return;

    const { page, limit, status, rentalStatus } = req.query;

    const selectedStatus = rentalStatus || status;
    const result = await service.listRentalOrders({
      customerId: req.user._id,
      rentalStatus: selectedStatus && selectedStatus !== 'ALL' ? selectedStatus : undefined,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
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

export const assignItems = async (req, res, next) => {
  const service = req?.deps?.rentalOrderService || rentalOrderService;
  try {
    const { id } = req.params;
    const { assignments } = req.body;

    const result = await service.assignPhysicalItems({
      rentalOrderId: id,
      assignments,
      operatorId: req.user?._id,
    });

    return res.status(200).json({
      success: true,
      message: 'Gán mã vạch hiện vật kho thành công',
      data: result,
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

export const handoverOrder = async (req, res, next) => {
  const service = req?.deps?.rentalOrderService || rentalOrderService;
  try {
    const { id } = req.params;
    const { note } = req.body;

    const result = await service.handoverRentalOrder({
      rentalOrderId: id,
      operatorId: req.user?._id,
      note,
    });

    return res.status(200).json({
      success: true,
      message: 'Xác nhận bàn giao trang phục cho khách thành công',
      data: result.order,
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

export const cancelOrder = async (req, res, next) => {
  const service = req?.deps?.rentalOrderService || rentalOrderService;
  try {
    if (!req.user?._id) {
      return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để hủy đơn thuê' });
    }
    const { id } = req.params;
    const { cancelReason } = req.body || {};

    const result = await service.cancelRentalOrder({
      rentalOrderId: id,
      userId: req.user?._id,
      cancelReason,
    });

    return res.status(200).json({
      success: true,
      message: 'Hủy đơn thuê thành công',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }
    next(error);
  }
};
