import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/AdminDashboard.css';

export default function AdminSidebar({ isCollapsed, onToggle }) {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <aside className={`admin-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Brand Logo Header (TailAdmin style) */}
      <div className="admin-sidebar-header">
        <Link to="/admin/dashboard" className="admin-brand-link">
          <div className="admin-brand-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 5L12 19L20 5" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 5L12 12L16 5" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {!isCollapsed && (
            <div className="admin-brand-text">
              <span className="admin-brand-name">VESTORA</span>
              <span className="admin-brand-sub">Admin Console</span>
            </div>
          )}
        </Link>
        {onToggle && (
          <button className="admin-sidebar-toggle-btn" onClick={onToggle} title="Thu gọn / Mở rộng">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="admin-nav-container">
        {/* Section 1: MENU */}
        <div className="admin-nav-section">
          {!isCollapsed && <div className="admin-nav-section-title">MENU</div>}
          
          <Link to="/admin/dashboard" className={`admin-nav-link ${isActive('/admin/dashboard')}`} title="Dashboard">
            <span className="admin-nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
              </svg>
            </span>
            {!isCollapsed && <span className="admin-nav-text">Dashboard</span>}
            {!isCollapsed && (
              <span className="admin-nav-chevron">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            )}
          </Link>

          <Link to="/admin/analytics" className={`admin-nav-link ${isActive('/admin/analytics')}`} title="Thống Kê Chi Tiết">
            <span className="admin-nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 20V10" />
                <path d="M12 20V4" />
                <path d="M6 20v-6" />
              </svg>
            </span>
            {!isCollapsed && <span className="admin-nav-text">Thống Kê Hệ Thống</span>}
          </Link>

          <Link to="/admin/shops" className={`admin-nav-link ${isActive('/admin/shops')}`} title="Gian Hàng Đối Tác">
            <span className="admin-nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l2-5h14l2 5" />
                <path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9" />
                <path d="M10 13a2 2 0 0 0 4 0" />
              </svg>
            </span>
            {!isCollapsed && <span className="admin-nav-text">Gian Hàng Đối Tác</span>}
            {!isCollapsed && <span className="admin-nav-badge-count">48</span>}
          </Link>

          <Link to="/admin/accounts" className={`admin-nav-link ${isActive('/admin/accounts')}`} title="Quản Lý Tài Khoản">
            <span className="admin-nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="7" r="4" />
                <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
              </svg>
            </span>
            {!isCollapsed && <span className="admin-nav-text">Quản Lý Tài Khoản</span>}
          </Link>

          <Link to="/admin/moderation" className={`admin-nav-link ${isActive('/admin/moderation')}`} title="Kiểm Duyệt Sản Phẩm">
            <span className="admin-nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </span>
            {!isCollapsed && <span className="admin-nav-text">Kiểm Duyệt Sản Phẩm</span>}
            {!isCollapsed && <span className="admin-nav-badge-pill green">NEW</span>}
          </Link>

          <Link to="/admin/disputes" className={`admin-nav-link ${isActive('/admin/disputes')}`} title="Trọng Tài Escrow">
            <span className="admin-nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v18" />
                <path d="M5 6l7-3 7 3" />
                <path d="M5 10l-3 5h6l-3-5z" />
                <path d="M19 10l-3 5h6l-3-5z" />
              </svg>
            </span>
            {!isCollapsed && <span className="admin-nav-text">Trọng Tài PayOS Escrow</span>}
          </Link>
        </div>

        {/* Section 2: SUPPORT */}
        <div className="admin-nav-section" style={{ marginTop: '16px' }}>
          {!isCollapsed && <div className="admin-nav-section-title">SUPPORT</div>}

          <div className="admin-nav-link" style={{ cursor: 'pointer' }} onClick={() => alert('Trung tâm tư vấn hỗ trợ Admin VESTORA')}>
            <span className="admin-nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            {!isCollapsed && <span className="admin-nav-text">Hỗ Trợ & Chat</span>}
          </div>

          <Link to="/" className="admin-nav-link return-home" title="Trở về sàn VESTORA">
            <span className="admin-nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </span>
            {!isCollapsed && <span className="admin-nav-text">Về Sàn VESTORA</span>}
          </Link>
        </div>
      </nav>
    </aside>
  );
}
