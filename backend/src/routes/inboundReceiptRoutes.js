import express from 'express';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
import {
  checkReceipt,
  createReceipt,
  decideReceipt,
  getReceipt,
  listReceipts,
  listWarehouseStaff,
  putawayReceiptItems,
} from '../controllers/warehouse/inboundReceiptController.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/staff', requireRoles('warehouse_manager'), listWarehouseStaff);
router.get('/', requireRoles('warehouse_manager', 'warehouse_staff'), listReceipts);
router.post('/', requireRoles('warehouse_manager'), createReceipt);
router.get('/:id', requireRoles('warehouse_manager', 'warehouse_staff'), getReceipt);
router.post('/:id/receive', requireRoles('warehouse_staff'), checkReceipt);
router.post('/:id/approve', requireRoles('warehouse_manager'), decideReceipt);
router.post('/:id/putaway', requireRoles('warehouse_staff'), putawayReceiptItems);
export default router;
