/**
 * Rental Dispute Routes
 * Khiếu nại lỗi sản xuất & Đổi trả 24h theo chuẩn Min.de / Vestora
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-009..REQ-RENT-012
 */

import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/errorMiddleware.js';
import * as rentalDisputeController from '../controllers/sale&rental/rentalDisputeController.js';

const router = express.Router();

router.use(authMiddleware);

// 1. Khách hàng gửi yêu cầu đổi trả (trong vòng 24h kể từ khi nhận hàng)
router.post('/orders/:id/claim', rentalDisputeController.createClaim);

// 2. CSKH phản hồi tiếp nhận/từ chối (SLA 72h)
router.put(
  '/:id/respond',
  requireRole('cskh', 'admin', 'branchmanager', 'staff'),
  rentalDisputeController.respondClaim
);

// 3. Nhân viên showroom/kho xác nhận đã nhận hàng hoàn về (Hạn chót 10 ngày)
router.post(
  '/:id/confirm-received',
  requireRole('warehouse_staff', 'branchstaff', 'branchmanager', 'cskh', 'staff', 'admin'),
  rentalDisputeController.confirmReceived
);

// 4. Kiểm duyệt KCS hàng trả về & hoàn tiền/tích điểm
router.post(
  '/:id/kcs',
  requireRole('cskh', 'warehouse_staff', 'branchmanager', 'admin'),
  rentalDisputeController.completeKCS
);

// 5. Chi tiết phiếu khiếu nại
router.get('/:id', rentalDisputeController.getDisputeById);

export default router;
