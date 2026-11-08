/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-010
 *
 * StylingNoteModal — Hộp thoại Chỉnh sửa Ghi chú Phối đồ & Ngày dự kiến sử dụng
 * - Cho phép cập nhật ghi chú phong cách tối đa 300 ký tự
 * - Cập nhật ngày dự kiến sử dụng trang phục
 * - Chuẩn Haute Couture Tokens & Zero-Emoji
 */

import React, { useState, useEffect } from 'react';
import { Sparkles, X, AlertCircle } from 'lucide-react';
import { useWishlistStore } from '../../../stores/useWishlistStore';
import './WardrobeModals.css';

export const StylingNoteModal = ({
  isOpen,
  collectionId,
  item,
  onClose,
  onSaved,
}) => {
  const updateItemNotes = useWishlistStore((state) => state.updateItemNotes);

  const [notes, setNotes] = useState('');
  const [targetUsageDate, setTargetUsageDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (isOpen && item) {
      setNotes(item.notes || '');
      setTargetUsageDate(item.targetUsageDate ? new Date(item.targetUsageDate).toISOString().split('T')[0] : '');
      setErrorMsg(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const productName = item.productId?.name || 'Trang phục';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        notes: notes.trim(),
        targetUsageDate: targetUsageDate || null,
      };

      const updated = await updateItemNotes(collectionId, item._id, payload);
      if (onSaved) {
        onSaved(updated);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Không thể lưu ghi chú.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="vst-modal-backdrop" onClick={isSubmitting ? undefined : onClose} role="dialog" aria-modal="true">
      <div className="vst-modal-container vst-modal-container--sm" onClick={(e) => e.stopPropagation()}>
        <div className="vst-modal-header">
          <div className="vst-modal-header-left">
            <div className="vst-modal-icon-badge">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="vst-modal-title">Ghi chú phối đồ</h3>
              <p className="vst-modal-subtitle">{productName}</p>
            </div>
          </div>
          <button
            type="button"
            className="vst-modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Đóng cửa sổ"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="vst-modal-body">
            {errorMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  background: 'var(--vst-danger-light)',
                  color: 'var(--vst-danger)',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                <AlertCircle size={16} flexShrink={0} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="vst-form-group">
              <label className="vst-form-label">Ngày dự kiến sử dụng</label>
              <input
                type="date"
                className="vst-form-input"
                value={targetUsageDate}
                onChange={(e) => setTargetUsageDate(e.target.value)}
              />
            </div>

            <div className="vst-form-group">
              <label className="vst-form-label">Ghi chú phong cách (Stylist Notes)</label>
              <textarea
                className="vst-form-textarea"
                placeholder="Ví dụ: Mang kèm thắt lưng bản to, layout makeup son đỏ nhung..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                rows={4}
                autoFocus
              />
              <div className="vst-form-hint">
                <span>Tối đa 300 ký tự</span>
                <span>{notes.length}/300</span>
              </div>
            </div>
          </div>

          <div className="vst-modal-footer">
            <button
              type="button"
              className="vst-btn vst-btn--outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="vst-btn vst-btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu ghi chú'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StylingNoteModal;
