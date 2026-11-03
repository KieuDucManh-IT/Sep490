import React, { useState, useMemo } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import ConversationItem from './ConversationItem';

export default function ConversationList({
  conversations = [],
  activeId,
  isCustomerView,
  onlineUserIds = [],
  onSelectConversation,
  isLoading = false,
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    const q = searchTerm.trim().toLowerCase();
    return conversations.filter((c) => {
      const shopName = c.shopId?.name?.toLowerCase() || '';
      const customerName = c.customerId?.FullName?.toLowerCase() || '';
      const lastMsg = c.lastMessage?.content?.toLowerCase() || '';
      return shopName.includes(q) || customerName.includes(q) || lastMsg.includes(q);
    });
  }, [conversations, searchTerm]);

  return (
    <div className="chat-sidebar">
      {/* Sidebar Header */}
      <div className="chat-sidebar-header">
        <div className="chat-sidebar-title-row">
          <h2 className="chat-sidebar-title">
            <MessageSquare size={22} />
            <span>{isCustomerView ? 'Tin Nhắn Tư Vấn' : 'Tư Vấn Khách Hàng'}</span>
          </h2>
        </div>

        <div className="chat-search-bar">
          <Search size={16} className="chat-search-icon" />
          <input
            type="text"
            className="chat-search-input"
            placeholder={
              isCustomerView
                ? 'Tìm kiếm Shop hoặc tin nhắn...'
                : 'Tìm kiếm khách hàng hoặc tin nhắn...'
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* List */}
      <div className="chat-conversation-list">
        {isLoading ? (
          <div className="chat-empty-list">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Đang tải...</span>
            </div>
            <p style={{ marginTop: 12, fontSize: 13 }}>Đang tải danh sách cuộc trò chuyện...</p>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="chat-empty-list">
            <MessageSquare size={38} className="chat-empty-icon" />
            <p style={{ fontWeight: 600, margin: '8px 0 4px', color: '#475569' }}>
              {searchTerm ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có cuộc trò chuyện nào'}
            </p>
            <p style={{ fontSize: 12.5, margin: 0, color: '#94a3b8' }}>
              {isCustomerView
                ? 'Khi bạn nhấn "Nhắn tin tư vấn với Shop" từ sản phẩm, cuộc trò chuyện sẽ xuất hiện tại đây.'
                : 'Khi có khách hàng liên hệ hỏi về sản phẩm của gian hàng, danh sách sẽ hiển thị tại đây.'}
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            // Xác định xem người đối diện có đang online không
            let otherUserId = '';
            if (isCustomerView) {
              // Đối diện là Shop Manager hoặc Shop Owner
              otherUserId = conv.shopId?.managerId || conv.shopId?.ownerId || '';
            } else {
              // Đối diện là Customer
              otherUserId = conv.customerId?._id || conv.customerId;
            }

            const isOnline = Boolean(
              otherUserId && onlineUserIds.includes(String(otherUserId))
            );

            return (
              <ConversationItem
                key={conv._id}
                conversation={conv}
                isActive={String(conv._id) === String(activeId)}
                isCustomerView={isCustomerView}
                isOnline={isOnline}
                onClick={() => onSelectConversation(conv)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
