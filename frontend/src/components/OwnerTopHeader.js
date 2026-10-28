import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/OpsShops.css';

export default function OwnerTopHeader({ onToggleSidebar, breadcrumb }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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

  const staffName = user?.FullName || user?.fullName || 'Chủ Chuỗi VESTORA';
  const staffRole = 'Shop Owner';
  const initial = staffName.charAt(0).toUpperCase();

  return (
    <header className="ops-topbar">
      <div className="ops-topbar__left">
        {onToggleSidebar && (
          <button
            type="button"
            className="admin-sidebar-collapse-toggle"
            onClick={onToggleSidebar}
            title="Đóng / Mở Menu Sidebar"
            style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        {breadcrumb && (
          <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500, marginLeft: onToggleSidebar ? '8px' : 0 }}>
            {breadcrumb}
          </span>
        )}
      </div>

      <div className="ops-topbar__right">
        <div className="ops-topbar__status">
          <span className="ops-topbar__status-dot" />
          <span>Hoạt Động</span>
        </div>

        <button
          type="button"
          className="ops-topbar__notif-btn"
          title="Thông báo vận hành"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span className="ops-topbar__notif-badge" />
        </button>

        <div className="ops-topbar__user-pill" ref={profileRef} onClick={() => setShowProfile((p) => !p)}>
          <div className="ops-topbar__avatar">
            {initial}
          </div>
          <div className="ops-topbar__user-info">
            <span className="ops-topbar__user-name">{staffName}</span>
            <span className="ops-topbar__user-role">{staffRole}</span>
          </div>

          {showProfile && (
            <div
              style={{
                position: 'absolute',
                top: '56px',
                right: '32px',
                background: '#FFFFFF',
                border: '1px solid #ECE7DE',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                padding: '8px',
                minWidth: '180px',
                zIndex: 1000,
              }}
            >
              <div style={{ padding: '8px 12px', fontSize: '12px', color: '#737373', borderBottom: '1px solid #F5F5F5' }}>
                Đăng nhập: <strong>{staffName}</strong>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontSize: '13px',
                  color: '#DC2626',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
