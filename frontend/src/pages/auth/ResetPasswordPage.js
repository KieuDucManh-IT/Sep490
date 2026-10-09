import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/AuthLayout';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmNewPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.newPassword) {
      newErrors.newPassword = 'Vui lòng nhập mật khẩu mới';
    } else if (formData.newPassword.length < 8) {
      newErrors.newPassword = 'Mật khẩu phải chứa ít nhất 8 ký tự';
    }

    if (formData.newPassword !== formData.confirmNewPassword) {
      newErrors.confirmNewPassword = 'Mật khẩu xác nhận không khớp';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSuccess(true);
    setTimeout(() => {
      navigate('/login');
    }, 3000);
  };

  return (
    <AuthLayout
      badgeText="BẢO MẬT MẬT KHẨU"
      titleQuote="Sự riêng tư và an toàn dữ liệu cá nhân của quý khách luôn là tiêu chuẩn hàng đầu tại Vestora."
      quoteAuthor="Haute Couture Tailoring"
    >
      <div className="auth-form-container">
        {!isSuccess ? (
          <>
            <div className="auth-form-header">
              <h1 className="auth-form-title">ĐẶT LẠI MẬT KHẨU</h1>
              <p className="auth-form-subtitle">
                Tạo mật khẩu mới an toàn cho tài khoản của bạn. Mật khẩu phải có độ dài tối thiểu 8 ký tự.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {/* New Password */}
              <div className="form-group">
                <label htmlFor="newPassword">MẬT KHẨU MỚI</label>
                <div className="input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="newPassword"
                    name="newPassword"
                    placeholder="Tối thiểu 8 ký tự"
                    value={formData.newPassword}
                    onChange={handleChange}
                    className={errors.newPassword ? 'error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
                {errors.newPassword && (
                  <span className="error-message">{errors.newPassword}</span>
                )}
              </div>

              {/* Confirm Password */}
              <div className="form-group">
                <label htmlFor="confirmNewPassword">XÁC NHẬN MẬT KHẨU MỚI</label>
                <div className="input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="confirmNewPassword"
                    name="confirmNewPassword"
                    placeholder="Nhập lại mật khẩu mới"
                    value={formData.confirmNewPassword}
                    onChange={handleChange}
                    className={errors.confirmNewPassword ? 'error' : ''}
                  />
                </div>
                {errors.confirmNewPassword && (
                  <span className="error-message">{errors.confirmNewPassword}</span>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', marginTop: '16px' }}
              >
                LƯU MẬT KHẨU MỚI
              </button>
            </form>
          </>
        ) : (
          <div className="auth-form-header" style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(52, 199, 89, 0.1)',
                border: '1px solid rgba(52, 199, 89, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px auto',
                fontSize: '28px',
                color: '#34C759',
              }}
            >
              ✓
            </div>
            <h1 className="auth-form-title">THÀNH CÔNG!</h1>
            <p className="auth-form-subtitle" style={{ marginBottom: '24px' }}>
              Mật khẩu của bạn đã được cập nhật thành công. Bạn sẽ được tự động chuyển hướng đến trang đăng nhập trong giây lát...
            </p>
            <Link to="/login" className="btn-primary" style={{ display: 'block', textDecoration: 'none' }}>
              ĐĂNG NHẬP NGAY NOW
            </Link>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}

