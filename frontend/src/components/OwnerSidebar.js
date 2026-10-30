import React, { useState, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  BadgePercent,
  BarChart3,
  Scale,
  Compass,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/ShopDashboard.css';

/**
 * OwnerSidebar - Luxury Navigation Taskbar for Shop Owner Role
 * Completely synchronized and compatible with BranchSidebar
 * Compliant with:
 *  - react-best-practices: derived memoized state, stable callbacks, bundle-friendly imports
 *  - ui-styling & ui-ux-pro-max: >=44px touch targets, obsidian/gold atelier palette, centered brand header
 *  - web-design-guidelines: semantic HTML, accessible ARIA, keyboard focus-visible rings
 */
export default function OwnerSidebar({ isCollapsed: externalCollapsed, onToggle: externalOnToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  // Internal collapse state persisted to localStorage if not controlled externally
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    try {
      return localStorage.getItem('vestora_owner_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const isCollapsed = externalCollapsed !== undefined ? externalCollapsed : internalCollapsed;

  const handleToggle = useCallback(() => {
    if (externalOnToggle) {
      externalOnToggle();
    } else {
      setInternalCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('vestora_owner_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  }, [externalOnToggle]);

  // Derived owner display name & avatar initial (eliminates redundant useState + useEffect cycles)
  const ownerName = useMemo(() => {
    return user?.fullName || user?.FullName || user?.name || 'Chủ Chuỗi Cửa Hàng';
  }, [user]);

  const ownerInitial = useMemo(() => {
    return ownerName.charAt(0).toUpperCase();
  }, [ownerName]);

  // Derived owner role label (completely dynamic, not hardcoded)
  const ownerRole = useMemo(() => {
    const raw = user?.roleName || user?.Role || user?.role;
    if (!raw) return 'SHOP OWNER';
    const upper = String(raw).trim().toUpperCase();
    if (upper === 'SHOP_OWNER' || upper === 'OWNER') return 'SHOP OWNER';
    if (upper === 'BRANCH_MANAGER') return 'BRANCH MANAGER';
    if (upper === 'OPERATION_STAFF') return 'OPERATION STAFF';
    if (upper === 'ADMIN') return 'ADMIN';
    if (upper === 'CUSTOMER') return 'CUSTOMER';
    return String(raw).replace(/_/g, ' ').toUpperCase();
  }, [user]);

  const handleLogout = useCallback(async () => {
    try {
      if (logout) {
        await logout();
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      navigate('/login');
    } catch {
      navigate('/login');
    }
  }, [logout, navigate]);

  const isActive = useCallback(
    (path) => {
      if (location.pathname === path) return true;
      if (
        path === '/owner/branches' &&
        (location.pathname === '/owner/shops' || location.pathname === '/owner/manage-shops')
      ) {
        return true;
      }
      if (path !== '/owner/dashboard' && location.pathname.startsWith(path + '/')) {
        return true;
      }
      return false;
    },
    [location.pathname]
  );

  // Grouped operational domains for Shop Owner
  const navGroups = useMemo(
    () => [
      {
        id: 'operations',
        title: 'VẬN HÀNH CHUỖI',
        items: [
          {
            path: '/owner/dashboard',
            label: 'Tổng Quan Chuỗi',
            icon: LayoutDashboard,
            desc: 'Báo cáo tổng hợp vận hành toàn chuỗi',
          },
          {
            path: '/owner/branches',
            label: 'Quản Lý Chi Nhánh',
            icon: Store,
            desc: 'Quản lý danh sách chi nhánh & bổ nhiệm quản lý',
          },
        ],
      },
      {
        id: 'finance',
        title: 'TÀI CHÍNH & KINH DOANH',
        items: [
          {
            path: '/owner/pricing',
            label: 'Bảng Giá & Tiền Cọc',
            icon: BadgePercent,
            desc: 'Chính sách giá thuê, giá bán & tỷ lệ cọc',
          },
          {
            path: '/owner/analytics',
            label: 'Báo Cáo Tài Chính',
            icon: BarChart3,
            desc: 'Doanh thu toàn chuỗi & dòng tiền đối soát',
          },
          {
            path: '/owner/disputes',
            label: 'Khiếu Nại & Cọc',
            icon: Scale,
            desc: 'Xử lý tranh chấp và tiền cọc Escrow',
          },
        ],
      },
    ],
    []
  );

  return (
    <aside
      className={`shop-sidebar ${isCollapsed ? 'collapsed' : ''}`}
      role="navigation"
      aria-label="Thanh điều hướng Chủ Chuỗi VESTORA"
    >
      <div className="shop-sidebar-inner">
        {/* Top Brand Header - Centered Logo */}
        <div className="shop-brand-badge">
          <div className="shop-brand-left">
            <Link to="/owner/dashboard" className="shop-brand-link" title="VESTORA Shop Owner">
              <span className="shop-brand-logo">{isCollapsed ? 'V' : 'VESTORA'}</span>
            </Link>
          </div>

          <button
            type="button"
            className="shop-sidebar-toggle-btn"
            onClick={handleToggle}
            title={isCollapsed ? 'Mở rộng thanh tác vụ' : 'Thu gọn thanh tác vụ'}
            aria-label={isCollapsed ? 'Mở rộng thanh tác vụ' : 'Thu gọn thanh tác vụ'}
          >
            {isCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Owner Profile Card */}
        <div
          className={`shop-branch-card ${isCollapsed ? 'collapsed' : ''}`}
          title={`${ownerName} • ${ownerRole}`}
        >
          <div className="shop-branch-avatar-container">
            {user?.avatar ? (
              <img src={user.avatar} alt={ownerName} className="shop-branch-avatar-img" />
            ) : (
              <div className="shop-branch-avatar-circle">
                <span>{ownerInitial}</span>
              </div>
            )}
            <span className="shop-branch-status-dot online" />
          </div>

          {!isCollapsed && (
            <div className="shop-branch-info-box">
              <div className="shop-branch-manager-name" title={ownerName}>
                {ownerName}
              </div>
              <div className="shop-owner-role-tag in-card" title={ownerRole}>
                <span className="text-truncate">{ownerRole}</span>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="shop-nav-menu">
          {navGroups.map((group) => (
            <div key={group.id} className="shop-nav-group">
              {!isCollapsed ? (
                <div className="sidebar-section-label">{group.title}</div>
              ) : (
                <div className="sidebar-section-divider-dot" />
              )}

              {group.items.map((item) => {
                const active = isActive(item.path);
                const IconComponent = item.icon;

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`sidebar-nav-item ${active ? 'active' : ''}`}
                    title={isCollapsed ? `${item.label} - ${item.desc}` : item.desc}
                    aria-current={active ? 'page' : undefined}
                  >
                    <div className="sidebar-nav-item-content">
                      <span className="sidebar-nav-icon">
                        <IconComponent size={17} strokeWidth={active ? 2.2 : 1.8} />
                      </span>
                      {!isCollapsed && (
                        <span className="sidebar-nav-label text-truncate">{item.label}</span>
                      )}
                    </div>

                    {!isCollapsed && (
                      <div className="sidebar-nav-item-right">
                        <ChevronRight
                          size={13}
                          className={`sidebar-nav-arrow ${active ? 'active' : ''}`}
                        />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer Section */}
        <div className="shop-sidebar-footer">
          <Link
            to="/"
            className="sidebar-nav-item footer-link"
            title={isCollapsed ? 'Xem Cổng Khách Hàng' : undefined}
          >
            <div className="sidebar-nav-item-content">
              <span className="sidebar-nav-icon">
                <Compass size={17} strokeWidth={1.8} />
              </span>
              {!isCollapsed && <span className="sidebar-nav-label">Cổng Khách Hàng</span>}
            </div>
            {!isCollapsed && <span className="footer-link-arrow">↗</span>}
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="shop-sidebar-btn-logout"
            title={isCollapsed ? 'Đăng xuất khỏi hệ thống' : undefined}
          >
            <span className="sidebar-nav-icon logout-icon">
              <LogOut size={17} strokeWidth={1.8} />
            </span>
            {!isCollapsed && <span className="sidebar-nav-label">Đăng Xuất</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
