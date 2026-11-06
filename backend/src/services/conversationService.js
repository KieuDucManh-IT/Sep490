import mongoose from 'mongoose';
import Conversation from '../models/chat/Conversation.js';
import Message from '../models/chat/Message.js';
import Shop from '../models/shop/Shop.js';
import { Product } from '../models/masterdata/Product.js';
import { ProductImage } from '../models/masterdata/ProductImages.js';
import { ProductVariant } from '../models/masterdata/ProductVariant.js';
import { InventoryBalance } from '../models/warehouse/inventory/InventoryBalance.js';
import { InventoryItem } from '../models/warehouse/inventory/InventoryItem.js';
import { InventoryLocation } from '../models/warehouse/location/InventoryLocation.js';
import User from '../models/system/User.js';

// Chuẩn hóa role sang chữ thường và loại bỏ ký tự khoảng trắng/gạch nối
const cleanRole = (role) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '')
    .replace('brandmanager', 'branchmanager');

/**
 * Kiểm tra xem user có phải là admin không
 * Theo yêu cầu người dùng: "bỏ role admin ko can thiệp vào" -> Admin bị từ chối truy cập chat riêng tư.
 */
export const checkNotAdmin = (userRole) => {
  const r = cleanRole(userRole);
  if (r === 'admin') {
    const error = new Error('Quản trị viên (Admin) không có quyền truy cập vào cuộc trò chuyện riêng tư của Shop và Khách hàng.');
    error.status = 403;
    throw error;
  }
};

/**
 * Kiểm tra quyền của User đối với một Shop cụ thể
 */
export const isUserShopManagerOrOwner = async (userId, shopId) => {
  if (!userId || !shopId) return false;
  const sId = shopId._id || shopId;

  // 1. Kiểm tra trực tiếp trên Shop
  const shop = await Shop.findOne({
    _id: sId,
    isDeleted: { $ne: true },
    $or: [{ managerId: userId }, { ownerId: userId }],
  }).lean();
  if (shop) return true;

  // 2. Kiểm tra nếu user là quản lý kho/cửa hàng của Shop đó
  const loc = await InventoryLocation.findOne({
    shopId: sId,
    managerId: userId,
  }).lean();
  return Boolean(loc);
};

/**
 * Lấy danh sách Shop ID mà User phụ trách (với vai trò Brand Manager hoặc Shop Owner)
 */
export const getUserManagedShopIds = async (userId, userRole) => {
  const r = cleanRole(userRole);
  if (r === 'admin') return []; // Admin không can thiệp

  if (r === 'branchmanager') {
    const [shopsAsManager, locsAsManager] = await Promise.all([
      Shop.find({
        $or: [{ managerId: userId }, { ownerId: userId }],
        isDeleted: { $ne: true },
      }).select('_id').lean(),
      InventoryLocation.find({
        managerId: userId,
        shopId: { $ne: null },
      }).select('shopId').lean(),
    ]);

    const ids = new Set([
      ...shopsAsManager.map((s) => String(s._id)),
      ...locsAsManager.map((l) => String(l.shopId)),
    ]);
    return Array.from(ids);
  }

  if (r === 'owner' || r === 'shopowner') {
    let shops = await Shop.find({
      $or: [{ ownerId: userId }, { managerId: userId }],
      isDeleted: { $ne: true },
    }).select('_id').lean();

    // Nếu shop chưa gắn ownerId cụ thể, fallback toàn bộ shop đang hoạt động
    if (shops.length === 0) {
      shops = await Shop.find({ isDeleted: { $ne: true } }).select('_id').lean();
    }
    return shops.map((s) => s._id);
  }

  return [];
};

/**
 * 1. Bắt đầu hoặc lấy cuộc trò chuyện giữa Customer và Shop
 */
