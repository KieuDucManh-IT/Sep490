import express from 'express';
import {
  applyShop,
  getShopApplications,
  approveShop,
  rejectShop,
  toggleSuspendShop,
  getShopStats,
  getShopById,
  getMyShop,
  updateShopAddress,
  updateShopInfo,
  reverseGeocodeAddress,
} from '../controllers/shopController.js';

const router = express.Router();

router.get('/stats', getShopStats);
router.get('/my-shop', getMyShop);
router.get('/reverse-geocode', reverseGeocodeAddress);
router.post('/apply', applyShop);
router.get('/', getShopApplications);
router.get('/:id', getShopById);
router.put('/:id/address', updateShopAddress);
router.put('/:id/info', updateShopInfo);
router.put('/:id', updateShopInfo);
router.put('/:id/approve', approveShop);
router.put('/:id/reject', rejectShop);
router.put('/:id/toggle-suspend', toggleSuspendShop);

export default router;

