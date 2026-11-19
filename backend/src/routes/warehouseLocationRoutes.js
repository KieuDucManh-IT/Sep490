import express from 'express';
import { inventoryLocationController, storageLocationController } from '../controllers/warehouse/locationController.js';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
const router = express.Router();
// Đọc: mọi nhân viên nội bộ; ghi: chỉ quản lý kho (admin luôn được qua requireRoles).
const canRead = requireRoles('warehouse_manager', 'warehouse_staff', 'branch_manager', 'shop_owner', 'owner');
const canWrite = requireRoles('warehouse_manager');
// Tạo / xóa kho (InventoryLocation): chỉ admin (TASK-014 A1). Quản lý kho chỉ sửa kho tổng qua PATCH.
const adminOnly = requireRoles();
router.use(authMiddleware);

router.get('/inventoryLocations/central', canRead, inventoryLocationController.central);
router.get('/inventoryLocations', canRead, inventoryLocationController.list);
router.post('/inventoryLocations', adminOnly, inventoryLocationController.create);
router.patch('/inventoryLocations/:id', canWrite, inventoryLocationController.update);
router.delete('/inventoryLocations/:id', adminOnly, inventoryLocationController.remove);

router.get('/storageLocations', canRead, storageLocationController.list);
router.post('/storageLocations', canWrite, storageLocationController.create);
router.patch('/storageLocations/:id', canWrite, storageLocationController.update);
router.delete('/storageLocations/:id', canWrite, storageLocationController.remove);
export default router;
