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
  requested: 'Chờ kho tổng duyệt', approved: 'Đã duyệt, chờ xuất', rejected: 'Bị từ chối',
  preparing: 'Đang soạn hàng', shipped: 'Đang điều chuyển', partially_received: 'Đã nhận một phần',
  received: 'Đã nhận hàng', cancelled: 'Đã hủy',
};
const idOf = (value) => String(value?._id || value || '');
const variantLabel = (item) => [item.variantId?.productId?.name, item.variantId?.sku, item.variantId?.size, item.variantId?.color].filter(Boolean).join(' · ');
const itemIdsOf = (detail) => (detail.itemIds || []).map((item) => idOf(item));

export default function WarehouseTransfersPage({ mode = 'branch' }) {
  const { user } = useAuth();
  const isWarehouse = mode === 'warehouse';
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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const requests = [stockTransferService.list()];
      if (isWarehouse) requests.push(inventoryLocationService.list(), storageLocationService.list());
      else requests.push(stockTransferService.getBranchContext());
      requests.push(productVariantService.list());
      const results = await Promise.all(requests);
      setRows(results[0]);
      if (isWarehouse) {
        setLocations(results[1].filter((location) => location.status === 'active'));
        setStorages(results[2].filter((storage) => storage.status === 'active'));
        setVariants(results[3].filter((variant) => variant.status === 'active'));
      } else {
        const context = results[1];
        setBranchId(context.selectedBranch?.inventoryLocation ? idOf(context.selectedBranch._id) : '');
        const activeVariants = results[2].filter((variant) => variant.status === 'active' && variant.productId?.status === 'active');
        setVariants(activeVariants);
        setProducts([...new Map(activeVariants.map((variant) => [idOf(variant.productId), variant.productId])).values()]);
      }
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [isWarehouse]);

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
    }, 'Đã gửi yêu cầu bổ sung đến kho tổng.');
  };

  const decide = (decision) => {
    if (decision === 'reject') return act(() => stockTransferService.decide(selected._id, { decision, note: approval.note || '' }), 'Đã từ chối yêu cầu.');
    const items = (selected.items || []).map((item) => {
      const quantityApproved = Number(approval[item._id]?.quantityApproved ?? item.quantityRequested);
      const itemIds = item.variantId?.productId?.trackingType === 'individual' ? (approval[item._id]?.itemIds || []) : [];
      const selectedStorage = approval[item._id]?.fromStorageId;
      return { detailId: item._id, quantityApproved, fromStorageId: !selectedStorage || selectedStorage === 'none' ? null : selectedStorage, itemIds };
    });
    const invalidSelection = (selected.items || []).find((item) => item.variantId?.productId?.trackingType === 'individual'
      && (approval[item._id]?.itemIds || []).length !== Number(approval[item._id]?.quantityApproved ?? item.quantityRequested));
    if (invalidSelection) { setError('Với mặt hàng quản lý từng cá thể, hãy chọn đúng số InventoryItem bằng số lượng duyệt.'); return; }
    return act(() => stockTransferService.decide(selected._id, { decision, note: approval.note || '', items }), 'Đã duyệt yêu cầu bổ sung.');
  };

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
  }), complete ? 'Đã xác nhận hoàn tất nhận hàng.' : 'Đã ghi nhận số hàng nhận đợt này.');

  const detailVariantOptions = useMemo(() => variants, [variants]);
  const sourceStorages = (locationId) => storages.filter((storage) => idOf(storage.locationId) === idOf(locationId));
  const branchName = (location) => `${location?.code || ''} · ${location?.name || ''}`;

  return <div className={isWarehouse ? 'wm-layout' : 'shop-dashboard-layout'}>
    {isWarehouse ? <WarehouseSidebar mode="manager" /> : <BranchSidebar />}
    <main className={isWarehouse ? 'wm-main wm-stock-control-page' : 'shop-main-content wm-branch-transfer-page'}>
      <header className="wm-header"><div><span>{isWarehouse ? 'WAREHOUSE / XUẤT KHO' : 'CHI NHÁNH / BỔ SUNG HÀNG'}</span><h1>{isWarehouse ? 'Xuất kho đến chi nhánh' : 'Yêu cầu bổ sung hàng'}</h1></div>
        {!isWarehouse && <button className="wm-primary-button" type="button" onClick={() => { setShowCreate((value) => !value); setSelected(null); }}>+ Tạo yêu cầu</button>}
      </header>
      <div className="wm-stock-tabs"><Link className="active" to={isWarehouse ? '/warehousemanager/outbound' : '/branch/stock-requests'}><ArrowLeftRight size={16} />{isWarehouse ? 'Xuất kho đến chi nhánh' : 'Yêu cầu bổ sung hàng'}</Link></div>
      {error && <div className="wm-error">{error}</div>}{notice && <div className="wm-success">{notice}</div>}

      {showCreate && !isWarehouse && <form className="wm-panel wm-form wm-stock-create" onSubmit={createRequest}>
        <div className="wm-transfer-request-lines"><strong>Mặt hàng cần bổ sung</strong>{requestLines.map((line, index) => <div className="wm-new-item-row" key={index}>
          <select required value={line.productId} onChange={(event) => setRequestLines(requestLines.map((row, i) => i === index ? { ...row, productId: event.target.value, variantId: '' } : row))}><option value="">Chọn sản phẩm</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}</select>
          <select required disabled={!line.productId} value={line.variantId} onChange={(event) => setRequestLines(requestLines.map((row, i) => i === index ? { ...row, variantId: event.target.value } : row))}><option value="">Chọn biến thể</option>{detailVariantOptions.filter((variant) => idOf(variant.productId) === line.productId).map((variant) => <option key={variant._id} value={variant._id}>{variant.sku} · {variant.size} · {variant.color}</option>)}</select>
          <input required type="number" min="1" step="1" value={line.quantityRequested} onChange={(event) => setRequestLines(requestLines.map((row, i) => i === index ? { ...row, quantityRequested: event.target.value } : row))} aria-label="Số lượng yêu cầu" />
          <button type="button" className="danger" disabled={requestLines.length === 1} onClick={() => setRequestLines(requestLines.filter((_, i) => i !== index))}>Xóa</button>
        </div>)}<button className="secondary" type="button" onClick={() => setRequestLines([...requestLines, { productId: '', variantId: '', quantityRequested: 1 }])}>+ Thêm mặt hàng</button></div>
        <footer><button className="secondary" type="button" onClick={() => setShowCreate(false)}>Hủy</button><button disabled={busy || !branchId}>Gửi yêu cầu</button></footer>
      </form>}

      <section className="wm-panel wm-list-panel"><div className="wm-table-wrap"><table><thead><tr><th>Mã phiếu</th><th>{isWarehouse ? 'Chi nhánh yêu cầu' : 'Kho tổng'}</th><th>Mặt hàng</th><th>Trạng thái</th><th>Ngày tạo</th><th /></tr></thead><tbody>
        {loading ? <tr><td colSpan="6">Đang tải...</td></tr> : rows.length ? rows.map((row) => <tr key={row._id}>
          <td><strong>{row.transferCode}</strong></td><td>{isWarehouse ? branchName(row.toLocationId) : branchName(row.fromLocationId)}</td><td>{row.items?.length || 0}</td><td>{statusLabels[row.status] || row.status}</td><td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td><td><button type="button" className="secondary" onClick={() => { setShowCreate(false); refreshSelected(row._id).catch((e) => setError(e.message)); }}>Chi tiết</button></td>
        </tr>) : <tr><td colSpan="6">Chưa có yêu cầu điều chuyển.</td></tr>}
      </tbody></table></div></section>

      {selected && <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setItemPickerId(''); setSelected(null); } }}>
        <section className="wm-crud-modal wm-transfer-modal wm-stock-detail">
        <div className="wm-stock-detail-heading"><div><small>{selected.transferCode} · {statusLabels[selected.status]}</small><h2>{branchName(selected.toLocationId)}</h2><p>Kho xuất: {branchName(selected.fromLocationId)} · Người tạo: {selected.createdBy?.FullName || '—'}</p></div><button type="button" className="secondary" onClick={() => { setItemPickerId(''); setSelected(null); }}>Đóng</button></div>
        <div className="wm-table-wrap"><table><thead><tr><th>Sản phẩm / SKU</th><th>Yêu cầu</th><th>Được duyệt</th><th>Đã xuất</th><th>{!isWarehouse && ['shipped', 'partially_received'].includes(selected.status) ? 'Xác nhận nhận' : 'Đã nhận'}</th><th>Hỏng{selected.status === 'received' ? ' / thiếu' : ''}</th>{isWarehouse && selected.status === 'requested' && <><th>Vị trí xuất</th><th>InventoryItem cần chuyển</th></>}</tr></thead><tbody>
          {(selected.items || []).map((item) => {
            const individual = item.variantId?.productId?.trackingType === 'individual';
            const sourceOptions = sourceStorages(selected.fromLocationId?._id || selected.fromLocationId).filter((storage) => !individual || storage.type === 'shelf');
            const entry = receipt[item._id] || { receivedItemIds: (item.receivedItemIds || []).map(idOf), damagedItemIds: (item.damagedItemIds || []).map(idOf) };
            const receiving = !isWarehouse && ['shipped', 'partially_received'].includes(selected.status);
            return <tr key={item._id}><td>{variantLabel(item)}{item.itemIds?.length > 0 && <small className="wm-stock-subline">Mã hàng: {item.itemIds.map((it) => it.itemCode || it.serialNumber || idOf(it).slice(-6)).join(', ')}</small>}</td><td>{item.quantityRequested}</td>
              <td>{isWarehouse && selected.status === 'requested' ? <input className="wm-count-input" type="number" min="0" max={item.quantityRequested} value={approval[item._id]?.quantityApproved ?? item.quantityRequested} onChange={(event) => setApproval({ ...approval, [item._id]: { ...approval[item._id], quantityApproved: event.target.value } })} /> : item.quantityApproved ?? '—'}</td>
              <td>{item.quantityShipped || 0}</td><td>{receiving ? (individual ? <button type="button" className="secondary" onClick={() => setReceiptPickerId(item._id)}>Xem / xác nhận nhận ({(entry.receivedItemIds || []).length}/{item.quantityShipped || 0})</button> : <div className="wm-transfer-quantity-inputs"><input type="number" min={item.quantityReceived || 0} max={item.quantityShipped} value={entry.quantityReceived ?? item.quantityShipped} aria-label="Số lượng nhận" onChange={(event) => setReceipt({ ...receipt, [item._id]: { ...entry, quantityReceived: event.target.value } })} /><input type="number" min={item.quantityDamaged || 0} max={entry.quantityReceived ?? item.quantityShipped} value={entry.quantityDamaged ?? item.quantityDamaged ?? 0} aria-label="Số lượng hỏng" onChange={(event) => setReceipt({ ...receipt, [item._id]: { ...entry, quantityDamaged: event.target.value } })} /></div>) : item.quantityReceived || 0}</td><td>{item.quantityDamaged || 0}{item.quantityMissing > 0 ? ` / thiếu ${item.quantityMissing}` : ''}</td>
              {isWarehouse && selected.status === 'requested' && <><td><select required={Number(approval[item._id]?.quantityApproved ?? item.quantityRequested) > 0} value={approval[item._id]?.fromStorageId || ''} onChange={(event) => { const fromStorageId = event.target.value; setApproval({ ...approval, [item._id]: { ...approval[item._id], fromStorageId, itemIds: [] } }); loadAvailableItems(item, fromStorageId === 'none' ? null : fromStorageId); }}><option value="">Chọn vị trí xuất</option><option value="none">Tồn chưa gán vị trí</option>{sourceOptions.map((storage) => <option key={storage._id} value={storage._id}>{storage.code} · {storage.name} ({storage.type})</option>)}</select></td><td>{individual ? <button type="button" className="secondary" disabled={!approval[item._id]?.fromStorageId} onClick={() => setItemPickerId(item._id)}>Xem / chọn ({(approval[item._id]?.itemIds || []).length}/{Number(approval[item._id]?.quantityApproved ?? item.quantityRequested)})</button> : 'Mặt hàng quản lý theo số lượng'}</td></>}
            </tr>;
          })}
        </tbody></table></div>
        <div className="wm-stock-actions">
          {isWarehouse && selected.status === 'requested' && <><button className="danger" disabled={busy} onClick={() => decide('reject')}>Từ chối</button><button disabled={busy} onClick={() => decide('approve')}>Duyệt yêu cầu</button></>}
          {isWarehouse && selected.status === 'approved' && <button disabled={busy} onClick={() => act(() => stockTransferService.ship(selected._id), 'Đã xác nhận xuất hàng khỏi kho tổng.')}>Xác nhận xuất kho</button>}
          {!isWarehouse && ['shipped', 'partially_received'].includes(selected.status) && <><button className="secondary" disabled={busy} onClick={() => confirmReceipt(false)}><PackageCheck size={16} /> Ghi nhận nhận một phần</button><button disabled={busy} onClick={() => confirmReceipt(true)}><PackageCheck size={16} /> Hoàn tất nhận hàng</button></>}
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
            <header><div><span>CHỌN HÀNG CÁ THỂ</span><h2 id="transfer-item-picker-title">{variantLabel(item)}</h2><p>Đã chọn {chosen.length}/{target}</p></div><button type="button" className="wm-modal-close" onClick={() => setItemPickerId('')} aria-label="Đóng">×</button></header>
            <div className="wm-transfer-picker-list">{candidates.length ? candidates.map((inventoryItem) => { const inventoryItemId = idOf(inventoryItem); return <label key={inventoryItemId}><input type="checkbox" checked={chosen.includes(inventoryItemId)} disabled={!chosen.includes(inventoryItemId) && chosen.length >= target} onChange={(event) => setApproval((old) => ({ ...old, [item._id]: { ...old[item._id], itemIds: event.target.checked ? [...chosen, inventoryItemId] : chosen.filter((id) => id !== inventoryItemId) } }))} /><span><strong>{inventoryItem.itemCode}</strong><small>{inventoryItem.serialNumber || 'Chưa có serial'} · {inventoryItem.condition} · {inventoryItem.status}</small></span></label>; }) : <p>Không có InventoryItem khả dụng ở vị trí đã chọn.</p>}</div>
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
            <div className="wm-transfer-picker-list">{(item.itemIds || []).length ? item.itemIds.map((inventoryItem) => {
              const inventoryItemId = idOf(inventoryItem);
              const isReceived = received.includes(inventoryItemId);
              return <label key={inventoryItemId} className="wm-receipt-item-row"><input type="checkbox" checked={isReceived} onChange={(event) => setReceipt((old) => ({ ...old, [item._id]: { ...entry, receivedItemIds: event.target.checked ? [...received, inventoryItemId] : received.filter((id) => id !== inventoryItemId), damagedItemIds: event.target.checked ? damaged : damaged.filter((id) => id !== inventoryItemId) } }))} /><span><strong>{inventoryItem.itemCode || inventoryItem.serialNumber || inventoryItemId.slice(-6)}</strong><small>{inventoryItem.serialNumber || 'Chưa có serial'} · {inventoryItem.condition || '—'}</small></span><span className="wm-receipt-damaged"><input type="checkbox" aria-label="Đánh dấu hàng hỏng" disabled={!isReceived} checked={damaged.includes(inventoryItemId)} onChange={(event) => setReceipt((old) => ({ ...old, [item._id]: { ...entry, damagedItemIds: event.target.checked ? [...damaged, inventoryItemId] : damaged.filter((id) => id !== inventoryItemId) } }))} /> Hỏng</span></label>;
            }) : <p>Phiếu chưa có InventoryItem được xuất.</p>}</div>
            <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={() => setReceiptPickerId('')}>Xong ({received.length}/{item.quantityShipped || 0})</button></footer>
          </section>
        </div>;
      })()}
    </main>
  </div>;
}
