import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { currency } from './stylistUtils';

export default function StylistWidgetProductCard({ product, onClose }) {
  if (!product) return null;

  return (
    <div className="stylist-wrec-card">
      <Link
        to={`/product/${product.id}`}
        className="stylist-wrec-thumb"
        onClick={onClose}
        title="Xem chi tiết sản phẩm"
      >
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" />
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Sparkles size={14} color="#C5A880" />
          </span>
        )}
      </Link>
      <div className="stylist-wrec-details">
        <h6 className="stylist-wrec-title">
          <Link
            to={`/product/${product.id}`}
            onClick={onClose}
            className="stylist-wrec-title-link"
          >
            {product.name}
          </Link>
        </h6>
        <span className="stylist-wrec-cat">{product.category}</span>
        <span className="stylist-wrec-price">
          {currency.format(product.rentalPricePerDayVnd || product.rentalPricePerDay || 0)}đ/ngày
        </span>
        <div className="stylist-wrec-actions">
          <Link
            to={`/try-on/photo?productId=${product.id}`}
            className="stylist-wrec-btn-tryon"
            onClick={onClose}
            title="Thử đồ bằng AI IDM-VTON"
          >
            <Sparkles size={11} /> Thử đồ AI
          </Link>
          <Link
            to={`/product/${product.id}`}
            className="stylist-wrec-btn-view"
            onClick={onClose}
            title="Xem chi tiết"
          >
            Chi tiết
          </Link>
        </div>
      </div>
    </div>
  );
}
