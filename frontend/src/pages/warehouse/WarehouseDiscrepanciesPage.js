import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { AlertTriangle } from 'lucide-react';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import WarehouseItemChecklist from '../../components/WarehouseItemChecklist';
import {
  StockDiscrepancyDetailBody, directionLabels, discrepancyStatusClass, discrepancyStatusLabels,
  discrepancyVariantLabel, responsibleLabels, unresolvedItems,
} from '../../components/StockDiscrepancyDetail';
import stockDiscrepancyService from '../../services/warehouse/stockDiscrepancyService';
import inventoryLocationService from '../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../services/warehouse/storageLocationService';
import '../../styles/WarehouseManager.css';
import '../../styles/WarehouseUx.css';

const idOf = (value) => String(value?._id || value || '');
const locationLabel = (location) => [location?.code, location?.name].filter(Boolean).join(' · ') || '—';
const statusFilters = [
  ['pending', 'Đang điều tra (gồm xử lý một phần)'],
  ['open', discrepancyStatusLabels.open],
  ['partially_resolved', discrepancyStatusLabels.partially_resolved],
  ['resolved', discrepancyStatusLabels.resolved],
  ['', 'Tất cả'],
];
const emptyForm = { outcome: 'found', quantity: '', itemIds: [], target: '', targetStorageId: '', responsibleParty: '', note: '' };
const permissionMessage = (error) => (error?.status === 403 ? 'Bạn không có quyền thực hiện thao tác này với phiếu chênh lệch.' : error?.message || 'Đã có lỗi xảy ra.');

export default function WarehouseDiscrepanciesPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(null);
  const [centralId, setCentralId] = useState('');
  const [shelves, setShelves] = useState([]);
  const [showResolve, setShowResolve] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [discrepancies, locations, storages] = await Promise.all([
        stockDiscrepancyService.list(),
        inventoryLocationService.list(),
        storageLocationService.list(),
      ]);
      setRows(discrepancies);
      const centrals = (locations || []).filter((location) => location.type === 'warehouse' && location.status === 'active');
      const central = centrals.length === 1 ? idOf(centrals[0]) : '';
      setCentralId(central);
      setShelves((storages || []).filter((storage) => storage.type === 'shelf' && storage.status === 'active' && idOf(storage.locationId) === central));
    } catch (loadError) { setError(permissionMessage(loadError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (statusFilter === 'pending' && !['open', 'partially_resolved'].includes(row.status)) return false;
    if (statusFilter && statusFilter !== 'pending' && row.status !== statusFilter) return false;
    const text = [row.discrepancyCode, row.transferId?.transferCode, row.variantId?.sku, row.variantId?.productId?.name, row.variantId?.productId?.productCode].join(' ').toLowerCase();
    return !search || text.includes(search.trim().toLowerCase());
  }), [rows, statusFilter, search]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search, statusFilter, pageSize]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const openDetail = async (id) => {
    setError('');
    try { setSelected(await stockDiscrepancyService.get(id)); }
    catch (loadError) { setError(permissionMessage(loadError)); }
  };

  const individual = selected?.trackingType === 'individual';
  const remaining = selected ? selected.quantityMissing - (selected.quantityResolved || 0) : 0;
  const candidates = useMemo(() => unresolvedItems(selected), [selected]);
  const originalIsCentral = selected && idOf(selected.toLocationId) === centralId;
  const targetOptions = selected ? [
    ...(!originalIsCentral ? [{ value: 'original', label: `Nơi nhận ban đầu (${locationLabel(selected.toLocationId)})` }] : []),
    { value: 'central', label: originalIsCentral ? `Kho tổng — nơi nhận ban đầu (${locationLabel(selected.toLocationId)})` : 'Kho tổng' },
  ] : [];

  const quantity = individual ? form.itemIds.length : Number(form.quantity);
  const validationMessage = (() => {
    if (!selected) return '';
    if (individual ? quantity < 1 : (!Number.isInteger(quantity) || quantity < 1)) return individual ? 'Chọn ít nhất một món hàng.' : 'Nhập số lượng nguyên lớn hơn 0.';
    if (quantity > remaining) return `Số lượng không được vượt số còn đang điều tra (${remaining}).`;
    if (form.outcome === 'found') {
      if (!form.target) return 'Chọn nơi nhập lại.';
      if (form.target === 'central' && !centralId) return 'Chưa xác định duy nhất một kho tổng đang hoạt động.';
      if (form.target === 'central' && !form.targetStorageId) return 'Chọn kệ trong kho tổng.';
    } else {
      if (!form.responsibleParty) return 'Chọn bên chịu trách nhiệm.';
      if (!form.note.trim()) return 'Nhập ghi chú cho kết luận mất hàng.';
    }
    if (form.note.trim().length > 1000) return 'Ghi chú tối đa 1000 ký tự.';
    return '';
  })();

  const startResolve = () => {
    setForm({ ...emptyForm, target: originalIsCentral ? 'central' : '' });
    setFormError('');
    setShowResolve(true);
  };

  const submitResolve = async (event) => {
    event?.preventDefault();
    if (validationMessage) { setFormError(validationMessage); return; }
    const payload = form.outcome === 'found'
      ? {
        outcome: 'found',
        ...(individual ? { itemIds: form.itemIds } : { quantity }),
        targetLocationId: form.target === 'central' ? centralId : idOf(selected.toLocationId),
        targetStorageId: form.target === 'central' ? form.targetStorageId : null,
        note: form.note.trim(),
      }
      : {
        outcome: 'lost',
        ...(individual ? { itemIds: form.itemIds } : { quantity }),
        responsibleParty: form.responsibleParty,
        note: form.note.trim(),
      };
    setSubmitting(true); setFormError('');
    try {
      const updated = await stockDiscrepancyService.resolve(selected._id, payload);
      setSelected(updated);
      setShowResolve(false);
      setNotice(`Đã ghi nhận kết luận cho phiếu ${updated?.discrepancyCode || ''}.`);
      await load();
    } catch (submitError) {
      setFormError(permissionMessage(submitError));
      if (submitError.status === 409) {
        // Phiếu vừa được kết luận ở nơi khác hoặc kệ hết chỗ: tải lại để thấy trạng thái mới.
        await load();
        const fresh = await stockDiscrepancyService.get(selected._id).catch(() => null);
        if (fresh) setSelected(fresh);
      }
    } finally { setSubmitting(false); }
  };

  return <div className="wm-layout">
    <WarehouseSidebar mode="manager" />
    <main className="wm-main wm-stock-control-page">
      <header className="wm-header"><div><span>WAREHOUSE / CHÊNH LỆCH ĐIỀU CHUYỂN</span><h1>Hàng thiếu khi điều chuyển</h1><p>Hàng thiếu đang điều tra không được bán hay cho thuê. Kết luận tìm thấy để nhập lại, hoặc ghi nhận mất kèm bên chịu trách nhiệm.</p></div></header>
      {error && <div className="wm-error">{error}</div>}{notice && <div className="wm-success">{notice}</div>}
      <section className="wm-panel wm-list-panel">
        <div className="wm-list-toolbar">
          <label className="wm-search-field">Tìm mã phiếu, SKU hoặc tên sản phẩm<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập từ khóa..." /></label>
          <label>Trạng thái<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{statusFilters.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}</select></label>
          <label className="wm-page-size">Số dòng<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
        </div>
        <div className="wm-table-wrap"><table><thead><tr><th>Mã phiếu</th><th>Phiếu điều chuyển gốc</th><th>Chiều</th><th>Nơi gửi → nơi nhận</th><th>Sản phẩm / biến thể</th><th>Thiếu / đã xử lý</th><th>Trạng thái</th><th>Ngày mở</th><th /></tr></thead><tbody>
          {loading ? <tr><td colSpan="9" className="wm-loading-row">Đang tải phiếu chênh lệch...</td></tr> : visible.length ? visible.map((row) => <tr key={row._id}>
            <td><strong>{row.discrepancyCode}</strong></td>
            <td>{row.transferId?.transferCode || '—'}</td>
            <td>{directionLabels[row.direction] || row.direction}</td>
            <td>{locationLabel(row.fromLocationId)} → {locationLabel(row.toLocationId)}</td>
            <td>{discrepancyVariantLabel(row) || '—'}</td>
            <td>{row.quantityMissing} / {row.quantityResolved || 0}</td>
            <td><span className={`wm-status-badge ${discrepancyStatusClass[row.status] || ''}`}>{discrepancyStatusLabels[row.status] || row.status}</span></td>
            <td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td>
            <td><button type="button" className="secondary" onClick={() => openDetail(row._id)}>Mở phiếu</button></td>
          </tr>) : <tr><td colSpan="9" className="wm-empty-state">Không có hàng thiếu cần xử lý.</td></tr>}
        </tbody></table></div>
        <div className="wm-pagination"><span>{filtered.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} / ${filtered.length}` : '0 kết quả'}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page} / {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Sau</button></div></div>
      </section>

      {selected && <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !showResolve) setSelected(null); }}>
        <section className="wm-crud-modal wm-transfer-modal wm-stock-detail" role="dialog" aria-modal="true" aria-labelledby="discrepancy-detail-title">
          <div className="wm-stock-detail-heading"><div><small>{selected.discrepancyCode} · {discrepancyStatusLabels[selected.status] || selected.status}</small><h2 id="discrepancy-detail-title">{discrepancyVariantLabel(selected) || 'Phiếu chênh lệch'}</h2><p>{directionLabels[selected.direction]} · {locationLabel(selected.fromLocationId)} → {locationLabel(selected.toLocationId)}</p></div><button type="button" className="secondary" onClick={() => setSelected(null)}>Đóng</button></div>
          {selected.status !== 'resolved' && <div className="wm-action-guidance"><AlertTriangle size={17} /><div><strong>Còn {remaining} đang điều tra</strong>Có thể kết luận nhiều lần, mỗi lần cho một phần số lượng hoặc một số món.</div></div>}
          <StockDiscrepancyDetailBody discrepancy={selected} />
          <div className="wm-stock-actions">
            {selected.status !== 'resolved' && <button type="button" disabled={submitting} onClick={startResolve}>Kết luận</button>}
          </div>
        </section>
      </div>}

      <Modal show={showResolve && Boolean(selected)} onHide={submitting ? undefined : () => setShowResolve(false)} size="lg" centered scrollable backdrop={submitting ? 'static' : true}>
        <Form onSubmit={submitResolve}>
          <Modal.Header closeButton={!submitting}><Modal.Title as="h5">Kết luận phiếu {selected?.discrepancyCode}</Modal.Title></Modal.Header>
          <Modal.Body>
            <p className="mb-3">{discrepancyVariantLabel(selected)} · còn <strong>{remaining}</strong> đang điều tra</p>
            <Form.Group className="mb-3">
              <Form.Label>Kết luận</Form.Label>
              <div>
                <Form.Check inline type="radio" id="discrepancy-outcome-found" name="discrepancy-outcome" label="Tìm thấy" checked={form.outcome === 'found'} onChange={() => setForm({ ...form, outcome: 'found' })} />
                <Form.Check inline type="radio" id="discrepancy-outcome-lost" name="discrepancy-outcome" label="Mất" checked={form.outcome === 'lost'} onChange={() => setForm({ ...form, outcome: 'lost' })} />
              </div>
            </Form.Group>
            {individual
              ? <Form.Group className="mb-3"><Form.Label>Chọn món hàng</Form.Label>
                <WarehouseItemChecklist items={candidates} selectedIds={form.itemIds} maxSelectable={remaining} onToggle={(itemId, checked) => setForm((old) => ({ ...old, itemIds: checked ? [...old.itemIds, itemId] : old.itemIds.filter((id) => id !== itemId) }))} emptyMessage="Không còn món nào đang điều tra." />
              </Form.Group>
              : <Form.Group className="mb-3" controlId="discrepancy-quantity"><Form.Label>Số lượng</Form.Label>
                <Form.Control type="number" min="1" max={remaining} step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
                <Form.Text muted>Tối đa {remaining}.</Form.Text>
              </Form.Group>}
            {form.outcome === 'found' ? <>
              <Form.Group className="mb-3" controlId="discrepancy-target"><Form.Label>Nơi nhập lại</Form.Label>
                <Form.Select value={form.target} onChange={(event) => setForm({ ...form, target: event.target.value, targetStorageId: '' })}>
                  <option value="">Chọn nơi nhập lại</option>
                  {targetOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Form.Select>
              </Form.Group>
              {form.target === 'central' && <Form.Group className="mb-3" controlId="discrepancy-shelf"><Form.Label>Kệ trong kho tổng</Form.Label>
                <Form.Select value={form.targetStorageId} onChange={(event) => setForm({ ...form, targetStorageId: event.target.value })}>
                  <option value="">Chọn kệ</option>
                  {shelves.map((shelf) => <option key={shelf._id} value={shelf._id}>{shelf.code} · {shelf.name}</option>)}
                </Form.Select>
              </Form.Group>}
            </> : <Form.Group className="mb-3" controlId="discrepancy-responsible"><Form.Label>Bên chịu trách nhiệm</Form.Label>
              <Form.Select value={form.responsibleParty} onChange={(event) => setForm({ ...form, responsibleParty: event.target.value })}>
                <option value="">Chọn bên chịu trách nhiệm</option>
                {Object.entries(responsibleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Form.Select>
            </Form.Group>}
            <Form.Group controlId="discrepancy-note"><Form.Label>Ghi chú{form.outcome === 'lost' ? <span className="text-danger"> *</span> : ' (không bắt buộc)'}</Form.Label>
              <Form.Control as="textarea" rows={3} maxLength={1000} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
            </Form.Group>
            {(formError || validationMessage) && <div className={`alert ${formError ? 'alert-danger' : 'alert-secondary'} mt-3 mb-0 py-2`}>{formError || validationMessage}</div>}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" type="button" disabled={submitting} onClick={() => setShowResolve(false)}>Quay lại</Button>
            <Button variant="dark" type="submit" disabled={submitting || Boolean(validationMessage)}>{submitting ? 'Đang lưu...' : 'Xác nhận kết luận'}</Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </main>
  </div>;
}
