import React from 'react';

export default function LockReasonModal({
  isOpen,
  onClose,
  isLocking,
  lockReasonText,
  setLockReasonText,
  confirmLockWithReason,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="admin-lock-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLocking) onClose();
      }}
    >
      <div className="admin-lock-modal-card">
        {/* Header */}
        <div className="admin-lock-modal-header">
          <div className="admin-lock-icon-wrap">
            <i className="fa-solid fa-lock" />
          </div>
          <div className="admin-lock-header-text">
            <div className="admin-lock-title">
              Khóa Tài Khoản
            </div>
            <div className="admin-lock-subtitle">
              Hệ thống sẽ gửi email thông báo lý do tới người dùng
            </div>
          </div>
          <button
            type="button"
            className="admin-lock-close-btn"
            onClick={() => !isLocking && onClose()}
            disabled={isLocking}
            title="Đóng"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Body */}
        <div className="admin-lock-modal-body">
          <div className="admin-lock-alert-box">
            <div className="admin-lock-alert-title">
              <i className="fa-solid fa-triangle-exclamation" />
              <span>LƯU Ý</span>
            </div>
            <div className="admin-lock-alert-desc">
              Người dùng sẽ nhận được email thông báo kèm lý do khóa ngay sau khi bạn xác nhận.
              Tài khoản bị khóa sẽ không thể đăng nhập cho đến khi được mở khóa.
            </div>
          </div>

          <label className="admin-lock-label">
            Lý do khóa tài khoản <span className="admin-acc-req-star">*</span>
          </label>
          <textarea
            rows={4}
            value={lockReasonText}
            onChange={(e) => setLockReasonText(e.target.value)}
            placeholder="Vd: Vi phạm điều khoản sử dụng dịch vụ, giao dịch gian lận, phản ánh từ người dùng khác..."
            className={`admin-lock-textarea ${lockReasonText.trim().length > 0 && lockReasonText.trim().length < 5 ? 'has-error' : ''}`}
          />
          {lockReasonText.trim().length > 0 && lockReasonText.trim().length < 5 && (
            <div className="admin-lock-error-msg">
              <i className="fa-solid fa-circle-exclamation" />
              <span>Lý do phải có ít nhất 5 ký tự.</span>
            </div>
          )}
          <div className="admin-lock-char-count">
            {lockReasonText.length} ký tự
          </div>
        </div>

        {/* Footer */}
        <div className="admin-lock-modal-footer">
          <button
            type="button"
            className="admin-lock-btn-cancel"
            onClick={onClose}
            disabled={isLocking}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={confirmLockWithReason}
            disabled={isLocking || lockReasonText.trim().length < 5}
            className={`admin-lock-btn-confirm ${lockReasonText.trim().length >= 5 && !isLocking ? 'is-active' : ''}`}
          >
            {isLocking ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-lock" />
                <span>Xác nhận khóa & Gửi email</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

