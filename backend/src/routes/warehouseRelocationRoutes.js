import express from 'express';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
import {
  cancelStockRelocationRow, completeStockRelocationRow, createStockRelocationRow,
  getStockRelocationRow, listStockRelocationRows, listStockRelocationStaffRows, startStockRelocationRow,
} from '../controllers/warehouse/stockRelocationController.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/', requireRoles('warehouse_manager', 'warehouse_staff', 'admin'), listStockRelocationRows);
router.get('/staff', requireRoles('warehouse_manager', 'admin'), listStockRelocationStaffRows);
router.post('/', requireRoles('warehouse_manager', 'admin'), createStockRelocationRow);
router.get('/:id', requireRoles('warehouse_manager', 'warehouse_staff', 'admin'), getStockRelocationRow);
router.post('/:id/start', requireRoles('warehouse_staff', 'admin'), startStockRelocationRow);
router.post('/:id/complete', requireRoles('warehouse_staff', 'admin'), completeStockRelocationRow);
router.post('/:id/cancel', requireRoles('warehouse_manager', 'admin'), cancelStockRelocationRow);
export default router;
