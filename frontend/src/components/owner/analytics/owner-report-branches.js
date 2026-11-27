import React from 'react';
import { AvailabilityNote, ReportValue } from './owner-report-kpis';
const FIELDS = [['orderValue', 'Giá trị đơn hàng', true], ['successfulCollections', 'Khoản thu thành công', true], ['completedRefundOutflows', 'Hoàn tiền hoàn tất', true], ['orders', 'Đơn hợp lệ', false]];

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-012 */
export default function OwnerReportBranches({ report }) {
  const branches = report.scope?.branches || [], values = new Map((report.branches || []).map((row) => [row.shopId, row]));
  return <section aria-label="So sánh cửa hàng" className="owner-report-section"><h2>So sánh cửa hàng</h2><p>Cùng kỳ báo cáo · Dấu — là chưa có dữ liệu xác minh.</p>
    <div className="owner-report-table-wrap" role="region" aria-label="Cuộn bảng so sánh cửa hàng" tabIndex={0}><table><caption>Tất cả cửa hàng trong phạm vi sở hữu</caption>
      <thead><tr><th scope="col">Cửa hàng</th><th scope="col">Trạng thái</th>{FIELDS.map(([field, label]) => <th scope="col" key={field}>{label}</th>)}</tr></thead>
      <tbody>{branches.map((branch) => { const row = values.get(branch.shopId); return <tr key={branch.shopId}>
        <th scope="row">{branch.name || 'Cửa hàng'}{branch.isHQ && ' · HQ'}<AvailabilityNote note={row?.metricAvailability?.orderValue} /></th><td>{branch.status === 'SUSPENDED' ? 'Tạm ngưng' : 'Hoạt động'}</td>
        {FIELDS.map(([field, , money]) => <td key={field}><ReportValue compact value={row?.metrics?.[field]?.total} money={money}
          availability={row?.metrics?.[field]?.availability || row?.metricAvailability?.[field]?.availability} /></td>)}
      </tr>; })}</tbody>
    </table></div>
    <details className="owner-report-data-details"><summary>Phân bố trạng thái đơn</summary><div className="owner-report-status">{['rental', 'sales'].map((channel) => <div key={channel}>
      <h4>{channel === 'rental' ? 'Đơn thuê' : 'Đơn bán'}</h4><dl>{Object.entries(report.orderStatusBreakdown?.[channel] || {}).map(([status, count]) =>
        <div key={status}><dt>{({ draft: 'Nháp', confirmed: 'Đã xác nhận', renting: 'Đang thuê', partially_returned: 'Trả một phần', returned: 'Đã trả', cancelled: 'Đã hủy', overdue: 'Quá hạn', processing: 'Đang xử lý', shipped: 'Đã giao vận', completed: 'Hoàn tất' })[status] || status}</dt><dd><ReportValue value={count} /></dd></div>)}</dl>
    </div>)}</div></details>
  </section>;
}
