// TASK-014 G: chỉ đọc — lịch sử một mã hàng và sức chứa kho tổng.
// Gắn middleware theo từng route (không router.use) vì router được mount chung tiền tố '/warehouse'.
import express from 'express';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
import { centralCapacity, itemHistory } from '../controllers/warehouse/inventoryInsightController.js';

const router = express.Router();
const warehouseRoles = requireRoles('warehouse_manager', 'warehouse_staff');
router.get('/items/:id/history', authMiddleware, warehouseRoles, itemHistory);
router.get('/capacity', authMiddleware, warehouseRoles, centralCapacity);
export default router;
