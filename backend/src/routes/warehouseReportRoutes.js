import express from 'express';
import { inventoryReport, inventoryReportDetails } from '../controllers/warehouse/inventoryReportController.js';
import { branchAvailability, branchInventoryReport, branchInventoryReportDetails } from '../controllers/warehouse/branchInventoryReportController.js';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/inventory/details', requireRoles('warehouse_manager', 'warehouse_staff'), inventoryReportDetails);
router.get('/inventory', requireRoles('warehouse_manager', 'warehouse_staff'), inventoryReport);
router.get('/branch/inventory/details', requireRoles('branch_manager'), branchInventoryReportDetails);
router.get('/branch/inventory', requireRoles('branch_manager'), branchInventoryReport);
// Khả dụng nhiều biến thể tại chi nhánh (cột tồn của form chọn nhiều biến thể, TASK-014 B).
router.get('/branch/availability', requireRoles('branch_manager'), branchAvailability);

export default router;
