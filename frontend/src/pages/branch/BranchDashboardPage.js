import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Truck,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import BranchEmptyState from './settings/components/BranchEmptyState';
import RentalOrderDetailModal from '../orders/RentalOrderDetailModal';
import SaleOrderDetailModal from '../orders/SaleOrderDetailModal';
import { getBranchPerformanceReportApi } from '../../services/shopApi';
import { formatCurrency, formatDate, resolveOrderDisplayStatus } from '../orders/orderUtils';

import '../../styles/ShopDashboard.css';
import '../../styles/ShopBranches.css';
import '../../styles/BranchSettings.css';
import '../../styles/AdminDashboard.css';
import '../../styles/OrderMonitoring.css';
import '../../styles/BranchDashboard.css';

const TIME_RANGES = [
  { key: 'TODAY', label: 'Hôm nay' },
  { key: 'WEEK', label: 'Tuần này' },
  { key: 'MONTH', label: 'Tháng này' },
  { key: 'QUARTER', label: 'Quý này' },
  { key: 'YEAR', label: 'Năm nay' },
];

const ORDER_FILTERS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'RENTAL', label: 'Thuê' },
  { key: 'SALE', label: 'Bán' },
];

const formatOpeningHours = (hours) => {
  if (!hours) return '';
  if (typeof hours === 'string') return hours;
  return hours.open && hours.close ? `${hours.open} - ${hours.close}` : '';
};

const formatCountdown = (item) => {
  const hours = Math.abs(Number(item.hoursRemaining || 0));
  const label = hours >= 24 ? `${Math.ceil(hours / 24)} ngày` : `${Math.max(1, hours)} giờ`;
  return item.isOverdue ? `Quá hạn ${label}` : `Còn ${label}`;
};

