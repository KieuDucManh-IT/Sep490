import { memo } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';

/**
 * Thanh tìm kiếm và bộ lọc danh mục cho màn hình Cấu hình giá
 * Memoized để tránh re-render không cần thiết khi dữ liệu bảng thay đổi
 */
function PricingFilterBar({
  search,
  onSearchChange,
  onClearSearch,
  selectedCategory,
  onSelectCategory,
  categoryOptions,
  totalCount,
  filteredCount,
}) {
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

      {/* Các nút bấm chọn nhanh danh mục */}
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
