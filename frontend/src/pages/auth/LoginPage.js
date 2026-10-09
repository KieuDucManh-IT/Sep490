import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/AuthLayout';

export default function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.email.trim()) newErrors.email = 'Vui lòng nhập địa chỉ email';
    if (!formData.password) newErrors.password = 'Vui lòng nhập mật khẩu';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    alert('Đăng nhập thành công!');
    navigate('/');
  };

  return (
    <AuthLayout
      badgeText="TRẢI NGHIỆM ĐẮC QUYỀN"
      titleQuote="Thời trang cao cấp không chỉ là trang phục, đó là nghệ thuật thể hiện bản ngã đỉnh cao."
      quoteAuthor="Vestora Tailoring Art"
    >
      <div className="auth-form-container">
        <div className="auth-form-header">
          <h1 className="auth-form-title">ĐĂNG NHẬP</h1>
          <p className="auth-form-subtitle">
            Chào mừng bạn quay trở lại. Vui lòng nhập thông tin để truy cập tài khoản Vestora.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">ĐỊA CHỈ EMAIL</label>
            <div className="input-wrapper">
              <input
                type="email"
                id="email"
                name="email"
                placeholder="example@domain.com"
                value={formData.email}
                onChange={handleChange}
                className={errors.email ? 'error' : ''}
              />
            </div>
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          {/* Password */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="password" style={{ marginBottom: 0 }}>MẬT KHẨU</label>
              <Link
                to="/forgot-password"
                style={{
                  fontSize: '12px',
                  color: 'var(--color-gold-deep)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="input-wrapper" style={{ marginTop: '6px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                placeholder="Nhập mật khẩu của bạn"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          {/* Remember me */}
          <div className="form-group">
            <label className="checkbox-container">
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
              />
              <span className="checkmark" />
              <span>Ghi nhớ đăng nhập trên thiết bị này</span>
            </label>
          </div>

          {/* Submit */}
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '12px' }}>
            ĐĂNG NHẬP
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '28px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          Chưa có tài khoản?{' '}
          <Link to="/register" style={{ color: 'var(--color-gold-deep)', fontWeight: 600, textDecoration: 'none' }}>
            Đăng ký tài khoản mới
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

