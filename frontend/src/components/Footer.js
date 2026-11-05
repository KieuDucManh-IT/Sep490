import React from 'react';
import { Link } from 'react-router-dom';
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
                <i className="fa-brands fa-facebook-f"></i>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram" className="social-icon-btn">
                <i className="fa-brands fa-instagram"></i>
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noreferrer" aria-label="TikTok" className="social-icon-btn">
                <i className="fa-brands fa-tiktok"></i>
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube" className="social-icon-btn">
                <i className="fa-brands fa-youtube"></i>
              </a>
            </div>
          </div>

          {/* Col 1: Khám phá */}
          <div className="footer-col">
            <h4 className="footer-col-title">Khám phá</h4>
            <ul className="footer-nav-list">
              <li><Link to="/catalog?type=rental">Thuê đồ</Link></li>
              <li><Link to="/catalog?type=sale">Mua đồ cũ</Link></li>
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
              <i className="fa-regular fa-envelope contact-fa-icon"></i>
              <span>support@vestora.vn</span>
            </div>
            <div className="footer-contact-item">
              <i className="fa-solid fa-phone contact-fa-icon"></i>
              <span>1900 1234</span>
            </div>
            <div className="footer-contact-item">
              <i className="fa-solid fa-location-dot contact-fa-icon"></i>
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
