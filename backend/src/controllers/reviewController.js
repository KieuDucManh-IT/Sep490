import mongoose from 'mongoose';
import { Review } from '../models/masterdata/Review.js';
import { Product } from '../models/masterdata/Product.js';
import { ProductVariant } from '../models/masterdata/ProductVariant.js';
import { SalesOrder } from '../models/sale&rental/SalesOrder.js';
import { SalesOrderDetail } from '../models/sale&rental/SalesOrderDetail.js';
import { RentalOrder } from '../models/sale&rental/RentalOrder.js';
import { RentalOrderDetail } from '../models/sale&rental/RentalOrderDetail.js';

/**
 * Helper: Recalculate average rating and count for a Product
 */
export async function updateProductRatingStats(productId) {
  try {
    const pId = new mongoose.Types.ObjectId(productId);
    const stats = await Review.aggregate([
      { $match: { productId: pId, isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$productId',
          avgRating: { $avg: '$rating' },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    if (stats.length > 0) {
      await Product.findByIdAndUpdate(productId, {
        rating: Math.round(stats[0].avgRating * 10) / 10,
        reviewsCount: stats[0].totalCount,
      });
    } else {
      await Product.findByIdAndUpdate(productId, {
        rating: 0,
        reviewsCount: 0,
      });
    }
  } catch (err) {
    console.error('Failed to update product rating stats:', err);
  }
}

/**
 * Synchronize all products with real review stats from Review collection
 */
export async function syncAllProductRatings() {
  try {
    const stats = await Review.aggregate([
      { $match: { isDeleted: { $ne: true } } },
      {
        $group: {
          _id: '$productId',
          avgRating: { $avg: '$rating' },
          totalCount: { $sum: 1 },
        },
      },
    ]);

    const reviewedProductIds = [];
    for (const s of stats) {
      if (s._id) {
        reviewedProductIds.push(s._id);
        await Product.findByIdAndUpdate(s._id, {
          rating: Math.round(s.avgRating * 10) / 10,
          reviewsCount: s.totalCount,
        });
      }
    }

    // Reset all products that have no reviews in database
    await Product.updateMany(
      { _id: { $nin: reviewedProductIds } },
      { $set: { rating: 0, reviewsCount: 0 } }
    );
    console.log('[Reviews] Synchronized all product ratings with real backend reviews.');
  } catch (err) {
    console.warn('[Reviews] Failed to sync product ratings:', err.message);
  }
}

/**
 * Helper: Verify order ownership, status, and product inclusion
 */
async function verifyOrderEligibility(orderId, orderType, productId, customerId) {
  let order = null;
  let shopId = null;
  let productFound = false;

  if (orderType === 'sale') {
    order = await SalesOrder.findById(orderId).populate('locationId');
    if (!order) {
      return { ok: false, status: 404, message: 'Đơn mua hàng không tồn tại.' };
    }

    if (String(order.customerId) !== String(customerId)) {
      return { ok: false, status: 403, message: 'Bạn không có quyền đánh giá đơn hàng này.' };
    }

    // Must be completed (or shipped with delivery completed)
    if (order.orderStatus !== 'completed' && order.orderStatus !== 'shipped') {
      return {
        ok: false,
        status: 400,
        message: 'Bạn chỉ có thể đánh giá sau khi đơn mua hàng đã được giao thành công.',
      };
    }

    shopId = order.locationId?.shopId || null;

    // Check if productId is in SalesOrderDetails
    const details = await SalesOrderDetail.find({ salesOrderId: order._id }).populate('variantId');
    for (const d of details) {
      const vProdId = d.variantId?.productId?._id || d.variantId?.productId;
      if (vProdId && String(vProdId) === String(productId)) {
        productFound = true;
        break;
      }
    }
  } else if (orderType === 'rental') {
    order = await RentalOrder.findById(orderId).populate('locationId');
    if (!order) {
      return { ok: false, status: 404, message: 'Đơn thuê trang phục không tồn tại.' };
    }

    if (String(order.customerId) !== String(customerId)) {
      return { ok: false, status: 403, message: 'Bạn không có quyền đánh giá đơn thuê này.' };
    }

    // BR-03: Renter may review while using ('renting') or after returned ('returned', 'partially_returned')
    const validStatuses = ['renting', 'partially_returned', 'returned'];
    if (!validStatuses.includes(order.rentalStatus)) {
      return {
        ok: false,
        status: 400,
        message: 'Bạn chỉ có thể đánh giá khi đang trải nghiệm trang phục hoặc sau khi đã hoàn tất trả đồ.',
      };
    }

    shopId = order.locationId?.shopId || null;

    // Check if productId is in RentalOrderDetails
    const details = await RentalOrderDetail.find({ rentalOrderId: order._id }).populate('variantId');
    for (const d of details) {
      const vProdId = d.variantId?.productId?._id || d.variantId?.productId;
      if (vProdId && String(vProdId) === String(productId)) {
        productFound = true;
        break;
      }
    }
  } else {
    return { ok: false, status: 400, message: 'Loại đơn hàng không hợp lệ (chỉ hỗ trợ "sale" hoặc "rental").' };
  }

  if (!productFound) {
    return {
      ok: false,
      status: 400,
      message: 'Sản phẩm này không nằm trong danh sách các món của đơn hàng đã nhận.',
    };
  }

  return { ok: true, order, shopId };
}

/**
 * 1. POST /api/reviews
 * Submit review for a single product from an eligible order
 */
export const createOrderReview = async (req, res) => {
  try {
    const customerId = req.user?._id;
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để đánh giá.' });
    }

    const { orderId, orderType, productId, rating, comment, images } = req.body;

    if (!orderId || !orderType || !productId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin đơn hàng hoặc sản phẩm.' });
    }

    // BR-04: Rating 1..5 integer
    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, message: 'Số sao đánh giá phải là số nguyên từ 1 đến 5 sao.' });
    }

    // BR-05: Written feedback required, not only whitespace
    if (!comment || typeof comment !== 'string' || !comment.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung nhận xét chi tiết.' });
    }

    // Check Eligibility
    const check = await verifyOrderEligibility(orderId, orderType, productId, customerId);
    if (!check.ok) {
      return res.status(check.status).json({ success: false, message: check.message });
    }

    // Prevent duplicate review for this product in this order
    const existing = await Review.findOne({ orderId, productId, customerId });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đánh giá sản phẩm này trong đơn hàng này rồi.',
      });
    }

    // Save review
    const newReview = await Review.create({
      customerId,
      productId,
      orderId,
      orderType,
      shopId: check.shopId,
      rating: numRating,
      comment: comment.trim(),
      images: Array.isArray(images) ? images : [],
      isVerifiedPurchase: true,
    });

    // Update product stats
    await updateProductRatingStats(productId);

    return res.status(201).json({
      success: true,
      message: 'Gửi đánh giá sản phẩm thành công! Cảm ơn bạn đã phản hồi.',
      data: newReview,
    });
  } catch (error) {
    console.error('Error in createOrderReview:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to submit your review. Please try again.',
      error: error.message,
    });
  }
};

