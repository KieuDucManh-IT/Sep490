/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-004
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-005
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-001
 *
 * CollectionSidebar — Thanh điều hướng Bộ sưu tập Tủ đồ cá nhân
 * - Tab Mặc định "Tất cả yêu thích"
 * - Danh sách các Bộ sưu tập cá nhân tùy chỉnh
 * - Nút tạo mới bộ sưu tập và menu thao tác nhanh (Sửa, Xóa, Chia sẻ Lookbook)
 */

import React, { useState } from 'react';
import { Heart, FolderPlus, MoreVertical, Share2, Edit2, Trash2, Calendar, Globe, Lock } from 'lucide-react';
import './WardrobeModals.css';

export const CollectionSidebar = ({
  collections = [],
  activeId = 'default',
  totalWishlistCount = 0,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
  onShare,
}) => {
  const [openMenuId, setOpenMenuId] = useState(null);

  const customCollections = collections.filter((c) => !c.isDefault);

  const handleMenuClick = (e, colId) => {
    e.stopPropagation();
    setOpenMenuId((prev) => (prev === colId ? null : colId));
  };

  return (
    <aside className="vst-sidebar" style={{ minWidth: '270px' }}>
      <div className="vst-sidebar-header">
        <h3 className="vst-sidebar-title">Tủ đồ cá nhân</h3>
        <button
          type="button"
          className="vst-btn vst-btn--sm vst-btn--gold"
          onClick={onCreate}
          style={{ padding: '4px 10px', fontSize: '12.5px' }}
          title="Tạo bộ sưu tập mới"
        >
          <FolderPlus size={14} />
          <span>Tạo mới</span>
        </button>
      </div>

      {/* 1. Mặc định: Tất cả yêu thích */}
      <div
        className={`vst-collection-item ${activeId === 'default' ? 'vst-collection-item--active' : ''}`}
        onClick={() => onSelect('default')}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Heart
            size={18}
            fill={activeId === 'default' ? '#C5A880' : 'none'}
            stroke={activeId === 'default' ? '#C5A880' : 'currentColor'}
          />
          <span style={{ fontSize: '14px' }}>Tất cả yêu thích</span>
        </div>
        <span className="vst-collection-badge">{totalWishlistCount}</span>
      </div>

      <div style={{ height: '1px', background: 'var(--vst-border-light)', margin: '4px 0' }} />

      {/* 2. Danh sách Bộ sưu tập tùy chỉnh */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div
          style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: 'var(--vst-text-muted)',
            padding: '4px 8px',
            fontWeight: 600,
          }}
        >
          Bộ sưu tập của bạn ({customCollections.length})
        </div>

        {customCollections.length === 0 ? (
          <div
            style={{
              padding: '16px 12px',
              textAlign: 'center',
              fontSize: '12.5px',
              color: 'var(--vst-text-muted)',
              fontStyle: 'italic',
            }}
          >
            Chưa có bộ sưu tập riêng
          </div>
        ) : (
          customCollections.map((col) => {
            const isActive = activeId === col._id;
            const isMenuOpen = openMenuId === col._id;

            return (
              <div
                key={col._id}
                className={`vst-collection-item ${isActive ? 'vst-collection-item--active' : ''}`}
                onClick={() => onSelect(col._id)}
                style={{ position: 'relative' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {col.isPrivate === false ? (
                      <Globe size={14} color="var(--vst-gold-dark)" title="Công khai" />
                    ) : (
                      <Lock size={14} color="var(--vst-text-muted)" title="Riêng tư" />
                    )}
                    <span
                      style={{
                        fontSize: '13.5px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '130px',
                      }}
                    >
                      {col.name}
                    </span>
                  </div>
                  {col.eventDate && (
                    <div style={{ fontSize: '11px', color: 'var(--vst-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={11} />
                      <span>{new Date(col.eventDate).toLocaleDateString('vi-VN')}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="vst-collection-badge">{col.itemCount || 0}</span>
                  <button
                    type="button"
                    onClick={(e) => handleMenuClick(e, col._id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--vst-text-muted)',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex',
                    }}
                    title="Tùy chọn bộ sưu tập"
                  >
                    <MoreVertical size={16} />
                  </button>
                </div>

                {/* Popover Action Menu */}
                {isMenuOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: '8px',
                      background: '#FFFDF9',
                      border: '1px solid var(--vst-border)',
                      borderRadius: '8px',
                      boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                      zIndex: 10,
                      minWidth: '150px',
                      overflow: 'hidden',
                      padding: '4px 0',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--vst-text-main)',
                      }}
                      onClick={() => {
                        setOpenMenuId(null);
                        onShare(col);
                      }}
                    >
                      <Share2 size={14} color="var(--vst-gold-dark)" />
                      <span>Chia sẻ Lookbook</span>
                    </button>
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--vst-text-main)',
                      }}
                      onClick={() => {
                        setOpenMenuId(null);
                        onEdit(col);
                      }}
                    >
                      <Edit2 size={14} />
                      <span>Đổi tên & ngày</span>
                    </button>
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 12px',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--vst-danger)',
                      }}
                      onClick={() => {
                        setOpenMenuId(null);
                        onDelete(col);
                      }}
                    >
                      <Trash2 size={14} />
                      <span>Xóa bộ sưu tập</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default CollectionSidebar;
