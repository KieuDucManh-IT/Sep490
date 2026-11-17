import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { buildTryOnUrl } from './stylistUtils';

export default function StylistComboBanner({ products }) {
  if (!Array.isArray(products) || products.length < 2) return null;

  return (
    <div className="stylist-combo-tryon-banner">
      <div className="stylist-combo-tryon-info">
        <span className="stylist-combo-icon-wrap">
          <Sparkles size={15} color="#5b6e4e" />
        </span>
        <div>
          <strong>Thử nguyên set phối này ({products.length} món)</strong>
          <span>Chuyển cả bộ trang phục vào phòng thử đồ AI ghép ảnh</span>
        </div>
      </div>
      <Link
        to={buildTryOnUrl(products)}
        className="stylist-combo-tryon-btn"
        title="Đưa toàn bộ set trang phục này vào phòng thử đồ ảo"
      >
        <Sparkles size={13} /> Chuyển vào phòng thử đồ
      </Link>
    </div>
  );
}
