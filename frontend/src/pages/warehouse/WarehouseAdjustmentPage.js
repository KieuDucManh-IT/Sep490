import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import stockAdjustmentService from '../../services/warehouse/stockAdjustmentService';
import '../../styles/WarehouseManager.css';

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
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await stockAdjustmentService.list()); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
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
    <section className="wm-panel wm-list-panel"><div className="wm-table-wrap"><table><thead><tr><th>Mã phiếu</th><th>Kho</th><th>Lý do</th><th>Trạng thái</th><th>Ngày tạo</th><th /></tr></thead><tbody>
      {loading ? <tr><td colSpan="6">Đang tải...</td></tr> : rows.length ? rows.map((row) => <tr key={row._id}><td><strong>{row.adjustmentCode}</strong></td><td>{row.locationId?.code} · {row.locationId?.name}</td><td>{row.reason}</td><td>{labels[row.status] || row.status}</td><td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td><td><button className="secondary" type="button" onClick={() => open(row._id)}>Chi tiết</button></td></tr>) : <tr><td colSpan="6">Chưa có phiếu điều chỉnh.</td></tr>}
    </tbody></table></div></section>
    {selected && <div className="wm-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}><section className="wm-crud-modal wm-stock-detail">
      <div className="wm-stock-detail-heading"><div><small>{selected.adjustmentCode} · {labels[selected.status]}</small><h2>{selected.locationId?.code} · {selected.locationId?.name}</h2><p>{selected.reason}</p></div><button className="secondary" type="button" onClick={() => setSelected(null)}>Đóng</button></div>
      <div className="wm-table-wrap"><table><thead><tr><th>Mặt hàng / mã cá thể</th><th>Vị trí</th><th>Tồn trước</th><th>Thay đổi</th><th>Tồn sau</th></tr></thead><tbody>{(selected.items || []).map((item) => <tr key={idOf(item._id)}><td>{itemLabel(item)}{item.itemCode && <small className="wm-stock-subline">{item.itemCode}{item.serialNumber ? ` · ${item.serialNumber}` : ''}</small>}</td><td>{item.storageId?.code || 'Chưa gán'}</td><td>{item.quantityBefore}</td><td>{item.quantityChange > 0 ? '+' : ''}{item.quantityChange}</td><td>{item.quantityAfter}</td></tr>)}</tbody></table></div>
      <div className="wm-stock-actions">{selected.status === 'requested' && <><button className="danger" disabled={busy} onClick={() => act(() => stockAdjustmentService.decide(selected._id, 'reject'), 'Đã từ chối phiếu.')}>Từ chối</button><button disabled={busy} onClick={() => act(() => stockAdjustmentService.decide(selected._id, 'approve'), 'Đã duyệt phiếu.')}>Duyệt điều chỉnh</button></>}{selected.status === 'approved' && <button disabled={busy} onClick={() => act(() => stockAdjustmentService.apply(selected._id), 'Đã cập nhật tồn kho.')}>Áp dụng vào tồn kho</button>}</div>
    </section></div>}
  </main></div>;
}
