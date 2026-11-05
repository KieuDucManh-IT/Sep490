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
import '../../styles/WarehouseManager.css';

const statusLabels = {
  requested: 'Chá» kho tá»•ng duyá»‡t', approved: 'Đã duyệt, chờ nhân viên soạn', rejected: 'Bá»‹ tá»« chá»‘i',
  preparing: 'Äang soáº¡n hÃ ng', shipped: 'Äang Ä‘iá»u chuyá»ƒn', partially_received: 'ÄÃ£ nháº­n má»™t pháº§n',
  received: 'ÄÃ£ nháº­n hÃ ng', cancelled: 'ÄÃ£ há»§y',
};
const idOf = (value) => String(value?._id || value || '');
const variantLabel = (item) => [item.variantId?.productId?.name, item.variantId?.sku, item.variantId?.size, item.variantId?.color].filter(Boolean).join(' Â· ');

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
        const activeVariants = results[2].filter((variant) => variant.status === 'active' && variant.productId?.status === 'active');
        setVariants(activeVariants);
        setProducts([...new Map(activeVariants.map((variant) => [idOf(variant.productId), variant.productId])).values()]);
      }
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [isWarehouse, isStaff]);

  useEffect(() => { load(); }, [load]);

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
    const validLines = requestLines.filter((line) => line.variantId && Number(line.quantityRequested) > 0);
    await act(async () => {
      const result = await stockTransferService.createRequest({
        branchId,
        items: validLines.map(({ variantId, quantityRequested }) => ({ variantId, quantityRequested })),
      });
      setShowCreate(false);
      setRequestLines([{ productId: '', variantId: '', quantityRequested: 1 }]);
      return result;
    }, 'ÄÃ£ gá»­i yÃªu cáº§u bá»• sung Ä‘áº¿n kho tá»•ng.');
  };

  const decide = (decision) => {
    if (decision === 'reject') return act(() => stockTransferService.decide(selected._id, { decision, note: approval.note || '' }), 'ÄÃ£ tá»« chá»‘i yÃªu cáº§u.');
    const items = (selected.items || []).map((item) => ({ detailId: item._id, quantityApproved: Number(approval[item._id]?.quantityApproved ?? item.quantityRequested) }));
    if (!assignedStaffId) { setError('Chá»n nhÃ¢n viÃªn kho phá»¥ trÃ¡ch soáº¡n hÃ ng vÃ  xuáº¥t hÃ ng.'); return; }
    return act(() => stockTransferService.decide(selected._id, { decision, assignedStaffId, note: approval.note || '', items }), 'ÄÃ£ duyá»‡t vÃ  giao viá»‡c xuáº¥t kho.');
  };

  const updateAllocation = (detailId, index, changes) => setPickAllocations((old) => ({ ...old, [detailId]: (old[detailId] || []).map((row, i) => i === index ? { ...row, ...changes } : row) }));
  const addAllocation = (detailId) => setPickAllocations((old) => ({ ...old, [detailId]: [...(old[detailId] || []), { storageId: '', quantity: '1', itemIds: [] }] }));
  const loadPickCandidates = async (detail, allocation, index) => {
    try { const result = await stockTransferService.pickCandidates(selected._id, detail._id, allocation.storageId); setPickCandidates((old) => ({ ...old, [`${detail._id}:${index}`]: result })); }
    catch (loadError) { setError(loadError.message); }
  };
  const savePick = () => act(() => stockTransferService.savePick(selected._id, { items: (selected.items || []).filter((item) => Number(item.quantityApproved) > 0).map((item) => ({ detailId: item._id, allocations: (pickAllocations[item._id] || []).map((row) => ({ storageId: row.storageId === 'none' ? null : row.storageId, quantity: Number(row.quantity), itemIds: row.itemIds || [] })) })) }), 'ÄÃ£ lÆ°u phÃ¢n bá»• hÃ ng theo vá»‹ trÃ­.');

  const loadAvailableItems = async (item, storageId) => {
    try {
      const rows = await inventoryReportService.getItemDetails({
        locationId: idOf(selected.fromLocationId), storageId: storageId || 'none', variantId: idOf(item.variantId),
        itemLevel: 'variant', availableOnly: true,
      });
      setAvailableItems((old) => ({ ...old, [item._id]: rows }));
    } catch (loadError) { setError(loadError.message); }
  };

  const confirmReceipt = (complete) => act(() => stockTransferService.receive(selected._id, {
    complete,
    items: (selected.items || []).map((item) => {
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
    }),
  }), complete ? 'ÄÃ£ xÃ¡c nháº­n hoÃ n táº¥t nháº­n hÃ ng.' : 'ÄÃ£ ghi nháº­n sá»‘ hÃ ng nháº­n Ä‘á»£t nÃ y.');

  const detailVariantOptions = useMemo(() => variants, [variants]);
  const sourceStorages = (locationId) => storages.filter((storage) => idOf(storage.locationId) === idOf(locationId));
  const branchName = (location) => `${location?.code || ''} Â· ${location?.name || ''}`;

  return <div className={isWarehouse || isStaff ? 'wm-layout' : 'shop-dashboard-layout'}>
    {isWarehouse || isStaff ? <WarehouseSidebar mode={isStaff ? 'staff' : 'manager'} /> : <BranchSidebar />}
    <main className={isWarehouse || isStaff ? 'wm-main wm-stock-control-page' : 'shop-main-content wm-branch-transfer-page'}>
      <header className="wm-header"><div><span>{isWarehouse || isStaff ? 'WAREHOUSE / XUáº¤T KHO' : 'CHI NHÃNH / Bá»” SUNG HÃ€NG'}</span><h1>{isWarehouse ? 'Duyá»‡t yÃªu cáº§u xuáº¥t kho' : isStaff ? 'Soáº¡n vÃ  xuáº¥t hÃ ng Ä‘Æ°á»£c giao' : 'YÃªu cáº§u bá»• sung hÃ ng'}</h1></div>
        {!isWarehouse && !isStaff && <button className="wm-primary-button" type="button" onClick={() => { setShowCreate((value) => !value); setSelected(null); }}>+ Táº¡o yÃªu cáº§u</button>}
      </header>
      <div className="wm-stock-tabs"><Link className="active" to={isWarehouse ? '/warehousemanager/outbound' : isStaff ? '/warehousestaff/outbound' : '/branch/stock-requests'}><ArrowLeftRight size={16} />{isWarehouse ? 'Duyá»‡t yÃªu cáº§u' : isStaff ? 'Viá»‡c xuáº¥t kho Ä‘Æ°á»£c giao' : 'YÃªu cáº§u bá»• sung hÃ ng'}</Link></div>
      {error && <div className="wm-error">{error}</div>}{notice && <div className="wm-success">{notice}</div>}

      {showCreate && !isWarehouse && <form className="wm-panel wm-form wm-stock-create" onSubmit={createRequest}>
        <div className="wm-transfer-request-lines"><strong>Máº·t hÃ ng cáº§n bá»• sung</strong>{requestLines.map((line, index) => <div className="wm-new-item-row" key={index}>
          <select required value={line.productId} onChange={(event) => setRequestLines(requestLines.map((row, i) => i === index ? { ...row, productId: event.target.value, variantId: '' } : row))}><option value="">Chá»n sáº£n pháº©m</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}</select>
          <select required disabled={!line.productId} value={line.variantId} onChange={(event) => setRequestLines(requestLines.map((row, i) => i === index ? { ...row, variantId: event.target.value } : row))}><option value="">Chá»n biáº¿n thá»ƒ</option>{detailVariantOptions.filter((variant) => idOf(variant.productId) === line.productId).map((variant) => <option key={variant._id} value={variant._id}>{variant.sku} Â· {variant.size} Â· {variant.color}</option>)}</select>
          <input required type="number" min="1" step="1" value={line.quantityRequested} onChange={(event) => setRequestLines(requestLines.map((row, i) => i === index ? { ...row, quantityRequested: event.target.value } : row))} aria-label="Sá»‘ lÆ°á»£ng yÃªu cáº§u" />
          <button type="button" className="danger" disabled={requestLines.length === 1} onClick={() => setRequestLines(requestLines.filter((_, i) => i !== index))}>XÃ³a</button>
        </div>)}<button className="secondary" type="button" onClick={() => setRequestLines([...requestLines, { productId: '', variantId: '', quantityRequested: 1 }])}>+ ThÃªm máº·t hÃ ng</button></div>
        <footer><button className="secondary" type="button" onClick={() => setShowCreate(false)}>Há»§y</button><button disabled={busy || !branchId}>Gá»­i yÃªu cáº§u</button></footer>
      </form>}

      <section className="wm-panel wm-list-panel"><div className="wm-table-wrap"><table><thead><tr><th>MÃ£ phiáº¿u</th><th>{isWarehouse ? 'Chi nhÃ¡nh yÃªu cáº§u' : 'Kho tá»•ng'}</th><th>Máº·t hÃ ng</th><th>Tráº¡ng thÃ¡i</th><th>NgÃ y táº¡o</th><th /></tr></thead><tbody>
        {loading ? <tr><td colSpan="6">Äang táº£i...</td></tr> : rows.length ? rows.map((row) => <tr key={row._id}>
          <td><strong>{row.transferCode}</strong></td><td>{isWarehouse || isStaff ? branchName(row.toLocationId) : branchName(row.fromLocationId)}</td><td>{row.items?.length || 0}</td><td>{statusLabels[row.status] || row.status}</td><td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td><td><button type="button" className="secondary" onClick={() => { setShowCreate(false); refreshSelected(row._id).catch((e) => setError(e.message)); }}>Chi tiáº¿t</button></td>
        </tr>) : <tr><td colSpan="6">ChÆ°a cÃ³ yÃªu cáº§u Ä‘iá»u chuyá»ƒn.</td></tr>}
      </tbody></table></div></section>

      {selected && <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setItemPickerId(''); setSelected(null); } }}>
        <section className="wm-crud-modal wm-transfer-modal wm-stock-detail">
        <div className="wm-stock-detail-heading"><div><small>{selected.transferCode} Â· {statusLabels[selected.status]}</small><h2>{branchName(selected.toLocationId)}</h2><p>Kho xuáº¥t: {branchName(selected.fromLocationId)} Â· NgÆ°á»i táº¡o: {selected.createdBy?.FullName || 'â€”'}</p></div><button type="button" className="secondary" onClick={() => { setItemPickerId(''); setSelected(null); }}>ÄÃ³ng</button></div>
        {isWarehouse && selected.status === 'requested' && <label className="wm-staff-assign">NhÃ¢n viÃªn kho phá»¥ trÃ¡ch<select value={assignedStaffId} onChange={(event) => setAssignedStaffId(event.target.value)}><option value="">Chá»n nhÃ¢n viÃªn</option>{staff.map((member) => <option key={member._id} value={member._id}>{member.FullName} Â· {member.Email}</option>)}</select></label>}
        <div className="wm-table-wrap"><table><thead><tr><th>Sáº£n pháº©m / SKU</th><th>YÃªu cáº§u</th><th>ÄÆ°á»£c duyá»‡t</th><th>ÄÃ£ xuáº¥t</th><th>{!isWarehouse && !isStaff && ['shipped', 'partially_received'].includes(selected.status) ? 'XÃ¡c nháº­n nháº­n' : 'ÄÃ£ nháº­n'}</th><th>Há»ng{selected.status === 'received' ? ' / thiáº¿u' : ''}</th>{isStaff && selected.status === 'approved' && <th>Vá»‹ trÃ­ láº¥y hÃ ng</th>}</tr></thead><tbody>
          {(selected.items || []).map((item) => {
            const individual = item.variantId?.productId?.trackingType === 'individual';
            const sourceOptions = sourceStorages(selected.fromLocationId?._id || selected.fromLocationId).filter((storage) => !individual || storage.type === 'shelf');
            const entry = receipt[item._id] || { receivedItemIds: (item.receivedItemIds || []).map(idOf), damagedItemIds: (item.damagedItemIds || []).map(idOf) };
            const receiving = !isWarehouse && !isStaff && ['shipped', 'partially_received'].includes(selected.status);
            return <tr key={item._id}><td>{variantLabel(item)}{item.itemIds?.length > 0 && <small className="wm-stock-subline">MÃ£ hÃ ng: {item.itemIds.map((it) => it.itemCode || it.serialNumber || idOf(it).slice(-6)).join(', ')}</small>}</td><td>{item.quantityRequested}</td>
              <td>{isWarehouse && selected.status === 'requested' ? <input className="wm-count-input" type="number" min="0" max={item.quantityRequested} value={approval[item._id]?.quantityApproved ?? item.quantityRequested} onChange={(event) => setApproval({ ...approval, [item._id]: { ...approval[item._id], quantityApproved: event.target.value } })} /> : item.quantityApproved ?? 'â€”'}</td>
              <td>{item.quantityShipped || 0}</td><td>{receiving ? (individual ? <button type="button" className="secondary" onClick={() => setReceiptPickerId(item._id)}>Xem / xÃ¡c nháº­n nháº­n ({(entry.receivedItemIds || []).length}/{item.quantityShipped || 0})</button> : <div className="wm-transfer-quantity-inputs"><input type="number" min={item.quantityReceived || 0} max={item.quantityShipped} value={entry.quantityReceived ?? item.quantityShipped} aria-label="Sá»‘ lÆ°á»£ng nháº­n" onChange={(event) => setReceipt({ ...receipt, [item._id]: { ...entry, quantityReceived: event.target.value } })} /><input type="number" min={item.quantityDamaged || 0} max={entry.quantityReceived ?? item.quantityShipped} value={entry.quantityDamaged ?? item.quantityDamaged ?? 0} aria-label="Sá»‘ lÆ°á»£ng há»ng" onChange={(event) => setReceipt({ ...receipt, [item._id]: { ...entry, quantityDamaged: event.target.value } })} /></div>) : item.quantityReceived || 0}</td><td>{item.quantityDamaged || 0}{item.quantityMissing > 0 ? ` / thiáº¿u ${item.quantityMissing}` : ''}</td>
              {isStaff && selected.status === 'approved' && <td><div className="wm-pick-allocation-list">{(pickAllocations[item._id] || []).map((allocation, index) => <div className="wm-pick-allocation" key={index}><select value={allocation.storageId} onChange={(event) => updateAllocation(item._id, index, { storageId: event.target.value, itemIds: [] })}><option value="">Chá»n ká»‡</option><option value="none">ChÆ°a gÃ¡n vá»‹ trÃ­</option>{sourceOptions.map((storage) => <option key={storage._id} value={storage._id}>{storage.code} Â· {storage.name}</option>)}</select><input aria-label="Sá»‘ lÆ°á»£ng táº¡i vá»‹ trÃ­" type="number" min="1" value={allocation.quantity} onChange={(event) => updateAllocation(item._id, index, { quantity: event.target.value })} /><button className="secondary" type="button" onClick={() => loadPickCandidates(item, allocation, index)}>{individual ? `Táº£i item (${allocation.itemIds.length}/${allocation.quantity})` : 'Kiá»ƒm tra tá»“n'}</button>{(pickAllocations[item._id] || []).length > 1 && <button className="danger" type="button" onClick={() => setPickAllocations((old) => ({ ...old, [item._id]: old[item._id].filter((_, i) => i !== index) }))}>XÃ³a</button>}<small>{pickCandidates[`${item._id}:${index}`]?.available != null ? `Kháº£ dá»¥ng: ${pickCandidates[`${item._id}:${index}`].available}` : ''}</small>{individual && Array.isArray(pickCandidates[`${item._id}:${index}`]) && <div className="wm-transfer-picker-list">{pickCandidates[`${item._id}:${index}`].map((candidate) => { const candidateId = idOf(candidate); const chosen = allocation.itemIds.includes(candidateId); return <label key={candidateId}><input type="checkbox" checked={chosen} disabled={!chosen && allocation.itemIds.length >= Number(allocation.quantity)} onChange={(event) => updateAllocation(item._id, index, { itemIds: event.target.checked ? [...allocation.itemIds, candidateId] : allocation.itemIds.filter((id) => id !== candidateId) })} /><span><strong>{candidate.itemCode}</strong><small>{candidate.serialNumber || 'ChÆ°a cÃ³ serial'} Â· {candidate.condition}</small></span></label>; })}</div>}</div>)}<button className="secondary" type="button" onClick={() => addAllocation(item._id)}>+ ThÃªm vá»‹ trÃ­</button><small>ÄÃ£ phÃ¢n bá»•: {(pickAllocations[item._id] || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0)}/{item.quantityApproved}</small></div></td>}
            </tr>;
          })}
        </tbody></table></div>
        <div className="wm-stock-actions">
          {isWarehouse && selected.status === 'requested' && <><button className="danger" disabled={busy} onClick={() => decide('reject')}>Tá»« chá»‘i</button><button disabled={busy} onClick={() => decide('approve')}>Duyá»‡t yÃªu cáº§u</button></>}
          {isStaff && selected.status === 'approved' && <button disabled={busy} onClick={savePick}>LÆ°u phÃ¢n bá»•</button>}
          {isStaff && selected.status === 'preparing' && <button disabled={busy} onClick={() => act(() => stockTransferService.ship(selected._id), 'ÄÃ£ xÃ¡c nháº­n xuáº¥t hÃ ng khá»i kho tá»•ng.')}>XÃ¡c nháº­n xuáº¥t kho</button>}
          {!isWarehouse && !isStaff && ['shipped', 'partially_received'].includes(selected.status) && <><button className="secondary" disabled={busy} onClick={() => confirmReceipt(false)}><PackageCheck size={16} /> Ghi nháº­n nháº­n má»™t pháº§n</button><button disabled={busy} onClick={() => confirmReceipt(true)}><PackageCheck size={16} /> HoÃ n táº¥t nháº­n hÃ ng</button></>}
        </div>
        </section>
      </div>}
      {itemPickerId && selected && (() => {
        const item = selected.items?.find((row) => row._id === itemPickerId);
        if (!item) return null;
        const chosen = approval[item._id]?.itemIds || [];
        const target = Number(approval[item._id]?.quantityApproved ?? item.quantityRequested);
        const candidates = availableItems[item._id] || [];
        return <div className="wm-modal-backdrop wm-transfer-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setItemPickerId(''); }}>
          <section className="wm-crud-modal wm-transfer-picker" role="dialog" aria-modal="true" aria-labelledby="transfer-item-picker-title">
            <header><div><span>CHá»ŒN HÃ€NG CÃ THá»‚</span><h2 id="transfer-item-picker-title">{variantLabel(item)}</h2><p>ÄÃ£ chá»n {chosen.length}/{target}</p></div><button type="button" className="wm-modal-close" onClick={() => setItemPickerId('')} aria-label="ÄÃ³ng">Ã—</button></header>
            <div className="wm-transfer-picker-list">{candidates.length ? candidates.map((inventoryItem) => { const inventoryItemId = idOf(inventoryItem); return <label key={inventoryItemId}><input type="checkbox" checked={chosen.includes(inventoryItemId)} disabled={!chosen.includes(inventoryItemId) && chosen.length >= target} onChange={(event) => setApproval((old) => ({ ...old, [item._id]: { ...old[item._id], itemIds: event.target.checked ? [...chosen, inventoryItemId] : chosen.filter((id) => id !== inventoryItemId) } }))} /><span><strong>{inventoryItem.itemCode}</strong><small>{inventoryItem.serialNumber || 'ChÆ°a cÃ³ serial'} Â· {inventoryItem.condition} Â· {inventoryItem.status}</small></span></label>; }) : <p>KhÃ´ng cÃ³ InventoryItem kháº£ dá»¥ng á»Ÿ vá»‹ trÃ­ Ä‘Ã£ chá»n.</p>}</div>
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
            <header><div><span>XÃC NHáº¬N HÃ€NG ÄÃƒ NHáº¬N</span><h2 id="transfer-receipt-picker-title">{variantLabel(item)}</h2><p>ÄÃ£ nháº­n {received.length}/{item.quantityShipped || 0} Â· Há»ng {damaged.length}</p></div><button type="button" className="wm-modal-close" onClick={() => setReceiptPickerId('')} aria-label="ÄÃ³ng">Ã—</button></header>
            <div className="wm-transfer-picker-list">{(item.itemIds || []).length ? item.itemIds.map((inventoryItem) => {
              const inventoryItemId = idOf(inventoryItem);
              const isReceived = received.includes(inventoryItemId);
              return <label key={inventoryItemId} className="wm-receipt-item-row"><input type="checkbox" checked={isReceived} onChange={(event) => setReceipt((old) => ({ ...old, [item._id]: { ...entry, receivedItemIds: event.target.checked ? [...received, inventoryItemId] : received.filter((id) => id !== inventoryItemId), damagedItemIds: event.target.checked ? damaged : damaged.filter((id) => id !== inventoryItemId) } }))} /><span><strong>{inventoryItem.itemCode || inventoryItem.serialNumber || inventoryItemId.slice(-6)}</strong><small>{inventoryItem.serialNumber || 'ChÆ°a cÃ³ serial'} Â· {inventoryItem.condition || 'â€”'}</small></span><span className="wm-receipt-damaged"><input type="checkbox" aria-label="ÄÃ¡nh dáº¥u hÃ ng há»ng" disabled={!isReceived} checked={damaged.includes(inventoryItemId)} onChange={(event) => setReceipt((old) => ({ ...old, [item._id]: { ...entry, damagedItemIds: event.target.checked ? [...damaged, inventoryItemId] : damaged.filter((id) => id !== inventoryItemId) } }))} /> Há»ng</span></label>;
            }) : <p>Phiáº¿u chÆ°a cÃ³ InventoryItem Ä‘Æ°á»£c xuáº¥t.</p>}</div>
            <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={() => setReceiptPickerId('')}>Xong ({received.length}/{item.quantityShipped || 0})</button></footer>
          </section>
        </div>;
      })()}
    </main>
  </div>;
}
