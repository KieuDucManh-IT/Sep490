import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { authMiddleware, requireRoles } from '../middlewares/errorMiddleware.js';
import {
  calculateFeeHandler,
  createOutboundHandler,
  createReturnHandler,
  cancelShipmentHandler,
  getShipmentsByOrderHandler,
  getPrintTokenHandler,
  getProvincesHandler,
  getNewProvincesHandler,
  getDistrictsHandler,
  getWardsHandler,
  getNewWardsHandler,
  getWardsByProvinceHandler,
  ghnWebhookHandler,
  updateManualStatusHandler,
  simulateGhnHandler,
  uploadProofHandler,
  trackShipmentHandler,
} from '../controllers/shipping/shipmentController.js';

const router = express.Router();

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// 1. Webhook tiếp nhận sự kiện từ GHN (bảo vệ bởi secret token URL / query / header)
router.post('/webhook/ghn/:secretKey', ghnWebhookHandler);
router.post('/webhook/ghn', ghnWebhookHandler);

const masterDataLimiter = rateLimit({
  windowMs: 60000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu tra cứu địa giới hành chính. Vui lòng thử lại sau ít phút.',
  },
});

// 2. Tra cứu địa giới hành chính GHN (công khai / phục vụ khách hàng checkout tra cứu địa chỉ)
router.use('/master-data', masterDataLimiter);
router.get('/master-data/provinces', getProvincesHandler);
router.get('/master-data/provinces-new', getNewProvincesHandler);
router.get('/master-data/districts/:provinceId', getDistrictsHandler);
router.get('/master-data/wards/:districtId', getWardsHandler);
router.get('/master-data/wards-new/:provinceId', getNewWardsHandler);
router.get('/master-data/wards-by-province/:provinceId', getWardsByProvinceHandler);

// 3. Tra cứu tiến trình vận chuyển cho người dùng đã xác thực (Customer chính chủ hoặc Quản lý)
router.get('/track/:trackingCode', authMiddleware, trackShipmentHandler);

// 4. API tạo vận đơn thu hồi đồ thuê qua GHN (Khách hàng tự trả đồ hoặc Branch Manager thu hồi hộ)
router.post(
  '/create-return',
  authMiddleware,
  requireRoles('customer', 'branch_manager'),
  createReturnHandler
);

// 5. Các API nghiệp vụ nội bộ bảo vệ bởi auth & role nhân viên / quản lý
router.use(authMiddleware);

// Xem danh sách vận đơn theo đơn hàng & lấy token in (chỉ đọc)
router.get(
  '/order/:orderType/:orderId',
  requireRoles('branch_manager', 'shop_owner', 'owner', 'admin'),
  getShipmentsByOrderHandler
);
router.get(
  '/print-token/:trackingCode',
  requireRoles('branch_manager', 'shop_owner', 'owner', 'admin'),
  getPrintTokenHandler
);

// Giả lập GHN sandbox & toàn bộ nghiệp vụ thao tác vận đơn: CHỈ CHO PHÉP Branch Manager
router.use(requireRoles('branch_manager'));

router.post('/dev/simulate-ghn', simulateGhnHandler);
router.post('/calculate-fee', calculateFeeHandler);
router.post('/create-outbound', createOutboundHandler);
router.put('/:id/cancel', cancelShipmentHandler);
router.put('/:id/manual-status', updateManualStatusHandler);
router.post('/upload-proof', proofUpload.single('image'), uploadProofHandler);

export default router;

