import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Menu, RefreshCw } from 'lucide-react';
import OwnerSidebar from '../../components/OwnerSidebar';
import ProtectedRoute from '../../components/ProtectedRoute';
import useOwnerPerformanceReport from '../../hooks/use-owner-performance-report';
import OwnerReportFilters from '../../components/owner/analytics/owner-report-filters';
import OwnerReportKpis from '../../components/owner/analytics/owner-report-kpis';
import OwnerReportSeries from '../../components/owner/analytics/owner-report-series';
import OwnerReportBranches from '../../components/owner/analytics/owner-report-branches';
import OwnerReportInventory from '../../components/owner/analytics/owner-report-inventory';
import OwnerReportProducts from '../../components/owner/analytics/owner-report-products';
import OwnerReportOperations, { OwnerReportAttention } from '../../components/owner/analytics/owner-report-operations';
import OwnerReportCustomers from '../../components/owner/analytics/owner-report-customers';
import '../../styles/OwnerPerformance.css';
const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-006 */
const stamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? dateFormat.format(new Date(value)) : 'Chưa xác minh';

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-018 */
function useOwnerNavigation() {
  const [collapsed, setCollapsed] = useState(false), [open, setOpen] = useState(false);
  const panel = useRef(null), button = useRef(null);
  const close = useCallback(() => { setOpen(false); button.current?.focus(); }, []);
  useEffect(() => {
    if (!open) return undefined;
    panel.current?.querySelector('a,button')?.focus();
    const onKeyDown = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, close]);
  return { collapsed, toggleCollapsed: () => setCollapsed((value) => !value), open, toggle: () => setOpen((value) => !value), close, panel, button };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-018 */
function ReportSection({ label, children }) {
  return <div className="owner-report-scroll-frame" role="region" aria-label={label} tabIndex={0}>{children}</div>;
}

const REPORT_TABS = [['overview', 'Tổng quan'], ['stock', 'Tồn kho & sản phẩm'], ['operations', 'Vận hành & khách hàng']];

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-018 */
function moveReportTab(event, select) {
  const buttons = [...event.currentTarget.parentElement.querySelectorAll('[role="tab"]')];
  const index = buttons.indexOf(event.currentTarget);
  const target = { ArrowRight: (index + 1) % buttons.length, ArrowLeft: (index + buttons.length - 1) % buttons.length, Home: 0, End: buttons.length - 1 }[event.key];
  if (target === undefined) return;
  event.preventDefault(); select(REPORT_TABS[target][0]); buttons[target].focus();
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-006 */
function ReportOverview({ report }) {
  const [tab, setTab] = useState('overview');
  const notes = [...Object.values(report.metricAvailability || {}), ...(report.storeInventoryByBranch || []), ...(report.operationsByBranch || []), report.centralWarehouseInventory];
  const partial = notes.some((note) => note?.availability === 'PARTIAL'), unavailable = notes.some((note) => note?.availability === 'UNAVAILABLE');
  const showOperations = () => { setTab('operations'); document.getElementById('owner-report-tab-operations')?.focus(); };
  return <>
    <div className="owner-report-context"><p className="owner-report-freshness">{report.scope.branches.length} cửa hàng trong phạm vi · Cập nhật <time dateTime={report.generatedAt}>{stamp(report.generatedAt)}</time> · Lịch Việt Nam · VND</p>
      <details className="owner-report-period-details"><summary>Xem thời gian báo cáo & đối chiếu</summary>
        <dl className="owner-report-periods"><div><dt>Kỳ hiện tại</dt><dd>{stamp(report.timeRange?.startAt)} — trước {stamp(report.timeRange?.endAtExclusive)}</dd></div>
          <div><dt>Kỳ đối chiếu</dt><dd>{stamp(report.timeRange?.comparisonStartAt)} — trước {stamp(report.timeRange?.comparisonEndAtExclusive)}</dd></div></dl>
      </details></div>
    {(partial || unavailable) && <div role="status" className="owner-report-note"><strong>{partial ? 'Một phần số liệu chưa đầy đủ.' : 'Một số chỉ số chưa có dữ liệu xác minh.'}</strong>
      <span> Chỉ số thiếu được giải thích tại từng mục; dấu — không có nghĩa là 0.</span></div>}
    <OwnerReportAttention report={report} onReview={showOperations} /><OwnerReportKpis report={report} />
    <div className="owner-report-tabs" role="tablist" aria-label="Nội dung báo cáo">{REPORT_TABS.map(([key, label]) =>
      <button key={key} type="button" role="tab" id={`owner-report-tab-${key}`} aria-controls={`owner-report-panel-${key}`}
        aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)} onKeyDown={(event) => moveReportTab(event, setTab)}>{label}</button>)}</div>
    {REPORT_TABS.map(([key]) => <div key={key} role="tabpanel" id={`owner-report-panel-${key}`} aria-labelledby={`owner-report-tab-${key}`} hidden={tab !== key}>
      {key === 'overview' ? <><ReportSection label="Bảng và biểu đồ theo kỳ"><OwnerReportSeries report={report} /></ReportSection>
        <ReportSection label="Bảng so sánh cửa hàng"><OwnerReportBranches report={report} /></ReportSection></>
        : key === 'stock' ? <><ReportSection label="Bảng tồn kho hiện tại"><OwnerReportInventory report={report} /></ReportSection>
          <ReportSection label="Bảng hiệu quả sản phẩm"><OwnerReportProducts report={report} /></ReportSection></>
          : <><ReportSection label="Bảng vận hành hiện tại"><OwnerReportOperations report={report} /></ReportSection><OwnerReportCustomers report={report} /></>}
    </div>)}
  </>;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-006 */
function ReportContent({ report, retry }) {
  if (typeof report.scope?.hasBranches !== 'boolean' || !Array.isArray(report.scope.branches) || report.scope.hasBranches !== (report.scope.branches.length > 0)) return <section className="owner-report-state" role="alert">
    <h2>Không thể hiển thị báo cáo</h2><p>Phạm vi báo cáo chưa được xác minh.</p><button type="button" onClick={retry}>Thử lại</button></section>;
  if (!report.scope.hasBranches) return <section className="owner-report-state"><h2>Chưa có cửa hàng để báo cáo</h2><p>Báo cáo sẽ xuất hiện khi bạn có cửa hàng hợp lệ.</p></section>;
  return <ReportOverview report={report} />;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-018 */
function ReportToolbar({ navigation, loading, retry }) {
  return <header className="owner-performance-toolbar">
    <button type="button" className="owner-report-menu-button" ref={navigation.button} aria-label="Điều hướng cửa hàng"
      aria-controls="owner-report-navigation" aria-expanded={navigation.open} onClick={navigation.toggle}><Menu size={20} aria-hidden="true" /></button>
    <span>VESTORA <span className="owner-report-toolbar-divider">/</span> Hiệu quả cửa hàng</span>
    <button type="button" className="owner-report-refresh" onClick={retry} disabled={loading}><RefreshCw size={16} aria-hidden="true" /> Làm mới báo cáo</button>
  </header>;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-019 */
export default function OwnerPerformancePage() {
  const state = useOwnerPerformanceReport(), navigation = useOwnerNavigation();
  if (state.forbidden) return <main className="owner-report-denied"><h1>Không có quyền xem báo cáo chủ shop</h1><p>Vui lòng đăng nhập bằng tài khoản chủ cửa hàng.</p></main>;
  return <div className="owner-performance-shell">
    <a className="owner-report-skip" href="#owner-report-content">Đến nội dung báo cáo</a>
    <div id="owner-report-navigation" ref={navigation.panel} className={`owner-performance-navigation ${navigation.open ? 'is-open' : ''}`}>
      <OwnerSidebar isCollapsed={navigation.collapsed} onToggle={navigation.toggleCollapsed} />
    </div>
    {navigation.open && <button type="button" className="owner-report-menu-backdrop" aria-label="Đóng điều hướng" onClick={navigation.close} />}
    <div className="owner-performance-main"><ReportToolbar navigation={navigation} loading={state.loading} retry={state.retry} />
      <main id="owner-report-content" className="owner-performance-content" aria-busy={state.loading} tabIndex={-1}>
        <div className="owner-report-hero"><p className="owner-report-kicker">BÁO CÁO CỬA HÀNG</p><h1>Hiệu quả cửa hàng</h1>
          <p>Xem kết quả theo kỳ, so sánh cửa hàng và nắm các việc cần xử lý.</p></div>
        <OwnerReportFilters filters={state.filters} onChange={state.updateFilters} />
        {state.loading ? <section className="owner-report-state" role="status"><p>Đang tải báo cáo...</p><div className="owner-report-skeleton" aria-hidden="true"><span /><span /><span /></div></section>
          : state.error ? <section className="owner-report-state" role="alert"><h2>Chưa thể tải báo cáo</h2><p>{state.error}</p><button type="button" onClick={state.retry}>Thử lại</button></section>
            : state.data ? <ReportContent report={state.data} retry={state.retry} /> : null}
      </main>
    </div>
  </div>;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-002 */
export function OwnerPerformanceRoute() {
  return <ProtectedRoute allowedRoles={['SHOP_OWNER', 'OWNER']} allowAdmin={false}><OwnerPerformancePage /></ProtectedRoute>;
}
