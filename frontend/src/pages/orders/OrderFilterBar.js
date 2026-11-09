import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  Store,
  Building2,
} from 'lucide-react';
import '../../styles/ShopBranches.css';
import '../../styles/OrderMonitoring.css';


function BranchSelectDropdown({
  branches = [],
  selectedBranchId = '',
  onSelectBranch = () => {},
  isBranchMode = false,
  activeBranch = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Selected branch object
  const currentBranch = useMemo(() => {
    if (activeBranch) return activeBranch;
    return branches.find((b) => String(b._id) === String(selectedBranchId)) || null;
  }, [activeBranch, branches, selectedBranchId]);

  const isCurrentHQ = Boolean(currentBranch?.isHQ);

  const displayTitle = useMemo(() => {
    if (!selectedBranchId) {
      return isBranchMode ? 'Chi nhánh phụ trách' : 'Toàn Hệ Thống';
    }
    return currentBranch?.name || currentBranch?.shopName || 'Chi nhánh đã chọn';
  }, [selectedBranchId, isBranchMode, currentBranch]);

  // If Branch Manager manages only 1 branch, display as a styled static badge
  if (isBranchMode && branches.length <= 1) {
    const singleBranch = branches[0] || currentBranch;
    const isSingleHQ = Boolean(singleBranch?.isHQ);
    return (
      <div className="taskbar-branch-static-badge">
        <Store size={14} className="text-muted" />
        <span className="taskbar-branch-name text-truncate">
          {singleBranch?.name || singleBranch?.shopName || 'Chi nhánh phụ trách'}
        </span>
        {isSingleHQ && (
          <span className="branch-tag-hq ms-1">Trụ sở chính</span>
        )}
      </div>
    );
  }

  return (
    <div className="order-branch-dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`order-branch-select-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="d-flex align-items-center gap-2 text-truncate">
          {!selectedBranchId ? (
            <Building2 size={15} color="#B45309" />
          ) : (
            <Store size={15} className="text-muted" />
          )}
          <span className="order-branch-btn-text text-truncate">{displayTitle}</span>
          {isCurrentHQ && (
            <span className="branch-tag-hq ms-1">Trụ sở chính</span>
          )}
        </div>
        <ChevronDown
          size={14}
          className="order-branch-chevron"
          style={{
            transition: 'transform 0.15s ease',
            transform: isOpen ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>

      {isOpen && (
        <div className="order-branch-menu" role="listbox">
          <div className="order-branch-menu-header">
            <span>{isBranchMode ? 'Chi nhánh phụ trách' : 'Chọn chi nhánh theo dõi'}</span>
            <span className="badge bg-light text-dark border">
              {branches.length} cơ sở
            </span>
          </div>

          <div className="order-branch-menu-body">
            {!isBranchMode && (
              <div
                className={`order-branch-menu-item ${!selectedBranchId ? 'selected' : ''}`}
                onClick={() => {
                  onSelectBranch('');
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={!selectedBranchId}
              >
                <div className="order-branch-item-main">
                  <div className="order-branch-item-icon hq">
                    <Building2 size={15} />
                  </div>
                  <div>
                    <div className="order-branch-item-name">Toàn Hệ Thống</div>
                    <div className="order-branch-item-desc text-truncate">
                      Theo dõi tất cả đơn thuê và mua trên mọi chi nhánh
                    </div>
                  </div>
                </div>
                {!selectedBranchId && <Check size={16} className="text-primary" />}
              </div>
            )}

            {branches.filter(Boolean).map((b) => {
              const isSelected = String(b._id || '') === String(selectedBranchId);
              const isHQ = Boolean(b.isHQ);
              return (
                <div
                  key={b._id}
                  className={`order-branch-menu-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectBranch(b._id);
                    setIsOpen(false);
                  }}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="order-branch-item-main">
                    <div className={`order-branch-item-icon ${isHQ ? 'hq' : ''}`}>
                      <Store size={15} />
                    </div>
                    <div>
                      <div className="d-flex align-items-center gap-1 flex-wrap">
                        <span className="order-branch-item-name">{b.name || b.shopName}</span>
                        {isHQ && (
                          <span className="branch-tag-hq ms-1">Trụ sở chính</span>
                        )}
                        {b.branchCode && (
                          <span className="order-branch-code-pill ms-1">{b.branchCode}</span>
                        )}
                      </div>
                      <div className="order-branch-item-desc text-truncate">
                        {b.address || 'Chưa cập nhật địa chỉ'}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check size={16} className="text-primary" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * OrderPagination Component
 * Paginate orders with clean navigation buttons and total counts.
 */
export function OrderPagination({
  pagination,
  onPageChange,
  entityName = 'đơn',
}) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, limit, totalPages, totalItems } = pagination;
  const startIdx = (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, totalItems);

  return (
    <div className="order-pagination-wrap">
      <div className="order-pagination-info">
        Hiển thị <strong>{startIdx}</strong> - <strong>{endIdx}</strong> trong tổng số{' '}
        <strong>{totalItems}</strong> {entityName}
      </div>

      <div className="order-pagination-controls">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="order-pagination-btn"
          aria-label="Chuyển đến trang trước"
        >
          <ChevronLeft size={15} />
          <span>Trang Trước</span>
        </button>

        <span className="order-pagination-page" aria-current="page">
          Trang {page} / {totalPages}
        </span>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="order-pagination-btn"
          aria-label="Chuyển đến trang kế tiếp"
        >
          <span>Trang Sau</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

/**
 * OrderFilterBar Component
 * 100% harmonized with unified-branches-taskbar from ShopBranches.css
 */
export default function OrderFilterBar({
  type = 'rental',
  statusTabs = [],
  activeTab = 'all',
  onTabChange = () => {},
  searchQuery = '',
  onSearchChange = () => {},
  branches = [],
  selectedBranchId = '',
  onSelectBranch = () => {},
  isBranchMode = false,
  activeBranch = null,
  onRefresh = () => {},
  loading = false,
}) {
  const listTabs = statusTabs || [];
  const searchPlaceholder =
    type === 'rental'
      ? 'Tìm theo mã đơn, khách hàng, số điện thoại...'
      : 'Tìm theo mã đơn bán, khách hàng, số điện thoại...';

  return (
    <div className="unified-branches-taskbar mb-3">
      {/* 1. Left: Search & Custom Branch Filter Dropdown */}
      <div className="taskbar-actions-group">
        <div className="taskbar-search-wrapper" style={{ minWidth: '260px' }}>
          <Search size={14} className="taskbar-search-icon" />
          <input
            type="text"
            className="taskbar-search-input"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery.length > 0 && (
            <button
              type="button"
              className="taskbar-clear-search"
              onClick={() => onSearchChange('')}
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          )}
        </div>

        {/* Custom luxury branch dropdown with "Trụ sở chính" tags */}
        <BranchSelectDropdown
          branches={branches}
          selectedBranchId={selectedBranchId}
          onSelectBranch={onSelectBranch}
          isBranchMode={isBranchMode}
          activeBranch={activeBranch}
        />

        {/* 2. Status Segmented Tabs */}
        <div className="taskbar-status-segmented">
          {listTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                className={`taskbar-status-btn ${isActive ? 'active' : ''}`}
                onClick={() => onTabChange(tab.key)}
              >
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className={`status-segment-count ${isActive ? 'active' : ''}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 3. Refresh Action */}
        <button
          type="button"
          className="taskbar-refresh-btn"
          onClick={onRefresh}
          disabled={loading}
          title="Làm mới dữ liệu"
        >
          <RotateCw size={14} className={loading ? 'spin' : ''} />
        </button>
      </div>
    </div>
  );
}
