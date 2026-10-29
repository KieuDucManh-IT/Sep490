import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAssignedBranchApi } from '../services/shopApi';
import '../styles/ShopDashboard.css';

// Dedicated sidebar for Branch Manager role
export default function BranchSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [managerName, setManagerName] = useState('Quản Lý Chi Nhánh');
  const [assignedBranch, setAssignedBranch] = useState(null);

  useEffect(() => {
    if (user?.fullName || user?.FullName || user?.name) {
      setManagerName(user.fullName || user.FullName || user.name);
    } else {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          if (parsed.fullName || parsed.FullName || parsed.name) {
            setManagerName(parsed.fullName || parsed.FullName || parsed.name);
          }
        }
      } catch (e) { }
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    getAssignedBranchApi()
      .then((res) => {
        if (isMounted && res?.success && res.data) {
          setAssignedBranch(res.data);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
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

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  const managerInitial = managerName.charAt(0).toUpperCase();

  return (
    <aside className="shop-sidebar">
      <div className="shop-sidebar-inner">
        {/* Brand Title */}
        <div className="shop-brand-badge">
          <Link to="/branch/dashboard" style={{ textDecoration: 'none' }}>
            <h2 className="shop-brand-title">VESTORA</h2>
          </Link>
          <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, letterSpacing: '1px', marginTop: '4px' }}>
            BRANCH MANAGER
          </div>
        </div>

        {/* Manager Profile Card */}
        <div className="shop-owner-profile-card">
          <div className="shop-owner-avatar-ring">
            <span>{managerInitial}</span>
            <span
              className="shop-owner-status-dot"
              style={{
                background: assignedBranch?.status === 'ACTIVE' ? '#10B981' : assignedBranch ? '#F59E0B' : '#9CA3AF',
              }}
              title={
                assignedBranch
                  ? `Cửa hàng ${assignedBranch.name} (${assignedBranch.status === 'ACTIVE' ? 'Mở Cửa' : 'Tạm Dừng'})`
                  : 'Chưa được phân công cửa hàng'
              }
            />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="shop-owner-name" title={managerName}>{managerName}</div>
            <div
              style={{
                fontSize: '11px',
                color: assignedBranch ? '#D97706' : '#9CA3AF',
                fontWeight: assignedBranch ? 600 : 400,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
              }}
              title={assignedBranch ? assignedBranch.name : 'Chưa phân công cửa hàng'}
            >
              {assignedBranch ? (
                <>
                  <MapPin size={11} className="flex-shrink-0" />
                  <span className="text-truncate">{assignedBranch.name}</span>
                </>
              ) : (
                'Chưa phân công cửa hàng'
              )}
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="shop-nav-menu">
          {/* Section 1: Store Operations */}
          <div className="sidebar-section-label">VẬN HÀNH CỬA HÀNG</div>

          <Link to="/branch/dashboard" className={`sidebar-nav-item ${isActive('/branch/dashboard')}`}>
            <div className="sidebar-nav-item-content">
              <span className="sidebar-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="14" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                </svg>
              </span>
              <span>Báo Cáo Chi Nhánh (UC-52)</span>
            </div>
            <span className="sidebar-nav-arrow">›</span>
          </Link>

          <Link to="/branch/settings" className={`sidebar-nav-item ${isActive('/branch/settings')}`}>
            <div className="sidebar-nav-item-content">
              <span className="sidebar-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <span>Cửa Hàng & Ghim Map</span>
            </div>
            <span className="sidebar-nav-arrow">›</span>
          </Link>

          <Link to="/branch/rental-orders" className={`sidebar-nav-item ${isActive('/branch/rental-orders')}`}>
            <div className="sidebar-nav-item-content">
              <span className="sidebar-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <span>Đơn Thuê Trang Phục (UC-43)</span>
            </div>
            <span className="sidebar-nav-arrow">›</span>
          </Link>

          <Link to="/branch/sale-orders" className={`sidebar-nav-item ${isActive('/branch/sale-orders')}`}>
            <div className="sidebar-nav-item-content">
              <span className="sidebar-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </span>
              <span>Đơn Bán Đứt (UC-44)</span>
            </div>
            <span className="sidebar-nav-arrow">›</span>
          </Link>

          <Link to="/branch/returns" className={`sidebar-nav-item ${isActive('/branch/returns')}`}>
            <div className="sidebar-nav-item-content">
              <span className="sidebar-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline points="1 4 1 10 7 10" />
                  <polyline points="23 20 23 14 17 14" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
              </span>
              <span>Kiểm Định Nhận Trả & Cọc (UC-46..48)</span>
            </div>
            <span className="sidebar-nav-arrow">›</span>
          </Link>

          <Link to="/branch/analytics" className={`sidebar-nav-item ${isActive('/branch/analytics')}`}>
            <div className="sidebar-nav-item-content">
              <span className="sidebar-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </span>
              <span>Doanh Thu Chi Nhánh (UC-52)</span>
            </div>
            <span className="sidebar-nav-arrow">›</span>
          </Link>

          {/* Section 2: Warehouse & Products */}
          <div className="sidebar-section-label">KHO & SẢN PHẨM</div>

          <Link to="/warehouse/products" className={`sidebar-nav-item ${isActive('/warehouse/products')}`}>
            <div className="sidebar-nav-item-content">
              <span className="sidebar-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M12 4a3 3 0 0 0-3 3c0 1.2.7 2.2 1.7 2.7L2.4 15.3A1.5 1.5 0 0 0 3.5 17.5h17a1.5 1.5 0 0 0 1.1-2.2L13.3 9.7A3 3 0 0 0 12 4z" />
                </svg>
              </span>
              <span>Danh Mục Sản Phẩm (UC-15)</span>
            </div>
            <span className="sidebar-nav-arrow">›</span>
          </Link>

          <Link to="/warehouse/inventory" className={`sidebar-nav-item ${isActive('/warehouse/inventory')}`}>
            <div className="sidebar-nav-item-content">
              <span className="sidebar-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </span>
              <span>Tồn Kho Cửa Hàng & Kho (UC-19)</span>
            </div>
            <span className="sidebar-nav-arrow">›</span>
          </Link>

          {/* Section 3: Customer & Reviews */}
          <div className="sidebar-section-label">KHÁCH HÀNG & ĐÁNH GIÁ</div>

          <Link to="/branch/reviews" className={`sidebar-nav-item ${isActive('/branch/reviews')}`}>
            <div className="sidebar-nav-item-content">
              <span className="sidebar-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </span>
              <span>Đánh Giá Khách Hàng (UC-50)</span>
            </div>
            <span className="sidebar-nav-arrow">›</span>
          </Link>
        </nav>

        {/* Footer */}
        <div className="shop-sidebar-footer">
          <Link to="/" className="sidebar-nav-item" style={{ color: '#9CA3AF' }}>
            <div className="sidebar-nav-item-content">
              <span className="sidebar-nav-icon" style={{ color: '#9CA3AF' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10" />
                  <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                </svg>
              </span>
              <span>Xem Cổng Khách Hàng</span>
            </div>
            <span style={{ fontSize: '12px', color: '#6B7280' }}>↗</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="shop-sidebar-btn-logout"
          >
            <span className="sidebar-nav-icon" style={{ color: '#F87171' }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span>Đăng Xuất</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
