import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Menu,
  Store,
  Building2,
  ChevronDown,
  Bell,
  LayoutDashboard,
  BadgePercent,
  Compass,
  LogOut,
  CheckCircle2,
  Check,
  CalendarRange,
  ShoppingBag,
  RotateCcw,
  BarChart3,
  Star,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAssignedBranchApi } from '../services/shopApi';
import '../styles/ShopDashboard.css';

/**
 * OwnerTopHeader - Luxury Top Navigation Bar for Shop Owner
 * Compliant with:
 *  - react-best-practices: route-aware auto breadcrumb inference, derived state, stable callbacks
 *  - ui-styling & ui-ux-pro-max: >=44px touch targets, gold/obsidian atelier palette, glassmorphism blur
 *  - web-design-guidelines: semantic HTML5, accessible ARIA roles, keyboard Escape/outside click handlers
 */
export default function OwnerTopHeader({
  onToggleSidebar,
  isSidebarCollapsed,
  breadcrumb,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [showProfile, setShowProfile] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showBranchSwitcher, setShowBranchSwitcher] = useState(false);

  const profileRef = useRef(null);
  const notifRef = useRef(null);
  const branchSwitcherRef = useRef(null);

  // Auto dismiss popovers on route change
  useEffect(() => {
    setShowProfile(false);
    setShowNotif(false);
    setShowBranchSwitcher(false);
  }, [location.pathname]);

  // Click-outside & Keyboard Escape dismissal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowProfile(false);
        setShowNotif(false);
        setShowBranchSwitcher(false);
      }
    };
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
      if (branchSwitcherRef.current && !branchSwitcherRef.current.contains(e.target)) {
        setShowBranchSwitcher(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const ownerName = useMemo(() => {
    return user?.fullName || user?.FullName || user?.name || 'Chủ Chuỗi VESTORA';
  }, [user]);

  const ownerInitial = useMemo(() => {
    return ownerName.charAt(0).toUpperCase();
  }, [ownerName]);

  // Derived owner/manager role label (completely dynamic, not hardcoded)
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

  const isBranchManager = useMemo(() => {
    const raw = user?.roleName || user?.Role || user?.role;
    const roleUpper = String(raw || '').trim().toUpperCase();
    return roleUpper === 'BRANCH_MANAGER' || location.pathname.startsWith('/branch');
  }, [user, location.pathname]);

  // Assigned branch info and list of branches managed by this manager
  const [assignedBranch, setAssignedBranch] = useState(() => {
    try {
      const cached = localStorage.getItem('vestora_branch_cache');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [managedBranches, setManagedBranches] = useState(() => {
    try {
      const cached = localStorage.getItem('vestora_managed_branches_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // Sắp xếp danh sách chi nhánh: Cũ nhất đẩy lên trên cùng (createdAt tăng dần hoặc theo ObjectId)
  const sortedBranches = useMemo(() => {
    if (!Array.isArray(managedBranches)) return [];
    return [...managedBranches].sort((a, b) => {
      // 1. So sánh theo createdAt nếu cả hai đều có
      if (a.createdAt && b.createdAt) {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
          return timeA - timeB; // Cũ nhất lên đầu (tăng dần)
        }
      } else if (a.createdAt) {
        return -1;
      } else if (b.createdAt) {
        return 1;
      }

      // 2. Dự phòng: Trích xuất timestamp từ MongoDB ObjectId (4 byte đầu tiên là unix timestamp)
      const getTimestampFromId = (id) => {
        if (!id) return 0;
        const idStr = String(id);
        if (idStr.length >= 8) {
          const hex = idStr.substring(0, 8);
          const parsed = parseInt(hex, 16);
          return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
      };

      const idTimeA = getTimestampFromId(a._id);
      const idTimeB = getTimestampFromId(b._id);
      return idTimeA - idTimeB;
    });
  }, [managedBranches]);

  const loadBranchData = useCallback(async (targetBranchId) => {
    try {
      const res = await getAssignedBranchApi(targetBranchId);
      if (res?.success) {
        if (res.data) {
          setAssignedBranch(res.data);
          try {
            localStorage.setItem('vestora_branch_cache', JSON.stringify(res.data));
            localStorage.setItem('vestora_active_branch_id', res.data._id);
          } catch {}
        }
        if (Array.isArray(res.assignedBranches)) {
          setManagedBranches(res.assignedBranches);
          try {
            localStorage.setItem(
              'vestora_managed_branches_cache',
              JSON.stringify(res.assignedBranches)
            );
          } catch {}
        }
      }
    } catch (err) {
      console.error('Failed to load assigned branches:', err);
    }
  }, []);

  useEffect(() => {
    if (isBranchManager) {
      const activeId = localStorage.getItem('vestora_active_branch_id');
      loadBranchData(activeId);
    }
  }, [isBranchManager, loadBranchData]);

  // Synchronize branch updates across components and window storage events
  useEffect(() => {
    const handleBranchChanged = (e) => {
      const newBranch = e.detail?.branch;
      if (newBranch) {
        setAssignedBranch(newBranch);
      } else if (e.detail?.branchId) {
        loadBranchData(e.detail.branchId);
      }
    };
    const handleStorageChange = () => {
      try {
        const cachedBranch = localStorage.getItem('vestora_branch_cache');
        if (cachedBranch) setAssignedBranch(JSON.parse(cachedBranch));
        const cachedList = localStorage.getItem('vestora_managed_branches_cache');
        if (cachedList) setManagedBranches(JSON.parse(cachedList));
      } catch {}
    };

    window.addEventListener('vestora_branch_changed', handleBranchChanged);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('vestora_branch_changed', handleBranchChanged);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadBranchData]);

  const handleSelectBranch = useCallback((branch) => {
    if (!branch) return;
    setAssignedBranch(branch);
    try {
      localStorage.setItem('vestora_active_branch_id', branch._id);
      localStorage.setItem('vestora_branch_cache', JSON.stringify(branch));
    } catch {}
    setShowBranchSwitcher(false);
    window.dispatchEvent(
      new CustomEvent('vestora_branch_changed', {
        detail: { branch, branchId: branch._id },
      })
    );
  }, []);

  // Route-aware auto-inferred breadcrumbs so header is never blank
  const currentBreadcrumb = useMemo(() => {
    if (breadcrumb) return breadcrumb;
    const path = location.pathname;

    // 1. Branch Manager Routes
    if (path === '/branch/dashboard') return 'Tổng Quan Chi Nhánh';
    if (path === '/branch/settings' || path === '/branch/showroom') return 'Cửa Hàng & Ghim Map';
    if (path === '/branch/rental-orders') return 'Đơn Thuê Trang Phục';
    if (path === '/branch/sale-orders') return 'Đơn Bán Đứt';
    if (path === '/branch/returns') return 'Kiểm Định Nhận Trả';
    if (path === '/branch/analytics') return 'Doanh Thu Chi Nhánh';
    if (path === '/branch/reviews') return 'Đánh Giá Khách Hàng';
    if (path === '/warehouse/products' || path === '/warehousemanager/products') return 'Danh Mục Sản Phẩm';
    if (
      path === '/warehouse/inventory' ||
      path === '/warehousemanager/inventory' ||
      path === '/warehousemanager/inventory-locations'
    ) {
      return 'Tồn Kho Cửa Hàng & Kho';
    }

    // 2. Shop Owner Routes
    if (path === '/owner/dashboard') return 'Tổng Quan Chuỗi';
    if (
      path === '/owner/branches' ||
      path === '/owner/shops' ||
      path === '/owner/manage-shops'
    ) {
      return 'Quản Lý Chi Nhánh & Trụ Sở';
    }
    if (path === '/owner/pricing') return 'Bảng Giá & Tiền Cọc Escrow';
    if (path === '/owner/analytics') return 'Báo Cáo Tài Chính Chuỗi';
    if (path === '/owner/disputes') return 'Khiếu Nại & Cọc Escrow';
    if (path === '/owner/settings') return 'Hồ Sơ Cửa Hàng & Ghim Map';

    return isBranchManager ? 'Bảng Điều Khiển Chi Nhánh' : 'Bảng Điều Khiển Chuỗi';
  }, [breadcrumb, location.pathname, isBranchManager]);

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

  return (
    <header className="owner-topbar" role="banner">
      {/* Left: Sidebar Collapse Toggle & Route Breadcrumbs */}
      <div className="owner-topbar-left">
        {onToggleSidebar && (
          <button
            type="button"
            className="owner-topbar-toggle-btn"
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            aria-label={isSidebarCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
          >
            <Menu size={18} strokeWidth={2} />
          </button>
        )}

        <div className="owner-topbar-breadcrumb">
          <span className="owner-topbar-breadcrumb-current">{currentBreadcrumb}</span>
        </div>
      </div>

      {/* Right: Operational Status, Notifications & Profile Card */}
      <div className="owner-topbar-right">
        {/* Branch Switcher (Exclusively for Branch Manager) */}
        {isBranchManager && (
          <div style={{ position: 'relative' }} ref={branchSwitcherRef}>
            <button
              type="button"
              className="owner-branch-switcher-pill"
              onClick={() => {
                setShowBranchSwitcher((prev) => !prev);
                setShowProfile(false);
                setShowNotif(false);
              }}
              aria-expanded={showBranchSwitcher}
              aria-haspopup="listbox"
              title={
                assignedBranch
                  ? `Đang quản lý: ${assignedBranch.name}`
                  : 'Chọn chi nhánh quản lý'
              }
            >
              <Building2 size={15} color="#D4AF37" />
              <div className="owner-branch-switcher-text">
                <span className="owner-branch-switcher-label">Chi nhánh:</span>
                <span className="owner-branch-switcher-name">
                  {assignedBranch?.name ||
                    (sortedBranches.length > 0
                      ? sortedBranches[0].name
                      : 'Chưa phân công')}
                </span>
              </div>
              {sortedBranches.length > 1 && (
                <span
                  className="owner-branch-count-badge"
                  title={`Bạn đang quản lý ${sortedBranches.length} chi nhánh`}
                >
                  {sortedBranches.length}
                </span>
              )}
              <ChevronDown
                size={13}
                className={`owner-topbar-chevron ${showBranchSwitcher ? 'open' : ''}`}
              />
            </button>

            {showBranchSwitcher && (
              <div
                className="owner-branch-switcher-dropdown"
                role="listbox"
                aria-label="Danh sách chi nhánh phụ trách"
              >
                <div className="owner-branch-dropdown-header">
                  <div className="owner-branch-dropdown-title">
                    CHI NHÁNH PHỤ TRÁCH
                  </div>
                  <div className="owner-branch-dropdown-subtitle">
                    {sortedBranches.length > 0
                      ? `${sortedBranches.length} chi nhánh trực thuộc`
                      : 'Chưa có chi nhánh nào được gán'}
                  </div>
                </div>

                <div className="owner-branch-switcher-list">
                  {sortedBranches.length === 0 ? (
                    <div className="owner-branch-empty-text">
                      Bạn chưa được phân công quản lý chi nhánh nào.
                    </div>
                  ) : (
                    sortedBranches.map((branch) => {
                      const isSelected =
                        assignedBranch?._id?.toString() === branch._id?.toString();
                      return (
                        <button
                          key={branch._id}
                          type="button"
                          className={`owner-branch-switcher-item ${
                            isSelected ? 'selected' : ''
                          }`}
                          onClick={() => handleSelectBranch(branch)}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className="owner-branch-item-left">
                            <div className="owner-branch-item-icon">
                              <Store size={14} />
                            </div>
                            <div className="owner-branch-item-info">
                              <div className="owner-branch-item-title-row">
                                <span className="owner-branch-item-name">
                                  {branch.name}
                                </span>
                              </div>
                              <span className="owner-branch-item-sub">
                                {[branch.ward, branch.city]
                                  .filter(Boolean)
                                  .join(', ') ||
                                  branch.address ||
                                  'VESTORA Branch'}
                              </span>
                            </div>
                          </div>

                          <div className="owner-branch-item-right">
                            <span
                              className={`owner-branch-status-dot ${
                                branch.status === 'ACTIVE' ? 'active' : 'inactive'
                              }`}
                              title={
                                branch.status === 'ACTIVE'
                                  ? 'Đang hoạt động'
                                  : 'Tạm ngưng'
                              }
                            />
                            {isSelected && (
                              <Check
                                size={15}
                                color="#D4AF37"
                                strokeWidth={2.5}
                              />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Operational Status Pill */}
        <div
          className="owner-topbar-status-pill"
          title={
            isBranchManager
              ? assignedBranch
                ? `Chi nhánh ${assignedBranch.name} • ${assignedBranch.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ngưng'}`
                : 'Chưa được phân công chi nhánh'
              : 'Hệ thống cơ sở dữ liệu chuỗi đang trực tuyến và đồng bộ thời gian thực'
          }
        >
          <span
            className={`shop-status-pulse ${
              isBranchManager
                ? assignedBranch?.status === 'ACTIVE'
                  ? 'active'
                  : 'idle'
                : 'active'
            }`}
          />
          <span>
            {isBranchManager
              ? assignedBranch?.status === 'ACTIVE'
                ? 'Chi Nhánh Hoạt Động'
                : 'Chi Nhánh Tạm Ngưng'
              : 'Toàn Chuỗi Hoạt Động'}
          </span>
        </div>

        {/* Notifications Button & Popover */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            type="button"
            className="owner-topbar-icon-btn"
            onClick={() => {
              setShowNotif((prev) => !prev);
              setShowProfile(false);
            }}
            title="Thông báo vận hành chuỗi"
            aria-expanded={showNotif}
            aria-label="Thông báo hệ thống"
          >
            <Bell size={17} strokeWidth={1.8} />
            <span className="owner-topbar-badge-dot" />
          </button>

          {showNotif && (
            <div className="owner-notif-dropdown" role="region" aria-label="Thông báo mới nhất">
              <div className="owner-notif-header">
                <span className="owner-notif-title">THÔNG BÁO VẬN HÀNH</span>
                <span className="owner-notif-badge-count">2 Mới</span>
              </div>
              <div className="owner-notif-list">
                <div className="owner-notif-item">
                  <div className="owner-notif-icon-circle">
                    <CheckCircle2 size={13} />
                  </div>
                  <div className="owner-notif-content">
                    <p className="owner-notif-text">
                      Hệ thống đồng bộ tọa độ GPS và giờ mở cửa chi nhánh thành công.
                    </p>
                    <span className="owner-notif-time">Vừa xong</span>
                  </div>
                </div>
                <div className="owner-notif-item">
                  <div className="owner-notif-icon-circle">
                    <Store size={13} />
                  </div>
                  <div className="owner-notif-content">
                    <p className="owner-notif-text">
                      Chi nhánh Cầu Giấy đã hoàn tất kiểm định trang phục hoàn trả.
                    </p>
                    <span className="owner-notif-time">15 phút trước</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill & Dropdown */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <button
            type="button"
            className="owner-topbar-user-pill"
            onClick={() => {
              setShowProfile((prev) => !prev);
              setShowNotif(false);
            }}
            aria-expanded={showProfile}
            aria-haspopup="menu"
            title={`Tài khoản: ${ownerName}`}
          >
            <div className="owner-topbar-avatar">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={ownerName}
                  className="owner-topbar-avatar-img"
                />
              ) : (
                <span>{ownerInitial}</span>
              )}
            </div>
            <div className="owner-topbar-user-info">
              <span className="owner-topbar-user-name" title={ownerName}>
                {ownerName}
              </span>
              <span className="owner-topbar-user-role">{ownerRole}</span>
            </div>
            <ChevronDown
              size={13}
              className={`owner-topbar-chevron ${showProfile ? 'open' : ''}`}
            />
          </button>

          {showProfile && (
            <div className="owner-topbar-dropdown" role="menu">
              <div className="owner-dropdown-header">
                <div className="owner-dropdown-title" title={ownerName}>
                  {ownerName}
                </div>
                <div className="owner-dropdown-subtitle">
                  {ownerRole}
                </div>
              </div>

              {isBranchManager ? (
                <>
                  <Link
                    to="/branch/dashboard"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <LayoutDashboard size={15} color="#D4AF37" />
                    <span>Tổng Quan Chi Nhánh</span>
                  </Link>

                  <Link
                    to="/branch/settings"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <Store size={15} color="#D4AF37" />
                    <span>Cửa Hàng & Ghim Map</span>
                  </Link>

                  <Link
                    to="/branch/rental-orders"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <CalendarRange size={15} color="#D4AF37" />
                    <span>Đơn Thuê Trang Phục</span>
                  </Link>

                  <Link
                    to="/branch/sale-orders"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <ShoppingBag size={15} color="#D4AF37" />
                    <span>Đơn Bán Đứt</span>
                  </Link>

                  <Link
                    to="/branch/returns"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <RotateCcw size={15} color="#D4AF37" />
                    <span>Kiểm Định Nhận Trả</span>
                  </Link>

                  <Link
                    to="/branch/analytics"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <BarChart3 size={15} color="#D4AF37" />
                    <span>Doanh Thu Chi Nhánh</span>
                  </Link>

                  <Link
                    to="/branch/reviews"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <Star size={15} color="#D4AF37" />
                    <span>Đánh Giá Khách Hàng</span>
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/owner/dashboard"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <LayoutDashboard size={15} color="#D4AF37" />
                    <span>Tổng Quan Chuỗi</span>
                  </Link>

                  <Link
                    to="/owner/branches"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <Store size={15} color="#D4AF37" />
                    <span>Quản Lý Chi Nhánh</span>
                  </Link>

                  <Link
                    to="/owner/pricing"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <BadgePercent size={15} color="#D4AF37" />
                    <span>Bảng Giá & Tiền Cọc</span>
                  </Link>

                  <Link
                    to="/owner/settings"
                    className="owner-dropdown-item"
                    role="menuitem"
                    onClick={() => setShowProfile(false)}
                  >
                    <Store size={15} color="#D4AF37" />
                    <span>Hồ Sơ Cửa Hàng & Ghim Map</span>
                  </Link>
                </>
              )}

              <Link
                to="/"
                className="owner-dropdown-item"
                role="menuitem"
                onClick={() => setShowProfile(false)}
              >
                <Compass size={15} color="#64748B" />
                <span>Xem Cổng Khách Hàng</span>
              </Link>

              <button
                type="button"
                className="owner-dropdown-item logout"
                role="menuitem"
                onClick={handleLogout}
              >
                <LogOut size={15} strokeWidth={2} />
                <span>Đăng Xuất Khỏi Hệ Thống</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
