import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AdminDashboard.css';

export default function AdminTopHeader({ onToggleSidebar, breadcrumb = 'Admin Console System' }) {
  const navigate = useNavigate();

  return (
    <header className="admin-top-header">
      <div className="admin-header-left">
        {onToggleSidebar && (
          <button
            className="admin-header-toggle-btn"
            onClick={onToggleSidebar}
            title="Đóng / Mở Menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        )}

        {/* Command Search Input (TailAdmin Style) */}
        <div className="admin-search-wrapper">
          <span className="admin-search-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input
            type="text"
            className="admin-search-input"
            placeholder="Search or type command..."
          />
          <span className="admin-search-kbd">⌘K</span>
        </div>
      </div>

      <div className="admin-header-right">
        {/* Status indicator */}
        <span style={{ fontSize: '11px', background: '#ECFDF5', color: '#059669', padding: '4px 12px', borderRadius: '9999px', fontWeight: 600, letterSpacing: '0.5px' }}>
          ● HOẠT ĐỘNG
        </span>

        {/* Dark / Light Mode Toggle */}
        <button
          className="admin-icon-btn"
          title="Chế độ giao diện"
          onClick={() => alert('Giao diện chuẩn VESTORA Gold & Slate đã được kích hoạt')}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        </button>

        {/* Notification Bell */}
        <button
          className="admin-icon-btn"
          title="Thông báo hệ thống"
          onClick={() => navigate('/admin/moderation')}
        >
          <span className="badge-dot"></span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
        </button>

        {/* Admin User Profile Capsule */}
        <div className="admin-user-capsule" onClick={() => navigate('/admin/accounts')}>
          <img
            src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80"
            alt="Musharof"
            className="admin-user-avatar"
          />
          <div className="admin-user-info">
            <span className="admin-user-name">
              Musharof
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
            <span className="admin-user-role">System Admin</span>
          </div>
        </div>
      </div>
    </header>
  );
}
