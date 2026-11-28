import express from 'express';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
import {
  countDiscrepancyRows, getDiscrepancyRow, listDiscrepancyRows, resolveDiscrepancyRow,
} from '../controllers/warehouse/stockDiscrepancyController.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/', requireRoles('warehouse_manager', 'branch_manager', 'admin'), listDiscrepancyRows);
// Đặt trước '/:id' để "count" không bị hiểu là id phiếu.
router.get('/count', requireRoles('warehouse_manager', 'branch_manager', 'admin'), countDiscrepancyRows);
router.get('/:id', requireRoles('warehouse_manager', 'branch_manager', 'admin'), getDiscrepancyRow);
router.post('/:id/resolve', requireRoles('warehouse_manager', 'admin'), resolveDiscrepancyRow);

export default router;
