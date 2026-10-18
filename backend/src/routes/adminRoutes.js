import express from 'express';
import { getAdminMetrics, getPendingModeration } from '../controllers/adminController.js';
import shopRoutes from './shopRoutes.js';

const router = express.Router();

router.get('/metrics', getAdminMetrics);
router.get('/moderation', getPendingModeration);
router.use('/shops', shopRoutes);

export default router;
