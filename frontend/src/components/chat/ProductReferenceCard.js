import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, X, Tag } from 'lucide-react';

const formatVND = (num) => {
  if (!num) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
};

export default function ProductReferenceCard({
  product,
  variant = 'default',
  isMine = false,
  onDismiss,
}) {
  if (!product) return null;

  const {
    productId,
    productName,
    productImage,
    rentalPrice,
    salePrice,
    productCode,
    productUrl,
  } = product;

  const targetUrl = productUrl || `/product/${productId}`;

  // 1. Dạng Banner Ghim trên đỉnh khung chat (variant="pinned")
  if (variant === 'pinned') {
    return (
      <div className="chat-pinned-product-card">
        <div className="chat-pinned-left">
          <div className="chat-pinned-badge">
            <Tag size={12} />
            <span>Sản phẩm quan tâm</span>
          </div>

          <div className="chat-pinned-content">
            {productImage ? (
              <img
                src={productImage}
                alt={productName || 'Sản phẩm'}
                className="chat-pinned-thumb"
              />
            ) : (
              <div className="chat-pinned-thumb chat-pinned-thumb-empty">VESTORA</div>
            )}

            <div className="chat-pinned-info">
              <span className="chat-pinned-title" title={productName}>
                {productName}
              </span>
              <div className="chat-pinned-price-row">
                {rentalPrice > 0 && (
                  <span className="price-item">
                    Thuê: <strong>{formatVND(rentalPrice)}</strong>/ngày
                  </span>
                )}
                {salePrice > 0 && (
                  <span className="price-item">
                    Mua: <strong>{formatVND(salePrice)}</strong>
                  </span>
                )}
                {productCode && (
                  <span className="code-item">({productCode})</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="chat-pinned-actions">
          <Link
            to={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="chat-pinned-view-btn"
            title="Mở trang chi tiết sản phẩm trong tab mới"
          >
            <ExternalLink size={13} />
            <span>Xem đồ</span>
          </Link>

          {onDismiss && (
            <button
              type="button"
              className="chat-pinned-close-btn"
              onClick={onDismiss}
              title="Ẩn thanh sản phẩm này"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. Dạng nằm trong bong bóng tin nhắn (variant="bubble" hoặc default)
  const isInsideMineBubble = isMine;

  return (
    <div
      className={`chat-product-card ${variant === 'bubble' ? 'bubble-mode' : ''} ${
        isInsideMineBubble ? 'mine-bubble-mode' : ''
      }`}
    >
      {productImage ? (
        <img
          src={productImage}
          alt={productName || 'Sản phẩm tư vấn'}
          className="chat-product-thumb"
        />
      ) : (
        <div className="chat-product-thumb chat-product-thumb-empty">VESTORA</div>
      )}

      <div className="chat-product-details">
        <h4 className="chat-product-title" title={productName}>
          {productName}
        </h4>
        <div className="chat-product-price-row">
          {rentalPrice > 0 && (
            <span>
              Thuê: <strong className="chat-product-price">{formatVND(rentalPrice)}</strong>/ngày
            </span>
          )}
          {salePrice > 0 && (
            <span>
              Mua: <strong className="chat-product-price">{formatVND(salePrice)}</strong>
            </span>
          )}
          {productCode && (
            <span className="chat-product-code">({productCode})</span>
          )}
        </div>
      </div>

      <Link
        to={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="chat-product-view-btn"
        title="Xem trang chi tiết sản phẩm"
      >
        <ExternalLink size={13} />
        <span>Xem đồ</span>
      </Link>
    </div>
  );
}
