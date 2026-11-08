import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../../models/system/User.js';
import { authMiddleware } from '../../middlewares/errorMiddleware.js';
import * as collectionController from '../../controllers/customer/collectionController.js';

// In-memory rate limiter cho endpoint chia sẻ công khai (NFR-004: max 60 req/min/IP)
const ipRateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 60;

export const publicLookbookRateLimiter = (req, res, next) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  let record = ipRateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
    ipRateLimitMap.set(ip, record);
  } else {
    record.count += 1;
    if (record.count > MAX_REQUESTS_PER_WINDOW) {
      return res.status(429).json({
        success: false,
        message: 'Bạn đã gửi quá nhiều yêu cầu xem Lookbook. Vui lòng thử lại sau một phút.',
      });
    }
  }

  if (ipRateLimitMap.size > 5000) {
    for (const [k, v] of ipRateLimitMap.entries()) {
      if (now > v.resetTime) ipRateLimitMap.delete(k);
    }
  }

  return next();
};

// Optional auth cho endpoint kiểm tra trạng thái
export const optionalAuth = async (req, res, next) => {
  const authHeader = req.get?.('Authorization') || req.headers?.authorization || '';
  const token =
    (typeof authHeader === 'string' && /^Bearer\s+/i.test(authHeader)
      ? authHeader.replace(/^Bearer\s+/i, '').trim()
      : null) || req.cookies?.vestora_token || null;

  if (!token || !process.env.JWT_SECRET) return next();

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'vestora',
      audience: 'vestora-web',
    });
    if (payload?.sub) {
      const user = await User.findById(payload.sub);
      if (user && user.Status === 'active') {
        req.user = user;
      }
    }
  } catch {
    // Bỏ qua lỗi token trong optional auth
  }
  return next();
};

// ==========================================
// WISHLIST ROUTER (/api/v1/wishlist & /api/wishlist)
// ==========================================
export const wishlistRouter = express.Router();

wishlistRouter.post('/toggle', authMiddleware, collectionController.toggleWishlistItem);
wishlistRouter.get('/', authMiddleware, collectionController.getDefaultWishlist);
wishlistRouter.post('/check-status', optionalAuth, collectionController.checkWishlistStatus);
wishlistRouter.post('/sync', authMiddleware, collectionController.syncWishlistOnLogin);

// ==========================================
// COLLECTIONS ROUTER (/api/v1/collections & /api/collections)
// ==========================================
export const collectionRouter = express.Router();

// Endpoint công khai xem Lookbook theo shareCode (NFR-004: Rate limiting 60 req/min/IP)
collectionRouter.get('/shared/:shareCode', publicLookbookRateLimiter, collectionController.getSharedLookbook);

// Endpoint sao chép Lookbook (Yêu cầu đăng nhập)
collectionRouter.post('/shared/:shareCode/clone', authMiddleware, collectionController.cloneSharedLookbook);

// Endpoints quản lý bộ sưu tập cá nhân (Yêu cầu đăng nhập)
collectionRouter.get('/', authMiddleware, collectionController.getUserCollections);
collectionRouter.post('/', authMiddleware, collectionController.createCollection);
collectionRouter.get('/:id', authMiddleware, collectionController.getCollectionDetail);
collectionRouter.put('/:id', authMiddleware, collectionController.updateCollection);
collectionRouter.delete('/:id', authMiddleware, collectionController.deleteCollection);

// Endpoints quản lý món trang phục trong bộ sưu tập
collectionRouter.post('/:id/items', authMiddleware, collectionController.addItemToCollection);
collectionRouter.delete('/:id/items/:itemId', authMiddleware, collectionController.removeItemFromCollection);
collectionRouter.patch('/:id/items/:itemId', authMiddleware, collectionController.updateItemNotes);

// Endpoint bật/tắt chia sẻ Lookbook
collectionRouter.patch('/:id/share', authMiddleware, collectionController.toggleShareCollection);

export default {
  wishlistRouter,
  collectionRouter,
};
