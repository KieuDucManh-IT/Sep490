import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import { useAuth } from '../../context/AuthContext';
import inventoryLocationService from '../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../services/warehouse/storageLocationService';
import productVariantService from '../../services/masterdata/productVariantService';
import productService from '../../services/masterdata/productService';
import stocktakeService from '../../services/warehouse/stocktakeService';
import WarehouseWorkflowProgress from '../../components/WarehouseWorkflowProgress';
import StocktakeScopeSelector from '../../components/StocktakeScopeSelector';
import '../../styles/WarehouseManager.css';
import '../../styles/WarehouseUx.css';

const statusLabel = {
  draft: 'Nháp', in_progress: 'Đang kiểm', counted: 'Chờ duyệt kiểm kê', approved: 'Đã duyệt', cancelled: 'Đã hủy',
  requested: 'Chờ duyệt điều chỉnh', rejected: 'Từ chối', applied: 'Đã cập nhật tồn',
};
const idOf = (value) => String(value?._id || value || '');
const itemLabel = (item) => [item.variantId?.productId?.name, item.variantId?.sku, item.variantId?.size, item.variantId?.color].filter(Boolean).join(' · ');
const detailVariance = (item) => Number(item.countedQuantity || 0) + Number(item.movementAfterCount || 0) - Number(item.systemQuantity || 0);
const scopeLabel = (row) => {
  if (row.scopeType === 'full' || (row.scopeType === 'custom' && !row.storageIds?.length && !row.productIds?.length && !row.variantIds?.length)) return 'Toàn kho';
  if (row.scopeType === 'product') return `${row.variantIds?.length || 0} biến thể`;
  if (row.scopeType === 'storage_location') return `${row.storageIds?.length || 0} vị trí và cấp con`;
  const parts = [];
  if (row.storageIds?.length) parts.push(`${row.storageIds.length} vị trí`);
  if (row.productIds?.length) parts.push(`${row.productIds.length} sản phẩm`);
  if (row.variantIds?.length) parts.push(`${row.variantIds.length} biến thể riêng`);
  return parts.join(' · ');
};

