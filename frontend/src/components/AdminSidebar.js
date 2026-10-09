import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/AdminDashboard.css';

export default function AdminSidebar() {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-logo">
        <h2>VESTORA SYSTEM</h2>
        <span>Quản Trị Viên Hệ Thống VESTORA</span>
      </div>

      <nav className="admin-nav-list">
        <div style={{ fontSize: '10px', color: '#6B7280', padding: '8px 12px 4px 12px', fontWeight: 700, letterSpacing: '1px' }}>
          QUẢN TRỊ HỆ THỐNG
        </div>

        <Link to="/admin/dashboard" className={`admin-nav-item ${isActive('/admin/dashboard')}`}>
          Dashboard Tổng Quan
        </Link>
        <Link to="/admin/analytics" className={`admin-nav-item ${isActive('/admin/analytics')}`}>
          Thống Kê Chi Tiết Hệ Thống
        </Link>
        <Link to="/admin/shops" className={`admin-nav-item ${isActive('/admin/shops')}`}>
          Quản Lý Gian Hàng Đối Tác
        </Link>
        <Link to="/admin/accounts" className={`admin-nav-item ${isActive('/admin/accounts')}`}>
          Quản Lý Tài Khoản Người Dùng
        </Link>
        <Link to="/admin/moderation" className={`admin-nav-item ${isActive('/admin/moderation')}`}>
          Kiểm Duyệt Sản Phẩm & Shop
        </Link>
        <Link to="/admin/disputes" className={`admin-nav-item ${isActive('/admin/disputes')}`}>
          Trọng Tài Dispute PayOS Escrow
        </Link>

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <Link to="/" className="admin-nav-item" style={{ color: '#9ca3af' }}>
            Trở Về Sàn VESTORA ➔
          </Link>
        </div>
      </nav>
    </aside>
  );
}
