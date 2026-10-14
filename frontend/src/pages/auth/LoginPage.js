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

    if (!formData.email.trim()) {
      newErrors.email = 'Vui lòng nhập địa chỉ email';
    }

    if (!formData.password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    }

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
      <style>{`
        .vestora-login {
          --login-gold: #96723d;
          --login-text: #28251f;
          --login-muted: #827c72;
          width: 100%;
          max-width: 430px;
          margin: 0 auto;
          padding: 28px 8px;
          color: var(--login-text);
          box-sizing: border-box;
        }

        .vestora-login * {
          box-sizing: border-box;
        }

        .vestora-login .login-eyebrow {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 22px;
          color: var(--login-gold);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 3px;
        }

        .vestora-login .login-eyebrow::before {
          content: '';
          width: 30px;
          height: 1px;
          background: var(--login-gold);
        }

        .vestora-login .login-title {
          margin: 0 0 14px;
          color: var(--login-text);
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(34px, 5vw, 44px);
          font-weight: 400;
          line-height: 1.15;
          letter-spacing: -1.5px;
        }

        .vestora-login .login-subtitle {
          margin: 0;
          color: var(--login-muted);
          font-size: 14px;
          line-height: 1.8;
        }

        .vestora-login .login-form {
          display: flex;
          flex-direction: column;
          gap: 23px;
          margin-top: 34px;
        }

        .vestora-login .login-label {
          display: block;
          margin-bottom: 10px;
          color: #514b41;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.3px;
        }

        .vestora-login .login-input-box {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 54px;
          padding: 0 16px;
          border: 1px solid #e5dfd5;
          border-radius: 10px;
          background: #fcfbf8;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .vestora-login .login-input-box:focus-within {
          border-color: var(--login-gold);
          box-shadow: 0 0 0 3px rgba(150, 114, 61, 0.1);
        }

        .vestora-login .login-input-box.has-error {
          border-color: #c45555;
        }

        .vestora-login .login-icon {
          width: 19px;
          height: 19px;
          flex-shrink: 0;
          color: #a49987;
        }

        .vestora-login .login-input {
          width: 100%;
          min-width: 0;
          height: 52px;
          margin: 0;
          padding: 0;
          border: none;
          border-radius: 0;
          outline: none;
          box-shadow: none;
          background: transparent;
          color: var(--login-text);
          font: inherit;
          font-size: 14px;
        }

        .vestora-login .login-input::placeholder {
          color: #aaa397;
        }

        .vestora-login .login-toggle {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 32px;
          height: 36px;
          padding: 0;
          border: none;
          border-radius: 5px;
          background: transparent;
          color: #8c8272;
          cursor: pointer;
        }

        .vestora-login .login-toggle:hover {
          color: var(--login-gold);
          background: #f0ece4;
        }

        .vestora-login .login-options {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: -3px;
        }

        .vestora-login .login-remember {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          color: #756e63;
          font-size: 13px;
          cursor: pointer;
        }

        .vestora-login .login-remember input {
          appearance: auto;
          position: static;
          width: 16px;
          height: 16px;
          margin: 0;
          opacity: 1;
          accent-color: var(--login-gold);
          cursor: pointer;
        }

        .vestora-login .login-link {
          color: var(--login-gold);
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          text-underline-offset: 4px;
        }

        .vestora-login .login-link:hover {
          text-decoration: underline;
        }

        .vestora-login .login-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          width: 100%;
          min-height: 54px;
          margin-top: 5px;
          padding: 14px 20px;
          border: none;
          border-radius: 10px;
          background: #96723d;
          color: #fff;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1.8px;
          box-shadow: 0 6px 16px rgba(150, 114, 61, 0.16);
          cursor: pointer;
          transition: background 0.2s, box-shadow 0.2s;
        }

        .vestora-login .login-submit:hover {
          background: #805f31;
          box-shadow: 0 8px 20px rgba(150, 114, 61, 0.23);
        }

        .vestora-login button:focus-visible,
        .vestora-login a:focus-visible,
        .vestora-login input[type='checkbox']:focus-visible {
          outline: 2px solid var(--login-gold);
          outline-offset: 4px;
        }

        .vestora-login .login-error {
          display: block;
          margin-top: 7px;
          color: #b54747;
          font-size: 12px;
          line-height: 1.5;
        }

        .vestora-login .login-footer {
          margin-top: 30px;
          padding-top: 25px;
          border-top: 1px solid #ece7de;
          color: var(--login-muted);
          text-align: center;
          font-size: 13px;
          line-height: 1.8;
        }

        @media (max-width: 480px) {
          .vestora-login {
            padding: 20px 4px;
          }

          .vestora-login .login-form {
            margin-top: 28px;
          }
        }
      `}</style>

      <div className="vestora-login">
        <header>
          <div className="login-eyebrow">WELCOME TO VESTORA</div>
          <h1 className="login-title">Chào mừng trở lại.</h1>
          <p className="login-subtitle">
            Đăng nhập để khám phá phong cách của bạn
            <br />
            và tiếp tục trải nghiệm cùng Vestora.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="login-form" noValidate>
          <div>
            <label htmlFor="email" className="login-label">
              ĐỊA CHỈ EMAIL
            </label>

            <div className={`login-input-box ${errors.email ? 'has-error' : ''}`}>
              <svg
                className="login-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <path d="m4 7 8 6 8-6" strokeLinejoin="round" />
              </svg>

              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                placeholder="example@domain.com"
                value={formData.email}
                onChange={handleChange}
                className="login-input"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
              />
            </div>

            {errors.email && (
              <span id="email-error" className="login-error" role="alert">
                {errors.email}
              </span>
            )}
          </div>

          <div>
            <label htmlFor="password" className="login-label">
              MẬT KHẨU
            </label>

            <div className={`login-input-box ${errors.password ? 'has-error' : ''}`}>
              <svg
                className="login-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <rect x="5" y="10" width="14" height="11" rx="3" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                <path d="M12 14v3" strokeLinecap="round" />
              </svg>

              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                autoComplete="current-password"
                placeholder="Nhập mật khẩu của bạn"
                value={formData.password}
                onChange={handleChange}
                className="login-input"
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error' : undefined}
              />

              <button
                type="button"
                className="login-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                  {showPassword && <path d="m3 3 18 18" />}
                </svg>
              </button>
            </div>

            {errors.password && (
              <span id="password-error" className="login-error" role="alert">
                {errors.password}
              </span>
            )}
          </div>

          <div className="login-options">
            <label className="login-remember">
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
              />
              <span>Ghi nhớ đăng nhập</span>
            </label>

            <Link to="/forgot-password" className="login-link">
              Quên mật khẩu?
            </Link>
          </div>

          <button type="submit" className="login-submit">
            ĐĂNG NHẬP
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12h14m-6-6 6 6-6 6" />
            </svg>
          </button>
        </form>

        <div className="login-footer">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="login-link">
            Đăng ký ngay
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}