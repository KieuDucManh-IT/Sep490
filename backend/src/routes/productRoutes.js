import express from 'express';
import {
  createShopProduct,
  deleteShopProduct,
  getShopProduct,
  listShopProducts,
  updateShopProduct
} from '../controllers/productController.js';
import {
  createProductVariantForProduct,
  deleteProductVariantForProduct,
  getProductVariant,
  listProductVariants,
  updateProductVariantForProduct
} from '../controllers/productVariantController.js';

const router = express.Router();

//duc 2026-10-15: Expose product CRUD endpoints for the shop product management screen.
router.get('/', listShopProducts);
router.post('/', createShopProduct);
//duc 2026-10-15: Đặt variant dưới product để mọi thao tác đều gắn với product cha.
router.get('/:productId/variants', listProductVariants);
router.post('/:productId/variants', createProductVariantForProduct);
router.get('/:productId/variants/:variantId', getProductVariant);
router.patch('/:productId/variants/:variantId', updateProductVariantForProduct);
router.delete('/:productId/variants/:variantId', deleteProductVariantForProduct);
router.get('/:id', getShopProduct);
router.patch('/:id', updateShopProduct);
router.delete('/:id', deleteShopProduct);

export default router;
