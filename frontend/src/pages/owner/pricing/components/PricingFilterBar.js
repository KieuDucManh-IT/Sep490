import { memo } from 'react';
import { Search, X, SlidersHorizontal, RotateCcw } from 'lucide-react';

/**
 * Thanh tìm kiếm & bộ lọc dạng dropdown (trạng thái định giá, đồ thuê/đồ mua, danh mục)
 * Memoized để tránh re-render không cần thiết khi dữ liệu bảng thay đổi
 */
function PricingFilterBar({
  search,
  onSearchChange,
  onClearSearch,
  pricingFilter = 'all',
  onSelectPricingFilter,
  pricingCounts = {},
  tagFilter = 'ALL',
  onSelectTagFilter,
  tagCounts = {},
  selectedCategory,
  onSelectCategory,
  categoryOptions,
  totalCount,
  filteredCount,
  hasActiveFilters = false,
  onResetFilters,
}) {
  const statusOptions = [
    { value: 'all', label: 'Tất cả trạng thái', count: pricingCounts?.all ?? totalCount },
    { value: 'unset', label: 'Chưa định giá', count: pricingCounts?.unset ?? 0 },
    { value: 'set', label: 'Đã định giá', count: pricingCounts?.set ?? 0 },
  ];

  const tagOptions = [
    { value: 'ALL', label: 'Tất cả loại hình', count: tagCounts?.all ?? totalCount },
    { value: 'rental', label: 'Đồ thuê', count: tagCounts?.rental ?? 0 },
    { value: 'sale', label: 'Đồ mua', count: tagCounts?.sale ?? 0 },
    { value: 'both', label: 'Thuê & Mua', count: tagCounts?.both ?? 0 },
    ...(tagCounts?.unknown > 0 ? [{ value: 'unknown', label: 'Chưa phân loại', count: tagCounts.unknown }] : []),
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

        {/* Bộ đếm kết quả & nút đặt lại bộ lọc */}
        <div className="pricing-filter-actions">
          <div className="pricing-filter-counter">
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>
              Hiển thị <strong>{filteredCount}</strong> / {totalCount} mẫu trang phục
            </span>
          </div>

          {hasActiveFilters && onResetFilters ? (
            <button
              type="button"
              onClick={onResetFilters}
              className="pricing-filter-reset-btn"
              title="Đặt lại toàn bộ bộ lọc về mặc định"
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Đặt lại</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Các bộ lọc dạng Dropdown */}
      <div className="pricing-dropdowns-grid">
        <div className="pricing-dropdown-field">
          <label htmlFor="pricing-status-select" className="pricing-dropdown-label">
            Trạng thái định giá
          </label>
          <select
            id="pricing-status-select"
            value={pricingFilter}
            onChange={(e) => onSelectPricingFilter && onSelectPricingFilter(e.target.value)}
            className="pricing-dropdown-select"
            aria-label="Lọc theo trạng thái định giá"
          >
            {statusOptions.map((st) => (
              <option key={st.value} value={st.value}>
                {st.label} ({st.count})
              </option>
            ))}
          </select>
        </div>

        <div className="pricing-dropdown-field">
          <label htmlFor="pricing-tag-select" className="pricing-dropdown-label">
            Loại hình (Thuê / Mua)
          </label>
          <select
            id="pricing-tag-select"
            value={tagFilter}
            onChange={(e) => onSelectTagFilter && onSelectTagFilter(e.target.value)}
            className="pricing-dropdown-select"
            aria-label="Lọc theo loại hình đồ thuê hoặc đồ mua"
          >
            {tagOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.count})
              </option>
            ))}
          </select>
        </div>

        <div className="pricing-dropdown-field">
          <label htmlFor="pricing-category-select" className="pricing-dropdown-label">
            Danh mục trang phục
          </label>
          <select
            id="pricing-category-select"
            value={selectedCategory}
            onChange={(e) => onSelectCategory && onSelectCategory(e.target.value)}
            className="pricing-dropdown-select"
            aria-label="Lọc theo danh mục trang phục"
          >
            {categoryOptions.map((cat) => (
              <option key={cat.name} value={cat.name}>
                {cat.label} ({cat.count})
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}

export default memo(PricingFilterBar);
