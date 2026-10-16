import React, { useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import "../../styles/AuthRecovery.css";
import AuthLayout from "../../components/AuthLayout";
import { useAuth } from "../../context/AuthContext";
import { resetPasswordApi } from "../../services/authApi";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();

  const email = location.state?.email;
  const resetToken = location.state?.resetToken;

  const [formData, setFormData] = useState({
    newPassword: "",
    confirmNewPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

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
    const { newPassword, confirmNewPassword } = formData;

    if (!newPassword) {
      nextErrors.newPassword = "Vui lòng nhập mật khẩu mới";
    } else if (newPassword.length < 8) {
      nextErrors.newPassword =
        "Mật khẩu phải chứa ít nhất 8 ký tự";
    } else if (
      new TextEncoder().encode(newPassword).length > 72
    ) {
      nextErrors.newPassword =
        "Mật khẩu không được vượt quá 72 byte";
    }

    if (!confirmNewPassword) {
      nextErrors.confirmNewPassword =
        "Vui lòng nhập lại mật khẩu mới";
    } else if (newPassword !== confirmNewPassword) {
      nextErrors.confirmNewPassword =
        "Mật khẩu xác nhận không khớp";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);

    try {
      await resetPasswordApi(
        email,
        resetToken,
        newPassword,
        confirmNewPassword
      );

      setFormData({
        newPassword: "",
        confirmNewPassword: "",
      });

      // Backend đã xóa cookie của trình duyệt hiện tại.
      await refreshUser();

      navigate("/login", {
        replace: true,
        state: {
          successMessage:
            "Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.",
        },
      });
    } catch (error) {
      setErrors({
        server:
          error.message ||
          "Không thể đặt lại mật khẩu. Vui lòng thử lại",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Mở trực tiếp URL mà chưa xác thực OTP thì quay lại bước đầu.
  if (
    typeof email !== "string" ||
    !email ||
    typeof resetToken !== "string" ||
    !/^[a-f0-9]{64}$/.test(resetToken)
  ) {
    return <Navigate to="/forgot-password" replace />;
  }

  return (
    <AuthLayout
      badgeText="BẢO MẬT MẬT KHẨU"
      titleQuote="Sự riêng tư và an toàn dữ liệu cá nhân của quý khách luôn là tiêu chuẩn hàng đầu tại Vestora."
      quoteAuthor="Haute Couture Tailoring"
    >
      <div className="auth-form-container vestora-recovery-page">
        <div className="auth-form-header">
          <h1 className="auth-form-title">
            ĐẶT LẠI MẬT KHẨU
          </h1>

          <p className="auth-form-subtitle">
            Tạo mật khẩu mới cho tài khoản{" "}
            <strong style={{ overflowWrap: "anywhere" }}>
              {email}
            </strong>
            . Mật khẩu phải có ít nhất 8 ký tự.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
          noValidate
        >
          {errors.server && (
            <div
              role="alert"
              style={{
                padding: "12px 14px",
                marginBottom: 16,
                border: "1px solid #f2c6c3",
                borderRadius: 8,
                background: "#fff1f0",
                color: "#b54747",
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              {errors.server}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="newPassword">
              MẬT KHẨU MỚI
            </label>

            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="newPassword"
                name="newPassword"
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                value={formData.newPassword}
                onChange={handleChange}
                disabled={submitting}
                className={errors.newPassword ? "error" : ""}
                aria-invalid={Boolean(errors.newPassword)}
                aria-describedby={
                  errors.newPassword
                    ? "new-password-error"
                    : undefined
                }
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword((previous) => !previous)
                }
                aria-pressed={showPassword}
                aria-label={
                  showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                }
              >
                {showPassword ? "Ẩn" : "Hiện"}
              </button>
            </div>

            {errors.newPassword && (
              <span
                id="new-password-error"
                className="error-message"
                role="alert"
              >
                {errors.newPassword}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirmNewPassword">
              XÁC NHẬN MẬT KHẨU MỚI
            </label>

            <div className="input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="confirmNewPassword"
                name="confirmNewPassword"
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu mới"
                value={formData.confirmNewPassword}
                onChange={handleChange}
                disabled={submitting}
                className={
                  errors.confirmNewPassword ? "error" : ""
                }
                aria-invalid={Boolean(errors.confirmNewPassword)}
                aria-describedby={
                  errors.confirmNewPassword
                    ? "confirm-password-error"
                    : undefined
                }
              />
            </div>

            {errors.confirmNewPassword && (
              <span
                id="confirm-password-error"
                className="error-message"
                role="alert"
              >
                {errors.confirmNewPassword}
              </span>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
            style={{
              width: "100%",
              marginTop: 16,
              opacity: submitting ? 0.65 : 1,
            }}
          >
            {submitting
              ? "ĐANG LƯU..."
              : "LƯU MẬT KHẨU MỚI"}
          </button>
        </form>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 28,
            fontSize: 13,
          }}
        >
          <Link
            to="/forgot-password"
            style={{ color: "#96723d", textDecoration: "none" }}
          >
            Xác thực OTP lại
          </Link>

          <Link
            to="/login"
            style={{ color: "#96723d", textDecoration: "none" }}
          >
            Quay lại đăng nhập
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}