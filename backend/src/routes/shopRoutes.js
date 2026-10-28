import express from 'express';
import multer from 'multer';
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
  uploadShopImage,
} from '../controllers/shopController.js';
import { authMiddleware, requireRole } from '../middlewares/errorMiddleware.js';

const router = express.Router();

const shopUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter(req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Chỉ chấp nhận file ảnh định dạng JPG, PNG hoặc WEBP'));
    }
    cb(null, true);
  },
});

router.post(
  '/upload-image',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner', 'branch_manager'),
  shopUpload.single('file'),
  uploadShopImage
);

router.get(
  '/managers',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner', 'operation_staff'),
  getBranchManagers
);

router.get('/stats', getShopStats);
router.get('/my-shop', getMyShop);
router.get('/reverse-geocode', reverseGeocodeAddress);
router.get('/', getShopApplications);
router.get('/:id', getShopById);
router.post(
  '/',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner'),
  createBranch
);
router.put(
  '/:id/address',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner', 'branch_manager'),
  updateShopAddress
);
router.put(
  '/:id/info',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner', 'branch_manager'),
  updateShopInfo
);
router.put(
  '/:id',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner', 'branch_manager'),
  updateShopInfo
);
router.delete(
  '/:id',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner'),
  deleteBranch
);
router.put(
  '/:id/toggle-suspend',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner', 'operation_staff'),
  toggleSuspendShop
);
router.put(
  '/:id/operating-status',
  authMiddleware,
  requireRole('admin', 'operation_staff'),
  updateShopOperatingStatus
);

export default router;

