import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  CalendarRange,
  ShoppingBag,
  RotateCcw,
  BarChart3,
  Shirt,
  Boxes,
  PackageCheck,
  Star,
  MessageSquareText,
  Compass,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAssignedBranchApi } from '../services/shopApi';
import chatApi from '../services/chatApi';
import socketService from '../services/socket';
import '../styles/ShopDashboard.css';

export default function BranchSidebar({ isCollapsed: externalCollapsed, onToggle: externalOnToggle }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  // Internal collapse state persisted to localStorage if not controlled externally
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    try {
      return localStorage.getItem('vestora_branch_sidebar_collapsed') === 'true';
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
          localStorage.setItem('vestora_branch_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  }, [externalOnToggle]);

  // Derived manager display name & avatar initial (eliminates redundant useState + useEffect cycles)
  const managerName = useMemo(() => {
    return user?.fullName || user?.FullName || user?.name || 'Quản Lý Chi Nhánh';
  }, [user]);

  const managerInitial = useMemo(() => {
    return managerName.charAt(0).toUpperCase();
  }, [managerName]);

  // Assigned branch info with immediate local cache to prevent layout shift
  const [assignedBranch, setAssignedBranch] = useState(() => {
    try {
      const cached = localStorage.getItem('vestora_branch_cache');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let isMounted = true;
    getAssignedBranchApi()
      .then((res) => {
        if (isMounted && res?.success && res.data) {
          setAssignedBranch(res.data);
          try {
            localStorage.setItem('vestora_branch_cache', JSON.stringify(res.data));
          } catch {}
        }
      })
      .catch(() => {});

    const handleBranchChanged = (e) => {
      if (e.detail?.branch) {
        setAssignedBranch(e.detail.branch);
      }
    };
    const handleStorage = () => {
      try {
        const cached = localStorage.getItem('vestora_branch_cache');
        if (cached) setAssignedBranch(JSON.parse(cached));
      } catch {}
    };

    window.addEventListener('vestora_branch_changed', handleBranchChanged);
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener('vestora_branch_changed', handleBranchChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const [unreadChatCount, setUnreadChatCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await chatApi.getUnreadCount();
      const count = res?.data?.unreadCount ?? res?.unreadCount ?? 0;
      setUnreadChatCount(Number(count) || 0);
    } catch (_) {}
  }, [user]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount, location.pathname]);

  useEffect(() => {
    if (!user) return;
    const socket = socketService.getSocket();
    const handleUpdate = () => fetchUnreadCount();

    socket.on('conversation:updated', handleUpdate);
    socket.on('unread:update', handleUpdate);
    socket.on('message:new', handleUpdate);
    window.addEventListener('vestora:chat:unread_changed', handleUpdate);

    const interval = setInterval(fetchUnreadCount, 30000);

    return () => {
      socket.off('conversation:updated', handleUpdate);
      socket.off('unread:update', handleUpdate);
      socket.off('message:new', handleUpdate);
      window.removeEventListener('vestora:chat:unread_changed', handleUpdate);
      clearInterval(interval);
    };
  }, [user, fetchUnreadCount]);

  const handleLogout = useCallback(async () => {
    try {
      localStorage.removeItem('vestora_active_branch_id');
      localStorage.removeItem('vestora_branch_cache');
      localStorage.removeItem('vestora_managed_branches_cache');
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
      if (path !== '/branch/dashboard' && location.pathname.startsWith(path + '/')) {
        return true;
      }
      return false;
    },
    [location.pathname]
  );

  // Navigation items configuration grouped by operational domain
  const navGroups = useMemo(
    () => [
      {
        id: 'operations',
        title: 'VẬN HÀNH CỬA HÀNG',
        items: [
          {
            path: '/branch/dashboard',
            label: 'Tổng Quan Chi Nhánh',
            icon: LayoutDashboard,
            desc: 'Báo cáo tổng hợp vận hành chi nhánh',
          },
          {
            path: '/branch/settings',
            label: 'Cửa Hàng & Ghim Map',
            icon: Store,
            desc: 'Hồ sơ cửa hàng, tọa độ GPS & giờ mở cửa',
          },
          {
            path: '/branch/rental-orders',
            label: 'Theo Dõi Đơn Thuê',
            icon: CalendarRange,
            desc: 'Giám sát chu kỳ thuê & cọc của chi nhánh',
          },
          {
            path: '/branch/sale-orders',
            label: 'Theo Dõi Đơn Mua',
            icon: ShoppingBag,
            desc: 'Giám sát các đơn bán & giao vận của chi nhánh',
          },
          {
            path: '/branch/returns',
            label: 'Kiểm Định Nhận Trả',
            icon: RotateCcw,
            desc: 'Kiểm định đồ hoàn trả & xử lý tiền cọc',
          },
          {
            path: '/branch/analytics',
            label: 'Doanh Thu Chi Nhánh',
            icon: BarChart3,
            desc: 'Dòng tiền và báo cáo doanh thu',
          },
        ],
      },
      {
        id: 'inventory',
        title: 'KHO & SẢN PHẨM',
        items: [
          {
            path: '/warehouse/products',
            label: 'Danh Mục Sản Phẩm',
            icon: Shirt,
            desc: 'Tra cứu mẫu váy và trang phục Atelier',
          },
          {
            path: '/branch/inventory',
            label: 'Tồn Kho Cửa Hàng & Kho',
            icon: Boxes,
            desc: 'Kiểm soát số lượng tồn kho khả dụng',
          },
          {
            path: '/branch/stock-requests',
            label: 'Yêu Cầu Bổ Sung Hàng',
            icon: PackageCheck,
            desc: 'Tạo và theo dõi yêu cầu chuyển hàng từ kho tổng',
          },
        ],
      },
      {
        id: 'customer',
        title: 'KHÁCH HÀNG & ĐÁNH GIÁ',
        items: [
          {
            path: '/branch/chat',
            label: 'Tư Vấn Khách Hàng',
            icon: MessageSquareText,
            desc: 'Nhắn tin tư vấn trực tiếp',
          },
          {
            path: '/branch/reviews',
            label: 'Đánh Giá Khách Hàng',
            icon: Star,
            desc: 'Phản hồi và đánh giá trải nghiệm dịch vụ',
          },
        ],
      },
    ],
    []
  );

  const isBranchActive = assignedBranch?.status === 'ACTIVE';

  return (
    <aside
      className={`shop-sidebar ${isCollapsed ? 'collapsed' : ''}`}
      role="navigation"
      aria-label="Thanh điều hướng Quản Lý Chi Nhánh"
    >
      <div className="shop-sidebar-inner">
        {/* Top Brand Header */}
        <div className="shop-brand-badge">
          <div className="shop-brand-left">
            <Link to="/branch/dashboard" className="shop-brand-link" title="VESTORA Branch Manager">
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

        {/* Manager & Assigned Branch Card */}
        <div
          className={`shop-branch-card ${isCollapsed ? 'collapsed' : ''}`}
          title={`${managerName} • Branch Manager`}
        >
          <div className="shop-branch-avatar-container">
            {user?.avatar ? (
              <img src={user.avatar} alt={managerName} className="shop-branch-avatar-img" />
            ) : (
              <div className="shop-branch-avatar-circle">
                <span>{managerInitial}</span>
              </div>
            )}
            <span
              className={`shop-branch-status-dot ${
                assignedBranch ? (isBranchActive ? 'online' : 'suspended') : 'unassigned'
              }`}
            />
          </div>

          {!isCollapsed && (
            <div className="shop-branch-info-box">
              <div className="shop-branch-manager-name" title={managerName}>
                {managerName}
              </div>
              <div
                className="shop-owner-role-tag in-card"
                title="Branch Manager"
              >
                <span className="text-truncate">
                  Branch Manager
                </span>
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
                      <span className="sidebar-nav-icon" style={{ position: 'relative' }}>
                        <IconComponent size={17} strokeWidth={active ? 2.2 : 1.8} />
                        {isCollapsed && item.path === '/branch/chat' && unreadChatCount > 0 && (
                          <span
                            style={{
                              position: 'absolute',
                              top: -2,
                              right: -2,
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: '#e11d48',
                              border: '1.5px solid #1c1917',
                            }}
                          />
                        )}
                      </span>
                      {!isCollapsed && (
                        <span className="sidebar-nav-label text-truncate">{item.label}</span>
                      )}
                    </div>

                    {!isCollapsed && (
                      <div className="sidebar-nav-item-right" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {item.path === '/branch/chat' && unreadChatCount > 0 && (
                          <span
                            style={{
                              backgroundColor: '#e11d48',
                              color: '#ffffff',
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: 999,
                              lineHeight: '14px',
                            }}
                          >
                            {unreadChatCount > 99 ? '99+' : unreadChatCount}
                          </span>
                        )}
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
