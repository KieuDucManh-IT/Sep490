import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../../components/AuthLayout";
import RegisterOtpModal from "../../components/RegisterOtpModal";
import {
  requestRegisterOtp,
  verifyRegisterOtp,
} from "../../services/authApi";

const fields = [
  {
    name: "fullName",
    label: "HỌ VÀ TÊN",
    type: "text",
    placeholder: "Nguyễn Văn A",
    autoComplete: "name",
  },
  {
    name: "email",
    label: "ĐỊA CHỈ EMAIL",
    type: "email",
    placeholder: "example@domain.com",
    autoComplete: "email",
  },
  {
    name: "phone",
    label: "SỐ ĐIỆN THOẠI",
    type: "tel",
    placeholder: "0912 345 678",
    autoComplete: "tel",
  },
];

export default function RegisterPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [otpError, setOtpError] = useState("");
  const [otpNotice, setOtpNotice] = useState("");
  const [registered, setRegistered] = useState(false);

  const pendingForm = useRef(null);
  const requestInFlight = useRef(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: "",
      server: "",
      ...(name === "password" ? { confirmPassword: "" } : {}),
    }));
  };

  const sendOtp = async (payload) => {
    const result = await requestRegisterOtp(payload);

    setChallenge({
      email: result.email,
      challengeId: result.challengeId,
    });

    setOtpError("");
    setOtpNotice(
      "Mã OTP có hiệu lực trong 5 phút. Vui lòng kiểm tra cả thư rác."
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (requestInFlight.current || challenge) return;

    const newErrors = {};

    const fullName = formData.fullName
      .normalize("NFC")
      .trim()
      .replace(/ +/g, " ");
    const email = formData.email.trim().toLowerCase();
    const phone = formData.phone.replace(/\s/g, "");

    const fullNameRegex =
      /^[A-Za-zÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯàáâãèéêìíòóôõùúýăđĩũơưẠ-ỹ ]+$/u;

    if (!fullName) {
      newErrors.fullName = "Vui lòng nhập họ và tên";
    } else if ([...fullName].length > 12) {
      newErrors.fullName = "Họ tên tối đa 12 ký tự, tính cả khoảng trắng";
    } else if (!fullNameRegex.test(fullName)) {
      newErrors.fullName =
        "Họ tên chỉ được chứa chữ cái tiếng Việt và khoảng trắng";
    }

    if (!email) {
      newErrors.email = "Vui lòng nhập email";
    } else if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      newErrors.email = "Email không đúng định dạng";
    }

    if (!phone) {
      newErrors.phone = "Vui lòng nhập số điện thoại";
    } else if (!/^\+?[0-9]{9,15}$/.test(phone)) {
      newErrors.phone = "Số điện thoại không hợp lệ";
    }

    const password = formData.password;

    if (!password) {
      newErrors.password = "Vui lòng nhập mật khẩu";
    } else if (
      [...password].length < 9 ||
      [...password].length > 16
    ) {
      newErrors.password = "Mật khẩu phải có từ 9 đến 16 ký tự";
    } else if (/\s/u.test(password)) {
      newErrors.password = "Mật khẩu không được chứa khoảng trắng";
    } else if (
      !/\p{Lu}/u.test(password) ||
      !/\p{Ll}/u.test(password) ||
      !/[0-9]/.test(password) ||
      !/[!-/:-@[-`{-~]/.test(password)
    ) {
      newErrors.password =
        "Mật khẩu phải có chữ hoa, chữ thường, số và dấu câu, ví dụ ! @ # ?";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Vui lòng xác nhận mật khẩu";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Mật khẩu xác nhận không khớp";
    }

    if (!formData.agreeTerms) {
      newErrors.agreeTerms = "Bạn cần đồng ý với điều khoản dịch vụ";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    const payload = {
      fullName,
      email,
      phone,
      password: formData.password,
      confirmPassword: formData.confirmPassword,
      agreeTerms: formData.agreeTerms,
    };

    requestInFlight.current = true;
    setBusy(true);
    setRegistered(false);
    setOtpError("");
    setOtpNotice("");

    try {
      // Chỉ mở hộp OTP sau khi backend gửi email thành công.
      await sendOtp(payload);

      // Giữ trong RAM để có thể gửi lại OTP.
      pendingForm.current = payload;
    } catch (error) {
      pendingForm.current = null;

      setErrors((prev) => ({
        ...prev,
        server: error.message || "Không gửi được OTP. Vui lòng thử lại.",
      }));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (otp) => {
    if (requestInFlight.current || !challenge || registered) return;

    const normalizedOtp = String(otp).trim();

    if (!/^\d{6}$/.test(normalizedOtp)) {
      setOtpError("Vui lòng nhập mã OTP gồm 6 chữ số");
      return;
    }

    requestInFlight.current = true;
    setBusy(true);
    setOtpError("");
    setOtpNotice("");

    try {
      await verifyRegisterOtp({
        email: challenge.email,
        challengeId: challenge.challengeId,
        otp: normalizedOtp,
      });

      // Chỉ thành công khi backend xác nhận đã lưu tài khoản.
      setRegistered(true);
      pendingForm.current = null;

      setFormData((prev) => ({
        ...prev,
        password: "",
        confirmPassword: "",
      }));
    } catch (error) {
      // Giữ hộp OTP để người dùng nhập lại hoặc gửi lại mã.
      setOtpError(error.message || "Xác minh thất bại. Vui lòng thử lại.");
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  const handleResendOtp = async () => {
    if (
      requestInFlight.current ||
      !pendingForm.current ||
      registered
    ) {
      return;
    }

    requestInFlight.current = true;
    setBusy(true);
    setOtpError("");
    setOtpNotice("");

    try {
      await sendOtp(pendingForm.current);

      setOtpNotice(
        "Đã gửi mã mới. Hãy sử dụng OTP trong email mới nhất."
      );
    } catch (error) {
      setOtpError(
        error.message || "Không gửi lại được OTP. Vui lòng thử lại."
      );
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  };

  const closeOtp = () => {
    if (requestInFlight.current) return;

    setChallenge(null);
    setOtpError("");
    setOtpNotice("");
    pendingForm.current = null;

    if (registered) {
      navigate("/login");
    }
  };

  const renderPasswordField = (name, label, visible, setVisible) => (
    <div className="register-field">
      <label htmlFor={name} className="register-label">
        {label}
      </label>

      <div
        className={`register-input-box ${errors[name] ? "has-error" : ""
          }`}
      >
        <input
          id={name}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          minLength={9}
          maxLength={16}
          placeholder={
            name === "password"
              ? "Từ 9–16 ký tự"
              : "Nhập lại mật khẩu"
          }
          value={formData[name]}
          onChange={handleChange}
          disabled={busy}
          className="register-input"
          aria-invalid={Boolean(errors[name])}
          aria-describedby={errors[name] ? `${name}-error` : undefined}
        />

        <button
          type="button"
          className="register-toggle"
          onClick={() => setVisible((prev) => !prev)}
          disabled={busy}
          aria-label={`${visible ? "Ẩn" : "Hiện"} ${name === "password" ? "mật khẩu" : "mật khẩu xác nhận"
            }`}
          aria-pressed={visible}
        >
          <svg
            width="18"
            height="18"
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
            {visible && <path d="m3 3 18 18" />}
          </svg>
        </button>
      </div>

      {errors[name] && (
        <span
          id={`${name}-error`}
          className="register-error"
          role="alert"
        >
          {errors[name]}
        </span>
      )}
    </div>
  );

  return (
    <AuthLayout
      badgeText="TRẢI NGHIỆM ĐẮC QUYỀN"
      titleQuote="Sự sang trọng hoàn hảo không chỉ nằm ở kiểu dáng, mà ở sự vừa vặn dành riêng cho bạn."
      quoteAuthor="Haute Couture Tailoring"
    >
      <style>{`
        .vestora-register {
          --register-gold: #96723d;
          --register-text: #28251f;
          --register-muted: #827c72;
          width: 100%;
          max-width: 460px;
          margin: 0 auto;
          padding: 24px 8px;
          color: var(--register-text);
          box-sizing: border-box;
        }

        .vestora-register * {
          box-sizing: border-box;
        }

        .vestora-register .register-eyebrow {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
          color: var(--register-gold);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 3px;
        }

        .vestora-register .register-eyebrow::before {
          content: "";
          width: 30px;
          height: 1px;
          background: var(--register-gold);
        }

        .vestora-register .register-title {
          margin: 0 0 12px;
          color: var(--register-text);
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(32px, 5vw, 42px);
          font-weight: 400;
          line-height: 1.2;
          letter-spacing: -1.3px;
        }

        .vestora-register .register-subtitle {
          margin: 0;
          color: var(--register-muted);
          font-size: 14px;
          line-height: 1.8;
        }

        .vestora-register .register-form {
          display: flex;
          flex-direction: column;
          gap: 19px;
          margin-top: 28px;
        }

        .vestora-register .register-field {
          min-width: 0;
        }

        .vestora-register .register-label {
          display: block;
          margin: 0 0 9px;
          color: #514b41;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.1px;
        }

        .vestora-register .register-input-box {
          display: flex;
          align-items: center;
          gap: 6px;
          min-height: 50px;
          padding: 0 14px;
          border: 1px solid #e5dfd5;
          border-radius: 10px;
          background: #fcfbf8;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .vestora-register .register-input-box:focus-within {
          border-color: var(--register-gold);
          box-shadow: 0 0 0 3px rgba(150, 114, 61, 0.1);
        }

        .vestora-register .register-input-box.has-error {
          border-color: #c45555;
        }

        .vestora-register .register-input {
          width: 100%;
          min-width: 0;
          height: 48px;
          margin: 0;
          padding: 0;
          border: none;
          border-radius: 0;
          outline: none;
          background: transparent;
          box-shadow: none;
          color: var(--register-text);
          font: inherit;
          font-size: 14px;
        }

        .vestora-register .register-input::placeholder {
          color: #aaa397;
        }

        .vestora-register .register-input:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .vestora-register .register-password-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .vestora-register .register-toggle {
          display: grid;
          place-items: center;
          flex-shrink: 0;
          width: 30px;
          height: 34px;
          padding: 0;
          border: none;
          border-radius: 5px;
          background: transparent;
          color: #8c8272;
          cursor: pointer;
        }

        .vestora-register .register-toggle:hover {
          color: var(--register-gold);
          background: #f0ece4;
        }

        .vestora-register .register-terms {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 2px;
        }

        .vestora-register .register-terms input {
          appearance: auto;
          position: static;
          flex-shrink: 0;
          width: 16px;
          height: 16px;
          margin: 4px 0 0;
          opacity: 1;
          accent-color: var(--register-gold);
          cursor: pointer;
        }

        .vestora-register .register-terms-text {
          margin: 0;
          color: var(--register-muted);
          font-size: 12px;
          line-height: 1.9;
        }

        .vestora-register .register-terms-text label {
          display: inline;
          margin: 0;
          color: inherit;
          font: inherit;
          letter-spacing: normal;
          cursor: pointer;
        }

        .vestora-register .register-link {
          color: var(--register-gold);
          font-weight: 600;
          text-decoration: none;
          text-underline-offset: 4px;
        }

        .vestora-register .register-link:hover {
          text-decoration: underline;
        }

        .vestora-register .register-submit {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          width: 100%;
          min-height: 54px;
          margin-top: 2px;
          padding: 14px 20px;
          border: none;
          border-radius: 10px;
          background: var(--register-gold);
          color: #fff;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1.5px;
          box-shadow: 0 6px 16px rgba(150, 114, 61, 0.16);
          cursor: pointer;
          transition: background 0.2s, box-shadow 0.2s;
        }

        .vestora-register .register-submit:hover:not(:disabled) {
          background: #805f31;
          box-shadow: 0 8px 20px rgba(150, 114, 61, 0.23);
        }

        .vestora-register button:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .vestora-register button:focus-visible,
        .vestora-register a:focus-visible,
        .vestora-register input[type="checkbox"]:focus-visible {
          outline: 2px solid var(--register-gold);
          outline-offset: 4px;
        }

        .vestora-register .register-error {
          display: block;
          margin-top: 7px;
          color: #b54747;
          font-size: 12px;
          line-height: 1.5;
        }

        .vestora-register .register-server-error {
          margin: 0;
          padding: 12px 14px;
          border: 1px solid #f0cccc;
          border-radius: 10px;
          background: #fff5f5;
          color: #b54747;
          font-size: 13px;
          line-height: 1.6;
        }

        .vestora-register .register-footer {
          margin-top: 24px;
          padding-top: 21px;
          border-top: 1px solid #ece7de;
          color: var(--register-muted);
          font-size: 13px;
          line-height: 1.8;
          text-align: center;
        }

        @media (max-width: 480px) {
          .vestora-register {
            padding: 20px 4px;
          }

          .vestora-register .register-password-row {
            grid-template-columns: 1fr;
            gap: 19px;
          }
        }
      `}</style>

      <div className="vestora-register">
        <header>
          <div className="register-eyebrow">JOIN VESTORA</div>

          <h1 className="register-title">Đăng ký tài khoản</h1>

          <p className="register-subtitle">
            Tạo tài khoản để khám phá những thiết kế yêu thích
            và trải nghiệm thời trang cùng Vestora.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="register-form"
          noValidate
          aria-busy={busy}
        >
          {fields.map((field) => (
            <div className="register-field" key={field.name}>
              <label
                htmlFor={field.name}
                className="register-label"
              >
                {field.label}
              </label>

              <div
                className={`register-input-box ${errors[field.name] ? "has-error" : ""
                  }`}
              >
                <input
                  id={field.name}
                  name={field.name}
                  maxLength={field.name === "fullName" ? 12 : undefined}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  placeholder={field.placeholder}
                  value={formData[field.name]}
                  onChange={handleChange}
                  disabled={busy}
                  className="register-input"
                  aria-invalid={Boolean(errors[field.name])}
                  aria-describedby={
                    errors[field.name]
                      ? `${field.name}-error`
                      : undefined
                  }
                />
              </div>

              {errors[field.name] && (
                <span
                  id={`${field.name}-error`}
                  className="register-error"
                  role="alert"
                >
                  {errors[field.name]}
                </span>
              )}
            </div>
          ))}

          <div className="register-password-row">
            {renderPasswordField(
              "password",
              "MẬT KHẨU",
              showPassword,
              setShowPassword
            )}

            {renderPasswordField(
              "confirmPassword",
              "XÁC NHẬN MẬT KHẨU",
              showConfirmPassword,
              setShowConfirmPassword
            )}
          </div>

          <div>
            <div className="register-terms">
              <input
                id="agreeTerms"
                type="checkbox"
                name="agreeTerms"
                checked={formData.agreeTerms}
                onChange={handleChange}
                disabled={busy}
                aria-invalid={Boolean(errors.agreeTerms)}
                aria-describedby={
                  errors.agreeTerms ? "terms-error" : undefined
                }
              />

              <div className="register-terms-text">
                <label htmlFor="agreeTerms">Tôi đồng ý với </label>

                <a
                  href="#terms"
                  onClick={(e) => e.preventDefault()}
                  className="register-link"
                >
                  Điều khoản dịch vụ
                </a>

                {" và "}

                <a
                  href="#privacy"
                  onClick={(e) => e.preventDefault()}
                  className="register-link"
                >
                  Chính sách bảo mật
                </a>

                {" của Vestora."}
              </div>
            </div>

            {errors.agreeTerms && (
              <span
                id="terms-error"
                className="register-error"
                role="alert"
              >
                {errors.agreeTerms}
              </span>
            )}
          </div>

          {errors.server && (
            <p className="register-server-error" role="alert">
              {errors.server}
            </p>
          )}

          <button
            type="submit"
            className="register-submit"
            disabled={busy || Boolean(challenge)}
          >
            {busy ? "ĐANG GỬI OTP..." : "ĐĂNG KÝ NGAY"}

            {!busy && (
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
            )}
          </button>
        </form>

        <div className="register-footer">
          Đã có tài khoản?{" "}
          <Link to="/login" className="register-link">
            Đăng nhập ngay
          </Link>
        </div>
      </div>

      {challenge && (
        <RegisterOtpModal
          email={challenge.email}
          challengeId={challenge.challengeId}
          busy={busy}
          error={otpError}
          notice={otpNotice}
          registered={registered}
          onVerify={handleVerifyOtp}
          onResend={handleResendOtp}
          onClose={closeOtp}
        />
      )}
    </AuthLayout>
  );
}