import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Download,
  Printer,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Wallet,
  ShoppingBag,
  Package,
  AlertTriangle,
  Clock,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ArrowRight,
  MapPin,
  Building2,
  Layers,
  Award,
  Phone,
  Shirt,
  ShieldAlert,
  X,
} from 'lucide-react';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import { getBranchPerformanceReportApi } from '../../services/shopApi';
import '../../styles/ShopDashboard.css';
import '../../styles/BranchAnalytics.css';

const PRESET_OPTIONS = [
  { key: 'TODAY', label: 'Hôm nay' },
  { key: 'WEEK', label: 'Tuần này' },
  { key: 'MONTH', label: 'Tháng này' },
  { key: 'QUARTER', label: 'Quý này' },
  { key: 'YEAR', label: 'Năm nay' },
  { key: 'CUSTOM', label: 'Tùy chỉnh' },
];

const RENTAL_STATUS_LABELS = [
  { key: 'confirmed', label: 'Chờ giao' },
  { key: 'renting', label: 'Đang thuê' },
  { key: 'partially_returned', label: 'Trả một phần' },
  { key: 'overdue', label: 'Quá hạn', alert: true },
  { key: 'returned', label: 'Đã hoàn tất' },
  { key: 'cancelled', label: 'Đã hủy' },
];

const SALES_STATUS_LABELS = [
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'processing', label: 'Đang chuẩn bị' },
  { key: 'shipped', label: 'Đang giao' },
  { key: 'completed', label: 'Hoàn tất' },
  { key: 'cancelled', label: 'Đã hủy' },
];

const ISSUE_TYPE_LABELS = {
  OVERDUE: 'Trễ hạn trả đồ',
  DAMAGE_DISPUTE: 'Khiếu nại / Hư hỏng',
  FAILED_SHIPMENT: 'Giao vận thất bại',
};

function formatVnd(amount) {
  const num = Number(amount || 0);
  return `${new Intl.NumberFormat('vi-VN').format(Math.round(num))} ₫`;
}

