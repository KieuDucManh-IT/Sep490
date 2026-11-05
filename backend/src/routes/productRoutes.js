import express from 'express';
import {
  getProducts,
  getProductById,
  getFilterMeta,
} from '../controllers/masterdata/productController.js';
import { updateProductPricing } from '../controllers/masterdata/pricingController.js';
import { authMiddleware, requireShopOwnerOnly } from '../middlewares/errorMiddleware.js';

const router = express.Router();

router.get('/meta/filters', getFilterMeta);
router.get('/', getProducts);
router.get('/:id', getProductById);

router.patch('/:id/pricing', authMiddleware, requireShopOwnerOnly, updateProductPricing);

export default router;

