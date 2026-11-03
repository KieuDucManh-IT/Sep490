import React, { useState, useEffect, useCallback } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ImageLightbox from './ImageLightbox';
import ProductReferenceCard from './ProductReferenceCard';
import chatApi from '../../services/chatApi';
import socketService from '../../services/socket';

export default function ChatWindow({
  conversation,
  currentUserId,
  isCustomerView,
  onlineUserIds = [],
  onBack,
  onConversationUpdated,
}) {
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [lightboxImage, setLightboxImage] = useState(null);

  const conversationId = conversation?._id;

  // 1. Tải lịch sử tin nhắn khi mở hội thoại
  const loadMessages = useCallback(async (convId) => {
    if (!convId) return;
    setIsLoadingMessages(true);
    try {
      const data = await chatApi.getMessages(convId, { limit: 30 });
      setMessages(data.messages || []);
      setHasMore(Boolean(data.hasMore));
      setNextCursor(data.nextCursor || null);

      // Đánh dấu đã đọc ngay khi mở cuộc trò chuyện
      await chatApi.markAsRead(convId);
      socketService.emitMarkRead(convId);
    } catch (err) {
      console.error('Lỗi tải tin nhắn:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // 2. Tải thêm tin nhắn cũ hơn (Cursor-based)
  const handleLoadMore = async () => {
    if (!conversationId || !nextCursor || isLoadingMessages) return;
    try {
      const data = await chatApi.getMessages(conversationId, {
        before: nextCursor,
        limit: 30,
      });

      setMessages((prev) => [...(data.messages || []), ...prev]);
      setHasMore(Boolean(data.hasMore));
      setNextCursor(data.nextCursor || null);
    } catch (err) {
      console.error('Lỗi tải thêm tin nhắn:', err);
    }
  };

  // 3. Quản lý vòng đời phòng Socket.IO cho hội thoại
  useEffect(() => {
    if (!conversationId) return;

    loadMessages(conversationId);

    // Tham gia phòng Socket
    socketService.joinConversationRoom(conversationId);

    const socket = socketService.getSocket();

    // Nhận tin nhắn mới từ Socket
    const handleNewMessage = ({ message, conversationId: msgConvId }) => {
      if (String(msgConvId) === String(conversationId)) {
        setMessages((prev) => {
          // Tránh bị duplicate nếu tin nhắn lạc quan đã render
          const exists = prev.some(
            (m) =>
              (m._id && m._id === message._id) ||
              (m.clientMessageId && m.clientMessageId === message.clientMessageId)
          );
          if (exists) {
            return prev.map((m) =>
              m.clientMessageId === message.clientMessageId ? message : m
            );
          }
          return [...prev, message];
        });

        // Nếu người gửi không phải mình -> đánh dấu đã đọc
        const senderId = message.senderId?._id || message.senderId;
        if (String(senderId) !== String(currentUserId)) {
          socketService.emitMarkRead(conversationId);
        }

        onConversationUpdated?.(conversationId, message);
      }
    };

    // Nhận cập nhật trạng thái đã xem
    const handleReadUpdate = ({ conversationId: readConvId, readByUserId }) => {
      if (String(readConvId) === String(conversationId)) {
        setMessages((prev) =>
          prev.map((m) => {
            const senderId = m.senderId?._id || m.senderId;
            if (String(senderId) === String(currentUserId)) {
              return { ...m, status: 'READ' };
            }
            return m;
          })
        );
      }
    };

    // Nhận cập nhật trạng thái đang gõ
    const handleTypingUpdate = ({ conversationId: typConvId, userId: typUserId, userName: typName, isTyping }) => {
      if (String(typConvId) === String(conversationId) && String(typUserId) !== String(currentUserId)) {
        setTypingUsers((prev) => {
          if (isTyping) {
            const exists = prev.some((u) => u.userId === typUserId);
            if (!exists) {
              return [...prev, { userId: typUserId, userName: typName }];
            }
            return prev;
          } else {
            return prev.filter((u) => u.userId !== typUserId);
          }
        });
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:read:update', handleReadUpdate);
    socket.on('typing:update', handleTypingUpdate);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:read:update', handleReadUpdate);
      socket.off('typing:update', handleTypingUpdate);
      socketService.leaveConversationRoom(conversationId);
    };
  }, [conversationId, currentUserId, loadMessages, onConversationUpdated]);

  // 4. Xử lý gửi tin nhắn (kèm Optimistic UI)
  const handleSendMessage = async ({ content, files = [] }) => {
    if (!conversationId) return;

    let attachments = [];
    if (files.length > 0) {
      // 1. Upload ảnh trước qua REST API
      const uploadRes = await chatApi.uploadImages(conversationId, files);
      attachments = uploadRes.attachments || [];
    }

    const clientMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Tạo tin nhắn tạm Optimistic để hiển thị ngay lập tức
    const optimisticMessage = {
      _id: clientMessageId,
      conversationId,
      senderId: {
        _id: currentUserId,
        FullName: 'Tôi',
      },
      senderRole: isCustomerView ? 'customer' : 'branch_manager',
      content,
      attachments,
      clientMessageId,
      createdAt: new Date().toISOString(),
      status: 'SENDING',
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    // Gửi qua Socket.IO (với fallback HTTP nếu lỗi)
    socketService.emitSendMessage(
      {
        conversationId,
        content,
        attachments,
        clientMessageId,
      },
      (response) => {
        if (response?.error) {
          console.warn('Socket gửi lỗi, chuyển sang fallback REST API:', response.error);
          chatApi
            .sendMessage(conversationId, {
              content,
              attachments,
              clientMessageId,
            })
            .then((res) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.clientMessageId === clientMessageId ? res.message : m
                )
              );
            });
        }
      }
    );
  };

  // Xác định xem người đối diện có đang online không
  let otherUserId = '';
  if (isCustomerView) {
    otherUserId = conversation.shopId?.managerId || conversation.shopId?.ownerId || '';
  } else {
    otherUserId = conversation.customerId?._id || conversation.customerId;
  }
  const isPartnerOnline = Boolean(
    otherUserId && onlineUserIds.includes(String(otherUserId))
  );

  // Lấy sản phẩm đang được quan tâm nhất (sản phẩm đầu tiên trong productContexts)
  const latestProduct = conversation.productContexts?.[0] || null;

  return (
    <div className="chat-main-area">
      {/* Header */}
      <ChatHeader
        conversation={conversation}
        isCustomerView={isCustomerView}
        isPartnerOnline={isPartnerOnline}
        onBack={onBack}
      />

      {/* Thẻ sản phẩm nổi bật đang tư vấn nếu có */}
      {latestProduct && (
        <div style={{ padding: '10px 24px 0' }}>
          <ProductReferenceCard product={latestProduct} />
        </div>
      )}

      {/* Danh sách tin nhắn */}
      <MessageList
        messages={messages}
        currentUserId={currentUserId}
        hasMore={hasMore}
        isLoadingMore={isLoadingMessages}
        onLoadMore={handleLoadMore}
        typingUsers={typingUsers}
        onImageClick={(url) => setLightboxImage(url)}
      />

      {/* Thanh nhập liệu */}
      <MessageInput
        onSendMessage={handleSendMessage}
        onTyping={(isTyping) =>
          socketService.emitTyping(conversationId, isTyping)
        }
        disabled={conversation.status === 'CLOSED'}
      />

      {/* Modal phóng to ảnh */}
      <ImageLightbox
        imageUrl={lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </div>
  );
}