/**
 * 2. POST /api/reviews/batch
 * Submit multiple reviews for several products in one order
 */
export const createBatchOrderReviews = async (req, res) => {
  try {
    const customerId = req.user?._id;
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để đánh giá.' });
    }

    const { orderId, orderType, reviews } = req.body;
    if (!orderId || !orderType || !Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({ success: false, message: 'Danh sách đánh giá không hợp lệ.' });
    }

    const createdReviews = [];
    const affectedProductIds = new Set();
    const errors = [];

    for (const item of reviews) {
      const { productId, rating, comment, images } = item;
      const numRating = Number(rating);

      if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        errors.push({ productId, message: 'Số sao không hợp lệ (1-5).' });
        continue;
      }
      if (!comment || typeof comment !== 'string' || !comment.trim()) {
        errors.push({ productId, message: 'Nội dung nhận xét không được để trống.' });
        continue;
      }

      const check = await verifyOrderEligibility(orderId, orderType, productId, customerId);
      if (!check.ok) {
        errors.push({ productId, message: check.message });
        continue;
      }

      const existing = await Review.findOne({ orderId, productId, customerId });
      if (existing) {
        errors.push({ productId, message: 'Đã đánh giá trước đó.' });
        continue;
      }

      const rev = await Review.create({
        customerId,
        productId,
        orderId,
        orderType,
        shopId: check.shopId,
        rating: numRating,
        comment: comment.trim(),
        images: Array.isArray(images) ? images : [],
        isVerifiedPurchase: true,
      });

      createdReviews.push(rev);
      affectedProductIds.add(String(productId));
    }

    // Update stats for all affected products
    for (const pId of affectedProductIds) {
      await updateProductRatingStats(pId);
    }

    return res.status(201).json({
      success: true,
      message: `Đã lưu thành công ${createdReviews.length} đánh giá.`,
      data: createdReviews,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error in createBatchOrderReviews:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lưu danh sách đánh giá. Vui lòng thử lại.',
      error: error.message,
    });
  }
};

