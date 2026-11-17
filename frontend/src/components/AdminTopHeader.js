import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './common/NotificationBell';
import '../styles/AdminDashboard.css';
import '../styles/AdminShops.css';

export default function AdminTopHeader({ onToggleSidebar, breadcrumb }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const accountName = user?.fullName?.trim() || user?.email?.split('@')[0] || 'Quản trị viên';
  const accountEmail = user?.email || '';
  const accountRole = user?.role || user?.Role || 'ADMIN';
  const isOps = /operation_staff|ops/i.test(accountRole);
  const roleLabel = accountRole.toUpperCase() === 'ADMIN' ? 'Quản trị viên' : accountRole;
  const avatarInitial = [...accountName][0]?.toLocaleUpperCase('vi-VN') || 'A';
  const renderAvatar = (className, size) => user?.avatar ? (
    <img src={user.avatar} alt={`Ảnh đại diện ${accountName}`} className={className} />
  ) : (
    <span className={className} role="img" aria-label={`Ảnh đại diện ${accountName}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#EEE9DF', color: '#6B5A3E', fontWeight: 700, fontSize: size }}>{avatarInitial}</span>
  );

  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setShowProfile(false);
  }, [location.pathname]);

  const handleNav = (path) => {
    navigate(path);
    setShowProfile(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Lỗi đăng xuất admin:', err);
      navigate('/login');
    }
  };

  return (
    <header className="admin-shops-topbar" style={{ position: 'sticky', top: 0, zIndex: 1000 }}>
      <div className="admin-shops-topbar__brand">
        <Link
          to={isOps ? "/ops/shops" : "/admin/accounts"}
          className="admin-shops-topbar__brand-link"
          title={isOps ? "Về Bàn Làm Việc Vận Hành (OPS)" : "Về Dashboard Tổng Quan"}
        >
          <span className="admin-shops-topbar__brand-name">VESTORA</span>
          <span
            className="admin-shops-topbar__brand-tag"
            style={isOps ? { background: '#059669', color: '#FFFFFF' } : {}}
          >
            {isOps ? 'OPS Console' : 'Admin Console'}
          </span>
        </Link>

        {breadcrumb && (
          <div className="admin-shops-topbar__breadcrumb-wrap">
            <span className="admin-shops-topbar__breadcrumb-sep">/</span>
            <span className="admin-shops-topbar__breadcrumb-current">{breadcrumb}</span>
          </div>
        )}
      </div>

      <div className="admin-shops-topbar__actions">
        <NotificationBell />

        <div className="admin-topbar-popover-container" ref={profileRef}>
          <div
            className={`admin-shops-topbar__profile ${showProfile ? 'active' : ''}`}
            onClick={() => setShowProfile((prev) => !prev)}
            role="button"
            tabIndex={0}
            aria-expanded={showProfile}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setShowProfile((prev) => !prev);
              }
            }}
          >
            <div className="admin-shops-topbar__avatar-wrapper">
              {renderAvatar('admin-shops-topbar__avatar', 15)}
              <span
                className="admin-shops-topbar__avatar-status"
                title="Đang hoạt động (Máy chủ kết nối trực tiếp)"
              />
            </div>
            <div className="admin-shops-topbar__user-meta">
              <span className="admin-shops-topbar__user-name">
                {accountName}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginLeft: 3, verticalAlign: 'middle' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
              <span className="admin-shops-topbar__user-role">{roleLabel}</span>
            </div>
          </div>

          {showProfile && (
            <div className="admin-topbar-dropdown admin-profile-dropdown">
              <div className="admin-dropdown-profile-card">
                <div className="admin-shops-topbar__avatar-wrapper">
                  {renderAvatar('admin-dropdown-profile-avatar', 17)}
                  <span
                    className="admin-shops-topbar__avatar-status"
                    title="Đang hoạt động"
                  />
                </div>
                <div>
                  <div className="admin-dropdown-profile-name">{accountName}</div>
                  <div className="admin-dropdown-profile-email">{accountEmail}</div>
                  <span
                    className="admin-dropdown-profile-badge"
                    style={isOps ? { background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' } : {}}
                  >
                    {isOps ? 'Chuyên Viên Vận Hành (OPS)' : roleLabel}
                  </span>
                </div>
              </div>

              <div className="admin-dropdown-menu">
                <button
                  type="button"
                  className="admin-dropdown-menu-item"
                  onClick={() => handleNav('/admin/accounts')}
                >
                  <span className="admin-dropdown-menu-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <span>Quản Lý Danh Sách & Phân Quyền Tài Khoản</span>
                </button>


                <div className="admin-dropdown-divider" />

                <button
                  type="button"
                  className="admin-dropdown-menu-item"
                  onClick={() => handleNav('/')}
                >
                  <span className="admin-dropdown-menu-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                      <line x1="3" y1="6" x2="21" y2="6" />
                      <path d="M16 10a4 4 0 0 1-8 0" />
                    </svg>
                  </span>
                  <span>Về Trang Mua Sắm VESTORA</span>
                </button>

                <button
                  type="button"
                  className="admin-dropdown-menu-item logout"
                  onClick={handleLogout}
                >
                  <span className="admin-dropdown-menu-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </span>
                  <span>Đăng Xuất Khỏi Hệ Thống</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}


