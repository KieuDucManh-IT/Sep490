/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-002
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-COL-004
 *
 * CreateCollectionModal — Hộp thoại Tạo mới / Chỉnh sửa Bộ sưu tập cá nhân
 * - Tuân thủ Haute Couture Tokens & BEM CSS
 * - Zero-Alert (hiển thị thông báo lỗi trực tiếp trên form)
 * - Zero-Emoji (Lucide React icons)
 */

import React, { useState, useEffect } from 'react';
import { FolderPlus, Edit3, X, AlertCircle } from 'lucide-react';
import { useWishlistStore } from '../../../stores/useWishlistStore';
import './WardrobeModals.css';

export const CreateCollectionModal = ({
  isOpen,
  collection = null, // null: Tạo mới, object: Chỉnh sửa
  onClose,
  onSuccess,
}) => {
  const isEditing = Boolean(collection && collection._id);
  const createCollection = useWishlistStore((state) => state.createCollection);
  const updateCollection = useWishlistStore((state) => state.updateCollection);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      if (collection) {
        setName(collection.name || '');
        setDescription(collection.description || '');
        setEventDate(collection.eventDate ? new Date(collection.eventDate).toISOString().split('T')[0] : '');
        setCoverImageUrl(collection.coverImageUrl || '');
      } else {
        setName('');
        setDescription('');
        setEventDate('');
        setCoverImageUrl('');
      }
      setFormError(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, collection]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Vui lòng nhập tên bộ sưu tập');
      return;
    }
    if (trimmedName.length > 100) {
      setFormError('Tên bộ sưu tập không được vượt quá 100 ký tự');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: trimmedName,
        description: description.trim(),
        eventDate: eventDate || null,
        coverImageUrl: coverImageUrl.trim(),
      };

      let result;
      if (isEditing) {
        result = await updateCollection(collection._id, payload);
      } else {
        result = await createCollection(payload);
      }

      if (onSuccess) {
        onSuccess(result);
      }
      onClose();
    } catch (err) {
      setFormError(err.message || 'Không thể lưu bộ sưu tập. Vui lòng thử lại.');
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
              {isEditing ? <Edit3 size={20} /> : <FolderPlus size={20} />}
            </div>
            <div>
              <h3 className="vst-modal-title">
                {isEditing ? 'Chỉnh sửa bộ sưu tập' : 'Tạo bộ sưu tập mới'}
              </h3>
              <p className="vst-modal-subtitle">
                {isEditing ? 'Cập nhật chủ đề và thời gian dịp đặc biệt' : 'Khởi tạo không gian phối đồ cho sự kiện của bạn'}
              </p>
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
            {formError && (
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
                <span>{formError}</span>
              </div>
            )}

            <div className="vst-form-group">
              <label className="vst-form-label">
                Tên bộ sưu tập <span className="required">*</span>
              </label>
              <input
                type="text"
                className="vst-form-input"
                placeholder="Ví dụ: Dạ tiệc mùa xuân, Đám cưới bạn thân..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                required
                autoFocus
              />
              <div className="vst-form-hint">
                <span>Tối đa 100 ký tự</span>
                <span>{name.length}/100</span>
              </div>
            </div>

            <div className="vst-form-group">
              <label className="vst-form-label">Ngày diễn ra sự kiện (Tùy chọn)</label>
              <input
                type="date"
                className="vst-form-input"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
              <div className="vst-form-hint">
                <span>Giúp Vestora nhắc nhở lịch ướm thử và thuê đồ</span>
              </div>
            </div>

            <div className="vst-form-group">
              <label className="vst-form-label">Mô tả phong cách</label>
              <textarea
                className="vst-form-textarea"
                placeholder="Ví dụ: Phong cách quyến rũ, tông màu pastel ấm, phối cùng giày cao gót mũi nhọn..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <div className="vst-form-hint">
                <span>Tối đa 500 ký tự</span>
                <span>{description.length}/500</span>
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
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo bộ sưu tập'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCollectionModal;
