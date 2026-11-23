import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { ITEM_STATUS_LABELS, labelOf } from '../constants/warehouseLabels';

const idOf = (item) => String(item?._id || item || '');

/** Danh sách chọn món (TASK-016: lọc theo trạng thái món thay cho tình trạng). */
export default function WarehouseItemChecklist({ items = [], selectedIds = [], maxSelectable = Infinity, onToggle, renderExtra, emptyMessage = 'Không có mặt hàng phù hợp.' }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const statuses = useMemo(() => [...new Set(items.map((item) => item.status).filter(Boolean))], [items]);
  const visible = useMemo(() => items.filter((item) => {
    const text = [item.itemCode, item.serialNumber].filter(Boolean).join(' ').toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (!status || item.status === status);
  }), [items, query, status]);
  return <div className="wm-checklist">
    <div className="wm-checklist-toolbar"><label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã hàng hoặc serial..." /></label>
      {statuses.length > 1 && <select aria-label="Lọc theo trạng thái" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Mọi trạng thái</option>{statuses.map((value) => <option key={value} value={value}>{labelOf(ITEM_STATUS_LABELS, value, value)}</option>)}</select>}
      <small>{selectedIds.length}/{Number.isFinite(maxSelectable) ? maxSelectable : items.length} đã chọn</small>
    </div>
    <div className="wm-checklist-items">{visible.length ? visible.map((item) => {
      const id = idOf(item); const checked = selectedIds.includes(id);
      return <div key={id} className="wm-checklist-row"><label className="wm-checklist-main"><input type="checkbox" checked={checked} disabled={!checked && selectedIds.length >= maxSelectable} onChange={(event) => onToggle(id, event.target.checked)} /><span><strong>{item.itemCode || item.serialNumber || id.slice(-6)}</strong><small>{item.serialNumber || 'Không có serial'}{item.status ? ` · ${labelOf(ITEM_STATUS_LABELS, item.status, item.status)}` : ''}</small></span></label>{renderExtra?.(item, id, checked)}</div>;
    }) : <p className="wm-checklist-empty">{query || status ? 'Không tìm thấy món hàng khớp bộ lọc.' : emptyMessage}</p>}</div>
  </div>;
}
