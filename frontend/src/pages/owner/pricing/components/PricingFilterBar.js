import { memo } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

/**
 * Thanh tìm kiếm, bộ lọc trạng thái định giá & cấu hình và bộ lọc danh mục cho màn hình Cấu hình giá
 * Memoized để tránh re-render không cần thiết khi dữ liệu bảng thay đổi
 */
function PricingFilterBar({
  search,
  onSearchChange,
  onClearSearch,
  pricingFilter = 'all',
  onSelectPricingFilter,
  pricingCounts = {},
  selectedCategory,
  onSelectCategory,
  categoryOptions,
  totalCount,
  filteredCount,
}) {
  const statusOptions = [
    { value: 'all', label: 'Tất cả', count: pricingCounts?.all ?? totalCount },
    { value: 'unset', label: 'Chưa định giá', count: pricingCounts?.unset ?? 0 },
    { value: 'set', label: 'Đã định giá', count: pricingCounts?.set ?? 0 },
    { value: 'configured', label: 'Đã cấu hình giá', count: pricingCounts?.configured ?? 0 },
    { value: 'unconfigured', label: 'Chưa cấu hình giá', count: pricingCounts?.unconfigured ?? 0 },
  ];

  return (
    <section className="pricing-filter-wrapper mb-4" aria-label="Bộ lọc trang phục">
      <div className="pricing-filter-top">
        {/* Ô tìm kiếm */}
        <div className="pricing-search-container">
          <Search size={16} className="pricing-search-icon" aria-hidden="true" />
          <input
            type="text"
            placeholder="Tìm theo mã trang phục, tên, thương hiệu..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Tìm kiếm trang phục"
            className="pricing-search-input"
          />
          {search ? (
            <button
              type="button"
              onClick={onClearSearch}
              aria-label="Xóa từ khóa tìm kiếm"
              className="pricing-search-clear"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {/* Bộ đếm kết quả */}
        <div className="pricing-filter-counter">
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span>
            Hiển thị <strong>{filteredCount}</strong> / {totalCount} mẫu trang phục
          </span>
        </div>
      </div>

      {/* 1. Bộ lọc trạng thái định giá & cấu hình giá (đồng bộ phong cách Vestora Pills) */}
      <div className="pricing-categories-row mb-3 pb-3 border-bottom" role="tablist" aria-label="Lọc theo trạng thái định giá và cấu hình giá">
        <span className="pricing-categories-title">Trạng thái:</span>
        {statusOptions.map((st) => {
          const isActive = pricingFilter === st.value;
          return (
            <button
              key={st.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectPricingFilter && onSelectPricingFilter(st.value)}
              className={`pricing-category-pill ${isActive ? 'active' : ''}`}
            >
              <span>{st.label}</span>
              <span className="pricing-category-badge">{st.count}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Các nút bấm chọn nhanh danh mục */}
      <div className="pricing-categories-row" role="tablist" aria-label="Lọc theo danh mục">
        <span className="pricing-categories-title">Danh mục:</span>
        {categoryOptions.map((cat) => {
          const isActive = selectedCategory === cat.name;
          return (
            <button
              key={cat.name}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectCategory(cat.name)}
              className={`pricing-category-pill ${isActive ? 'active' : ''}`}
            >
              <span>{cat.label}</span>
              <span className="pricing-category-badge">{cat.count}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default memo(PricingFilterBar);
