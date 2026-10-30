import React from 'react';

export default function ResetPasswordModal({
  isOpen,
  onClose,
  selectedUser,
  resetPwdValue,
  setResetPwdValue,
  isResettingPwd,
  handleConfirmResetPassword,
}) {
  if (!isOpen || !selectedUser) return null;

  return (
    <div className="admin-acc-modal-overlay" onClick={onClose}>
      <div className="admin-acc-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="admin-acc-modal-head">
          <h3 className="admin-acc-modal-title">Đặt lại mật khẩu cho {selectedUser.name}</h3>
          <button
            type="button"
            className="admin-acc-drawer-close"
            onClick={onClose}
            title="Đóng"
          >
            <i className="fa-solid fa-xmark admin-acc-close-icon" />
          </button>
        </div>

        <div className="admin-acc-modal-body">
          <div className="admin-acc-reset-pwd-notice">
            <div className="admin-acc-reset-pwd-notice-title">
              <i className="fa-solid fa-paper-plane" />
              Gửi email tự động & Bắt buộc đổi mật khẩu
            </div>
            Hệ thống sẽ cập nhật mật khẩu mới và tự động gửi email thông báo tới <strong>{selectedUser.email}</strong>. Khi người dùng đăng nhập bằng mật khẩu này, hệ thống sẽ yêu cầu đổi mật khẩu mới để bảo mật.
          </div>

          <div className="admin-acc-form-group">
            <label className="admin-acc-form-label">Mật khẩu mới khởi tạo *</label>
            <div className="admin-acc-reset-pwd-input-row">
              <input
                type="text"
                className="admin-acc-form-input"
                value={resetPwdValue}
                disabled={isResettingPwd}
                onChange={(e) => setResetPwdValue(e.target.value)}
                placeholder="Nhập mật khẩu mới..."
              />
              <button
                type="button"
                className="btn-acc-outline"
                disabled={isResettingPwd}
                onClick={() => setResetPwdValue('Vestora@' + Math.floor(1000 + Math.random() * 9000))}
              >
                Tạo lại
              </button>
            </div>
            <small className="admin-acc-reset-pwd-hint">
              Gợi ý: Mật khẩu nên gồm ít nhất 8 ký tự, có chữ hoa, chữ thường và số.
            </small>
          </div>
        </div>

        <div className="admin-acc-modal-foot">
          <button
            type="button"
            className="btn-acc-outline"
            disabled={isResettingPwd}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn-acc-primary"
            disabled={isResettingPwd}
            onClick={handleConfirmResetPassword}
          >
            {isResettingPwd ? (
              <>
                <i className="fa-solid fa-spinner fa-spin admin-acc-btn-icon" />
                Đang xử lý & Gửi email...
              </>
            ) : (
              <>
                <i className="fa-solid fa-key admin-acc-btn-icon" />
                Cập nhật & Gửi email mật khẩu
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

