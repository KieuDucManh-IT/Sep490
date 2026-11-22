/**
 * Sales Order Routes
 * Quản lý vòng đời đơn mua trang phục (thanh lý / bán đứt)
 */

import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/errorMiddleware.js';
import * as salesOrderController from '../controllers/sale&rental/salesOrderController.js';
import * as salesReturnController from '../controllers/sale&rental/salesReturnController.js';

const router = express.Router();

// Tất cả endpoints đơn mua đều yêu cầu đăng nhập
router.use(authMiddleware);

// 1. Tạo đơn mua mới (Khách hàng)
router.post('/', salesOrderController.createOrder);

// 2. Danh sách đơn mua của chính khách hàng
router.get('/my-orders', salesOrderController.getMyOrders);

// 3. Danh sách đơn mua tại chi nhánh (Nhân viên chi nhánh / Staff / Admin)
router.get(
  '/branch/:locationId',
  requireRole('branchstaff', 'branchmanager', 'warehouse_staff', 'staff', 'admin'),
  salesOrderController.getBranchOrders
);

// TASK-015: trả hàng bán theo món (quản lý chi nhánh của đơn / admin; service kiểm chi nhánh).
router.get('/:id/returns', requireRole('branchmanager', 'admin'), salesReturnController.listReturns);
router.get('/:id/returnable-items', requireRole('branchmanager', 'admin'), salesReturnController.getReturnableItems);
router.post('/:id/returns', requireRole('branchmanager', 'admin'), salesReturnController.createReturn);

// 4. Chi tiết đơn mua theo ID
router.get('/:id', salesOrderController.getOrderById);

// 5. Cập nhật trạng thái đơn mua (Nhân viên chi nhánh / Staff / Admin)
router.patch(
  '/:id/status',
  requireRole('branchstaff', 'branchmanager', 'warehouse_staff', 'staff', 'admin'),
  salesOrderController.updateOrderStatus
);

export default router;
