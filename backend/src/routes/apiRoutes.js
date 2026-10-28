import express from 'express';
import shopRoutes from './shopRoutes.js';
import userRoutes from './userRoutes.js';
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
export default router;
