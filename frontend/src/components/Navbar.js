import React, { useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import "../styles/Navbar.css";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    user,
    loading,
    authError,
    refreshUser,
    logout,
  } = useAuth();

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  const isActive = (path) =>
    location.pathname === path ? "active" : "";

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      setLogoutError(error.message);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="vestora-navbar">
      <Link to="/" className="navbar-brand-logo">
        VESTORA
      </Link>

      <nav className="navbar-menu-links">
        <Link
          to="/"
          className={`navbar-link ${isActive("/")}`}
        >
          TRANG CHỦ
        </Link>

        <Link
          to="/catalog"
          className={`navbar-link ${isActive("/catalog")}`}
        >
          DANH MỤC THUÊ
        </Link>

        <Link
          to="/try-on-photo"
          className={`navbar-link ${isActive("/try-on-photo")}`}
        >
          THỬ ĐỒ 3D
        </Link>

        <Link
          to="/try-on-webcam"
          className={`navbar-link ${isActive("/try-on-webcam")}`}
        >
          WEBCAM 30FPS
        </Link>

        <Link
          to="/map"
          className={`navbar-link ${isActive("/map")}`}
        >
          RADAR SHOWROOM
        </Link>

        {user?.role === "shop_owner" && (
          <Link
            to="/shop/dashboard"
            className="navbar-link"
          >
            KÊNH CHỦ SHOP
          </Link>
        )}

        {user?.role === "admin" && (
          <Link
            to="/admin/dashboard"
            className="navbar-link"
          >
            ADMIN HỆ THỐNG
          </Link>
        )}
      </nav>

      <div className="navbar-actions">
        <Link
          to="/favorites"
          className="navbar-icon-btn"
          title="Danh sách yêu thích"
        >
          ♡
        </Link>

        <Link
          to="/cart"
          className="navbar-icon-btn"
          title="Giỏ hàng"
        >
          🛒
        </Link>

        {loading ? (
          <span>Đang tải...</span>
        ) : user ? (
          <>
            <Link
              to="/profile"
              className="user-profile-pill"
              title="Hồ sơ cá nhân"
            >
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
                {user.fullName?.charAt(0).toUpperCase()}
              </span>

              <span className="user-display-name">
                {user.fullName}
              </span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              style={{
                border: "1px solid #e5dfd5",
                borderRadius: 8,
                background: "white",
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              {loggingOut ? "Đang thoát..." : "Đăng xuất"}
            </button>

            {logoutError && (
              <span
                role="alert"
                style={{ color: "#b54747" }}
              >
                {logoutError}
              </span>
            )}
          </>
        ) : authError ? (
          <button type="button" onClick={refreshUser}>
            Thử lại kết nối
          </button>
        ) : (
          <Link
            to="/login"
            className="user-profile-pill"
          >
            Đăng nhập
          </Link>
        )}
      </div>
    </header>
  );
}