function formatDateVi(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTimeVi(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}/${mo}`;
}

function getLocalDateInputValue(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getOptimizedImageUrl(url) {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('res.cloudinary.com') && url.includes('/upload/') && !url.includes('f_auto')) {
    return url.replace('/upload/', '/upload/f_auto,q_auto,w_360/');
  }
  return url;
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str) && typeof value === 'string') {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCsvContent(report) {
  const rows = [];
  const pushRow = (...cells) => rows.push(cells.map(escapeCsvCell).join(','));

  pushRow('BÁO CÁO HIỆU SUẤT & VẬN HÀNH CHI NHÁNH - VESTORA');
  pushRow('Chi nhánh', report.branchInfo?.name || 'Chưa phân công');
  pushRow('Kho cửa hàng', report.storeLocation ? `${report.storeLocation.name} (${report.storeLocation.code})` : 'Chưa thiết lập');
  pushRow('Kỳ báo cáo', `${formatDateVi(report.timeRange?.startDate)} - ${formatDateVi(report.timeRange?.endDate)}`);
  pushRow();

  pushRow('CHỈ SỐ TỔNG QUAN (KPI)');
  pushRow('Tổng doanh thu (VND)', report.kpi?.totalRevenue || 0);
  pushRow('Doanh thu thuê (VND)', report.kpi?.rentalRevenue || 0);
  pushRow('Doanh thu bán đứt (VND)', report.kpi?.salesRevenue || 0);
  pushRow(
    'Tăng trưởng so với kỳ trước (%)',
    report.kpi?.hasGrowthBaseline ? `${report.kpi.growthRate}%` : 'Chưa có dữ liệu kỳ trước'
  );
  pushRow('Tiền cọc đang tạm giữ (VND)', report.kpi?.heldDeposits || 0);
  pushRow('Tổng đơn hợp lệ', report.kpi?.totalOrdersCount || 0);
  pushRow('Tỷ lệ xoay vòng', `${report.kpi?.turnoverRate || 0} lượt/đơn vị`);
  pushRow();

  pushRow('DIỄN BIẾN DOANH THU THEO KỲ');
  pushRow('Mốc thời gian', 'Doanh thu thuê', 'Doanh thu bán', 'Tổng doanh thu', 'Số đơn thuê', 'Số đơn bán');
  (report.revenueSeries || []).forEach((item) => {
    pushRow(
      item.fullLabel || item.label,
      item.rentalRevenue || 0,
      item.salesRevenue || 0,
      item.totalRevenue || 0,
      item.rentalCount || 0,
      item.salesCount || 0
    );
  });
  pushRow();

  pushRow('TOP SẢN PHẨM DOANH THU CAO');
  pushRow('Sản phẩm', 'Danh mục', 'Lượt thuê', 'Lượt bán', 'Số đơn', 'Doanh thu (VND)');
  (report.topProducts || []).forEach((prod) => {
    pushRow(prod.name, prod.category, prod.rentalCount, prod.salesCount, prod.orderCount, prod.revenue);
  });
  pushRow();

  pushRow('LỊCH ĐỒ SẮP HOÀN TRẢ (48H)');
  pushRow('Mã đơn', 'Khách hàng', 'Số điện thoại', 'Trang phục', 'Hạn trả', 'Tiền cọc (VND)');
  (report.upcomingReturns || []).forEach((item) => {
    pushRow(
      item.orderCode,
      item.customerName,
      item.customerPhone || '—',
      item.productName,
      formatDateTimeVi(item.dueDate),
      item.depositAmount || 0
    );
  });
  pushRow();

  pushRow('CẢNH BÁO SỰ CỐ VẬN HÀNH');
  pushRow('Loại sự cố', 'Mã tham chiếu', 'Khách hàng', 'Mức độ', 'Chi tiết');
  (report.operationalIssues || []).forEach((issue) => {
    pushRow(
      ISSUE_TYPE_LABELS[issue.type] || issue.type,
      issue.orderCode,
      issue.customerName,
      issue.severity,
      issue.detail
    );
  });

  return `${String.fromCharCode(0xfeff)}${rows.join('\r\n')}`;
}

export default function BranchAnalyticsPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [activeBranchId, setActiveBranchId] = useState(() => {
    try {
      return localStorage.getItem('vestora_active_branch_id') || '';
    } catch {
      return '';
    }
  });

  const [timeRange, setTimeRange] = useState('MONTH');
  const [appliedCustomRange, setAppliedCustomRange] = useState({ startDate: '', endDate: '' });
  const [customStartInput, setCustomStartInput] = useState(() => {
    const now = new Date();
    return getLocalDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [customEndInput, setCustomEndInput] = useState(() => getLocalDateInputValue(new Date()));

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedSeriesIdx, setSelectedSeriesIdx] = useState(null);
  const [toast, setToast] = useState(null);

  const toastTimerRef = useRef(null);
  const abortRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);

  const showToast = useCallback((message, type = 'info') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ id: Date.now(), message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Đồng bộ khi Branch Manager chuyển chi nhánh trên OwnerTopHeader
  useEffect(() => {
    const handleBranchChanged = (e) => {
      const nextId = e.detail?.branchId || e.detail?.branch?._id || '';
      setActiveBranchId(String(nextId || ''));
    };

    const handleStorage = (e) => {
      if (e.key === 'vestora_active_branch_id') {
        setActiveBranchId(e.newValue || '');
      }
    };

    window.addEventListener('vestora_branch_changed', handleBranchChanged);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('vestora_branch_changed', handleBranchChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const fetchReport = useCallback(
    async ({ isManualRefresh = false } = {}) => {
      if (timeRange === 'CUSTOM' && (!appliedCustomRange.startDate || !appliedCustomRange.endDate)) {
        return;
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      if (!hasLoadedOnceRef.current) {
        setLoading(true);
      }
      setRefreshing(true);
      setErrorMsg('');

      try {
        const res = await getBranchPerformanceReportApi(
          {
            branchId: activeBranchId || undefined,
            timeRange,
            startDate: timeRange === 'CUSTOM' ? appliedCustomRange.startDate : undefined,
            endDate: timeRange === 'CUSTOM' ? appliedCustomRange.endDate : undefined,
          },
          { signal: controller.signal }
        );

        if (res?.success && res.data) {
          hasLoadedOnceRef.current = true;
          setReport(res.data);
          setSelectedSeriesIdx(null);
          if (isManualRefresh) {
            showToast('Đã cập nhật số liệu báo cáo chi nhánh mới nhất.', 'info');
          }
        } else {
          setErrorMsg(res?.message || 'Không thể tải báo cáo hiệu suất chi nhánh.');
        }
      } catch (err) {
        if (err?.name === 'AbortError' || controller.signal.aborted) return;
        const message = err.message || 'Không thể tải báo cáo hiệu suất chi nhánh.';
        setErrorMsg(message);
        showToast(message, 'error');
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [activeBranchId, timeRange, appliedCustomRange.startDate, appliedCustomRange.endDate, showToast]
  );

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleSelectPreset = (presetKey) => {
    if (presetKey === 'CUSTOM') {
      setTimeRange('CUSTOM');
      if (customStartInput && customEndInput && customStartInput <= customEndInput) {
        setAppliedCustomRange({ startDate: customStartInput, endDate: customEndInput });
      }
      return;
    }
    setTimeRange(presetKey);
  };

  const handleApplyCustomRange = (e) => {
    e.preventDefault();
    if (!customStartInput || !customEndInput) {
      showToast('Vui lòng chọn đầy đủ ngày bắt đầu và ngày kết thúc.', 'warning');
      return;
    }
    if (customStartInput > customEndInput) {
      showToast('Ngày bắt đầu không được lớn hơn ngày kết thúc.', 'warning');
      return;
    }
    setTimeRange('CUSTOM');
    setAppliedCustomRange({ startDate: customStartInput, endDate: customEndInput });
  };

  const handleExportCsv = () => {
    if (!report || !report.hasAssignment) {
      showToast('Chưa có dữ liệu báo cáo để xuất CSV.', 'warning');
      return;
    }
    try {
      const csv = buildCsvContent(report);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      const branchSlug = String(report.branchInfo?.name || 'chi-nhanh')
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '');
      const dateTag = getLocalDateInputValue(new Date());
      anchor.href = url;
      anchor.download = `vestora-bao-cao-${branchSlug || 'chi-nhanh'}-${dateTag}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showToast('Đã xuất tệp CSV báo cáo hiệu suất chi nhánh.', 'info');
    } catch {
      showToast('Không thể tạo tệp CSV. Vui lòng thử lại.', 'error');
    }
  };

  const handlePrintPdf = () => {
    if (!report || !report.hasAssignment) {
      showToast('Chưa có dữ liệu báo cáo để in hoặc lưu PDF.', 'warning');
      return;
    }
    showToast('Đang mở giao diện in hoặc lưu PDF báo cáo chi nhánh.', 'info');
    window.print();
  };

  const kpi = report?.kpi || {};
  const totalRevenue = Number(kpi.totalRevenue || 0);
  const rentalRevenue = Number(kpi.rentalRevenue || 0);
  const salesRevenue = Number(kpi.salesRevenue || 0);
  const rentalSharePct = totalRevenue > 0 ? Math.round((rentalRevenue / totalRevenue) * 100) : 0;
  const salesSharePct = totalRevenue > 0 ? 100 - rentalSharePct : 0;

  const revenueSeries = useMemo(() => report?.revenueSeries || [], [report]);
  const maxSeriesTotal = useMemo(() => {
    const maxVal = revenueSeries.reduce((max, b) => Math.max(max, Number(b.totalRevenue || 0)), 0);
    return maxVal > 0 ? maxVal : 1;
  }, [revenueSeries]);

  const activeBucket = useMemo(() => {
    if (!revenueSeries.length) return null;
    if (selectedSeriesIdx !== null && revenueSeries[selectedSeriesIdx]) {
      return revenueSeries[selectedSeriesIdx];
    }
    return revenueSeries[revenueSeries.length - 1];
  }, [revenueSeries, selectedSeriesIdx]);

  const stock = report?.stockBreakdown || {};
  const stockTotal = Number(stock.totalUnits || 0);
  const stockRatio = (val) => (stockTotal > 0 ? `${(Number(val || 0) / stockTotal) * 100}%` : '0%');

  const rentalBreakdown = report?.orderBreakdown?.rental || {};
  const salesBreakdown = report?.orderBreakdown?.sales || {};
  const operations = report?.operations || {};

  return (
    <div className="shop-dashboard-layout">
      <BranchSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className="admin-main-viewport">
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb="Doanh Thu Chi Nhánh"
        />

        <main className="shop-main-content">
          <div className="ba-page">
            {/* Hero & Filters */}
            <section className="ba-hero" aria-label="Tiêu đề và bộ lọc báo cáo chi nhánh">
              <div className="ba-hero__top">
                <div>
                  <div className="ba-hero__eyebrow">
                    <Building2 size={14} />
                    <span>Báo Cáo Hiệu Suất & Vận Hành Chi Nhánh</span>
                  </div>
                  <h1 className="ba-hero__title">
                    {report?.branchInfo?.name || 'Hiệu Suất Hoạt Động Chi Nhánh'}
                  </h1>
                  <div className="ba-hero__meta">
                    {report?.branchInfo && (
                      <>
                        <span className="ba-hero__meta-item">
                          <MapPin size={14} />
                          <span>
                            {[report.branchInfo.address, report.branchInfo.ward, report.branchInfo.city]
                              .filter(Boolean)
                              .join(', ') || 'Chưa cập nhật địa chỉ'}
                          </span>
                        </span>
                        <span
                          className={`ba-badge ${
                            report.branchInfo.status === 'ACTIVE' ? 'ba-badge--success' : 'ba-badge--warning'
                          }`}
                        >
                          {report.branchInfo.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ngưng'}
                        </span>
                      </>
                    )}
                    {report?.storeLocation && (
                      <span className="ba-badge ba-badge--gold">
                        Kho cửa hàng: {report.storeLocation.name} ({report.storeLocation.code})
                      </span>
                    )}
                  </div>
                </div>

                <div className="ba-hero__actions ba-print-hide">
                  <button
                    type="button"
                    className="ba-btn ba-btn--outline"
                    onClick={() => fetchReport({ isManualRefresh: true })}
                    disabled={refreshing}
                  >
                    <RefreshCw size={15} className={refreshing ? 'ba-spin' : ''} />
                    <span>Làm mới</span>
                  </button>
                  <button
                    type="button"
                    className="ba-btn ba-btn--outline"
                    onClick={handleExportCsv}
                    disabled={!report || !report.hasAssignment}
                  >
                    <Download size={15} />
                    <span>Xuất CSV</span>
                  </button>
                  <button
                    type="button"
                    className="ba-btn ba-btn--primary"
                    onClick={handlePrintPdf}
                    disabled={!report || !report.hasAssignment}
                  >
                    <Printer size={15} />
                    <span>In / Lưu PDF</span>
                  </button>
                </div>
              </div>

              <div className="ba-toolbar ba-print-hide">
                <div className="ba-presets" role="group" aria-label="Chọn kỳ báo cáo">
                  {PRESET_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`ba-presets__btn ${timeRange === opt.key ? 'ba-presets__btn--active' : ''}`}
                      onClick={() => handleSelectPreset(opt.key)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {timeRange === 'CUSTOM' ? (
                  <form className="ba-custom-range" onSubmit={handleApplyCustomRange}>
                    <label className="ba-date-field">
                      <span>Từ</span>
                      <input
                        type="date"
                        className="ba-date-field__input"
                        value={customStartInput}
                        onChange={(e) => setCustomStartInput(e.target.value)}
                        aria-label="Ngày bắt đầu"
                      />
                    </label>
                    <label className="ba-date-field">
                      <span>Đến</span>
                      <input
                        type="date"
                        className="ba-date-field__input"
                        value={customEndInput}
                        onChange={(e) => setCustomEndInput(e.target.value)}
                        aria-label="Ngày kết thúc"
                      />
                    </label>
                    <button type="submit" className="ba-btn ba-btn--gold">
                      Áp dụng
                    </button>
                  </form>
                ) : (
                  <div className="ba-window-label">
                    <Calendar size={14} />
                    <span>
                      Kỳ dữ liệu: {formatDateVi(report?.timeRange?.startDate)} —{' '}
                      {formatDateVi(report?.timeRange?.endDate)}
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* Error Banner */}
            {errorMsg && (
              <div className="ba-banner ba-banner--danger" role="alert">
                <div className="ba-banner__content">
                  <XCircle size={18} className="ba-banner__icon" color="#B43232" />
                  <div>
                    <p className="ba-banner__title">Không thể tải báo cáo</p>
                    <p className="ba-banner__desc">{errorMsg}</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="ba-btn ba-btn--outline"
                  onClick={() => fetchReport({ isManualRefresh: true })}
                >
                  Thử lại
                </button>
              </div>
            )}

            {/* Loading Skeleton */}
            {loading && !report && (
              <>
                <div className="ba-kpi-grid" aria-busy="true">
                  <div className="ba-skeleton ba-skeleton--kpi" />
                  <div className="ba-skeleton ba-skeleton--kpi" />
                  <div className="ba-skeleton ba-skeleton--kpi" />
                  <div className="ba-skeleton ba-skeleton--kpi" />
                </div>
                <div className="ba-grid-2-1">
                  <div className="ba-skeleton ba-skeleton--panel" />
                  <div className="ba-skeleton ba-skeleton--panel" />
                </div>
              </>
            )}

            {/* Unassigned Branch Manager State */}
            {!loading && report && !report.hasAssignment && (
              <section className="ba-empty-card">
                <div className="ba-empty-card__icon">
                  <Building2 size={24} />
                </div>
                <h2 className="ba-empty-card__title">Tài Khoản Chưa Được Phân Công Chi Nhánh</h2>
                <p className="ba-empty-card__desc">
                  Bạn hiện chưa được chỉ định làm Quản lý chi nhánh cho cơ sở nào trong hệ thống Vestora.
                  Vui lòng liên hệ Chủ chuỗi (Shop Owner) để được bổ nhiệm chi nhánh phụ trách trước khi xem
                  báo cáo hiệu suất.
                </p>
                <Link to="/branch/dashboard" className="ba-btn ba-btn--primary">
                  <span>Về Trang Tổng Quan</span>
                  <ArrowRight size={15} />
                </Link>
              </section>
            )}

            {/* Main 6-Area Dashboard */}
            {report && report.hasAssignment && (
              <>
                {!report.hasStoreLocation && (
                  <div className="ba-banner ba-banner--warning" role="status">
                    <div className="ba-banner__content">
                      <AlertTriangle size={18} className="ba-banner__icon" color="#A36818" />
                      <div>
                        <p className="ba-banner__title">Chi nhánh chưa có kho cửa hàng hoạt động</p>
                        <p className="ba-banner__desc">
                          Không tìm thấy InventoryLocation loại cửa hàng (type: store, status: active) gắn với
                          chi nhánh này. Các chỉ số tồn kho và đơn hàng được giữ ở mức 0 an toàn.
                        </p>
                      </div>
                    </div>
                    <Link to="/branch/inventory" className="ba-btn ba-btn--outline">
                      <span>Kiểm tra Tồn Kho</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                )}

                {/* Area 1: KPI Metrics */}
                <section className="ba-kpi-grid" aria-label="Chỉ số hiệu suất chính">
                  <article className="ba-kpi-card ba-kpi-card--featured">
                    <div className="ba-kpi-card__head">
                      <span className="ba-kpi-card__label">Tổng Doanh Thu Kỳ</span>
                      <span className="ba-kpi-card__icon">
                        <TrendingUp size={17} />
                      </span>
                    </div>
                    <div className="ba-kpi-card__value">{formatVnd(totalRevenue)}</div>
                    <div className="ba-kpi-card__foot">
                      {kpi.hasGrowthBaseline ? (
                        <span
                          className={`ba-badge ${
                            Number(kpi.growthRate) >= 0 ? 'ba-badge--success' : 'ba-badge--danger'
                          }`}
                        >
                          {Number(kpi.growthRate) >= 0 ? (
                            <TrendingUp size={12} />
                          ) : (
                            <TrendingDown size={12} />
                          )}
                          <span>
                            {Number(kpi.growthRate) >= 0 ? `+${kpi.growthRate}%` : `${kpi.growthRate}%`} so với
                            kỳ trước
                          </span>
                        </span>
                      ) : (
                        <span className="ba-badge ba-badge--gold">
                          <Minus size={12} />
                          <span>Chưa có dữ liệu kỳ trước</span>
                        </span>
                      )}
                    </div>
                  </article>

                  <article className="ba-kpi-card">
                    <div className="ba-kpi-card__head">
                      <span className="ba-kpi-card__label">Phân Tách Doanh Thu</span>
                      <span className="ba-kpi-card__icon">
                        <ShoppingBag size={17} />
                      </span>
                    </div>
                    <div className="ba-kpi-card__split">
                      <div className="ba-kpi-card__split-row">
                        <span>Cho thuê ({rentalSharePct}%)</span>
                        <span className="ba-kpi-card__split-val">{formatVnd(rentalRevenue)}</span>
                      </div>
                      <div className="ba-kpi-card__split-row">
                        <span>Bán đứt ({salesSharePct}%)</span>
                        <span className="ba-kpi-card__split-val">{formatVnd(salesRevenue)}</span>
                      </div>
                      <div className="ba-split-bar" aria-hidden="true">
                        <div className="ba-split-bar__rental" style={{ width: `${rentalSharePct}%` }} />
                        <div className="ba-split-bar__sales" style={{ width: `${salesSharePct}%` }} />
                      </div>
                    </div>
                  </article>

                  <article className="ba-kpi-card">
                    <div className="ba-kpi-card__head">
                      <span className="ba-kpi-card__label">Tiền Cọc Đang Tạm Giữ</span>
                      <span className="ba-kpi-card__icon">
                        <Wallet size={17} />
                      </span>
                    </div>
                    <div className="ba-kpi-card__value">{formatVnd(kpi.heldDeposits)}</div>
                    <div className="ba-kpi-card__foot">
                      <span>{kpi.activeRentalsCount || 0} đơn đang thuê</span>
                      {Number(kpi.overdueRentalsCount || 0) > 0 && (
                        <span className="ba-badge ba-badge--danger">
                          {kpi.overdueRentalsCount} quá hạn
                        </span>
                      )}
                    </div>
                  </article>

                  <article className="ba-kpi-card">
                    <div className="ba-kpi-card__head">
                      <span className="ba-kpi-card__label">Đơn Hàng & Xoay Vòng</span>
                      <span className="ba-kpi-card__icon">
                        <RotateCcw size={17} />
                      </span>
                    </div>
                    <div className="ba-kpi-card__value">{kpi.totalOrdersCount || 0} đơn</div>
                    <div className="ba-kpi-card__foot">
                      <span>
                        {kpi.rentalOrdersCount || 0} thuê • {kpi.salesOrdersCount || 0} bán
                      </span>
                      <span className="ba-badge ba-badge--neutral">
                        {kpi.turnoverRate ?? 0} lượt/sp
                      </span>
                    </div>
                  </article>
                </section>

                {/* Area 1b + Area 2: Revenue Series Chart & Order Breakdown */}
                <section className="ba-grid-2-1">
                  <article className="ba-card">
                    <div className="ba-card__header">
                      <div>
                        <h2 className="ba-card__title">Biểu Đồ Dòng Tiền Chi Nhánh</h2>
                        <p className="ba-card__subtitle">
                          So sánh doanh thu thuê và doanh thu bán theo từng mốc thời gian thực tế
                        </p>
                      </div>
                      <div className="ba-chart-legend">
                        <span className="ba-chart-legend__item">
                          <span className="ba-chart-legend__swatch ba-chart-legend__swatch--rental" />
                          <span>Doanh thu thuê</span>
                        </span>
                        <span className="ba-chart-legend__item">
                          <span className="ba-chart-legend__swatch ba-chart-legend__swatch--sales" />
                          <span>Doanh thu bán</span>
                        </span>
                      </div>
                    </div>

                    <div className="ba-chart">
                      {totalRevenue === 0 ? (
                        <div className="ba-chart__empty">
                          <Layers size={24} />
                          <span>Chưa phát sinh doanh thu hợp lệ trong khoảng thời gian đã chọn.</span>
                        </div>
                      ) : (
                        <>
                          <div className="ba-chart__bars">
                            {revenueSeries.map((bucket, idx) => {
                              const rentalPct = Math.round(
                                (Number(bucket.rentalRevenue || 0) / maxSeriesTotal) * 100
                              );
                              const salesPct = Math.round(
                                (Number(bucket.salesRevenue || 0) / maxSeriesTotal) * 100
                              );
                              return (
                                <button
                                  key={bucket.key || idx}
                                  type="button"
                                  className="ba-chart__col"
                                  onMouseEnter={() => setSelectedSeriesIdx(idx)}
                                  onFocus={() => setSelectedSeriesIdx(idx)}
                                  onClick={() => setSelectedSeriesIdx(idx)}
                                  title={`${bucket.fullLabel || bucket.label}: ${formatVnd(
                                    bucket.totalRevenue
                                  )}`}
                                >
                                  <div className="ba-chart__stack">
                                    {rentalPct > 0 && (
                                      <div
                                        className="ba-chart__seg ba-chart__seg--rental"
                                        style={{ height: `${Math.max(4, rentalPct)}%` }}
                                      />
                                    )}
                                    {salesPct > 0 && (
                                      <div
                                        className="ba-chart__seg ba-chart__seg--sales"
                                        style={{ height: `${Math.max(4, salesPct)}%` }}
                                      />
                                    )}
                                  </div>
                                  <span className="ba-chart__label">{bucket.label}</span>
                                </button>
                              );
                            })}
                          </div>

                          {activeBucket && (
                            <div className="ba-chart__inspector">
                              <strong>{activeBucket.fullLabel || activeBucket.label}</strong>
                              <span>
                                Thuê: <strong>{formatVnd(activeBucket.rentalRevenue)}</strong> (
                                {activeBucket.rentalCount || 0} đơn)
                              </span>
                              <span>
                                Bán: <strong>{formatVnd(activeBucket.salesRevenue)}</strong> (
                                {activeBucket.salesCount || 0} đơn)
                              </span>
                              <span>
                                Tổng: <strong>{formatVnd(activeBucket.totalRevenue)}</strong>
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </article>

                  {/* Area 2: Order Breakdown */}
                  <article className="ba-card">
                    <div className="ba-card__header">
                      <div>
                        <h2 className="ba-card__title">Tổng Hợp Trạng Thái Đơn</h2>
                        <p className="ba-card__subtitle">
                          Loại trừ đơn nháp (draft) khỏi thống kê hiệu suất
                        </p>
                      </div>
                    </div>

                    <div className="ba-order-groups">
                      <div className="ba-order-group">
                        <div className="ba-order-group__head">
                          <span>Đơn Thuê Trang Phục</span>
                          <Link to="/branch/rental-orders" className="ba-link-action">
                            <span>Quản lý</span>
                            <ArrowRight size={13} />
                          </Link>
                        </div>
                        <div className="ba-status-grid">
                          {RENTAL_STATUS_LABELS.map((item) => {
                            const count = Number(rentalBreakdown[item.key] || 0);
                            return (
                              <div
                                key={item.key}
                                className={`ba-status-tile ${
                                  item.alert && count > 0 ? 'ba-status-tile--alert' : ''
                                }`}
                              >
                                <span className="ba-status-tile__label">{item.label}</span>
                                <span className="ba-status-tile__count">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="ba-order-group">
                        <div className="ba-order-group__head">
                          <span>Đơn Bán Đứt</span>
                          <Link to="/branch/sale-orders" className="ba-link-action">
                            <span>Quản lý</span>
                            <ArrowRight size={13} />
                          </Link>
                        </div>
                        <div className="ba-status-grid">
                          {SALES_STATUS_LABELS.map((item) => (
                            <div key={item.key} className="ba-status-tile">
                              <span className="ba-status-tile__label">{item.label}</span>
                              <span className="ba-status-tile__count">
                                {Number(salesBreakdown[item.key] || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </article>
                </section>

                {/* Area 3: Store Stock Breakdown */}
                <section className="ba-card" aria-label="Tình trạng kho cửa hàng">
                  <div className="ba-card__header">
                    <div>
                      <h2 className="ba-card__title">
                        <Package size={18} />
                        <span>Tình Trạng Kho Tại Chi Nhánh ({stockTotal} đơn vị)</span>
                      </h2>
                      <p className="ba-card__subtitle">
                        Tổng hợp đồng thời sản phẩm theo số lượng (InventoryBalance) và mã định danh (InventoryItem)
                      </p>
                    </div>
                    <Link to="/branch/inventory" className="ba-link-action">
                      <span>Chi tiết tồn kho</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>

                  <div className="ba-stock-bar" aria-hidden="true">
                    <div
                      className="ba-stock-bar__seg--available"
                      style={{ width: stockRatio(stock.available) }}
                    />
                    <div
                      className="ba-stock-bar__seg--rented"
                      style={{ width: stockRatio(stock.rented) }}
                    />
                    <div
                      className="ba-stock-bar__seg--inspecting"
                      style={{ width: stockRatio(stock.inspecting) }}
                    />
                    <div
                      className="ba-stock-bar__seg--maintenance"
                      style={{ width: stockRatio(stock.maintenance) }}
                    />
                    <div
                      className="ba-stock-bar__seg--reserved"
                      style={{ width: stockRatio(stock.reserved) }}
                    />
                  </div>

                  <div className="ba-stock-metrics">
                    <div className="ba-stock-tile">
                      <span className="ba-stock-tile__label">
                        <span className="ba-stock-tile__dot ba-stock-bar__seg--available" />
                        Sẵn sàng phục vụ
                      </span>
                      <span className="ba-stock-tile__value">{stock.available || 0}</span>
                    </div>
                    <div className="ba-stock-tile">
                      <span className="ba-stock-tile__label">
                        <span className="ba-stock-tile__dot ba-stock-bar__seg--rented" />
                        Đang cho thuê
                      </span>
                      <span className="ba-stock-tile__value">{stock.rented || 0}</span>
                    </div>
                    <div className="ba-stock-tile">
                      <span className="ba-stock-tile__label">
                        <span className="ba-stock-tile__dot ba-stock-bar__seg--inspecting" />
                        Phiếu chờ kiểm định
                      </span>
                      <span className="ba-stock-tile__value">{stock.inspecting || 0}</span>
                    </div>
                    <div className="ba-stock-tile">
                      <span className="ba-stock-tile__label">
                        <span className="ba-stock-tile__dot ba-stock-bar__seg--maintenance" />
                        Bảo dưỡng / Hỏng
                      </span>
                      <span className="ba-stock-tile__value">{stock.maintenance || 0}</span>
                    </div>
                    <div className="ba-stock-tile">
                      <span className="ba-stock-tile__label">
                        <span className="ba-stock-tile__dot ba-stock-bar__seg--reserved" />
                        Đang giữ chỗ
                      </span>
                      <span className="ba-stock-tile__value">{stock.reserved || 0}</span>
                    </div>
                  </div>
                </section>

                {/* Area 4 & Area 5 & Area 6 */}
                <section className="ba-grid-1-1">
                  {/* Area 4: Product Performance */}
                  <article className="ba-card">
                    <div className="ba-card__header">
                      <div>
                        <h2 className="ba-card__title">
                          <Award size={18} />
                          <span>Hiệu Suất Sản Phẩm Chi Nhánh</span>
                        </h2>
                        <p className="ba-card__subtitle">
                          Top 5 mẫu doanh thu cao nhất và các mẫu tồn chậm cần đẩy mạnh
                        </p>
                      </div>
                    </div>

                    {(report.topProducts || []).length === 0 ? (
                      <div className="ba-section-empty">
                        <Shirt size={20} />
                        <span>Chưa có sản phẩm phát sinh doanh thu trong kỳ báo cáo này.</span>
                      </div>
                    ) : (
                      <div className="ba-product-list">
                        {report.topProducts.map((prod, idx) => {
                          const thumbUrl = getOptimizedImageUrl(prod.imageUrl);
                          return (
                            <div key={prod.productId || idx} className="ba-product-row">
                              <div className="ba-product-row__left">
                                <span className="ba-product-row__rank">{idx + 1}</span>
                                {thumbUrl ? (
                                  <img
                                    src={thumbUrl}
                                    alt={prod.name}
                                    className="ba-product-row__thumb"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="ba-product-row__thumb" aria-hidden="true">
                                    <Shirt size={18} />
                                  </div>
                                )}
                                <div className="ba-product-row__info">
                                  <div className="ba-product-row__name" title={prod.name}>
                                    {prod.name}
                                  </div>
                                  <div className="ba-product-row__meta">
                                    {prod.category} • {prod.rentalCount || 0} thuê • {prod.salesCount || 0} bán
                                  </div>
                                </div>
                              </div>
                              <div className="ba-product-row__right">
                                <div className="ba-product-row__rev">{formatVnd(prod.revenue)}</div>
                                <div className="ba-product-row__orders">{prod.orderCount || 0} đơn</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="ba-subblock">
                      <h3 className="ba-subblock__title">Sản phẩm tồn sẵn sàng nhưng chưa có đơn trong kỳ</h3>
                      {(report.slowMovingProducts || []).length === 0 ? (
                        <div className="ba-section-empty">
                          <CheckCircle2 size={18} />
                          <span>Không ghi nhận mẫu tồn chậm tại quầy trong kỳ.</span>
                        </div>
                      ) : (
                        <div className="ba-slow-chip-list">
                          {report.slowMovingProducts.map((item, idx) => (
                            <div key={item.productId || idx} className="ba-slow-item">
                              <span>
                                <strong>{item.name}</strong> ({item.category})
                              </span>
                              <span className="ba-badge ba-badge--neutral">
                                Còn {item.availableQty} chiếc
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>

                  {/* Area 6: Operational Issues & Queue */}
                  <article className="ba-card">
                    <div className="ba-card__header">
                      <div>
                        <h2 className="ba-card__title">
                          <ShieldAlert size={18} />
                          <span>Cảnh Báo Vận Hành & Tác Vụ Cần Xử Lý</span>
                        </h2>
                        <p className="ba-card__subtitle">
                          Đơn trễ hạn, khiếu nại hư hỏng, vận đơn lỗi và phiếu chuyển kho chờ nhận
                        </p>
                      </div>
                    </div>

                    <div className="ba-ops-counters">
                      <div className="ba-ops-counter">
                        <span className="ba-ops-counter__val">{operations.pendingHandoverCount || 0}</span>
                        <span className="ba-ops-counter__lbl">Chờ bàn giao</span>
                      </div>
                      <div className="ba-ops-counter">
                        <span className="ba-ops-counter__val">{operations.openDisputesCount || 0}</span>
                        <span className="ba-ops-counter__lbl">Khiếu nại mở</span>
                      </div>
                      <div className="ba-ops-counter">
                        <span className="ba-ops-counter__val">
                          {operations.incomingTransfersToReceiveCount || 0}
                        </span>
                        <span className="ba-ops-counter__lbl">Phiếu kho đến</span>
                      </div>
                      <div className="ba-ops-counter">
                        <span className="ba-ops-counter__val">{operations.failedShipmentsCount || 0}</span>
                        <span className="ba-ops-counter__lbl">Giao vận lỗi</span>
                      </div>
                    </div>

                    {(report.operationalIssues || []).length === 0 ? (
                      <div className="ba-section-empty">
                        <CheckCircle2 size={20} color="#2F6F4E" />
                        <span>Không có sự cố tồn đọng tại chi nhánh ở thời điểm hiện tại.</span>
                      </div>
                    ) : (
                      <div className="ba-issue-list">
                        {report.operationalIssues.map((issue) => (
                          <div
                            key={issue.id}
                            className={`ba-issue-item ${
                              issue.severity === 'HIGH' ? 'ba-issue-item--high' : 'ba-issue-item--medium'
                            }`}
                          >
                            <div className="ba-issue-item__body">
                              <div className="ba-issue-item__head">
                                <span className="ba-issue-item__code">{issue.orderCode}</span>
                                <span
                                  className={`ba-badge ${
                                    issue.severity === 'HIGH' ? 'ba-badge--danger' : 'ba-badge--warning'
                                  }`}
                                >
                                  {ISSUE_TYPE_LABELS[issue.type] || issue.type}
                                </span>
                              </div>
                              <div className="ba-issue-item__detail">{issue.detail}</div>
                              <div className="ba-issue-item__customer">
                                <span>{issue.customerName}</span>
                                {issue.customerPhone && (
                                  <>
                                    <span>•</span>
                                    <Phone size={12} />
                                    <span>{issue.customerPhone}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <Link
                              to={issue.actionPath || '/branch/rental-orders'}
                              className="ba-link-action"
                            >
                              <span>Xử lý</span>
                              <ArrowRight size={13} />
                            </Link>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                </section>

                {/* Area 5: Upcoming Returns (48h) */}
                <section className="ba-card" aria-label="Lịch đồ sắp hoàn trả trong 48 giờ tới">
                  <div className="ba-card__header">
                    <div>
                      <h2 className="ba-card__title">
                        <Clock size={18} />
                        <span>Lịch Đồ Sắp Hoàn Trả Trong 48 Giờ Tới</span>
                      </h2>
                      <p className="ba-card__subtitle">
                        Danh sách đơn thuê sắp đến hạn trả để chuẩn bị tiếp nhận và kiểm định hoàn cọc
                      </p>
                    </div>
                    <Link to="/branch/returns" className="ba-link-action">
                      <span>Mở màn hình Kiểm Định Nhận Trả</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>

                  {(report.upcomingReturns || []).length === 0 ? (
                    <div className="ba-section-empty">
                      <Clock size={20} />
                      <span>Không có đơn thuê nào đến hạn hoàn trả trong 48 giờ tới.</span>
                    </div>
                  ) : (
                    <div className="ba-table-wrap">
                      <table className="ba-table">
                        <thead>
                          <tr>
                            <th>Mã đơn</th>
                            <th>Khách hàng</th>
                            <th>Trang phục chính</th>
                            <th>Hạn trả</th>
                            <th>Tiền cọc giữ</th>
                            <th>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.upcomingReturns.map((item) => (
                            <tr key={item._id}>
                              <td>
                                <strong>{item.orderCode}</strong>
                              </td>
                              <td>
                                <div>{item.customerName}</div>
                                {item.customerPhone && (
                                  <div className="ba-product-row__meta">{item.customerPhone}</div>
                                )}
                              </td>
                              <td>{item.productName}</td>
                              <td>
                                <span
                                  className={`ba-badge ${
                                    item.isDueToday ? 'ba-badge--warning' : 'ba-badge--info'
                                  }`}
                                >
                                  {item.isDueToday ? 'Hôm nay' : 'Ngày mai'} • Còn {item.hoursRemaining}h
                                </span>
                                <div className="ba-product-row__meta">{formatDateTimeVi(item.dueDate)}</div>
                              </td>
                              <td>
                                <strong>{formatVnd(item.depositAmount)}</strong>
                              </td>
                              <td>
                                <Link to="/branch/returns" className="ba-link-action">
                                  <span>Nhận trả</span>
                                  <ArrowRight size={13} />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Custom Toast Notification */}
      {toast && (
        <div
          key={toast.id}
          className={`ba-toast ${
            toast.type === 'warning'
              ? 'ba-toast--warning'
              : toast.type === 'error'
                ? 'ba-toast--error'
                : ''
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="ba-toast__icon">
            {toast.type === 'error' ? (
              <XCircle size={18} />
            ) : toast.type === 'warning' ? (
              <AlertTriangle size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
          </span>
          <span className="ba-toast__message">{toast.message}</span>
          <button
            type="button"
            className="ba-toast__close"
            onClick={() => setToast(null)}
            aria-label="Đóng thông báo"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
