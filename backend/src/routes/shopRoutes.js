import express from 'express';
import multer from 'multer';
import {
  getShopApplications,
  toggleSuspendShop,
  updateShopOperatingStatus,
  getShopStats,
  getShopById,
  getMyShop,
  getAssignedBranch,
  updateShopAddress,
  updateShopInfo,
  reverseGeocodeAddress,
  createBranch,
  deleteBranch,
  getBranchManagers,
  uploadShopImage,
  getBranchPerformanceReport,
} from '../controllers/shop/shopController.js';
import {
  getMyPolicy,
  createPolicy,
  updateMyPolicy,
  updatePolicyByKey,
  deletePolicy,
  getPublicPolicies,
} from '../controllers/shop/businessPolicyController.js';
import { authMiddleware, requireRole } from '../middlewares/errorMiddleware.js';
import { Shop } from '../models/shop/Shop.js';

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
  async (req, res, next) => {
    const userRole = String(req.user?.Role || req.user?.role || '').trim().toLowerCase().replace(/[\s_-]/g, '');
    if (['admin', 'shopowner', 'owner', 'branchmanager', 'brandmanager'].includes(userRole)) {
      return next();
    }
    try {
      const isAssigned = await Shop.exists({
        managerId: req.user._id,
        isDeleted: { $ne: true },
      });
      if (isAssigned) {
        return next();
      }
    } catch {
    }
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền thực hiện thao tác này',
    });
  },
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
router.get(
  '/assigned-branch',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner', 'branch_manager'),
  getAssignedBranch
);
router.get(
  '/reports/branch-performance',
  authMiddleware,
  requireRole('branch_manager', 'admin'),
  getBranchPerformanceReport
);
router.get('/reverse-geocode', reverseGeocodeAddress);

// ==========================================
// BUSINESS POLICIES (Chain Management)
// ==========================================
router.get(
  '/policies/my-policy',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner'),
  getMyPolicy
);
router.post(
  '/policies',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner'),
  createPolicy
);
router.put(
  '/policies/my-policy',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner'),
  updateMyPolicy
);
router.put(
  '/policies/:key',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner'),
  updatePolicyByKey
);
router.delete(
  '/policies/:key',
  authMiddleware,
  requireRole('admin', 'shop_owner', 'owner'),
  deletePolicy
);
router.get('/policies/public', getPublicPolicies);

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

