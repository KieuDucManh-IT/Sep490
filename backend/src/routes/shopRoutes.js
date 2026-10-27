import express from 'express';
import {
  getShopApplications,
  toggleSuspendShop,
  updateShopOperatingStatus,
  getShopStats,
  getShopById,
  getMyShop,
  updateShopAddress,
  updateShopInfo,
  reverseGeocodeAddress,
  createBranch,
  deleteBranch,
  getBranchManagers,
} from '../controllers/shopController.js';

const router = express.Router();

router.get('/stats', getShopStats);
router.get('/my-shop', getMyShop);
router.get('/managers', getBranchManagers);
router.get('/reverse-geocode', reverseGeocodeAddress);
router.get('/', getShopApplications);
router.post('/', createBranch);
router.get('/:id', getShopById);
router.put('/:id/address', updateShopAddress);
router.put('/:id/info', updateShopInfo);
router.put('/:id', updateShopInfo);
router.delete('/:id', deleteBranch);
router.put('/:id/toggle-suspend', toggleSuspendShop);
router.put('/:id/operating-status', updateShopOperatingStatus);

export default router;

