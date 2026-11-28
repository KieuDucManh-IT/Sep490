import express from 'express';
import { authMiddleware, requireRole } from '../middlewares/errorMiddleware.js';
import {
  createOrderReview,
  createBatchOrderReviews,
  getProductReviews,
  getOrderReviews,
  checkProductReviewEligibility,
  replyToReview,
} from '../controllers/reviewController.js';

const router = express.Router();

// Public: Get reviews of a product (BR-07)
router.get('/product/:productId', getProductReviews);

// Protected: Customer actions
router.post('/', authMiddleware, createOrderReview);
router.post('/batch', authMiddleware, createBatchOrderReviews);
router.get('/order/:orderId', authMiddleware, getOrderReviews);
router.get('/check-eligibility/:productId', authMiddleware, checkProductReviewEligibility);

// Protected: Shop Owner / Branch Manager / Staff reply
router.post(
  '/:reviewId/reply',
  authMiddleware,
  requireRole('shop_owner', 'branch_manager', 'branchmanager'),
  replyToReview
);

export default router;
