import { z } from 'zod';
import * as rawCollectionService from '../../services/customer/collectionService.js';

// Helper trích xuất userId từ req.user (do authMiddleware gán)
const getUserId = (req) => {
  if (!req.user) return null;
  return req.user._id || req.user.id || null;
};

// ==========================================
// ZOD SCHEMAS
// ==========================================

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

const toggleWishlistSchema = z.object({
  productId: z.string({ required_error: 'productId là bắt buộc' }).regex(objectIdRegex, 'productId không hợp lệ'),
});

const checkStatusSchema = z.object({
  productIds: z.array(z.string().regex(objectIdRegex, 'Mã sản phẩm không hợp lệ')).default([]),
});

const syncWishlistSchema = z.object({
  productIds: z.array(z.string()).default([]),
});

const createCollectionSchema = z.object({
  name: z
    .string({ required_error: 'Tên bộ sưu tập là bắt buộc' })
    .trim()
    .min(1, 'Tên bộ sưu tập không được để trống')
    .max(100, 'Tên bộ sưu tập không được vượt quá 100 ký tự'),
  description: z.string().trim().max(500, 'Mô tả không được vượt quá 500 ký tự').optional().default(''),
  coverImageUrl: z.string().trim().optional().default(''),
  eventDate: z.string().nullable().optional(),
});

const updateCollectionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tên bộ sưu tập không được để trống')
    .max(100, 'Tên bộ sưu tập không được vượt quá 100 ký tự')
    .optional(),
  description: z.string().trim().max(500, 'Mô tả không được vượt quá 500 ký tự').optional(),
  coverImageUrl: z.string().trim().optional(),
  eventDate: z.string().nullable().optional(),
});

const addItemSchema = z.object({
  productId: z.string({ required_error: 'productId là bắt buộc' }).regex(objectIdRegex, 'productId không hợp lệ'),
  variantId: z.string().regex(objectIdRegex, 'variantId không hợp lệ').nullable().optional(),
  notes: z.string().trim().max(300, 'Ghi chú phong cách không được vượt quá 300 ký tự').optional().default(''),
  targetUsageDate: z.string().nullable().optional(),
});

const updateNotesSchema = z.object({
  notes: z.string().trim().max(300, 'Ghi chú phong cách không được vượt quá 300 ký tự').optional(),
  targetUsageDate: z.string().nullable().optional(),
});

const toggleShareSchema = z.object({
  isPrivate: z.boolean({ required_error: 'isPrivate là bắt buộc (true/false)' }),
});

// Exportable/mockable services reference
export const services = { ...rawCollectionService };

// Helper trả về lỗi
const sendError = (res, error) => {
  if (error instanceof z.ZodError) {
    const firstIssue = error.issues?.[0] || error.errors?.[0];
    return res.status(400).json({
      success: false,
      message: firstIssue?.message || 'Dữ liệu không hợp lệ',
      errors: error.issues || error.errors || [],
    });
  }
  const status = error.status || error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: error.message || 'Có lỗi xảy ra',
  });
};

// ==========================================
// WISHLIST CONTROLLERS
// ==========================================

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-002
 * POST /api/v1/wishlist/toggle
 */
export const toggleWishlistItem = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });

    const { productId } = toggleWishlistSchema.parse(req.body);
    const result = await services.toggleWishlistItem(userId, productId);

    return res.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-001
 * GET /api/v1/wishlist
 */
export const getDefaultWishlist = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });

    const cursor = req.query.cursor || null;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const result = await services.getDefaultWishlist(userId, { cursor, limit });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-002
 * POST /api/v1/wishlist/check-status
 */
