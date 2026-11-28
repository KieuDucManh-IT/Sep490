import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Menu,
  Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAssignedBranchApi } from '../services/shopApi';
import NotificationBell from './common/NotificationBell';
import '../styles/ShopDashboard.css';

export default function OwnerTopHeader({
  onToggleSidebar,
  isSidebarCollapsed,
  breadcrumb,
}) {
  const location = useLocation();
  const { user } = useAuth();

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
      const branchId = e.detail?.branchId || e.detail?.branch?._id;
      const newBranch = e.detail?.branch;
      if (newBranch && (newBranch.name || newBranch.shopName)) {
        setAssignedBranch(newBranch);
      } else if (branchId) {
        const found = managedBranches.find((b) => String(b._id) === String(branchId));
        if (found) {
          setAssignedBranch(found);
        } else {
          loadBranchData(branchId);
        }
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
  }, [loadBranchData, managedBranches]);

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
      return 'Quản Lý Chi Nhánh';
    }
    if (path === '/owner/pricing') return 'Bảng Giá & Tiền Đặt Cọc';
    if (path === '/owner/analytics') return 'Báo Cáo Tài Chính Chuỗi';
    if (path === '/owner/disputes') return 'Khiếu Nại & Tiền Đặt Cọc';
    if (path === '/owner/settings') return 'Hồ Sơ Cửa Hàng & Ghim Map';

    return isBranchManager ? 'Bảng Điều Khiển Chi Nhánh' : 'Bảng Điều Khiển Chuỗi';
  }, [breadcrumb, location.pathname, isBranchManager]);

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

      {/* Right: Operational Status & Notifications */}
      <div className="owner-topbar-right">
        {/* Static Branch Badge (Exclusively for Branch Manager) */}
        {isBranchManager && (
          <div
            className="owner-branch-switcher-pill"
            style={{ cursor: 'default' }}
            title={
              assignedBranch
                ? `Chi nhánh phụ trách: ${assignedBranch.name}`
                : 'Chưa phân công chi nhánh'
            }
          >
            <Building2 size={15} color="#D4AF37" />
            <div className="owner-branch-switcher-text">
              <span className="owner-branch-switcher-label">Chi nhánh:</span>
              <span className="owner-branch-switcher-name">
                {assignedBranch?.name ||
                  managedBranches[0]?.name ||
                  'Chưa phân công'}
              </span>
            </div>
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
        <NotificationBell />
      </div>
    </header>
  );
}
