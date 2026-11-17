import express from 'express';
import { inventoryLocationController, storageLocationController } from '../controllers/warehouse/locationController.js';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
const router = express.Router();
// Đọc: mọi nhân viên nội bộ; ghi: chỉ quản lý kho (admin luôn được qua requireRoles).
const canRead = requireRoles('warehouse_manager', 'warehouse_staff', 'branch_manager', 'shop_owner', 'owner');
const canWrite = requireRoles('warehouse_manager');
router.use(authMiddleware);
const bindCrud = (path, controller) => {
  router.get(`/${path}`, canRead, controller.list);
  router.post(`/${path}`, canWrite, controller.create);
  router.patch(`/${path}/:id`, canWrite, controller.update);
  router.delete(`/${path}/:id`, canWrite, controller.remove);
};
bindCrud('inventoryLocations', inventoryLocationController);
bindCrud('storageLocations', storageLocationController);
export default router;
