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
        <span className="chat-date-text system-text">
          {message.content}
        </span>
      </div>
    );
  }

  const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0;
  const hasContent = Boolean(message.content && message.content.trim());
  const hasProduct = Boolean(message.productCard);
  const isOnlyImages = hasAttachments && !hasContent && !hasProduct;

  const gridClass =
    message.attachments?.length === 1
      ? 'grid-1'
      : message.attachments?.length === 2
      ? 'grid-2'
      : 'grid-3';

  return (
    <div className={`chat-msg-row ${isMine ? 'mine' : 'theirs'}`}>
      {!isMine && (
        <div className="chat-avatar-wrapper" style={{ marginBottom: 2 }}>
          {senderAvatar ? (
            <img
              src={senderAvatar}
              alt={senderName}
              className="chat-avatar-img chat-avatar-sm"
            />
          ) : (
            <div className="chat-avatar-fallback chat-avatar-sm">
              {senderName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div
        className={`chat-msg-bubble ${isOnlyImages ? 'bubble-only-images' : ''}`}
      >
        {/* Thẻ sản phẩm nếu có */}
        {hasProduct && (
          <ProductReferenceCard
            variant="bubble"
            isMine={isMine}
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
        {hasContent && (
          <div className="chat-msg-text">{message.content}</div>
        )}

        {/* Danh sách ảnh đính kèm */}
        {hasAttachments && (
          <div className={`chat-images-grid ${gridClass} ${isOnlyImages ? 'standalone-images' : ''}`}>
            {message.attachments.map((att, idx) => (
              <div key={att.publicId || att.url || idx} className="chat-image-wrap">
                <img
                  src={att.url}
                  alt={att.originalName || 'Ảnh đính kèm'}
                  className="chat-image-item"
                  onClick={() => onImageClick?.(att.url)}
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        {/* Thời gian và trạng thái gửi / đã xem */}
        <div className={`chat-msg-time-status ${isOnlyImages ? 'overlay-status' : ''}`}>
          <span>{formatTime(message.createdAt)}</span>
          {isMine && (
            <span title={isRead ? 'Đã xem' : 'Đã gửi'} className="chat-status-icon">
              {isRead ? (
                <CheckCheck size={14} className="status-read" />
              ) : (
                <Check size={14} className="status-sent" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
