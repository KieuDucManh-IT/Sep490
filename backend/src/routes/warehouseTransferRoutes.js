import express from 'express';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
import {
  createTransferRequestRow,
  decideTransferRequestRow,
  getBranchTransferContextRow,
  getStockTransferRow,
  listStockTransferRows,
  listTransferStaffRows,
  getTransferPickCandidatesRow,
  saveTransferPickRow,
  receiveTransferRow,
  shipTransferRow,
} from '../controllers/warehouse/stockTransferController.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/branch-context', requireRoles('branch_manager'), getBranchTransferContextRow);
router.get('/staff', requireRoles('warehouse_manager'), listTransferStaffRows);
router.get('/', requireRoles('branch_manager', 'warehouse_manager', 'warehouse_staff'), listStockTransferRows);
router.post('/requests', requireRoles('branch_manager'), createTransferRequestRow);
router.get('/:id', requireRoles('branch_manager', 'warehouse_manager', 'warehouse_staff'), getStockTransferRow);
router.get('/:id/pick-candidates', requireRoles('warehouse_staff', 'warehouse_manager'), getTransferPickCandidatesRow);
router.post('/:id/pick', requireRoles('warehouse_staff', 'warehouse_manager'), saveTransferPickRow);
router.post('/:id/decision', requireRoles('warehouse_manager'), decideTransferRequestRow);
router.post('/:id/ship', requireRoles('warehouse_staff', 'warehouse_manager'), shipTransferRow);
router.post('/:id/receive', requireRoles('branch_manager'), receiveTransferRow);

export default router;
