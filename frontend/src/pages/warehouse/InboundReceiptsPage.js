import React, { useCallback, useEffect, useMemo, useState } from 'react';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import InboundReceiptModal from '../../components/InboundReceiptModal';
import inboundReceiptService from '../../services/warehouse/inboundReceiptService';
import inventoryLocationService from '../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../services/warehouse/storageLocationService';
import supplierService from '../../services/masterdata/supplierService';
import productVariantService from '../../services/masterdata/productVariantService';
import productService from '../../services/masterdata/productService';
import '../../styles/WarehouseManager.css';

const statusLabel = {
  awaiting_receiving: 'Chờ tiếp nhận',
  received: 'Chờ duyệt',
  approved: 'Chờ sắp xếp',
  completed: 'Hoàn tất',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
};
const totalFor = (receipt, field) => (receipt.items || []).reduce((sum, item) => sum + (item[field] || 0), 0);

export default function InboundReceiptsPage({ mode = 'manager' }) {
  const role = mode === 'manager' ? 'warehouse_manager' : 'warehouse_staff';
  const [receipts, setReceipts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [variants, setVariants] = useState([]);
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [selected, setSelected] = useState(null);
  const [modalMode, setModalMode] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      const requests = [
        inboundReceiptService.list(),
        inventoryLocationService.list(),
        storageLocationService.list(),
      ];
      if (mode === 'manager') requests.push(supplierService.list(), productService.list(), productVariantService.list(), inboundReceiptService.listStaff());
      const values = await Promise.all(requests);
      setReceipts(values[0]);
      setLocations(values[1]);
      setShelves(values[2].filter((item) => item.type === 'shelf' && item.status === 'active'));
      if (mode === 'manager') {
        setSuppliers(values[3].filter((item) => item.status === 'active'));
        setProducts(values[4].filter((item) => item.status === 'active'));
        setVariants(values[5].filter((item) => item.status === 'active'));
        setStaff(values[6]);
      }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [mode]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [query, statusFilter, pageSize]);

  const filtered = useMemo(() => receipts.filter((receipt) => {
    const matchesStatus = !statusFilter || receipt.status === statusFilter;
    const text = [receipt.receiptCode, receipt.supplierId?.name, receipt.supplierId?.supplierCode, receipt.locationId?.name, receipt.locationId?.code, receipt.assignedStaffId?.FullName].join(' ').toLowerCase();
    return matchesStatus && (!query || text.includes(query.toLowerCase()));
  }), [receipts, statusFilter, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const open = (receipt, viewMode) => { setSelected(receipt); setModalMode(viewMode); };
  const saveCreate = async (payload) => { await inboundReceiptService.create(payload); await load(); };
  const saveReceive = async (payload) => { await inboundReceiptService.receive(selected._id, payload); await load(); };
  const savePutaway = async (payload) => { await inboundReceiptService.putaway(selected._id, payload); await load(); };
  const decide = async (decision) => {
    const note = decision === 'reject' ? window.prompt('Nhập lý do từ chối phiếu:') || '' : '';
    if (decision === 'reject' && !note.trim()) return;
    try {
      await inboundReceiptService.approve(selected._id, decision, note);
      setSelected(null); setModalMode('');
      await load();
    } catch (err) { setError(err.message); }
  };

  return <div className="wm-layout"><WarehouseSidebar mode={mode} /><main className="wm-main">
    <header className="wm-header"><div><span>WAREHOUSE MANAGER / NHẬP KHO</span><h1>{mode === 'manager' ? 'Phiếu nhập từ nhà cung cấp' : 'Tiếp nhận & sắp xếp hàng nhập'}</h1><p>{mode === 'manager' ? 'Tạo phiếu, theo dõi tiếp nhận và phê duyệt.' : 'Ghi số lượng thực nhận, hàng hỏng và đưa hàng vào shelf.'}</p></div>{mode === 'manager' && <button className="wm-primary-button" onClick={() => open(null, 'create')}>+ Tạo phiếu nhập</button>}</header>
    {error && <div className="wm-error">{error}</div>}
    <section className="wm-panel wm-list-panel">
      <div className="wm-list-toolbar">
        <label className="wm-search-field">Tìm phiếu<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mã phiếu, nhà cung cấp hoặc kho..." /></label>
        <label>Trạng thái<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Tất cả</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="wm-page-size">Số dòng<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
      </div>
      <div className="wm-table-wrap"><table><thead><tr><th>Mã phiếu</th><th>Kho</th><th>Nhà cung cấp</th><th>Nhân viên</th><th>Dòng hàng</th><th>Dự kiến</th><th>Thực nhận</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={9}>Đang tải phiếu nhập...</td></tr> : visible.length ? visible.map((receipt) => <tr key={receipt._id}>
          <td><strong>{receipt.receiptCode}</strong></td><td>{receipt.locationId?.code} — {receipt.locationId?.name}</td><td>{receipt.supplierId?.name}</td><td>{receipt.assignedStaffId?.FullName || '—'}</td><td>{receipt.items?.length || 0}</td><td>{totalFor(receipt, 'quantityExpected')}</td><td>{totalFor(receipt, 'quantityReceived')}</td><td><span className={'wm-receipt-status ' + receipt.status}>{statusLabel[receipt.status] || receipt.status}</span></td><td><button type="button" className="secondary" onClick={() => open(receipt, 'view')}>Mở phiếu</button></td>
        </tr>) : <tr><td colSpan={9}>Không có phiếu nhập phù hợp.</td></tr>}</tbody>
      </table></div>
      <div className="wm-pagination"><span>{filtered.length ? ((page - 1) * pageSize + 1) + '–' + Math.min(page * pageSize, filtered.length) + ' / ' + filtered.length : '0 kết quả'}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau</button></div></div>
    </section>
    {modalMode && <InboundReceiptModal key={modalMode + '-' + (selected?._id || 'new')} mode={modalMode} role={role} receipt={selected} locations={locations.filter((item) => item.status === 'active')} suppliers={suppliers} products={products} variants={variants} staff={staff} shelves={shelves} onClose={() => { setSelected(null); setModalMode(''); }} onCreate={saveCreate} onReceive={saveReceive} onApprove={decide} onPutaway={savePutaway} />}
  </main></div>;
}
