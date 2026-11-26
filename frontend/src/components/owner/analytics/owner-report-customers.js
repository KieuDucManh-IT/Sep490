import React from 'react';
import { AvailabilityNote, ReportValue } from './owner-report-kpis';
const FIELDS = [['unique', 'Khách hoàn tất đơn'], ['new', 'Khách mới'], ['returning', 'Khách quay lại'], ['returningRate', 'Tỷ lệ quay lại']];

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-016 */
export default function OwnerReportCustomers({ report }) {
  const customers = report.metrics?.customers, availability = customers?.availability || report.metricAvailability?.customers?.availability;
  return <section aria-label="Khách hàng theo kỳ" className="owner-report-section"><h2>Khách hàng theo kỳ</h2>
    <p>Khách có tài khoản, đếm một lần trên toàn bộ cửa hàng sở hữu. Khách quay lại đã hoàn tất đơn trước kỳ; không bao gồm khách vãng lai.</p>
    <AvailabilityNote note={report.metricAvailability?.customers} availability={availability} />
    <dl className="owner-report-customer-metrics">{FIELDS.map(([key, label]) => <div key={key}><dt>{label}</dt>
      <dd><ReportValue value={customers?.[key]} availability={availability} percent={key === 'returningRate'} /></dd></div>)}</dl>
  </section>;
}
