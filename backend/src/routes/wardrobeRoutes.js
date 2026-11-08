import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/system/User.js';
import Wardrobe from '../models/system/Wardrobe.js';
import { Product } from '../models/masterdata/Product.js';

const router = express.Router();

/**
 * Middleware xác thực tuỳ chọn (khách vãng lai hoặc thành viên đã đăng nhập)
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.get?.('Authorization') || req.headers?.authorization || '';
    const token =
      typeof authHeader === 'string' && /^Bearer\s+/i.test(authHeader)
        ? authHeader.replace(/^Bearer\s+/i, '').trim()
        : req.cookies?.token;

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
      const userId = decoded.id || decoded.userId || decoded._id;
      if (userId) {
        const user = await User.findById(userId).select('-password').lean();
        if (user) req.user = user;
      }
    }
  } catch (_) {}
  next();
}

/**
 * GET /api/wardrobe
 * Lấy danh sách trang phục trong tủ đồ cá nhân
 */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const query = {};

    if (req.user?._id) {
      query.$or = [{ userId: req.user._id }];
      if (req.query.guestId) {
        query.$or.push({ guestId: req.query.guestId });
      }
    } else if (req.query.guestId) {
      query.guestId = req.query.guestId;
    }

    const items = await Wardrobe.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Định dạng ngày hiển thị (DD/MM/YYYY)
    const formattedItems = items.map((item) => ({
      ...item,
      id: item._id.toString(),
      savedDate: item.createdAt
        ? new Date(item.createdAt).toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : 'Hôm nay',
    }));

    return res.json({
      success: true,
      data: formattedItems,
    });
  } catch (err) {
    console.error('[WardrobeRoutes] Lỗi lấy tủ đồ:', err);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải tủ đồ cá nhân, vui lòng thử lại.',
    });
  }
});

/**
 * POST /api/wardrobe
 * Lưu trang phục vừa thử AI hoặc gợi ý vào tủ đồ
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const {
      productId,
      productCode,
      title,
      image,
      tryOnImageUrl,
      category,
      typeBadge,
      matchScore,
      aiNote,
      price,
      priceUnit,
      selectedSize,
      tags,
      guestId,
    } = req.body;

    if (!title && !productId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin sản phẩm cần lưu vào tủ đồ.',
      });
    }

    let finalTitle = title;
    let finalImage = image;
    let finalPrice = price || 0;
    let finalCategory = category || 'Thời trang cao cấp';
    let finalProductCode = productCode || '';

    // Nếu có productId, tra cứu thêm thông tin từ Product DB
    if (productId) {
      try {
        const prod = await Product.findById(productId).lean();
        if (prod) {
          if (!finalTitle) finalTitle = prod.name;
          if (!finalImage) finalImage = prod.image || (Array.isArray(prod.images) && prod.images[0]);
          if (!finalPrice) finalPrice = prod.rentalPricePerDay || prod.salePrice || 0;
          if (!finalCategory && Array.isArray(prod.category)) {
            finalCategory = prod.category[0] || 'Thời trang cao cấp';
          }
          if (!finalProductCode) finalProductCode = prod.productCode || '';
        }
      } catch (prodErr) {
        console.warn('[WardrobeRoutes] Không tìm thấy sản phẩm:', prodErr.message);
      }
    }

    // Chống spam: Nếu bức ảnh thử AI này đã tồn tại trong tủ đồ thì không tạo trùng
    const targetUserId = req.user?._id || null;
    const targetGuestId = guestId || req.cookies?.guestId || null;

    if (tryOnImageUrl) {
      const duplicateQuery = { tryOnImageUrl };
      if (targetUserId) {
        duplicateQuery.userId = targetUserId;
      } else if (targetGuestId) {
        duplicateQuery.guestId = targetGuestId;
      }

      const existingItem = await Wardrobe.findOne(duplicateQuery).lean();
      if (existingItem) {
        return res.status(200).json({
          success: true,
          alreadySaved: true,
          data: existingItem,
          message: 'Trang phục và ảnh thử này đã có sẵn trong tủ đồ của bạn!',
        });
      }
    }

    const newWardrobeItem = await Wardrobe.create({
      userId: targetUserId,
      guestId: targetGuestId,
      productId: productId || null,
      productCode: finalProductCode,
      title: finalTitle || 'Trang phục thử đồ AI',
      image: finalImage || '',
      tryOnImageUrl: tryOnImageUrl || '',
      category: finalCategory,
      typeBadge: typeBadge || 'rental',
      matchScore: Number(matchScore) || 98,
      aiNote:
        aiNote ||
        'Đã thử qua AI Try-On thành công. Thiết kế vừa vặn và tôn vóc dáng của bạn.',
      price: Number(finalPrice) || 0,
      priceUnit: priceUnit || '/ ngày',
      selectedSize: selectedSize || 'S',
      tags: Array.isArray(tags) && tags.length > 0 ? tags : ['tryon-history', 'ai-suggested'],
    });

    return res.status(201).json({
      success: true,
      data: newWardrobeItem,
      message: 'Đã lưu trang phục vào Tủ Đồ Cá Nhân thành công!',
    });
  } catch (err) {
    console.error('[WardrobeRoutes] Lỗi lưu tủ đồ:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Lỗi khi lưu vào tủ đồ cá nhân.',
    });
  }
});

/**
 * DELETE /api/wardrobe/:id
 * Xoá một trang phục khỏi tủ đồ
 */
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const item = await Wardrobe.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Trang phục không tồn tại hoặc đã được gỡ bỏ.',
      });
    }

    return res.json({
      success: true,
      message: 'Đã bỏ trang phục khỏi tủ đồ cá nhân.',
    });
  } catch (err) {
    console.error('[WardrobeRoutes] Lỗi xoá tủ đồ:', err);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi gỡ trang phục khỏi tủ đồ.',
    });
  }
});

export default router;

