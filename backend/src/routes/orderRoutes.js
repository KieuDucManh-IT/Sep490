import express from 'express';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
import {
  getRentalOrdersHandler,
  getRentalOrderByIdHandler,
  getSalesOrdersHandler,
  getSalesOrderByIdHandler,
  getOrderMetricsHandler,
} from '../controllers/order/orderMonitoringController.js';

const router = express.Router();

// Tất cả endpoints đều yêu cầu đăng nhập và thuộc các role được phép giám sát
router.use(authMiddleware);
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

