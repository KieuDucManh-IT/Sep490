import express from 'express';
import { categoryController } from '../controllers/masterdata/categoryController.js';
import { productController } from '../controllers/masterdata/productController.js';
import { productVariantController } from '../controllers/masterdata/productVariantController.js';
import { supplierController } from '../controllers/masterdata/supplierController.js';
const router = express.Router();
const bindCrud = (path, controller) => {
  router.get(`/${path}`, controller.list);
  router.post(`/${path}`, controller.create);
  router.patch(`/${path}/:id`, controller.update);
  router.delete(`/${path}/:id`, controller.remove);
};
bindCrud('categories', categoryController);
bindCrud('products', productController);
bindCrud('variants', productVariantController);
bindCrud('suppliers', supplierController);
export default router;
