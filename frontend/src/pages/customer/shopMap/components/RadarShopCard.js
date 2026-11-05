import React from 'react';

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
          <div className="radar-card-distance-badge">
            <i className="fa-solid fa-bolt" aria-hidden="true"></i>
            <span>{store.distanceLabel}</span>
            <span style={{ opacity: 0.8 }}>({store.travelTimeLabel})</span>
          </div>
        ) : (
          <div className="radar-card-distance-badge no-gps">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <span>Đang cập nhật vị trí</span>
          </div>
        )}
      </div>

      <p className="radar-card-address">
        <i className="fa-solid fa-location-dot" style={{ color: '#ea580c', marginRight: '6px' }} aria-hidden="true"></i>
        {store.address}
      </p>

      <div className="radar-card-meta-line">
        <span>
          <i className="fa-solid fa-phone" style={{ marginRight: '4px' }} aria-hidden="true"></i>
          <a href={`tel:${store.phone}`} className="radar-phone-link" onClick={(e) => e.stopPropagation()}>
            {store.phone}
          </a>
        </span>
        <span>
          <i className="fa-solid fa-star" style={{ color: '#f59e0b', marginRight: '4px' }} aria-hidden="true"></i>
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
        >
          <i className="fa-solid fa-arrow-up-right-from-square" style={{ color: '#ea580c' }} aria-hidden="true"></i>
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
        >
          <i className="fa-solid fa-bag-shopping" aria-hidden="true"></i>
          <span>Xem sản phẩm</span>
        </button>
      </div>
    </article>
  );
}

export default React.memo(RadarShopCard);
