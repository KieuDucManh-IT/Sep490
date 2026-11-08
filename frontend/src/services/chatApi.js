import apiClient from './api';

export const chatApi = {
  /**
   * Tạo hoặc lấy cuộc trò chuyện với Shop
   */
  getOrCreateConversation: async ({ productId, shopId, branchId, branchName } = {}) => {
    return await apiClient.post('/conversations', { productId, shopId, branchId, branchName });
  },

  /**
   * Lấy danh sách cuộc trò chuyện theo vai trò
   */
  getConversations: async ({ status, search, page = 1, limit = 30 } = {}) => {
    return await apiClient.get('/conversations', {
      params: { status, search, page, limit },
    });
  },

  /**
   * Lấy tổng số tin nhắn chưa đọc của người dùng
   */
  getUnreadCount: async () => {
    return await apiClient.get('/conversations/unread-count');
  },

  /**
   * Lấy chi tiết một cuộc trò chuyện
   */
  getConversationDetail: async (conversationId) => {
    return await apiClient.get(`/conversations/${conversationId}`);
  },

  /**
   * Lấy lịch sử tin nhắn kèm cursor
   */
  getMessages: async (conversationId, { before, limit = 30 } = {}) => {
    return await apiClient.get(`/conversations/${conversationId}/messages`, {
      params: { before, limit },
    });
  },

  /**
   * Gửi tin nhắn qua HTTP
   */
  sendMessage: async (conversationId, { content, attachments, clientMessageId, productCard }) => {
    return await apiClient.post(`/conversations/${conversationId}/messages`, {
      content,
      attachments,
      clientMessageId,
      productCard,
    });
  },

  /**
   * Đánh dấu các tin nhắn trong hội thoại là đã đọc
   */
  markAsRead: async (conversationId) => {
    return await apiClient.post(`/conversations/${conversationId}/read`, {});
  },

  /**
   * Tải ảnh lên Cloudinary
   */
  uploadImages: async (conversationId, files) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('images', files[i]);
    }
    return await apiClient.post(`/conversations/${conversationId}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },

  /**
   * Cập nhật trạng thái cuộc trò chuyện
   */
  updateConversationStatus: async (conversationId, status) => {
    return await apiClient.patch(`/conversations/${conversationId}/status`, { status });
  },
};

export default chatApi;

