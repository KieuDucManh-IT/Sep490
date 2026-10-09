import express from 'express';
import { createEscrowIntent } from '../controllers/orderController.js';

const router = express.Router();

router.post('/escrow/create-intent', createEscrowIntent);

export default router;
