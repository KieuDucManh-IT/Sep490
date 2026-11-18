import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileBarChart2,
  Layers3,
  LogOut,
  MapPin,
  MoveRight,
  Package,
  RotateCcw,
  SlidersHorizontal,
  Tags,
  Truck,
  Warehouse,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import stockDiscrepancyService, { DISCREPANCY_CHANGED_EVENT } from '../services/warehouse/stockDiscrepancyService';
import '../styles/ShopDashboard.css';
import '../styles/WarehouseManager.css';
import '../styles/WarehouseUx.css';
import '../styles/WarehouseShared.css';

const COLLAPSED_KEY = 'vestora_warehouse_sidebar_collapsed';
const DISCREPANCY_PATH = '/warehousemanager/discrepancies';
// Mỗi trang kho tự gắn sidebar nên sidebar được mount lại khi đổi trang.
// Giữ số đếm trong bộ nhớ một lúc để không gọi API ở mỗi lần đổi trang.
const COUNT_CACHE_MS = 60 * 1000;
let cachedDiscrepancyCount = null;
let cachedDiscrepancyAt = 0;

const MANAGER_NAV_GROUPS = [
  {
    id: 'masterdata',
    title: 'DANH MỤC',
    items: [
      { path: '/warehousemanager/inventory-locations', label: 'Kho / cửa hàng', icon: Warehouse, desc: 'Kho tổng và các cửa hàng chi nhánh' },
      { path: '/warehousemanager/storage-locations', label: 'Vị trí lưu trữ', icon: MapPin, desc: 'Khu, dãy, kệ trong kho' },
      { path: '/warehousemanager/categories', label: 'Loại sản phẩm', icon: Tags, desc: 'Cây loại sản phẩm 3 cấp' },
      { path: '/warehousemanager/products', label: 'Sản phẩm', icon: Package, desc: 'Sản phẩm và biến thể' },
      { path: '/warehousemanager/suppliers', label: 'Nhà cung cấp', icon: Truck, desc: 'Danh sách nhà cung cấp' },
    ],
  },
  {
    id: 'slips',
    title: 'PHIẾU KHO',
    items: [
      { path: '/warehousemanager/inbound-receipts', label: 'Nhập kho', icon: ArrowDownToLine, desc: 'Phiếu nhập hàng vào kho tổng' },
      { path: '/warehousemanager/outbound', label: 'Xuất kho sang chi nhánh', icon: ArrowUpFromLine, desc: 'Duyệt và theo dõi phiếu xuất cho chi nhánh' },
      { path: '/warehousemanager/branch-returns', label: 'Hàng trả từ chi nhánh', icon: RotateCcw, desc: 'Phiếu chi nhánh trả hàng về kho tổng' },
      { path: DISCREPANCY_PATH, label: 'Chênh lệch điều chuyển', icon: AlertTriangle, desc: 'Hàng thiếu hoặc hỏng khi điều chuyển' },
      { path: '/warehousemanager/stocktakes', label: 'Kiểm kê', icon: ClipboardCheck, desc: 'Tạo và duyệt phiếu kiểm kê' },
      { path: '/warehousemanager/adjustments', label: 'Điều chỉnh tồn', icon: SlidersHorizontal, desc: 'Duyệt phiếu điều chỉnh tồn kho' },
      { path: '/warehousemanager/relocations/split', label: 'Tách tồn', icon: MoveRight, desc: 'Tách hàng từ một vị trí sang nhiều vị trí' },
      { path: '/warehousemanager/relocations/merge', label: 'Gộp tồn', icon: Layers3, desc: 'Gộp hàng từ nhiều vị trí về một vị trí' },
      { path: '/warehousemanager/maintenance', label: 'Giặt / sửa / thanh lý', icon: Wrench, desc: 'Phiếu giặt, sửa và đề xuất thanh lý' },
    ],
  },
  {
    id: 'reports',
    title: 'BÁO CÁO',
    items: [
      { path: '/warehousemanager/reports/inventory', label: 'Tồn kho', icon: FileBarChart2, desc: 'Báo cáo tồn kho theo vị trí' },
      // Menu "Lịch sử giao dịch" tạm ẩn: màn thẻ kho làm ở task khác, route vẫn giữ trong App.js.
    ],
  },
];

