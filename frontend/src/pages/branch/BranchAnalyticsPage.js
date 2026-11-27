import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Building2,
  X,
} from 'lucide-react';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import { getBranchPerformanceReportApi } from '../../services/shopApi';
import BranchReportHero from '../../components/branch/analytics/BranchReportHero';
import BranchReportKpis from '../../components/branch/analytics/BranchReportKpis';
import BranchReportOperationsTab from '../../components/branch/analytics/BranchReportOperationsTab';
import BranchReportRevenueTab from '../../components/branch/analytics/BranchReportRevenueTab';
import BranchReportInventoryTab from '../../components/branch/analytics/BranchReportInventoryTab';
import '../../styles/ShopDashboard.css';
import '../../styles/BranchAnalytics.css';

const ISSUE_TYPE_LABELS = {
  OVERDUE: 'Trễ hạn trả đồ',
  DAMAGE_DISPUTE: 'Khiếu nại / Hư hỏng',
  FAILED_SHIPMENT: 'Giao vận thất bại',
};

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
  const [activeTab, setActiveTab] = useState('OPERATIONS');

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
  const revenueSeries = report?.revenueSeries || [];
  const stock = report?.stockBreakdown || {};
  const operations = report?.operations || {};
  const urgentOpsCount = (report?.operationalIssues || []).length;

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
            {/* Hero, Filters & Tabs */}
            <BranchReportHero
              report={report}
              timeRange={timeRange}
              onSelectPreset={handleSelectPreset}
              customStartInput={customStartInput}
              setCustomStartInput={setCustomStartInput}
              customEndInput={customEndInput}
              setCustomEndInput={setCustomEndInput}
              onApplyCustomRange={handleApplyCustomRange}
              onRefresh={() => fetchReport({ isManualRefresh: true })}
              onExportCsv={handleExportCsv}
              onPrintPdf={handlePrintPdf}
              refreshing={refreshing}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              urgentOpsCount={urgentOpsCount}
            />

            {/* Error Banner */}
            {errorMsg && (
              <div className="ba-banner ba-banner--danger" role="alert">
                <div className="ba-banner__content">
                  <XCircle size={18} className="ba-banner__icon" color="#B43232" aria-hidden="true" />
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
                  <Building2 size={24} aria-hidden="true" />
                </div>
                <h2 className="ba-empty-card__title">Tài Khoản Chưa Được Phân Công Chi Nhánh</h2>
                <p className="ba-empty-card__desc">
                  Bạn hiện chưa được chỉ định làm Quản lý chi nhánh cho cơ sở nào trong hệ thống Vestora.
                  Vui lòng liên hệ Chủ chuỗi (Shop Owner) để được bổ nhiệm chi nhánh phụ trách trước khi xem
                  báo cáo hiệu suất.
                </p>
                <Link to="/branch/dashboard" className="ba-btn ba-btn--primary">
                  <span>Về Trang Tổng Quan</span>
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </section>
            )}

            {/* Main Content when assigned */}
            {report && report.hasAssignment && (
              <>
                {!report.hasStoreLocation && (
                  <div className="ba-banner ba-banner--warning" role="status">
                    <div className="ba-banner__content">
                      <AlertTriangle size={18} className="ba-banner__icon" color="#A36818" aria-hidden="true" />
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
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                )}

                {/* 4 Chữ số KPI chính luôn hiển thị tạo tổng quan nhanh */}
                <BranchReportKpis kpi={kpi} />

                {/* Tab Panel 1: Tiêu điểm vận hành */}
                <div
                  className={`ba-tab-pane ${
                    activeTab === 'OPERATIONS' || activeTab === 'ALL' ? '' : 'ba-tab-pane--hidden'
                  }`}
                  role="tabpanel"
                  aria-label="Tiêu điểm vận hành chi nhánh"
                >
                  <BranchReportOperationsTab
                    operations={operations}
                    upcomingReturns={report.upcomingReturns || []}
                    operationalIssues={report.operationalIssues || []}
                  />
                </div>

                {/* Tab Panel 2: Doanh thu & Dòng tiền */}
                <div
                  className={`ba-tab-pane ${
                    activeTab === 'REVENUE' || activeTab === 'ALL' ? '' : 'ba-tab-pane--hidden'
                  }`}
                  role="tabpanel"
                  aria-label="Doanh thu và dòng tiền chi nhánh"
                >
                  <BranchReportRevenueTab
                    revenueSeries={revenueSeries}
                    orderBreakdown={report.orderBreakdown}
                    totalRevenue={totalRevenue}
                  />
                </div>

                {/* Tab Panel 3: Kho quầy & Sản phẩm */}
                <div
                  className={`ba-tab-pane ${
                    activeTab === 'INVENTORY' || activeTab === 'ALL' ? '' : 'ba-tab-pane--hidden'
                  }`}
                  role="tabpanel"
                  aria-label="Kho quầy và hiệu suất sản phẩm"
                >
                  <BranchReportInventoryTab
                    stock={stock}
                    topProducts={report.topProducts || []}
                    slowMovingProducts={report.slowMovingProducts || []}
                  />
                </div>
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
              <XCircle size={18} aria-hidden="true" />
            ) : toast.type === 'warning' ? (
              <AlertTriangle size={18} aria-hidden="true" />
            ) : (
              <CheckCircle2 size={18} aria-hidden="true" />
            )}
          </span>
          <span className="ba-toast__message">{toast.message}</span>
          <button
            type="button"
            className="ba-toast__close"
            onClick={() => setToast(null)}
            aria-label="Đóng thông báo"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
