import express from 'express';
import { inventoryReport, inventoryReportDetails } from '../controllers/warehouse/inventoryReportController.js';
import { branchInventoryReport, branchInventoryReportDetails } from '../controllers/warehouse/branchInventoryReportController.js';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/inventory/details', requireRoles('warehouse_manager', 'warehouse_staff'), inventoryReportDetails);
router.get('/inventory', requireRoles('warehouse_manager', 'warehouse_staff'), inventoryReport);
router.get('/branch/inventory/details', requireRoles('branch_manager'), branchInventoryReportDetails);
router.get('/branch/inventory', requireRoles('branch_manager'), branchInventoryReport);

export default router;
