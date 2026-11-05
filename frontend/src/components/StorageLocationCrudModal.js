import React, { useState } from 'react';
import { X } from 'lucide-react';
import '../styles/WarehouseManager.css';

const idOf = (value) => (value && typeof value === 'object' ? value._id : value) || '';
const typeLabel = { zone: 'Zone', row: 'Row', shelf: 'Shelf', temporary_area: 'Khu tạm' };
const capacityOf = (value) => Number.isInteger(Number(value)) && value !== null && value !== '' ? Number(value) : 0;

export default function StorageLocationCrudModal({ mode, record, parent, locations, rows, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    locationId: idOf(record?.locationId) || idOf(parent?.locationId) || (locations.length === 1 ? locations[0]._id : ''),
    parentStorageId: idOf(record?.parentStorageId) || parent?._id || '',
    type: record?.type || (!parent ? 'zone' : parent.type === 'zone' ? 'row' : 'shelf'),
    code: record?.code || '',
    suffix: '',
    name: record?.name || '',
    maxCapacity: record?.maxCapacity ?? '',
    status: record?.status || 'active',
  }));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const readOnly = mode === 'view';
  const parentLocation = locations.find((location) => location._id === form.locationId);
  const parentDetails = parent || rows.find((row) => row._id === form.parentStorageId);
  const codePrefix = mode === 'create' && parent ? parent.code + '-' : '';
  const minimumCapacity = record ? rows.filter((row) => idOf(row.parentStorageId) === record._id).reduce((sum, row) => sum + capacityOf(row.maxCapacity), 0) : 0;
  const capacityLimit = parentDetails
    ? Math.max(0, capacityOf(parentDetails.maxCapacity) - rows.filter((row) => idOf(row.parentStorageId) === parentDetails._id && row._id !== record?._id).reduce((sum, row) => sum + capacityOf(row.maxCapacity), 0))
    : Math.max(0, capacityOf(parentLocation?.maxCapacity) - rows.filter((row) => !idOf(row.parentStorageId) && idOf(row.locationId) === form.locationId && row._id !== record?._id).reduce((sum, row) => sum + capacityOf(row.maxCapacity), 0));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError('');
    const code = mode === 'create' ? codePrefix + form.suffix.trim() : form.code.trim();
    const payload = {
      locationId: form.locationId,
      parentStorageId: form.parentStorageId || null,
      type: form.type,
      code,
      name: form.name.trim(),
      maxCapacity: form.maxCapacity === '' ? null : Number(form.maxCapacity),
      status: form.status,
    };
    try { await onSave(payload); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="wm-crud-modal wm-storage-modal" role="dialog" aria-modal="true" aria-labelledby="wm-storage-modal-title">
      <header><div><span>{mode === 'create' ? 'THÊM MỚI' : mode === 'edit' ? 'CẬP NHẬT' : 'CHI TIẾT'}</span><h2 id="wm-storage-modal-title">{mode === 'create' ? 'Thêm ' + typeLabel[form.type] : typeLabel[form.type] + ' — ' + (record?.code || '')}</h2></div><button type="button" className="wm-modal-close" onClick={onClose} aria-label="Đóng"><X size={20} /></button></header>
      {error && <div className="wm-error">{error}</div>}
      {readOnly ? <div className="wm-detail-grid">
        <div><small>Kho / cửa hàng</small><strong>{parentLocation?.name || record?.locationId?.name || '—'}</strong></div>
        <div><small>Vị trí cha</small><strong>{parentDetails?.code || '—'}</strong></div>
        <div><small>Loại</small><strong>{typeLabel[form.type]}</strong></div>
        <div><small>Mã vị trí</small><strong>{record?.code}</strong></div>
        <div><small>Tên vị trí</small><strong>{record?.name}</strong></div>
        <div><small>Sức chứa tối đa</small><strong>{record?.maxCapacity ?? '—'} cái</strong></div>
        <div><small>Trạng thái</small><strong>{record?.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}</strong></div>
      </div> : <form className="wm-form" onSubmit={submit}>
        <label>Kho / cửa hàng{mode === 'create' && !parent ? <select required value={form.locationId} onChange={(event) => setForm({ ...form, locationId: event.target.value })}><option value="">Chọn kho/cửa hàng</option>{locations.map((location) => <option key={location._id} value={location._id}>{location.code} — {location.name}</option>)}</select> : <input readOnly value={parentLocation?.name || record?.locationId?.name || ''} />}</label>
        <label>Vị trí cha<input readOnly value={parentDetails?.code || 'Không có (vị trí gốc)'} /></label>
        <label>Loại<input readOnly value={typeLabel[form.type]} /></label>
        <label>Mã vị trí{codePrefix ? <span className="wm-code-input"><span>{codePrefix}</span><input required value={form.suffix} onChange={(event) => setForm({ ...form, suffix: event.target.value })} /></span> : <input required readOnly={readOnly} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />}</label>
        <label>Tên vị trí<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Sức chứa tối đa (cái)<input type="number" min={minimumCapacity} max={capacityLimit} step="1" value={form.maxCapacity} onChange={(event) => setForm({ ...form, maxCapacity: event.target.value })} /><small>Còn tối đa {capacityLimit} cái; tối thiểu {minimumCapacity} cái để chứa các vị trí con.</small></label>
        <label>Trạng thái<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></label>
        <footer><button type="button" className="secondary" onClick={onClose}>Hủy</button><button disabled={saving}>{saving ? 'Đang lưu...' : mode === 'edit' ? 'Lưu thay đổi' : 'Tạo vị trí'}</button></footer>
      </form>}
      {readOnly && <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={onClose}>Đóng</button></footer>}
    </section>
  </div>;
}
