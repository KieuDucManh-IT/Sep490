import * as conversationService from '../services/conversationService.js';
import { uploadToCloudinary } from '../config/cloudinary.js';

/**
 * POST /api/conversations
 * Tạo hoặc lấy cuộc trò chuyện với Shop
 */
export const createOrGetConversation = async (req, res, next) => {
  try {
    const { productId, shopId, branchId, branchName } = req.body;
    const userId = req.user._id;
    const userRole = req.user.Role || req.user.role;

    const conversation = await conversationService.getOrCreateConversation({
      userId,
      userRole,
      productId,
      shopId,
      branchId,
      branchName,
    });

    return res.status(200).json({
      success: true,
      message: 'Lấy thông tin cuộc trò chuyện thành công',
      conversation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/conversations
 * Lấy danh sách cuộc trò chuyện theo phân quyền
 */
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.Role || req.user.role;
    const { status, search, page, limit } = req.query;

    const data = await conversationService.listConversations({
      userId,
      userRole,
      status,
      search,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/conversations/:id
 * Lấy chi tiết một cuộc trò chuyện
 */
export const getConversationDetail = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user._id;
    const userRole = req.user.Role || req.user.role;

    const conversation = await conversationService.getConversationById({
      conversationId,
      userId,
      userRole,
    });

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/conversations/:id/messages
 * Lấy danh sách tin nhắn (phân trang Cursor)
 */
export const getConversationMessages = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user._id;
    const userRole = req.user.Role || req.user.role;
    const { before, limit } = req.query;

    const result = await conversationService.getMessages({
      conversationId,
      userId,
      userRole,
      before,
      limit,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conversations/:id/messages
 * Gửi tin nhắn qua HTTP (Fallback hoặc tin có kèm upload)
 */
export const sendMessageHttp = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const senderId = req.user._id;
    const senderRole = req.user.Role || req.user.role;
    const { content, attachments, clientMessageId, productCard } = req.body;

    const message = await conversationService.sendMessage({
      conversationId,
      senderId,
      senderRole,
      content,
      attachments,
      clientMessageId,
      productCard,
    });

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conversations/:id/read
 * Đánh dấu đã đọc các tin nhắn
 */
export const markAsReadHttp = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user._id;

    const result = await conversationService.markMessagesAsRead({
      conversationId,
      userId,
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/conversations/:id/images
 * Upload từ 1 - 5 ảnh tư vấn lên Cloudinary
 */
export const uploadChatImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất 1 hình ảnh để tải lên',
      });
    }

    if (req.files.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Mỗi lần gửi tối đa 5 hình ảnh',
      });
    }

    const uploadPromises = req.files.map(async (file) => {
      // Validate dung lượng (5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error(`Ảnh "${file.originalname}" vượt quá giới hạn 5MB`);
      }

      const res = await uploadToCloudinary(
        file.buffer,
        {
          folder: 'vestora/chat',
          resource_type: 'image',
        },
        file.mimetype
      );

      return {
        url: res.secure_url,
        publicId: res.public_id,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        width: res.width,
        height: res.height,
      };
    });

    const attachments = await Promise.all(uploadPromises);

    return res.status(200).json({
      success: true,
      message: 'Tải ảnh lên thành công',
      attachments,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/conversations/:id/status
 * Cập nhật trạng thái cuộc trò chuyện
 */
export const updateConversationStatusHttp = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const userId = req.user._id;
    const userRole = req.user.Role || req.user.role;
    const { status } = req.body;

    const conversation = await conversationService.updateConversationStatus({
      conversationId,
      userId,
      userRole,
      status,
    });

    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái cuộc trò chuyện thành công',
      conversation,
    });
  } catch (error) {
    next(error);
  }
};

