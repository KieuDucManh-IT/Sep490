import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';
import '../styles/Footer.css';

export default function Footer() {
  return (
    <footer className="vestora-footer">
      <div className="footer-container">
        <div className="footer-top-grid">
          {/* Brand Info */}
          <div className="footer-brand-col">
            <h3 className="footer-logo">VESTORA</h3>
            <p className="footer-tagline">
              Thời trang, thời điểm — Phong cách bền vững
            </p>
            <div className="footer-social-links">
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook" className="social-icon-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="social-icon-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noreferrer" aria-label="TikTok" className="social-icon-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.71 1.13-.07 2.14-.65 2.73-1.61.34-.55.49-1.2.49-1.84.03-4.67.01-9.35.02-14.02z"/>
                </svg>
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube" className="social-icon-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Col 1: Khám phá */}
          <div className="footer-col">
            <h4 className="footer-col-title">Khám phá</h4>
            <ul className="footer-nav-list">
              <li><Link to="/catalog?type=rental">Cho thuê</Link></li>
              <li><Link to="/catalog?type=sale">Mua sản phẩm</Link></li>
              <li><Link to="/catalog">Sang nhượng thời trang</Link></li>
              <li><Link to="/catalog?category=suggest">Gợi ý phong cách</Link></li>
              <li><Link to="/map">Showroom gần bạn</Link></li>
            </ul>
          </div>

          {/* Col 2: Hỗ trợ khách hàng */}
          <div className="footer-col">
            <h4 className="footer-col-title">Hỗ trợ khách hàng</h4>
            <ul className="footer-nav-list">
              <li><a href="#help">Trung tâm trợ giúp</a></li>
              <li><a href="#return">Chính sách đổi trả</a></li>
              <li><a href="#refund">Chính sách hoàn cọc</a></li>
              <li><a href="#terms">Điều khoản sử dụng</a></li>
              <li><a href="#privacy">Bảo mật thông tin</a></li>
            </ul>
          </div>

          {/* Col 3: Dành cho shop */}
          <div className="footer-col">
            <h4 className="footer-col-title">Dành cho shop</h4>
            <ul className="footer-nav-list">
              <li><Link to="/register-shop">Đăng ký shop</Link></li>
              <li><Link to="/login">Đăng nhập shop</Link></li>
              <li><a href="#guide">Hướng dẫn đăng bán</a></li>
              <li><a href="#commission">Chính sách hoa hồng</a></li>
            </ul>
          </div>

          {/* Col 4: Liên hệ */}
          <div className="footer-col footer-contact-col">
            <h4 className="footer-col-title">Liên hệ</h4>
            <div className="footer-contact-item">
              <Mail size={15} color="#C5A880" className="contact-icon" />
              <span>support@vestora.vn</span>
            </div>
            <div className="footer-contact-item">
              <Phone size={15} color="#C5A880" className="contact-icon" />
              <span>1900 1234</span>
            </div>
            <div className="footer-contact-item">
              <MapPin size={15} color="#C5A880" className="contact-icon" />
              <span>Tầng 5, 123 Nguyễn Văn Cừ, Long Biên, Hà Nội</span>
            </div>
          </div>
        </div>

        {/* Bottom Legal Bar */}
        <div className="footer-bottom-row">
          <p className="copyright-text">
            © 2025 VESTORA. Tất cả quyền được bảo lưu.
          </p>
          <div className="footer-bottom-links">
            <a href="#privacy">Chính sách bảo mật</a>
            <span className="link-divider">|</span>
            <a href="#terms">Điều khoản dịch vụ</a>
            <span className="link-divider">|</span>
            <a href="#refund">Chính sách hoàn cọc</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
