import express from 'express';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
import {
  createTransferRequestRow,
  decideTransferRequestRow,
  getBranchTransferContextRow,
  getStockTransferRow,
  listStockTransferRows,
  receiveTransferRow,
  shipTransferRow,
} from '../controllers/warehouse/stockTransferController.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/branch-context', requireRoles('branch_manager'), getBranchTransferContextRow);
router.get('/', requireRoles('branch_manager', 'warehouse_manager'), listStockTransferRows);
router.post('/requests', requireRoles('branch_manager'), createTransferRequestRow);
router.get('/:id', requireRoles('branch_manager', 'warehouse_manager'), getStockTransferRow);
router.post('/:id/decision', requireRoles('warehouse_manager'), decideTransferRequestRow);
router.post('/:id/ship', requireRoles('warehouse_manager'), shipTransferRow);
router.post('/:id/receive', requireRoles('branch_manager'), receiveTransferRow);

export default router;
