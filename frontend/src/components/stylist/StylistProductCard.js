import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ExternalLink } from 'lucide-react';
import { currency } from './stylistUtils';

export default function StylistProductCard({ product }) {
  if (!product) return null;

  return (
    <div className="stylist-rec-card">
      <Link
        to={`/product/${product.id}`}
        className="stylist-rec-img-wrap"
        title="Xem chi tiết sản phẩm"
      >
        {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.name} loading="lazy" />
        ) : (
          <span className="stylist-rec-img-fallback">V</span>
        )}
      </Link>
      <div className="stylist-rec-content">
        <div>
          <h4 className="stylist-rec-name">
            <Link to={`/product/${product.id}`} className="stylist-rec-name-link">
              {product.name}
            </Link>
          </h4>
          <div className="stylist-rec-cat">
            {product.category} · {product.code || product.sku}
          </div>
        </div>
        <div className="stylist-rec-price-row">
          <span className="stylist-rec-rent-price">
            {currency.format(product.rentalPricePerDayVnd || product.rentalPricePerDay || 0)}đ{' '}
            <small>/ ngày</small>
          </span>
          {product.depositVnd > 0 && (
            <span className="stylist-rec-deposit">
              Cọc {currency.format(product.depositVnd)}đ
            </span>
          )}
        </div>
        <div className="stylist-rec-tags">
          {product.sizes && product.sizes.length > 0 && (
            <span className="stylist-tag-micro">
              Size: {product.sizes.join(', ')}
            </span>
          )}
          {product.colors && product.colors.length > 0 && (
            <span className="stylist-tag-micro">
              {product.colors.slice(0, 2).join(' · ')}
            </span>
          )}
        </div>
        <div className="stylist-rec-actions">
          <Link
            to={`/try-on/photo?productId=${product.id}`}
            className="stylist-rec-btn-tryon"
            title="Ướm thử trang phục này bằng AI IDM-VTON"
          >
            <Sparkles size={12} />
            <span>Thử đồ AI</span>
          </Link>
          <Link
            to={`/product/${product.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="stylist-rec-btn-view"
            title="Xem trang chi tiết sản phẩm"
          >
            <ExternalLink size={12} />
            <span>Chi tiết</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
