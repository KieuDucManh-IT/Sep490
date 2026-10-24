import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../../components/AuthLayout";
import "../../styles/AuthRecovery.css";
import {
  forgotPasswordApi,
  verifyForgotPasswordOtpApi,
} from "../../services/authApi";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");

  const [step, setStep] = useState("email");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Gọi backend kiểm tra email và gửi OTP thật.
  const sendOtp = async () => {
    const result = await forgotPasswordApi(
      email.trim().toLowerCase()
    );

    setEmail(result.email);
    setChallengeId(result.challengeId);
    setOtp("");
    setStep("otp");
    setNotice(result.message);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (submitting) return;

    setError("");
    setNotice("");

    if (step === "email") {
      if (!email.trim()) {
        setError("Vui lòng nhập địa chỉ email");
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setError("Email không đúng định dạng");
        return;
      }
    } else if (!/^\d{6}$/.test(otp)) {
      setError("Vui lòng nhập đủ 6 chữ số OTP");
      return;
    }

    setSubmitting(true);

    try {
      if (step === "email") {
        await sendOtp();
      } else {
        const result = await verifyForgotPasswordOtpApi(
          email,
          challengeId,
          otp
        );

        // Chỉ chuyển trang khi backend xác nhận OTP đúng.
        navigate("/reset-password", {
          replace: true,
          state: {
            email,
            resetToken: result.resetToken,
          },
        });
      }
    } catch (err) {
      setError(
        err.message || "Không thực hiện được yêu cầu. Vui lòng thử lại"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (submitting) return;

    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      await sendOtp();
    } catch (err) {
      setError(err.message || "Không gửi được OTP");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeEmail = () => {
    setStep("email");
    setOtp("");
    setChallengeId("");
    setError("");
    setNotice("");
  };

  return (
    <AuthLayout
      badgeText="KHÔI PHỤC TÀI KHOẢN"
      titleQuote="Sự an tâm của bạn là ưu tiên hàng đầu trong trải nghiệm may đo cá nhân hóa tại Vestora."
      quoteAuthor="Vestora Concierge Service"
    >
      <style>{`
    .auth-form-container .recovery-email-field {
      width: 100%;
      margin: 8px 0 4px;
    }

    .auth-form-container .recovery-email-field label {
      display: block;
      margin: 0 0 12px;
      color: #40372b;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0;
      text-transform: none;
    }

    .auth-form-container .recovery-email-input {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      min-height: 62px;
      padding: 0 18px;
      box-sizing: border-box;
      border: 1.5px solid #d7c4a6;
      border-radius: 12px;
      background: #fcfaf6;
      box-shadow: 0 3px 12px rgba(96, 72, 38, 0.04);
      transition:
        border-color 0.2s,
        background 0.2s,
        box-shadow 0.2s;
    }

    .auth-form-container .recovery-email-input svg {
      flex-shrink: 0;
      color: #a18458;
    }

    .auth-form-container .recovery-email-input:hover {
      border-color: #ad8b59;
    }

    .auth-form-container .recovery-email-input:focus-within {
      border-color: #96723d;
      background: #fff;
      box-shadow: 0 0 0 4px rgba(150, 114, 61, 0.12);
    }

    .auth-form-container .recovery-email-input:focus-within svg {
      color: #84602f;
    }

    .auth-form-container .recovery-email-input input {
      display: block;
      flex: 1;
      width: 100%;
      min-width: 0;
      height: 58px;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      outline: none;
      background: transparent;
      box-shadow: none;
      color: #30291f;
      font-family: inherit;
      font-size: 16px;
      font-weight: 500;
      line-height: normal;
    }

    .auth-form-container .recovery-email-input input::placeholder {
      color: #a19789;
      font-size: 14px;
      font-weight: 400;
      opacity: 1;
    }

    .auth-form-container .recovery-email-input input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .auth-form-container .recovery-email-field p {
      margin: 10px 2px 0;
      color: #8b8173;
      font-size: 12px;
      line-height: 1.7;
    }

    @media (max-width: 480px) {
      .auth-form-container .recovery-email-input {
        gap: 10px;
        padding: 0 14px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .auth-form-container .recovery-email-input {
        transition: none;
      }
    }
  `}</style>

      <div className="auth-form-container vestora-recovery-page">
        <div className="auth-form-header">
          <h1 className="auth-form-title">
            {step === "email"
              ? "QUÊN MẬT KHẨU?"
              : "XÁC THỰC OTP"}
          </h1>

          <p className="auth-form-subtitle">
            {step === "email" ? (
              <>
                Nhập email đã đăng ký. VESTORA sẽ gửi mã OTP
                để bạn đặt lại mật khẩu.
              </>
            ) : (
              <>
                Nhập mã OTP gồm 6 chữ số đã gửi đến{" "}
                <strong style={{ overflowWrap: "anywhere" }}>
                  {email}
                </strong>
                . Mã có hiệu lực trong 5 phút.
              </>
            )}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="auth-form"
          noValidate
        >
          {error && (
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
              {error}
            </div>
          )}

          {notice && (
            <div
              role="status"
              style={{
                padding: "12px 14px",
                marginBottom: 16,
                border: "1px solid #cde5d3",
                borderRadius: 8,
                background: "#edf7f0",
                color: "#367047",
                fontSize: 13,
                lineHeight: 1.7,
              }}
            >
              {notice}
            </div>
          )}

          {step === "email" ? (
            <div className="recovery-email-field">
              <label htmlFor="recovery-email">
                Email tài khoản
              </label>

              <div className="recovery-email-input">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="14" rx="3" />
                  <path d="m4 7 8 6 8-6" />
                </svg>

                <input
                  type="email"
                  id="recovery-email"
                  name="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="Nhập email đã đăng ký"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                  disabled={submitting}
                  aria-describedby="recovery-email-hint"
                  required
                />
              </div>

              <p id="recovery-email-hint">
                Mã xác thực sẽ được gửi đến địa chỉ email này.
              </p>
            </div>
          ) : (
            <div className="recovery-otp-field">
              <div className="recovery-otp-heading">
                <label htmlFor="recovery-otp">Mã xác thực</label>
                <span>6 chữ số</span>
              </div>

              <div className="recovery-otp-box">
                <input
                  type="text"
                  id="recovery-otp"
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => {
                    setOtp(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6)
                    );
                    setError("");
                  }}
                  disabled={submitting}
                  aria-describedby="recovery-otp-hint"
                  required
                />
              </div>

              <p id="recovery-otp-hint">
                Mã có hiệu lực trong 5 phút. Kiểm tra cả thư mục Spam
                nếu bạn chưa nhận được email.
              </p>
            </div>
          )}

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
              ? "ĐANG XỬ LÝ..."
              : step === "email"
                ? "GỬI MÃ OTP"
                : "XÁC THỰC OTP"}
          </button>
        </form>

        {step === "otp" && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 20,
            }}
          >
            <button
              type="button"
              onClick={handleChangeEmail}
              disabled={submitting}
              style={{
                width: "auto",
                border: 0,
                padding: "6px 0",
                background: "transparent",
                color: "#96723d",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Đổi email
            </button>

            <button
              type="button"
              onClick={handleResendOtp}
              disabled={submitting}
              style={{
                width: "auto",
                border: 0,
                padding: "6px 0",
                background: "transparent",
                color: "#96723d",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Gửi lại OTP
            </button>
          </div>
        )}

        <div
          style={{
            textAlign: "center",
            marginTop: 32,
            fontSize: 14,
          }}
        >
          <Link
            to="/login"
            style={{
              color: "#96723d",
              textDecoration: "none",
            }}
          >
            ← Quay lại trang đăng nhập
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}