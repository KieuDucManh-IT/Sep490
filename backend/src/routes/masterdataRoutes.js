import express from 'express';
import { categoryController } from '../controllers/masterdata/categoryController.js';
import { productController } from '../controllers/masterdata/productController.js';
import { productVariantController } from '../controllers/masterdata/productVariantController.js';
import { supplierController } from '../controllers/masterdata/supplierController.js';
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
bindCrud('categories', categoryController);
bindCrud('products', productController);
bindCrud('variants', productVariantController);
bindCrud('suppliers', supplierController);
export default router;
