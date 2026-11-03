import express from 'express';
import { chatWithStylist } from '../controllers/chatController.js';

const router = express.Router();

// POST /api/chat
router.post('/', chatWithStylist);

export default router;

