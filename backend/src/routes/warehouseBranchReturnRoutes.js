import express from 'express';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
import {
  createBranchReturnRow,
  cancelBranchReturnRow,
  decideBranchReturnReceiptRow,
  decideBranchReturnRow,
  dispatchBranchReturnRow,
  getBranchReturnRow,
  listBranchReturnRows,
  listBranchReturnStaffRows,
  putawayBranchReturnRow,
  submitBranchReturnReceiptRow,
} from '../controllers/warehouse/branchReturnController.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/', requireRoles('branch_manager', 'warehouse_manager', 'warehouse_staff', 'admin'), listBranchReturnRows);
router.get('/staff', requireRoles('warehouse_manager', 'admin'), listBranchReturnStaffRows);
router.post('/', requireRoles('branch_manager'), createBranchReturnRow);
router.get('/:id', requireRoles('branch_manager', 'warehouse_manager', 'warehouse_staff', 'admin'), getBranchReturnRow);
router.post('/:id/decision', requireRoles('warehouse_manager', 'admin'), decideBranchReturnRow);
router.post('/:id/dispatch', requireRoles('branch_manager'), dispatchBranchReturnRow);
router.post('/:id/cancel', requireRoles('branch_manager'), cancelBranchReturnRow);
router.post('/:id/receive', requireRoles('warehouse_staff', 'warehouse_manager', 'admin'), submitBranchReturnReceiptRow);
router.post('/:id/receipt-decision', requireRoles('warehouse_manager', 'admin'), decideBranchReturnReceiptRow);
router.post('/:id/putaway', requireRoles('warehouse_staff', 'warehouse_manager', 'admin'), putawayBranchReturnRow);
export default router;
