import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import InventorySerialsModal from '../../components/InventorySerialsModal';
import inventoryReportService from '../../services/warehouse/inventoryReportService';
import '../../styles/WarehouseManager.css';

const pageSizes = [10, 20, 50];
const number = (value) => Number(value || 0).toLocaleString('vi-VN');

export default function InventoryReportPage() {
  const [report, setReport] = useState({ items: [], locations: [], summary: {} });
  const [locationId, setLocationId] = useState('');
  const [storageLevel, setStorageLevel] = useState('shelf');
  const [itemLevel, setItemLevel] = useState('variant');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [serialDetail, setSerialDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setReport(await inventoryReportService.get({ locationId, storageLevel, itemLevel })); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [locationId, storageLevel, itemLevel]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [locationId, storageLevel, itemLevel, query, pageSize]);

  const filtered = useMemo(() => report.items.filter((item) => {
    const text = [item.locationCode, item.locationName, item.managerName, item.storagePath, item.productCode, item.productName, item.categoryName, item.sku, item.variantName, item.size, item.color].join(' ').toLowerCase();
    return !query || text.includes(query.toLowerCase());
  }), [report.items, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  const cards = [
    ['Tổng tồn', report.summary.totalOnHand],
    ['Có thể sử dụng', report.summary.totalAvailable],
    ['Đang giữ chỗ', report.summary.totalReserved],
    ['Không khả dụng', report.summary.totalUnavailable],
  ];

  return <div className="wm-layout"><WarehouseSidebar /><main className="wm-main">
    <header className="wm-header"><div><span>WAREHOUSE MANAGER / BÁO CÁO</span><h1>Báo cáo tồn kho</h1><p>Tùy chọn cấp vị trí và cấp mặt hàng để gộp số tồn; serial có thể xem trong chi tiết.</p></div><button type="button" className="wm-primary-button wm-refresh-button" onClick={() => load()} disabled={loading}><RefreshCw size={15} />Làm mới</button></header>
    {error && <div className="wm-error">{error}</div>}
    <section className="wm-report-cards">{cards.map(([label, value]) => <article className="wm-report-card" key={label}><span>{label}</span><strong>{number(value)}</strong><small>cái</small></article>)}</section>
    <section className="wm-panel wm-list-panel">
      <div className="wm-list-toolbar">
        <label className="wm-search-field">Tìm mặt hàng<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên sản phẩm, SKU hoặc vị trí..." /></label>
        <label>Kho / cửa hàng<select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Tất cả</option>{report.locations.map((location) => <option key={location._id} value={location._id}>{location.code} — {location.name}</option>)}</select></label>
        <label>Gộp vị trí<select value={storageLevel} onChange={(event) => setStorageLevel(event.target.value)}><option value="zone">Khu (zone)</option><option value="row">Hàng (row)</option><option value="shelf">Kệ (shelf)</option></select></label>
        <label>Gộp mặt hàng<select value={itemLevel} onChange={(event) => setItemLevel(event.target.value)}><option value="product">Sản phẩm</option><option value="variant">Biến thể</option></select></label>
        <label className="wm-page-size">Số dòng<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>{pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      </div>
      <div className="wm-table-wrap"><table><thead><tr><th>Kho / cửa hàng</th><th>Quản lý</th><th>Vị trí</th><th>Sản phẩm / biến thể</th><th>Mã hàng / serial</th><th>Tồn</th><th>Khả dụng</th><th>Đang giữ</th><th>Không khả dụng</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={9}>Đang tải báo cáo...</td></tr> : visible.length ? visible.map((item) => <tr key={item.key}>
          <td><strong>{item.locationCode}</strong><br />{item.locationName}</td><td>{item.managerName || '—'}</td><td>{item.storagePath}</td>
          <td><strong>{item.productName}</strong><br /><small>{[item.productCode, item.sku, item.variantName, item.size, item.color].filter(Boolean).join(' · ')}</small></td>
          <td>{item.trackingType === 'individual' ? <><span>{number(item.itemCount)} mã hàng</span><br /><button type="button" className="wm-text-button" onClick={() => setSerialDetail(item)}>Xem serial / mã hàng</button></> : '—'}</td>
          <td>{number(item.quantityOnHand)}</td><td>{number(item.quantityAvailable)}</td><td>{number(item.quantityReserved)}</td><td>{number(item.quantityUnavailable)}</td>
        </tr>) : <tr><td colSpan={9}>Không có tồn kho phù hợp.</td></tr>}</tbody>
      </table></div>
      <div className="wm-pagination"><span>{filtered.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)} / ${filtered.length}` : '0 kết quả'}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau</button></div></div>
    </section>
    {serialDetail && <InventorySerialsModal item={serialDetail} onClose={() => setSerialDetail(null)} />}
  </main></div>;
}
