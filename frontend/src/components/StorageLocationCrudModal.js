import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { STORAGE_TYPE_LABELS as typeLabel } from '../constants/warehouseLabels';
import '../styles/WarehouseManager.css';

const idOf = (value) => (value && typeof value === 'object' ? value._id : value) || '';
const capacityOf = (value) => Number.isInteger(Number(value)) && value !== null && value !== '' ? Number(value) : 0;

/**
 * Form tạo / sửa vị trí lưu trữ. Vị trí chỉ thuộc kho tổng (TASK-014 A2): không có ô chọn kho,
 * backend luôn gán kho tổng.
 * @param {object} props.warehouse kho tổng (`{ _id, name, maxCapacity }`)
 */
export default function StorageLocationCrudModal({ mode, record, parent, warehouse, rows, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
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
  const parentDetails = parent || rows.find((row) => row._id === form.parentStorageId);
  const codePrefix = mode === 'create' && parent ? parent.code + '-' : '';
  const minimumCapacity = record ? rows.filter((row) => idOf(row.parentStorageId) === record._id).reduce((sum, row) => sum + capacityOf(row.maxCapacity), 0) : 0;
  const capacityLimit = parentDetails
    ? Math.max(0, capacityOf(parentDetails.maxCapacity) - rows.filter((row) => idOf(row.parentStorageId) === parentDetails._id && row._id !== record?._id).reduce((sum, row) => sum + capacityOf(row.maxCapacity), 0))
    : Math.max(0, capacityOf(warehouse?.maxCapacity) - rows.filter((row) => !idOf(row.parentStorageId) && row._id !== record?._id).reduce((sum, row) => sum + capacityOf(row.maxCapacity), 0));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const usesPrefix = mode === 'create' && Boolean(codePrefix);
    const codeInput = usesPrefix ? form.suffix.trim() : form.code.trim();
    if (!codeInput) { setError('Vui lòng nhập mã vị trí.'); return; }
    setSaving(true);
    const code = usesPrefix ? codePrefix + codeInput : codeInput;
    const payload = {
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

  let eyebrow = 'CHI TIẾT';
  if (mode === 'create') eyebrow = 'THÊM MỚI';
  if (mode === 'edit') eyebrow = 'CẬP NHẬT';
  const title = mode === 'create' ? `Thêm ${typeLabel[form.type].toLowerCase()}` : `${typeLabel[form.type]} — ${record?.code || ''}`;
  let submitText = 'Tạo vị trí';
  if (mode === 'edit') submitText = 'Lưu thay đổi';
  if (saving) submitText = 'Đang lưu...';

  return <Modal show onHide={onClose} size="lg" centered scrollable>
    <Modal.Header closeButton>
      <div><small className="wh-page-eyebrow">{eyebrow}</small><Modal.Title as="h5">{title}</Modal.Title></div>
    </Modal.Header>
    {readOnly ? <>
      <Modal.Body className="wm-storage-modal">
        <div className="wm-detail-grid">
          <div><small>Kho</small><strong>{warehouse?.name || record?.locationId?.name || '—'}</strong></div>
          <div><small>Vị trí cha</small><strong>{parentDetails?.code || '—'}</strong></div>
          <div><small>Loại</small><strong>{typeLabel[form.type]}</strong></div>
          <div><small>Mã vị trí</small><strong>{record?.code}</strong></div>
          <div><small>Tên vị trí</small><strong>{record?.name}</strong></div>
          <div><small>Sức chứa tối đa</small><strong>{record?.maxCapacity ?? '—'} cái</strong></div>
          <div><small>Trạng thái</small><strong>{record?.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}</strong></div>
        </div>
      </Modal.Body>
      <Modal.Footer><Button variant="secondary" onClick={onClose}>Đóng</Button></Modal.Footer>
    </> : <form onSubmit={submit}>
      <Modal.Body className="wm-storage-modal">
        {error && <div className="wm-error">{error}</div>}
        <div className="wm-form">
          <p className="wm-storage-warehouse mb-0">Kho: <strong>{warehouse?.name || record?.locationId?.name || 'Kho tổng'}</strong></p>
          <label>Vị trí cha<input readOnly value={parentDetails?.code || 'Không có (vị trí gốc)'} /></label>
          <label>Loại<input readOnly value={typeLabel[form.type]} /></label>
          <label>Mã vị trí{codePrefix ? <span className="wm-code-input"><span>{codePrefix}</span><input required value={form.suffix} onChange={(event) => setForm({ ...form, suffix: event.target.value })} /></span> : <input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />}</label>
          <label>Tên vị trí<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Sức chứa tối đa (cái)<input type="number" min={minimumCapacity} max={capacityLimit} step="1" value={form.maxCapacity} onChange={(event) => setForm({ ...form, maxCapacity: event.target.value })} /><small>Còn tối đa {capacityLimit} cái; tối thiểu {minimumCapacity} cái để chứa các vị trí con.</small></label>
          <label>Trạng thái<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></label>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" onClick={onClose}>Hủy</Button>
        <Button variant="dark" type="submit" disabled={saving}>{submitText}</Button>
      </Modal.Footer>
    </form>}
  </Modal>;
}
