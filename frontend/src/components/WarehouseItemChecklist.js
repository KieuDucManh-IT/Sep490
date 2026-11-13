import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

const idOf = (item) => String(item?._id || item || '');

export default function WarehouseItemChecklist({ items = [], selectedIds = [], maxSelectable = Infinity, onToggle, renderExtra, emptyMessage = 'Không có mặt hàng phù hợp.' }) {
  const [query, setQuery] = useState('');
  const [condition, setCondition] = useState('');
  const conditions = useMemo(() => [...new Set(items.map((item) => item.condition).filter(Boolean))], [items]);
  const visible = useMemo(() => items.filter((item) => {
    const text = [item.itemCode, item.serialNumber, item.condition, item.status].filter(Boolean).join(' ').toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!condition || item.condition === condition);
  }), [items, query, condition]);
  return <div className="wm-checklist">
    <div className="wm-checklist-toolbar"><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã hàng hoặc serial..." /></label>
      {conditions.length > 1 && <select aria-label="Lọc theo tình trạng" value={condition} onChange={(event) => setCondition(event.target.value)}><option value="">Mọi tình trạng</option>{conditions.map((value) => <option key={value} value={value}>{value}</option>)}</select>}
      <small>{selectedIds.length}/{Number.isFinite(maxSelectable) ? maxSelectable : items.length} đã chọn</small>
    </div>
    <div className="wm-checklist-items">{visible.length ? visible.map((item) => {
      const id = idOf(item); const checked = selectedIds.includes(id);
      return <div key={id} className="wm-checklist-row"><label className="wm-checklist-main"><input type="checkbox" checked={checked} disabled={!checked && selectedIds.length >= maxSelectable} onChange={(event) => onToggle(id, event.target.checked)} /><span><strong>{item.itemCode || item.serialNumber || id.slice(-6)}</strong><small>{item.serialNumber || 'Không có serial'} · {item.condition || 'Chưa rõ tình trạng'} · {item.status || ''}</small></span></label>{renderExtra?.(item, id, checked)}</div>;
    }) : <p className="wm-checklist-empty">{query || condition ? 'Không tìm thấy item khớp bộ lọc.' : emptyMessage}</p>}</div>
  </div>;
}
