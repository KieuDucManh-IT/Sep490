import express from 'express';
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
  ghnWebhookHandler,
} from '../controllers/shipping/shipmentController.js';

const router = express.Router();

// 1. Webhook công khai từ GHN (Không qua auth token đăng nhập)
router.post('/webhook/ghn', ghnWebhookHandler);

// 2. Các API nghiệp vụ nội bộ bảo vệ bởi auth
router.use(authMiddleware);
router.use(requireRoles('branch_manager', 'shop_owner', 'owner', 'admin'));

// Tra cứu địa giới hành chính GHN
router.get('/master-data/provinces', getProvincesHandler);
router.get('/master-data/districts/:provinceId', getDistrictsHandler);
router.get('/master-data/wards/:districtId', getWardsHandler);

// Nghiệp vụ vận đơn
router.post('/calculate-fee', calculateFeeHandler);
router.post('/create-outbound', createOutboundHandler);
router.post('/create-return', createReturnHandler);
router.put('/:id/cancel', cancelShipmentHandler);
router.get('/order/:orderType/:orderId', getShipmentsByOrderHandler);
router.get('/print-token/:trackingCode', getPrintTokenHandler);

export default router;

