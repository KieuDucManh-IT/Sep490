import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Modal, Nav } from 'react-bootstrap';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import {
  CONDITION_LABELS,
  DISPOSAL_METHOD_LABELS as METHOD_LABELS,
  DISPOSAL_STATUS_LABELS,
  ITEM_STATUS_LABELS,
  MAINTENANCE_RESULT_LABELS as RESULT_LABELS,
  MAINTENANCE_STATUS_LABELS as RECORD_STATUS_LABELS,
  MAINTENANCE_TYPE_LABELS as TYPE_LABELS,
} from '../../constants/warehouseLabels';
import maintenanceService from '../../services/warehouse/maintenanceService';
import inventoryLocationService from '../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../services/warehouse/storageLocationService';
import '../../styles/ShopDashboard.css';
import '../../styles/WarehouseManager.css';
import '../../styles/WarehouseShared.css';
import '../../styles/WarehouseUx.css';

const RESTORED_CONDITIONS = ['new', 'good', 'worn'];

const idOf = (value) => String(value?._id || value || '');
const label = (map, key) => map[key] || 'Không xác định';
const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')} đ`;
const dateTime = (value) => (value ? new Date(value).toLocaleString('vi-VN') : '');
const errorText = (error) => {
  if (error?.status === 403) return error.message || 'Bạn không có quyền thực hiện thao tác này.';
  return error?.message || 'Không thể thực hiện thao tác.';
};

function ItemCell({ item }) {
  const variant = item?.variantId;
  const product = variant?.productId;
  return <div>
    <strong>{product?.name || 'Sản phẩm'}</strong>
    <div className="wm-row-summary">
      <span>Mã món: <strong>{item?.itemCode || '—'}</strong></span>
      {item?.serialNumber && <span>Serial: {item.serialNumber}</span>}
      {variant?.sku && <span>SKU: {variant.sku}</span>}
      {(variant?.size || variant?.color) && <span>{[variant.size, variant.color].filter(Boolean).join(' / ')}</span>}
    </div>
  </div>;
}

function StatusBadge({ status, map }) {
  return <span className={`wm-status-badge status-${status}`}>{label(map, status)}</span>;
}

function ModalError({ message }) {
  return message ? <div className="alert alert-danger mt-3 mb-0 py-2">{message}</div> : null;
}

