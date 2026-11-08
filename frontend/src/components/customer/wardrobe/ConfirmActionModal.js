/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-UI-003
 *
 * ConfirmActionModal — Hộp thoại xác nhận thao tác chuẩn Haute Couture
 * - 100% Zero-Native Dialogs (Thay thế hoàn toàn window.confirm, alert)
 * - Zero-Emoji (Lucide React icons)
 * - Hỗ trợ thao tác xóa (Destructive) và xác nhận thông thường
 */

import React, { useEffect } from 'react';
import { HelpCircle, Trash2, X } from 'lucide-react';
import './WardrobeModals.css';

export const ConfirmActionModal = ({
  isOpen,
  title = 'Xác nhận thao tác',
  message = 'Bạn có chắc chắn muốn thực hiện hành động này không?',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  isDestructive = false,
  onConfirm,
  onClose,
  isLoading = false,
}) => {
  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="vst-modal-backdrop" onClick={isLoading ? undefined : onClose} role="dialog" aria-modal="true">
      <div
        className="vst-modal-container vst-modal-container--sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vst-modal-header">
          <div className="vst-modal-header-left">
            <div
              className={`vst-modal-icon-badge ${
                isDestructive ? 'vst-modal-icon-badge--danger' : ''
              }`}
            >
              {isDestructive ? <Trash2 size={20} /> : <HelpCircle size={20} />}
            </div>
            <div>
              <h3 className="vst-modal-title">{title}</h3>
            </div>
          </div>
          <button
            type="button"
            className="vst-modal-close-btn"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Đóng cửa sổ"
          >
            <X size={18} />
          </button>
        </div>

        <div className="vst-modal-body">
          <p style={{ margin: 0 }}>{message}</p>
        </div>

        <div className="vst-modal-footer">
          <button
            type="button"
            className="vst-btn vst-btn--outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`vst-btn ${isDestructive ? 'vst-btn--danger' : 'vst-btn--primary'}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Đang xử lý...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmActionModal;