export default function WarehouseStocktakePage() {
  const { user } = useAuth();
  const role = user?.Role || user?.role || user?.roleName || '';
  const isManager = /warehouse_manager|admin/i.test(role);
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [storages, setStorages] = useState([]);
  const [variants, setVariants] = useState([]);
  const [products, setProducts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [counts, setCounts] = useState({});
  const [itemConditions, setItemConditions] = useState({});
  const [newItems, setNewItems] = useState([]);
  const [createForm, setCreateForm] = useState({ locationId: '', scopeType: 'custom', productIds: [], variantIds: [], storageIds: [], assignedStaffId: '' });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
        const requests = [
          stocktakeService.list(),
          inventoryLocationService.list(),
          storageLocationService.list(),
          productVariantService.list(),
        ];
        if (isManager) requests.push(productService.list(), stocktakeService.listStaff());
        else requests.push(Promise.resolve([]));
        const [stocktakes, locationRows, storageRows, variantRows, productRows, staffRows = []] = await Promise.all(requests);
        setRows(stocktakes);
        const centralWarehouses = locationRows.filter((item) => item.type === 'warehouse' && item.status === 'active');
        setLocations(centralWarehouses);
        setCreateForm((current) => ({ ...current, locationId: centralWarehouses.length === 1 ? centralWarehouses[0]._id : '' }));
        setStorages(storageRows.filter((item) => item.status === 'active'));
        const activeProducts = productRows.filter((item) => item.status === 'active' && item.isDeleted !== true);
        setProducts(activeProducts);
        setVariants(variantRows.filter((item) => item.status === 'active' && item.isDeleted !== true && item.productId?.status === 'active' && item.productId?.isDeleted !== true));
        setStaff(staffRows);
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [isManager]);

  useEffect(() => { load(); }, [load]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    const text = [row.stocktakeCode, row.locationId?.code, row.locationId?.name, row.assignedStaffId?.FullName, row.scopeType].join(' ').toLowerCase();
    return !search || text.includes(search.toLowerCase());
  }), [rows, search, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search, statusFilter, pageSize]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);
  const selectedStorageScopeSize = useMemo(() => {
    const selectedIds = new Set(createForm.storageIds);
    const byId = new Map(storages.map((storage) => [idOf(storage), storage]));
    return storages.filter((storage) => {
      let cursor = storage;
      const visited = new Set();
      while (cursor && !visited.has(idOf(cursor))) {
        const cursorId = idOf(cursor);
        if (selectedIds.has(cursorId)) return true;
        visited.add(cursorId);
        cursor = byId.get(idOf(cursor.parentStorageId));
      }
      return false;
    }).length;
  }, [storages, createForm.storageIds]);
  const selectedVariantScopeSize = useMemo(() => new Set([
    ...variants.filter((variant) => createForm.productIds.includes(idOf(variant.productId))).map(idOf),
    ...createForm.variantIds,
  ]).size, [variants, createForm.productIds, createForm.variantIds]);
  const discoveredVariants = variants.filter((variant) => {
    const hasProductScope = selected?.productIds?.length || selected?.variantIds?.length;
    if (!hasProductScope) return true;
    return (selected.productIds || []).some((id) => idOf(id) === idOf(variant.productId)) || (selected.variantIds || []).some((id) => idOf(id) === idOf(variant));
  });

  const refreshSelected = async (id) => {
    if (!id) return;
    const row = await stocktakeService.get(id);
    setSelected(row);
      setCounts(Object.fromEntries((row.items || []).map((item) => [item._id, item.isCounted ? String(item.countedQuantity) : item.itemId ? '1' : ''])));
      setItemConditions(Object.fromEntries((row.items || []).filter((item) => item.itemId).map((item) => [item._id, item.countedCondition || item.itemId.condition || 'good'])));
  };
  const runAction = async (action, successMessage) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await action();
      await load();
      const nextSelected = result?.stocktake || result?.data?.stocktake || result;
      if (nextSelected?._id) await refreshSelected(nextSelected._id);
      else if (selected?._id) await refreshSelected(selected._id);
      setNotice(successMessage);
      return result;
    } catch (actionError) { setError(actionError.message); }
    finally { setBusy(false); }
  };

  const createStocktake = async (event) => {
    event.preventDefault();
    if (!createForm.locationId) { setError('H\u00e3y ch\u1ecdn kho t\u1ed5ng tr\u01b0\u1edbc khi t\u1ea1o phi\u1ebfu.'); return; }
    const payload = {
      ...createForm,
    };
    const result = await runAction(() => stocktakeService.create(payload), 'Đã tạo phiếu kiểm kê nháp.');
    if (result?.data?._id || result?._id) {
      const id = result?.data?._id || result._id;
      setShowCreate(false);
      setCreateForm({ locationId: locations.length === 1 ? locations[0]._id : '', scopeType: 'custom', productIds: [], variantIds: [], storageIds: [], assignedStaffId: '' });
      await refreshSelected(id);
    }
  };

  const saveCounts = async () => {
    const invalidCount = (selected.items || []).some((item) => !item.itemId && counts[item._id] !== '' && counts[item._id] != null && (!Number.isInteger(Number(counts[item._id])) || Number(counts[item._id]) < 0));
    const invalidNewItem = newItems.some((item) => !item.variantId || !item.storageId || (variants.find((variant) => variant._id === item.variantId)?.productId?.trackingType === 'individual' ? !item.itemCode?.trim() : !Number.isInteger(Number(item.countedQuantity)) || Number(item.countedQuantity) < 1));
    if (invalidCount || invalidNewItem) { setError('S\u1ed1 l\u01b0\u1ee3ng ki\u1ec3m ph\u1ea3i l\u00e0 s\u1ed1 nguy\u00ean kh\u00f4ng \u00e2m; h\u00e0ng m\u1edbi c\u1ea7n \u0111\u1ee7 bi\u1ebfn th\u1ec3, v\u1ecb tr\u00ed v\u00e0 m\u00e3 / s\u1ed1 l\u01b0\u1ee3ng h\u1ee3p l\u1ec7.'); return false; }
    const result = await runAction(() => stocktakeService.saveCounts(selected._id, {
      items: (selected.items || []).filter((item) => item.itemId || (counts[item._id] !== '' && counts[item._id] != null))
        .map((item) => ({ detailId: item._id, countedQuantity: item.itemId ? (itemConditions[item._id] === 'missing' ? 0 : 1) : Number(counts[item._id]), countedCondition: item.itemId ? itemConditions[item._id] : undefined })),
      newItems: newItems.filter((item) => item.variantId && item.storageId && (variants.find((variant) => variant._id === item.variantId)?.productId?.trackingType !== 'individual' || item.itemCode.trim()))
        .map((item) => ({ ...item, countedQuantity: Number(item.countedQuantity || 1) })),
    }), 'Đã lưu số đếm.');
    if (result) setNewItems([]);
    return Boolean(result);
  };

  const submitCounts = async () => {
    const missingCount = (selected.items || []).some((item) => !item.itemId && (counts[item._id] === '' || counts[item._id] == null));
    if (missingCount) { setError('C\u1ea7n nh\u1eadp s\u1ed1 l\u01b0\u1ee3ng th\u1ef1c t\u1ebf cho t\u1ea5t c\u1ea3 m\u1eb7t h\u00e0ng tr\u01b0\u1edbc khi g\u1eedi k\u1ebft qu\u1ea3.'); return; }
    if (!await saveCounts()) return;
    await runAction(() => stocktakeService.submit(selected._id), 'Đã gửi kết quả kiểm kê.');
  };

  const heading = 'Kiểm kê kho';
  const countSummary = (selected?.items || []).reduce((summary, item) => {
    const individual = Boolean(item.itemId);
    const condition = itemConditions[item._id] || item.countedCondition || item.itemId?.condition;
    const counted = individual ? (condition === 'missing' ? 0 : 1) : Number(counts[item._id] || 0);
    summary.expected += Number(item.systemQuantity || 0);
    summary.counted += counted;
    if (condition === 'missing') summary.missing += 1;
    if (['damaged', 'unrepairable'].includes(condition)) summary.damaged += 1;
    return summary;
  }, { expected: 0, counted: 0, missing: 0, damaged: 0 });
  return <div className="wm-layout">
    <WarehouseSidebar mode={isManager ? 'manager' : 'staff'} />
    <main className="wm-main wm-stock-control-page">
      <header className="wm-header"><div><span>WAREHOUSE / KIỂM SOÁT TỒN KHO</span><h1>{heading}</h1></div>
        {isManager && <button type="button" className="wm-primary-button" onClick={() => { setShowCreate((value) => !value); setSelected(null); }}>+ Tạo phiếu kiểm kê</button>}
      </header>
      <div className="wm-stock-tabs"><Link className='active' to={isManager ? '/warehousemanager/stocktakes' : '/warehousestaff/stocktakes'}>Kiểm kê</Link>{isManager && <Link className='' to="/warehousemanager/adjustments">Điều chỉnh</Link>}</div>
      {error && <div className="wm-error">{error}</div>}{notice && <div className="wm-success">{notice}</div>}

      {showCreate && <form className="wm-panel wm-form wm-stock-create" onSubmit={createStocktake}>
        <div className="wm-central-warehouse"><small>Kho kiểm kê (kho tổng)</small><strong>{locations.length === 1 ? `${locations[0].code} · ${locations[0].name}` : 'Chưa xác định duy nhất kho tổng'}</strong></div>
        <StocktakeScopeSelector storages={storages.filter((item) => idOf(item.locationId) === idOf(createForm.locationId))} products={products} variants={variants} selectedStorageIds={createForm.storageIds} onStorageChange={(storageIds) => setCreateForm((form) => ({ ...form, storageIds }))} selectedProductIds={createForm.productIds} onProductChange={(productIds) => setCreateForm((form) => ({ ...form, productIds }))} selectedVariantIds={createForm.variantIds} onVariantChange={(variantIds) => setCreateForm((form) => ({ ...form, variantIds }))} />
        <div className="wm-scope-summary"><strong>Phạm vi xem trước</strong><span>{createForm.storageIds.length ? `${createForm.storageIds.length} vị trí được chọn · ${selectedStorageScopeSize} vị trí tính cả cấp con` : 'Toàn bộ vị trí trong kho tổng'}</span><span>{createForm.productIds.length || createForm.variantIds.length ? `${createForm.productIds.length} sản phẩm chọn toàn bộ · ${createForm.variantIds.length} biến thể chọn riêng · ${selectedVariantScopeSize} biến thể dự kiến` : 'Toàn bộ sản phẩm và biến thể'}</span><small>Phiếu chụp tồn sổ khi bắt đầu. Phạm vi này được giữ cố định trong suốt đợt kiểm kê.</small></div>
        <label>Nhân viên kiểm kê<select value={createForm.assignedStaffId} onChange={(event) => setCreateForm({ ...createForm, assignedStaffId: event.target.value })}><option value="">Tự kiểm kê / chưa giao</option>{staff.map((member) => <option key={member._id} value={member._id}>{member.FullName} · {member.Email}</option>)}</select></label>
        <footer><button type="button" className="secondary" onClick={() => setShowCreate(false)}>Hủy</button><button disabled={busy || !createForm.locationId}>Tạo phiếu</button></footer>
      </form>}

      <section className="wm-panel wm-list-panel">
        <div className="wm-list-toolbar"><label className="wm-search-field">T&#236;m m&#227; phi&#7871;u, kho ho&#7863;c nh&#226;n vi&#234;n<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nh&#7853;p t&#7915; kh&#243;a..." /></label><label>Tr&#7841;ng th&#225;i<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">T&#7845;t c&#7843;</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="wm-page-size">S&#7889; d&#242;ng<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label></div>
        <div className="wm-table-wrap"><table><thead><tr><th>M&#227; phi&#7871;u</th><th>Kho</th><th>Ph&#7841;m vi</th><th>Tr&#7841;ng th&#225;i</th><th>Ng&#224;y t&#7841;o</th><th></th></tr></thead><tbody>
          {loading ? <tr><td colSpan="6" className="wm-loading-row">&#272;ang t&#7843;i phi&#7871;u ki&#7875;m k&#234;...</td></tr> : visibleRows.length ? visibleRows.map((row) => <tr key={row._id}><td><strong>{row.stocktakeCode || row.adjustmentCode}</strong></td><td>{row.locationId?.code} · {row.locationId?.name}</td><td>{scopeLabel(row)}</td><td><span className={`wm-status-badge status-${row.status}`}>{statusLabel[row.status] || row.status}</span></td><td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td><td><button className="secondary" type="button" onClick={() => { setShowCreate(false); refreshSelected(row._id).catch((e) => setError(e.message)); }}>Chi ti&#7871;t</button></td></tr>) : <tr><td colSpan="6" className="wm-empty-state">{search || statusFilter ? 'Kh&#244;ng t&#236;m th&#7845;y phi&#7871;u kh&#7899;p b&#7897; l&#7885;c.' : 'Ch\u01b0a c\u00f3 phi\u1ebfu ki\u1ec3m k\u00ea.'}</td></tr>}
        </tbody></table></div>
        <div className="wm-pagination"><span>{filteredRows.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredRows.length)} / ${filteredRows.length}` : '0 k\u1ebft qu\u1ea3'}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Tr&#432;&#7899;c</button><span>Trang {page} / {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Sau</button></div></div>
      </section>

      {selected && <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
      <section className="wm-crud-modal wm-stocktake-modal wm-stock-detail">
        <div className="wm-stock-detail-heading"><div><small>{selected.stocktakeCode} · {statusLabel[selected.status]}</small><h2>{selected.locationId?.code} · {selected.locationId?.name}</h2><p>Phạm vi: {scopeLabel(selected)} · Giao cho: {selected.assignedStaffId?.FullName || 'Chưa giao'}</p></div><button type="button" className="secondary" onClick={() => setSelected(null)}>Đóng</button></div>
        <WarehouseWorkflowProgress flow="stocktake" status={selected.status} />
        <div className="wm-report-cards wm-stocktake-summary"><article className="wm-report-card"><span>Tồn sổ</span><strong>{countSummary.expected}</strong></article><article className="wm-report-card"><span>Thực tế dự kiến</span><strong>{countSummary.counted}</strong></article><article className="wm-report-card"><span>Thiếu / mất</span><strong>{countSummary.missing}</strong></article><article className="wm-report-card"><span>Hỏng / không sửa được</span><strong>{countSummary.damaged}</strong></article></div>
        <div className="wm-table-wrap"><table><thead><tr><th>Mặt hàng / InventoryItem</th><th>Vị trí</th><th>Tồn sổ</th><th>Condition thực tế</th><th>SL thực tế</th><th>Chênh lệch</th><th>Ghi nhận</th></tr></thead><tbody>
          {(selected.items || []).map((item) => { const condition = itemConditions[item._id] || item.countedCondition || item.itemId?.condition || 'good'; const individual = Boolean(item.itemId); const actual = individual ? (condition === 'missing' ? 0 : 1) : Number(counts[item._id] || 0); return <tr key={item._id}><td>{itemLabel(item)}<small className="wm-stock-subline">{individual ? 'Kiểm từng itemCode' : 'Nhập tổng số lượng'}</small>{item.itemId && <small className="wm-stock-subline">{item.itemId.itemCode}{item.itemId.serialNumber ? ` · ${item.itemId.serialNumber}` : ''}</small>}{item.countedItemCode && <small className="wm-stock-subline">Mã mới: {item.countedItemCode}</small>}</td><td>{item.storageId?.code || 'Chưa gán'}</td><td>{item.systemQuantity}</td><td>{selected.status === 'in_progress' && individual ? <select aria-label="Condition thực tế của InventoryItem" value={condition} onChange={(event) => { const next = event.target.value; setItemConditions({ ...itemConditions, [item._id]: next }); setCounts({ ...counts, [item._id]: next === 'missing' ? '0' : '1' }); }}><option value="new">Mới</option><option value="good">Tốt</option><option value="worn">Đã qua sử dụng</option><option value="damaged">Hỏng</option><option value="unrepairable">Không thể sửa</option><option value="missing">Mất / không tìm thấy</option></select> : individual ? (item.countedCondition || item.itemId.condition || 'good') : '—'}</td><td>{selected.status === 'in_progress' && !individual ? <input className="wm-count-input" type="number" min="0" step="1" value={counts[item._id] ?? ''} onChange={(event) => setCounts({ ...counts, [item._id]: event.target.value })} /> : actual}</td><td>{individual ? actual - Number(item.systemQuantity || 0) : detailVariance({ ...item, countedQuantity: actual })}</td><td>{item.isCounted ? item.countedBy?.FullName || 'Đã kiểm' : 'Chưa kiểm'}</td></tr>; })}
          {selected.items?.length === 0 && <tr><td colSpan="6">Không có tồn hệ thống trong phạm vi này.</td></tr>}
        </tbody></table></div>
        {selected.status === 'in_progress' && <div className="wm-new-items"><strong>Ghi nhận hàng thực tế chưa có trong hệ thống</strong>{newItems.map((item, index) => {
          const individual = variants.find((variant) => variant._id === item.variantId)?.productId?.trackingType === 'individual';
          return <div className="wm-new-item-row" key={index}>
          <select value={item.variantId} onChange={(event) => setNewItems(newItems.map((row, i) => i === index ? { ...row, variantId: event.target.value } : row))}><option value="">Biến thể</option>{discoveredVariants.map((variant) => <option key={variant._id} value={variant._id}>{variant.productId?.name} · {variant.sku} · {variant.size} · {variant.color}</option>)}</select>
          <select value={item.storageId} onChange={(event) => setNewItems(newItems.map((row, i) => i === index ? { ...row, storageId: event.target.value } : row))}><option value="">Vị trí</option>{storages.filter((storage) => idOf(storage.locationId) === idOf(selected.locationId)).map((storage) => <option key={storage._id} value={storage._id}>{storage.code} · {storage.name}</option>)}</select>
          {individual ? <><input value={item.itemCode || ''} onChange={(event) => setNewItems(newItems.map((row, i) => i === index ? { ...row, itemCode: event.target.value } : row))} placeholder="Mã hàng" /><input value={item.serialNumber || ''} onChange={(event) => setNewItems(newItems.map((row, i) => i === index ? { ...row, serialNumber: event.target.value } : row))} placeholder="Serial (nếu có)" /><select aria-label="Condition InventoryItem mới" value={item.countedCondition || 'good'} onChange={(event) => setNewItems(newItems.map((row, i) => i === index ? { ...row, countedCondition: event.target.value } : row))}><option value="new">Mới</option><option value="good">Tốt</option><option value="worn">Đã qua sử dụng</option><option value="damaged">Hỏng</option><option value="unrepairable">Không thể sửa</option></select></> : <input type="number" min="1" step="1" value={item.countedQuantity || 1} onChange={(event) => setNewItems(newItems.map((row, i) => i === index ? { ...row, countedQuantity: event.target.value } : row))} placeholder="Số lượng thực tế" />}
          <button type="button" className="danger" onClick={() => setNewItems(newItems.filter((_, i) => i !== index))}>Xóa</button>
        </div>})}<button type="button" className="secondary" onClick={() => setNewItems([...newItems, { variantId: '', storageId: '', itemCode: '', countedQuantity: 1 }])}>+ Thêm mặt hàng thực tế</button></div>}
        <div className="wm-stock-actions">
          {selected.status === 'draft' && isManager && <button disabled={busy} onClick={() => runAction(() => stocktakeService.start(selected._id), 'Đã bắt đầu kiểm kê và chụp tồn sổ.')}>Bắt đầu kiểm kê</button>}
          {selected.status === 'in_progress' && <><button className="secondary" disabled={busy} onClick={saveCounts}>Lưu số đếm</button><button disabled={busy} onClick={submitCounts}>Gửi kết quả</button></>}
          {selected.status === 'counted' && isManager && <button disabled={busy} onClick={() => runAction(async () => { const result = await stocktakeService.approve(selected._id); if (result?.adjustment?._id) setNotice(`Đã duyệt kiểm kê, tạo phiếu điều chỉnh ${result.adjustment.adjustmentCode}.`); return result.stocktake; }, 'Đã duyệt kiểm kê.')}>Duyệt và tạo điều chỉnh</button>}
          {selected.status === 'approved' && isManager && <Link className="wm-primary-button" to="/warehousemanager/adjustments">Mở phiếu điều chỉnh</Link>}
        </div>
      </section></div>}


    </main>
  </div>;
}
