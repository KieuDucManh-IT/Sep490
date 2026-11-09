/**
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-008
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-010
 * @ears .sdd/features/shopping-cart/SPEC.md#NFR-UX-01
 * Custom Haute Couture Modal for Confirming Item Removal (Zero-Native Dialogs)
 */

import React from 'react';
import { AlertCircle, Trash2, X } from 'lucide-react';
import './CartComponents.css';

export default function ConfirmRemoveModal({
  isOpen,
  item,
  onConfirm,
  onCancel,
  title = 'Xác nhận xóa trang phục',
  message = 'Quý khách có chắc chắn muốn bỏ món trang phục này khỏi giỏ hàng?',
}) {
  if (!isOpen) return null;

  return (
    <div
      className="vestora-cart-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-remove-title"
      onClick={onCancel}
    >
      <div
        className="vestora-cart-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vestora-cart-modal-header">
          <div className="vestora-cart-modal-header-icon">
            <AlertCircle size={20} color="#96723D" />
            <h3 id="confirm-remove-title" className="vestora-cart-modal-title">
              {title}
            </h3>
          </div>
          <button
            type="button"
            className="vestora-cart-modal-close-btn"
            onClick={onCancel}
            aria-label="Đóng hộp thoại"
          >
            <X size={18} />
          </button>
        </div>

        <div className="vestora-cart-modal-body">
          <p style={{ margin: 0 }}>{message}</p>

          {item && (
            <div className="vestora-cart-modal-product-preview">
              {item.thumbnailImage && (
                <img
                  src={item.thumbnailImage}
                  alt={item.name || 'Trang phục'}
                  className="vestora-cart-modal-product-img"
                />
              )}
              <div>
                <div className="vestora-cart-modal-product-name">{item.name}</div>
                <div className="vestora-cart-modal-product-meta">
                  {item.size && `Size: ${item.size}`}
                  {item.color && ` • Màu: ${item.color}`}
                  {item.orderType === 'rental' ? ' • Thuê trang phục' : ' • Mua thanh lý'}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="vestora-cart-modal-footer">
          <button
            type="button"
            className="vestora-cart-btn-secondary"
            onClick={onCancel}
          >
            Giữ lại
          </button>
          <button
            type="button"
            className="vestora-cart-btn-danger"
            onClick={onConfirm}
          >
            <Trash2 size={16} />
            Xóa khỏi giỏ
          </button>
        </div>
      </div>
    </div>
  );
}
