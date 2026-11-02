import express from 'express';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
import {
  applyStockAdjustmentRow,
  approveStocktakeRow,
  countStocktakeRows,
  createStocktakeRow,
  decideStockAdjustmentRow,
  getStockAdjustmentRow,
  getStocktakeRow,
  listStockAdjustmentRows,
  listStocktakeRows,
  listStocktakeStaff,
  startStocktakeRow,
  submitStocktakeRow,
} from '../controllers/warehouse/stockControlController.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/stocktakes/staff', requireRoles('warehouse_manager'), listStocktakeStaff);
router.get('/stocktakes', requireRoles('warehouse_manager', 'warehouse_staff'), listStocktakeRows);
router.post('/stocktakes', requireRoles('warehouse_manager'), createStocktakeRow);
router.get('/stocktakes/:id', requireRoles('warehouse_manager', 'warehouse_staff'), getStocktakeRow);
router.post('/stocktakes/:id/start', requireRoles('warehouse_manager'), startStocktakeRow);
router.post('/stocktakes/:id/counts', requireRoles('warehouse_manager', 'warehouse_staff'), countStocktakeRows);
router.post('/stocktakes/:id/submit', requireRoles('warehouse_manager', 'warehouse_staff'), submitStocktakeRow);
router.post('/stocktakes/:id/approve', requireRoles('warehouse_manager'), approveStocktakeRow);

router.get('/adjustments', requireRoles('warehouse_manager'), listStockAdjustmentRows);
router.get('/adjustments/:id', requireRoles('warehouse_manager'), getStockAdjustmentRow);
router.post('/adjustments/:id/decision', requireRoles('warehouse_manager'), decideStockAdjustmentRow);
router.post('/adjustments/:id/apply', requireRoles('warehouse_manager'), applyStockAdjustmentRow);

export default router;
