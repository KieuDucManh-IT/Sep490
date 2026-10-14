import express from 'express';
import {
  applyShop,
  getShopApplications,
  getShopById,
  approveShop,
  rejectShop,
  toggleSuspendShop,
} from '../controllers/shopController.js';

const router = express.Router();

router.post('/apply', applyShop);
router.get('/', getShopApplications);
router.get('/:id', getShopById);
router.put('/:id/approve', approveShop);
router.put('/:id/reject', rejectShop);
router.put('/:id/toggle-suspend', toggleSuspendShop);

export default router;
