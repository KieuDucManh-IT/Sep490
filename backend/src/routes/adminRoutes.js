import express from 'express';
import { getAdminMetrics, getPendingModeration } from '../controllers/adminController.js';

const router = express.Router();

router.get('/metrics', getAdminMetrics);
router.get('/moderation', getPendingModeration);

export default router;
