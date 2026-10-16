import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Navbar.css";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, authError, refreshUser, logout } = useAuth();

  const isActive = (path) => (location.pathname === path ? "active" : "");

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Lỗi đăng xuất:", error);
    }
  };

  return (
    <header className="vestora-navbar">
      <Link to="/" className="navbar-brand-logo">
        VESTORA
      </Link>

      <nav className="navbar-menu-links">
        <Link to="/" className={`navbar-link ${isActive("/")}`}>
          TRANG CHỦ
        </Link>

        <Link to="/catalog" className={`navbar-link ${isActive("/catalog")}`}>
          DANH MỤC THUÊ
        </Link>

        <Link
          to="/try-on/photo"
          className={`navbar-link ${isActive("/try-on/photo") || isActive("/try-on-photo") ? "active" : ""}`}
        >
          THỬ ĐỒ ẢNH
        </Link>

        <Link
          to="/try-on/webcam"
          className={`navbar-link ${isActive("/try-on/webcam") || isActive("/try-on-webcam") ? "active" : ""}`}
        >
          THỬ ĐỒ CAMERA
        </Link>

        <Link to="/map" className={`navbar-link ${isActive("/map")}`}>
          RADAR SHOWROOM
        </Link>

        <Link
          to="/register-shop"
          className={`navbar-link ${isActive("/register-shop") || isActive("/customer/register-shop") ? "active" : ""}`}
        >
          ĐĂNG KÝ SHOP
        </Link>

        {(user?.role === "shop_owner" || user?.Role === "SHOP_OWNER" || user?.Role === "shop_owner") && (
          <Link to="/shop/dashboard" className={`navbar-link ${isActive("/shop/dashboard")}`}>
            KÊNH CHỦ SHOP
          </Link>
        )}

        {(user?.role === "admin" || user?.Role === "ADMIN" || user?.Role === "admin") && (
          <Link to="/admin/shops" className={`navbar-link ${isActive("/admin/shops")}`}>
            QUẢN TRỊ ADMIN
          </Link>
        )}
      </nav>

      <div className="navbar-actions">
        <Link to="/favorites" className="navbar-icon-btn" title="Danh sách yêu thích">
          ♡
        </Link>

        <Link to="/cart" className="navbar-icon-btn" title="Giỏ hàng">
          🛒
        </Link>

        {loading ? (
          <span style={{ fontSize: "13px", color: "#888" }}>Đang tải...</span>
        ) : user ? (
          <div className="navbar-user-group">
            <Link to="/profile" className="user-profile-pill" title="Hồ sơ cá nhân">
              <span
                className="user-avatar-circle"
                style={{
                  display: "grid",
                  placeItems: "center",
                  background: "#eee7dc",
                  color: "#96723d",
                  fontWeight: 700,
                }}
              >
                {(user.fullName || user.FullName || "U").charAt(0).toUpperCase()}
              </span>
              <span className="user-display-name">
                {user.fullName || user.FullName || "Thành viên"}
              </span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="navbar-logout-btn"
              title="Đăng xuất khỏi hệ thống"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Đăng xuất
            </button>
          </div>
        ) : authError ? (
          <button type="button" onClick={refreshUser} className="btn-retry-auth">
            Thử lại kết nối
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link to="/login" className="user-profile-pill">
              Đăng nhập
            </Link>
            <Link
              to="/register"
              className="navbar-logout-btn"
              style={{ textDecoration: "none" }}
            >
              Đăng ký
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}