export const getOrCreateConversation = async ({
  userId,
  userRole,
  productId,
  shopId,
  branchId,
  branchName,
}) => {
  checkNotAdmin(userRole);

  let targetShopId = null;
  if (shopId) {
    if (typeof shopId === 'object' && shopId !== null) {
      targetShopId = shopId._id || shopId.id || null;
    } else if (typeof shopId === 'string' && mongoose.Types.ObjectId.isValid(shopId)) {
      targetShopId = shopId;
    }
  }

  // 1. Nếu targetShopId thực chất là một InventoryLocation, chuyển đổi sang ShopId tương ứng
  if (targetShopId) {
    const isRealShop = await Shop.exists({ _id: targetShopId, isDeleted: { $ne: true } });
    if (!isRealShop) {
      const loc = await InventoryLocation.findById(targetShopId).lean();
      if (loc?.shopId) {
        targetShopId = loc.shopId._id || loc.shopId;
      }
    }
  }

  // 2. Nếu chưa có targetShopId nhưng có branchId (locationId)
  if (!targetShopId && branchId && mongoose.Types.ObjectId.isValid(branchId)) {
    const loc = await InventoryLocation.findById(branchId).lean();
    if (loc?.shopId) {
      targetShopId = loc.shopId._id || loc.shopId;
    }
  }

  // 3. Nếu có branchName, đối chiếu thông minh với danh sách Shop theo tên
  if (branchName) {
    const cleanBranchName = String(branchName)
      .replace(/kho|chi nhánh|cơ sở|showroom/gi, '')
      .trim();
    if (cleanBranchName) {
      const matchedShop = await Shop.findOne({
        name: new RegExp(cleanBranchName, 'i'),
        isDeleted: { $ne: true },
      }).lean();
      if (matchedShop) {
        targetShopId = matchedShop._id;
      }
    }
  }

  let productData = null;

  // Nếu có productId, xác thực từ database sản phẩm
  if (productId) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      const err = new Error('Product ID không hợp lệ');
      err.status = 400;
      throw err;
    }

    const product = await Product.findOne({ _id: productId, isDeleted: { $ne: true } })
      .populate('shopId')
      .lean();

    if (!product) {
      const err = new Error('Không tìm thấy sản phẩm hoặc sản phẩm đã bị gỡ');
      err.status = 404;
      throw err;
    }

    // 1. Ưu tiên shopId từ sản phẩm nếu targetShopId chưa có
    if (!targetShopId && product.shopId) {
      if (typeof product.shopId === 'object' && product.shopId._id) {
        targetShopId = product.shopId._id;
      } else if (mongoose.Types.ObjectId.isValid(product.shopId)) {
        targetShopId = product.shopId;
      }
    }

    // 2. Nếu sản phẩm chưa có shopId, tìm từ InventoryLocation của biến thể
    if (!targetShopId) {
      try {
        const variants = await ProductVariant.find({ productId: product._id }).select('_id').lean();
        const variantIds = variants.map((v) => v._id);
        if (variantIds.length > 0) {
          const itemWithLoc = await InventoryItem.findOne({
            variantId: { $in: variantIds },
            locationId: { $ne: null },
          }).populate('locationId').lean();

          if (itemWithLoc?.locationId?.shopId) {
            targetShopId = itemWithLoc.locationId.shopId._id || itemWithLoc.locationId.shopId;
          } else {
            const balanceWithLoc = await InventoryBalance.findOne({
              variantId: { $in: variantIds },
              locationId: { $ne: null },
            }).populate('locationId').lean();
            if (balanceWithLoc?.locationId?.shopId) {
              targetShopId = balanceWithLoc.locationId.shopId._id || balanceWithLoc.locationId.shopId;
            }
          }
        }
      } catch (locErr) {
        console.warn('Lỗi tìm Shop từ InventoryLocation:', locErr.message);
      }
    }

    // 3. Nếu vẫn chưa có targetShopId, fallback về Trụ sở chính (HQ) hoặc Shop đầu tiên
    if (!targetShopId) {
      const defaultShop =
        (await Shop.findOne({ isHQ: true, isDeleted: { $ne: true } }).lean()) ||
        (await Shop.findOne({ isDeleted: { $ne: true } }).lean());
      if (defaultShop) {
        targetShopId = defaultShop._id;
      }
    }

    // Tự động liên kết shopId cho sản phẩm nếu trước đó bị thiếu
    if (targetShopId && (!product.shopId || !product.shopId._id)) {
      try {
        await Product.updateOne({ _id: product._id }, { $set: { shopId: targetShopId } });
      } catch (_) { }
    }

    // Lấy ảnh đại diện sản phẩm
    let primaryImage = '';
    const imgDoc = await ProductImage.findOne({ productId: product._id, isPrimary: true }).lean();
    if (imgDoc?.imageUrl) {
      primaryImage = imgDoc.imageUrl;
    } else {
      const fallbackImg = await ProductImage.findOne({ productId: product._id }).sort({ displayOrder: 1 }).lean();
      primaryImage = fallbackImg?.imageUrl || product.imageUrl || '';
    }

    productData = {
      productId: product._id,
      productName: product.name,
      productImage: primaryImage,
      rentalPrice: product.rentalPricePerDay || 0,
      salePrice: product.salePrice || 0,
      productCode: product.productCode || '',
      productUrl: `/product/${product._id}`,
      addedAt: new Date(),
    };
  }

  // Fallback an toàn nếu chưa có targetShopId
  if (!targetShopId || !mongoose.Types.ObjectId.isValid(targetShopId)) {
    const anyShop =
      (await Shop.findOne({ isHQ: true, isDeleted: { $ne: true } }).lean()) ||
      (await Shop.findOne({ isDeleted: { $ne: true } }).lean());
    if (anyShop) {
      targetShopId = anyShop._id;
    } else {
      const err = new Error('Hệ thống chưa tìm thấy thông tin Gian hàng phù hợp.');
      err.status = 400;
      throw err;
    }
  }

  const shop = await Shop.findOne({ _id: targetShopId, isDeleted: { $ne: true } }).lean();
  if (!shop) {
    const err = new Error('Gian hàng không tồn tại hoặc đã ngừng hoạt động');
    err.status = 404;
    throw err;
  }

  // Đảm bảo Shop có ownerId nếu bị thiếu trong DB
  let resolvedOwnerId = shop.ownerId;
  if (!resolvedOwnerId) {
    const anyOwner = await User.findOne({
      Role: { $in: ['owner', 'shop_owner', 'shopowner', 'OWNER', 'SHOP_OWNER', 'SHOPOWNER'] },
      Status: 'active',
    }).select('_id').lean();
    if (anyOwner) {
      resolvedOwnerId = anyOwner._id;
      await Shop.updateOne({ _id: shop._id }, { $set: { ownerId: anyOwner._id } });
    }
  }

  const customerId = userId;

  // Tìm cuộc trò chuyện hiện tại
  let conversation = await Conversation.findOne({ customerId, shopId: targetShopId });

  if (conversation) {
    let hasChanges = false;

    // Nếu có sản phẩm mới và chưa nằm trong danh sách ngữ cảnh sản phẩm
    if (productData) {
      const exists = conversation.productContexts.some(
        (p) => String(p.productId) === String(productData.productId)
      );
      if (!exists) {
        conversation.productContexts.unshift(productData);
      }

      const inquiryContent = branchName
        ? `Xin chào Shop! Mình muốn được tư vấn thêm về "${productData.productName}" tại cơ sở ${branchName}.`
        : `Xin chào Shop! Mình muốn được tư vấn thêm về "${productData.productName}".`;

      const inquiryMessage = new Message({
        conversationId: conversation._id,
        senderId: customerId,
        senderRole: 'customer',
        messageType: 'PRODUCT_CARD',
        content: inquiryContent,
        productCard: {
          productId: productData.productId,
          name: productData.productName,
          image: productData.productImage,
          rentalPrice: productData.rentalPrice,
          salePrice: productData.salePrice,
          productCode: productData.productCode,
          url: productData.productUrl,
        },
        readBy: [{ userId: customerId, readAt: new Date() }],
        status: 'SENT',
      });
      await inquiryMessage.save();

      conversation.lastMessage = {
        content: inquiryContent,
        senderId: customerId,
        senderRole: 'customer',
        messageType: 'PRODUCT_CARD',
        createdAt: new Date(),
      };
      conversation.lastMessageAt = new Date();
      hasChanges = true;
    }

    // Đảm bảo Brand Manager và Owner có trong participants
    const existingParticipants = conversation.participants.map((p) => String(p));
    if (shop.managerId && !existingParticipants.includes(String(shop.managerId))) {
      conversation.participants.push(shop.managerId);
      hasChanges = true;
    }
    if (resolvedOwnerId && !existingParticipants.includes(String(resolvedOwnerId))) {
      conversation.participants.push(resolvedOwnerId);
      hasChanges = true;
    }

    if (hasChanges) {
      await conversation.save();
    }
  } else {
    // Tạo cuộc trò chuyện mới
    const participants = [customerId];
    if (shop.managerId && String(shop.managerId) !== String(customerId)) {
      participants.push(shop.managerId);
    }
    if (resolvedOwnerId && String(resolvedOwnerId) !== String(customerId) && !participants.includes(resolvedOwnerId)) {
      participants.push(resolvedOwnerId);
    }

    const unreadMap = new Map();
    // Khách gửi mở đầu nên unread của shop manager/owner là 1
    participants.forEach((pId) => {
      if (String(pId) !== String(customerId)) {
        unreadMap.set(String(pId), 1);
      }
    });

    const initialText = productData
      ? (branchName
        ? `Xin chào Shop! Mình muốn được tư vấn thêm về "${productData.productName}" tại cơ sở ${branchName}.`
        : `Xin chào Shop! Mình muốn được tư vấn thêm về "${productData.productName}".`)
      : (branchName
        ? `Xin chào Shop! Mình muốn được tư vấn tại cơ sở ${branchName}.`
        : 'Xin chào Shop! Mình muốn được tư vấn.');

    conversation = new Conversation({
      shopId: targetShopId,
      customerId,
      participants,
      assignedManagerId: shop.managerId || null,
      productContexts: productData ? [productData] : [],
      status: 'ACTIVE',
      lastMessage: {
        content: initialText,
        senderId: customerId,
        senderRole: 'customer',
        messageType: productData ? 'PRODUCT_CARD' : 'TEXT',
        createdAt: new Date(),
      },
      lastMessageAt: new Date(),
      unreadCounts: unreadMap,
    });

    await conversation.save();

    // Tạo tin nhắn chào hỏi / thẻ sản phẩm ban đầu trong DB
    const initialMessage = new Message({
      conversationId: conversation._id,
      senderId: customerId,
      senderRole: 'customer',
      messageType: productData ? 'PRODUCT_CARD' : 'TEXT',
      content: initialText,
      productCard: productData
        ? {
          productId: productData.productId,
          name: productData.productName,
          image: productData.productImage,
          rentalPrice: productData.rentalPrice,
          salePrice: productData.salePrice,
          productCode: productData.productCode,
          url: productData.productUrl,
        }
        : null,
      readBy: [{ userId: customerId, readAt: new Date() }],
      status: 'SENT',
    });

    await initialMessage.save();
  }

  // Populate đầy đủ trước khi trả về
  return await populateConversation(conversation._id);
};

