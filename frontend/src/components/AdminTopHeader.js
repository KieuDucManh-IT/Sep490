import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/AdminDashboard.css';
import '../styles/AdminShops.css';

export default function AdminTopHeader({ onToggleSidebar, breadcrumb }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const accountName = user?.fullName?.trim() || user?.email?.split('@')[0] || 'Quản trị viên';
  const accountEmail = user?.email || '';
  const accountRole = user?.role || 'ADMIN';
  const roleLabel = accountRole.toUpperCase() === 'ADMIN' ? 'Quản trị viên' : accountRole;
  const avatarInitial = [...accountName][0]?.toLocaleUpperCase('vi-VN') || 'A';
  const renderAvatar = (className, size) => user?.avatar ? (
    <img src={user.avatar} alt={`Ảnh đại diện ${accountName}`} className={className} />
  ) : (
    <span className={className} role="img" aria-label={`Ảnh đại diện ${accountName}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#EEE9DF', color: '#6B5A3E', fontWeight: 700, fontSize: size }}>{avatarInitial}</span>
  );

  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotif(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setShowNotif(false);
    setShowProfile(false);
  }, [location.pathname]);

  const handleNav = (path) => {
    navigate(path);
    setShowNotif(false);
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
        {onToggleSidebar && (
          <button
            type="button"
            className="admin-topbar-toggle-btn"
            onClick={onToggleSidebar}
            title="Đóng / Mở Menu Sidebar"
            aria-label="Đóng / Mở Menu Sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        <Link to="/admin/dashboard" className="admin-shops-topbar__brand-link" title="Về Dashboard Tổng Quan">
          <span className="admin-shops-topbar__brand-name">VESTORA</span>
          <span className="admin-shops-topbar__brand-tag">Admin Console</span>
        </Link>

        {breadcrumb && (
          <div className="admin-shops-topbar__breadcrumb-wrap">
            <span className="admin-shops-topbar__breadcrumb-sep">/</span>
            <span className="admin-shops-topbar__breadcrumb-current">{breadcrumb}</span>
          </div>
        )}
      </div>

      <div className="admin-shops-topbar__actions">
        <div
          className="admin-shops-topbar__status"
          title="Máy chủ và CSDL MongoDB Atlas đang kết nối trực tiếp ổn định"
        >
          <span className="admin-shops-topbar__status-dot" />
          <span>Hoạt Động</span>
        </div>

        <div className="admin-topbar-popover-container" ref={notifRef}>
          <button
            type="button"
            className={`admin-shops-topbar__bell ${showNotif ? 'active' : ''}`}
            title="Thông báo hệ thống admin"
            onClick={() => setShowNotif((prev) => !prev)}
            aria-expanded={showNotif}
          >
            <span className="admin-shops-topbar__bell-badge" />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>

          {showNotif && (
            <div className="admin-topbar-dropdown admin-notif-dropdown">
              <div className="admin-dropdown-header">
                <div>
                  <h4 className="admin-dropdown-title">Thông Báo Hệ Thống</h4>
                  <span className="admin-dropdown-sub">4 thông báo nghiệp vụ cần xử lý</span>
                </div>
                <button
                  type="button"
                  className="admin-dropdown-markall"
                  onClick={() => handleNav('/admin/moderation')}
                >
                  Xem tất cả
                </button>
              </div>

              <div className="admin-dropdown-list">
                <div
                  className="admin-dropdown-item notif"
                  onClick={() => handleNav('/admin/shops')}
                  role="button"
                  tabIndex={0}
                >
                  <span className="admin-dropdown-icon shop">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l2-5h14l2 5" />
                      <path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9" />
                      <path d="M10 13a2 2 0 0 0 4 0" />
                    </svg>
                  </span>
                  <div className="admin-dropdown-content">
                    <div className="admin-dropdown-item-title">Hồ sơ shop mới gửi phê duyệt</div>
                    <div className="admin-dropdown-item-desc">Đã nhận hồ sơ ĐKKD & CCCD từ đối tác mới</div>
                    <span className="admin-dropdown-time">Vừa xong • Nhấn để duyệt ngay</span>
                  </div>
                </div>

                <div
                  className="admin-dropdown-item notif"
                  onClick={() => handleNav('/admin/moderation')}
                  role="button"
                  tabIndex={0}
                >
                  <span className="admin-dropdown-icon product">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
                    </svg>
                  </span>
                  <div className="admin-dropdown-content">
                    <div className="admin-dropdown-item-title">Trang phục dạ hội chờ kiểm duyệt</div>
                    <div className="admin-dropdown-item-desc">Kiểm định tiêu chuẩn ảnh Haute Couture & giá cọc</div>
                    <span className="admin-dropdown-time">15 phút trước • Kiểm duyệt</span>
                  </div>
                </div>

                <div
                  className="admin-dropdown-item notif"
                  onClick={() => handleNav('/admin/disputes')}
                  role="button"
                  tabIndex={0}
                >
                  <span className="admin-dropdown-icon dispute">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </span>
                  <div className="admin-dropdown-content">
                    <div className="admin-dropdown-item-title">Yêu cầu hoàn cọc Escrow PayOS</div>
                    <div className="admin-dropdown-item-desc">Đơn hàng đã hoàn tất trả đồ an toàn tại showroom</div>
                    <span className="admin-dropdown-time">1 giờ trước • Trọng tài</span>
                  </div>
                </div>

                <div
                  className="admin-dropdown-item notif"
                  onClick={() => handleNav('/admin/accounts')}
                  role="button"
                  tabIndex={0}
                >
                  <span className="admin-dropdown-icon account">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <div className="admin-dropdown-content">
                    <div className="admin-dropdown-item-title">Xác thực tài khoản người dùng KYC</div>
                    <div className="admin-dropdown-item-desc">Cập nhật hồ sơ định danh điện tử hoàn tất</div>
                    <span className="admin-dropdown-time">3 giờ trước • Quản lý</span>
                  </div>
                </div>
              </div>

              <div className="admin-dropdown-footer">
                <button
                  type="button"
                  className="admin-dropdown-footer-link"
                  onClick={() => handleNav('/admin/moderation')}
                >
                  Đi đến Trung Tâm Kiểm Duyệt Tổng Hợp →
                </button>
              </div>
            </div>
          )}
        </div>

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
            {renderAvatar('admin-shops-topbar__avatar', 15)}
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
                {renderAvatar('admin-dropdown-profile-avatar', 17)}
                <div>
                  <div className="admin-dropdown-profile-name">{accountName}</div>
                  <div className="admin-dropdown-profile-email">{accountEmail}</div>
                  <span className="admin-dropdown-profile-badge">{roleLabel}</span>
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

                <button
                  type="button"
                  className="admin-dropdown-menu-item"
                  onClick={() => handleNav('/admin/dashboard')}
                >
                  <span className="admin-dropdown-menu-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                  </span>
                  <span>Dashboard Tổng Quan Hệ Thống</span>
                </button>

                <button
                  type="button"
                  className="admin-dropdown-menu-item"
                  onClick={() => handleNav('/admin/shops')}
                >
                  <span className="admin-dropdown-menu-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l2-5h14l2 5" />
                      <path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9" />
                      <path d="M10 13a2 2 0 0 0 4 0" />
                    </svg>
                  </span>
                  <span>Phê Duyệt Shop Owner & Showroom</span>
                </button>

                <button
                  type="button"
                  className="admin-dropdown-menu-item"
                  onClick={() => handleNav('/admin/analytics')}
                >
                  <span className="admin-dropdown-menu-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                  </span>
                  <span>Báo Cáo Doanh Thu & Thống Kê Sàn</span>
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


