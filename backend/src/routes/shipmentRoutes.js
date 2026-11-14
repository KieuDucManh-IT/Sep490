import express from 'express';
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
  getDistrictsHandler,
  getWardsHandler,
  getWardsByProvinceHandler,
  ghnWebhookHandler,
  updateManualStatusHandler,
  simulateGhnHandler,
  uploadProofHandler,
} from '../controllers/shipping/shipmentController.js';

const router = express.Router();

const proofUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// 1. Webhook tiếp nhận sự kiện từ GHN (bảo vệ bởi secret token URL / query / header)
router.post('/webhook/ghn/:secretKey', ghnWebhookHandler);
router.post('/webhook/ghn', ghnWebhookHandler);

// 2. Các API nghiệp vụ nội bộ bảo vệ bởi auth
router.use(authMiddleware);
router.use(requireRoles('branch_manager', 'shop_owner', 'owner', 'admin'));

// Tra cứu địa giới hành chính GHN
router.get('/master-data/provinces', getProvincesHandler);
router.get('/master-data/districts/:provinceId', getDistrictsHandler);
router.get('/master-data/wards/:districtId', getWardsHandler);
router.get('/master-data/wards-by-province/:provinceId', getWardsByProvinceHandler);

// Nghiệp vụ vận đơn
router.post('/calculate-fee', calculateFeeHandler);
router.post('/create-outbound', createOutboundHandler);
router.post('/create-return', createReturnHandler);
router.put('/:id/cancel', cancelShipmentHandler);
router.put('/:id/manual-status', updateManualStatusHandler);
router.post('/dev/simulate-ghn', simulateGhnHandler);
router.get('/order/:orderType/:orderId', getShipmentsByOrderHandler);
router.get('/print-token/:trackingCode', getPrintTokenHandler);

router.post('/upload-proof', proofUpload.single('image'), uploadProofHandler);

export default router;