const STAFF_NAV_GROUPS = [
  {
    id: 'operations',
    title: 'NGHIỆP VỤ KHO',
    items: [
      { path: '/warehousestaff/inbound-receipts', label: 'Kiểm tra hàng nhập', icon: ArrowDownToLine, desc: 'Tiếp nhận và kiểm hàng nhập kho' },
      { path: '/warehousestaff/outbound', label: 'Soạn hàng xuất kho', icon: ArrowUpFromLine, desc: 'Soạn hàng cho phiếu xuất đã duyệt' },
      { path: '/warehousestaff/branch-returns', label: 'Nhận hàng trả từ chi nhánh', icon: RotateCcw, desc: 'Kiểm nhận hàng chi nhánh trả về' },
      { path: '/warehousestaff/relocations', label: 'Di chuyển được giao', icon: MoveRight, desc: 'Phiếu tách / gộp tồn được giao' },
      { path: '/warehousestaff/stocktakes', label: 'Kiểm kê được giao', icon: ClipboardCheck, desc: 'Đếm hàng theo phiếu kiểm kê' },
      { path: '/warehousestaff/maintenance', label: 'Giặt / sửa được giao', icon: Wrench, desc: 'Thực hiện phiếu giặt / sửa' },
    ],
  },
  {
    id: 'reports',
    title: 'BÁO CÁO',
    items: [
      { path: '/warehousestaff/reports/inventory', label: 'Tồn kho', icon: FileBarChart2, desc: 'Báo cáo tồn kho theo vị trí' },
    ],
  },
];

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveCollapsed(value) {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(value));
  } catch {
    // Trình duyệt chặn localStorage: chỉ không nhớ được trạng thái, sidebar vẫn chạy.
  }
}

/**
 * Đếm phiếu chênh lệch đang mở. Lỗi (kể cả 404 khi backend chưa có API đếm) thì trả null để ẩn số.
 * @param {boolean} force bỏ qua bộ nhớ tạm, luôn gọi API
 */
async function loadOpenDiscrepancyCount(force) {
  const cacheIsFresh = Date.now() - cachedDiscrepancyAt < COUNT_CACHE_MS;
  if (!force && cachedDiscrepancyAt > 0 && cacheIsFresh) return cachedDiscrepancyCount;
  try {
    cachedDiscrepancyCount = await stockDiscrepancyService.count('open');
  } catch {
    cachedDiscrepancyCount = null;
  }
  cachedDiscrepancyAt = Date.now();
  return cachedDiscrepancyCount;
}

/** Viên đếm phiếu chênh lệch đang mở (chỉ có ở sidebar Quản lý kho). */
function useOpenDiscrepancyCount(enabled) {
  const [count, setCount] = useState(enabled ? cachedDiscrepancyCount : null);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    const refresh = async (force) => {
      const value = await loadOpenDiscrepancyCount(force);
      if (active) setCount(value);
    };
    const handleChanged = () => refresh(true);

    refresh(false);
    window.addEventListener(DISCREPANCY_CHANGED_EVENT, handleChanged);
    return () => {
      active = false;
      window.removeEventListener(DISCREPANCY_CHANGED_EVENT, handleChanged);
    };
  }, [enabled]);

  if (!enabled) return null;
  return count;
}

function formatCount(count) {
  if (count > 99) return '99+';
  return String(count);
}

/**
 * Sidebar phân hệ kho, cùng giao diện với sidebar Quản lý chi nhánh.
 * @param {object} props
 * @param {'manager'|'staff'} [props.mode='manager'] menu của Quản lý kho hay Nhân viên kho
 */
