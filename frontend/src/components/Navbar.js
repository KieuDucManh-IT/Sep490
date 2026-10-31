import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Navbar.css";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, authError, logout, refreshUser } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isActive = (path) => (location.pathname === path ? "active" : "");
  const avatarUrl = user?.avatar || "";
  const displayName = user?.fullName || "";
  const avatarInitial = displayName ? displayName.trim().charAt(0).toUpperCase() : "N";

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setDropdownOpen(false);
      navigate("/");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <header className="vestora-navbar">
      <div className="navbar-container">
        {/* Brand Logo */}
        <Link to="/" className="navbar-brand-logo">
          VESTORA
        </Link>

        {/* Menu Links with Dropdowns */}
        <nav className="navbar-menu-links">
          <Link to="/" className={`navbar-link ${isActive("/")}`}>
            Trang Chủ
          </Link>
          {/* Về VESTORA */}
          <div className="nav-dropdown-item">
            <Link to="/about" className={`navbar-link ${isActive("/about")}`}>
              Về VESTORA <i className="fa-solid fa-chevron-down nav-arrow"></i>
            </Link>
            <div className="nav-dropdown-menu">
              <Link to="/about" className="nav-sublink">Giới thiệu VESTORA</Link>
              <Link to="/about" className="nav-sublink">Tầm nhìn & Sứ mệnh</Link>
              <Link to="/about" className="nav-sublink">Cam kết dịch vụ</Link>
            </div>
          </div>

          {/* Sản Phẩm */}
          <div className="nav-dropdown-item">
            <Link to="/catalog" className={`navbar-link ${isActive("/catalog")}`}>
              Sản Phẩm <i className="fa-solid fa-chevron-down nav-arrow"></i>
            </Link>
            <div className="nav-dropdown-menu">
              <Link to="/catalog" className="nav-sublink">Tất cả sản phẩm</Link>
              <Link to="/catalog?type=rental" className="nav-sublink">Thuê trang phục</Link>
              <Link to="/catalog?type=sale" className="nav-sublink">Mua bán đồ cũ</Link>
              <Link to="/catalog?filter=new" className="nav-sublink">Sản phẩm mới về</Link>
            </div>
          </div>

          {/* Blog VESTORA */}
          <Link to="/blog" className={`navbar-link ${isActive("/blog")}`}>
            Blog VESTORA
          </Link>

          {/* Liên Hệ */}
          <Link to="/contact" className={`navbar-link ${isActive("/contact")}`}>
            Liên Hệ
          </Link>

          {/* Chính Sách */}
          <div className="nav-dropdown-item">
            <Link to="/policy" className={`navbar-link ${isActive("/policy")}`}>
              Chính Sách <i className="fa-solid fa-chevron-down nav-arrow"></i>
            </Link>
            <div className="nav-dropdown-menu">
              <Link to="/policy" className="nav-sublink">Chính sách thuê đồ</Link>
              <Link to="/policy" className="nav-sublink">Thanh toán Escrow</Link>
              <Link to="/policy" className="nav-sublink">Đổi trả & Hoàn cọc</Link>
              <Link to="/policy" className="nav-sublink">Bảo mật thông tin</Link>
            </div>
          </div>

          {/* Tủ Đồ Cá Nhân */}
          <div className="nav-dropdown-item">
            <Link to="/wardrobe" className={`navbar-link ${isActive("/wardrobe")}`}>
              Tủ Đồ Cá Nhân <i className="fa-solid fa-chevron-down nav-arrow"></i>
            </Link>
            <div className="nav-dropdown-menu">
              <Link to="/wardrobe" className="nav-sublink">Tất cả trang phục đã lưu</Link>
              <Link to="/wardrobe?filter=ai-suggested" className="nav-sublink">Gợi ý AI Stylist</Link>
              <Link to="/wardrobe?filter=tryon-history" className="nav-sublink">Đã thử qua AI / Camera</Link>
              <Link to="/try-on/photo" className="nav-sublink">Ướm thử bộ đồ mới</Link>
            </div>
          </div>

          {/* Radar Cửa Hàng */}
          <Link to="/map" className={`navbar-link ${isActive("/map")}`}>
            Radar Cửa Hàng
          </Link>

          {/* Quick Access for Management Roles */}
          {/shop_owner|owner/i.test(user?.Role || user?.role || '') && (
            <Link
              to="/owner/branches"
              className={`navbar-link ${isActive('/owner/branches') || isActive('/owner/manage-shops') ? 'active' : ''}`}
              style={{ color: '#D97706', fontWeight: 600 }}
            >
              Quản Lý Chi Nhánh
            </Link>
          )}

          {/branch_manager/i.test(user?.Role || user?.role || '') && (
            <Link
              to="/branch/dashboard"
              className={`navbar-link ${isActive('/branch/dashboard') ? 'active' : ''}`}
              style={{ color: '#059669', fontWeight: 600 }}
            >
              Vận Hành Chi Nhánh
            </Link>
          )}
        </nav>

        {/* Action Icons & User Account */}
        <div className="navbar-actions">
          {/* Search Icon */}
          <Link to="/catalog" className="navbar-icon-btn" title="Tìm kiếm" aria-label="Tìm kiếm">
            <i className="fa-solid fa-magnifying-glass"></i>
          </Link>

          {/* User Account / Login Button */}
          {loading ? (
            <span className="navbar-loading-text">...</span>
          ) : user ? (
            <div className="navbar-user-dropdown-container" ref={dropdownRef}>
              <button
                type="button"
                className="user-profile-pill"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-expanded={dropdownOpen}
                aria-label="Menu tài khoản"
              >
                {avatarUrl ? (
                  <img
                    className="user-avatar-circle"
                    src={avatarUrl}
                    alt={`Avatar của ${displayName}`}
                  />
                ) : (
                  <span className="user-avatar-circle">
                    {avatarInitial}
                  </span>
                )}
                <span className="user-display-name">{displayName || "Người dùng"}</span>
                <i className={`fa-solid fa-chevron-down chevron-icon ${dropdownOpen ? "open" : ""}`}></i>
              </button>

              {dropdownOpen && (
                <div className="navbar-user-menu">
                  <div className="menu-user-header">
                    <strong>{displayName}</strong>
                    <small>{user.email}</small>
                  </div>
                  <div className="menu-divider"></div>
                  <Link
                    to="/profile"
                    className="menu-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <i className="fa-regular fa-user menu-icon"></i> Tài khoản cá nhân
                  </Link>
                  <Link
                    to="/cart"
                    className="menu-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <i className="fa-solid fa-bag-shopping menu-icon"></i> Giỏ hàng & Đơn thuê
                  </Link>
                  <Link
                    to="/favorites"
                    className="menu-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <i className="fa-regular fa-heart menu-icon"></i> Sản phẩm yêu thích
                  </Link>
                  <Link
                    to="/wardrobe"
                    className="menu-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <i className="fa-solid fa-wand-magic-sparkles menu-icon"></i> Tủ đồ cá nhân (AI)
                  </Link>
                  {/shop_owner|owner/i.test(user?.Role || user?.role || '') && (
                    <>
                      <Link
                        to="/owner/branches"
                        className="menu-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <i className="fa-solid fa-store menu-icon"></i> Quản lý chi nhánh
                      </Link>
                      <Link
                        to="/owner/dashboard"
                        className="menu-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <i className="fa-solid fa-chart-line menu-icon"></i> Tổng quan chuỗi
                      </Link>
                    </>
                  )}
                  {/branch_manager/i.test(user?.Role || user?.role || '') && (
                    <>
                      <Link
                        to="/branch/dashboard"
                        className="menu-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <i className="fa-solid fa-store menu-icon"></i> Vận hành chi nhánh
                      </Link>
                      <Link
                        to="/branch/settings"
                        className="menu-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <i className="fa-solid fa-gear menu-icon"></i> Cài đặt cửa hàng & Bản đồ
                      </Link>
                    </>
                  )}
                  {/admin/i.test(user?.Role || user?.role || '') && (
                    <Link
                      to="/admin/dashboard"
                      className="menu-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <i className="fa-solid fa-shield-halved menu-icon"></i> Quản trị hệ thống
                    </Link>
                  )}
                  {/operation_staff/i.test(user?.Role || user?.role || '') && (
                    <Link
                      to="/ops/shops"
                      className="menu-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <i className="fa-solid fa-boxes-packing menu-icon"></i> Vận hành OPS
                    </Link>
                  )}
                  <div className="menu-divider"></div>
                  <button
                    type="button"
                    className="menu-item menu-item-logout"
                    onClick={handleLogout}
                  >
                    <i className="fa-solid fa-arrow-right-from-bracket menu-icon"></i> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : authError ? (
            <button type="button" onClick={refreshUser} className="btn-retry-auth">
              Thử lại
            </button>
          ) : (
            <Link to="/login" className="navbar-icon-btn" title="Đăng nhập tài khoản">
              <i className="fa-regular fa-user"></i>
            </Link>
          )}

          {/* Cart Icon with badge 0 */}
          <Link to="/cart" className="navbar-icon-btn navbar-cart-btn" title="Giỏ hàng" aria-label="Giỏ hàng">
            <i className="fa-solid fa-bag-shopping"></i>
            <span className="cart-badge-count">0</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
