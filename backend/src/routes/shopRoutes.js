import express from 'express';
import {
  getShops,
  getShopById,
  updateShopStatus,
  getShopStats
} from '../controllers/shopController.js';

const router = express.Router();

router.get('/', getShops);
router.get('/status', getShopStats);
router.get('/:id', getShopById);
router.patch('/:id/status', updateShopStatus);

export default router;
