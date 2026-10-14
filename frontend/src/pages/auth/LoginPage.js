import React, { useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";

import AuthLayout from "../../components/AuthLayout";
import { useAuth } from "../../context/AuthContext";

function getHome(role) {
  if (role === "admin") return "/admin/dashboard";
  if (role === "shop_owner") return "/shop/dashboard";

  return "/";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, loading, login } = useAuth();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setErrors((previous) => ({
      ...previous,
      [name]: "",
      server: "",
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    const nextErrors = {};
    const email = formData.email.trim();

    if (!email) {
      nextErrors.email = "Vui lòng nhập email";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "Email không đúng định dạng";
    }

    if (!formData.password) {
      nextErrors.password = "Vui lòng nhập mật khẩu";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    try {
      const loggedInUser = await login(
        email,
        formData.password
      );

      const from = location.state?.from;

      const destination =
        typeof from === "string" &&
        from.startsWith("/") &&
        !from.startsWith("//") &&
        from !== "/login"
          ? from
          : getHome(loggedInUser.role);

      navigate(destination, { replace: true });
    } catch (error) {
      setErrors({
        server: error.message || "Đăng nhập thất bại",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p style={{ padding: 24 }}>Đang tải...</p>;
  }

  if (user && !submitting) {
    return <Navigate to={getHome(user.role)} replace />;
  }

  return (
    <AuthLayout
      badgeText="TRẢI NGHIỆM ĐẮC QUYỀN"
      titleQuote="Thời trang cao cấp không chỉ là trang phục, đó là nghệ thuật thể hiện bản ngã."
      quoteAuthor="Vestora Tailoring Art"
    >
      <style>{`
        .vestora-login {
          width: 100%;
          max-width: 430px;
          margin: 0 auto;
          padding: 28px 8px;
          color: #28251f;
          box-sizing: border-box;
        }

        .vestora-login * {
          box-sizing: border-box;
        }

        .vestora-login .login-eyebrow {
          color: #96723d;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 3px;
          margin-bottom: 20px;
        }

        .vestora-login h1 {
          font-family: Georgia, serif;
          font-size: 40px;
          font-weight: 400;
          margin: 0 0 14px;
        }

        .vestora-login .login-subtitle {
          color: #827c72;
          font-size: 14px;
          line-height: 1.8;
        }

        .vestora-login .login-form {
          display: flex;
          flex-direction: column;
          gap: 22px;
          margin-top: 30px;
        }

        .vestora-login .login-label {
          display: block;
          margin-bottom: 10px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1px;
        }

        .vestora-login .login-input-box {
          display: flex;
          align-items: center;
          min-height: 54px;
          padding: 0 14px;
          border: 1px solid #e5dfd5;
          border-radius: 10px;
          background: #fcfbf8;
        }

        .vestora-login .login-input-box:focus-within {
          border-color: #96723d;
          box-shadow: 0 0 0 3px rgba(150,114,61,.1);
        }

        .vestora-login .login-input-box.has-error {
          border-color: #b54747;
        }

        .vestora-login .login-input {
          width: 100%;
          min-width: 0;
          height: 52px;
          border: 0;
          outline: 0;
          background: transparent;
          font-size: 14px;
          color: #28251f;
        }

        .vestora-login .login-toggle {
          border: 0;
          background: transparent;
          color: #96723d;
          cursor: pointer;
          white-space: nowrap;
          padding: 8px;
        }

        .vestora-login .login-error {
          color: #b54747;
          font-size: 13px;
          line-height: 1.6;
          margin: 7px 0 0;
        }

        .vestora-login .login-server-error {
          background: #fff1f0;
          border: 1px solid #f2c6c3;
          padding: 12px;
          border-radius: 8px;
        }

        .vestora-login .login-link {
          color: #96723d;
          text-decoration: none;
          font-size: 13px;
        }

        .vestora-login .login-options {
          text-align: right;
        }

        .vestora-login .login-submit {
          width: 100%;
          min-height: 52px;
          border: 0;
          border-radius: 10px;
          background: #96723d;
          color: white;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 1px;
          cursor: pointer;
        }

        .vestora-login button:disabled {
          opacity: .65;
          cursor: not-allowed;
        }

        .vestora-login .login-footer {
          margin-top: 28px;
          padding-top: 22px;
          border-top: 1px solid #ece7de;
          text-align: center;
          color: #827c72;
          font-size: 13px;
        }
      `}</style>

      <div className="vestora-login">
        <div className="login-eyebrow">
          WELCOME TO VESTORA
        </div>

        <h1>Chào mừng trở lại.</h1>

        <p className="login-subtitle">
          Đăng nhập để tiếp tục trải nghiệm cùng Vestora.
        </p>

        <form
          className="login-form"
          onSubmit={handleSubmit}
          noValidate
        >
          {errors.server && (
            <div
              className="login-error login-server-error"
              role="alert"
            >
              {errors.server}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="login-label"
            >
              ĐỊA CHỈ EMAIL
            </label>

            <div
              className={`login-input-box ${
                errors.email ? "has-error" : ""
              }`}
            >
              <input
                id="email"
                name="email"
                type="email"
                className="login-input"
                autoComplete="email"
                placeholder="example@domain.com"
                value={formData.email}
                onChange={handleChange}
                disabled={submitting}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={
                  errors.email ? "email-error" : undefined
                }
              />
            </div>

            {errors.email && (
              <p
                id="email-error"
                className="login-error"
                role="alert"
              >
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="password"
              className="login-label"
            >
              MẬT KHẨU
            </label>

            <div
              className={`login-input-box ${
                errors.password ? "has-error" : ""
              }`}
            >
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                className="login-input"
                autoComplete="current-password"
                placeholder="Nhập mật khẩu"
                value={formData.password}
                onChange={handleChange}
                disabled={submitting}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password
                    ? "password-error"
                    : undefined
                }
              />

              <button
                type="button"
                className="login-toggle"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                aria-pressed={showPassword}
                aria-label={
                  showPassword
                    ? "Ẩn mật khẩu"
                    : "Hiện mật khẩu"
                }
              >
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>

            {errors.password && (
              <p
                id="password-error"
                className="login-error"
                role="alert"
              >
                {errors.password}
              </p>
            )}
          </div>

          <div className="login-options">
            <Link
              to="/forgot-password"
              className="login-link"
            >
              Quên mật khẩu?
            </Link>
          </div>

          <button
            type="submit"
            className="login-submit"
            disabled={submitting}
          >
            {submitting
              ? "ĐANG ĐĂNG NHẬP..."
              : "ĐĂNG NHẬP"}
          </button>
        </form>

        <div className="login-footer">
          Chưa có tài khoản?{" "}
          <Link to="/register" className="login-link">
            Đăng ký ngay
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}