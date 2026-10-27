import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/AdminDashboard.css';
import '../styles/AdminShops.css';

export default function AdminTopHeader({ onToggleSidebar, breadcrumb }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const isOps = location.pathname.startsWith('/ops');

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

        <Link
          to={isOps ? "/ops/shops" : "/admin/dashboard"}
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
            title="Thông báo hệ thống"
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
                  onClick={() => handleNav(isOps ? '/ops/moderation' : '/admin/moderation')}
                >
                  Xem tất cả
                </button>
              </div>

              <div className="admin-dropdown-list">
                <div
                  className="admin-dropdown-item notif"
                  onClick={() => handleNav(isOps ? '/ops/shops' : '/admin/shops')}
                  role="button"
                  tabIndex={0}
                >
                  <span className="admin-dropdown-icon shop">🏪</span>
                  <div className="admin-dropdown-content">
                    <div className="admin-dropdown-item-title">Mạng lưới Chi Nhánh & Kho VESTORA</div>
                    <div className="admin-dropdown-item-desc">Kiểm tra thông tin hoạt động và tồn kho các chi nhánh</div>
                    <span className="admin-dropdown-time">Hệ thống chuỗi VESTORA (UC-12)</span>
                  </div>
                </div>

                <div
                  className="admin-dropdown-item notif"
                  onClick={() => handleNav(isOps ? '/ops/moderation' : '/admin/moderation')}
                  role="button"
                  tabIndex={0}
                >
                  <span className="admin-dropdown-icon product">👗</span>
                  <div className="admin-dropdown-content">
                    <div className="admin-dropdown-item-title">Trang phục dạ hội chờ kiểm duyệt</div>
                    <div className="admin-dropdown-item-desc">Kiểm định tiêu chuẩn ảnh Haute Couture & giá cọc</div>
                    <span className="admin-dropdown-time">15 phút trước • Kiểm duyệt</span>
                  </div>
                </div>

                <div
                  className="admin-dropdown-item notif"
                  onClick={() => handleNav(isOps ? '/ops/disputes' : '/admin/disputes')}
                  role="button"
                  tabIndex={0}
                >
                  <span className="admin-dropdown-icon dispute">⚖️</span>
                  <div className="admin-dropdown-content">
                    <div className="admin-dropdown-item-title">Yêu cầu hoàn cọc Escrow PayOS</div>
                    <div className="admin-dropdown-item-desc">Đơn hàng đã hoàn tất trả đồ an toàn tại showroom</div>
                    <span className="admin-dropdown-time">1 giờ trước • Trọng tài</span>
                  </div>
                </div>

                <div
                  className="admin-dropdown-item notif"
                  onClick={() => handleNav(isOps ? '/ops/shops' : '/admin/accounts')}
                  role="button"
                  tabIndex={0}
                >
                  <span className="admin-dropdown-icon account">{isOps ? '🏬' : '👤'}</span>
                  <div className="admin-dropdown-content">
                    <div className="admin-dropdown-item-title">{isOps ? 'Giám sát chi nhánh showroom mới' : 'Xác thực tài khoản người dùng KYC'}</div>
                    <div className="admin-dropdown-item-desc">{isOps ? 'Chi nhánh cập nhật tọa độ GPS bản đồ' : 'Cập nhật hồ sơ định danh điện tử hoàn tất'}</div>
                    <span className="admin-dropdown-time">3 giờ trước • Kiểm soát</span>
                  </div>
                </div>
              </div>

              <div className="admin-dropdown-footer">
                <button
                  type="button"
                  className="admin-dropdown-footer-link"
                  onClick={() => handleNav(isOps ? '/ops/moderation' : '/admin/moderation')}
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
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
              alt="Lê Hoàng Long"
              className="admin-shops-topbar__avatar"
            />
            <div className="admin-shops-topbar__user-meta">
              <span className="admin-shops-topbar__user-name">
                Lê Hoàng Long
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginLeft: 3, verticalAlign: 'middle' }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
              <span className="admin-shops-topbar__user-role">{isOps ? 'Bộ Phận Vận Hành' : 'Quản Trị Viên'}</span>
            </div>
          </div>

          {showProfile && (
            <div className="admin-topbar-dropdown admin-profile-dropdown">
              <div className="admin-dropdown-profile-card">
                <img
                  src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80"
                  alt="Lê Hoàng Long"
                  className="admin-dropdown-profile-avatar"
                />
                <div>
                  <div className="admin-dropdown-profile-name">Lê Hoàng Long</div>
                  <div className="admin-dropdown-profile-email">{isOps ? 'ops@vestora.vn' : 'admin@vestora.vn'}</div>
                  <span
                    className="admin-dropdown-profile-badge"
                    style={isOps ? { background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0' } : {}}
                  >
                    {isOps ? 'Chuyên Viên Vận Hành (OPS)' : 'Quản Trị Hệ Thống Tối Cao'}
                  </span>
                </div>
              </div>

              <div className="admin-dropdown-menu">
                {isOps ? (
                  <>
                    <button
                      type="button"
                      className="admin-dropdown-menu-item"
                      onClick={() => handleNav('/ops/shops')}
                    >
                      <span className="admin-dropdown-menu-icon">🏪</span>
                      <span>Quản Lý Gian Hàng (Manage Shops)</span>
                    </button>


                    <button
                      type="button"
                      className="admin-dropdown-menu-item"
                      onClick={() => handleNav('/ops/moderation')}
                    >
                      <span className="admin-dropdown-menu-icon">👗</span>
                      <span>Kiểm Duyệt Sản Phẩm Đăng Tải</span>
                    </button>

                    <button
                      type="button"
                      className="admin-dropdown-menu-item"
                      onClick={() => handleNav('/ops/disputes')}
                    >
                      <span className="admin-dropdown-menu-icon">⚖️</span>
                      <span>Xử Lý Tranh Chấp & Khiếu Nại</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="admin-dropdown-menu-item"
                      onClick={() => handleNav('/admin/accounts')}
                    >
                      <span className="admin-dropdown-menu-icon">👤</span>
                      <span>Quản Lý Danh Sách & Phân Quyền Tài Khoản</span>
                    </button>

                    <button
                      type="button"
                      className="admin-dropdown-menu-item"
                      onClick={() => handleNav('/admin/dashboard')}
                    >
                      <span className="admin-dropdown-menu-icon">📊</span>
                      <span>Dashboard Tổng Quan Hệ Thống</span>
                    </button>

                    <button
                      type="button"
                      className="admin-dropdown-menu-item"
                      onClick={() => handleNav('/admin/shops')}
                    >
                      <span className="admin-dropdown-menu-icon">🏪</span>
                      <span>Quản Lý Gian Hàng (Manage Shops)</span>
                    </button>


                    <button
                      type="button"
                      className="admin-dropdown-menu-item"
                      onClick={() => handleNav('/admin/analytics')}
                    >
                      <span className="admin-dropdown-menu-icon">📈</span>
                      <span>Báo Cáo Doanh Thu & Thống Kê Sàn</span>
                    </button>
                  </>
                )}

                <div className="admin-dropdown-divider" />

                <button
                  type="button"
                  className="admin-dropdown-menu-item"
                  onClick={() => handleNav('/')}
                >
                  <span className="admin-dropdown-menu-icon">🛍️</span>
                  <span>Về Trang Mua Sắm VESTORA</span>
                </button>

                <button
                  type="button"
                  className="admin-dropdown-menu-item logout"
                  onClick={handleLogout}
                >
                  <span className="admin-dropdown-menu-icon">🚪</span>
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


