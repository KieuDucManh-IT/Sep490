import React from 'react';
import { AvailabilityNote, ReportValue } from './owner-report-kpis';
const FIELDS = [['available', 'Sẵn có'], ['reserved', 'Đã giữ chỗ'], ['renting', 'Đang thuê'], ['unavailable', 'Bảo trì / không khả dụng'], ['inTransit', 'Đang vận chuyển']];

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-013 */
export default function OwnerReportInventory({ report }) {
  const names = new Map((report.scope?.branches || []).map((row) => [row.shopId, row.name]));
  const rows = report.storeInventoryByBranch || [], warehouse = report.centralWarehouseInventory;
  return <section aria-label="Snapshot tồn kho" className="owner-report-section"><h2>Tồn kho hiện tại</h2>
    <p>Snapshot lúc tạo báo cáo; không đổi theo kỳ. Bảo trì nằm trong số không khả dụng, không cộng hai lần. Dấu — là chưa có dữ liệu xác minh.</p>
    <div className="owner-report-table-wrap" role="region" aria-label="Cuộn bảng tồn kho" tabIndex={0}><table><caption>Tồn tại cửa hàng</caption><thead><tr><th scope="col">Cửa hàng</th>
      {FIELDS.map(([key, label]) => <th scope="col" key={key}>{label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.shopId}><th scope="row">{names.get(row.shopId) || 'Cửa hàng'}<AvailabilityNote note={row} /></th>
        {FIELDS.map(([key]) => <td key={key}><ReportValue compact value={row[key]} availability={row.availability} /></td>)}</tr>)}</tbody>
    </table></div>
    <h3>Kho trung tâm · Tách khỏi tồn cửa hàng</h3><AvailabilityNote note={warehouse} /><dl className="owner-report-snapshot">
      {FIELDS.map(([key, label]) => <div key={key}><dt>{label}</dt><dd><ReportValue value={warehouse?.[key]} availability={warehouse?.availability} /></dd></div>)}
    </dl>
  </section>;
}
