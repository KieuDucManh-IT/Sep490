import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Footer.css';

export default function Footer() {
  return (
    <footer className="vestora-footer">
      <div className="footer-main-grid">
        {/* Brand Column */}
        <div className="footer-brand-col">
          <div className="footer-logo">VESTORA</div>
          <div className="footer-tagline">
            VESTORA Haute Couture & Archive — Nền tảng lưu trữ, giám định độc lập và cho thuê trang phục dạ hội thảm đỏ cao cấp hàng đầu tại Việt Nam.
          </div>
          <div className="footer-escrow-badge">
             BẢO CHỨNG KÝ QUỸ ESCROW QUỐC TẾ QUA PAYOS
          </div>
        </div>

        {/* Column 1: Về VESTORA */}
        <div>
          <h4 className="footer-col-title">VỀ VESTORA</h4>
          <ul className="footer-links-list">
            <li><a href="#about">Di Sản & Triết Lý Nghệ Thuật</a></li>
            <li><a href="#quy-chuan">Quy Chuẩn Giám Định IFAB Paris</a></li>
            <li><a href="#network">Mạng Lưới Nhà Mốt Lưu Trữ</a></li>
            <li><a href="#sustainability">Thời Trang Bền Vững Xanh Xì</a></li>
          </ul>
        </div>

        {/* Column 2: Dịch Vụ Thượng Lưu */}
        <div>
          <h4 className="footer-col-title">DỊCH VỤ THƯỢNG LƯU</h4>
          <ul className="footer-links-list">
            <li><Link to="/catalog">Thuê Trang Phục Thảm Đỏ</Link></li>
            <li><Link to="/try-on-photo">Phòng Thử Đồ Ảo AI 3D</Link></li>
            <li><a href="#outfit">Phối Đồ & Phối Outfit</a></li>
            <li><a href="#consign">Thẩm Định & Ký Gửi Trang Phục</a></li>
          </ul>
        </div>

        {/* Column 3: Bảo Chứng & Pháp Lý */}
        <div>
          <h4 className="footer-col-title">BẢO CHỨNG & PHÁP LÝ</h4>
          <ul className="footer-links-list">
            <li><a href="#escrow">Cơ Chế Phong Tỏa Escrow</a></li>
            <li><a href="#auth">Chứng Thư Xác Thực Số Hóa</a></li>
            <li><a href="#insurance">Bảo Hiểm Tài Sản PayOS</a></li>
            <li><a href="#compensation">Cam Kết Bồi Thường 200%</a></li>
          </ul>
        </div>

        {/* Column 4: Salon Privé */}
        <div className="salon-prive-box">
          <div className="salon-prive-title">Salon Privé</div>
          <div className="salon-prive-location">
            <strong>Sài Gòn:</strong> Đồng Khởi, Quận 1
          </div>
          <div className="salon-prive-location">
            <strong>Hà Nội:</strong> Tràng Tiền, Hoàn Kiếm
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-gold)', marginTop: '8px', fontWeight: 600 }}>
            Hotline VIP: 1800 8899
          </div>
          <div className="newsletter-input-group">
            <input type="email" placeholder="Bản tin Privé..." />
            <button aria-label="Đăng ký">➔</button>
          </div>
        </div>
      </div>

      {/* Bottom Legal Bar */}
      <div className="footer-bottom-bar">
        <div>
          © 2026 VESTORA Haute Couture & Archive. Nền tảng Cho Thuê & Sang Nhượng Thời Trang Cao Cấp.
        </div>
        <div className="footer-bottom-links">
          <a href="#terms">Điều Khoản Khách Hàng</a>
          <a href="#privacy">Chính Sách Bảo Mật</a>
          <a href="#escrow-policy">Quy Chế Ký Quỹ Escrow</a>
        </div>
      </div>
    </footer>
  );
}
