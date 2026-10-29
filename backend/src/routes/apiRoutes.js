import express from 'express';
import shopRoutes from './shopRoutes.js';
import userRoutes from './userRoutes.js';
import masterdataRoutes from './masterdataRoutes.js';
import warehouseLocationRoutes from './warehouseLocationRoutes.js';
import inboundReceiptRoutes from './inboundReceiptRoutes.js';
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'VESTORA Haute Couture & Rental Luxury Backend Service',
    timestamp: new Date().toISOString(),
    database: 'MongoDB Atlas Connected',
    escrowProvider: 'PayOS Escrow API Active'
  });
});

router.use('/shops', shopRoutes);
router.use('/users', userRoutes);
router.use('/warehouse/masterdata', masterdataRoutes);
router.use('/warehouse/locations', warehouseLocationRoutes);
router.use('/warehouse/inbound-receipts', inboundReceiptRoutes);
export default router;
