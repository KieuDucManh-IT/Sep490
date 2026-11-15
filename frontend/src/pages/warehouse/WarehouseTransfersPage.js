import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, PackageCheck } from 'lucide-react';
import BranchSidebar from '../../components/BranchSidebar';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import { useAuth } from '../../context/AuthContext';
import inventoryLocationService from '../../services/warehouse/inventoryLocationService';
import storageLocationService from '../../services/warehouse/storageLocationService';
import productVariantService from '../../services/masterdata/productVariantService';
import stockTransferService from '../../services/warehouse/stockTransferService';
import inventoryReportService from '../../services/warehouse/inventoryReportService';
import WarehouseWorkflowProgress from '../../components/WarehouseWorkflowProgress';
import WarehouseItemChecklist from '../../components/WarehouseItemChecklist';
import '../../styles/WarehouseManager.css';
import '../../styles/WarehouseUx.css';

const statusLabels = {
  requested: 'Chờ kho tổng duyệt', approved: 'Đã duyệt, chờ nhân viên soạn', rejected: 'Bị từ chối',
  preparing: 'Đang soạn hàng', shipped: 'Đang điều chuyển', partially_received: 'Đã nhận một phần',
  received: 'Đã nhận hàng', cancelled: 'Đã hủy',
};
const idOf = (value) => String(value?._id || value || '');
const variantLabel = (item) => [item.variantId?.productId?.name, item.variantId?.sku, item.variantId?.size, item.variantId?.color].filter(Boolean).join(' · ');

