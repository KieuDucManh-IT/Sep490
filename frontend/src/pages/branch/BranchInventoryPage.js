import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import BranchSidebar from '../../components/BranchSidebar';
import InventorySerialsModal from '../../components/InventorySerialsModal';
import inventoryReportService from '../../services/warehouse/inventoryReportService';
import '../../styles/WarehouseManager.css';

const pageSizes = [10, 20, 50];
const number = (value) => Number(value || 0).toLocaleString('vi-VN');

export default function BranchInventoryPage() {
  const [branchId, setBranchId] = useState(() => localStorage.getItem('vestora_active_branch_id') || '');
  const [report, setReport] = useState({ items: [], summary: {}, branch: null, location: null });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serialDetail, setSerialDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setReport(await inventoryReportService.getBranchInventory({ branchId })); }
    catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [branchId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onBranchChanged = (event) => {
      const nextId = event.detail?.branchId || event.detail?.branch?._id || '';
      setBranchId(nextId);
    };
    window.addEventListener('vestora_branch_changed', onBranchChanged);
    return () => window.removeEventListener('vestora_branch_changed', onBranchChanged);
  }, []);
  useEffect(() => { setPage(1); }, [branchId, query, pageSize]);

  const filtered = useMemo(() => report.items.filter((item) => {
    const text = [item.productCode, item.productName, item.categoryName, item.sku, item.variantName, item.size, item.color].join(' ').toLowerCase();
    return !query || text.includes(query.toLowerCase());
  }), [report.items, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const cards = [
    ['Tổng tồn tại chi nhánh', report.summary.totalOnHand],
    ['Có thể sử dụng', report.summary.totalAvailable],
    ['Đang giữ chỗ', report.summary.totalReserved],
    ['Không khả dụng', report.summary.totalUnavailable],
  ];

  return <div className="shop-dashboard-layout">
    <BranchSidebar />
    <main className="shop-main-content wm-branch-inventory-page">
      <header className="wm-header"><div><span>CHI NHÁNH / KHO</span><h1>Tồn kho chi nhánh</h1><p>{report.branch?.name || report.location?.name || 'Số lượng mặt hàng hiện có tại chi nhánh này'}</p></div>
        <button type="button" className="wm-primary-button wm-refresh-button" onClick={load} disabled={loading}><RefreshCw size={15} />Làm mới</button>
      </header>
      {error && <div className="wm-error">{error}</div>}
      <section className="wm-report-cards">{cards.map(([label, value]) => <article className="wm-report-card" key={label}><span>{label}</span><strong>{number(value)}</strong><small>cái</small></article>)}</section>
      <section className="wm-panel wm-list-panel">
        <div className="wm-list-toolbar">
          <label className="wm-search-field">Tìm sản phẩm<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên sản phẩm, SKU hoặc biến thể..." /></label>
          <label className="wm-page-size">Số dòng<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
        </div>
        <div className="wm-table-wrap"><table><thead><tr><th>Sản phẩm / biến thể</th><th>Mã / SKU</th><th>Tồn tại chi nhánh</th><th>Có thể sử dụng</th><th>Đang giữ</th><th>Không khả dụng</th></tr></thead>
          <tbody>{loading ? <tr><td colSpan={6}>Đang tải tồn kho...</td></tr> : visible.length ? visible.map((item) => <tr key={item.key}>
            <td><strong>{item.productName}</strong><br /><small>{[item.variantName, item.size, item.color].filter(Boolean).join(' · ')}</small></td>
            <td>{item.productCode}{item.sku ? <><br /><small>{item.sku}</small></> : null}{item.trackingType === 'individual' && <><br /><button type="button" className="wm-text-button" onClick={() => setSerialDetail({ ...item, branchId })}>Xem {number(item.itemCount)} mã hàng</button></>}</td>
            <td>{number(item.quantityOnHand)}</td><td>{number(item.quantityAvailable)}</td><td>{number(item.quantityReserved)}</td><td>{number(item.quantityUnavailable)}</td>
          </tr>) : <tr><td colSpan={6}>Chi nhánh hiện chưa có tồn kho phù hợp.</td></tr>}</tbody>
        </table></div>
        <div className="wm-pagination"><span>{filtered.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} / ${filtered.length}` : '0 kết quả'}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau</button></div></div>
      </section>
      {serialDetail && <InventorySerialsModal item={serialDetail} onClose={() => setSerialDetail(null)} />}
    </main>
  </div>;
}
