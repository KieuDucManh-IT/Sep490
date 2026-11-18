import express from 'express';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
import { getDiscrepancyRow, listDiscrepancyRows, resolveDiscrepancyRow } from '../controllers/warehouse/stockDiscrepancyController.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/', requireRoles('warehouse_manager', 'branch_manager', 'admin'), listDiscrepancyRows);
router.get('/:id', requireRoles('warehouse_manager', 'branch_manager', 'admin'), getDiscrepancyRow);
router.post('/:id/resolve', requireRoles('warehouse_manager', 'admin'), resolveDiscrepancyRow);

export default router;