/**
 * 2. Lấy danh sách các cuộc trò chuyện của User
 */
export const listConversations = async ({ userId, userRole, status, search, page = 1, limit = 30 }) => {
  checkNotAdmin(userRole);

  const r = cleanRole(userRole);
  let filter = {};

  if (r === 'customer') {
    filter.customerId = userId;
  } else if (r === 'branchmanager' || r === 'owner' || r === 'shopowner') {
    const shopIds = await getUserManagedShopIds(userId, userRole);
    filter.shopId = { $in: shopIds };
  } else {
    return { conversations: [], total: 0, page, totalPages: 0 };
  }

  if (status) {
    filter.status = status.toUpperCase();
  } else {
    filter.status = { $ne: 'ARCHIVED' };
  }

  const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

  const query = Conversation.find(filter)
    .populate('shopId', 'name imageUrl phone address managerId ownerId status isHQ')
    .populate('customerId', 'FullName Email Avatar Phone')
    .populate('assignedManagerId', 'FullName Email Avatar')
    .sort({ lastMessageAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  let conversations = await query.lean();
  const total = await Conversation.countDocuments(filter);

  // Nếu có tìm kiếm theo tên
  if (search && String(search).trim()) {
    const q = String(search).trim().toLowerCase();
    conversations = conversations.filter((c) => {
      const shopName = c.shopId?.name?.toLowerCase() || '';
      const customerName = c.customerId?.FullName?.toLowerCase() || '';
      return shopName.includes(q) || customerName.includes(q);
    });
  }

  // Gắn số tin chưa đọc riêng cho user
  const formatted = conversations.map((conv) => {
    let unreadCount = 0;
    if (conv.unreadCounts) {
      if (conv.unreadCounts instanceof Map) {
        unreadCount = conv.unreadCounts.get(String(userId)) || 0;
      } else if (typeof conv.unreadCounts === 'object') {
        unreadCount = conv.unreadCounts[String(userId)] || 0;
      }
    }
    return {
      ...conv,
      unreadCount,
    };
  });

  return {
    conversations: formatted,
    total,
    page: Number(page),
    totalPages: Math.ceil(total / Number(limit)),
  };
};

/**
 * 3. Lấy chi tiết cuộc trò chuyện và kiểm tra quyền
 */
export const getConversationById = async ({ conversationId, userId, userRole }) => {
  checkNotAdmin(userRole);

  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    const err = new Error('Conversation ID không hợp lệ');
    err.status = 400;
    throw err;
  }

  const conv = await Conversation.findById(conversationId)
    .populate('shopId', 'name imageUrl phone address managerId ownerId status isHQ')
    .populate('customerId', 'FullName Email Avatar Phone Status')
    .populate('assignedManagerId', 'FullName Email Avatar Phone')
    .lean();

  if (!conv) {
    const err = new Error('Không tìm thấy cuộc trò chuyện');
    err.status = 404;
    throw err;
  }

  // Xác thực quyền truy cập
  const r = cleanRole(userRole);
  const isCustomerOwner = String(conv.customerId?._id || conv.customerId) === String(userId);
  const isShopManager = String(conv.shopId?.managerId) === String(userId);
  const isShopOwner = String(conv.shopId?.ownerId) === String(userId);
  const isStaffAllowed = await isUserShopManagerOrOwner(userId, conv.shopId?._id || conv.shopId);
  const isOwnerRole = ['owner', 'shopowner'].includes(r);

  if (!isCustomerOwner && !isShopManager && !isShopOwner && !isStaffAllowed && !isOwnerRole) {
    const err = new Error('Bạn không có quyền truy cập cuộc trò chuyện này');
    err.status = 403;
    throw err;
  }

  let unreadCount = 0;
  if (conv.unreadCounts) {
    if (conv.unreadCounts instanceof Map) {
      unreadCount = conv.unreadCounts.get(String(userId)) || 0;
    } else if (typeof conv.unreadCounts === 'object') {
      unreadCount = conv.unreadCounts[String(userId)] || 0;
    }
  }

  return {
    ...conv,
    unreadCount,
  };
};

/**
 * Cấu hình thời gian lưu trữ truy vấn tin nhắn: 3 tháng (90 ngày)
 * Các tin nhắn cũ hơn 3 tháng sẽ không được gọi lại khi truy vấn để tối ưu hóa hiệu năng và tốc độ database
 */
export const MESSAGE_RETENTION_DAYS = 90;
export const MESSAGE_RETENTION_MS = MESSAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export const getRetentionCutoffDate = () => {
  return new Date(Date.now() - MESSAGE_RETENTION_MS);
};

/**
 * 4. Lấy lịch sử tin nhắn của cuộc trò chuyện (Cursor-based)
 * Giới hạn thời gian: Sau 3 tháng (90 ngày) sẽ không gọi lại tin nhắn cũ hơn nữa để bảo toàn tốc độ query.
 */
export const getMessages = async ({ conversationId, userId, userRole, before, limit = 30 }) => {
  // Xác thực quyền trước khi xem tin nhắn
  await getConversationById({ conversationId, userId, userRole });

  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const retentionCutoff = getRetentionCutoffDate();

  // Nếu client gửi cursor 'before' nhưng cursor này đã cũ hơn mốc 3 tháng -> dừng ngay, không query
  if (before && new Date(before) <= retentionCutoff) {
    return {
      messages: [],
      hasMore: false,
      nextCursor: null,
    };
  }

  const filter = {
    conversationId,
    isDeleted: { $ne: true },
    createdAt: {
      $gte: retentionCutoff,
      ...(before ? { $lt: new Date(before) } : {}),
    },
  };

  const rawMessages = await Message.find(filter)
    .populate('senderId', 'FullName Email Avatar Role')
    .sort({ createdAt: -1 })
    .limit(safeLimit + 1)
    .lean();

  let hasMore = rawMessages.length > safeLimit;
  const messagesToReturn = hasMore ? rawMessages.slice(0, safeLimit) : rawMessages;

  // Đảo lại theo thứ tự thời gian tăng dần để client hiển thị từ cũ đến mới
  messagesToReturn.reverse();

  let nextCursor = hasMore && messagesToReturn.length > 0 ? messagesToReturn[0].createdAt : null;

  // Nếu con trỏ phân trang tiếp theo đã vượt quá mốc 3 tháng -> không còn tin nhắn khả dụng trong kỳ retention
  if (nextCursor && new Date(nextCursor) <= retentionCutoff) {
    hasMore = false;
    nextCursor = null;
  }

  return {
    messages: messagesToReturn,
    hasMore,
    nextCursor,
  };
};

/**
 * 5. Gửi tin nhắn mới (Dùng chung cho cả Socket.IO và REST API fallback)
 */
export const sendMessage = async ({
  conversationId,
  senderId,
  senderRole,
  content = '',
  attachments = [],
  clientMessageId,
  productCard = null,
}) => {
  checkNotAdmin(senderRole);

  const conv = await Conversation.findById(conversationId).populate('shopId');
  if (!conv) {
    const err = new Error('Cuộc trò chuyện không tồn tại');
    err.status = 404;
    throw err;
  }

  // Kiểm tra quyền gửi tin
  const r = cleanRole(senderRole);
  const isCustomer = String(conv.customerId) === String(senderId);
  const isManager = String(conv.shopId?.managerId) === String(senderId);
  const isOwner = String(conv.shopId?.ownerId) === String(senderId);
  const isStaffAllowed = await isUserShopManagerOrOwner(senderId, conv.shopId?._id || conv.shopId);
  const isOwnerRole = ['owner', 'shopowner'].includes(r);

  if (!isCustomer && !isManager && !isOwner && !isStaffAllowed && !isOwnerRole) {
    const err = new Error('Bạn không có quyền gửi tin nhắn trong cuộc trò chuyện này');
    err.status = 403;
    throw err;
  }

  // Cơ chế chống gửi trùng Idempotency
  if (clientMessageId) {
    const existing = await Message.findOne({ conversationId, clientMessageId })
      .populate('senderId', 'FullName Email Avatar Role')
      .lean();
    if (existing) {
      return existing;
    }
  }

  // Validate nội dung
  const trimmedContent = String(content || '').trim();
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (!trimmedContent && !hasAttachments && !productCard) {
    const err = new Error('Tin nhắn phải có nội dung văn bản, hình ảnh hoặc thẻ sản phẩm');
    err.status = 400;
    throw err;
  }

  let messageType = 'TEXT';
  if (hasAttachments) {
    messageType = 'IMAGE';
  } else if (productCard) {
    messageType = 'PRODUCT_CARD';
  }

  const normalizedRole = isCustomer ? 'customer' : (isManager || r === 'branchmanager') ? 'branch_manager' : 'owner';

  const message = new Message({
    conversationId,
    senderId,
    senderRole: normalizedRole,
    messageType,
    content: trimmedContent,
    attachments: hasAttachments ? attachments : [],
    productCard: productCard || null,
    clientMessageId: clientMessageId || null,
    readBy: [{ userId: senderId, readAt: new Date() }],
    status: 'SENT',
  });

  await message.save();

  // Cập nhật Conversation
  conv.lastMessage = {
    content: trimmedContent || (hasAttachments ? '[Hình ảnh]' : '[Sản phẩm]'),
    senderId,
    senderRole: normalizedRole,
    messageType,
    createdAt: new Date(),
  };
  conv.lastMessageAt = new Date();

  // Tăng unread count cho đối phương
  if (!conv.unreadCounts) {
    conv.unreadCounts = new Map();
  }

  conv.participants.forEach((pId) => {
    const pStr = String(pId);
    if (pStr !== String(senderId)) {
      const current = conv.unreadCounts.get(pStr) || 0;
      conv.unreadCounts.set(pStr, current + 1);
    }
  });

  await conv.save();

  return await Message.findById(message._id)
    .populate('senderId', 'FullName Email Avatar Role')
    .lean();
};

/**
 * 6. Đánh dấu đã đọc tất cả tin nhắn trong cuộc trò chuyện
 */
export const markMessagesAsRead = async ({ conversationId, userId }) => {
  const conv = await Conversation.findById(conversationId);
  if (!conv) {
    const err = new Error('Cuộc trò chuyện không tồn tại');
    err.status = 404;
    throw err;
  }

  // Cập nhật các tin nhắn chưa được user này đọc trong phạm vi 3 tháng gần nhất để tối ưu tốc độ
  const now = new Date();
  const retentionCutoff = getRetentionCutoffDate();
  await Message.updateMany(
    {
      conversationId,
      senderId: { $ne: userId },
      'readBy.userId': { $ne: userId },
      createdAt: { $gte: retentionCutoff },
    },
    {
      $push: { readBy: { userId, readAt: now } },
      $set: { status: 'READ' },
    }
  );

  // Reset số tin chưa đọc của user về 0
  if (conv.unreadCounts) {
    conv.unreadCounts.set(String(userId), 0);
    await conv.save();
  }

  return { success: true, conversationId, userId, readAt: now };
};

/**
 * 7. Cập nhật trạng thái cuộc trò chuyện (Chỉ Shop Manager hoặc Owner)
 */
export const updateConversationStatus = async ({ conversationId, userId, userRole, status }) => {
  checkNotAdmin(userRole);

  const allowedStatuses = ['ACTIVE', 'CLOSED', 'ARCHIVED'];
  if (!allowedStatuses.includes(String(status).toUpperCase())) {
    const err = new Error('Trạng thái không hợp lệ');
    err.status = 400;
    throw err;
  }

  const conv = await Conversation.findById(conversationId).populate('shopId');
  if (!conv) {
    const err = new Error('Không tìm thấy cuộc trò chuyện');
    err.status = 404;
    throw err;
  }

  const r = cleanRole(userRole);
  const isManager = String(conv.shopId?.managerId) === String(userId);
  const isOwner = String(conv.shopId?.ownerId) === String(userId);
  const isStaffAllowed = await isUserShopManagerOrOwner(userId, conv.shopId?._id || conv.shopId);
  const isOwnerRole = ['owner', 'shopowner'].includes(r);

  if (!isManager && !isOwner && !isStaffAllowed && !isOwnerRole) {
    const err = new Error('Chỉ Quản lý hoặc Chủ gian hàng mới có quyền thay đổi trạng thái cuộc trò chuyện');
    err.status = 403;
    throw err;
  }

  conv.status = String(status).toUpperCase();
  await conv.save();

  return await populateConversation(conversationId);
};


const populateConversation = async (conversationId) => {
  return await Conversation.findById(conversationId)
    .populate('shopId', 'name imageUrl phone address managerId ownerId status isHQ')
    .populate('customerId', 'FullName Email Avatar Phone')
    .populate('assignedManagerId', 'FullName Email Avatar Phone')
    .lean();
};
