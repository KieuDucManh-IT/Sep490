import React from 'react';
import { AvailabilityNote, ReportValue } from './owner-report-kpis';

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-014 */
function ProductRanking({ rows, title, note }) {
  const availability = note?.availability;
  return <div className="owner-report-product-ranking"><h3>{title}</h3><AvailabilityNote note={note} />{Array.isArray(rows) && rows.some((row) => row.availability === 'PARTIAL') && <p>*: Dữ liệu một phần.</p>}{availability === 'UNAVAILABLE' || !Array.isArray(rows) ? <p>Chưa có dữ liệu</p> : !rows.length ? <p>Không có sản phẩm phù hợp trong kỳ.</p> :
    <div className="owner-report-table-wrap" role="region" aria-label={`Cuộn bảng ${title.toLocaleLowerCase('vi-VN')}`} tabIndex={0}><table><caption>{title} theo kỳ đã chọn</caption><thead><tr><th scope="col">Sản phẩm</th>
      <th scope="col">Số lượng</th><th scope="col">Số đơn</th><th scope="col">Giá trị đơn</th></tr></thead><tbody>
      {rows.slice(0, 5).map((row) => <tr key={row.productId}><th scope="row">{row.name || 'Sản phẩm'}</th>
        {['quantity', 'orderCount', 'orderValue'].map((key) => <td key={key}><ReportValue compact value={row[key]} availability={row.availability || availability} money={key === 'orderValue'} /></td>)}
      </tr>)}
    </tbody></table></div>}</div>;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-014 */
export default function OwnerReportProducts({ report }) {
  const slow = report.slowMovingProducts, status = report.metricAvailability?.slowMovingProducts?.availability;
  return <section aria-label="Hiệu quả sản phẩm" className="owner-report-section"><h2>Hiệu quả sản phẩm</h2>
    <ProductRanking rows={report.topRentalProducts} title="Top 5 sản phẩm thuê" note={report.metricAvailability?.topRentalProducts} />
    <ProductRanking rows={report.topSalesProducts} title="Top 5 sản phẩm bán" note={report.metricAvailability?.topSalesProducts} />
    <details className="owner-report-data-details"><summary>Sản phẩm chậm luân chuyển</summary><p>Sẵn có hiện tại nhưng không có đơn hợp lệ trong kỳ đã chọn.</p>
    <AvailabilityNote note={report.metricAvailability?.slowMovingProducts} />
    {status === 'UNAVAILABLE' || !Array.isArray(slow) ? <p>Chưa có dữ liệu</p> : !slow.length ? <p>Không có sản phẩm phù hợp.</p> :
      <ul>{slow.map((row) => <li key={row.productId}>{row.name || 'Sản phẩm'} · Sẵn có: <ReportValue value={row.availableQuantity} availability={row.availability || status} /></li>)}</ul>}
  </details></section>;
}
