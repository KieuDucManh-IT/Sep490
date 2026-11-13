import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import stockAdjustmentService from '../../services/warehouse/stockAdjustmentService';
import WarehouseWorkflowProgress from '../../components/WarehouseWorkflowProgress';
import '../../styles/WarehouseManager.css';
import '../../styles/WarehouseUx.css';

const idOf = (value) => String(value?._id || value || '');
const labels = { requested: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', applied: 'Đã cập nhật tồn', cancelled: 'Đã hủy' };
const itemLabel = (item) => [item.variantId?.productId?.name, item.variantId?.sku, item.variantId?.size, item.variantId?.color].filter(Boolean).join(' · ');

export default function WarehouseAdjustmentPage() {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await stockAdjustmentService.list()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    const text = [row.adjustmentCode, row.locationId?.code, row.locationId?.name, row.reason].join(' ').toLowerCase();
    return !search || text.includes(search.toLowerCase());
  }), [rows, search, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search, statusFilter, pageSize]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const open = async (id) => { try { setSelected(await stockAdjustmentService.get(id)); } catch (e) { setError(e.message); } };
  const act = async (action, message) => {
    setBusy(true); setError('');
    try { const result = await action(); await load(); if (result?._id) await open(result._id); setNotice(message); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="wm-layout"><WarehouseSidebar mode="manager" /><main className="wm-main wm-stock-control-page">
    <header className="wm-header"><div><span>WAREHOUSE / KIỂM SOÁT TỒN KHO</span><h1>Điều chỉnh kho</h1></div></header>
    <div className="wm-stock-tabs"><Link to="/warehousemanager/stocktakes">Kiểm kê</Link><Link className="active" to="/warehousemanager/adjustments">Điều chỉnh</Link></div>
    {error && <div className="wm-error">{error}</div>}{notice && <div className="wm-success">{notice}</div>}
    <section className="wm-panel wm-list-panel">
      <div className="wm-list-toolbar"><label className="wm-search-field">T&#236;m m&#227; phi&#7871;u, kho ho&#7863;c l&#253; do<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nh&#7853;p t&#7915; kh&#243;a..." /></label><label>Tr&#7841;ng th&#225;i<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">T&#7845;t c&#7843;</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="wm-page-size">S&#7889; d&#242;ng<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label></div>
      <div className="wm-table-wrap"><table><thead><tr><th>M&#227; phi&#7871;u</th><th>Kho</th><th>L&#253; do</th><th>Tr&#7841;ng th&#225;i</th><th>Ng&#224;y t&#7841;o</th><th /></tr></thead><tbody>
        {loading ? <tr><td colSpan="6" className="wm-loading-row">&#272;ang t&#7843;i phi&#7871;u &#273;i&#7873;u ch&#7881;nh...</td></tr> : visibleRows.length ? visibleRows.map((row) => <tr key={row._id}><td><strong>{row.adjustmentCode}</strong></td><td>{row.locationId?.code} · {row.locationId?.name}</td><td>{row.reason}</td><td><span className={`wm-status-badge status-${row.status}`}>{labels[row.status] || row.status}</span></td><td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td><td><button className="secondary" type="button" onClick={() => open(row._id)}>Chi ti&#7871;t</button></td></tr>) : <tr><td colSpan="6" className="wm-empty-state">{search || statusFilter ? 'Kh&#244;ng t&#236;m th&#7845;y phi&#7871;u kh&#7899;p b&#7897; l&#7885;c.' : 'Ch&#432;a c&#243; phi&#7871;u &#273;i&#7873;u ch&#7881;nh.'}</td></tr>}
      </tbody></table></div><div className="wm-pagination"><span>{filteredRows.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredRows.length)} / ${filteredRows.length}` : '0 k\u1ebft qu\u1ea3'}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Tr&#432;&#7899;c</button><span>Trang {page} / {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Sau</button></div></div>
    </section>
    {selected && <div className="wm-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><section className="wm-crud-modal wm-stock-detail">
      <div className="wm-stock-detail-heading"><div><small>{selected.adjustmentCode} · {labels[selected.status]}</small><h2>{selected.locationId?.code} · {selected.locationId?.name}</h2><p>{selected.reason}</p></div><button className="secondary" type="button" onClick={() => setSelected(null)}>Đóng</button></div>
      <WarehouseWorkflowProgress flow="adjustment" status={selected.status} />
      <div className="wm-table-wrap"><table><thead><tr><th>Mặt hàng / mã cá thể</th><th>Vị trí</th><th>Tồn trước</th><th>Thay đổi</th><th>Tồn sau</th></tr></thead><tbody>{(selected.items || []).map((item) => <tr key={idOf(item._id)}><td>{itemLabel(item)}{item.itemCode && <small className="wm-stock-subline">{item.itemCode}{item.serialNumber ? ` · ${item.serialNumber}` : ''}</small>}</td><td>{item.storageId?.code || 'Chưa gán'}</td><td>{item.quantityBefore}</td><td>{item.quantityChange > 0 ? '+' : ''}{item.quantityChange}</td><td>{item.quantityAfter}</td></tr>)}</tbody></table></div>
      <div className="wm-stock-actions">{selected.status === 'requested' && <><button className="danger" disabled={busy} onClick={() => act(() => stockAdjustmentService.decide(selected._id, 'reject'), 'Đã từ chối phiếu.')}>Từ chối</button><button disabled={busy} onClick={() => act(() => stockAdjustmentService.decide(selected._id, 'approve'), 'Đã duyệt phiếu.')}>Duyệt điều chỉnh</button></>}{selected.status === 'approved' && <button disabled={busy} onClick={() => act(() => stockAdjustmentService.apply(selected._id), 'Đã cập nhật tồn kho.')}>Áp dụng vào tồn kho</button>}</div>
    </section></div>}
  </main></div>;
}
