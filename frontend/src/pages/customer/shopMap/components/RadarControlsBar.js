import React from 'react';
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
          <i className="fa-solid fa-location-crosshairs" style={{ color: '#ea580c' }} aria-hidden="true"></i>
          <span>
            Khu vực của bạn: <strong>{userLocation?.city || 'Hà Nội'}</strong>
          </span>
          <button
            type="button"
            className="radar-relocate-btn"
            onClick={onQuickGps}
            disabled={locating}
            aria-label="Cập nhật lại vị trí hiện tại"
          >
            <i className={`fa-solid ${locating ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`} aria-hidden="true"></i>
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
          <div className="radar-search-input-wrap">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
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
              >
                <i className="fa-solid fa-circle-xmark" aria-hidden="true"></i>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
