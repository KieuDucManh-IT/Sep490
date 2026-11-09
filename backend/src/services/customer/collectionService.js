import crypto from 'crypto';
import mongoose from 'mongoose';
import UserCollection from '../../models/customer/UserCollection.js';
import CollectionItem from '../../models/customer/CollectionItem.js';
import { Product } from '../../models/masterdata/Product.js';
import { ProductImage } from '../../models/masterdata/ProductImages.js';

export const MAX_COLLECTIONS_PER_USER = 20;
export const MAX_ITEMS_PER_COLLECTION = 100;
export const DEFAULT_COLLECTION_NAME = 'Tất cả yêu thích';

/**
 * Tạo lỗi kèm mã HTTP status
 */
const createError = (message, status = 400) =>
  Object.assign(new Error(message), { status, statusCode: status });

/**
 * Thoát ký tự đặc biệt cho Regex
 */
const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Sinh mã shareCode ngẫu nhiên an toàn (10 ký tự)
 */
export const generateShareCode = () => {
  return crypto.randomBytes(5).toString('hex');
};

/**
 * Gắn ảnh chính (Primary Image) cho danh sách sản phẩm
 */
export const attachPrimaryImages = async (items) => {
  if (!items || !items.length) return items;

  const productIds = items
    .map((item) => (item.productId && item.productId._id ? item.productId._id : item.productId))
    .filter(Boolean);

  if (!productIds.length) return items;

  const primaryImages = await ProductImage.find({
    productId: { $in: productIds },
    isPrimary: true,
  }).lean();

  const imageMap = new Map();
  primaryImages.forEach((img) => {
    imageMap.set(img.productId.toString(), img.imageUrl);
  });

  return items.map((item) => {
    const rawProd = item.productId;
    if (rawProd && typeof rawProd === 'object') {
      const prodIdStr = rawProd._id ? rawProd._id.toString() : rawProd.toString();
      const primaryImageUrl = imageMap.get(prodIdStr) || '';
      return {
        ...item,
        productId: {
          ...rawProd,
          primaryImageUrl,
          // Kiểm tra tính sẵn sàng theo REQ-WSH-006
          isAvailable: !rawProd.isDeleted && rawProd.status !== 'inactive' && rawProd.status !== 'discontinued',
        },
      };
    }
    return item;
  });
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-001
 * Lấy hoặc khởi tạo bộ sưu tập mặc định ("Tất cả yêu thích") cho người dùng
 */
export const getOrCreateDefaultCollection = async (userId) => {
  if (!userId) throw createError('userId là bắt buộc', 400);

  let defaultCol = await UserCollection.findOne({ userId, isDefault: true });
  if (!defaultCol) {
    try {
      defaultCol = await UserCollection.create({
        userId,
        name: DEFAULT_COLLECTION_NAME,
        description: 'Bộ sưu tập các món trang phục yêu thích của bạn',
        isDefault: true,
        isPrivate: true,
        itemCount: 0,
      });
    } catch (err) {
      // Xử lý race condition nếu 2 request cùng tạo
      if (err.code === 11000) {
        defaultCol = await UserCollection.findOne({ userId, isDefault: true });
      } else {
        throw err;
      }
    }
  }
  return defaultCol;
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-002
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-003
 * Thả tim hoặc Bỏ tim một sản phẩm vào Danh sách Yêu thích mặc định (1-Click Toggle)
 */
export const toggleWishlistItem = async (userId, productId) => {
  if (!userId) throw createError('userId là bắt buộc', 401);
  if (!productId) throw createError('productId là bắt buộc', 400);

  const defaultCol = await getOrCreateDefaultCollection(userId);

  const existingItem = await CollectionItem.findOne({
    collectionId: defaultCol._id,
    productId,
  });

  if (existingItem) {
    // Đã có -> Xóa bỏ (Bỏ tim)
    await CollectionItem.deleteOne({ _id: existingItem._id });
    const count = Math.max(0, defaultCol.itemCount - 1);
    defaultCol.itemCount = count;
    await defaultCol.save();

    return {
      isWishlisted: false,
      productId: productId.toString(),
      itemCount: count,
      message: 'Đã xóa khỏi danh sách yêu thích',
    };
  } else {
    // Chưa có -> Kiểm tra giới hạn tối đa 100 món
    if (defaultCol.itemCount >= MAX_ITEMS_PER_COLLECTION) {
      throw createError(
        `Danh sách yêu thích đã đạt giới hạn tối đa ${MAX_ITEMS_PER_COLLECTION} sản phẩm`,
        422
      );
    }

    await CollectionItem.create({
      collectionId: defaultCol._id,
      userId,
      productId,
    });

    const count = defaultCol.itemCount + 1;
    defaultCol.itemCount = count;
    await defaultCol.save();

    return {
      isWishlisted: true,
      productId: productId.toString(),
      itemCount: count,
      message: 'Đã thêm vào danh sách yêu thích',
    };
  }
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-002
 * Kiểm tra nhanh trạng thái yêu thích của danh sách sản phẩm
 */
export const checkWishlistStatus = async (userId, productIds = []) => {
  if (!userId || !productIds.length) return {};

  const defaultCol = await UserCollection.findOne({ userId, isDefault: true });
  if (!defaultCol) return {};

  const items = await CollectionItem.find({
    userId,
    collectionId: defaultCol._id,
    productId: { $in: productIds },
  })
    .select('productId')
    .lean();

  const wishlistedSet = new Set(items.map((i) => i.productId.toString()));
  const statusMap = {};
  productIds.forEach((id) => {
    statusMap[id.toString()] = wishlistedSet.has(id.toString());
  });

  return statusMap;
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-006
 * Lấy danh sách sản phẩm yêu thích mặc định kèm phân trang Keyset/Cursor
 */
export const getDefaultWishlist = async (userId, { cursor = null, limit = 20 } = {}) => {
  if (!userId) throw createError('userId là bắt buộc', 401);

  const defaultCol = await getOrCreateDefaultCollection(userId);

  const query = { collectionId: defaultCol._id };
  if (cursor) {
    query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const items = await CollectionItem.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('productId')
    .populate('variantId')
    .lean();

  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor = resultItems.length ? resultItems[resultItems.length - 1]._id.toString() : null;

  const itemsWithImages = await attachPrimaryImages(resultItems);

  return {
    collection: defaultCol,
    items: itemsWithImages,
    hasMore,
    nextCursor,
    totalCount: defaultCol.itemCount,
  };
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-005
 * Đồng bộ danh sách sản phẩm yêu thích từ LocalStorage của khách sau khi đăng nhập
 */
export const syncWishlistOnLogin = async (userId, localProductIds = []) => {
  if (!userId) throw createError('userId là bắt buộc', 401);
  if (!Array.isArray(localProductIds) || !localProductIds.length) {
    const col = await getOrCreateDefaultCollection(userId);
    return { syncedCount: 0, totalCount: col.itemCount };
  }

  const defaultCol = await getOrCreateDefaultCollection(userId);

  // Lọc các id hợp lệ
  const validProductIds = localProductIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!validProductIds.length) {
    return { syncedCount: 0, totalCount: defaultCol.itemCount };
  }

  // Tìm các sản phẩm đã có trong BST mặc định
  const existingItems = await CollectionItem.find({
    collectionId: defaultCol._id,
    productId: { $in: validProductIds },
  })
    .select('productId')
    .lean();

  const existingSet = new Set(existingItems.map((i) => i.productId.toString()));
  const missingProductIds = validProductIds.filter((id) => !existingSet.has(id.toString()));

  // Duyệt thêm các sản phẩm thiếu nhưng không vượt quá MAX_ITEMS_PER_COLLECTION
  let syncedCount = 0;
  for (const pid of missingProductIds) {
    if (defaultCol.itemCount >= MAX_ITEMS_PER_COLLECTION) break;

    try {
      await CollectionItem.create({
        collectionId: defaultCol._id,
        userId,
        productId: pid,
      });
      defaultCol.itemCount += 1;
      syncedCount += 1;
    } catch {
      // Bỏ qua nếu có lỗi trùng lặp bất ngờ
    }
  }

  if (syncedCount > 0) {
    await defaultCol.save();
  }

  return {
    syncedCount,
    totalCount: defaultCol.itemCount,
  };
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
 * Lấy toàn bộ danh sách bộ sưu tập của người dùng
 */
export const getUserCollections = async (userId) => {
  if (!userId) throw createError('userId là bắt buộc', 401);

  await getOrCreateDefaultCollection(userId);

  const collections = await UserCollection.find({ userId })
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();

  return collections;
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-002
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-003
 * Tạo mới một Bộ sưu tập Cá nhân
 */
export const createCollection = async (userId, data = {}) => {
  if (!userId) throw createError('userId là bắt buộc', 401);

  const rawName = typeof data.name === 'string' ? data.name.trim() : '';
  if (!rawName || rawName.length > 100) {
    throw createError('Tên bộ sưu tập phải từ 1 đến 100 ký tự', 400);
  }

  // REQ-COL-003: Chặn nếu người dùng đã có 20 BST tùy chỉnh
  const customCount = await UserCollection.countDocuments({ userId, isDefault: false });
  if (customCount >= MAX_COLLECTIONS_PER_USER) {
    throw createError(
      `Bạn đã đạt giới hạn tối đa ${MAX_COLLECTIONS_PER_USER} bộ sưu tập cá nhân`,
      422
    );
  }

  // REQ-COL-002: Chặn trùng tên bộ sưu tập (case-insensitive trim)
  const duplicate = await UserCollection.findOne({
    userId,
    name: { $regex: new RegExp(`^${escapeRegex(rawName)}$`, 'i') },
  });
  if (duplicate) {
    throw createError('Bộ sưu tập với tên này đã tồn tại', 409);
  }

  const collection = await UserCollection.create({
    userId,
    name: rawName,
    description: (data.description || '').trim().slice(0, 500),
    coverImageUrl: (data.coverImageUrl || '').trim(),
    eventDate: data.eventDate ? new Date(data.eventDate) : null,
    isDefault: false,
    isPrivate: true,
    itemCount: 0,
  });

  return collection;
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
 * Lấy chi tiết Bộ sưu tập và danh sách sản phẩm bên trong
 */
export const getCollectionDetail = async (userId, collectionId, { cursor = null, limit = 50 } = {}) => {
  if (!userId) throw createError('userId là bắt buộc', 401);
  if (!collectionId) throw createError('collectionId là bắt buộc', 400);

  const collection = await UserCollection.findById(collectionId);
  if (!collection) {
    throw createError('Bộ sưu tập không tồn tại', 404);
  }

  // NFR-003: Chỉ chủ sở hữu mới có quyền truy cập
  if (collection.userId.toString() !== userId.toString()) {
    throw createError('Bạn không có quyền truy cập bộ sưu tập này', 403);
  }

  const query = { collectionId };
  if (cursor) {
    query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  const items = await CollectionItem.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .populate('productId')
    .populate('variantId')
    .lean();

  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor = resultItems.length ? resultItems[resultItems.length - 1]._id.toString() : null;

  const itemsWithImages = await attachPrimaryImages(resultItems);

  return {
    collection,
    items: itemsWithImages,
    hasMore,
    nextCursor,
    totalCount: collection.itemCount,
  };
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-004
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-006
 * Cập nhật thông tin Bộ sưu tập (Tên, mô tả, ảnh bìa, ngày sự kiện)
 */
export const updateCollection = async (userId, collectionId, updateData = {}) => {
  if (!userId) throw createError('userId là bắt buộc', 401);
  if (!collectionId) throw createError('collectionId là bắt buộc', 400);

  const collection = await UserCollection.findById(collectionId);
  if (!collection) {
    throw createError('Bộ sưu tập không tồn tại', 404);
  }

  if (collection.userId.toString() !== userId.toString()) {
    throw createError('Bạn không có quyền chỉnh sửa bộ sưu tập này', 403);
  }

  // REQ-COL-006: Không cho phép đổi tên bộ sưu tập mặc định
  if (collection.isDefault && updateData.name && updateData.name.trim() !== collection.name) {
    throw createError('Không được phép đổi tên bộ sưu tập mặc định', 400);
  }

  if (updateData.name !== undefined) {
    const rawName = String(updateData.name).trim();
    if (!rawName || rawName.length > 100) {
      throw createError('Tên bộ sưu tập phải từ 1 đến 100 ký tự', 400);
    }

    // Chặn trùng tên với BST khác của cùng người dùng
    const duplicate = await UserCollection.findOne({
      userId,
      _id: { $ne: collectionId },
      name: { $regex: new RegExp(`^${escapeRegex(rawName)}$`, 'i') },
    });
    if (duplicate) {
      throw createError('Bộ sưu tập với tên này đã tồn tại', 409);
    }
    collection.name = rawName;
  }

  if (updateData.description !== undefined) {
    collection.description = String(updateData.description).trim().slice(0, 500);
  }

  if (updateData.coverImageUrl !== undefined) {
    collection.coverImageUrl = String(updateData.coverImageUrl).trim();
  }

  if (updateData.eventDate !== undefined) {
    collection.eventDate = updateData.eventDate ? new Date(updateData.eventDate) : null;
  }

  await collection.save();
  return collection;
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-005
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-006
 * Xóa một Bộ sưu tập Tùy chỉnh và các sản phẩm bên trong
 */
export const deleteCollection = async (userId, collectionId) => {
  if (!userId) throw createError('userId là bắt buộc', 401);
  if (!collectionId) throw createError('collectionId là bắt buộc', 400);

  const collection = await UserCollection.findById(collectionId);
  if (!collection) {
    throw createError('Bộ sưu tập không tồn tại', 404);
  }

  if (collection.userId.toString() !== userId.toString()) {
    throw createError('Bạn không có quyền xóa bộ sưu tập này', 403);
  }

  // REQ-COL-006: Cấm xóa bộ sưu tập mặc định
  if (collection.isDefault) {
    throw createError('Không được phép xóa bộ sưu tập mặc định', 403);
  }

  // Xóa toàn bộ item con trong BST này
  await CollectionItem.deleteMany({ collectionId });
  await UserCollection.deleteOne({ _id: collectionId });

  return {
    success: true,
    message: 'Đã xóa bộ sưu tập thành công',
  };
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-007
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-008
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-009
 * Thêm sản phẩm vào Bộ sưu tập kèm Ghi chú phong cách
 */
export const addItemToCollection = async (
  userId,
  collectionId,
  { productId, variantId = null, notes = '', targetUsageDate = null } = {}
) => {
  if (!userId) throw createError('userId là bắt buộc', 401);
  if (!collectionId) throw createError('collectionId là bắt buộc', 400);
  if (!productId) throw createError('productId là bắt buộc', 400);

  const collection = await UserCollection.findById(collectionId);
  if (!collection) {
    throw createError('Bộ sưu tập không tồn tại', 404);
  }

  if (collection.userId.toString() !== userId.toString()) {
    throw createError('Bạn không có quyền thêm vào bộ sưu tập này', 403);
  }

  // REQ-COL-008: Chặn khi đạt 100 món
  if (collection.itemCount >= MAX_ITEMS_PER_COLLECTION) {
    throw createError(
      `Bộ sưu tập đã đạt giới hạn tối đa ${MAX_ITEMS_PER_COLLECTION} sản phẩm`,
      422
    );
  }

  // REQ-COL-009: Chặn trùng lặp sản phẩm & biến thể trong cùng BST
  const existing = await CollectionItem.findOne({
    collectionId,
    productId,
    variantId: variantId || null,
  });
  if (existing) {
    throw createError('Sản phẩm này đã có trong bộ sưu tập', 409);
  }

  const trimmedNotes = String(notes || '').trim();
  if (trimmedNotes.length > 300) {
    throw createError('Ghi chú phong cách không được vượt quá 300 ký tự', 400);
  }

  const item = await CollectionItem.create({
    collectionId,
    userId,
    productId,
    variantId: variantId || null,
    notes: trimmedNotes,
    targetUsageDate: targetUsageDate ? new Date(targetUsageDate) : null,
  });

  collection.itemCount += 1;

  // Nếu BST chưa có ảnh bìa, tự động lấy ảnh chính của sản phẩm vừa thêm
  if (!collection.coverImageUrl) {
    const primaryImg = await ProductImage.findOne({ productId, isPrimary: true }).lean();
    if (primaryImg && primaryImg.imageUrl) {
      collection.coverImageUrl = primaryImg.imageUrl;
    }
  }

  await collection.save();
  return item;
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-011
 * Xóa một sản phẩm khỏi Bộ sưu tập tùy chỉnh
 */
export const removeItemFromCollection = async (userId, collectionId, itemId) => {
  if (!userId) throw createError('userId là bắt buộc', 401);
  if (!collectionId) throw createError('collectionId là bắt buộc', 400);
  if (!itemId) throw createError('itemId là bắt buộc', 400);

  const collection = await UserCollection.findById(collectionId);
  if (!collection) {
    throw createError('Bộ sưu tập không tồn tại', 404);
  }

  if (collection.userId.toString() !== userId.toString()) {
    throw createError('Bạn không có quyền thực hiện thao tác này', 403);
  }

  const item = await CollectionItem.findOne({ _id: itemId, collectionId });
  if (!item) {
    throw createError('Sản phẩm không tồn tại trong bộ sưu tập này', 404);
  }

  await CollectionItem.deleteOne({ _id: itemId });

  collection.itemCount = Math.max(0, collection.itemCount - 1);
  await collection.save();

  return {
    success: true,
    message: 'Đã xóa sản phẩm khỏi bộ sưu tập',
    itemCount: collection.itemCount,
  };
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-010
 * Cập nhật Ghi chú phong cách và Ngày sự kiện dự định của sản phẩm
 */
export const updateItemNotes = async (
  userId,
  collectionId,
  itemId,
  { notes, targetUsageDate } = {}
) => {
  if (!userId) throw createError('userId là bắt buộc', 401);
  if (!collectionId) throw createError('collectionId là bắt buộc', 400);
  if (!itemId) throw createError('itemId là bắt buộc', 400);

  const collection = await UserCollection.findById(collectionId);
  if (!collection) {
    throw createError('Bộ sưu tập không tồn tại', 404);
  }

  if (collection.userId.toString() !== userId.toString()) {
    throw createError('Bạn không có quyền thực hiện thao tác này', 403);
  }

  const item = await CollectionItem.findOne({ _id: itemId, collectionId });
  if (!item) {
    throw createError('Sản phẩm không tồn tại trong bộ sưu tập', 404);
  }

  if (notes !== undefined) {
    const trimmedNotes = String(notes).trim();
    if (trimmedNotes.length > 300) {
      throw createError('Ghi chú phong cách không được vượt quá 300 ký tự', 400);
    }
    item.notes = trimmedNotes;
  }

  if (targetUsageDate !== undefined) {
    item.targetUsageDate = targetUsageDate ? new Date(targetUsageDate) : null;
  }

  await item.save();
  return item;
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-002
 * Bật hoặc Tắt chia sẻ công khai cho Bộ sưu tập tùy chỉnh
 */
export const toggleShareCollection = async (userId, collectionId, isPrivate) => {
  if (!userId) throw createError('userId là bắt buộc', 401);
  if (!collectionId) throw createError('collectionId là bắt buộc', 400);

  const collection = await UserCollection.findById(collectionId);
  if (!collection) {
    throw createError('Bộ sưu tập không tồn tại', 404);
  }

  if (collection.userId.toString() !== userId.toString()) {
    throw createError('Bạn không có quyền thay đổi quyền chia sẻ của bộ sưu tập này', 403);
  }

  if (collection.isDefault) {
    throw createError('Không thể chia sẻ bộ sưu tập mặc định', 400);
  }

  const privateState = Boolean(isPrivate);
  collection.isPrivate = privateState;

  // Nếu chuyển sang công khai và chưa có shareCode, sinh mới
  if (!privateState && !collection.shareCode) {
    collection.shareCode = generateShareCode();
  }

  await collection.save();

  return {
    isPrivate: collection.isPrivate,
    shareCode: collection.shareCode,
    shareUrl: collection.shareCode ? `/lookbook/${collection.shareCode}` : null,
  };
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-003
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-004
 * Xem Lookbook công khai theo mã shareCode (Chỉ đọc, không lộ thông tin cá nhân)
 */
export const getSharedLookbook = async (shareCode) => {
  if (!shareCode) {
    throw createError('Mã chia sẻ không hợp lệ', 400);
  }

  const collection = await UserCollection.findOne({
    shareCode: String(shareCode).trim(),
    isPrivate: false,
  }).populate('userId', 'FullName');

  // REQ-SHR-004: Trả về 404 nếu không tìm thấy hoặc ở chế độ riêng tư
  if (!collection) {
    throw createError(
      'Bộ sưu tập này hiện đang ở chế độ riêng tư hoặc không tồn tại',
      404
    );
  }

  const items = await CollectionItem.find({ collectionId: collection._id })
    .sort({ _id: -1 })
    .populate('productId')
    .populate('variantId')
    .lean();

  const itemsWithImages = await attachPrimaryImages(items);

  // Bảo vệ thông tin người dùng: Chỉ hiển thị tên hiển thị, loại bỏ email, SĐT, id nhạy cảm
  return {
    collection: {
      _id: collection._id,
      name: collection.name,
      description: collection.description,
      coverImageUrl: collection.coverImageUrl,
      eventDate: collection.eventDate,
      itemCount: collection.itemCount,
      shareCode: collection.shareCode,
      ownerName: collection.userId?.FullName || 'Thành viên Vestora',
      createdAt: collection.createdAt,
    },
    items: itemsWithImages,
  };
};

/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-005
 * Sao chép một Lookbook công khai vào Tủ đồ cá nhân của người dùng
 */
export const cloneSharedLookbook = async (userId, shareCode) => {
  if (!userId) throw createError('Bạn cần đăng nhập để lưu bộ sưu tập này', 401);

  const sharedData = await getSharedLookbook(shareCode);
  const sourceCol = sharedData.collection;

  // Kiểm tra giới hạn 20 BST của người dùng sao chép
  const customCount = await UserCollection.countDocuments({ userId, isDefault: false });
  if (customCount >= MAX_COLLECTIONS_PER_USER) {
    throw createError(
      `Bạn đã đạt giới hạn tối đa ${MAX_COLLECTIONS_PER_USER} bộ sưu tập cá nhân`,
      422
    );
  }

  // Đặt tên bản sao
  let targetName = `${sourceCol.name} (Bản sao)`.slice(0, 100);
  const duplicate = await UserCollection.findOne({
    userId,
    name: { $regex: new RegExp(`^${escapeRegex(targetName)}$`, 'i') },
  });

  if (duplicate) {
    targetName = `${sourceCol.name} (Bản sao ${Date.now().toString().slice(-4)})`.slice(0, 100);
  }

  const newCol = await UserCollection.create({
    userId,
    name: targetName,
    description: sourceCol.description,
    coverImageUrl: sourceCol.coverImageUrl,
    eventDate: sourceCol.eventDate,
    isDefault: false,
    isPrivate: true,
    itemCount: 0,
  });

  // Sao chép các món trang phục
  let addedCount = 0;
  for (const item of sharedData.items) {
    const rawProd = item.productId;
    const prodId = rawProd && rawProd._id ? rawProd._id : rawProd;
    if (!prodId) continue;

    try {
      await CollectionItem.create({
        collectionId: newCol._id,
        userId,
        productId: prodId,
        variantId: item.variantId?._id || item.variantId || null,
        notes: item.notes || '',
        targetUsageDate: item.targetUsageDate || null,
      });
      addedCount += 1;
    } catch {
      // Bỏ qua nếu có lỗi
    }
  }

  newCol.itemCount = addedCount;
  await newCol.save();

  return newCol;
};
