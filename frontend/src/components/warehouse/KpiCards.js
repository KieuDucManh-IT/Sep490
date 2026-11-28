import React from 'react';
import '../../styles/WarehouseShared.css';

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString('vi-VN');
  return value;
}

/**
 * Hàng thẻ số liệu (KPI) đầu trang, theo kiểu trang tồn kho chi nhánh.
 * @param {object} props
 * @param {Array<{key?: string, label: string, value: number|string, unit?: string, hint?: string,
 *   tone?: 'default'|'warn'|'danger'|'success'}>} props.items danh sách thẻ; `tone` để tô màu cảnh báo
 * @param {boolean} [props.loading] đang tải thì hiện "…" thay cho số
 */
export default function KpiCards({ items = [], loading = false }) {
  if (!items.length) return null;
  return (
    <section className="wh-kpi-grid">
      {items.map((item) => {
        const tone = item.tone && item.tone !== 'default' ? item.tone : '';
        return (
          <article key={item.key || item.label} className={`wh-kpi-card ${tone}`}>
            <span className="wh-kpi-label">{item.label}</span>
            <strong className="wh-kpi-value">
              {loading ? '…' : formatValue(item.value)}
              {item.unit && <span className="wh-kpi-unit">{item.unit}</span>}
            </strong>
            {item.hint && <small className="wh-kpi-hint">{item.hint}</small>}
          </article>
        );
      })}
    </section>
  );
}
