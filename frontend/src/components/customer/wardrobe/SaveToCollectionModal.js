/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-007
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-008
 *
 * SaveToCollectionModal — Hộp thoại Thêm sản phẩm vào Bộ sưu tập cá nhân
 * - Cho phép chọn Bộ sưu tập đích
 * - Nhập ghi chú phong cách (Styling Notes tối đa 300 ký tự)
 * - Chọn ngày dự kiến mặc (Target Usage Date)
 * - Nút tạo nhanh bộ sưu tập mới trực tiếp
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Bookmark, FolderPlus, X, Check, AlertCircle } from 'lucide-react';
import { useWishlistStore } from '../../../stores/useWishlistStore';
import './WardrobeModals.css';

export const SaveToCollectionModal = ({
  isOpen,
  product,
  onClose,
  onSuccess,
  onRequestCreateCollection,
}) => {
  const collections = useWishlistStore((state) => state.collections);
  const fetchCollections = useWishlistStore((state) => state.fetchCollections);
  const addItemToCollection = useWishlistStore((state) => state.addItemToCollection);

  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [notes, setNotes] = useState('');
  const [targetUsageDate, setTargetUsageDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Lọc chỉ lấy các bộ sưu tập tùy chỉnh (không phải mặc định)
  const customCollections = useMemo(
    () => (collections || []).filter((c) => !c.isDefault),
    [collections]
  );

  useEffect(() => {
    if (isOpen) {
      fetchCollections();
      setSelectedCollectionId(customCollections[0]?._id || '');
      setNotes('');
      setTargetUsageDate('');
      setErrorMsg(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fetchCollections]);

  if (!isOpen || !product) return null;

  const actualProductId = product._id || product.id || product.productId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedCollectionId) {
      setErrorMsg('Vui lòng chọn một bộ sưu tập');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        productId: actualProductId,
        variantId: product.variantId || null,
        notes: notes.trim(),
        targetUsageDate: targetUsageDate || null,
      };

      const addedItem = await addItemToCollection(selectedCollectionId, payload);
      if (onSuccess) {
        onSuccess(addedItem);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Không thể thêm sản phẩm vào bộ sưu tập.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="vst-modal-backdrop" onClick={isSubmitting ? undefined : onClose} role="dialog" aria-modal="true">
      <div className="vst-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="vst-modal-header">
          <div className="vst-modal-header-left">
            <div className="vst-modal-icon-badge">
              <Bookmark size={20} />
            </div>
            <div>
              <h3 className="vst-modal-title">Lưu vào bộ sưu tập</h3>
              <p className="vst-modal-subtitle">{product.name || 'Trang phục Vestora'}</p>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="vst-form-label" style={{ margin: 0 }}>
                  Chọn bộ sưu tập <span className="required">*</span>
                </label>
                {onRequestCreateCollection && (
                  <button
                    type="button"
                    className="vst-btn vst-btn--sm vst-btn--outline"
                    onClick={() => {
                      onClose();
                      onRequestCreateCollection();
                    }}
                    style={{ padding: '3px 8px', fontSize: '12px' }}
                  >
                    <FolderPlus size={14} />
                    <span>Tạo BST mới</span>
                  </button>
                )}
              </div>

              {customCollections.length === 0 ? (
                <div
                  style={{
                    padding: '20px',
                    textAlign: 'center',
                    background: 'var(--vst-bg-light)',
                    borderRadius: '8px',
                    border: '1px dashed var(--vst-border)',
                  }}
                >
                  <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--vst-text-muted)' }}>
                    Bạn chưa có bộ sưu tập riêng nào.
                  </p>
                  {onRequestCreateCollection && (
                    <button
                      type="button"
                      className="vst-btn vst-btn--primary vst-btn--sm"
                      onClick={() => {
                        onClose();
                        onRequestCreateCollection();
                      }}
                    >
                      <FolderPlus size={14} />
                      <span>Tạo bộ sưu tập đầu tiên</span>
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {customCollections.map((col) => {
                    const isSelected = selectedCollectionId === col._id;
                    return (
                      <div
                        key={col._id}
                        onClick={() => setSelectedCollectionId(col._id)}
                        className={`vst-collection-item ${isSelected ? 'vst-collection-item--active' : ''}`}
                        style={{ border: `1px solid ${isSelected ? 'var(--vst-gold)' : 'var(--vst-border)'}` }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              border: `1.5px solid ${isSelected ? 'var(--vst-gold)' : 'var(--vst-border)'}`,
                              background: isSelected ? 'var(--vst-gold)' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isSelected && <Check size={12} color="#FFF" />}
                          </div>
                          <span>{col.name}</span>
                        </div>
                        <span className="vst-collection-badge">{col.itemCount || 0} món</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="vst-form-group">
              <label className="vst-form-label">Ngày dự kiến mặc (Tùy chọn)</label>
              <input
                type="date"
                className="vst-form-input"
                value={targetUsageDate}
                onChange={(e) => setTargetUsageDate(e.target.value)}
              />
              <div className="vst-form-hint">
                <span>Dùng để nhắc nhở và tự động điền lịch thuê khi đặt</span>
              </div>
            </div>

            <div className="vst-form-group">
              <label className="vst-form-label">Ghi chú phối đồ / Stylist cá nhân</label>
              <textarea
                className="vst-form-textarea"
                placeholder="Ví dụ: Phối với túi cầm tay clutch ánh kim, dây chuyền ngọc trai..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={300}
                rows={2}
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
              disabled={isSubmitting || !selectedCollectionId}
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu vào bộ sưu tập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveToCollectionModal;
