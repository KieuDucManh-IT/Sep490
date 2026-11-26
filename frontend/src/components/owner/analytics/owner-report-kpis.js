import React from 'react';
const format = new Intl.NumberFormat('vi-VN');
const REASONS = {
  SOURCE_COVERAGE_INCOMPLETE: 'Nguồn dữ liệu chưa đầy đủ để xác minh toàn bộ số liệu.',
  INVENTORY_SOURCE_CONFLICT: 'Các nguồn tồn kho chưa khớp; chưa thể xác nhận số tồn.',
  INVALID_AMOUNT: 'Nguồn dữ liệu có giá trị không hợp lệ, cần kiểm tra lại.',
};

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
export function ReportValue({ value, availability, money = false, percent = false, compact = false }) {
  const valid = typeof value === 'number' && Number.isFinite(value) && (percent ? value >= -Number.MAX_SAFE_INTEGER : Number.isSafeInteger(value) && value >= 0);
  if (!valid || availability === 'UNAVAILABLE') return <span className="owner-report-unavailable" aria-label={compact ? 'Chưa có dữ liệu' : undefined} title={compact ? 'Chưa có dữ liệu xác minh; không phải số 0' : undefined}>{compact ? '—' : 'Chưa có dữ liệu'}</span>;
  return <span className={availability === 'PARTIAL' ? 'owner-report-partial' : ''}>
    {percent ? value.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : format.format(value)}{money ? ' ₫' : percent ? '%' : ''}
    {availability === 'PARTIAL' && <>{compact && <small aria-hidden="true" title="Dữ liệu một phần"> *</small>}<small className={compact ? 'owner-report-sr-only' : undefined}> — Dữ liệu một phần</small></>}
  </span>;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
export function AvailabilityNote({ note, availability = note?.availability }) {
  if (!['PARTIAL', 'UNAVAILABLE'].includes(availability)) return null;
  return <p className="owner-report-source-note">{availability === 'PARTIAL' ? 'Dữ liệu một phần. ' : ''}
    {REASONS[note?.reasonCode] || 'Chưa đủ dữ liệu để xác minh chỉ số này.'}</p>;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-007 */
function KpiCard({ report, field, title, money = true, snapshot = false }) {
  const metric = report.metrics?.[field], note = report.metricAvailability?.[field];
  const availability = metric?.availability || note?.availability;
  return <article className={`owner-report-card ${snapshot ? 'is-snapshot' : ''}`}>
    <h2>{title}</h2><ReportValue value={snapshot ? metric : metric?.total} money={money} availability={availability} />
    {['orderValue', 'successfulCollections', 'orders'].includes(field) && <p className="owner-report-channel">Thuê: <ReportValue compact value={metric?.rental} money={money} availability={report.metricAvailability?.[`${field}.rental`]?.availability || availability} /> · Bán: <ReportValue compact value={metric?.sales} money={money} availability={report.metricAvailability?.[`${field}.sales`]?.availability || availability} /></p>}
    {snapshot ? <p>Snapshot lúc tạo báo cáo; không cộng vào khoản thu theo kỳ.</p> : <p className="owner-report-growth">So với kỳ trước: {report.hasGrowthBaseline?.[field] === true
      ? <ReportValue value={report.changePercent?.[field]} percent /> : 'Chưa có cơ sở so sánh'}</p>}
    <AvailabilityNote note={note} availability={availability} />
  </article>;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-007 */
export default function OwnerReportKpis({ report }) {
  return <section aria-label="Chỉ số tổng quan" className="owner-report-kpi-section">
    <div className="owner-report-section-heading"><h2>Kết quả chính</h2><span>Giá trị đơn và số đơn theo kỳ đã chọn</span></div>
    <div className="owner-report-kpis">
      <KpiCard report={report} field="orderValue" title="Giá trị đơn hàng" />
      <KpiCard report={report} field="orders" title="Đơn hàng hợp lệ" money={false} />
      <KpiCard report={report} field="heldDepositsSnapshot" title="Cọc đang giữ · Hiện tại" snapshot />
    </div>
    <div className="owner-report-cash"><KpiCard report={report} field="successfulCollections" title="Khoản thu thành công" />
      <KpiCard report={report} field="completedRefundOutflows" title="Hoàn tiền hoàn tất" /></div>
  </section>;
}
