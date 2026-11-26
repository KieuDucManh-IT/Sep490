import React from 'react';
const PRESETS = [['TODAY', 'Hôm nay'], ['WEEK', 'Tuần này'], ['MONTH', 'Tháng này'], ['QUARTER', 'Quý này'], ['YEAR', 'Năm nay'], ['CUSTOM', 'Tùy chọn']];

/** @ears .sdd/features/shop-owner-analytics/SPEC.md#REQ-SOA-004 */
export default function OwnerReportFilters({ filters, onChange, disabled = false }) {
  return <fieldset className="owner-report-filters" disabled={disabled}>
    <legend>Kỳ báo cáo</legend>
    <label>Kỳ <select value={filters.timeRange} onChange={(event) => onChange({ timeRange: event.target.value })}>
      {PRESETS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    {filters.timeRange === 'CUSTOM' && <>
      <label>Từ ngày <input type="date" value={filters.startDate || ''} onChange={(event) => onChange({ startDate: event.target.value })} /></label>
      <label>Đến ngày <input type="date" value={filters.endDate || ''} onChange={(event) => onChange({ endDate: event.target.value })} /></label>
    </>}
    <p>Theo lịch Việt Nam (UTC+07), tối đa 24 tháng. Kỳ kết thúc hôm nay tính đến lúc tạo báo cáo.</p>
  </fieldset>;
}
