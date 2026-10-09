import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/Navbar.css';

export default function Navbar() {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <header className="vestora-navbar">
      {/* Brand Logo */}
      <Link to="/" className="navbar-brand-logo">
        VESTORA
      </Link>

      {/* Main Navigation Links */}
      <nav className="navbar-menu-links">
        <Link to="/" className={`navbar-link ${isActive('/')}`}>
          TRANG CHỦ
        </Link>
        <Link to="/catalog" className={`navbar-link ${isActive('/catalog')}`}>
          DANH MỤC THUÊ
        </Link>
        <Link to="/try-on-photo" className={`navbar-link ${isActive('/try-on-photo')}`}>
          THỬ ĐỒ 3D
        </Link>
        <Link to="/try-on-webcam" className={`navbar-link ${isActive('/try-on-webcam')}`}>
          WEBCAM 30FPS
        </Link>
        <Link to="/map" className={`navbar-link ${isActive('/map')}`}>
          RADAR SHOWROOM
        </Link>
        <Link to="/shop/dashboard" className="navbar-link" style={{ color: 'var(--color-gold-deep)', fontWeight: '600' }}>
          KÊNH CHỦ SHOP
        </Link>
        <Link to="/admin/dashboard" className="navbar-link" style={{ color: '#4b5563', fontWeight: '600' }}>
          ADMIN HỆ THỐNG
        </Link>
      </nav>

      {/* Right Actions */}
      <div className="navbar-actions">
        {/* Wishlist Favorites */}
        <Link to="/favorites" className="navbar-icon-btn" title="Danh sách yêu thích">
          ♡
          <span className="icon-badge-count">2</span>
        </Link>

        {/* Shopping Cart */}
        <Link to="/cart" className="navbar-icon-btn" title="Giỏ hàng">
          🛒
          <span className="icon-badge-count">1</span>
        </Link>

        {/* User Profile */}
        <Link to="/profile" className="user-profile-pill" title="Hồ sơ cá nhân">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
            alt="User Avatar"
            className="user-avatar-circle"
          />
          <span className="user-display-name">Minh Anh</span>
        </Link>
      </div>
    </header>
  );
}
