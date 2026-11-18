import express from 'express';
import {
  getProducts,
  getProductById,
  getFilterMeta,
} from '../controllers/masterdata/productController.js';
import { updateProductPricing, getOwnerPricingProducts } from '../controllers/masterdata/pricingController.js';
import { authMiddleware, requireShopOwnerOnly } from '../middlewares/errorMiddleware.js';

const router = express.Router();

router.get('/meta/filters', getFilterMeta);
// Khai báo trước '/:id' để 'owner' không bị hiểu là id sản phẩm (TASK-008).
router.get('/owner/pricing', authMiddleware, requireShopOwnerOnly, getOwnerPricingProducts);
router.get('/', getProducts);
router.get('/:id', getProductById);

router.patch('/:id/pricing', authMiddleware, requireShopOwnerOnly, updateProductPricing);

export default router;

