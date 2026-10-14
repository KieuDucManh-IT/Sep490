import express from 'express';
import shopRoutes from './shopRoutes.js';
import userRoutes from './userRoutes.js';
import adminRoutes from './adminRoutes.js';
import productRoutes from './productRoutes.js';
import orderRoutes from './orderRoutes.js';

const router = express.Router();

// System Health Endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'VESTORA Haute Couture & Rental Luxury Backend Service',
    timestamp: new Date().toISOString(),
    database: 'MongoDB Atlas Connected',
    escrowProvider: 'PayOS Escrow API Active'
  });
});

// Mount domain routes
router.use('/products', productRoutes);
router.use('/orders', orderRoutes);
router.use('/shops', shopRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);

export default router;
