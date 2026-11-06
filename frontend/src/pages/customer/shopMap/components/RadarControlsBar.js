import React from 'react';
import { Crosshair, RotateCw, Loader2, Search, XCircle } from 'lucide-react';
import { RADIUS_OPTIONS } from '../hooks/useShopRadarData';

export default function RadarControlsBar({
  userLocation,
  locating,
  onQuickGps,
  selectedRadius,
  onSelectRadius,
  searchTerm,
  onSearchChange,
  onClearSearch,
}) {
  return (
    <div className="radar-controls-container">
      <div className="radar-controls-bar">
        {/* User Location Badge */}
        <div className="radar-user-location-badge">
          <Crosshair size={16} color="#C5A880" aria-hidden="true" />
          <span>
            Khu vực của bạn: <strong>{userLocation?.city || 'Hà Nội'}</strong>
          </span>
          <button
            type="button"
            className="radar-relocate-btn"
            onClick={onQuickGps}
            disabled={locating}
            aria-label="Cập nhật lại vị trí hiện tại"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {locating ? (
              <Loader2 size={13} className="spin" aria-hidden="true" />
            ) : (
              <RotateCw size={13} aria-hidden="true" />
            )}
            <span>{locating ? 'Đang tìm vị trí...' : 'Lấy lại vị trí'}</span>
          </button>
        </div>

        {/* Filter Cluster */}
        <div className="radar-filter-cluster">
          {/* Radius Pills */}
          <div className="radar-radius-pills" role="tablist" aria-label="Lọc khoảng cách cửa hàng">
            {RADIUS_OPTIONS.map((opt) => {
              const isActive = selectedRadius === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`radius-pill-btn ${isActive ? 'active' : ''}`}
                  onClick={() => onSelectRadius(opt.id)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="radar-search-input-wrap" style={{ display: 'flex', alignItems: 'center' }}>
            <Search size={15} color="#A1A1AA" style={{ marginLeft: 10, flexShrink: 0 }} aria-hidden="true" />
            <input
              id="radar-search-input"
              type="text"
              className="radar-search-input"
              placeholder="Tìm theo tên đường, quận huyện, tên cửa hàng..."
              aria-label="Tìm kiếm cửa hàng theo tên đường hoặc quận huyện"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchTerm ? (
              <button
                type="button"
                className="radar-search-clear-btn"
                onClick={onClearSearch}
                aria-label="Xóa từ khóa tìm kiếm"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <XCircle size={15} color="#A1A1AA" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
