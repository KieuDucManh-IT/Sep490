import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Search,
  Heart,
  Bell,
  ShoppingBag,
  User,
  Store,
  BarChart2,
  Settings,
  ShieldCheck,
  Package,
  LogOut,
  ClipboardList,
  Wallet,
  Truck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import NavbarLocationWidget from "./NavbarLocationWidget";
import "../styles/Navbar.css";

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, authError, logout, refreshUser } = useAuth();
  const [cartCount] = useState(() => {
    try {
      const raw = localStorage.getItem('vestora_cart');
      return raw ? JSON.parse(raw).length : 0;
    } catch {
      return 0;
    }
  });
  const [wishlistCount] = useState(() => {
    try {
      const raw = localStorage.getItem('vestora_favorites');
      return raw ? JSON.parse(raw).length : 0;
    } catch {
      return 0;
    }
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/' ? 'active' : '';
    return location.pathname.startsWith(path) ? 'active' : '';
  };
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

          {/* Sản Phẩm */}
          <div className="nav-dropdown-item">
            <Link to="/catalog" className={`navbar-link ${isActive("/catalog")}`}>
              Sản Phẩm <ChevronDown size={12} className="nav-arrow" />
            </Link>
            <div className="nav-dropdown-menu">
              <Link to="/catalog" className="nav-sublink">Tất cả sản phẩm</Link>
              <Link to="/catalog?type=rental" className="nav-sublink">Thuê trang phục</Link>
              <Link to="/catalog?type=sale" className="nav-sublink">Mua bán đồ cũ</Link>
              <Link to="/catalog?filter=new" className="nav-sublink">Sản phẩm mới về</Link>
            </div>
          </div>

          {/* Tủ Đồ Cá Nhân */}
          <div className="nav-dropdown-item">
            <Link to="/wardrobe" className={`navbar-link ${isActive("/wardrobe")}`}>
              Tủ Đồ Cá Nhân <ChevronDown size={12} className="nav-arrow" />
            </Link>
            <div className="nav-dropdown-menu">
              <Link to="/wardrobe" className="nav-sublink">Tất cả trang phục đã lưu</Link>
              <Link to="/stylist" className="nav-sublink">Tư vấn AI Stylist </Link>
              <Link to="/wardrobe?filter=tryon-history" className="nav-sublink">Đã thử qua AI / Camera</Link>
              <Link to="/try-on/photo" className="nav-sublink">Ướm thử bộ đồ mới</Link>
            </div>
          </div>

          {/* Blog VESTORA */}
          <Link to="/blog" className={`navbar-link ${isActive("/blog")}`}>
            Blog VESTORA
          </Link>

          {/* Liên Hệ (Gồm Liên hệ, Về VESTORA và Chính Sách) */}
          <div className="nav-dropdown-item">
            <Link to="/contact" className={`navbar-link ${isActive("/contact") || isActive("/about") || isActive("/policy")}`}>
              Liên Hệ <ChevronDown size={12} className="nav-arrow" />
            </Link>
            <div className="nav-dropdown-menu">
              <Link to="/contact" className="nav-sublink">Liên hệ & Hỗ trợ</Link>
              <div className="nav-dropdown-divider"></div>
              <Link to="/about" className="nav-sublink">Giới thiệu VESTORA</Link>
              <Link to="/about" className="nav-sublink">Tầm nhìn & Sứ mệnh</Link>
              <Link to="/about" className="nav-sublink">Cam kết dịch vụ</Link>
              <div className="nav-dropdown-divider"></div>
              <Link to="/policy" className="nav-sublink">Chính sách VESTORA</Link>
            </div>
          </div>

          {/* Tra Cứu Đơn Hàng */}
          <Link to="/tracking" className={`navbar-link ${isActive("/tracking")}`}>
            Tra Cứu Đơn
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
          {/* Quick Location Picker */}
          <NavbarLocationWidget />

          {/* Search Icon */}
          <Link to="/catalog" className="navbar-icon-btn" title="Tìm kiếm" aria-label="Tìm kiếm">
            <Search size={18} />
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
                <ChevronDown size={14} className={`chevron-icon ${dropdownOpen ? "open" : ""}`} />
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
                    <User size={15} className="menu-icon" /> Tài khoản cá nhân
                  </Link>
                  <Link
                    to="/rental-orders"
                    className="menu-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <ClipboardList size={15} className="menu-icon" /> Đơn thuê của tôi
                  </Link>
                  <Link
                    to="/tracking"
                    className="menu-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Truck size={15} className="menu-icon" /> Tra cứu đơn hàng
                  </Link>
                  <Link
                    to="/wallet"
                    className="menu-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Wallet size={15} className="menu-icon" /> Ví Vestora
                  </Link>
                  <Link
                    to="/wardrobe"
                    className="menu-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Heart size={15} className="menu-icon" /> Tủ đồ &amp; Bộ sưu tập
                  </Link>
                  {/shop_owner|owner/i.test(user?.Role || user?.role || '') && (
                    <>
                      <div className="menu-divider"></div>
                      <Link
                        to="/owner/branches"
                        className="menu-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <Store size={15} className="menu-icon" /> Quản lý chi nhánh
                      </Link>
                      <Link
                        to="/owner/dashboard"
                        className="menu-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <BarChart2 size={15} className="menu-icon" /> Tổng quan chuỗi
                      </Link>
                    </>
                  )}
                  {/branch_manager/i.test(user?.Role || user?.role || '') && (
                    <>
                      <div className="menu-divider"></div>
                      <Link
                        to="/branch/dashboard"
                        className="menu-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <Store size={15} className="menu-icon" /> Vận hành chi nhánh
                      </Link>
                      <Link
                        to="/branch/settings"
                        className="menu-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <Settings size={15} className="menu-icon" /> Cài đặt cửa hàng &amp; Bản đồ
                      </Link>
                    </>
                  )}
                  {/admin/i.test(user?.Role || user?.role || '') && (
                    <>
                      <div className="menu-divider"></div>
                      <Link
                        to="/admin/accounts"
                        className="menu-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <ShieldCheck size={15} className="menu-icon" /> Quản trị hệ thống
                      </Link>
                    </>
                  )}
                  {/operation_staff/i.test(user?.Role || user?.role || '') && (
                    <>
                      <div className="menu-divider"></div>
                      <Link
                        to="/ops/shops"
                        className="menu-item"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <Package size={15} className="menu-icon" /> Vận hành OPS
                      </Link>
                    </>
                  )}
                  <div className="menu-divider"></div>
                  <button
                    type="button"
                    className="menu-item menu-item-logout"
                    onClick={handleLogout}
                  >
                    <LogOut size={15} className="menu-icon" /> Đăng xuất
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
            <User size={18} />
            </Link>
          )}

          {/* Wishlist / Wardrobe Icon with reactive badge */}
          <Link
            to="/wardrobe"
            className="navbar-icon-btn navbar-wishlist-btn"
            title="Tủ đồ & Yêu thích"
            aria-label="Tủ đồ & Yêu thích"
            data-testid="navbar-wishlist-btn"
          >
            <Heart size={18} />
            {wishlistCount > 0 && (
              <span className="cart-badge-count" data-testid="navbar-wishlist-count">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Notification Bell Icon */}
          <Link to="/profile" className="navbar-icon-btn navbar-bell-btn" title="Thông báo" aria-label="Thông báo">
            <Bell size={18} />
          </Link>

          {/* Cart Icon with Link to /cart */}
          <Link
            to="/cart"
            className="navbar-icon-btn navbar-cart-btn"
            title="Giỏ hàng"
            aria-label="Giỏ hàng"
            data-testid="navbar-cart-btn"
          >
            <ShoppingBag size={18} />
            {cartCount > 0 && (
              <span className="cart-badge-count" data-testid="navbar-cart-count">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