export default function WarehouseTransfersPage({ mode = 'branch' }) {
  const { user } = useAuth();
  const isWarehouse = mode === 'warehouse';
  const isStaff = mode === 'staff';
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(null);
  const [locations, setLocations] = useState([]);
  const [storages, setStorages] = useState([]);
  const [variants, setVariants] = useState([]);
  const [products, setProducts] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [requestLines, setRequestLines] = useState([{ productId: '', variantId: '', quantityRequested: 1 }]);
  const [approval, setApproval] = useState({});
  const [receipt, setReceipt] = useState({});
  const [availableItems, setAvailableItems] = useState({});
  const [itemPickerId, setItemPickerId] = useState('');
  const [receiptPickerId, setReceiptPickerId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [staff, setStaff] = useState([]);
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [pickAllocations, setPickAllocations] = useState({});
  const [pickCandidates, setPickCandidates] = useState({});
  const [pickPicker, setPickPicker] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const requests = [stockTransferService.list()];
      if (isWarehouse) requests.push(inventoryLocationService.list(), storageLocationService.list(), stockTransferService.listStaff());
      else if (isStaff) requests.push(storageLocationService.list());
      else requests.push(stockTransferService.getBranchContext());
      if (!isStaff) requests.push(productVariantService.list());
      const results = await Promise.all(requests);
      setRows(results[0]);
      if (isWarehouse) {
        setLocations(results[1].filter((location) => location.status === 'active'));
        setStorages(results[2].filter((storage) => storage.status === 'active'));
        setStaff(results[3]);
        setVariants(results[4].filter((variant) => variant.status === 'active'));
      } else if (isStaff) {
        setStorages(results[1].filter((storage) => storage.status === 'active'));
      } else {
        const context = results[1];
        setBranchId(context.selectedBranch?.inventoryLocation ? idOf(context.selectedBranch._id) : '');
        const activeVariants = results[2].filter((variant) => variant.status === 'active' && variant.productId?.status === 'active' && variant.productId?.isDeleted !== true);
        setVariants(activeVariants);
        setProducts([...new Map(activeVariants.map((variant) => [idOf(variant.productId), variant.productId])).values()]);
      }
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [isWarehouse, isStaff]);

  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (statusFilter && row.status !== statusFilter) return false;
    const text = [row.transferCode, row.fromLocationId?.name, row.fromLocationId?.code, row.toLocationId?.name, row.toLocationId?.code, row.createdBy?.FullName, row.assignedStaffId?.FullName].join(' ').toLowerCase();
    return !search || text.includes(search.toLowerCase());
  }), [rows, statusFilter, search]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => { setPage(1); }, [search, statusFilter, pageSize, mode]);
  useEffect(() => { if (page > pageCount) setPage(pageCount); }, [page, pageCount]);

  const refreshSelected = async (id) => {
    if (!id) return;
    const transfer = await stockTransferService.get(id);
    setSelected(transfer);
    setApproval(Object.fromEntries((transfer.items || []).map((item) => [item._id, {
      quantityApproved: String(item.quantityRequested), fromStorageId: item.fromStorageId?._id || item.fromStorageId || '',
      itemIds: (item.itemIds || []).map(idOf),
    }])));
    setAvailableItems({});
    setAssignedStaffId(idOf(transfer.assignedStaffId));
    setPickAllocations(Object.fromEntries((transfer.items || []).map((item) => [item._id, (item.pickAllocations || []).map((allocation) => ({ storageId: idOf(allocation.storageId) || 'none', quantity: String(allocation.quantity), itemIds: (allocation.itemIds || []).map(idOf) }))])));
    setReceipt(Object.fromEntries((transfer.items || []).map((item) => [item._id, {
      quantityReceived: String(item.quantityReceived || 0), quantityDamaged: String(item.quantityDamaged || 0),
      receivedItemIds: (item.receivedItemIds || []).map(idOf),
      damagedItemIds: (item.damagedItemIds || []).map(idOf),
    }])));
  };

  const act = async (callback, message) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await callback();
      await load();
      await refreshSelected(result?._id || selected?._id);
      setNotice(message);
      return result;
    } catch (actionError) { setError(actionError.message); }
    finally { setBusy(false); }
  };

  const createRequest = async (event) => {
    event.preventDefault();
    const validLines = requestLines.filter((line) => line.variantId && Number.isInteger(Number(line.quantityRequested)) && Number(line.quantityRequested) > 0);
    if (!branchId || validLines.length !== requestLines.length) { setError('H\u00e3y ch\u1ecdn \u0111\u1ea7y \u0111\u1ee7 bi\u1ebfn th\u1ec3 v\u00e0 nh\u1eadp s\u1ed1 l\u01b0\u1ee3ng nguy\u00ean l\u1edbn h\u01a1n 0 cho t\u1eebng d\u00f2ng.'); return; }
    const variantIds = validLines.map((line) => line.variantId);
    if (new Set(variantIds).size !== variantIds.length) { setError('M\u1ed7i bi\u1ebfn th\u1ec3 ch\u1ec9 n\u00ean xu\u1ea5t hi\u1ec7n m\u1ed9t l\u1ea7n trong y\u00eau c\u1ea7u.'); return; }
    await act(async () => {
      const result = await stockTransferService.createRequest({
        branchId,
        items: validLines.map(({ variantId, quantityRequested }) => ({ variantId, quantityRequested })),
      });
      setShowCreate(false);
      setRequestLines([{ productId: '', variantId: '', quantityRequested: 1 }]);
      return result;
    }, 'Đã gửi yêu cầu bổ sung đến kho tổng.');
  };

  const decide = (decision) => {
    if (decision === 'reject') return act(() => stockTransferService.decide(selected._id, { decision, note: approval.note || '' }), 'Đã từ chối yêu cầu.');
    const items = (selected.items || []).map((item) => ({ detailId: item._id, quantityApproved: Number(approval[item._id]?.quantityApproved ?? item.quantityRequested) }));
    if (items.some((item, index) => !Number.isInteger(item.quantityApproved) || item.quantityApproved < 0 || item.quantityApproved > Number(selected.items[index].quantityRequested)) || !items.some((item) => item.quantityApproved > 0)) { setError('S\u1ed1 l\u01b0\u1ee3ng duy\u1ec7t ph\u1ea3i l\u00e0 s\u1ed1 nguy\u00ean t\u1eeb 0 \u0111\u1ebfn s\u1ed1 y\u00eau c\u1ea7u v\u00e0 c\u1ea7n duy\u1ec7t \u00edt nh\u1ea5t m\u1ed9t m\u1eb7t h\u00e0ng.'); return; }
    if (!assignedStaffId) { setError('Chọn nhân viên kho phụ trách soạn hàng và xuất hàng.'); return; }
    return act(() => stockTransferService.decide(selected._id, { decision, assignedStaffId, note: approval.note || '', items }), 'Đã duyệt và giao việc xuất kho.');
  };

  const updateAllocation = (detailId, index, changes) => setPickAllocations((old) => ({ ...old, [detailId]: (old[detailId] || []).map((row, i) => i === index ? { ...row, ...changes } : row) }));
  const addAllocation = (detailId) => setPickAllocations((old) => ({ ...old, [detailId]: [...(old[detailId] || []), { storageId: '', quantity: '1', itemIds: [] }] }));
  const loadPickCandidates = async (detail, allocation, index) => {
    try {
      const result = await stockTransferService.pickCandidates(selected._id, detail._id, allocation.storageId);
      setPickCandidates((old) => ({ ...old, [`${detail._id}:${index}`]: result }));
      if (detail.variantId?.productId?.trackingType === 'individual') setPickPicker({ detailId: detail._id, index });
    }
    catch (loadError) { setError(loadError.message); }
  };
  const savePick = () => act(() => stockTransferService.savePick(selected._id, { items: (selected.items || []).filter((item) => Number(item.quantityApproved) > 0).map((item) => ({ detailId: item._id, allocations: (pickAllocations[item._id] || []).map((row) => ({ storageId: row.storageId === 'none' ? null : row.storageId, quantity: Number(row.quantity), itemIds: row.itemIds || [] })) })) }), 'Đã lưu phân bổ hàng theo vị trí.');

  const loadAvailableItems = async (item, storageId) => {
    try {
      const rows = await inventoryReportService.getItemDetails({
        locationId: idOf(selected.fromLocationId), storageId: storageId || 'none', variantId: idOf(item.variantId),
        itemLevel: 'variant', availableOnly: true,
      });
      setAvailableItems((old) => ({ ...old, [item._id]: rows }));
    } catch (loadError) { setError(loadError.message); }
  };

  const confirmReceipt = (complete) => {
    const items = (selected.items || []).map((item) => {
      const entry = receipt[item._id] || {};
      const individual = item.variantId?.productId?.trackingType === 'individual';
      const receivedItemIds = individual ? (entry.receivedItemIds || []) : [];
      const damagedItemIds = individual ? (entry.damagedItemIds || []) : [];
      return {
        detailId: item._id,
        quantityReceived: individual ? receivedItemIds.length : Number(entry.quantityReceived || 0),
        quantityDamaged: individual ? damagedItemIds.length : Number(entry.quantityDamaged || 0),
        receivedItemIds, damagedItemIds,
      };
    });
    if (items.some((line, index) => !Number.isInteger(line.quantityReceived) || line.quantityReceived < Number(selected.items[index].quantityReceived || 0) || line.quantityReceived > Number(selected.items[index].quantityShipped || 0) || !Number.isInteger(line.quantityDamaged) || line.quantityDamaged < 0 || line.quantityDamaged > line.quantityReceived)) {
      setError('S\u1ed1 nh\u1eadn ph\u1ea3i l\u00e0 s\u1ed1 nguy\u00ean trong ph\u1ea1m vi \u0111\u00e3 xu\u1ea5t; s\u1ed1 h\u1ecfng kh\u00f4ng \u0111\u01b0\u1ee3c v\u01b0\u1ee3t qu\u00e1 s\u1ed1 nh\u1eadn.');
      return;
    }
    return act(() => stockTransferService.receive(selected._id, { complete, items }), complete ? '\u0110\u00e3 x\u00e1c nh\u1eadn ho\u00e0n t\u1ea5t nh\u1eadn h\u00e0ng.' : '\u0110\u00e3 ghi nh\u1eadn s\u1ed1 h\u00e0ng nh\u1eadn \u0111\u1ee3t n\u00e0y.');
  };

  const detailVariantOptions = useMemo(() => variants, [variants]);
  const sourceStorages = (locationId) => storages.filter((storage) => idOf(storage.locationId) === idOf(locationId));
  const branchName = (location) => `${location?.code || ''} · ${location?.name || ''}`;
  const guidance = selected?.status === 'requested' && isWarehouse ? 'Kiểm tra số lượng khả dụng, chọn nhân viên phụ trách rồi duyệt phiếu.'
    : selected?.status === 'approved' && isStaff ? 'Chọn vị trí lấy hàng và tick đúng InventoryItem nếu sản phẩm theo dõi cá thể.'
      : selected?.status === 'preparing' && isStaff ? 'Rà soát phân bổ trước khi xác nhận xuất hàng khỏi kho tổng.'
        : ['shipped', 'partially_received'].includes(selected?.status) && !isWarehouse && !isStaff ? 'Chi nhánh kiểm đếm số thực nhận, đánh dấu item hỏng nếu có, rồi xác nhận.' : '';

  return <div className={isWarehouse || isStaff ? 'wm-layout' : 'shop-dashboard-layout'}>
    {isWarehouse || isStaff ? <WarehouseSidebar mode={isStaff ? 'staff' : 'manager'} /> : <BranchSidebar />}
    <main className={isWarehouse || isStaff ? 'wm-main wm-stock-control-page' : 'shop-main-content wm-branch-transfer-page'}>
      <header className="wm-header"><div><span>{isWarehouse || isStaff ? 'WAREHOUSE / XUẤT KHO' : 'CHI NHÁNH / BỔ SUNG HÀNG'}</span><h1>{isWarehouse ? 'Duyệt yêu cầu xuất kho' : isStaff ? 'Soạn và xuất hàng được giao' : 'Yêu cầu bổ sung hàng'}</h1></div>
        {!isWarehouse && !isStaff && <button className="wm-primary-button" type="button" onClick={() => { setShowCreate((value) => !value); setSelected(null); }}>+ Tạo yêu cầu</button>}
      </header>
      <div className="wm-stock-tabs"><Link className="active" to={isWarehouse ? '/warehousemanager/outbound' : isStaff ? '/warehousestaff/outbound' : '/branch/stock-requests'}><ArrowLeftRight size={16} />{isWarehouse ? 'Duyệt yêu cầu' : isStaff ? 'Việc xuất kho được giao' : 'Yêu cầu bổ sung hàng'}</Link></div>
      {error && <div className="wm-error">{error}</div>}{notice && <div className="wm-success">{notice}</div>}

      {showCreate && !isWarehouse && <form className="wm-panel wm-form wm-stock-create" onSubmit={createRequest}>
        <div className="wm-transfer-request-lines">
          <div className="wm-transfer-request-heading"><strong>Mặt hàng cần bổ sung</strong><small>Chi nhánh hiện tại: {branchId ? 'Hàng được yêu cầu từ kho tổng về đây' : 'Chưa xác định kho cửa hàng'}</small></div>
          {requestLines.map((line, index) => <div className="wm-transfer-request-item" key={index}>
            <div className="wm-scope-dropdown-row wm-scope-product-row">
              <label>Sản phẩm<select required value={line.productId} onChange={(event) => setRequestLines(requestLines.map((row, i) => i === index ? { ...row, productId: event.target.value, variantId: '' } : row))}><option value="">Chọn sản phẩm</option>{products.map((product) => <option key={product._id} value={product._id}>{product.productCode || product.code} · {product.name}</option>)}</select></label>
              <label>Biến thể<select required disabled={!line.productId} value={line.variantId} onChange={(event) => setRequestLines(requestLines.map((row, i) => i === index ? { ...row, variantId: event.target.value } : row))}><option value="">Chọn biến thể</option>{detailVariantOptions.filter((variant) => idOf(variant.productId) === line.productId).map((variant) => <option key={variant._id} value={variant._id}>{variant.sku} · {variant.size || '—'} · {variant.color || '—'}</option>)}</select></label>
            </div>
            <div className="wm-transfer-request-quantity"><label>Số lượng cần bổ sung<input required type="number" min="1" step="1" value={line.quantityRequested} onChange={(event) => setRequestLines(requestLines.map((row, i) => i === index ? { ...row, quantityRequested: event.target.value } : row))} aria-label="Số lượng yêu cầu" /></label><button type="button" className="danger" disabled={requestLines.length === 1} onClick={() => setRequestLines(requestLines.filter((_, i) => i !== index))}>Xóa dòng</button></div>
          </div>)}
          <button className="secondary" type="button" onClick={() => setRequestLines([...requestLines, { productId: '', variantId: '', quantityRequested: 1 }])}>+ Thêm mặt hàng</button>
        </div>
        <footer><button className="secondary" type="button" onClick={() => setShowCreate(false)}>Hủy</button><button disabled={busy || !branchId}>Gửi yêu cầu</button></footer>
      </form>}

      <section className="wm-panel wm-list-panel">
        <div className="wm-list-toolbar"><label className="wm-search-field">Tìm mã phiếu, chi nhánh hoặc người phụ trách<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nhập từ khóa..." /></label>
          <label>Trạng thái<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Tất cả</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="wm-page-size">Số dòng<select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
        </div>
        <div className="wm-table-wrap"><table><thead><tr><th>Mã phiếu</th><th>{isWarehouse ? 'Chi nhánh yêu cầu' : 'Kho tổng'}</th><th>Mặt hàng</th><th>Trạng thái</th><th>Ngày tạo</th><th /></tr></thead><tbody>
        {loading ? <tr><td colSpan="6" className="wm-loading-row">Đang tải phiếu điều chuyển...</td></tr> : visibleRows.length ? visibleRows.map((row) => <tr key={row._id}>
          <td><strong>{row.transferCode}</strong><small className="wm-row-summary">{row.createdBy?.FullName || 'Người tạo chưa rõ'}</small></td><td>{isWarehouse || isStaff ? branchName(row.toLocationId) : branchName(row.fromLocationId)}</td><td>{row.items?.length || 0} dòng</td><td><span className={`wm-status-badge status-${row.status}`}>{statusLabels[row.status] || row.status}</span></td><td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td><td><button type="button" className="secondary" onClick={() => { setShowCreate(false); refreshSelected(row._id).catch((e) => setError(e.message)); }}>Mở phiếu</button></td>
        </tr>) : <tr><td colSpan="6">Chưa có yêu cầu điều chuyển.</td></tr>}
      </tbody></table></div>
        <div className="wm-pagination"><span>{filteredRows.length ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filteredRows.length)} / ${filteredRows.length}` : '0 kết quả'}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>Trang {page} / {pageCount}</span><button type="button" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Sau</button></div></div>
      </section>

      {selected && <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setItemPickerId(''); setSelected(null); } }}>
        <section className="wm-crud-modal wm-transfer-modal wm-stock-detail">
        <div className="wm-stock-detail-heading"><div><small>{selected.transferCode} · {statusLabels[selected.status]}</small><h2>{branchName(selected.toLocationId)}</h2><p>Kho xuất: {branchName(selected.fromLocationId)} · Người tạo: {selected.createdBy?.FullName || '—'}</p></div><button type="button" className="secondary" onClick={() => { setItemPickerId(''); setSelected(null); }}>Đóng</button></div>
        <WarehouseWorkflowProgress flow="transfer" status={selected.status} />
        {guidance && <div className="wm-action-guidance"><PackageCheck size={17} /><div><strong>Bước tiếp theo</strong>{guidance}</div></div>}
        {isWarehouse && selected.status === 'requested' && <label className="wm-staff-assign">Nhân viên kho phụ trách<select value={assignedStaffId} onChange={(event) => setAssignedStaffId(event.target.value)}><option value="">Chọn nhân viên</option>{staff.map((member) => <option key={member._id} value={member._id}>{member.FullName} · {member.Email}</option>)}</select></label>}
        <div className="wm-table-wrap"><table className={isStaff && selected.status === 'approved' ? 'wm-transfer-picking-table' : ''}><thead><tr><th>Sản phẩm / SKU</th><th>Yêu cầu</th><th>Được duyệt</th><th>Đã xuất</th><th>{!isWarehouse && !isStaff && ['shipped', 'partially_received'].includes(selected.status) ? 'Xác nhận nhận' : 'Đã nhận'}</th><th>Hỏng{selected.status === 'received' ? ' / thiếu' : ''}</th>{isStaff && selected.status === 'approved' && <th>Vị trí lấy hàng</th>}</tr></thead><tbody>
          {(selected.items || []).map((item) => {
            const individual = item.variantId?.productId?.trackingType === 'individual';
            const sourceOptions = sourceStorages(selected.fromLocationId?._id || selected.fromLocationId).filter((storage) => !individual || storage.type === 'shelf');
            const entry = receipt[item._id] || { receivedItemIds: (item.receivedItemIds || []).map(idOf), damagedItemIds: (item.damagedItemIds || []).map(idOf) };
            const receiving = !isWarehouse && !isStaff && ['shipped', 'partially_received'].includes(selected.status);
            return <tr key={item._id}><td>{variantLabel(item)}{item.itemIds?.length > 0 && <small className="wm-stock-subline">Mã hàng: {item.itemIds.map((it) => it.itemCode || it.serialNumber || idOf(it).slice(-6)).join(', ')}</small>}</td><td>{item.quantityRequested}</td>
              <td>{isWarehouse && selected.status === 'requested' ? <input className="wm-count-input" type="number" min="0" max={item.quantityRequested} value={approval[item._id]?.quantityApproved ?? item.quantityRequested} onChange={(event) => setApproval({ ...approval, [item._id]: { ...approval[item._id], quantityApproved: event.target.value } })} /> : item.quantityApproved ?? '—'}</td>
              <td>{item.quantityShipped || 0}</td><td>{receiving ? (individual ? <button type="button" className="secondary" onClick={() => setReceiptPickerId(item._id)}>Xem / xác nhận nhận ({(entry.receivedItemIds || []).length}/{item.quantityShipped || 0})</button> : <div className="wm-transfer-quantity-inputs"><input type="number" min={item.quantityReceived || 0} max={item.quantityShipped} value={entry.quantityReceived ?? item.quantityShipped} aria-label="Số lượng nhận" onChange={(event) => setReceipt({ ...receipt, [item._id]: { ...entry, quantityReceived: event.target.value } })} /><input type="number" min={item.quantityDamaged || 0} max={entry.quantityReceived ?? item.quantityShipped} value={entry.quantityDamaged ?? item.quantityDamaged ?? 0} aria-label="Số lượng hỏng" onChange={(event) => setReceipt({ ...receipt, [item._id]: { ...entry, quantityDamaged: event.target.value } })} /></div>) : item.quantityReceived || 0}</td><td>{item.quantityDamaged || 0}{item.quantityMissing > 0 ? ` / thiếu ${item.quantityMissing}` : ''}</td>
              {isStaff && selected.status === 'approved' && <td><div className="wm-pick-allocation-list">{(pickAllocations[item._id] || []).map((allocation, index) => <div className="wm-pick-allocation" key={index}><select value={allocation.storageId} onChange={(event) => updateAllocation(item._id, index, { storageId: event.target.value, itemIds: [] })}><option value="">Chọn kệ</option><option value="none">Chưa gán vị trí</option>{sourceOptions.map((storage) => <option key={storage._id} value={storage._id}>{storage.code} · {storage.name}</option>)}</select><input aria-label="Số lượng tại vị trí" type="number" min="1" value={allocation.quantity} onChange={(event) => updateAllocation(item._id, index, { quantity: event.target.value })} /><button className="secondary" type="button" onClick={() => loadPickCandidates(item, allocation, index)}>{individual ? `Chọn item (${allocation.itemIds.length}/${allocation.quantity})` : 'Kiểm tra tồn'}</button>{(pickAllocations[item._id] || []).length > 1 && <button className="danger" type="button" onClick={() => setPickAllocations((old) => ({ ...old, [item._id]: old[item._id].filter((_, i) => i !== index) }))}>Xóa</button>}<small>{pickCandidates[`${item._id}:${index}`]?.available != null ? `Khả dụng: ${pickCandidates[`${item._id}:${index}`].available}` : ''}</small></div>)}<button className="secondary" type="button" onClick={() => addAllocation(item._id)}>+ Thêm vị trí</button><small>Đã phân bổ: {(pickAllocations[item._id] || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0)}/{item.quantityApproved}</small></div></td>}
            </tr>;
          })}
        </tbody></table></div>
        <div className="wm-stock-actions">
          {isWarehouse && selected.status === 'requested' && <><button className="danger" disabled={busy} onClick={() => decide('reject')}>Từ chối</button><button disabled={busy} onClick={() => decide('approve')}>Duyệt yêu cầu</button></>}
          {isStaff && selected.status === 'approved' && <button disabled={busy} onClick={savePick}>Lưu phân bổ</button>}
          {isStaff && selected.status === 'preparing' && <button disabled={busy} onClick={() => act(() => stockTransferService.ship(selected._id), 'Đã xác nhận xuất hàng khỏi kho tổng.')}>Xác nhận xuất kho</button>}
          {!isWarehouse && !isStaff && ['shipped', 'partially_received'].includes(selected.status) && <><button className="secondary" disabled={busy} onClick={() => confirmReceipt(false)}><PackageCheck size={16} /> Ghi nhận nhận một phần</button><button disabled={busy} onClick={() => confirmReceipt(true)}><PackageCheck size={16} /> Hoàn tất nhận hàng</button></>}
        </div>
        </section>
      </div>}
      {pickPicker && selected && (() => {
        const item = selected.items?.find((row) => row._id === pickPicker.detailId);
        const allocation = pickAllocations[pickPicker.detailId]?.[pickPicker.index];
        const candidates = pickCandidates[`${pickPicker.detailId}:${pickPicker.index}`] || [];
        if (!item || !allocation) return null;
        return <div className="wm-modal-backdrop wm-transfer-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPickPicker(null); }}>
          <section className="wm-crud-modal wm-transfer-picker" role="dialog" aria-modal="true" aria-labelledby="pick-item-picker-title">
            <header><div><span>CHỌN ITEM ĐỂ XUẤT</span><h2 id="pick-item-picker-title">{variantLabel(item)}</h2><p>Đã chọn {allocation.itemIds.length}/{allocation.quantity}</p></div><button type="button" className="wm-modal-close" onClick={() => setPickPicker(null)} aria-label="Đóng">×</button></header>
            <WarehouseItemChecklist items={candidates} selectedIds={allocation.itemIds} maxSelectable={Number(allocation.quantity)} onToggle={(candidateId, checked) => updateAllocation(pickPicker.detailId, pickPicker.index, { itemIds: checked ? [...allocation.itemIds, candidateId] : allocation.itemIds.filter((id) => id !== candidateId) })} emptyMessage="Không có item khả dụng ở vị trí đã chọn." />
            <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={() => setPickPicker(null)}>Xong ({allocation.itemIds.length}/{allocation.quantity})</button></footer>
          </section>
        </div>;
      })()}
      {itemPickerId && selected && (() => {
        const item = selected.items?.find((row) => row._id === itemPickerId);
        if (!item) return null;
        const chosen = approval[item._id]?.itemIds || [];
        const target = Number(approval[item._id]?.quantityApproved ?? item.quantityRequested);
        const candidates = availableItems[item._id] || [];
        return <div className="wm-modal-backdrop wm-transfer-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setItemPickerId(''); }}>
          <section className="wm-crud-modal wm-transfer-picker" role="dialog" aria-modal="true" aria-labelledby="transfer-item-picker-title">
            <header><div><span>CHỌN HÀNG CÁ THỂ</span><h2 id="transfer-item-picker-title">{variantLabel(item)}</h2><p>Đã chọn {chosen.length}/{target}</p></div><button type="button" className="wm-modal-close" onClick={() => setItemPickerId('')} aria-label="Đóng">×</button></header>
            <WarehouseItemChecklist items={candidates} selectedIds={chosen} maxSelectable={target} onToggle={(inventoryItemId, checked) => setApproval((old) => ({ ...old, [item._id]: { ...old[item._id], itemIds: checked ? [...chosen, inventoryItemId] : chosen.filter((id) => id !== inventoryItemId) } }))} emptyMessage="Không có InventoryItem khả dụng ở vị trí đã chọn." />
            <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={() => setItemPickerId('')}>Xong ({chosen.length}/{target})</button></footer>
          </section>
        </div>;
      })()}
      {receiptPickerId && selected && (() => {
        const item = selected.items?.find((row) => row._id === receiptPickerId);
        if (!item) return null;
        const entry = receipt[item._id] || { receivedItemIds: (item.receivedItemIds || []).map(idOf), damagedItemIds: (item.damagedItemIds || []).map(idOf) };
        const received = entry.receivedItemIds || [];
        const damaged = entry.damagedItemIds || [];
        return <div className="wm-modal-backdrop wm-transfer-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReceiptPickerId(''); }}>
          <section className="wm-crud-modal wm-transfer-picker" role="dialog" aria-modal="true" aria-labelledby="transfer-receipt-picker-title">
            <header><div><span>XÁC NHẬN HÀNG ĐÃ NHẬN</span><h2 id="transfer-receipt-picker-title">{variantLabel(item)}</h2><p>Đã nhận {received.length}/{item.quantityShipped || 0} · Hỏng {damaged.length}</p></div><button type="button" className="wm-modal-close" onClick={() => setReceiptPickerId('')} aria-label="Đóng">×</button></header>
            <WarehouseItemChecklist items={item.itemIds || []} selectedIds={received} maxSelectable={Number(item.quantityShipped || 0)} onToggle={(inventoryItemId, checked) => setReceipt((old) => ({ ...old, [item._id]: { ...entry, receivedItemIds: checked ? [...received, inventoryItemId] : received.filter((id) => id !== inventoryItemId), damagedItemIds: checked ? damaged : damaged.filter((id) => id !== inventoryItemId) } }))} emptyMessage="Phiếu chưa có InventoryItem được xuất." renderExtra={(inventoryItem, inventoryItemId, isReceived) => <span className="wm-receipt-damaged" onClick={(event) => event.stopPropagation()}><input type="checkbox" aria-label="Đánh dấu hàng hỏng" disabled={!isReceived} checked={damaged.includes(inventoryItemId)} onChange={(event) => setReceipt((old) => ({ ...old, [item._id]: { ...entry, damagedItemIds: event.target.checked ? [...damaged, inventoryItemId] : damaged.filter((id) => id !== inventoryItemId) } }))} /> Hỏng</span>} />
            <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={() => setReceiptPickerId('')}>Xong ({received.length}/{item.quantityShipped || 0})</button></footer>
          </section>
        </div>;
      })()}
    </main>
  </div>;
}
