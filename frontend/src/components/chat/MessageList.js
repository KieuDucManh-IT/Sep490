import React, { useEffect, useRef, useState } from 'react';
import MessageItem from './MessageItem';

const formatDateHeader = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) {
    return 'Hôm nay';
  }
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return 'Hôm qua';
  }
  return d.toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function MessageList({
  messages,
  currentUserId,
  hasMore,
  isLoadingMore,
  onLoadMore,
  typingUsers = [],
  onImageClick,
}) {
  const containerRef = useRef(null);
  const bottomRef = useRef(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const prevHeightRef = useRef(0);

  // Kiểm tra xem người dùng có đang ở gần đáy khung chat hay không
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setShouldAutoScroll(isNearBottom);
  };

  // Cuộn xuống tin nhắn mới nhất nếu người dùng đang ở cuối
  useEffect(() => {
    if (shouldAutoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingUsers, shouldAutoScroll]);

  // Giữ vị trí cuộn khi tải thêm tin nhắn cũ phía trên
  const handleLoadMoreClick = async () => {
    const el = containerRef.current;
    if (el) {
      prevHeightRef.current = el.scrollHeight;
    }
    await onLoadMore?.();
    setTimeout(() => {
      if (el) {
        const newHeight = el.scrollHeight;
        el.scrollTop = newHeight - prevHeightRef.current;
      }
    }, 50);
  };

  // Nhóm tin nhắn theo ngày
  let lastDate = '';

  return (
    <div
      className="chat-messages-container"
      ref={containerRef}
      onScroll={handleScroll}
    >
      {/* Nút tải thêm tin nhắn cũ */}
      {hasMore ? (
        <button
          type="button"
          className="chat-load-more-btn"
          onClick={handleLoadMoreClick}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? 'Đang tải tin cũ...' : 'Xem tin nhắn cũ hơn'}
        </button>
      ) : messages.length >= 25 ? (
        <div className="chat-date-divider" style={{ margin: '4px 0 12px' }}>
          <span className="chat-date-text system-text" style={{ fontSize: '11px', color: '#94a3b8' }}>
            Lịch sử tin nhắn được giới hạn trong 3 tháng gần nhất
          </span>
        </div>
      ) : null}

      {messages.map((msg) => {
        const msgDate = new Date(msg.createdAt).toDateString();
        const showDivider = msgDate !== lastDate;
        lastDate = msgDate;

        return (
          <React.Fragment key={msg._id || msg.clientMessageId}>
            {showDivider && (
              <div className="chat-date-divider">
                <span className="chat-date-text">
                  {formatDateHeader(msg.createdAt)}
                </span>
              </div>
            )}
            <MessageItem
              message={msg}
              currentUserId={currentUserId}
              onImageClick={onImageClick}
            />
          </React.Fragment>
        );
      })}

      {/* Hiển thị Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="chat-typing-container">
          <div className="typing-dots">
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
            <span className="typing-dot"></span>
          </div>
          <span>
            {typingUsers.map((u) => u.userName).join(', ')} đang nhập...
          </span>
        </div>
      )}

      <div ref={bottomRef} style={{ height: 1 }} />
    </div>
  );
}

