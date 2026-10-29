import React, { useState } from 'react';
import { X } from 'lucide-react';
import '../styles/WarehouseManager.css';

const getInitialValues = (config, record) => Object.fromEntries(config.fields.map(([key]) => [key, record?.[key]?._id || record?.[key] || '']));
const display = (value) => value && typeof value === 'object' ? value.name || value.code || value._id : value ?? '—';

export default function WarehouseCrudModal({ config, mode, record, choices, onClose, onSave }) {
  const [form, setForm] = useState(() => getInitialValues(config, record));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const readOnly = mode === 'view';

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true); setError('');
    const payload = {};
    config.fields.forEach(([key, , type, required]) => {
      if (form[key] !== '') payload[key] = type === 'number' ? Number(form[key]) : form[key];
      else if (!required && type === 'relation') payload[key] = null;
      else if (!required && type === 'text') payload[key] = '';
    });
    try { await onSave(payload); onClose(); }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  return <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="wm-crud-modal" role="dialog" aria-modal="true" aria-labelledby="wm-modal-title">
      <header><div><span>{mode === 'create' ? 'THÊM MỚI' : mode === 'edit' ? 'CẬP NHẬT' : 'CHI TIẾT'}</span><h2 id="wm-modal-title">{config.title}</h2></div><button type="button" className="wm-modal-close" onClick={onClose} aria-label="Đóng"><X size={20} /></button></header>
      {error && <div className="wm-error">{error}</div>}
      {readOnly ? <div className="wm-detail-grid">{config.fields.map(([key, label]) => <div key={key}><small>{label}</small><strong>{display(record?.[key]) || '—'}</strong></div>)}</div> : <form className="wm-form" onSubmit={submit}>
        {config.fields.map(([key, label, type, required, optionOrResource, displayKey]) => <label key={key}>{label}
          {type === 'select' || type === 'relation' ? <select required={required} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })}>
            <option value="">{required ? 'Chọn...' : 'Không chọn'}</option>
            {(type === 'relation' ? choices[optionOrResource] || [] : (optionOrResource || []).map((option) => { const [value, text] = option.split(':'); return { _id: value, [displayKey || 'name']: text }; }))
              .filter((item) => key !== 'parentCategoryId' || item._id !== record?._id)
              .map((item) => <option key={item._id} value={item._id}>{item[displayKey || 'name'] || item.code || item._id}</option>)}
          </select> : <input required={required} type={type} min={type === 'number' ? '0' : undefined} step={type === 'number' ? '1' : undefined} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}
        </label>)}
        <footer><button type="button" className="secondary" onClick={onClose}>Hủy</button><button disabled={saving}>{saving ? 'Đang lưu...' : mode === 'edit' ? 'Lưu thay đổi' : 'Tạo mới'}</button></footer>
      </form>}
      {readOnly && <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={onClose}>Đóng</button></footer>}
    </section>
  </div>;
}
