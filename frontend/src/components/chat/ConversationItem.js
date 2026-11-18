import React from 'react';

const formatTimeOrDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();

  // Cùng ngày -> hiển thị giờ:phút
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  // Khác ngày -> hiển thị ngày/tháng
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

export default function ConversationItem({
  conversation,
  isActive,
  isCustomerView,
  isOnline,
  onClick,
}) {
  const shop = conversation.shopId;
  const customer = conversation.customerId;

  // Nếu là Customer xem: hiển thị tên & avatar của Shop
  // Nếu là Shop Manager xem: hiển thị tên & avatar của Khách hàng
  const displayName = isCustomerView
    ? shop?.name || 'Cửa hàng VESTORA'
    : customer?.FullName || 'Khách hàng';

  const avatarUrl = isCustomerView
    ? shop?.imageUrl || ''
    : customer?.Avatar || '';

  const initial = displayName ? displayName.trim().charAt(0).toUpperCase() : 'V';

  const lastMessageText =
    conversation.lastMessage?.content ||
    (conversation.lastMessage?.messageType === 'IMAGE'
      ? '[Hình ảnh]'
      : conversation.lastMessage?.messageType === 'PRODUCT_CARD'
      ? '[Hỏi về sản phẩm]'
      : 'Bắt đầu cuộc trò chuyện');

  const unreadCount = conversation.unreadCount || 0;

  return (
    <button
      type="button"
      className={`chat-conv-item ${isActive ? 'active' : ''}`}
      onClick={onClick}
    >
      <div className="chat-avatar-wrapper">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="chat-avatar-img"
          />
        ) : (
          <div className="chat-avatar-fallback">{initial}</div>
        )}
        <span
          className={`chat-status-dot ${isOnline ? 'online' : ''}`}
          title={isOnline ? 'Đang hoạt động' : 'Ngoại tuyến'}
        />
      </div>

      <div className="chat-conv-info">
        <div className="chat-conv-top-row">
          <span className="chat-conv-name" title={displayName}>
            {displayName}
          </span>
          <span className="chat-conv-time">
            {formatTimeOrDate(conversation.lastMessageAt || conversation.updatedAt)}
          </span>
        </div>

        <div className="chat-conv-bot-row">
          <span className="chat-conv-last-msg" title={lastMessageText}>
            {lastMessageText}
          </span>
          {unreadCount > 0 && (
            <span className="chat-conv-unread-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

