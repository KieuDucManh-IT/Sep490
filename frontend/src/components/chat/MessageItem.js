import React from 'react';
import { Check, CheckCheck } from 'lucide-react';
import ProductReferenceCard from './ProductReferenceCard';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

export default function MessageItem({
  message,
  currentUserId,
  onImageClick,
}) {
  const senderId = message.senderId?._id || message.senderId;
  const isMine = String(senderId) === String(currentUserId);
  const isSystem = message.messageType === 'SYSTEM' || message.senderRole === 'system';

  const senderName = message.senderId?.FullName || 'Người dùng';
  const senderAvatar = message.senderId?.Avatar || '';

  // Kiểm tra trạng thái đã xem
  const isRead =
    message.status === 'READ' ||
    (Array.isArray(message.readBy) &&
      message.readBy.some((r) => String(r.userId) !== String(currentUserId)));

  if (isSystem) {
    return (
      <div className="chat-date-divider">
        <span className="chat-date-text" style={{ fontStyle: 'italic' }}>
          {message.content}
        </span>
      </div>
    );
  }

  const gridClass =
    message.attachments?.length === 1
      ? 'grid-1'
      : message.attachments?.length === 2
      ? 'grid-2'
      : 'grid-3';

  return (
    <div className={`chat-msg-row ${isMine ? 'mine' : 'theirs'}`}>
      {!isMine && (
        <div className="chat-avatar-wrapper" style={{ marginBottom: 4 }}>
          {senderAvatar ? (
            <img
              src={senderAvatar}
              alt={senderName}
              className="chat-avatar-img"
              style={{ width: 32, height: 32 }}
            />
          ) : (
            <div
              className="chat-avatar-fallback"
              style={{ width: 32, height: 32, fontSize: 13 }}
            >
              {senderName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className="chat-msg-bubble">
        {/* Thẻ sản phẩm nếu có */}
        {message.productCard && (
          <ProductReferenceCard
            product={{
              productId: message.productCard.productId,
              productName: message.productCard.name,
              productImage: message.productCard.image,
              rentalPrice: message.productCard.rentalPrice,
              salePrice: message.productCard.salePrice,
              productCode: message.productCard.productCode,
              productUrl: message.productCard.url,
            }}
          />
        )}

        {/* Nội dung tin nhắn văn bản */}
        {message.content && <div className="chat-msg-text">{message.content}</div>}

        {/* Danh sách ảnh đính kèm */}
        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
          <div className={`chat-images-grid ${gridClass}`}>
            {message.attachments.map((att, idx) => (
              <img
                key={att.publicId || att.url || idx}
                src={att.url}
                alt={att.originalName || 'Ảnh tư vấn'}
                className="chat-image-item"
                onClick={() => onImageClick?.(att.url)}
                loading="lazy"
              />
            ))}
          </div>
        )}

        {/* Thời gian và trạng thái gửi / đã xem */}
        <div className="chat-msg-time-status">
          <span>{formatTime(message.createdAt)}</span>
          {isMine && (
            <span title={isRead ? 'Đã xem' : 'Đã gửi'}>
              {isRead ? (
                <CheckCheck size={14} style={{ color: '#38bdf8' }} />
              ) : (
                <Check size={14} />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

