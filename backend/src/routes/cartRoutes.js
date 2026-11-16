import express from 'express';
import rateLimit from 'express-rate-limit';
import { validateCart } from '../controllers/cart/cartController.js';
const router = express.Router();
router.post('/validate', rateLimit({ windowMs: 60000, limit: 60, standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Quá nhiều yêu cầu kiểm tra giỏ hàng. Vui lòng thử lại sau một phút.' },
}), validateCart);
export default router;
