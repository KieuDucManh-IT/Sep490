import express from 'express';
import shopRoutes from './shopRoutes.js';
import userRoutes from './userRoutes.js';
import adminRoutes from './adminRoutes.js';
import masterdataRoutes from './masterdataRoutes.js';
import warehouseLocationRoutes from './warehouseLocationRoutes.js';
import productRoutes from './productRoutes.js';

import inboundReceiptRoutes from './inboundReceiptRoutes.js';
import warehouseReportRoutes from './warehouseReportRoutes.js';
import warehouseStocktakeRoutes from './warehouseStocktakeRoutes.js';
import warehouseAdjustmentRoutes from './warehouseAdjustmentRoutes.js';
import warehouseTransferRoutes from './warehouseTransferRoutes.js';
import warehouseBranchReturnRoutes from './warehouseBranchReturnRoutes.js';
import warehouseRelocationRoutes from './warehouseRelocationRoutes.js';
import orderRoutes from './orderRoutes.js';
import shipmentRoutes from './shipmentRoutes.js';
import { trackPublicShipmentHandler } from '../controllers/shipping/publicShippingController.js';
import rateLimit from 'express-rate-limit';

import rentalOrderRoutes from './rentalOrderRoutes.js';
import rentalReturnRoutes from './rentalReturnRoutes.js';
import rentalDisputeRoutes from './rentalDisputeRoutes.js';
import salesOrderRoutes from './salesOrderRoutes.js';
const router = express.Router();

const publicTrackingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 60, // Tối đa 60 lượt tra cứu / IP / 15 phút
  message: {
    success: false,
    message: 'Quá nhiều yêu cầu tra cứu từ mạng của bạn. Vui lòng thử lại sau 15 phút.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'VESTORA Haute Couture & Rental Luxury Backend Service',
    timestamp: new Date().toISOString(),
    database: 'MongoDB Atlas Connected',
    paymentProvider: 'PayOS Payment Gateway Active',
  });
});

router.use('/products', productRoutes);
router.use('/shops', shopRoutes);
router.use('/admin/shops', shopRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/warehouse/masterdata', masterdataRoutes);
router.use('/warehouse/locations', warehouseLocationRoutes);
router.use('/warehouse/inbound-receipts', inboundReceiptRoutes);
router.use('/warehouse/reports', warehouseReportRoutes);
router.use('/warehouse/stocktakes', warehouseStocktakeRoutes);
router.use('/warehouse/adjustments', warehouseAdjustmentRoutes);
router.use('/warehouse/transfers', warehouseTransferRoutes);
router.use('/warehouse/returns', warehouseBranchReturnRoutes);
router.use('/warehouse/relocations', warehouseRelocationRoutes);
router.use('/orders', orderRoutes);
router.use('/shipping', shipmentRoutes);
router.get('/public/shipping/track/:trackingCode', publicTrackingLimiter, trackPublicShipmentHandler);
router.use('/rental-orders', rentalOrderRoutes);
router.use('/rental-returns', rentalReturnRoutes);
router.use('/rental-disputes', rentalDisputeRoutes);
router.use('/sales-orders', salesOrderRoutes);
export default router;