/**
 * 3. GET /api/reviews/product/:productId
 * Public: Get reviews of a product with pagination and star breakdown
 */
export const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const star = parseInt(req.query.star);

    const filter = { productId };
    if (star >= 1 && star <= 5) {
      filter.rating = star;
    }

    const [reviews, total, breakdown] = await Promise.all([
      Review.find(filter)
        .populate('customerId', 'fullName name avatar')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter),
      Review.aggregate([
        { $match: { productId: new mongoose.Types.ObjectId(productId) } },
        { $group: { _id: '$rating', count: { $sum: 1 } } },
      ]),
    ]);

    // Build star distribution map { 5: count, 4: count, ... }
    const starCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalAllReviews = 0;
    let sumScore = 0;

    breakdown.forEach(b => {
      if (b._id >= 1 && b._id <= 5) {
        starCounts[b._id] = b.count;
        totalAllReviews += b.count;
        sumScore += b._id * b.count;
      }
    });

    const averageRating = totalAllReviews > 0 ? Math.round((sumScore / totalAllReviews) * 10) / 10 : 0;

    return res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        averageRating,
        totalReviews: totalAllReviews,
        starCounts,
      },
    });
  } catch (error) {
    console.error('Error in getProductReviews:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 4. GET /api/reviews/order/:orderId
 * Protected: Get all reviews submitted for a specific order by current user
 */
export const getOrderReviews = async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user?._id;

    const reviews = await Review.find({ orderId, customerId })
      .select('productId rating comment images createdAt reply')
      .lean();

    return res.status(200).json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    console.error('Error in getOrderReviews:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
   * 5. GET /api/reviews/check-eligibility/:productId
   * Protected: Check if current customer is eligible to review a product
   */
export const checkProductReviewEligibility = async (req, res) => {
  try {
    const customerId = req.user?._id;
    const { productId } = req.params;

    if (!customerId) {
      return res.status(200).json({ success: true, canReview: false, reason: 'unauthenticated' });
    }

    // Find all variants for this product
    const variants = await ProductVariant.find({ productId }).select('_id').lean();
    const variantIds = variants.map(v => v._id);

    // 1. Search in SalesOrders completed
    const salesDetails = await SalesOrderDetail.find({ variantId: { $in: variantIds } }).select('salesOrderId');
    const salesOrderIds = salesDetails.map(d => d.salesOrderId);

    const eligibleSalesOrders = await SalesOrder.find({
      _id: { $in: salesOrderIds },
      customerId,
      orderStatus: 'completed',
    }).select('_id orderCode completedAt').lean();

    // 2. Search in RentalOrders renting or returned
    const rentalDetails = await RentalOrderDetail.find({ variantId: { $in: variantIds } }).select('rentalOrderId');
    const rentalOrderIds = rentalDetails.map(d => d.rentalOrderId);

    const eligibleRentalOrders = await RentalOrder.find({
      _id: { $in: rentalOrderIds },
      customerId,
      rentalStatus: { $in: ['renting', 'partially_returned', 'returned'] },
    }).select('_id orderCode rentalStatus actualDeliveryDate').lean();

    // 3. Filter out orders that have already been reviewed for this product
    const allEligibleOrders = [
      ...eligibleSalesOrders.map(o => ({ orderId: o._id, orderCode: o.orderCode, orderType: 'sale' })),
      ...eligibleRentalOrders.map(o => ({ orderId: o._id, orderCode: o.orderCode, orderType: 'rental' })),
    ];

    const unreviewedOrders = [];
    for (const ord of allEligibleOrders) {
      const alreadyReviewed = await Review.findOne({ orderId: ord.orderId, productId, customerId });
      if (!alreadyReviewed) {
        unreviewedOrders.push(ord);
      }
    }

    return res.status(200).json({
      success: true,
      canReview: unreviewedOrders.length > 0,
      eligibleOrders: unreviewedOrders,
    });
  } catch (error) {
    console.error('Error in checkProductReviewEligibility:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * 6. POST /api/reviews/:reviewId/reply
 * Protected (Staff / Manager / Owner): Reply to a customer review
 */
export const replyToReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { replyText } = req.body;

    if (!replyText || !replyText.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung phản hồi không được để trống.' });
    }

    const review = await Review.findByIdAndUpdate(
      reviewId,
      {
        reply: {
          content: replyText.trim(),
          repliedBy: req.user._id,
          repliedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({ success: false, message: 'Đánh giá không tồn tại.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Đã gửi phản hồi đánh giá thành công.',
      data: review,
    });
  } catch (error) {
    console.error('Error in replyToReview:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
