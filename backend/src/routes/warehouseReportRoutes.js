import express from 'express';
import { inventoryReport, inventoryReportDetails } from '../controllers/warehouse/inventoryReportController.js';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/inventory/details', requireRoles('warehouse_manager'), inventoryReportDetails);
router.get('/inventory', requireRoles('warehouse_manager'), inventoryReport);

export default router;