/* --------- Modal tạo phiếu giặt/sửa --------- */
function CreateMaintenanceModal({ item, staff, onHide, onDone }) {
  const [form, setForm] = useState({ maintenanceType: 'cleaning', issueDescription: '', assignedTo: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const valid = form.issueDescription.trim() && form.assignedTo;
  const submit = async (event) => {
    event.preventDefault();
    if (!valid) return;
    setSubmitting(true); setError('');
    try {
      await maintenanceService.create({ itemId: item._id, ...form, issueDescription: form.issueDescription.trim() });
      onDone('Đã tạo phiếu giặt/sửa.');
    } catch (e) { setError(errorText(e)); if (e?.status === 409) onDone(null, true); }
    finally { setSubmitting(false); }
  };
  return <Modal show onHide={submitting ? undefined : onHide} centered>
    <Form onSubmit={submit}>
      <Modal.Header closeButton={!submitting}><Modal.Title as="h5">Tạo phiếu giặt/sửa</Modal.Title></Modal.Header>
      <Modal.Body>
        <ItemCell item={item} />
        <Form.Group className="mt-3">
          <Form.Label>Loại xử lý</Form.Label>
          <Form.Select value={form.maintenanceType} disabled={submitting} onChange={(e) => setForm({ ...form, maintenanceType: e.target.value })}>
            {Object.entries(TYPE_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </Form.Select>
        </Form.Group>
        <Form.Group className="mt-3">
          <Form.Label>Mô tả vấn đề <span className="text-danger">*</span></Form.Label>
          <Form.Control as="textarea" rows={3} maxLength={1000} value={form.issueDescription} disabled={submitting} onChange={(e) => setForm({ ...form, issueDescription: e.target.value })} placeholder="Ví dụ: vết bẩn ở tay áo, sứt chỉ đường may" />
        </Form.Group>
        <Form.Group className="mt-3">
          <Form.Label>Nhân viên phụ trách <span className="text-danger">*</span></Form.Label>
          <Form.Select value={form.assignedTo} disabled={submitting} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
            <option value="">Chọn nhân viên kho</option>
            {staff.map((user) => <option key={user._id} value={user._id}>{user.FullName || user.Email}</option>)}
          </Form.Select>
          {!staff.length && <Form.Text muted>Chưa có nhân viên kho đang hoạt động.</Form.Text>}
        </Form.Group>
        <ModalError message={error} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" disabled={submitting} onClick={onHide}>Đóng</Button>
        <Button variant="dark" type="submit" disabled={submitting || !valid}>{submitting ? 'Đang tạo...' : 'Tạo phiếu'}</Button>
      </Modal.Footer>
    </Form>
  </Modal>;
}

/* --------- Modal đề xuất thanh lý --------- */
function CreateDisposalModal({ item, onHide, onDone }) {
  const [form, setForm] = useState({ reason: '', method: 'discard', estimatedValue: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const valid = form.reason.trim() && (form.estimatedValue === '' || Number(form.estimatedValue) >= 0);
  const submit = async (event) => {
    event.preventDefault();
    if (!valid) return;
    setSubmitting(true); setError('');
    try {
      await maintenanceService.createDisposal({ itemId: item._id, reason: form.reason.trim(), method: form.method, estimatedValue: form.estimatedValue === '' ? null : Number(form.estimatedValue) });
      onDone('Đã tạo đề xuất thanh lý.');
    } catch (e) { setError(errorText(e)); if (e?.status === 409) onDone(null, true); }
    finally { setSubmitting(false); }
  };
  return <Modal show onHide={submitting ? undefined : onHide} centered>
    <Form onSubmit={submit}>
      <Modal.Header closeButton={!submitting}><Modal.Title as="h5">Đề xuất thanh lý</Modal.Title></Modal.Header>
      <Modal.Body>
        <ItemCell item={item} />
        <p className="mt-3 mb-0 small text-muted">Món hàng sẽ bị khóa (không điều chuyển, không cho thuê) cho tới khi đề xuất được duyệt hoặc từ chối.</p>
        <Form.Group className="mt-3">
          <Form.Label>Lý do <span className="text-danger">*</span></Form.Label>
          <Form.Control as="textarea" rows={3} maxLength={1000} value={form.reason} disabled={submitting} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </Form.Group>
        <Form.Group className="mt-3">
          <Form.Label>Cách thanh lý</Form.Label>
          <Form.Select value={form.method} disabled={submitting} onChange={(e) => setForm({ ...form, method: e.target.value })}>
            {Object.entries(METHOD_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </Form.Select>
        </Form.Group>
        <Form.Group className="mt-3">
          <Form.Label>Giá trị ước tính (VND, không bắt buộc)</Form.Label>
          <Form.Control type="number" min="0" step="1000" value={form.estimatedValue} disabled={submitting} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} />
        </Form.Group>
        <ModalError message={error} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" disabled={submitting} onClick={onHide}>Đóng</Button>
        <Button variant="danger" type="submit" disabled={submitting || !valid}>{submitting ? 'Đang gửi...' : 'Gửi đề xuất'}</Button>
      </Modal.Footer>
    </Form>
  </Modal>;
}

/* --------- Modal hoàn tất phiếu (WS) --------- */
function CompleteMaintenanceModal({ record, shelves, onHide, onDone }) {
  const [form, setForm] = useState({ repairResult: '', afterCondition: '', targetStorageId: '', disposalMethod: '', repairDescription: '', cost: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const costValid = form.cost === '' || (Number.isFinite(Number(form.cost)) && Number(form.cost) >= 0);
  const valid = Boolean(form.repairResult) && costValid
    && (form.repairResult !== 'success' || (form.afterCondition && form.targetStorageId))
    && (form.repairResult !== 'unrepairable' || (form.disposalMethod && form.repairDescription.trim()));
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const submit = async (event) => {
    event.preventDefault();
    if (!valid) return;
    setSubmitting(true); setError('');
    try {
      await maintenanceService.complete(record._id, {
        repairResult: form.repairResult,
        afterCondition: form.repairResult === 'success' ? form.afterCondition : null,
        targetStorageId: form.repairResult === 'success' ? form.targetStorageId : null,
        disposalMethod: form.repairResult === 'unrepairable' ? form.disposalMethod : null,
        repairDescription: form.repairDescription.trim(),
        cost: form.cost === '' ? 0 : Number(form.cost),
      });
      onDone('Đã hoàn tất phiếu giặt/sửa.');
    } catch (e) { setError(errorText(e)); if (e?.status === 409) onDone(null, true); }
    finally { setSubmitting(false); }
  };
  return <Modal show onHide={submitting ? undefined : onHide} centered size="lg">
    <Form onSubmit={submit}>
      <Modal.Header closeButton={!submitting}><Modal.Title as="h5">Hoàn tất giặt/sửa</Modal.Title></Modal.Header>
      <Modal.Body>
        <ItemCell item={record.itemId} />
        <p className="mt-2 mb-0 small">Vấn đề: {record.issueDescription}</p>
        <Form.Group className="mt-3">
          <Form.Label>Kết quả <span className="text-danger">*</span></Form.Label>
          <div>
            {Object.entries(RESULT_LABELS).map(([value, text]) => <Form.Check inline type="radio" key={value} id={`result-${value}`} name="repairResult" label={text} value={value} checked={form.repairResult === value} disabled={submitting} onChange={set('repairResult')} />)}
          </div>
        </Form.Group>
        {form.repairResult === 'success' && <>
          <Form.Group className="mt-3">
            <Form.Label>Tình trạng sau xử lý <span className="text-danger">*</span></Form.Label>
            <Form.Select value={form.afterCondition} disabled={submitting} onChange={set('afterCondition')}>
              <option value="">Chọn tình trạng</option>
              {RESTORED_CONDITIONS.map((value) => <option key={value} value={value}>{CONDITION_LABELS[value]}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mt-3">
            <Form.Label>Kệ xếp lại <span className="text-danger">*</span></Form.Label>
            <Form.Select value={form.targetStorageId} disabled={submitting} onChange={set('targetStorageId')}>
              <option value="">Chọn kệ trong kho tổng</option>
              {shelves.map((shelf) => <option key={shelf._id} value={shelf._id}>{shelf.code}{shelf.name ? ` - ${shelf.name}` : ''}{shelf.maxCapacity != null ? ` (sức chứa ${shelf.maxCapacity})` : ''}</option>)}
            </Form.Select>
            {!shelves.length && <Form.Text muted>Kho tổng chưa có kệ đang hoạt động.</Form.Text>}
          </Form.Group>
        </>}
        {form.repairResult === 'failed' && <p className="mt-3 mb-0 small text-muted">Món hàng sẽ quay về trạng thái hỏng. Quản lý kho có thể tạo phiếu mới sau.</p>}
        {form.repairResult === 'unrepairable' && <Form.Group className="mt-3">
          <Form.Label>Cách thanh lý đề xuất <span className="text-danger">*</span></Form.Label>
          <Form.Select value={form.disposalMethod} disabled={submitting} onChange={set('disposalMethod')}>
            <option value="">Chọn cách thanh lý</option>
            {Object.entries(METHOD_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </Form.Select>
          <Form.Text muted>Hệ thống sẽ gửi đề xuất thanh lý cho quản lý kho duyệt.</Form.Text>
        </Form.Group>}
        <Form.Group className="mt-3">
          <Form.Label>Mô tả công việc{form.repairResult === 'unrepairable' && <span className="text-danger"> *</span>}</Form.Label>
          <Form.Control as="textarea" rows={3} maxLength={1000} value={form.repairDescription} disabled={submitting} onChange={set('repairDescription')} />
        </Form.Group>
        <Form.Group className="mt-3">
          <Form.Label>Chi phí (VND)</Form.Label>
          <Form.Control type="number" min="0" step="1000" value={form.cost} disabled={submitting} isInvalid={!costValid} onChange={set('cost')} />
          <Form.Control.Feedback type="invalid">Chi phí phải là số không âm.</Form.Control.Feedback>
        </Form.Group>
        <ModalError message={error} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" disabled={submitting} onClick={onHide}>Đóng</Button>
        <Button variant="dark" type="submit" disabled={submitting || !valid}>{submitting ? 'Đang lưu...' : 'Hoàn tất'}</Button>
      </Modal.Footer>
    </Form>
  </Modal>;
}

/* --------- Modal xác nhận đơn giản (bắt đầu / hủy phiếu) --------- */
function ConfirmModal({ title, body, confirmText, variant = 'dark', withReason = false, onHide, onConfirm }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true); setError('');
    try { await onConfirm(reason.trim()); }
    catch (e) { setError(errorText(e)); }
    finally { setSubmitting(false); }
  };
  return <Modal show onHide={submitting ? undefined : onHide} centered>
    <Form onSubmit={submit}>
      <Modal.Header closeButton={!submitting}><Modal.Title as="h5">{title}</Modal.Title></Modal.Header>
      <Modal.Body>
        {body}
        {withReason && <Form.Group className="mt-3">
          <Form.Label>Lý do (không bắt buộc)</Form.Label>
          <Form.Control as="textarea" rows={2} maxLength={1000} value={reason} disabled={submitting} onChange={(e) => setReason(e.target.value)} />
        </Form.Group>}
        <ModalError message={error} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" disabled={submitting} onClick={onHide}>Đóng</Button>
        <Button variant={variant} type="submit" disabled={submitting}>{submitting ? 'Đang xử lý...' : confirmText}</Button>
      </Modal.Footer>
    </Form>
  </Modal>;
}

/* --------- Modal duyệt / từ chối thanh lý --------- */
function DecisionModal({ disposal, decision, onHide, onDone }) {
  const approve = decision === 'approve';
  const [form, setForm] = useState({ method: disposal.method, actualValue: '', decisionNote: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const valid = form.actualValue === '' || Number(form.actualValue) >= 0;
  const submit = async (event) => {
    event.preventDefault();
    if (!valid) return;
    setSubmitting(true); setError('');
    try {
      await maintenanceService.decideDisposal(disposal._id, approve
        ? { decision, method: form.method, actualValue: form.actualValue === '' ? null : Number(form.actualValue), decisionNote: form.decisionNote.trim() }
        : { decision, decisionNote: form.decisionNote.trim() });
      onDone(approve ? 'Đã duyệt thanh lý.' : 'Đã từ chối đề xuất thanh lý.');
    } catch (e) { setError(errorText(e)); if (e?.status === 409) onDone(null, true); }
    finally { setSubmitting(false); }
  };
  return <Modal show onHide={submitting ? undefined : onHide} centered>
    <Form onSubmit={submit}>
      <Modal.Header closeButton={!submitting}><Modal.Title as="h5">{approve ? 'Duyệt thanh lý' : 'Từ chối thanh lý'}</Modal.Title></Modal.Header>
      <Modal.Body>
        <ItemCell item={disposal.itemId} />
        <p className="mt-2 mb-0 small">Lý do: {disposal.reason}</p>
        {approve ? <>
          <p className="mt-2 mb-0 small text-danger">Sau khi duyệt, món hàng bị loại khỏi kho và không thể hoàn tác.</p>
          <Form.Group className="mt-3">
            <Form.Label>Cách thanh lý</Form.Label>
            <Form.Select value={form.method} disabled={submitting} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {Object.entries(METHOD_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </Form.Select>
          </Form.Group>
          <Form.Group className="mt-3">
            <Form.Label>Giá trị thu hồi (VND, không bắt buộc)</Form.Label>
            <Form.Control type="number" min="0" step="1000" value={form.actualValue} disabled={submitting} isInvalid={!valid} onChange={(e) => setForm({ ...form, actualValue: e.target.value })} />
          </Form.Group>
        </> : <p className="mt-2 mb-0 small text-muted">Món hàng sẽ quay về trạng thái không khả dụng.</p>}
        <Form.Group className="mt-3">
          <Form.Label>Ghi chú</Form.Label>
          <Form.Control as="textarea" rows={2} maxLength={1000} value={form.decisionNote} disabled={submitting} onChange={(e) => setForm({ ...form, decisionNote: e.target.value })} />
        </Form.Group>
        <ModalError message={error} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" disabled={submitting} onClick={onHide}>Đóng</Button>
        <Button variant={approve ? 'danger' : 'dark'} type="submit" disabled={submitting || !valid}>{submitting ? 'Đang xử lý...' : approve ? 'Duyệt thanh lý' : 'Từ chối'}</Button>
      </Modal.Footer>
    </Form>
  </Modal>;
}

/* --------- Modal chi tiết phiếu --------- */
function DetailModal({ record, onHide }) {
  const rows = [
    ['Loại xử lý', label(TYPE_LABELS, record.maintenanceType)],
    ['Trạng thái', label(RECORD_STATUS_LABELS, record.status)],
    ['Vấn đề', record.issueDescription],
    ['Tình trạng trước', record.beforeCondition ? label(CONDITION_LABELS, record.beforeCondition) : '—'],
    ['Người tạo', record.reportedBy?.FullName || record.reportedBy?.Email || '—'],
    ['Người làm', record.assignedTo?.FullName || record.assignedTo?.Email || '—'],
    ['Tạo lúc', dateTime(record.reportedAt || record.createdAt)],
    ['Bắt đầu', dateTime(record.startedAt) || '—'],
    ['Kết quả', record.repairResult ? label(RESULT_LABELS, record.repairResult) : '—'],
    ['Tình trạng sau', record.afterCondition ? label(CONDITION_LABELS, record.afterCondition) : '—'],
    ['Kệ xếp lại', record.targetStorageId?.code || '—'],
    ['Mô tả công việc', record.repairDescription || '—'],
    ['Chi phí', record.status === 'completed' ? money(record.cost) : '—'],
    ['Hoàn tất', dateTime(record.completedAt) || '—'],
  ];
  if (record.status === 'cancelled') rows.push(['Đã hủy', `${record.cancelledBy?.FullName || ''} ${dateTime(record.cancelledAt)}`.trim()]);
  if (record.disposal) rows.push(['Đề xuất thanh lý', `${label(DISPOSAL_STATUS_LABELS, record.disposal.status)} · ${label(METHOD_LABELS, record.disposal.method)}`]);
  return <Modal show onHide={onHide} centered size="lg">
    <Modal.Header closeButton><Modal.Title as="h5">Chi tiết phiếu giặt/sửa</Modal.Title></Modal.Header>
    <Modal.Body>
      <ItemCell item={record.itemId} />
      <table className="table table-sm mt-3 mb-0"><tbody>
        {rows.map(([key, value]) => <tr key={key}><th style={{ width: 170 }}>{key}</th><td>{value}</td></tr>)}
      </tbody></table>
    </Modal.Body>
    <Modal.Footer><Button variant="secondary" onClick={onHide}>Đóng</Button></Modal.Footer>
  </Modal>;
}

export default function WarehouseMaintenancePage({ mode = 'manager' }) {
  const manager = mode === 'manager';
  const [tab, setTab] = useState(manager ? 'candidates' : 'records');
  const [candidates, setCandidates] = useState([]);
  const [records, setRecords] = useState([]);
  const [disposals, setDisposals] = useState([]);
  const [staff, setStaff] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dialog, setDialog] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (manager) {
        const [candidateRows, recordRows, disposalRows, staffRows] = await Promise.all([
          maintenanceService.candidates(),
          maintenanceService.list(),
          maintenanceService.listDisposals({ status: 'requested' }),
          maintenanceService.staff(),
        ]);
        setCandidates(candidateRows || []); setRecords(recordRows || []); setDisposals(disposalRows || []); setStaff(staffRows || []);
      } else {
        const [recordRows, locations, storages] = await Promise.all([
          maintenanceService.list(),
          inventoryLocationService.list(),
          storageLocationService.list(),
        ]);
        const centrals = (locations || []).filter((row) => row.type === 'warehouse' && row.status === 'active');
        const central = centrals.length === 1 ? centrals[0] : null;
        setRecords(recordRows || []);
        setShelves((storages || []).filter((row) => row.type === 'shelf' && row.status === 'active' && central && idOf(row.locationId) === idOf(central)).sort((a, b) => String(a.code).localeCompare(String(b.code))));
      }
    } catch (e) { setError(errorText(e)); }
    finally { setLoading(false); }
  }, [manager]);

  useEffect(() => { load(); }, [load]);

  // Đóng modal và tải lại. Khi lỗi 409 (keepOpen) giữ modal để người dùng đọc message, vẫn tải lại dữ liệu.
  const done = (message, keepOpen = false) => {
    if (!keepOpen) setDialog(null);
    if (message) setNotice(message);
    load();
  };

  const filteredCandidates = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return candidates.filter((row) => {
      if (conditionFilter && row.condition !== conditionFilter) return false;
      if (!keyword) return true;
      const variant = row.variantId; const product = variant?.productId;
      return [row.itemCode, row.serialNumber, variant?.sku, product?.name, product?.productCode].join(' ').toLowerCase().includes(keyword);
    });
  }, [candidates, query, conditionFilter]);

  const filteredRecords = useMemo(() => (statusFilter ? records.filter((row) => row.status === statusFilter) : records), [records, statusFilter]);

  const startRecord = async (record) => {
    await maintenanceService.start(record._id);
    done('Đã bắt đầu phiếu giặt/sửa.');
  };
  const cancelRecord = async (record, reason) => {
    await maintenanceService.cancel(record._id, { reason });
    done('Đã hủy phiếu giặt/sửa. Món hàng quay về trạng thái trước đó.');
  };

  const loadingRow = (span) => <tr className="wm-loading-row"><td colSpan={span}>Đang tải dữ liệu...</td></tr>;
  const emptyRow = (span, text) => <tr><td colSpan={span} className="wm-empty-state">{text}</td></tr>;

  const candidateTable = <>
    <div className="wm-list-toolbar">
      <label>Tìm kiếm
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Mã món, serial, SKU, tên sản phẩm" />
      </label>
      <label>Tình trạng
        <select value={conditionFilter} onChange={(e) => setConditionFilter(e.target.value)}>
          <option value="">Tất cả</option>
          <option value="damaged">Hỏng</option>
          <option value="worn">Đã qua sử dụng</option>
        </select>
      </label>
    </div>
    <div className="wm-table-wrap"><table>
      <thead><tr><th>Món hàng</th><th>Tình trạng</th><th>Trạng thái</th><th>Vị trí</th><th /></tr></thead>
      <tbody>
        {loading ? loadingRow(5) : filteredCandidates.length ? filteredCandidates.map((row) => <tr key={row._id}>
          <td><ItemCell item={row} /></td>
          <td>{label(CONDITION_LABELS, row.condition)}</td>
          <td>{label(ITEM_STATUS_LABELS, row.status)}</td>
          <td>{row.storageId?.code || 'Chưa xếp kệ'}</td>
          <td><div className="wm-actions">
            <button type="button" onClick={() => { setNotice(''); setDialog({ kind: 'create', row }); }}>Tạo phiếu giặt/sửa</button>
            <button type="button" className="danger" onClick={() => { setNotice(''); setDialog({ kind: 'dispose', row }); }}>Đề xuất thanh lý</button>
          </div></td>
        </tr>) : emptyRow(5, 'Không có món cần xử lý.')}
      </tbody>
    </table></div>
  </>;

  const recordTable = <>
    <div className="wm-list-toolbar">
      <label>Trạng thái
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tất cả</option>
          {Object.entries(RECORD_STATUS_LABELS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select>
      </label>
    </div>
    <div className="wm-table-wrap"><table>
      <thead><tr><th>Món hàng</th><th>Loại</th><th>Vấn đề</th>{manager && <th>Người làm</th>}<th>Trạng thái</th><th>Kết quả</th><th /></tr></thead>
      <tbody>
        {loading ? loadingRow(manager ? 7 : 6) : filteredRecords.length ? filteredRecords.map((row) => <tr key={row._id}>
          <td><ItemCell item={row.itemId} /></td>
          <td>{label(TYPE_LABELS, row.maintenanceType)}</td>
          <td>{row.issueDescription}</td>
          {manager && <td>{row.assignedTo?.FullName || row.assignedTo?.Email || '—'}</td>}
          <td><StatusBadge status={row.status} map={RECORD_STATUS_LABELS} /></td>
          <td>{row.repairResult ? label(RESULT_LABELS, row.repairResult) : '—'}{row.status === 'completed' && <div className="wm-row-summary"><span>Chi phí: {money(row.cost)}</span></div>}</td>
          <td><div className="wm-actions">
            <button type="button" className="secondary" onClick={() => setDialog({ kind: 'detail', row })}>Chi tiết</button>
            {!manager && row.status === 'pending' && <button type="button" onClick={() => { setNotice(''); setDialog({ kind: 'start', row }); }}>Bắt đầu</button>}
            {!manager && row.status === 'in_progress' && <button type="button" onClick={() => { setNotice(''); setDialog({ kind: 'complete', row }); }}>Hoàn tất</button>}
            {manager && ['pending', 'in_progress'].includes(row.status) && <button type="button" className="danger" onClick={() => { setNotice(''); setDialog({ kind: 'cancel', row }); }}>Hủy phiếu</button>}
          </div></td>
        </tr>) : emptyRow(manager ? 7 : 6, manager ? 'Chưa có phiếu giặt/sửa.' : 'Chưa có phiếu giặt/sửa được giao cho bạn.')}
      </tbody>
    </table></div>
  </>;

  const disposalTable = <div className="wm-table-wrap"><table>
    <thead><tr><th>Món hàng</th><th>Lý do</th><th>Cách thanh lý đề xuất</th><th>Người đề xuất</th><th>Ngày đề xuất</th><th /></tr></thead>
    <tbody>
      {loading ? loadingRow(6) : disposals.length ? disposals.map((row) => <tr key={row._id}>
        <td><ItemCell item={row.itemId} /></td>
        <td>{row.reason}{row.maintenanceRecordId && <div className="wm-row-summary"><span>Từ phiếu giặt/sửa: {label(TYPE_LABELS, row.maintenanceRecordId.maintenanceType)}</span></div>}</td>
        <td>{label(METHOD_LABELS, row.method)}{row.estimatedValue != null && <div className="wm-row-summary"><span>Ước tính: {money(row.estimatedValue)}</span></div>}</td>
        <td>{row.requestedBy?.FullName || row.requestedBy?.Email || '—'}</td>
        <td>{dateTime(row.createdAt)}</td>
        <td><div className="wm-actions">
          <button type="button" className="danger" onClick={() => { setNotice(''); setDialog({ kind: 'approve', row }); }}>Duyệt</button>
          <button type="button" className="secondary" onClick={() => { setNotice(''); setDialog({ kind: 'reject', row }); }}>Từ chối</button>
        </div></td>
      </tr>) : emptyRow(6, 'Không có đề xuất thanh lý chờ duyệt.')}
    </tbody>
  </table></div>;

  const close = () => setDialog(null);

  return <div className="shop-dashboard-layout wh-layout">
    <WarehouseSidebar mode={mode} />
    <main className="shop-main-content wh-main">
      <header className="wm-header">
        <div>
          <span>KHO TỔNG</span>
          <h1>{manager ? 'Giặt / sửa / thanh lý' : 'Giặt / sửa được giao'}</h1>
        </div>
        <button type="button" className="wm-refresh-button" disabled={loading} onClick={load}>Tải lại</button>
      </header>

      {error && <div className="wm-error">{error}</div>}
      {notice && <div className="alert alert-success py-2">{notice}</div>}

      <section className="wm-panel">
        {manager && <Nav variant="tabs" activeKey={tab} onSelect={(key) => setTab(key)} className="mb-3">
          <Nav.Item><Nav.Link eventKey="candidates">Cần xử lý ({candidates.length})</Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="records">Phiếu giặt/sửa</Nav.Link></Nav.Item>
          <Nav.Item><Nav.Link eventKey="disposals">Chờ duyệt thanh lý ({disposals.length})</Nav.Link></Nav.Item>
        </Nav>}
        {manager && tab === 'candidates' && candidateTable}
        {(!manager || tab === 'records') && recordTable}
        {manager && tab === 'disposals' && disposalTable}
      </section>

      {dialog?.kind === 'create' && <CreateMaintenanceModal item={dialog.row} staff={staff} onHide={close} onDone={done} />}
      {dialog?.kind === 'dispose' && <CreateDisposalModal item={dialog.row} onHide={close} onDone={done} />}
      {dialog?.kind === 'complete' && <CompleteMaintenanceModal record={dialog.row} shelves={shelves} onHide={close} onDone={done} />}
      {dialog?.kind === 'detail' && <DetailModal record={dialog.row} onHide={close} />}
      {(dialog?.kind === 'approve' || dialog?.kind === 'reject') && <DecisionModal disposal={dialog.row} decision={dialog.kind} onHide={close} onDone={done} />}
      {dialog?.kind === 'start' && <ConfirmModal
        title="Bắt đầu giặt/sửa"
        body={<><ItemCell item={dialog.row.itemId} /><p className="mt-2 mb-0 small">Xác nhận bắt đầu xử lý món hàng này?</p></>}
        confirmText="Bắt đầu"
        onHide={close}
        onConfirm={async () => { try { await startRecord(dialog.row); } catch (e) { if (e?.status === 409) load(); throw e; } }}
      />}
      {dialog?.kind === 'cancel' && <ConfirmModal
        title="Hủy phiếu giặt/sửa"
        body={<><ItemCell item={dialog.row.itemId} /><p className="mt-2 mb-0 small">Phiếu sẽ bị hủy và món hàng quay về trạng thái trước khi tạo phiếu.</p></>}
        confirmText="Xác nhận hủy"
        variant="danger"
        withReason
        onHide={close}
        onConfirm={async (reason) => { try { await cancelRecord(dialog.row, reason); } catch (e) { if (e?.status === 409) load(); throw e; } }}
      />}
    </main>
  </div>;
}
