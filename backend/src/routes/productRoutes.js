import express from 'express';
import {
  getProducts,
  getProductById,
  getFilterMeta,
} from '../controllers/productController.js';

const router = express.Router();

router.get('/meta/filters', getFilterMeta);
router.get('/', getProducts);
router.get('/:id', getProductById);

export default router;

