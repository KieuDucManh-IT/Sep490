import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  Store,
  ChevronDown,
  Bell,
  LayoutDashboard,
  BadgePercent,
  Compass,
  LogOut,
  CheckCircle2,
  CalendarRange,
  ShoppingBag,
  RotateCcw,
  BarChart3,
  Star,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/ShopDashboard.css';

/**
 * OwnerTopHeader - Luxury Top Navigation Bar for Shop Owner
 * Compliant with:
 *  - react-best-practices: route-aware auto breadcrumb inference, derived state, stable callbacks
 *  - ui-styling & ui-ux-pro-max: >=44px touch targets, gold/obsidian atelier palette, glassmorphism blur
 *  - web-design-guidelines: semantic HTML5, accessible ARIA roles, keyboard Escape/outside click handlers
 */
export default function OwnerTopHeader({
  onToggleSidebar,
  isSidebarCollapsed,
  breadcrumb,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [showProfile, setShowProfile] = useState(false);
  const [showNotif, setShowNotif] = useState(false);

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  // Auto dismiss popovers on route change
  useEffect(() => {
    setShowProfile(false);
    setShowNotif(false);
  }, [location.pathname]);

  // Click-outside & Keyboard Escape dismissal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowProfile(false);
        setShowNotif(false);
      }
    };
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const ownerName = useMemo(() => {
    return user?.fullName || user?.FullName || user?.name || 'Chủ Chuỗi VESTORA';
  }, [user]);

  const ownerInitial = useMemo(() => {
    return ownerName.charAt(0).toUpperCase();
  }, [ownerName]);

  // Derived owner/manager role label (completely dynamic, not hardcoded)
  const ownerRole = useMemo(() => {
    const raw = user?.roleName || user?.Role || user?.role;
    if (!raw) return 'SHOP OWNER';
    const upper = String(raw).trim().toUpperCase();
    if (upper === 'SHOP_OWNER' || upper === 'OWNER') return 'SHOP OWNER';
    if (upper === 'BRANCH_MANAGER') return 'BRANCH MANAGER';
    if (upper === 'OPERATION_STAFF') return 'OPERATION STAFF';
    if (upper === 'ADMIN') return 'ADMIN';
    if (upper === 'CUSTOMER') return 'CUSTOMER';
    return String(raw).replace(/_/g, ' ').toUpperCase();
  }, [user]);

  const isBranchManager = useMemo(() => {
    const raw = user?.roleName || user?.Role || user?.role;
    const roleUpper = String(raw || '').trim().toUpperCase();
    return roleUpper === 'BRANCH_MANAGER' || location.pathname.startsWith('/branch');
  }, [user, location.pathname]);

  // Assigned branch info from cache for dynamic status pill
  const [assignedBranch, setAssignedBranch] = useState(() => {
    try {
      const cached = localStorage.getItem('vestora_branch_cache');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const cached = localStorage.getItem('vestora_branch_cache');
        if (cached) setAssignedBranch(JSON.parse(cached));
      } catch {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Route-aware auto-inferred breadcrumbs so header is never blank
  const currentBreadcrumb = useMemo(() => {
    if (breadcrumb) return breadcrumb;
    const path = location.pathname;

    // 1. Branch Manager Routes
    if (path === '/branch/dashboard') return 'Tổng Quan Chi Nhánh';
    if (path === '/branch/settings' || path === '/branch/showroom') return 'Cửa Hàng & Ghim Map';
    if (path === '/branch/rental-orders') return 'Đơn Thuê Trang Phục';
    if (path === '/branch/sale-orders') return 'Đơn Bán Đứt';
    if (path === '/branch/returns') return 'Kiểm Định Nhận Trả';
    if (path === '/branch/analytics') return 'Doanh Thu Chi Nhánh';
    if (path === '/branch/reviews') return 'Đánh Giá Khách Hàng';
    if (path === '/warehouse/products' || path === '/warehousemanager/products') return 'Danh Mục Sản Phẩm';
    if (
      path === '/warehouse/inventory' ||
      path === '/warehousemanager/inventory' ||
      path === '/warehousemanager/inventory-locations'
    ) {
      return 'Tồn Kho Cửa Hàng & Kho';
    }

    // 2. Shop Owner Routes
    if (path === '/owner/dashboard') return 'Tổng Quan Chuỗi';
    if (
      path === '/owner/branches' ||
      path === '/owner/shops' ||
      path === '/owner/manage-shops'
    ) {
      return 'Quản Lý Chi Nhánh & Trụ Sở';
    }
    if (path === '/owner/pricing') return 'Bảng Giá & Tiền Cọc Escrow';
    if (path === '/owner/analytics') return 'Báo Cáo Tài Chính Chuỗi';
    if (path === '/owner/disputes') return 'Khiếu Nại & Cọc Escrow';
    if (path === '/owner/settings') return 'Hồ Sơ Cửa Hàng & Ghim Map';

    return isBranchManager ? 'Bảng Điều Khiển Chi Nhánh' : 'Bảng Điều Khiển Chuỗi';
  }, [breadcrumb, location.pathname, isBranchManager]);

  const handleLogout = useCallback(async () => {
    try {
      if (logout) {
        await logout();
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      navigate('/login');
    } catch {
      navigate('/login');
    }
  }, [logout, navigate]);

  return (
    <header className="owner-topbar" role="banner">
      {/* Left: Sidebar Collapse Toggle & Route Breadcrumbs */}
      <div className="owner-topbar-left">
        {onToggleSidebar && (
          <button
            type="button"
            className="owner-topbar-toggle-btn"
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            aria-label={isSidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
          >
            <Menu size={18} strokeWidth={2} />
          </button>
        )}

        <div className="owner-topbar-breadcrumb">
          <span className="owner-topbar-breadcrumb-current">{currentBreadcrumb}</span>
        </div>
      </div>

      {/* Right: Operational Status, Notifications & Profile Card */}
      <div className="owner-topbar-right">
        {/* Operational Status Pill */}
        <div
          className="owner-topbar-status-pill"
          title={
            isBranchManager
              ? assignedBranch
                ? `Chi nhánh ${assignedBranch.name} • ${assignedBranch.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ngưng'}`
                : 'Chưa được phân công chi nhánh'
              : 'Hệ thống cơ sở dữ liệu chuỗi đang trực tuyến và đồng bộ thời gian thực'
          }
        >
          <span
            className={`shop-status-pulse ${
              isBranchManager
                ? assignedBranch?.status === 'ACTIVE'
                  ? 'active'
                  : 'idle'
                : 'active'
            }`}
          />
          <span>
            {isBranchManager
              ? assignedBranch?.status === 'ACTIVE'
                ? 'Chi Nhánh Hoạt Động'
                : 'Chi Nhánh Tạm Ngưng'
              : 'Toàn Chuỗi Hoạt Động'}
          </span>
        </div>

        {/* Notifications Button & Popover */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            type="button"
            className="owner-topbar-icon-btn"
            onClick={() => {
              setShowNotif((prev) => !prev);
              setShowProfile(false);
            }}
            title="Thông báo vận hành chuỗi"
            aria-expanded={showNotif}
            aria-label="Thông báo hệ thống"
          >
            <Bell size={17} strokeWidth={1.8} />
            <span className="owner-topbar-badge-dot" />
          </button>

          {showNotif && (
            <div className="owner-notif-dropdown" role="region" aria-label="Thông báo mới nhất">
              <div className="owner-notif-header">
                <span className="owner-notif-title">THÔNG BÁO VẬN HÀNH</span>
                <span className="owner-notif-badge-count">2 Mới</span>
              </div>
              <div className="owner-notif-list">
                <div className="owner-notif-item">
                  <div className="owner-notif-icon-circle">
                    <CheckCircle2 size={13} />
                  </div>
                  <div className="owner-notif-content">
                    <p className="owner-notif-text">
                      Hệ thống đồng bộ tọa độ GPS và giờ mở cửa chi nhánh thành công.
                    </p>
                    <span className="owner-notif-time">Vừa xong</span>
                  </div>
                </div>
                <div className="owner-notif-item">
                  <div className="owner-notif-icon-circle">
                    <Store size={13} />
                  </div>
                  <div className="owner-notif-content">
                    <p className="owner-notif-text">
                      Chi nhánh Cầu Giấy đã hoàn tất kiểm định trang phục hoàn trả.
                    </p>
                    <span className="owner-notif-time">15 phút trước</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill & Dropdown */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <button
            type="button"
            className="owner-topbar-user-pill"
            onClick={() => {
              setShowProfile((prev) => !prev);
              setShowNotif(false);
            }}
            aria-expanded={showProfile}
            aria-haspopup="menu"
            title={`Tài khoản: ${ownerName}`}
          >
            <div className="owner-topbar-avatar">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={ownerName}
                  className="owner-topbar-avatar-img"
                />
              ) : (
                <span>{ownerInitial}</span>
              )}
            </div>
            <div className="owner-topbar-user-info">
              <span className="owner-topbar-user-name" title={ownerName}>
                {ownerName}
              </span>
              <span className="owner-topbar-user-role">{ownerRole}</span>
            </div>
            <ChevronDown
              size={13}
              className={`owner-topbar-chevron ${showProfile ? 'open' : ''}`}
            />
          </button>

          {showProfile && (
            <div className="owner-topbar-dropdown" role="menu">
              <div className="owner-dropdown-header">
                <div className="owner-dropdown-title" title={ownerName}>
                  {ownerName}
                </div>
                <div className="owner-dropdown-subtitle">
                  {ownerRole}
                </div>
              </div>

              {isBranchManager ? (
                <>
                  <Link
                    to="/branch/dashboard"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <LayoutDashboard size={15} color="#D4AF37" />
                    <span>Tổng Quan Chi Nhánh</span>
                  </Link>

                  <Link
                    to="/branch/settings"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <Store size={15} color="#D4AF37" />
                    <span>Cửa Hàng & Ghim Map</span>
                  </Link>

                  <Link
                    to="/branch/rental-orders"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <CalendarRange size={15} color="#D4AF37" />
                    <span>Đơn Thuê Trang Phục</span>
                  </Link>

                  <Link
                    to="/branch/sale-orders"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <ShoppingBag size={15} color="#D4AF37" />
                    <span>Đơn Bán Đứt</span>
                  </Link>

                  <Link
                    to="/branch/returns"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <RotateCcw size={15} color="#D4AF37" />
                    <span>Kiểm Định Nhận Trả</span>
                  </Link>

                  <Link
                    to="/branch/analytics"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <BarChart3 size={15} color="#D4AF37" />
                    <span>Doanh Thu Chi Nhánh</span>
                  </Link>

                  <Link
                    to="/branch/reviews"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <Star size={15} color="#D4AF37" />
                    <span>Đánh Giá Khách Hàng</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/owner/dashboard"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <LayoutDashboard size={15} color="#D4AF37" />
                    <span>Tổng Quan Chuỗi</span>
                  </Link>

                  <Link
                    to="/owner/branches"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <Store size={15} color="#D4AF37" />
                    <span>Quản Lý Chi Nhánh</span>
                  </Link>

                  <Link
                    to="/owner/pricing"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <BadgePercent size={15} color="#D4AF37" />
                    <span>Bảng Giá & Tiền Cọc</span>
                  </Link>

                  <Link
                    to="/owner/settings"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <Store size={15} color="#D4AF37" />
                    <span>Hồ Sơ Cửa Hàng & Ghim Map</span>
                  </Link>
                </>
              )}

              <Link
                to="/"
                className="owner-dropdown-item"
                role="menuitem"
                onClick={() => setShowProfile(false)}
              >
                <Compass size={15} color="#64748B" />
                <span>Xem Cổng Khách Hàng</span>
              </Link>

              <button
                type="button"
                className="owner-dropdown-item logout"
                role="menuitem"
                onClick={handleLogout}
              >
                <LogOut size={15} strokeWidth={2} />
                <span>Đăng Xuất Khỏi Hệ Thống</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
