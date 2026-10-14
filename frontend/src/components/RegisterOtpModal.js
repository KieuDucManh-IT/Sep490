import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/RegisterOtpModal.css";

export default function RegisterOtpModal({
  email,
  challengeId,
  busy,
  error,
  notice,
  registered,
  onVerify,
  onResend,
  onClose,
}) {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [otp, setOtp] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    dialog.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;

      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  // Gửi lại mã thành công thì xóa mã cũ trong ô nhập.
  useEffect(() => {
    setOtp("");
  }, [challengeId]);

  useEffect(() => {
    if (!busy && !registered) {
      inputRef.current?.focus();

      if (error) {
        inputRef.current?.select();
      }
    }
  }, [busy, registered, error]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (busy || !/^\d{6}$/.test(otp)) return;

    onVerify(otp);
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className="register-otp-modal"
      aria-labelledby="otp-title"
      aria-describedby="otp-description"
      onCancel={(e) => {
        e.preventDefault();

        if (!busy) onClose();
      }}
    >
      <header className="otp-header">
        <span>VESTORA</span>

        <button
          type="button"
          className="otp-close"
          onClick={onClose}
          disabled={busy}
          aria-label="Đóng"
        >
          ×
        </button>
      </header>

      <div className="otp-content">
        <div className="otp-symbol" aria-hidden="true">
          {registered ? "✓" : "✉"}
        </div>

        <h2 id="otp-title">
          {registered ? "Đăng ký thành công!" : "Xác minh email"}
        </h2>

        {registered ? (
          <>
            <p id="otp-description">
              Tài khoản của bạn đã được tạo thành công.
            </p>

            <button
              type="button"
              className="otp-primary"
              onClick={onClose}
              autoFocus
            >
              ĐẾN TRANG ĐĂNG NHẬP
            </button>
          </>
        ) : (
          <>
            <p id="otp-description">
              Nhập mã OTP gồm 6 chữ số đã gửi đến
              <br />
              <strong>{email}</strong>
            </p>

            <form onSubmit={handleSubmit}>
              <label htmlFor="register-otp">MÃ XÁC MINH</label>

              <input
                ref={inputRef}
                id="register-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                placeholder="000000"
                value={otp}
                readOnly={busy}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6));
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "otp-error" : "otp-notice"}
              />

              {error && (
                <p id="otp-error" className="otp-error" role="alert">
                  {error}
                </p>
              )}

              <p id="otp-notice" className="otp-notice" role="status">
                {busy ? "Đang xử lý, vui lòng chờ..." : notice}
              </p>

              <button
                type="submit"
                className="otp-primary"
                disabled={busy || otp.length !== 6}
              >
                {busy ? "ĐANG XỬ LÝ..." : "XÁC MINH & TẠO TÀI KHOẢN"}
              </button>
            </form>

            <div className="otp-resend">
              Chưa nhận được mã?{" "}
              <button type="button" onClick={onResend} disabled={busy}>
                Gửi lại OTP
              </button>
            </div>

            <button
              type="button"
              className="otp-back"
              onClick={onClose}
              disabled={busy}
            >
              Quay lại sửa thông tin
            </button>
          </>
        )}
      </div>
    </dialog>,
    document.body
  );
}