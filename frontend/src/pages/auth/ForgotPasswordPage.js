import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/AuthLayout';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Vui lòng nhập địa chỉ email');
      return;
    }
    setError('');
    setIsSubmitted(true);
  };

  return (
    <AuthLayout
      badgeText="KHÔI PHỤC TÀI KHOẢN"
      titleQuote="Sự an tâm của bạn là ưu tiên hàng đầu trong trải nghiệm may đo cá nhân hóa tại Vestora."
      quoteAuthor="Vestora Concierge Service"
    >
      <div className="auth-form-container">
        {!isSubmitted ? (
          <>
            <div className="auth-form-header">
              <h1 className="auth-form-title">QUÊN MẬT KHẨU?</h1>
              <p className="auth-form-subtitle">
                Đừng lo lắng. Hãy nhập địa chỉ email đã đăng ký của bạn. Chúng tôi sẽ gửi hướng dẫn khôi phục mật khẩu trong giây lát.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="email">ĐỊA CHỈ EMAIL DỰ ĐỊNH KHÔI PHỤC</label>
                <div className="input-wrapper">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="example@domain.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    className={error ? 'error' : ''}
                  />
                </div>
                {error && <span className="error-message">{error}</span>}
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', marginTop: '16px' }}
              >
                GỬI YÊU CẦU KHÔI PHỤC
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
            <h1 className="auth-form-title">ĐÃ GỬI EMAIL KHÔI PHỤC</h1>
            <p className="auth-form-subtitle" style={{ marginBottom: '24px' }}>
              Chúng tôi đã gửi liên kết đặt lại mật khẩu đến <strong>{email}</strong>. Vui lòng kiểm tra hộp thư đến (và thư mục Spam) của bạn.
            </p>

            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsSubmitted(false)}
              style={{ width: '100%', marginBottom: '16px' }}
            >
              GỬI LẠI EMAIL KHÁC
            </button>
          </div>
        )}

        {/* Navigation Link Back */}
        <div style={{ textAlign: 'center', marginTop: '32px', fontSize: '14px' }}>
          <Link
            to="/login"
            style={{
              color: 'var(--color-text-secondary)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'color 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = 'var(--color-gold-deep)')}
            onMouseOut={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
          >
            ← Quay lại trang đăng nhập
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

