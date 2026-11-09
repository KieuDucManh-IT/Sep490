import React from 'react';
import {
  Zap,
  AlertTriangle,
  MapPin,
  Phone,
  Star,
  ExternalLink,
  ShoppingBag,
} from 'lucide-react';

function RadarShopCard({ store, isSelected, userLocation, onSelect, onNavigateToProducts }) {
  const gmapsDirectionUrl =
    userLocation?.latitude && userLocation?.longitude
      ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${store.latitude},${store.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.name + ' ' + store.address)}`;

  return (
    <article
      id={`radar-shop-card-${store.id}`}
      role="listitem"
      tabIndex={0}
      className={`radar-shop-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(store)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(store);
        }
      }}
      aria-selected={isSelected}
    >
      <div className="radar-card-top-row">
        <div className="radar-card-avatar-wrap">
          <img
            src={store.imageUrl}
            alt={store.name}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(store.name)}&background=1a1a1a&color=EA580C`;
            }}
          />
        </div>

        <div className="radar-card-title-group">
          <span className={`radar-card-status-badge ${store.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
            {store.status === 'ACTIVE' ? 'Đang mở cửa' : 'Tạm đóng cửa'}
          </span>
          <h3>{store.name}</h3>
        </div>

        {store.hasGps ? (
          <div className="radar-card-distance-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Zap size={13} color="#C5A880" aria-hidden="true" />
            <span>{store.distanceLabel}</span>
            <span style={{ opacity: 0.8 }}>({store.travelTimeLabel})</span>
          </div>
        ) : (
          <div className="radar-card-distance-badge no-gps" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={13} color="#D97706" aria-hidden="true" />
            <span>Đang cập nhật vị trí</span>
          </div>
        )}
      </div>

      <p className="radar-card-address" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <MapPin size={14} color="#C5A880" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
        <span>{store.address}</span>
      </p>

      <div className="radar-card-meta-line">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Phone size={13} aria-hidden="true" />
          <a href={`tel:${store.phone}`} className="radar-phone-link" onClick={(e) => e.stopPropagation()}>
            {store.phone}
          </a>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Star size={13} fill="#C5A880" color="#C5A880" aria-hidden="true" />
          5.0 (Cửa hàng chính hãng)
        </span>
      </div>

      <div className="radar-card-actions">
        <a
          href={gmapsDirectionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="radar-btn-outline"
          aria-label={`Mở Google Maps chỉ đường tới ${store.name}`}
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <ExternalLink size={14} color="#C5A880" aria-hidden="true" />
          <span>Mở Google Maps</span>
        </a>

        <button
          type="button"
          className="radar-btn-gold"
          aria-label={`Xem sản phẩm tại ${store.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToProducts(store.id);
          }}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <ShoppingBag size={14} aria-hidden="true" />
          <span>Xem sản phẩm</span>
        </button>
      </div>
    </article>
  );
}

export default React.memo(RadarShopCard);
