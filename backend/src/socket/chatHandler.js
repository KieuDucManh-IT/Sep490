import * as conversationService from '../services/conversationService.js';
import Conversation from '../models/chat/Conversation.js';

export default function registerChatHandlers(io, socket) {
  const userId = String(socket.user._id);
  const userName = socket.user.FullName || socket.user.fullName || 'Người dùng';
  const userRole = socket.user.Role || socket.user.role;

  /**
   * 1. Tham gia phòng chat của cuộc trò chuyện
   * Client: socket.emit('conversation:join', { conversationId })
   */
  socket.on('conversation:join', async ({ conversationId }, callback) => {
    try {
      if (!conversationId) {
        return callback?.({ error: 'Conversation ID là bắt buộc' });
      }

      // Kiểm tra quyền từ Database
      const conv = await conversationService.getConversationById({
        conversationId,
        userId,
        userRole,
      });

      const roomName = `conversation:${conversationId}`;
      socket.join(roomName);

      callback?.({ success: true, conversation: conv });
      socket.emit('conversation:joined', { conversationId });
    } catch (err) {
      console.error('Lỗi khi tham gia conversation:', err.message);
      callback?.({ error: err.message || 'Không thể tham gia cuộc trò chuyện' });
      socket.emit('message:error', { message: err.message });
    }
  });

  /**
   * 2. Rời phòng chat
   * Client: socket.emit('conversation:leave', { conversationId })
   */
  socket.on('conversation:leave', ({ conversationId }) => {
    if (conversationId) {
      const roomName = `conversation:${conversationId}`;
      socket.leave(roomName);
    }
  });

  /**
   * 3. Gửi tin nhắn mới
   * Client: socket.emit('message:send', { conversationId, content, attachments, clientMessageId, productCard })
   */
  socket.on(
    'message:send',
    async (
      { conversationId, content, attachments, clientMessageId, productCard },
      callback
    ) => {
      try {
        if (!conversationId) {
          throw new Error('Conversation ID là bắt buộc');
        }

        // Lưu tin nhắn vào MongoDB qua service
        const message = await conversationService.sendMessage({
          conversationId,
          senderId: userId,
          senderRole: userRole,
          content,
          attachments,
          clientMessageId,
          productCard,
        });

        // 1. Phản hồi thành công cho người gửi
        callback?.({ success: true, message, clientMessageId });
        socket.emit('message:sent', { success: true, message, clientMessageId });

        // 2. Phát tin nhắn đến phòng chat của cuộc trò chuyện
        io.to(`conversation:${conversationId}`).emit('message:new', {
          message,
          conversationId,
        });

        // 3. Cập nhật danh sách hội thoại cho tất cả các bên tham gia (kể cả khi chưa mở phòng chat)
        const conv = await Conversation.findById(conversationId)
          .select('participants shopId customerId')
          .populate('shopId', 'ownerId managerId')
          .lean();

        if (conv) {
          const recipientIds = new Set();
          if (conv.customerId) recipientIds.add(String(conv.customerId));
          if (conv.shopId?.ownerId) recipientIds.add(String(conv.shopId.ownerId));
          if (conv.shopId?.managerId) recipientIds.add(String(conv.shopId.managerId));
          if (Array.isArray(conv.participants)) {
            conv.participants.forEach((p) => recipientIds.add(String(p)));
          }

          recipientIds.forEach((pId) => {
            io.to(`user:${pId}`).emit('conversation:updated', {
              conversationId,
              lastMessage: message,
            });
          });
        }
      } catch (err) {
        console.error('Lỗi khi gửi tin nhắn qua Socket:', err.message);
        callback?.({ error: err.message || 'Không thể gửi tin nhắn' });
        socket.emit('message:error', {
          conversationId,
          clientMessageId,
          message: err.message || 'Không thể gửi tin nhắn',
        });
      }
    }
  );

  /**
   * 4. Đánh dấu đã đọc tin nhắn
   * Client: socket.emit('message:read', { conversationId })
   */
  socket.on('message:read', async ({ conversationId }) => {
    try {
      if (!conversationId) return;

      const result = await conversationService.markMessagesAsRead({
        conversationId,
        userId,
      });

      // Phát sự kiện cập nhật trạng thái đã xem đến đối phương trong phòng
      io.to(`conversation:${conversationId}`).emit('message:read:update', {
        conversationId,
        readByUserId: userId,
        readAt: result.readAt,
      });
    } catch (err) {
      console.error('Lỗi khi cập nhật đã đọc qua Socket:', err.message);
    }
  });

  /**
   * 5. Bắt đầu nhập tin nhắn
   * Client: socket.emit('typing:start', { conversationId })
   */
  socket.on('typing:start', ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(`conversation:${conversationId}`).emit('typing:update', {
      conversationId,
      userId,
      userName,
      isTyping: true,
    });
  });

  /**
   * 6. Dừng nhập tin nhắn
   * Client: socket.emit('typing:stop', { conversationId })
   */
  socket.on('typing:stop', ({ conversationId }) => {
    if (!conversationId) return;
    socket.to(`conversation:${conversationId}`).emit('typing:update', {
      conversationId,
      userId,
      userName,
      isTyping: false,
    });
  });
}
