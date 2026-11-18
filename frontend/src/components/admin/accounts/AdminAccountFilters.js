import React from 'react';

export default function AdminAccountFilters({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  onResetFilters,
  selectedCount,
  onBulkUnlock,
  onBulkLock,
  onExportCSV,
  onClearSelection
}) {
  return (
    <>
      <div className="admin-acc-filter-card">
        <div className="admin-acc-search-box">
          <span className="admin-acc-search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            className="admin-acc-search-input"
            placeholder="Tìm theo tên, email hoặc số điện thoại..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="admin-acc-search-clear"
              onClick={() => onSearchChange('')}
              title="Xóa tìm kiếm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <select
          className="admin-acc-select"
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value)}
        >
          <option value="ALL">Tất cả vai trò</option>
          <option value="customer">Khách hàng (customer)</option>
          <option value="shopOwner">Chủ cửa hàng (shopOwner)</option>
          <option value="branch_manager">Quản lý chi nhánh (branch_manager)</option>
          <option value="warehouse_manager">Quản lý kho (warehouse_manager)</option>
          <option value="warehouse_staff">Nhân viên kho (warehouse_staff)</option>
          <option value="admin">Quản trị viên (admin)</option>
        </select>

        <select
          className="admin-acc-select"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value)}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="ACTIVE">Hoạt động</option>
          <option value="LOCKED">Tạm khóa</option>
        </select>

        <button
          type="button"
          className="btn-acc-reset"
          onClick={onResetFilters}
          title="Đặt lại tất cả bộ lọc"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span>Đặt lại</span>
        </button>
      </div>

      {selectedCount > 0 && (
        <div className="admin-acc-bulk-bar">
          <div className="admin-acc-bulk-left">
            <span className="admin-acc-bulk-count">{selectedCount}</span>
            <span>tài khoản đã được chọn</span>
          </div>
          <div className="admin-acc-bulk-actions">
            <button
              type="button"
              className="btn-bulk-action"
              onClick={onBulkUnlock}
            >
              Mở khóa đã chọn
            </button>
            <button
              type="button"
              className="btn-bulk-action danger"
              onClick={onBulkLock}
            >
              Tạm khóa đã chọn
            </button>
            <button
              type="button"
              className="btn-bulk-action"
              onClick={onExportCSV}
            >
              Xuất đã chọn
            </button>
            <button
              type="button"
              className="btn-bulk-action"
              style={{ background: 'none', border: 'none', color: '#94A3B8' }}
              onClick={onClearSelection}
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}
    </>
  );
}
