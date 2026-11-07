import express from 'express';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
import {
  getRentalOrdersHandler,
  getRentalOrderByIdHandler,
  getSalesOrdersHandler,
  getSalesOrderByIdHandler,
  getOrderMetricsHandler,
  getCustomerRentalOrdersHandler,
  getCustomerSalesOrdersHandler,
  createCustomerRentalOrderHandler,
} from '../controllers/order/orderMonitoringController.js';

const router = express.Router();

router.use(authMiddleware);

// Endpoints dành cho Khách hàng
router.get('/my-rentals', getCustomerRentalOrdersHandler);
router.get('/my-sales', getCustomerSalesOrdersHandler);
router.post('/checkout', createCustomerRentalOrderHandler);

// Tất cả endpoints dưới đây yêu cầu role giám sát
router.use(requireRoles('branch_manager', 'shop_owner', 'owner', 'admin'));

// Giám sát Đơn Thuê
router.get('/rentals', getRentalOrdersHandler);
router.get('/rentals/:id', getRentalOrderByIdHandler);

// Giám sát Đơn Bán
router.get('/sales', getSalesOrdersHandler);
router.get('/sales/:id', getSalesOrderByIdHandler);

// Thống kê Metrics & KPIs
router.get('/metrics', getOrderMetricsHandler);

export default router;

