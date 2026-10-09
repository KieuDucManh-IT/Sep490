import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/AuthLayout';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
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

    if (!formData.fullName.trim()) newErrors.fullName = 'Vui lòng nhập họ và tên';
    if (!formData.email.trim()) newErrors.email = 'Vui lòng nhập email';
    if (!formData.phone.trim()) newErrors.phone = 'Vui lòng nhập số điện thoại';
    if (!formData.password) newErrors.password = 'Vui lòng nhập mật khẩu';
    else if (formData.password.length < 8) newErrors.password = 'Mật khẩu phải có ít nhất 8 ký tự';
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    if (!formData.agreeTerms) {
      newErrors.agreeTerms = 'Bạn cần đồng ý với điều khoản dịch vụ';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Submit logic
    alert('Đăng ký tài khoản thành công!');
    navigate('/login');
  };

  return (
    <AuthLayout
      badgeText="TRẢI NGHIỆM ĐẮC QUYỀN"
      titleQuote="Sự sang trọng hoàn hảo không chỉ nằm ở kiểu dáng, mà ở sự vừa vặn dành riêng cho bạn."
      quoteAuthor="Haute Couture Tailoring"
    >
      <div className="auth-form-container">
        <div className="auth-form-header">
          <h1 className="auth-form-title">TẠO TÀI KHOẢN MỚI</h1>
          <p className="auth-form-subtitle">
            Trải nghiệm dịch vụ may đo cao cấp và thiết kế cá nhân hóa dành riêng cho bạn.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {/* Full Name */}
          <div className="form-group">
            <label htmlFor="fullName">HỌ VÀ TÊN</label>
            <div className="input-wrapper">
              <input
                type="text"
                id="fullName"
                name="fullName"
                placeholder="Nguyễn Văn A"
                value={formData.fullName}
                onChange={handleChange}
                className={errors.fullName ? 'error' : ''}
              />
            </div>
            {errors.fullName && <span className="error-message">{errors.fullName}</span>}
          </div>

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

          {/* Phone */}
          <div className="form-group">
            <label htmlFor="phone">SỐ ĐIỆN THOẠI</label>
            <div className="input-wrapper">
              <input
                type="tel"
                id="phone"
                name="phone"
                placeholder="0912 345 678"
                value={formData.phone}
                onChange={handleChange}
                className={errors.phone ? 'error' : ''}
              />
            </div>
            {errors.phone && <span className="error-message">{errors.phone}</span>}
          </div>

          {/* Password */}
          <div className="form-group">
            <label htmlFor="password">MẬT KHẨU</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                placeholder="Ít nhất 8 ký tự"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password visibility"
              >
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </div>
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          {/* Confirm Password */}
          <div className="form-group">
            <label htmlFor="confirmPassword">XÁC NHẬN MẬT KHẨU</label>
            <div className="input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Nhập lại mật khẩu"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={errors.confirmPassword ? 'error' : ''}
              />
            </div>
            {errors.confirmPassword && (
              <span className="error-message">{errors.confirmPassword}</span>
            )}
          </div>

          {/* Checkbox Terms */}
          <div className="form-group">
            <label className="checkbox-container">
              <input
                type="checkbox"
                name="agreeTerms"
                checked={formData.agreeTerms}
                onChange={handleChange}
              />
              <span className="checkmark" />
              <span>
                Tôi đồng ý với{' '}
                <a href="#terms" onClick={(e) => e.preventDefault()} style={{ color: 'var(--color-gold-deep)', textDecoration: 'underline' }}>
                  Điều khoản dịch vụ
                </a>{' '}
                &{' '}
                <a href="#privacy" onClick={(e) => e.preventDefault()} style={{ color: 'var(--color-gold-deep)', textDecoration: 'underline' }}>
                  Chính sách bảo mật
                </a>
              </span>
            </label>
            {errors.agreeTerms && <span className="error-message">{errors.agreeTerms}</span>}
          </div>

          {/* Submit Button */}
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '12px' }}>
            ĐĂNG KÝ TÀI KHOẢN
          </button>
        </form>

        {/* Footer link */}
        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '14px', color: 'var(--color-text-secondary)' }}>
          Đã có tài khoản?{' '}
          <Link to="/login" style={{ color: 'var(--color-gold-deep)', fontWeight: 600, textDecoration: 'none' }}>
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

