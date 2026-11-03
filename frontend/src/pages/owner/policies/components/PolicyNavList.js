import React, { memo, useCallback, useMemo } from 'react';
import { Plus, Check } from 'lucide-react';

/**
 * PolicyNavList - Danh sách chuyển đổi tab chính sách kinh doanh động
 * Hỗ trợ WAI-ARIA tablist đầy đủ và điều hướng bàn phím (Arrow Up/Down, Home, End)
 * Cho phép Shop Owner thêm mới chính sách bất kỳ lúc nào.
 */
function PolicyNavList({
  policies = [],
  activeKey,
  onSelectKey,
  onOpenCreateModal,
}) {
  const list = useMemo(() => (Array.isArray(policies) ? policies : []), [policies]);

  // Xử lý điều hướng bằng bàn phím theo chuẩn WAI-ARIA
  const handleKeyDown = useCallback(
    (e, currentIndex) => {
      const total = list.length;
      if (total === 0) return;

      let nextIndex = null;

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % total;
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + total) % total;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = total - 1;
      }

      if (nextIndex !== null) {
        const nextKey = list[nextIndex].key;
        onSelectKey(nextKey);
        const nextButton = document.getElementById(`policy-tab-${nextKey}`);
        if (nextButton) {
          nextButton.focus();
        }
      }
    },
    [list, onSelectKey]
  );

  return (
    <nav className="policy-nav-card" aria-label="Điều hướng danh mục chính sách chuỗi">
      <div className="policy-nav-header">
        <span>Danh Mục Chính Sách</span>
        <span className="policy-nav-count-badge">
          {list.length} MỤC
        </span>
      </div>

      <div
        className="policy-nav-list"
        role="tablist"
        aria-orientation="vertical"
        aria-label="Danh mục các chính sách kinh doanh toàn chuỗi"
      >
        {list.map((item, idx) => {
          const isSelected = activeKey === item.key;
          const isItemActive = item.isActive !== false;
          const isFilled = Boolean(item.title && item.content);
          const displayTitle = item.title || item.key;
          const displaySummary = item.summary || 'Chính sách vận hành áp dụng toàn chuỗi';

          return (
            <button
              key={item.key}
              id={`policy-tab-${item.key}`}
              role="tab"
              type="button"
              tabIndex={isSelected ? 0 : -1}
              aria-selected={isSelected}
              aria-controls={`policy-tabpanel-${item.key}`}
              onClick={() => onSelectKey(item.key)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              className={`policy-nav-item ${isSelected ? 'active' : ''}`}
            >
              <div className="policy-nav-icon-wrapper">
                <span className="policy-nav-index">{String(idx + 1).padStart(2, '0')}</span>
              </div>

              <div className="policy-nav-body">
                <div className="policy-nav-label-row">
                  <span className="policy-nav-label">
                    {displayTitle}
                  </span>

                  <div className="d-flex align-items-center gap-1">
                    {isFilled ? (
                      <span className="policy-nav-check-badge" title="Đã có nội dung chi tiết">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    ) : null}
                    <span
                      className={`policy-nav-status ${isItemActive ? 'active' : 'inactive'}`}
                      aria-label={`Trạng thái: ${isItemActive ? 'Đang kích hoạt' : 'Tạm ẩn'}`}
                    >
                      {isItemActive ? 'BẬT' : 'ẨN'}
                    </span>
                  </div>
                </div>

                <p className="policy-nav-desc">
                  {displaySummary}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Nút Tạo Chính Sách Mới (Shop Owner) */}
      <button
        type="button"
        className="btn-add-policy"
        onClick={onOpenCreateModal}
        title="Thêm một chính sách kinh doanh mới cho chuỗi"
      >
        <Plus size={16} />
        <span>+ Thêm Chính Sách Mới</span>
      </button>
    </nav>
  );
}

export default memo(PolicyNavList);
