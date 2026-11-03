import mongoose from 'mongoose';
import Conversation from '../models/chat/Conversation.js';
import Message from '../models/chat/Message.js';
import Shop from '../models/shop/Shop.js';
import { Product } from '../models/masterdata/Product.js';
import { ProductImage } from '../models/masterdata/ProductImages.js';
import User from '../models/system/User.js';
import { Notification } from '../models/system/Notification.js';

// Chuẩn hóa role sang chữ thường
const normalizeRole = (role) => String(role || '').trim().toLowerCase();

/**
 * Kiểm tra xem user có phải là admin không
 * Theo yêu cầu người dùng: "bỏ role admin ko can thiệp vào" -> Admin bị từ chối truy cập chat riêng tư.
 */
export const checkNotAdmin = (userRole) => {
  const r = normalizeRole(userRole);
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
  const shop = await Shop.findOne({
    _id: shopId,
    isDeleted: { $ne: true },
    $or: [{ managerId: userId }, { ownerId: userId }],
  }).lean();
  return Boolean(shop);
};

/**
 * Lấy danh sách Shop ID mà User phụ trách (với vai trò Brand Manager hoặc Shop Owner)
 */
export const getUserManagedShopIds = async (userId, userRole) => {
  const r = normalizeRole(userRole);
  if (r === 'admin') return []; // Admin không can thiệp

  if (r === 'branch_manager' || r === 'brandmanager' || r === 'brand_manager') {
    const shops = await Shop.find({
      managerId: userId,
      isDeleted: { $ne: true },
    }).select('_id').lean();
    return shops.map((s) => s._id);
  }

  if (r === 'owner' || r === 'shop_owner' || r === 'shopowner') {
    const shops = await Shop.find({
      $or: [{ ownerId: userId }, { managerId: userId }],
      isDeleted: { $ne: true },
    }).select('_id').lean();
    return shops.map((s) => s._id);
  }

  return [];
};

/**
 * 1. Bắt đầu hoặc lấy cuộc trò chuyện giữa Customer và Shop
 */
