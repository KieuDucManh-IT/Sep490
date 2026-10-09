import React from 'react';
import '../styles/AuthLayout.css';

/**
 * AuthLayout — Shared layout wrapper for all authentication pages.
 * Left panel: Brand imagery with gradient overlay, logo, and quote.
 * Right panel: Form content (children).
 */
const AuthLayout = ({
  children,
  brandImageSrc,
  badgeText = 'ATELIER PRIVÉ PROTECTION',
  quoteText = '"Nơi nghệ thuật thượng lưu giao thoa cùng công nghệ — định nghĩa lại trải nghiệm thời trang đích thực."',
  logoSubtitle = 'HAUTE COUTURE & ARCHIVE',
  footerText,
  footerSubText,
  showTopSpacer = false,
  topSpacerContent,
}) => {
  return (
    <div className="auth-layout">
      {/* === Left Brand Panel === */}
      <section className="auth-brand" aria-label="Vestora Brand">
        {/* Background Image */}
        {brandImageSrc && (
          <img
            className="auth-brand__image"
            src={brandImageSrc}
            alt="Vestora haute couture editorial"
            loading="eager"
          />
        )}

        {/* Gradient Overlay */}
        <div className="auth-brand__overlay" aria-hidden="true" />

        {/* Logo */}
        <a href="/" className="auth-brand__logo" aria-label="Trang chủ Vestora">
          <span className="auth-brand__logo-name">VESTORA</span>
          <span className="auth-brand__logo-tagline">{logoSubtitle}</span>
        </a>

        {/* Bottom Quote Area */}
        <div className="auth-brand__bottom">
          {/* Badge Pill */}
          <div className="auth-brand__badge">
            <span className="auth-brand__badge-dot" aria-hidden="true" />
            <span className="auth-brand__badge-text">{badgeText}</span>
          </div>

          {/* Blockquote */}
          <blockquote className="auth-brand__quote">{quoteText}</blockquote>
        </div>
      </section>

      {/* === Right Form Panel === */}
      <section className="auth-form-panel" aria-label="Authentication Form">
        {/* Top Spacer */}
        {showTopSpacer && (
          <div className="auth-form-panel__top-spacer">
            {topSpacerContent || (
              <span className="auth-form-panel__version">
                Vestora build <span>v2.4.0</span>
              </span>
            )}
          </div>
        )}

        {/* Main Form Wrapper */}
        <div className="auth-form-wrapper">{children}</div>

        {/* Footer */}
        {footerText && (
          <footer className={`auth-footer ${footerSubText ? 'auth-footer--bordered' : ''}`}>
            <p className="auth-footer__text">{footerText}</p>
            {footerSubText && <p className="auth-footer__sub">{footerSubText}</p>}
          </footer>
        )}
      </section>
    </div>
  );
};

export default AuthLayout;
