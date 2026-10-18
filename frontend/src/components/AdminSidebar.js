import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/AdminDashboard.css';
import '../styles/AdminShops.css';

export default function AdminSidebar({ isCollapsed, onToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const isOps = location.pathname.startsWith('/ops');

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Lỗi đăng xuất admin sidebar:', err);
      navigate('/login');
    }
  };

  const isActive = (path) => {
    if (path.includes('/shops')) {
      return (
        location.pathname === '/ops/shops' ||
        location.pathname === '/admin/shops' ||
        location.pathname === '/ops/manage-shops' ||
        location.pathname === '/admin/manage-shops'
      ) ? 'active' : '';
    }
    if (path.includes('/shop-applications')) {
      return (
        location.pathname === '/ops/shop-applications' ||
        location.pathname === '/admin/shop-applications' ||
        location.pathname === '/ops/shops/approvals' ||
        location.pathname === '/admin/shops/approvals'
      ) ? 'active' : '';
    }
    if (path.includes('/moderation')) {
      return (location.pathname === '/ops/moderation' || location.pathname === '/admin/moderation') ? 'active' : '';
    }
    if (path.includes('/disputes')) {
      return (location.pathname === '/ops/disputes' || location.pathname === '/admin/disputes') ? 'active' : '';
    }
    return location.pathname === path ? 'active' : '';
  };

  return (
    <aside className={`admin-shops-sidebar admin-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div>
        <div className="admin-shops-sidebar__brand">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link
              to={isOps ? "/ops/shops" : "/admin/dashboard"}
              className="admin-shops-sidebar__logo"
              title={isOps ? "VESTORA Operations Staff" : "VESTORA Admin"}
            >
              {isCollapsed ? 'V' : 'VESTORA'}
            </Link>
            {onToggle && (
              <button
                type="button"
                onClick={onToggle}
                className="admin-sidebar-collapse-toggle"
                title={isCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
                aria-label="Thu gọn / mở rộng menu"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {isCollapsed ? (
                    <polyline points="9 18 15 12 9 6" />
                  ) : (
                    <polyline points="15 18 9 12 15 6" />
                  )}
                </svg>
              </button>
            )}
          </div>
          {!isCollapsed && (
            <div
              className="admin-shops-sidebar__sub"
              style={{ color: isOps ? '#059669' : '#737373', letterSpacing: '1px' }}
            >
              {isOps ? 'BỘ PHẬN VẬN HÀNH (OPS)' : 'QUẢN TRỊ HỆ THỐNG'}
            </div>
          )}
        </div>

        <nav className="admin-shops-sidebar__nav">
          {!isOps && (
            <>
              <Link
                to="/admin/dashboard"
                className={`admin-shops-sidebar__link ${isActive('/admin/dashboard')}`}
                title="Tổng Quan"
              >
                <span className="admin-shops-sidebar__icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  </svg>
                </span>
                {!isCollapsed && <span>Tổng Quan</span>}
              </Link>

              <Link
                to="/admin/accounts"
                className={`admin-shops-sidebar__link ${isActive('/admin/accounts')}`}
                title="Quản Lý Tài Khoản"
              >
                <span className="admin-shops-sidebar__icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <circle cx="9" cy="7" r="4" />
                    <path d="M17 11a3 3 0 0 0-3-3" />
                    <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                {!isCollapsed && <span>Quản Lý Tài Khoản</span>}
              </Link>
            </>
          )}

          <Link
            to={isOps ? "/ops/shops" : "/admin/shops"}
            className={`admin-shops-sidebar__link ${isActive(isOps ? '/ops/shops' : '/admin/shops')}`}
            title="Quản Lý Gian Hàng"
          >
            <span className="admin-shops-sidebar__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 9l2-5h14l2 5" />
                <path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9" />
                <path d="M10 13a2 2 0 0 0 4 0" />
              </svg>
            </span>
            {!isCollapsed && <span>Quản Lý Gian Hàng</span>}
          </Link>

          <Link
            to={isOps ? "/ops/shop-applications" : "/admin/shop-applications"}
            className={`admin-shops-sidebar__link ${isActive(isOps ? '/ops/shop-applications' : '/admin/shop-applications')}`}
            title="Phê Duyệt Shop"
          >
            <span className="admin-shops-sidebar__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
            </span>
            {!isCollapsed && <span>Phê Duyệt Shop</span>}
          </Link>

          <Link
            to={isOps ? "/ops/moderation" : "/admin/moderation"}
            className={`admin-shops-sidebar__link ${isActive(isOps ? '/ops/moderation' : '/admin/moderation')}`}
            title="Kiểm Duyệt Sản Phẩm"
          >
            <span className="admin-shops-sidebar__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </span>
            {!isCollapsed && <span>Kiểm Duyệt Sản Phẩm</span>}
          </Link>

          <Link
            to={isOps ? "/ops/disputes" : "/admin/disputes"}
            className={`admin-shops-sidebar__link ${isActive(isOps ? '/ops/disputes' : '/admin/disputes')}`}
            title="Báo Cáo & Khiếu Nại"
          >
            <span className="admin-shops-sidebar__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            {!isCollapsed && <span>Báo Cáo & Khiếu Nại</span>}
          </Link>

          {!isOps && (
            <Link
              to="/admin/analytics"
              className={`admin-shops-sidebar__link ${isActive('/admin/analytics')}`}
              title="Thống Kê Hệ Thống"
            >
              <span className="admin-shops-sidebar__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </span>
              {!isCollapsed && <span>Thống Kê Hệ Thống</span>}
            </Link>
          )}
        </nav>
      </div>

      <div className="admin-shops-sidebar__bottom">
        <button
          type="button"
          onClick={handleLogout}
          className="admin-shops-sidebar__logout"
          title="Đăng xuất khỏi hệ thống"
          style={{
            background: 'none',
            border: 'none',
            width: '100%',
            cursor: 'pointer',
            textAlign: 'left',
            font: 'inherit',
            color: 'inherit',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
          }}
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


