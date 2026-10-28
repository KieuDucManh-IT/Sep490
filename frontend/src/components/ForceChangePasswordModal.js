import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { changePasswordApi } from '../services/authApi';
import '../styles/ForceChangePasswordModal.css';

export default function ForceChangePasswordModal() {
  const { user, refreshUser, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Chỉ hiển thị khi người dùng đã đăng nhập và có cờ mustChangePassword
  if (!user || !user.mustChangePassword) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword) {
      setError('Vui lòng nhập mật khẩu hiện tại (mật khẩu tạm thời vừa nhận trong email)');
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự');
      return;
    }

    if (newPassword === currentPassword) {
      setError('Mật khẩu mới không được trùng với mật khẩu tạm thời hiện tại');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Mật khẩu xác nhận không khớp với mật khẩu mới');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changePasswordApi(currentPassword, newPassword, confirmNewPassword);
      setSuccess(res?.message || 'Đổi mật khẩu thành công! Hệ thống đang cập nhật...');
      setTimeout(async () => {
        await refreshUser();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Không thể đổi mật khẩu. Vui lòng kiểm tra lại mật khẩu tạm thời.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Nếu người dùng chọn đóng tạm thời, hiển thị thanh cảnh báo ở góc trên
  if (isDismissed) {
    return (
      <div className="force-pwd-banner">
        <div className="force-pwd-banner-content">
          <i className="fa-solid fa-triangle-exclamation force-pwd-banner-icon" />
          <span>
            <strong>Lưu ý bảo mật:</strong> Tài khoản của bạn đang dùng mật khẩu tạm thời. Vui lòng đổi mật khẩu mới để tiếp tục sử dụng an toàn.
          </span>
        </div>
        <div className="force-pwd-banner-actions">
          <button
            type="button"
            className="force-pwd-banner-btn"
            onClick={() => setIsDismissed(false)}
          >
            Đổi mật khẩu ngay
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="force-pwd-overlay">
      <div className="force-pwd-card">
        {/* Header */}
        <div className="force-pwd-header">
          <div className="force-pwd-icon-box">
            <i className="fa-solid fa-shield-halved" />
          </div>
          <div className="force-pwd-header-text">
            <h3 className="force-pwd-title">Yêu cầu đổi mật khẩu mới</h3>
            <p className="force-pwd-subtitle">
              Mật khẩu của bạn vừa được cấp lại bởi Quản trị viên. Vì an toàn bảo mật, bạn bắt buộc phải thiết lập mật khẩu mới.
            </p>
          </div>
        </div>

        {/* Thông báo lỗi / thành công */}
        {error && (
          <div className="force-pwd-alert error">
            <i className="fa-solid fa-circle-exclamation" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="force-pwd-alert success">
            <i className="fa-solid fa-circle-check" />
            <span>{success}</span>
          </div>
        )}

        {/* Form đổi mật khẩu */}
        <form onSubmit={handleSubmit} className="force-pwd-form">
          {/* Mật khẩu hiện tại */}
          <div className="force-pwd-field">
            <label className="force-pwd-label">Mật khẩu tạm thời hiện tại *</label>
            <div className="force-pwd-input-wrap">
              <input
                type={showCurrent ? 'text' : 'password'}
                className="force-pwd-input"
                placeholder="Nhập mật khẩu tạm thời nhận từ email..."
                value={currentPassword}
                disabled={isSubmitting || !!success}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <button
                type="button"
                className="force-pwd-eye-btn"
                tabIndex="-1"
                onClick={() => setShowCurrent(!showCurrent)}
              >
                <i className={showCurrent ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} />
              </button>
            </div>
            <small className="force-pwd-hint">
              Kiểm tra hộp thư đến của <strong>{user.email}</strong> để lấy mật khẩu tạm thời này.
            </small>
          </div>

          {/* Mật khẩu mới */}
          <div className="force-pwd-field">
            <label className="force-pwd-label">Mật khẩu mới *</label>
            <div className="force-pwd-input-wrap">
              <input
                type={showNew ? 'text' : 'password'}
                className="force-pwd-input"
                placeholder="Nhập mật khẩu mới của bạn (tối thiểu 8 ký tự)..."
                value={newPassword}
                disabled={isSubmitting || !!success}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                className="force-pwd-eye-btn"
                tabIndex="-1"
                onClick={() => setShowNew(!showNew)}
              >
                <i className={showNew ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} />
              </button>
            </div>
          </div>

          {/* Xác nhận mật khẩu mới */}
          <div className="force-pwd-field">
            <label className="force-pwd-label">Xác nhận mật khẩu mới *</label>
            <div className="force-pwd-input-wrap">
              <input
                type={showConfirm ? 'text' : 'password'}
                className="force-pwd-input"
                placeholder="Nhập lại mật khẩu mới..."
                value={confirmNewPassword}
                disabled={isSubmitting || !!success}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
              <button
                type="button"
                className="force-pwd-eye-btn"
                tabIndex="-1"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                <i className={showConfirm ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'} />
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="force-pwd-actions">
            <button
              type="button"
              className="force-pwd-btn-secondary"
              disabled={isSubmitting}
              onClick={() => setIsDismissed(true)}
              title="Đóng tạm thời, bạn vẫn sẽ thấy thanh nhắc nhở đổi mật khẩu"
            >
              Nhắc tôi sau
            </button>
            <button
              type="submit"
              className="force-pwd-btn-primary"
              disabled={isSubmitting || !!success}
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }} />
                  Đang cập nhật...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-key" style={{ marginRight: '6px' }} />
                  Cập nhật mật khẩu mới
                </>
              )}
            </button>
          </div>

          <div className="force-pwd-logout-row">
            <span>Không phải bạn? </span>
            <button
              type="button"
              className="force-pwd-logout-btn"
              onClick={handleLogout}
            >
              Đăng xuất
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
