/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-WSH-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-007
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-010
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-011
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-CRT-001
 *
 * LookbookGrid — Lưới sản phẩm Tủ đồ thời trang chuẩn Haute Couture
 * - Tỷ lệ khung ảnh 3:4 cao cấp với hiệu ứng zoom mượt mà
 * - Hiển thị huy hiệu Thuê / Bán, ghi chú phối đồ cá nhân
 * - Nút thêm vào giỏ hàng 1-click & Quản lý món đồ
 * - Zero-Emoji & SVG Icons từ Lucide React
 */

import React from 'react';
import { ShoppingBag, Sparkles, Trash2, Bookmark, Calendar, AlertCircle } from 'lucide-react';
import { FavoriteHeartButton } from './FavoriteHeartButton';
import './WardrobeModals.css';

export const LookbookGrid = ({
  items = [],
  isDefault = false,
  isReadOnly = false,
  onAddToCart,
  onRemoveItem,
  onEditNotes,
  onSaveToCollection,
  emptyMessage = 'Chưa có sản phẩm nào trong danh sách.',
}) => {
  if (!items || items.length === 0) {
    return (
      <div
        style={{
          padding: '60px 24px',
          textAlign: 'center',
          background: 'var(--vst-bg-card)',
          borderRadius: '14px',
          border: '1px dashed var(--vst-border)',
        }}
      >
        <p style={{ fontFamily: 'var(--vst-font-serif)', fontSize: '20px', color: 'var(--vst-black)', margin: '0 0 8px 0' }}>
          {emptyMessage}
        </p>
        <p style={{ fontSize: '13.5px', color: 'var(--vst-text-muted)', margin: 0 }}>
          Hãy thả tim các thiết kế bạn yêu thích trong Catalogue để lưu vào tủ đồ cá nhân.
        </p>
      </div>
    );
  }

  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return '0 ₫';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="vst-grid">
      {items.map((item) => {
        const prod = item.productId || item;
        if (!prod) return null;

        const itemId = item._id;
        const actualProductId = prod._id || prod.id;
        const isRental = prod.tag === 'rental' || (prod.rentalPricePerDay > 0 && prod.tag !== 'sale');
        const priceDisplay = isRental
          ? `${formatCurrency(prod.rentalPricePerDay)}/ngày`
          : formatCurrency(prod.salePrice);

        const isUnavailable = prod.isDeleted || prod.status === 'inactive' || prod.status === 'discontinued';

        return (
          <div key={itemId || actualProductId} className="vst-card">
            {/* Ảnh và Huy hiệu */}
            <div className="vst-card-img-wrap">
              <img
                src={prod.primaryImageUrl || prod.thumbnailImage || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80'}
                alt={prod.name || 'Sản phẩm Vestora'}
                className="vst-card-img"
                loading="lazy"
              />

              <div className="vst-card-badge">
                {isRental ? 'Cho thuê' : 'Thanh lý'}
              </div>

              <div className="vst-card-top-actions">
                <FavoriteHeartButton productId={actualProductId} product={prod} size="sm" />
                {!isReadOnly && onSaveToCollection && (
                  <button
                    type="button"
                    className="vst-heart-btn vst-heart-btn--sm"
                    onClick={() => onSaveToCollection(prod)}
                    title="Lưu vào bộ sưu tập khác"
                    aria-label="Lưu vào bộ sưu tập"
                  >
                    <Bookmark size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Thông tin sản phẩm */}
            <div className="vst-card-body">
              <div className="vst-card-code">{prod.productCode || 'VESTORA-COUTURE'}</div>
              <h4 className="vst-card-title" title={prod.name}>
                {prod.name || 'Trang phục cao cấp'}
              </h4>

              {/* Ngày dự kiến sử dụng */}
              {item.targetUsageDate && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11.5px',
                    color: 'var(--vst-gold-dark)',
                    marginBottom: '6px',
                  }}
                >
                  <Calendar size={12} />
                  <span>Dự kiến: {new Date(item.targetUsageDate).toLocaleDateString('vi-VN')}</span>
                </div>
              )}

              {/* Ghi chú phong cách */}
              {item.notes && (
                <div className="vst-card-notes">
                  <span className="vst-card-notes-text">"{item.notes}"</span>
                  {!isReadOnly && onEditNotes && (
                    <button
                      type="button"
                      onClick={() => onEditNotes(item)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--vst-gold-dark)',
                        padding: '2px',
                        display: 'flex',
                      }}
                      title="Sửa ghi chú"
                    >
                      <Sparkles size={13} />
                    </button>
                  )}
                </div>
              )}

              {/* Giá và Trạng thái */}
              <div className="vst-card-price-row">
                <span className="vst-card-price">{priceDisplay}</span>
                {isUnavailable && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--vst-danger)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <AlertCircle size={12} />
                    <span>Tạm hết</span>
                  </span>
                )}
              </div>
            </div>

            {/* Thao tác chân thẻ */}
            <div className="vst-card-footer">
              <button
                type="button"
                className="vst-btn vst-btn--primary vst-btn--sm"
                style={{ flex: 1 }}
                onClick={() => onAddToCart && onAddToCart(item)}
                disabled={isUnavailable}
                title={isUnavailable ? 'Sản phẩm tạm thời không khả dụng' : 'Thêm vào giỏ hàng'}
              >
                <ShoppingBag size={14} />
                <span>Thêm vào giỏ</span>
              </button>

              {!isReadOnly && !isDefault && onRemoveItem && (
                <button
                  type="button"
                  className="vst-btn vst-btn--outline vst-btn--sm"
                  onClick={() => onRemoveItem(item)}
                  title="Xóa khỏi bộ sưu tập"
                  aria-label="Xóa khỏi bộ sưu tập"
                  style={{ padding: '6px 10px', color: 'var(--vst-danger)', borderColor: 'var(--vst-border)' }}
                >
                  <Trash2 size={14} />
                </button>
              )}

              {!isReadOnly && !item.notes && onEditNotes && (
                <button
                  type="button"
                  className="vst-btn vst-btn--outline vst-btn--sm"
                  onClick={() => onEditNotes(item)}
                  title="Thêm ghi chú phối đồ"
                  style={{ padding: '6px 10px' }}
                >
                  <Sparkles size={14} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LookbookGrid;
