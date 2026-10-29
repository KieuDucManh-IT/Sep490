import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import "../styles/Navbar.css";

export default function Navbar() {
  const location = useLocation();
  const { user, loading, authError, refreshUser } = useAuth();
  const [failedAvatar, setFailedAvatar] = useState("");

  const isActive = (path) => (location.pathname === path ? "active" : "");
  const avatarUrl = user?.avatar || "";
  const showAvatar = Boolean(avatarUrl) && failedAvatar !== avatarUrl;
  const avatarInitial = user?.fullName?.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="vestora-navbar">
      <Link to="/" className="navbar-brand-logo">VESTORA</Link>

      <nav className="navbar-menu-links">
        <Link to="/" className={`navbar-link ${isActive("/")}`}>TRANG CHỦ</Link>
        <Link to="/catalog" className={`navbar-link ${isActive("/catalog")}`}>DANH MỤC THUÊ</Link>
        <Link to="/try-on/photo" className={`navbar-link ${isActive("/try-on/photo") || isActive("/try-on-photo") ? "active" : ""}`}>
          THỬ ĐỒ ẢNH
        </Link>
        <Link to="/try-on/webcam" className={`navbar-link ${isActive("/try-on/webcam") || isActive("/try-on-webcam") ? "active" : ""}`}>
          THỬ ĐỒ CAMERA
        </Link>

        <Link to="/map" className={`navbar-link ${isActive("/map")}`}>
          RADAR CỬA HÀNG
        </Link>

        {/shop_owner|owner/i.test(user?.Role || user?.role || '') && (
          <>
            <Link
              to="/owner/branches"
              className={`navbar-link ${isActive('/owner/branches') || isActive('/owner/manage-shops') ? 'active' : ''}`}
              style={{ color: '#D97706', fontWeight: 600 }}
            >
              QUẢN LÝ CHI NHÁNH
            </Link>
            <Link
              to="/owner/dashboard"
              className={`navbar-link ${isActive('/owner/dashboard') ? 'active' : ''}`}
            >
              TỔNG QUAN CHUỖI
            </Link>
          </>
        )}

        {/branch_manager/i.test(user?.Role || user?.role || '') && (
          <>
            <Link
              to="/branch/dashboard"
              className={`navbar-link ${isActive('/branch/dashboard') ? 'active' : ''}`}
              style={{ color: '#059669', fontWeight: 600 }}
            >
              VẬN HÀNH CHI NHÁNH
            </Link>
            <Link
              to="/branch/settings"
              className={`navbar-link ${isActive('/branch/settings') ? 'active' : ''}`}
            >
              CỬA HÀNG & BẢN ĐỒ
            </Link>
          </>
        )}

        {(user?.role === "operation_staff" || user?.Role === "OPERATION_STAFF" || user?.Role === "operation_staff" || user?.role === "admin" || user?.Role === "ADMIN") && (
          <Link
            to="/ops/shops"
            className={`navbar-link ${isActive("/ops/shops") || isActive("/ops/manage-shops") ? "active" : ""}`}
            style={{ color: '#059669', fontWeight: 600 }}
          >
            VẬN HÀNH OPS
          </Link>
        )}
        {user?.role === "admin" && (
          <Link to="/admin/dashboard" className="navbar-link">ADMIN HỆ THỐNG</Link>
        )}
      </nav>

      <div className="navbar-actions">
        <Link to="/favorites" className="navbar-icon-btn" title="Danh sách yêu thích" aria-label="Danh sách yêu thích">♡</Link>
        <Link to="/cart" className="navbar-icon-btn" title="Giỏ hàng" aria-label="Giỏ hàng">🛒</Link>

        {loading ? (
          <span role="status">Đang tải...</span>
        ) : user ? (
          <Link to="/profile" className="user-profile-pill" title="Hồ sơ cá nhân">
              {showAvatar ? (
                <img
                  key={avatarUrl}
                  className="user-avatar-circle"
                  src={avatarUrl}
                  alt={`Ảnh đại diện của ${user.fullName || "người dùng"}`}
                  onError={() => setFailedAvatar(avatarUrl)}
                />
              ) : (
                <span className="user-avatar-circle" style={{ display: "grid", placeItems: "center", background: "#eee7dc", color: "#96723d", fontWeight: 700 }}>
                  {avatarInitial}
                </span>
              )}
            <span className="user-display-name">{user.fullName || "Thành viên"}</span>
          </Link>
        ) : authError ? (
          <button type="button" onClick={refreshUser} className="btn-retry-auth">Thử lại kết nối</button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link to="/login" className="user-profile-pill">Đăng nhập</Link>
            <Link to="/register" className="navbar-logout-btn" style={{ textDecoration: "none" }}>Đăng ký</Link>
          </div>
        )}
      </div>
    </header>
  );
}
