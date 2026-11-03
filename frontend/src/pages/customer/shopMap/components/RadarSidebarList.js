import React from 'react';
import RadarShopCard from './RadarShopCard';

function RadarCardSkeleton() {
  return (
    <div className="radar-card-skeleton" aria-hidden="true">
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div className="skeleton-shimmer" style={{ width: '46px', height: '46px', borderRadius: '12px', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div className="skeleton-shimmer" style={{ width: '40%', height: '14px' }} />
          <div className="skeleton-shimmer" style={{ width: '70%', height: '18px' }} />
        </div>
      </div>
      <div className="skeleton-shimmer" style={{ width: '90%', height: '14px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '6px' }}>
        <div className="skeleton-shimmer" style={{ height: '36px', borderRadius: '8px' }} />
        <div className="skeleton-shimmer" style={{ height: '36px', borderRadius: '8px' }} />
      </div>
    </div>
  );
}

export default function RadarSidebarList({
  stores,
  loading,
  selectedStore,
  userLocation,
  onSelectStore,
  onNavigateToProducts,
  onResetFilters,
}) {
  return (
    <section className="radar-sidebar" aria-label="Danh sách cửa hàng gần nhất">
      <div className="radar-sidebar-header">
        <span className="radar-sidebar-count" aria-live="polite">
          📍 Có {stores.length} cửa hàng
        </span>
        <span className="radar-sidebar-sort-tag">
          <i className="fa-solid fa-arrow-down-short-wide" aria-hidden="true"></i>
          Ưu tiên nơi gần bạn nhất
        </span>
      </div>

      <div className="radar-sidebar-list" role="list">
        {loading ? (
          <>
            <RadarCardSkeleton />
            <RadarCardSkeleton />
            <RadarCardSkeleton />
          </>
        ) : stores.length === 0 ? (
          <div className="radar-empty-state">
            <div className="radar-empty-icon">
              <i className="fa-solid fa-store-slash" aria-hidden="true"></i>
            </div>
            <h3 className="radar-empty-title">Không tìm thấy cửa hàng phù hợp</h3>
            <p className="radar-empty-desc">
              Hiện chưa có cơ sở nào trong phạm vi này hoặc từ khóa chưa khớp. Bạn thử mở rộng khoảng cách xem nhé!
            </p>
            <button type="button" className="radar-empty-btn" onClick={onResetFilters}>
              <i className="fa-solid fa-globe" style={{ marginRight: '6px' }} aria-hidden="true"></i>
              Xem tất cả cửa hàng
            </button>
          </div>
        ) : (
          stores.map((store) => (
            <RadarShopCard
              key={store.id}
              store={store}
              isSelected={selectedStore?.id === store.id}
              userLocation={userLocation}
              onSelect={onSelectStore}
              onNavigateToProducts={onNavigateToProducts}
            />
          ))
        )}
      </div>
    </section>
  );
}