export default function BranchDashboardPage() {
  const { user } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [timeRange, setTimeRange] = useState('MONTH');
  const [activeBranchId, setActiveBranchId] = useState(() => {
    try { return localStorage.getItem('vestora_active_branch_id') || ''; } catch { return ''; }
  });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('RECENT');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOrderModal, setActiveOrderModal] = useState(null);

  const userRole = String(user?.Role || user?.role || '').trim().toUpperCase();
  const isBranchManagerRole = ['BRANCH_MANAGER', 'BRAND_MANAGER'].includes(userRole);

  const loadDashboard = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const res = await getBranchPerformanceReportApi({ branchId: activeBranchId, timeRange });
      if (res?.success) {
        setReport(res.data || null);
      } else {
        setError(res?.message || 'Không thể tải dữ liệu tổng quan chi nhánh.');
      }
    } catch (err) {
      if ((err?.status === 403 || err?.status === 404) && activeBranchId) {
        try { localStorage.removeItem('vestora_active_branch_id'); } catch {}
        setActiveBranchId('');
      } else {
        setError(err?.message || 'Không thể kết nối máy chủ khi tải tổng quan chi nhánh.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeBranchId, timeRange]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const onBranchChanged = (e) => {
      setActiveBranchId(e?.detail?.branchId || localStorage.getItem('vestora_active_branch_id') || '');
    };
    window.addEventListener('vestora_branch_changed', onBranchChanged);
    return () => window.removeEventListener('vestora_branch_changed', onBranchChanged);
  }, []);

  const refresh = useCallback(() => loadDashboard({ silent: true }), [loadDashboard]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (report?.recentOrders || []).filter((order) => {
      if (typeFilter === 'RENTAL' && order.orderType !== 'rental') return false;
      if (typeFilter === 'SALE' && order.orderType !== 'sale') return false;
      if (!q) return true;
      return [order.orderCode, order.customer?.fullName, order.customer?.phone].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [report?.recentOrders, typeFilter, searchQuery]);

  const branch = report?.branch;
  const kpis = report?.kpis || {};
  const stock = report?.stockBreakdown || {};
  const ops = report?.operations || {};
  const revenueSeries = report?.revenueSeries || [];
  const upcomingReturns = report?.upcomingReturns || [];
  const topProducts = report?.topProducts || [];

  const isPositiveGrowth = typeof kpis.growthRate === 'number' && kpis.growthRate >= 0;
  const maxBucketTotal = Math.max(1, ...revenueSeries.map((b) => Number(b.totalRevenue || 0)));
  const stockDenom = Math.max(1, (stock.totalItems || 0) + (stock.rentingCount || 0));
  const availPct = Math.round(((stock.availableCount || 0) / stockDenom) * 100);
  const rentingPct = Math.round(((stock.rentingCount || 0) / stockDenom) * 100);
  const reservedPct = Math.round(((stock.reservedCount || 0) / stockDenom) * 100);
  const unavailPct = Math.max(0, 100 - availPct - rentingPct - reservedPct);

  const kpiCards = [
    {
      title: 'Doanh thu',
      icon: <Wallet size={17} />,
      iconClass: 'gold',
      value: formatCurrency(kpis.totalRevenue || 0),
      sub: (
        <>
          {kpis.hasGrowthBaseline && typeof kpis.growthRate === 'number' ? (
            <span className={`admin-kpi-trend ${isPositiveGrowth ? 'positive' : 'text-danger'}`}>
              {isPositiveGrowth ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {isPositiveGrowth ? `+${kpis.growthRate}%` : `${kpis.growthRate}%`}
            </span>
          ) : (
            <span>Kỳ tham chiếu đầu</span>
          )}
          <span>• Thuê {formatCurrency(kpis.rentalRevenue || 0)}</span>
        </>
      ),
    },
    {
      title: 'Đơn thuê',
      icon: <CalendarClock size={17} />,
      value: <>{kpis.rentalOrdersCount || 0} <span className="bd-kpi-unit">đơn</span></>,
      sub: (
        <>
          <span>{kpis.activeRentalsCount || 0} đang thuê</span>
          <span>•</span>
          <span className={kpis.overdueRentalsCount > 0 ? 'text-danger fw-semibold' : ''}>{kpis.overdueRentalsCount || 0} quá hạn</span>
        </>
      ),
    },
    {
      title: 'Đơn bán',
      icon: <ShoppingBag size={17} />,
      value: <>{kpis.salesOrdersCount || 0} <span className="bd-kpi-unit">đơn</span></>,
      sub: <><span>Bán {formatCurrency(kpis.salesRevenue || 0)}</span><span>•</span><span>Cọc {formatCurrency(kpis.heldDeposits || 0)}</span></>,
    },
    {
      title: 'Kho cửa hàng',
      icon: <Boxes size={17} />,
      value: <>{stock.availableCount || 0} <span className="bd-kpi-unit">/ {stock.totalItems || 0}</span></>,
      sub: <><span>{stock.rentingCount || 0} đang thuê</span><span>•</span><span>{stock.unavailableCount || 0} bảo trì</span></>,
    },
  ];

  const queueItems = [
    { label: 'Chờ xác nhận / bàn giao', count: ops.pendingHandoverCount || 0, to: '/branch/rental-orders', icon: <Clock size={14} />, tone: 'warn' },
    { label: 'Đơn thuê quá hạn trả', count: kpis.overdueRentalsCount || 0, to: '/branch/rental-orders', icon: <AlertTriangle size={14} />, tone: 'danger' },
    { label: 'Khiếu nại đang mở', count: ops.openDisputesCount || 0, to: '/branch/rental-orders', icon: <ShieldAlert size={14} />, tone: 'danger' },
    { label: 'Chuyển kho sắp về', count: ops.incomingTransfersToReceiveCount || 0, to: isBranchManagerRole ? '/branch/stock-requests' : '/branch/settings', icon: <PackageCheck size={14} />, tone: 'warn' },
    { label: 'Vận đơn giao thất bại', count: ops.failedShipmentsCount || 0, to: '/branch/sale-orders', icon: <Truck size={14} />, tone: 'danger' },
  ];

  const shortLocation = [branch?.ward, branch?.city].filter(Boolean).join(', ') || branch?.address || '';
  const hoursText = formatOpeningHours(branch?.openingHours);
  const openOrderModal = (order) => order?._id && setActiveOrderModal({ type: order.orderType === 'sale' ? 'sale' : 'rental', order });

  return (
    <div className="shop-dashboard-layout">
      <BranchSidebar isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed((p) => !p)} />
      <div className="admin-main-viewport">
        <OwnerTopHeader isSidebarCollapsed={isSidebarCollapsed} onToggleSidebar={() => setIsSidebarCollapsed((p) => !p)} breadcrumb="Tổng Quan Chi Nhánh" />
        <main className="shop-main-content">
          <div className="store-mgmt-container pb-5">
            {loading && !report ? (
              <div className="bd-loading-box">
                <Spinner animation="border" variant="dark" />
                <span>Đang tải tổng quan chi nhánh...</span>
              </div>
            ) : error ? (
              <div className="branch-empty-card">
                <div className="branch-empty-icon-wrap"><AlertCircle size={32} /></div>
                <h2 className="branch-empty-title">Không thể tải tổng quan chi nhánh</h2>
                <p className="branch-empty-desc">{error}</p>
                <div className="branch-empty-actions">
                  <button type="button" className="btn-tail-primary" onClick={refresh} disabled={refreshing}>
                    <RefreshCw size={15} className={refreshing ? 'bd-spin' : ''} /> Thử lại
                  </button>
                </div>
              </div>
            ) : !report?.hasAssignment || !branch ? (
              <BranchEmptyState onRetry={refresh} />
            ) : (
              <>
                <header className="bd-page-header">
                  <div>
                    <div className="store-mgmt-tag">TỔNG QUAN CHI NHÁNH</div>
                    <div className="d-flex align-items-center flex-wrap gap-2">
                      <h1 className="store-mgmt-title">{branch.name || 'Chi nhánh Vestora'}</h1>
                      <span className={`store-pill-active ${branch.status === 'ACTIVE' ? '' : 'inactive'}`}>
                        {branch.status === 'ACTIVE' ? 'Đang hoạt động' : branch.status || 'Tạm ngưng'}
                      </span>
                      {branch.isHQ && <span className="branch-badge-hq">HQ</span>}
                    </div>
                    <div className="bd-meta-line">
                      {shortLocation && <span className="bd-meta-item"><MapPin size={13} />{shortLocation}</span>}
                      {hoursText && <><span className="bd-meta-sep">•</span><span className="bd-meta-item"><Clock size={13} />{hoursText}</span></>}
                      {branch.phone && <><span className="bd-meta-sep">•</span><span className="bd-meta-item"><Phone size={13} />{branch.phone}</span></>}
                      <span className="bd-meta-sep">•</span>
                      <span>
                        {report.storeLocation
                          ? `Kho cửa hàng: ${report.storeLocation.name}${report.locationsCount > 1 ? ` (+${report.locationsCount - 1})` : ''}`
                          : 'Chưa gắn kho cửa hàng'}
                      </span>
                    </div>
                  </div>

                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <div className="taskbar-status-segmented" role="group" aria-label="Bộ lọc thời gian báo cáo">
                      {TIME_RANGES.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          className={`taskbar-status-btn ${timeRange === item.key ? 'active' : ''}`}
                          onClick={() => setTimeRange(item.key)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" className="taskbar-refresh-btn" onClick={refresh} disabled={refreshing} aria-label="Làm mới số liệu" title="Làm mới số liệu">
                      <RefreshCw size={15} className={refreshing ? 'bd-spin' : ''} />
                    </button>
                    <Link to="/branch/rental-orders" className="btn-tail-primary text-decoration-none">
                      <Sparkles size={15} /> Đơn thuê
                    </Link>
                  </div>
                </header>

                {report.notice && (
                  <div className={`bd-notice-ribbon ${report.notice.severity === 'danger' ? 'danger' : ''}`} role="status">
                    <div className="d-flex align-items-center gap-2">
                      <AlertTriangle size={15} className="flex-shrink-0" />
                      <strong>{report.notice.title}</strong>
                    </div>
                    <Link to={report.notice.actionPath} className="bd-notice-link">
                      {report.notice.actionLabel} <ArrowRight size={14} />
                    </Link>
                  </div>
                )}

                <section className="admin-kpi-grid" aria-label="Chỉ số tổng quan chi nhánh">
                  {kpiCards.map((card) => (
                    <article key={card.title} className="admin-kpi-card">
                      <div className="admin-kpi-header">
                        <span className="admin-kpi-title">{card.title}</span>
                        <span className={`admin-kpi-icon-pill ${card.iconClass || ''}`}>{card.icon}</span>
                      </div>
                      <div className="admin-kpi-value">{card.value}</div>
                      <div className="bd-kpi-sub">{card.sub}</div>
                    </article>
                  ))}
                </section>

                <section className="bd-grid-main" aria-label="Biểu đồ doanh thu và vận hành chi nhánh">
                  <article className="admin-card bd-card">
                    <div className="bd-card-header">
                      <div>
                        <h2 className="bd-card-title"><BarChart3 size={16} /> Doanh thu Bán &amp; Thuê</h2>
                        <p className="bd-card-subtitle">Biến động doanh thu thực theo từng mốc thời gian</p>
                      </div>
                      <div className="bd-chart-legend">
                        <span><span className="bd-legend-dot rental" />Thuê</span>
                        <span><span className="bd-legend-dot sale" />Bán</span>
                      </div>
                    </div>

                    <div className="bd-chart-area" role="img" aria-label="Biểu đồ doanh thu theo thời gian">
                      {revenueSeries.map((bucket) => {
                        const total = Number(bucket.totalRevenue || 0);
                        const totalPct = total > 0 ? Math.max(8, Math.round((total / maxBucketTotal) * 100)) : 0;
                        const rentalRev = Number(bucket.rentalRevenue || 0);
                        const salesRev = Number(bucket.salesRevenue || 0);
                        const rentalSharePct = rentalRev > 0 && salesRev > 0 ? Math.min(96, Math.max(4, Math.round((rentalRev / total) * 100))) : rentalRev > 0 ? 100 : 0;
                        const saleSharePct = salesRev > 0 ? 100 - rentalSharePct : 0;

                        return (
                          <div key={bucket.key} className="bd-chart-col">
                            <div className="bd-chart-tooltip">
                              <div className="fw-bold">{bucket.fullLabel}</div>
                              <div>Tổng: {formatCurrency(total)}</div>
                              <div>Thuê: {formatCurrency(rentalRev)} ({bucket.rentalCount})</div>
                              <div>Bán: {formatCurrency(salesRev)} ({bucket.salesCount})</div>
                            </div>
                            <div className="bd-chart-stack">
                              {total === 0 ? <div className="bd-bar-seg empty" /> : (
                                <div className="bd-chart-fill-column" style={{ height: `${totalPct}%` }}>
                                  {rentalSharePct > 0 && <div className="bd-bar-seg rental" style={{ height: `${rentalSharePct}%` }} />}
                                  {saleSharePct > 0 && <div className="bd-bar-seg sale" style={{ height: `${saleSharePct}%` }} />}
                                </div>
                              )}
                            </div>
                            <span className="chart-bar-label">{bucket.label}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="bd-chart-footer">
                      <span>Tổng trong kỳ: <strong className="text-dark">{formatCurrency(kpis.totalRevenue || 0)}</strong></span>
                      <span>Thuê <strong>{formatCurrency(kpis.rentalRevenue || 0)}</strong> • Bán <strong>{formatCurrency(kpis.salesRevenue || 0)}</strong></span>
                    </div>
                  </article>

                  <article className="admin-card bd-card">
                    <div className="bd-card-header mb-2">
                      <div>
                        <h2 className="bd-card-title">Kho cửa hàng &amp; Tác vụ</h2>
                        <p className="bd-card-subtitle">Tồn kho tại cửa hàng của chi nhánh (không gồm kho tổng)</p>
                      </div>
                      {isBranchManagerRole && <Link to="/branch/inventory" className="bd-link-subtle">Kho hàng <ChevronRight size={14} /></Link>}
                    </div>

                    <div className="bd-stock-bar" aria-label="Tỷ trọng tồn kho">
                      <div className="bd-stock-seg-avail" style={{ width: `${availPct}%` }} />
                      <div className="bd-stock-seg-renting" style={{ width: `${rentingPct}%` }} />
                      <div className="bd-stock-seg-reserved" style={{ width: `${reservedPct}%` }} />
                      <div className="bd-stock-seg-unavail" style={{ width: `${unavailPct}%` }} />
                    </div>
                    <div className="bd-stock-inline-stats">
                      <span>Sẵn sàng <strong>{stock.availableCount || 0}</strong></span>
                      <span>Đang thuê <strong>{stock.rentingCount || 0}</strong></span>
                      <span>Giữ chỗ/Bảo trì <strong>{(stock.reservedCount || 0) + (stock.unavailableCount || 0)}</strong></span>
                    </div>

                    <div className="bd-section-micro-label">Đầu việc vận hành</div>
                    <div>
                      {queueItems.map((item) => (
                        <Link key={item.label} to={item.to} className="bd-flat-row">
                          <span className="d-inline-flex align-items-center gap-2">{item.icon}<span>{item.label}</span></span>
                          <span className={`bd-count-pill ${item.count > 0 ? item.tone : ''}`}>{item.count}</span>
                        </Link>
                      ))}
                    </div>
                  </article>
                </section>

                <section className="bd-grid-main" aria-label="Đơn hàng và sản phẩm nổi bật">
                  <article className="admin-card bd-card">
                    <div className="bd-card-header">
                      <div className="taskbar-status-segmented" role="tablist">
                        <button type="button" role="tab" aria-selected={activeTab === 'RECENT'} className={`taskbar-status-btn ${activeTab === 'RECENT' ? 'active' : ''}`} onClick={() => setActiveTab('RECENT')}>
                          Đơn gần đây ({(report?.recentOrders || []).length})
                        </button>
                        <button type="button" role="tab" aria-selected={activeTab === 'RETURNS'} className={`taskbar-status-btn ${activeTab === 'RETURNS' ? 'active' : ''}`} onClick={() => setActiveTab('RETURNS')}>
                          Sắp đến hạn trả
                          {upcomingReturns.length > 0 && <span className="status-segment-count">{upcomingReturns.length}</span>}
                        </button>
                      </div>

                      {activeTab === 'RECENT' && (
                        <div className="taskbar-status-segmented">
                          {ORDER_FILTERS.map((f) => (
                            <button key={f.key} type="button" className={`taskbar-status-btn ${typeFilter === f.key ? 'active' : ''}`} onClick={() => setTypeFilter(f.key)}>
                              {f.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {activeTab === 'RECENT' ? (
                      <>
                        <div className="bd-search-wrap">
                          <Search size={13} className="bd-search-icon" />
                          <input type="text" className="bd-search-input" placeholder="Tìm mã đơn, tên hoặc SĐT khách..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                        {filteredOrders.length === 0 ? (
                          <div className="bd-empty-panel"><ShoppingBag size={20} /><span>Chưa có đơn hàng phù hợp với bộ lọc.</span></div>
                        ) : (
                          <div className="order-table-responsive">
                            <table className="order-table">
                              <thead><tr><th>Đơn hàng</th><th>Khách hàng</th><th>Giá trị</th><th>Trạng thái</th><th className="text-end">Xem</th></tr></thead>
                              <tbody>
                                {filteredOrders.map((order) => {
                                  const isRental = order.orderType === 'rental';
                                  const statusDef = resolveOrderDisplayStatus(order, order.orderType, true);
                                  return (
                                    <tr key={`${order.orderType}-${order._id}`}>
                                      <td>
                                        <div className="order-code-title">{order.orderCode}</div>
                                        <div className="order-code-date">{isRental ? 'Thuê' : 'Bán'} • {formatDate(order.createdAt)}</div>
                                      </td>
                                      <td>
                                        <div className="order-customer-name">{order.customer?.fullName || 'Khách vãng lai'}</div>
                                        <div className="order-customer-sub">{order.customer?.phone || 'Chưa có SĐT'}</div>
                                      </td>
                                      <td>
                                        <div className="order-fee-primary">{formatCurrency(isRental ? order.rentalFee : order.totalAmount)}</div>
                                        {isRental && order.depositAmount > 0 && <div className="order-code-date">Cọc {formatCurrency(order.depositAmount)}</div>}
                                      </td>
                                      <td><span className={`order-badge ${statusDef.chipClass}`}><span className="order-badge-dot" />{statusDef.text}</span></td>
                                      <td className="text-end">
                                        <button type="button" className="order-action-btn" onClick={() => openOrderModal(order)}><Eye size={14} /> Chi tiết</button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    ) : upcomingReturns.length === 0 ? (
                      <div className="bd-empty-panel"><CheckCircle2 size={22} className="text-success" /><span>Không có đơn thuê nào quá hạn hoặc đến hạn trả trong 48 giờ tới.</span></div>
                    ) : (
                      <div className="order-table-responsive">
                        <table className="order-table">
                          <thead><tr><th>Đơn thuê</th><th>Khách hàng</th><th>Hạn trả</th><th>Tình trạng</th><th className="text-end">Xem</th></tr></thead>
                          <tbody>
                            {upcomingReturns.map((order) => (
                              <tr key={order._id}>
                                <td><div className="order-code-title">{order.orderCode}</div><div className="order-code-date">{formatCurrency(order.rentalFee)}</div></td>
                                <td><div className="order-customer-name">{order.customer?.fullName}</div><div className="order-customer-sub">{order.customer?.phone || 'Chưa có SĐT'}</div></td>
                                <td><div className="order-period-text">{formatDate(order.dueDate)}</div></td>
                                <td><span className={`order-badge ${order.isOverdue ? 'overdue' : 'renting'}`}><span className="order-badge-dot" />{formatCountdown(order)}</span></td>
                                <td className="text-end">
                                  <button type="button" className="order-action-btn" onClick={() => openOrderModal(order)}><Eye size={14} /> Chi tiết</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="bd-card-footer-links">
                      <Link to="/branch/rental-orders" className="bd-link-subtle">Tất cả đơn thuê <ChevronRight size={14} /></Link>
                      <Link to="/branch/sale-orders" className="bd-link-subtle">Tất cả đơn bán <ChevronRight size={14} /></Link>
                    </div>
                  </article>

                  <article className="admin-card bd-card">
                    <div className="bd-card-header">
                      <div>
                        <h2 className="bd-card-title"><Award size={16} /> Sản phẩm nổi bật</h2>
                        <p className="bd-card-subtitle">Doanh thu bán &amp; thuê cao nhất kỳ tại chi nhánh</p>
                      </div>
                      <Link to="/branch/analytics" className="bd-link-subtle">Phân tích <ChevronRight size={14} /></Link>
                    </div>

                    {topProducts.length === 0 ? (
                      <div className="bd-empty-panel flex-grow-1"><Award size={20} /><span>Chưa phát sinh đơn sản phẩm nào trong kỳ này.</span></div>
                    ) : (
                      <div>
                        {topProducts.map((item, idx) => (
                          <div key={item.productId || idx} className="bd-product-row">
                            <div className="d-flex align-items-center gap-2 min-w-0">
                              {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="bd-product-thumb" /> : <div className="bd-product-thumb-fallback">#{idx + 1}</div>}
                              <div className="min-w-0">
                                <div className="bd-product-name" title={item.name}>{item.name}</div>
                                <div className="order-code-date">Thuê {item.rentalCount || 0} • Bán {item.salesCount || 0} • {item.orderCount || 0} đơn</div>
                              </div>
                            </div>
                            <div className="fw-bold text-nowrap small">{formatCurrency(item.revenue || 0)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                </section>
              </>
            )}
          </div>
        </main>
      </div>

      <RentalOrderDetailModal
        isOpen={activeOrderModal?.type === 'rental'}
        onClose={() => setActiveOrderModal(null)}
        orderId={activeOrderModal?.type === 'rental' ? activeOrderModal?.order?._id : null}
        initialOrder={activeOrderModal?.type === 'rental' ? activeOrderModal?.order : null}
        isReadOnly={!isBranchManagerRole}
        onAction={refresh}
      />

      <SaleOrderDetailModal
        isOpen={activeOrderModal?.type === 'sale'}
        onClose={() => setActiveOrderModal(null)}
        orderId={activeOrderModal?.type === 'sale' ? activeOrderModal?.order?._id : null}
        initialOrder={activeOrderModal?.type === 'sale' ? activeOrderModal?.order : null}
        isReadOnly={!isBranchManagerRole}
        onAction={refresh}
      />
    </div>
  );
}
