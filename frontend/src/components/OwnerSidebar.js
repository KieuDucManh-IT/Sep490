import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/OpsShops.css';
import '../styles/AdminDashboard.css';

/**
 * OwnerSidebar - Navigation sidebar for Shop Owner role
 */
export default function OwnerSidebar({ isCollapsed = false, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      if (logout) {
        await logout();
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      navigate('/login');
    } catch (err) {
      navigate('/login');
    }
  };

  const isActive = (path) => {
    if (path === '/owner/branches') {
      return (
        location.pathname === '/owner/branches' ||
        location.pathname === '/owner/shops'
      ) ? 'active' : '';
    }
    return location.pathname === path ? 'active' : '';
  };

  return (
    <aside className={`admin-shops-sidebar ops-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div>
        <div className="admin-shops-sidebar__brand">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link
              to="/owner/dashboard"
              className="admin-shops-sidebar__logo"
              title="VESTORA Shop Owner"
            >
              {isCollapsed ? 'V' : 'VESTORA'}
            </Link>
            {onToggle && (
              <button
                type="button"
                onClick={onToggle}
                className="admin-sidebar-collapse-toggle"
                title={isCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
                aria-label="Thu gọn / mở rộng menu"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isCollapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
                </svg>
              </button>
            )}
          </div>
          {!isCollapsed && (
            <div
              className="admin-shops-sidebar__sub"
              style={{ color: '#D97706', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '11px', textTransform: 'none' }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#D97706', display: 'inline-block' }} />
              Shop Owner
            </div>
          )}
        </div>

        <nav className="admin-shops-sidebar__nav">
          <Link
            to="/owner/dashboard"
            className={`admin-shops-sidebar__link ${isActive('/owner/dashboard')}`}
            title="Tổng Quan Toàn Chuỗi"
          >
            <span className="admin-shops-sidebar__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </span>
            {!isCollapsed && <span>Tổng Quan Chuỗi</span>}
          </Link>

          <Link
            to="/owner/branches"
            className={`admin-shops-sidebar__link ${isActive('/owner/branches')}`}
            title="Quản Lý Chi Nhánh & Hồ Sơ"
          >
            <span className="admin-shops-sidebar__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 9l2-5h14l2 5" />
                <path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9" />
                <path d="M10 13a2 2 0 0 0 4 0" />
              </svg>
            </span>
            {!isCollapsed && <span>Quản Lý Chi Nhánh & Hồ Sơ</span>}
          </Link>

          <Link
            to="/owner/pricing"
            className={`admin-shops-sidebar__link ${isActive('/owner/pricing')}`}
            title="Bảng Giá & Cọc"
          >
            <span className="admin-shops-sidebar__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
            </span>
            {!isCollapsed && <span>Bảng Giá & Cọc</span>}
          </Link>

          <Link
            to="/owner/analytics"
            className={`admin-shops-sidebar__link ${isActive('/owner/analytics')}`}
            title="Báo Cáo Tài Chính"
          >
            <span className="admin-shops-sidebar__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </span>
            {!isCollapsed && <span>Báo Cáo Tài Chính</span>}
          </Link>

          <Link
            to="/owner/disputes"
            className={`admin-shops-sidebar__link ${isActive('/owner/disputes')}`}
            title="Khiếu Nại & Tiền Cọc"
          >
            <span className="admin-shops-sidebar__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            {!isCollapsed && <span>Khiếu Nại & Cọc</span>}
          </Link>
        </nav>
      </div>

      <div className="admin-shops-sidebar__footer">
        <Link
          to="/"
          className="admin-shops-sidebar__link"
          title="Trang chủ khách hàng"
        >
          <span className="admin-shops-sidebar__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </span>
          {!isCollapsed && <span>Xem Cổng Khách Hàng</span>}
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          className="admin-shops-sidebar__logout"
          title="Đăng xuất"
        >
          <span className="admin-shops-sidebar__icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </span>
          {!isCollapsed && <span>Đăng Xuất</span>}
        </button>
      </div>
    </aside>
  );
}
