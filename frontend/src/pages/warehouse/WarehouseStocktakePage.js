import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import { useAuth } from '../../context/AuthContext';
import inventoryLocationService from '../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../services/warehouse/storageLocationService';
import productVariantService from '../../services/masterdata/productVariantService';
import stocktakeService from '../../services/warehouse/stocktakeService';
import '../../styles/WarehouseManager.css';

const statusLabel = {
  draft: 'Nháp', in_progress: 'Đang kiểm', counted: 'Chờ duyệt kiểm kê', approved: 'Đã duyệt', cancelled: 'Đã hủy',
  requested: 'Chờ duyệt điều chỉnh', rejected: 'Từ chối', applied: 'Đã cập nhật tồn',
};
const idOf = (value) => String(value?._id || value || '');
const itemLabel = (item) => [item.variantId?.productId?.name, item.variantId?.sku, item.variantId?.size, item.variantId?.color].filter(Boolean).join(' · ');
const detailVariance = (item) => Number(item.countedQuantity || 0) + Number(item.movementAfterCount || 0) - Number(item.systemQuantity || 0);

export default function WarehouseStocktakePage() {
  const { user } = useAuth();
  const role = user?.Role || user?.role || user?.roleName || '';
  const isManager = /warehouse_manager|admin/i.test(role);
  const [rows, setRows] = useState([]);
  const [locations, setLocations] = useState([]);
  const [storages, setStorages] = useState([]);
  const [variants, setVariants] = useState([]);
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
  const [createForm, setCreateForm] = useState({ locationId: '', scopeType: 'full', variantIds: [], storageIds: [], assignedStaffId: '' });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
        const requests = [
          stocktakeService.list(),
          inventoryLocationService.list(),
          storageLocationService.list(),
          productVariantService.list(),
        ];
        if (isManager) requests.push(stocktakeService.listStaff());
        const [stocktakes, locationRows, storageRows, variantRows, staffRows = []] = await Promise.all(requests);
        setRows(stocktakes);
        const centralWarehouses = locationRows.filter((item) => item.type === 'warehouse' && item.status === 'active');
        setLocations(centralWarehouses);
        setCreateForm((current) => ({ ...current, locationId: centralWarehouses.length === 1 ? centralWarehouses[0]._id : '' }));
        setStorages(storageRows.filter((item) => item.status === 'active'));
        setVariants(variantRows.filter((item) => item.status === 'active'));
        setStaff(staffRows);
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [isManager]);

  useEffect(() => { load(); }, [load]);
  const selectedLocation = locations.find((item) => item._id === createForm.locationId);
  const createVariants = useMemo(() => variants.filter((variant) => !selectedLocation || !variant.locationId || idOf(variant.locationId) === selectedLocation._id), [variants, selectedLocation]);
  const selectableStorages = useMemo(() => storages.filter((item) => !createForm.locationId || idOf(item.locationId) === createForm.locationId), [storages, createForm.locationId]);
  const discoveredVariants = variants.filter((variant) => selected?.scopeType !== 'product' || (selected.variantIds || []).some((id) => idOf(id) === variant._id));

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
    const payload = {
      ...createForm,
      variantIds: createForm.scopeType === 'product' ? createForm.variantIds : [],
      storageIds: createForm.scopeType === 'storage_location' ? createForm.storageIds : [],
    };
    const result = await runAction(() => stocktakeService.create(payload), 'Đã tạo phiếu kiểm kê nháp.');
    if (result?.data?._id || result?._id) {
      const id = result?.data?._id || result._id;
      setShowCreate(false);
      setCreateForm({ locationId: '', scopeType: 'full', variantIds: [], storageIds: [], assignedStaffId: '' });
      await refreshSelected(id);
    }
  };

  const saveCounts = async () => {
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
        <label>Phạm vi<select value={createForm.scopeType} onChange={(event) => setCreateForm({ ...createForm, scopeType: event.target.value, variantIds: [], storageIds: [] })}><option value="full">Toàn kho</option><option value="product">Theo biến thể</option><option value="storage_location">Theo vị trí</option></select></label>
        {createForm.scopeType === 'product' && <label className="wm-stock-wide">Biến thể<select multiple required value={createForm.variantIds} onChange={(event) => setCreateForm({ ...createForm, variantIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>{createVariants.map((variant) => <option key={variant._id} value={variant._id}>{variant.productId?.name} · {variant.sku} · {variant.size} · {variant.color}</option>)}</select></label>}
        {createForm.scopeType === 'storage_location' && <label className="wm-stock-wide">Vị trí lưu trữ<select multiple required value={createForm.storageIds} onChange={(event) => setCreateForm({ ...createForm, storageIds: Array.from(event.target.selectedOptions, (option) => option.value) })}>{selectableStorages.map((storage) => <option key={storage._id} value={storage._id}>{storage.code} · {storage.name} ({storage.type})</option>)}</select></label>}
        <label>Nhân viên kiểm kê<select value={createForm.assignedStaffId} onChange={(event) => setCreateForm({ ...createForm, assignedStaffId: event.target.value })}><option value="">Tự kiểm kê / chưa giao</option>{staff.map((member) => <option key={member._id} value={member._id}>{member.FullName} · {member.Email}</option>)}</select></label>
        <footer><button type="button" className="secondary" onClick={() => setShowCreate(false)}>Hủy</button><button disabled={busy || !createForm.locationId}>Tạo phiếu</button></footer>
      </form>}

      <section className="wm-panel wm-list-panel"><div className="wm-table-wrap"><table><thead><tr><th>Mã phiếu</th><th>Kho</th><th>Phạm vi</th><th>Trạng thái</th><th>Ngày tạo</th><th></th></tr></thead><tbody>
        {loading ? <tr><td colSpan="6">Đang tải...</td></tr> : rows.length ? rows.map((row) => <tr key={row._id}>
          <td><strong>{row.stocktakeCode || row.adjustmentCode}</strong></td><td>{row.locationId?.code} · {row.locationId?.name}</td><td>{row.scopeType === 'full' ? 'Toàn kho' : row.scopeType === 'product' ? 'Theo biến thể' : row.stocktakeId?.stocktakeCode || 'Theo vị trí'}</td><td>{statusLabel[row.status] || row.status}</td><td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td><td><button className="secondary" type="button" onClick={() => { setShowCreate(false); refreshSelected(row._id).catch((e) => setError(e.message)); }}>Chi tiết</button></td>
        </tr>) : <tr><td colSpan="6">Chưa có phiếu.</td></tr>}
      </tbody></table></div></section>

      {selected && <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
      <section className="wm-crud-modal wm-stocktake-modal wm-stock-detail">
        <div className="wm-stock-detail-heading"><div><small>{selected.stocktakeCode} · {statusLabel[selected.status]}</small><h2>{selected.locationId?.code} · {selected.locationId?.name}</h2><p>Giao cho: {selected.assignedStaffId?.FullName || 'Chưa giao'}</p></div><button type="button" className="secondary" onClick={() => setSelected(null)}>Đóng</button></div>
        <div className="wm-report-cards wm-stocktake-summary"><article className="wm-report-card"><span>Tồn sổ</span><strong>{countSummary.expected}</strong></article><article className="wm-report-card"><span>Thực tế dự kiến</span><strong>{countSummary.counted}</strong></article><article className="wm-report-card"><span>Thiếu / mất</span><strong>{countSummary.missing}</strong></article><article className="wm-report-card"><span>Hỏng / không sửa được</span><strong>{countSummary.damaged}</strong></article></div>
        <div className="wm-table-wrap"><table><thead><tr><th>Mặt hàng / InventoryItem</th><th>Vị trí</th><th>Tồn sổ</th><th>Condition thực tế</th><th>SL thực tế</th><th>Chênh lệch</th><th>Ghi nhận</th></tr></thead><tbody>
          {(selected.items || []).map((item) => { const condition = itemConditions[item._id] || item.countedCondition || item.itemId?.condition || 'good'; const individual = Boolean(item.itemId); const actual = individual ? (condition === 'missing' ? 0 : 1) : Number(counts[item._id] || 0); return <tr key={item._id}><td>{itemLabel(item)}{item.itemId && <small className="wm-stock-subline">{item.itemId.itemCode}{item.itemId.serialNumber ? ` · ${item.itemId.serialNumber}` : ''}</small>}{item.countedItemCode && <small className="wm-stock-subline">Mã mới: {item.countedItemCode}</small>}</td><td>{item.storageId?.code || 'Chưa gán'}</td><td>{item.systemQuantity}</td><td>{selected.status === 'in_progress' && individual ? <select aria-label="Condition thực tế của InventoryItem" value={condition} onChange={(event) => { const next = event.target.value; setItemConditions({ ...itemConditions, [item._id]: next }); setCounts({ ...counts, [item._id]: next === 'missing' ? '0' : '1' }); }}><option value="new">Mới</option><option value="good">Tốt</option><option value="worn">Đã qua sử dụng</option><option value="damaged">Hỏng</option><option value="unrepairable">Không thể sửa</option><option value="missing">Mất / không tìm thấy</option></select> : individual ? (item.countedCondition || item.itemId.condition || 'good') : '—'}</td><td>{selected.status === 'in_progress' && !individual ? <input className="wm-count-input" type="number" min="0" step="1" value={counts[item._id] ?? ''} onChange={(event) => setCounts({ ...counts, [item._id]: event.target.value })} /> : actual}</td><td>{individual ? actual - Number(item.systemQuantity || 0) : detailVariance({ ...item, countedQuantity: actual })}</td><td>{item.isCounted ? item.countedBy?.FullName || 'Đã kiểm' : 'Chưa kiểm'}</td></tr>; })}
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
