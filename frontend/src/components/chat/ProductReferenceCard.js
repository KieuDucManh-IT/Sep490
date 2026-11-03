import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

const formatVND = (num) => {
  if (!num) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
};

export default function ProductReferenceCard({ product }) {
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

  return (
    <div className="chat-product-card">
      {productImage ? (
        <img
          src={productImage}
          alt={productName || 'Sản phẩm tư vấn'}
          className="chat-product-thumb"
        />
      ) : (
        <div
          className="chat-product-thumb"
          style={{
            background: '#e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            color: '#64748b',
          }}
        >
          VESTORA
        </div>
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
            <span style={{ color: '#94a3b8', fontSize: '11px' }}>({productCode})</span>
          )}
        </div>
      </div>

      <Link
        to={targetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="chat-header-btn"
        title="Xem trang chi tiết sản phẩm"
        style={{ padding: '6px 10px', fontSize: '12px' }}
      >
        <ExternalLink size={14} />
        <span>Xem đồ</span>
      </Link>
    </div>
  );
}

