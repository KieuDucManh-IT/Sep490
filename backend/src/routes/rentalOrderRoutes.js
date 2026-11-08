/**
 * Rental Order Routes
 * Quản lý vòng đời đơn thuê trang phục
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-001..REQ-RENT-008
 */

import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/errorMiddleware.js';
import * as rentalOrderController from '../controllers/sale&rental/rentalOrderController.js';

const router = express.Router();

// Tất cả endpoints đơn thuê đều yêu cầu đăng nhập
router.use(authMiddleware);

// 1. Tạo đơn thuê mới (Khách hàng)
router.post('/', rentalOrderController.createOrder);

// 2. Danh sách đơn thuê (Khách hàng xem đơn của mình, Nhân viên/Admin xem theo chi nhánh hoặc toàn bộ)
router.get('/', rentalOrderController.listOrders);

// 3. Chi tiết đơn thuê
router.get('/:id', rentalOrderController.getOrderById);

// 4. Gán mã vạch hiện vật kho (Nhân viên showroom/kho)
router.post(
  '/:id/assign-items',
  requireRole('branchstaff', 'branchmanager', 'warehouse_staff', 'staff', 'admin'),
  rentalOrderController.assignItems
);

// 5. Bàn giao trang phục cho khách (Nhân viên showroom/kho)
router.post(
  '/:id/handover',
  requireRole('branchstaff', 'branchmanager', 'warehouse_staff', 'staff', 'admin'),
  rentalOrderController.handoverOrder
);

// 6. Hủy đơn thuê (Khách hàng hoặc Shop)
router.post('/:id/cancel', rentalOrderController.cancelOrder);

export default router;
