/**
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-001
 * @ears .sdd/features/wishlist-collections/SPEC.md#REQ-SHR-002
 *
 * ShareLookbookModal — Hộp thoại Chia sẻ Lookbook Công khai
 * - Bật/Tắt chế độ công khai (isPrivate)
 * - Hiển thị liên kết Lookbook thời thượng
 * - Nút sao chép 1-click có phản hồi trực quan
 * - Bảo vệ quyền riêng tư (Bảo đảm không lộ thông tin cá nhân)
 */

import React, { useState, useEffect } from 'react';
import { Share2, Copy, Check, ShieldCheck, X, Globe, Lock, AlertCircle } from 'lucide-react';
import { useWishlistStore } from '../../../stores/useWishlistStore';
import './WardrobeModals.css';

export const ShareLookbookModal = ({
  isOpen,
  collection,
  onClose,
  onShareChanged,
}) => {
  const toggleShare = useWishlistStore((state) => state.toggleShare);

  const [isPrivate, setIsPrivate] = useState(true);
  const [shareCode, setShareCode] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (isOpen && collection) {
      setIsPrivate(collection.isPrivate !== false);
      setShareCode(collection.shareCode || '');
      setIsCopied(false);
      setErrorMsg(null);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen, collection]);

  if (!isOpen || !collection) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://vestora.vn';
  const lookbookUrl = shareCode ? `${origin}/lookbook/${shareCode}` : '';

  const handleTogglePrivacy = async () => {
    setIsToggling(true);
    setErrorMsg(null);
    try {
      const nextPrivate = !isPrivate;
      const res = await toggleShare(collection._id, nextPrivate);
      setIsPrivate(res.isPrivate);
      setShareCode(res.shareCode || '');
      if (onShareChanged) {
        onShareChanged(res);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Không thể thay đổi trạng thái chia sẻ.');
    } finally {
      setIsToggling(false);
    }
  };

  const handleCopyLink = async () => {
    if (!lookbookUrl) return;
    try {
      await navigator.clipboard.writeText(lookbookUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      // Fallback nếu clipboard API bị chặn
      const textArea = document.createElement('textarea');
      textArea.value = lookbookUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  return (
    <div className="vst-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="vst-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="vst-modal-header">
          <div className="vst-modal-header-left">
            <div className="vst-modal-icon-badge">
              <Share2 size={20} />
            </div>
            <div>
              <h3 className="vst-modal-title">Chia sẻ Lookbook cá nhân</h3>
              <p className="vst-modal-subtitle">{collection.name}</p>
            </div>
          </div>
          <button
            type="button"
            className="vst-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
            <X size={18} />
          </button>
        </div>

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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              background: isPrivate ? 'var(--vst-bg-light)' : 'var(--vst-gold-light)',
              borderRadius: '10px',
              border: `1px solid ${isPrivate ? 'var(--vst-border)' : 'var(--vst-gold)'}`,
              marginBottom: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isPrivate ? (
                <Lock size={20} color="var(--vst-text-muted)" />
              ) : (
                <Globe size={20} color="var(--vst-gold-dark)" />
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--vst-black)' }}>
                  {isPrivate ? 'Đang ở chế độ riêng tư' : 'Đang ở chế độ công khai'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--vst-text-muted)', marginTop: '2px' }}>
                  {isPrivate
                    ? 'Chỉ mình bạn xem được bộ sưu tập này'
                    : 'Bất kỳ ai có đường link đều có thể xem trang phục'}
                </div>
              </div>
            </div>

            <button
              type="button"
              className={`vst-btn vst-btn--sm ${isPrivate ? 'vst-btn--gold' : 'vst-btn--outline'}`}
              onClick={handleTogglePrivacy}
              disabled={isToggling}
            >
              {isToggling ? 'Đang lưu...' : isPrivate ? 'Bật công khai' : 'Tắt công khai'}
            </button>
          </div>

          {!isPrivate && (
            <div>
              <label className="vst-form-label">Đường liên kết Lookbook của bạn</label>
              <div className="vst-share-box">
                <input
                  type="text"
                  readOnly
                  value={lookbookUrl}
                  className="vst-share-input"
                  onClick={(e) => e.target.select()}
                />
                <button
                  type="button"
                  className={`vst-btn vst-btn--sm ${isCopied ? 'vst-btn--outline' : 'vst-btn--primary'}`}
                  onClick={handleCopyLink}
                  style={{ minWidth: '130px' }}
                >
                  {isCopied ? (
                    <>
                      <Check size={14} color="var(--vst-success)" />
                      <span style={{ color: 'var(--vst-success)' }}>Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Sao chép link</span>
                    </>
                  )}
                </button>
              </div>

              <div
                style={{
                  marginTop: '16px',
                  padding: '12px 14px',
                  background: 'var(--vst-bg-card)',
                  borderRadius: '8px',
                  border: '1px solid var(--vst-border-light)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  fontSize: '12.5px',
                  color: 'var(--vst-text-muted)',
                }}
              >
                <ShieldCheck size={18} color="var(--vst-gold)" flexShrink={0} style={{ marginTop: '2px' }} />
                <span>
                  Bảo mật Vestora Haute Couture: Người xem chỉ nhìn thấy danh sách trang phục và Tên của bạn.
                  Số điện thoại, email và thông tin tài khoản được bảo mật tuyệt đối.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="vst-modal-footer">
          <button type="button" className="vst-btn vst-btn--outline" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareLookbookModal;
