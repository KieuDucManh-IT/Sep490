import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';
import ConversationList from '../../components/chat/ConversationList';
import ChatWindow from '../../components/chat/ChatWindow';
import chatApi from '../../services/chatApi';
import socketService from '../../services/socket';
import { MessageSquare } from 'lucide-react';
import '../../styles/Chat.css';

export default function ChatPage() {
  const { conversationId: paramConvId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  const currentUserId = user?._id || user?.id;

  // 1. Tải danh sách cuộc trò chuyện của khách hàng
  const fetchConversations = useCallback(async () => {
    try {
      setIsLoadingList(true);
      const data = await chatApi.getConversations();
      const list = data.conversations || [];
      setConversations(list);

      // Nếu có paramConvId trên URL -> chọn conversation đó
      if (paramConvId) {
        const found = list.find((c) => String(c._id) === String(paramConvId));
        if (found) {
          setActiveConversation(found);
        } else {
          // Nếu chưa có trong danh sách (mới tạo) -> tải chi tiết
          try {
            const detailRes = await chatApi.getConversationDetail(paramConvId);
            if (detailRes.conversation) {
              setActiveConversation(detailRes.conversation);
              setConversations((prev) => [detailRes.conversation, ...prev]);
            }
          } catch (_) {}
        }
      } else if (list.length > 0 && window.innerWidth > 868) {
        // Mặc định chọn hội thoại đầu tiên trên desktop
        setActiveConversation(list[0]);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách hội thoại:', err);
    } finally {
      setIsLoadingList(false);
    }
  }, [paramConvId]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // 2. Lắng nghe sự kiện toàn cục Socket.IO (Presence & Hội thoại cập nhật)
  useEffect(() => {
    const socket = socketService.getSocket();

    const handlePresence = ({ userId, isOnline }) => {
      setOnlineUserIds((prev) => {
        const strId = String(userId);
        if (isOnline) {
          return prev.includes(strId) ? prev : [...prev, strId];
        } else {
          return prev.filter((id) => id !== strId);
        }
      });
    };

    const handleOnlineList = ({ onlineUserIds: list }) => {
      if (Array.isArray(list)) {
        setOnlineUserIds(list.map((id) => String(id)));
      }
    };

    const handleConversationUpdated = ({ conversationId, lastMessage }) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => String(c._id) === String(conversationId));
        if (index !== -1) {
          const updated = {
            ...prev[index],
            lastMessage: {
              content: lastMessage.content,
              messageType: lastMessage.messageType,
              createdAt: lastMessage.createdAt,
            },
            lastMessageAt: lastMessage.createdAt,
          };
          const nextList = [...prev];
          nextList.splice(index, 1);
          return [updated, ...nextList];
        }
        return prev;
      });
    };

    socket.on('user:presence', handlePresence);
    socket.on('users:online:list', handleOnlineList);
    socket.on('conversation:updated', handleConversationUpdated);

    return () => {
      socket.off('user:presence', handlePresence);
      socket.off('users:online:list', handleOnlineList);
      socket.off('conversation:updated', handleConversationUpdated);
    };
  }, []);

  const handleSelectConversation = (conv) => {
    setActiveConversation(conv);
    navigate(`/chat/${conv._id}`, { replace: true });
  };

  const handleBackToList = () => {
    setActiveConversation(null);
    navigate('/chat', { replace: true });
  };

  const handleConversationUpdated = (convId, msg) => {
    setConversations((prev) => {
      const idx = prev.findIndex((c) => String(c._id) === String(convId));
      if (idx !== -1) {
        const updated = {
          ...prev[idx],
          lastMessage: {
            content: msg.content,
            messageType: msg.messageType,
            createdAt: msg.createdAt,
          },
          lastMessageAt: msg.createdAt,
        };
        const nextList = [...prev];
        nextList.splice(idx, 1);
        return [updated, ...nextList];
      }
      return prev;
    });
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 868;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />

      <div className="vestora-chat-page">
        {/* Cột trái: Danh sách cuộc trò chuyện */}
        <div className={`chat-sidebar-wrapper ${isMobile && activeConversation ? 'd-none' : ''}`}>
          <ConversationList
            conversations={conversations}
            activeId={activeConversation?._id}
            isCustomerView={true}
            onlineUserIds={onlineUserIds}
            onSelectConversation={handleSelectConversation}
            isLoading={isLoadingList}
          />
        </div>

        {/* Cột phải: Khung chat */}
        {activeConversation ? (
          <ChatWindow
            conversation={activeConversation}
            currentUserId={currentUserId}
            isCustomerView={true}
            onlineUserIds={onlineUserIds}
            onBack={isMobile ? handleBackToList : null}
            onConversationUpdated={handleConversationUpdated}
          />
        ) : (
          <div
            className="chat-main-area"
            style={{
              display: isMobile ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              flexDirection: 'column',
              padding: 24,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
                color: '#435339',
              }}
            >
              <MessageSquare size={36} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
              Chọn một cuộc trò chuyện để bắt đầu tư vấn
            </h3>
            <p style={{ maxWidth: 400, fontSize: 13.5, color: '#64748b' }}>
              Trao đổi trực tiếp với Quản lý gian hàng để hỏi về kích cỡ, chất liệu trang phục, thời gian nhận đồ hoặc chính sách đặt cọc.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
