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
  getWardsByProvinceHandler,
  ghnWebhookHandler,
} from '../controllers/shipping/shipmentController.js';

const router = express.Router();

// 1. Webhook tiếp nhận sự kiện từ GHN (bảo vệ bởi secret token URL / query / header)
router.post('/webhook/ghn/:secretKey', ghnWebhookHandler);
router.post('/webhook/ghn', ghnWebhookHandler);

// 2. Tra cứu địa giới hành chính GHN (công khai / khách hàng checkout tra cứu danh mục)
router.get('/master-data/provinces', getProvincesHandler);
router.get('/master-data/districts/:provinceId', getDistrictsHandler);
router.get('/master-data/wards/:districtId', getWardsHandler);
router.get('/master-data/wards-by-province/:provinceId', getWardsByProvinceHandler);

// 3. Các API nghiệp vụ nội bộ bảo vệ bởi auth & role nhân viên / quản lý
router.use(authMiddleware);
router.use(requireRoles('branch_manager', 'shop_owner', 'owner', 'admin'));

// Nghiệp vụ vận đơn
router.post('/calculate-fee', calculateFeeHandler);
router.post('/create-outbound', createOutboundHandler);
router.post('/create-return', createReturnHandler);
router.put('/:id/cancel', cancelShipmentHandler);
router.get('/order/:orderType/:orderId', getShipmentsByOrderHandler);
router.get('/print-token/:trackingCode', getPrintTokenHandler);

export default router;