export const getOrCreateConversation = async ({ userId, userRole, productId, shopId }) => {
  checkNotAdmin(userRole);

  let targetShopId = shopId;
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

    if (!product.shopId) {
      const err = new Error('Sản phẩm chưa được gán cho Shop nào');
      err.status = 400;
      throw err;
    }

    targetShopId = product.shopId._id || product.shopId;

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

  if (!targetShopId || !mongoose.Types.ObjectId.isValid(targetShopId)) {
    const err = new Error('Shop ID không hợp lệ hoặc không xác định được Shop');
    err.status = 400;
    throw err;
  }

  const shop = await Shop.findOne({ _id: targetShopId, isDeleted: { $ne: true } }).lean();
  if (!shop) {
    const err = new Error('Gian hàng không tồn tại hoặc đã ngừng hoạt động');
    err.status = 404;
    throw err;
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
        hasChanges = true;
      }
    }

    // Đảm bảo Brand Manager và Owner có trong participants
    const existingParticipants = conversation.participants.map((p) => String(p));
    if (shop.managerId && !existingParticipants.includes(String(shop.managerId))) {
      conversation.participants.push(shop.managerId);
      hasChanges = true;
    }
    if (shop.ownerId && !existingParticipants.includes(String(shop.ownerId))) {
      conversation.participants.push(shop.ownerId);
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
    if (shop.ownerId && String(shop.ownerId) !== String(customerId) && !participants.includes(shop.ownerId)) {
      participants.push(shop.ownerId);
    }

    const unreadMap = new Map();
    // Khách gửi mở đầu nên unread của shop manager/owner là 1
    participants.forEach((pId) => {
      if (String(pId) !== String(customerId)) {
        unreadMap.set(String(pId), 1);
      }
    });

    conversation = new Conversation({
      shopId: targetShopId,
      customerId,
      participants,
      assignedManagerId: shop.managerId || null,
      productContexts: productData ? [productData] : [],
      status: 'ACTIVE',
      lastMessage: {
        content: productData
          ? `Xin chào Shop! Mình muốn được tư vấn thêm về "${productData.productName}".`
          : 'Xin chào Shop! Mình muốn được tư vấn.',
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
      content: productData
        ? `Xin chào Shop! Mình muốn được tư vấn thêm về "${productData.productName}".`
        : 'Xin chào Shop! Mình muốn được tư vấn.',
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

  const r = normalizeRole(userRole);
  let filter = {};

  if (r === 'customer') {
    filter.customerId = userId;
  } else if (r === 'branch_manager' || r === 'brandmanager' || r === 'brand_manager') {
    const shopIds = await getUserManagedShopIds(userId, userRole);
    filter.shopId = { $in: shopIds };
  } else if (r === 'owner' || r === 'shop_owner' || r === 'shopowner') {
    const shopIds = await getUserManagedShopIds(userId, userRole);
    filter.shopId = { $in: shopIds };
  } else {
    // Các role khác không được phép truy cập
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
  const r = normalizeRole(userRole);
  const isCustomerOwner = String(conv.customerId?._id || conv.customerId) === String(userId);
  const isShopManager = String(conv.shopId?.managerId) === String(userId);
  const isShopOwner = String(conv.shopId?.ownerId) === String(userId);

  if (!isCustomerOwner && !isShopManager && !isShopOwner) {
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
 * 4. Lấy lịch sử tin nhắn của cuộc trò chuyện (Cursor-based)
 */
export const getMessages = async ({ conversationId, userId, userRole, before, limit = 30 }) => {
  // Xác thực quyền trước khi xem tin nhắn
  await getConversationById({ conversationId, userId, userRole });

  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const filter = { conversationId, isDeleted: { $ne: true } };

  if (before) {
    filter.createdAt = { $lt: new Date(before) };
  }

  const rawMessages = await Message.find(filter)
    .populate('senderId', 'FullName Email Avatar Role')
    .sort({ createdAt: -1 })
    .limit(safeLimit + 1)
    .lean();

  const hasMore = rawMessages.length > safeLimit;
  const messagesToReturn = hasMore ? rawMessages.slice(0, safeLimit) : rawMessages;

  // Đảo lại thứ tự thời gian tăng dần để frontend hiển thị từ trên xuống dưới
  messagesToReturn.reverse();

  const nextCursor = hasMore && messagesToReturn.length > 0 ? messagesToReturn[0].createdAt : null;

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
  const isCustomer = String(conv.customerId) === String(senderId);
  const isManager = String(conv.shopId?.managerId) === String(senderId);
  const isOwner = String(conv.shopId?.ownerId) === String(senderId);

  if (!isCustomer && !isManager && !isOwner) {
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

  const normalizedRole = isCustomer ? 'customer' : isManager ? 'branch_manager' : 'owner';

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

  // Cập nhật các tin nhắn chưa được user này đọc
  const now = new Date();
  await Message.updateMany(
    {
      conversationId,
      senderId: { $ne: userId },
      'readBy.userId': { $ne: userId },
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

  const isManager = String(conv.shopId?.managerId) === String(userId);
  const isOwner = String(conv.shopId?.ownerId) === String(userId);

  if (!isManager && !isOwner) {
    const err = new Error('Chỉ Quản lý hoặc Chủ gian hàng mới có quyền thay đổi trạng thái cuộc trò chuyện');
    err.status = 403;
    throw err;
  }

  conv.status = String(status).toUpperCase();
  await conv.save();

  return await populateConversation(conversationId);
};

// Helper populate
const populateConversation = async (conversationId) => {
  return await Conversation.findById(conversationId)
    .populate('shopId', 'name imageUrl phone address managerId ownerId status isHQ')
    .populate('customerId', 'FullName Email Avatar Phone')
    .populate('assignedManagerId', 'FullName Email Avatar Phone')
    .lean();
};

