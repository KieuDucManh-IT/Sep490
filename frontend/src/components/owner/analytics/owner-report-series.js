import React, { useState } from 'react';
import { AvailabilityNote, ReportValue } from './owner-report-kpis';
const FIELDS = [['orderValue', 'Giá trị đơn hàng', true], ['successfulCollections', 'Khoản thu thành công', true], ['completedRefundOutflows', 'Hoàn tiền hoàn tất', true], ['orders', 'Đơn hàng hợp lệ', false]];
const axisFormat = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 });
const knownValue = (row, field) => row[field]?.availability === 'UNAVAILABLE' || row.metricAvailability?.[field]?.availability === 'UNAVAILABLE'
  || !Number.isSafeInteger(row[field]?.total) || row[field].total < 0 ? null : row[field].total;

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-018 */
function axisLabel(row) {
  const label = String(row.label || ''), time = label.match(/\d{2}:\d{2}$/), month = label.match(/^(\d{4})-(\d{2})$/);
  if (time) return time[0];
  if (month) return month[2] + '/' + month[1];
  return Number.isFinite(Date.parse(row.startAt)) && label.length > 10
    ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(row.startAt)) : label;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-006 */
function axisMaximum(value) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 5, 10].map((step) => step * magnitude).find((step) => step >= value) || value;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-006 */
function SeriesChart({ rows, field, label, money, values }) {
  const max = axisMaximum(Math.max(...values.filter((value) => value !== null)));
  const ticks = money || max >= 4 ? [0, money ? max / 2 : Math.floor(max / 2), max] : Array.from({ length: max + 1 }, (_, index) => index);
  const labels = [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])];
  const width = 596 / rows.length;
  return <svg role="img" aria-label={`${label} theo kỳ; đơn vị ${money ? 'đồng' : 'đơn'}; số liệu chi tiết trong bảng bên dưới`} viewBox="0 0 720 236" className="owner-report-chart">
    <title>{label}</title>
    {ticks.map((tick) => <g key={tick}><line x1="104" x2="700" y1={188 - tick / max * 160} y2={188 - tick / max * 160} className="owner-report-gridline" />
      <text x="94" y={192 - tick / max * 160} textAnchor="end">{axisFormat.format(tick)}</text></g>)}
    {values.map((value, index) => value !== null ? <rect key={rows[index].startAt} x={104 + index * width + width * .15} y={188 - value / max * 160}
      width={width * .7} height={value / max * 160} rx={rows.length < 40 ? 2 : 0} className={`owner-report-bar owner-report-bar-${field}`}>
      <title>{rows[index].label}: {value.toLocaleString('vi-VN')}{money ? ' ₫' : ' đơn'}{rows[index][field]?.availability === 'PARTIAL' || rows[index].metricAvailability?.[field]?.availability === 'PARTIAL' ? ' (Dữ liệu một phần)' : ''}</title></rect> : null)}
    {labels.map((index, position) => <text key={index} x={position === 0 ? 104 : position === labels.length - 1 ? 700 : 402} y="224"
      textAnchor={position === 0 ? 'start' : position === labels.length - 1 ? 'end' : 'middle'}>{axisLabel(rows[index])}</text>)}
  </svg>;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-010 */
function MetricPlot({ report, field, label, money, rows }) {
  const values = rows.map((row) => knownValue(row, field)), known = values.filter((value) => value !== null);
  const partial = rows.some((row) => row[field]?.availability === 'PARTIAL' || row.metricAvailability?.[field]?.availability === 'PARTIAL');
  if (!known.length) return <div className="owner-report-chart-empty"><strong>Chưa thể vẽ {label.toLocaleLowerCase('vi-VN')}</strong>
    <p>Chưa có dữ liệu xác minh cho chỉ số này trong kỳ.</p><AvailabilityNote note={report.metricAvailability?.[field]} availability="UNAVAILABLE" /></div>;
  if (known.every((value) => value === 0)) return <div className="owner-report-chart-empty"><span className="owner-report-empty-zero" aria-hidden="true">0</span>
    <strong>{known.length === rows.length && !partial ? `Chưa phát sinh ${label.toLocaleLowerCase('vi-VN')} trong kỳ` : 'Các mốc có số liệu đều bằng 0'}</strong>
    <p>{known.length < rows.length || partial ? 'Một phần dữ liệu còn thiếu; chưa thể kết luận cho cả kỳ.' : 'Hãy chọn kỳ khác để xem diễn biến và so sánh.'}</p></div>;
  return <><p className="owner-report-chart-unit">Đơn vị: {money ? 'đồng (₫)' : 'đơn'} · {known.length}/{rows.length} mốc có số liệu</p>
    <SeriesChart rows={rows} field={field} label={label} money={money} values={values} />
    {(known.length < rows.length || partial) && <p className="owner-report-source-note">Dữ liệu một phần; các mốc thiếu được để trống, không quy thành 0.</p>}</>;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-006 */
function SeriesTable({ rows }) {
  return <details className="owner-report-data-details" open={rows.length <= 2}><summary>Xem bảng số liệu · {rows.length} mốc thời gian</summary>
    <div className="owner-report-table-wrap" role="region" aria-label="Chi tiết mốc thời gian" tabIndex={0}><table><caption>Số liệu theo từng mốc thời gian</caption>
      <thead><tr><th scope="col">Mốc</th>{FIELDS.map(([field, label]) => <th scope="col" key={field}>{label}</th>)}</tr></thead>
      <tbody>{rows.map((row) => <tr key={row.startAt}><th scope="row">{row.label}</th>{FIELDS.map(([field, , money]) => <td key={field}>
        <ReportValue compact value={row[field]?.total} money={money} availability={row[field]?.availability || row.metricAvailability?.[field]?.availability} />
      </td>)}</tr>)}</tbody>
    </table></div><p>Dấu —: chưa có dữ liệu xác minh · *: dữ liệu một phần.</p>
  </details>;
}

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-006 */
export default function OwnerReportSeries({ report }) {
  const [selected, setSelected] = useState('orderValue'), rows = report.series || [];
  const [field, label, money] = FIELDS.find(([key]) => key === selected);
  return <section aria-label="Diễn biến theo kỳ" className="owner-report-section"><h2>Diễn biến theo kỳ</h2>
    <p>Cọc, tồn kho và vận hành là snapshot hiện tại, không nằm trong chuỗi số liệu này.</p>
    {!rows.length ? <p>Chưa có dữ liệu theo kỳ.</p> : <>
      <div className="owner-report-metric-switch" role="group" aria-label="Chỉ số biểu đồ">{FIELDS.map(([key, title]) => <button key={key} type="button"
        aria-pressed={selected === key} onClick={() => setSelected(key)}>{title}</button>)}</div>
      <div aria-live="polite"><MetricPlot report={report} field={field} label={label} money={money} rows={rows} /></div>
      <SeriesTable rows={rows} />
    </>}
  </section>;
}