export const checkWishlistStatus = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.json({ success: true, data: {} });
    }

    const { productIds } = checkStatusSchema.parse(req.body);
    const statusMap = await services.checkWishlistStatus(userId, productIds);

    return res.json({
      success: true,
      data: statusMap,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-005
 * POST /api/v1/wishlist/sync
 */
export const syncWishlistOnLogin = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });

    const { productIds } = syncWishlistSchema.parse(req.body);
    const result = await services.syncWishlistOnLogin(userId, productIds);

    return res.json({
      success: true,
      data: result,
      message: `Đã đồng bộ ${result.syncedCount} sản phẩm vào danh sách yêu thích`,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ==========================================
// COLLECTIONS CONTROLLERS
// ==========================================

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
 * GET /api/v1/collections
 */
export const getUserCollections = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });

    const collections = await services.getUserCollections(userId);

    return res.json({
      success: true,
      data: collections,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-002
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-003
 * POST /api/v1/collections
 */
export const createCollection = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });

    const payload = createCollectionSchema.parse(req.body);
    const collection = await services.createCollection(userId, payload);

    return res.status(201).json({
      success: true,
      data: collection,
      message: 'Đã tạo bộ sưu tập thành công',
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
 * GET /api/v1/collections/:id
 */
export const getCollectionDetail = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });

    const collectionId = req.params.id;
    const cursor = req.query.cursor || null;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const result = await services.getCollectionDetail(userId, collectionId, { cursor, limit });

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-004
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-006
 * PUT /api/v1/collections/:id
 */
export const updateCollection = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });

    const collectionId = req.params.id;
    const payload = updateCollectionSchema.parse(req.body);

    const updated = await services.updateCollection(userId, collectionId, payload);

    return res.json({
      success: true,
      data: updated,
      message: 'Đã cập nhật bộ sưu tập thành công',
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-005
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-006
 * DELETE /api/v1/collections/:id
 */
export const deleteCollection = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });

    const collectionId = req.params.id;
    const result = await services.deleteCollection(userId, collectionId);

    return res.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-007
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-008
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-009
 * POST /api/v1/collections/:id/items
 */
export const addItemToCollection = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });

    const collectionId = req.params.id;
    const payload = addItemSchema.parse(req.body);

    const item = await services.addItemToCollection(userId, collectionId, payload);

    return res.status(201).json({
      success: true,
      data: item,
      message: 'Đã thêm sản phẩm vào bộ sưu tập',
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-011
 * DELETE /api/v1/collections/:id/items/:itemId
 */
export const removeItemFromCollection = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });

    const { id: collectionId, itemId } = req.params;
    const result = await services.removeItemFromCollection(userId, collectionId, itemId);

    return res.json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-010
 * PATCH /api/v1/collections/:id/items/:itemId
 */
export const updateItemNotes = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });

    const { id: collectionId, itemId } = req.params;
    const payload = updateNotesSchema.parse(req.body);

    const updatedItem = await services.updateItemNotes(userId, collectionId, itemId, payload);

    return res.json({
      success: true,
      data: updatedItem,
      message: 'Đã cập nhật ghi chú phong cách',
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-002
 * PATCH /api/v1/collections/:id/share
 */
export const toggleShareCollection = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Bạn chưa đăng nhập' });

    const collectionId = req.params.id;
    const { isPrivate } = toggleShareSchema.parse(req.body);

    const result = await services.toggleShareCollection(userId, collectionId, isPrivate);

    return res.json({
      success: true,
      data: result,
      message: result.isPrivate
        ? 'Đã chuyển bộ sưu tập về chế độ riêng tư'
        : 'Đã bật chia sẻ bộ sưu tập công khai',
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-003
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-004
 * GET /api/v1/collections/shared/:shareCode (Endpoint Công khai, không cần đăng nhập)
 */
export const getSharedLookbook = async (req, res) => {
  try {
    const { shareCode } = req.params;
    const result = await services.getSharedLookbook(shareCode);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-005
 * POST /api/v1/collections/shared/:shareCode/clone
 */
export const cloneSharedLookbook = async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ success: false, message: 'Bạn cần đăng nhập để lưu bộ sưu tập này' });

    const { shareCode } = req.params;
    const cloned = await services.cloneSharedLookbook(userId, shareCode);

    return res.status(201).json({
      success: true,
      data: cloned,
      message: 'Đã lưu bộ sưu tập vào tủ đồ của bạn thành công',
    });
  } catch (error) {
    return sendError(res, error);
  }
};
