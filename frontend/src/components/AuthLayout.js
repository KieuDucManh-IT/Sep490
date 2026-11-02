import React from "react";
import "../styles/AuthLayout.css";

const BRAND_IMAGE =
  `${process.env.PUBLIC_URL || ""}/images/auth/auth-1.jpg`;

const AuthLayout = ({
  children,
  badgeText = "ATELIER PRIVÉ PROTECTION",
  quoteText = '"Nơi nghệ thuật thượng lưu giao thoa cùng công nghệ — định nghĩa lại trải nghiệm thời trang đích thực."',
  logoSubtitle = "HAUTE COUTURE & ARCHIVE",
  footerText,
  footerSubText,
  showTopSpacer = false,
  topSpacerContent,
}) => {
  return (
    <div className="auth-layout">
      <section className="auth-brand" aria-label="Vestora Brand">
        <img
          className="auth-brand__image"
          src={BRAND_IMAGE}
          alt="Thời trang Vestora"
          loading="eager"
        />

        <div
          className="auth-brand__overlay"
          aria-hidden="true"
        />

        <a
          href="/"
          className="auth-brand__logo"
          aria-label="Trang chủ Vestora"
        >
          <span className="auth-brand__logo-name">
            VESTORA
          </span>

          <span className="auth-brand__logo-tagline">
            {logoSubtitle}
          </span>
        </a>

        <div className="auth-brand__bottom">
          <div className="auth-brand__badge">
            <span
              className="auth-brand__badge-dot"
              aria-hidden="true"
            />

            <span className="auth-brand__badge-text">
              {badgeText}
            </span>
          </div>

          <blockquote className="auth-brand__quote">
            {quoteText}
          </blockquote>
        </div>
      </section>

      <section
        className="auth-form-panel"
        aria-label="Authentication Form"
      >
        {showTopSpacer && (
          <div className="auth-form-panel__top-spacer">
            {topSpacerContent || (
              <span className="auth-form-panel__version">
                Vestora build <span>v2.4.0</span>
              </span>
            )}
          </div>
        )}

        <div className="auth-form-wrapper">
          {children}
        </div>

        {footerText && (
          <footer
            className={`auth-footer ${
              footerSubText ? "auth-footer--bordered" : ""
            }`}
          >
            <p className="auth-footer__text">
              {footerText}
            </p>

            {footerSubText && (
              <p className="auth-footer__sub">
                {footerSubText}
              </p>
            )}
          </footer>
        )}
      </section>
    </div>
  );
};

export default AuthLayout;