export default function WarehouseSidebar({ mode = 'manager' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const isManager = mode !== 'staff';
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);
  const openDiscrepancies = useOpenDiscrepancyCount(isManager);

  const navGroups = isManager ? MANAGER_NAV_GROUPS : STAFF_NAV_GROUPS;
  const homePath = isManager ? '/warehousemanager' : '/warehousestaff/inbound-receipts';
  const roleLabel = isManager ? 'Quản lý kho' : 'Nhân viên kho';

  const userName = useMemo(() => {
    return user?.FullName || user?.fullName || user?.name || roleLabel;
  }, [user, roleLabel]);
  const userInitial = userName.charAt(0).toUpperCase();

  const handleToggle = useCallback(() => {
    setIsCollapsed((previous) => {
      const next = !previous;
      saveCollapsed(next);
      return next;
    });
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }, [logout, navigate]);

  const isActive = (path) => {
    if (location.pathname === path) return true;
    return location.pathname.startsWith(`${path}/`);
  };

  const renderCount = (path) => {
    if (path !== DISCREPANCY_PATH) return null;
    if (!openDiscrepancies || openDiscrepancies <= 0) return null;
    if (isCollapsed) return <span className="wh-sidebar-count-dot" aria-hidden="true" />;
    return <span className="wh-sidebar-count" aria-label={`${openDiscrepancies} phiếu đang mở`}>{formatCount(openDiscrepancies)}</span>;
  };

  const renderItem = (item) => {
    const active = isActive(item.path);
    const Icon = item.icon;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`sidebar-nav-item ${active ? 'active' : ''}`}
        title={isCollapsed ? `${item.label} - ${item.desc}` : item.desc}
        aria-current={active ? 'page' : undefined}
      >
        <div className="sidebar-nav-item-content">
          <span className="sidebar-nav-icon wh-sidebar-icon-wrap">
            <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
            {isCollapsed && renderCount(item.path)}
          </span>
          {!isCollapsed && <span className="sidebar-nav-label text-truncate">{item.label}</span>}
        </div>
        {!isCollapsed && (
          <div className="sidebar-nav-item-right">
            {renderCount(item.path)}
            <ChevronRight size={13} className={`sidebar-nav-arrow ${active ? 'active' : ''}`} />
          </div>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={`shop-sidebar ${isCollapsed ? 'collapsed' : ''}`}
      role="navigation"
      aria-label={`Thanh điều hướng ${roleLabel}`}
    >
      <div className="shop-sidebar-inner">
        <div className="shop-brand-badge">
          <div className="shop-brand-left">
            <Link to={homePath} className="shop-brand-link" title={`VESTORA ${roleLabel}`}>
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

        <div className={`shop-branch-card ${isCollapsed ? 'collapsed' : ''}`} title={`${userName} • ${roleLabel}`}>
          <div className="shop-branch-avatar-container">
            {user?.avatar ? (
              <img src={user.avatar} alt={userName} className="shop-branch-avatar-img" />
            ) : (
              <div className="shop-branch-avatar-circle">
                <span>{userInitial}</span>
              </div>
            )}
            <span className="shop-branch-status-dot online" />
          </div>
          {!isCollapsed && (
            <div className="shop-branch-info-box">
              <div className="shop-branch-manager-name" title={userName}>{userName}</div>
              <div className="shop-owner-role-tag in-card" title={roleLabel}>
                <span className="text-truncate">{roleLabel}</span>
              </div>
            </div>
          )}
        </div>

        <nav className="shop-nav-menu">
          {navGroups.map((group) => (
            <div key={group.id} className="shop-nav-group">
              {isCollapsed ? (
                <div className="sidebar-section-divider-dot" />
              ) : (
                <div className="sidebar-section-label">{group.title}</div>
              )}
              {group.items.map(renderItem)}
            </div>
          ))}
        </nav>

        <div className="shop-sidebar-footer">
          <button
            type="button"
            onClick={handleLogout}
            className="shop-sidebar-btn-logout"
            title={isCollapsed ? 'Đăng xuất khỏi hệ thống' : undefined}
          >
            <span className="sidebar-nav-icon logout-icon">
              <LogOut size={17} strokeWidth={1.8} />
            </span>
            {!isCollapsed && <span className="sidebar-nav-label">Đăng xuất</span>}
          </button>
        </div>
      </div>
    </aside>
  );
}
