/**
 * Rental Return Routes
 * Nghiệm thu trả đồ & Quyết toán hoàn cọc
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-013..REQ-RENT-017
 */

import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/errorMiddleware.js';
import * as rentalReturnController from '../controllers/sale&rental/rentalReturnController.js';

const router = express.Router();

router.use(authMiddleware);

// 1. Nghiệm thu trả đồ & quyết toán cọc (Nhân viên showroom/kho)
router.post(
  '/orders/:id/return',
  requireRole('branchstaff', 'branchmanager', 'warehouse_staff', 'staff', 'admin'),
  rentalReturnController.createReturn
);

// 2. Chi tiết biên bản trả đồ
router.get('/:id', rentalReturnController.getReturnById);

export default router;
