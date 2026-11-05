import React from 'react';
import { Search, RefreshCw, Plus } from 'lucide-react';

export default function BranchTaskbar({
  searchTerm,
  onSearchChange,
  selectedCity,
  onCityChange,
  selectedStatus,
  onStatusChange,
  onRefresh,
  onOpenCreateModal,
  provinces = [],
}) {
  return (
    <div className="unified-branches-taskbar">
      <div className="taskbar-actions-group">
        <div className="taskbar-search-wrapper">
          <Search size={14} className="taskbar-search-icon" />
          <input
            type="text"
            className="taskbar-search-input"
            placeholder="Tìm theo tên, địa chỉ, hotline, quản lý..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchTerm.length > 0 && (
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

        <select
          className="taskbar-select-filter"
          value={selectedCity}
          onChange={(e) => onCityChange(e.target.value)}
        >
          <option value="ALL">Tất cả Tỉnh / TP</option>
          {provinces.map((province) => (
            <option key={province.code || province.name} value={province.name}>
              {province.name}
            </option>
          ))}
        </select>

        <div className="taskbar-status-segmented">
          <button
            type="button"
            className={`taskbar-status-btn ${selectedStatus === 'ALL' ? 'active' : ''}`}
            onClick={() => onStatusChange('ALL')}
          >
            Tất cả
          </button>
          <button
            type="button"
            className={`taskbar-status-btn ${selectedStatus === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => onStatusChange('ACTIVE')}
          >
            Đang hoạt động
          </button>
          <button
            type="button"
            className={`taskbar-status-btn ${selectedStatus === 'SUSPENDED' ? 'active' : ''}`}
            onClick={() => onStatusChange('SUSPENDED')}
          >
            Tạm ngưng
          </button>
        </div>

        <button
          type="button"
          className="taskbar-refresh-btn"
          onClick={onRefresh}
          title="Làm mới danh sách"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div>
        <button
          type="button"
          className="taskbar-add-btn"
          onClick={onOpenCreateModal}
        >
          <Plus size={15} />
          <span>Thêm Chi Nhánh Mới</span>
        </button>
      </div>
    </div>
  );
}

