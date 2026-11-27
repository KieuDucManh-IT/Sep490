import React from 'react';
import { AvailabilityNote, ReportValue } from './owner-report-kpis';
const FIELDS = [['overdue', 'Quá hạn'], ['upcomingReturns', 'Đến hạn trong 48 giờ'], ['inspection', 'Chờ kiểm tra'], ['openDisputes', 'Tranh chấp đang mở'], ['pendingHandover', 'Chờ bàn giao'], ['incomingTransfers', 'Chuyển kho đang đến'], ['failedShipments', 'Giao hàng thất bại']];

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-015 */
function attentionTotal(report, field) {
  const owned = report.scope?.branches || [], rows = new Map((report.operationsByBranch || []).map((row) => [row.shopId, row]));
  const values = owned.map((branch) => rows.get(branch.shopId));
  const known = values.filter((row) => row?.availability !== 'UNAVAILABLE' && Number.isSafeInteger(row?.[field]) && row[field] >= 0);
  const total = known.reduce((sum, row) => sum + row[field], 0);
  if (!known.length || !Number.isSafeInteger(total)) return { value: null, availability: 'UNAVAILABLE' };
  return { value: total, availability: known.length === owned.length && known.every((row) => row.availability !== 'PARTIAL') ? 'AVAILABLE' : 'PARTIAL' };
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-015 */
export function OwnerReportAttention({ report, onReview }) {
  return <section className="owner-report-attention" aria-label="Cần chú ý hiện tại">
    <div className="owner-report-section-heading"><div><h2>Cần chú ý hiện tại</h2><p>Trạng thái lúc cập nhật, không đổi theo kỳ báo cáo.</p></div>
      <button type="button" onClick={onReview}>Xem vận hành <span aria-hidden="true">→</span></button></div>
    <div className="owner-report-attention-grid">{['overdue', 'upcomingReturns', 'pendingHandover'].map((field) => {
      const total = attentionTotal(report, field);
      return <div key={field} className={total.value > 0 ? 'has-work' : ''}><span>{FIELDS.find(([key]) => key === field)[1]}</span>
        <strong><ReportValue value={total.value} availability={total.availability} /></strong>
        {total.availability === 'UNAVAILABLE' && <small>Chưa xác minh đủ các cửa hàng.</small>}
      </div>;
    })}</div>
  </section>;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-015 */
export default function OwnerReportOperations({ report }) {
  const names = new Map((report.scope?.branches || []).map((row) => [row.shopId, row.name]));
  return <section aria-label="Snapshot vận hành" className="owner-report-section"><h2>Vận hành hiện tại</h2>
    <p>Snapshot lúc tạo báo cáo; chỉ số tổng hợp theo cửa hàng. Dấu — là chưa có dữ liệu xác minh.</p>
    <div className="owner-report-table-wrap" role="region" aria-label="Cuộn bảng vận hành" tabIndex={0}><table><caption>Các việc cần xử lý</caption><thead><tr><th scope="col">Cửa hàng</th>
      {FIELDS.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}</tr></thead><tbody>
      {(report.operationsByBranch || []).map((row) => <tr key={row.shopId}><th scope="row">{names.get(row.shopId) || 'Cửa hàng'}<AvailabilityNote note={row} /></th>
        {FIELDS.map(([key]) => <td key={key}><ReportValue compact value={row[key]} availability={row.availability} /></td>)}
      </tr>)}
    </tbody></table></div>
  </section>;
}
