import React, { useCallback, useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import BranchSidebar from '../../components/BranchSidebar';
import WarehouseSidebar from '../../components/WarehouseSidebar';
import branchReturnService from '../../services/warehouse/branchReturnService';
import stockTransferService from '../../services/warehouse/stockTransferService';
import productVariantService from '../../services/masterdata/productVariantService';
import storageLocationService from '../../services/warehouse/storageLocationService';
import '../../styles/WarehouseManager.css';

const labels = {
  requested: 'Chờ kho tổng duyệt', approved: 'Đã duyệt, chờ chi nhánh gửi', rejected: 'Bị từ chối',
  shipped: 'Đang chuyển về kho tổng', receipt_submitted: 'Chờ duyệt kết quả nhận',
  receipt_approved: 'Đã duyệt nhận, chờ xếp kệ', completed: 'Hoàn tất',
};
const idOf = (value) => String(value?._id || value || '');
const itemLabel = (line) => [line.variantId?.productId?.name, line.variantId?.sku, line.variantId?.size, line.variantId?.color].filter(Boolean).join(' · ');

export default function BranchReturnsPage({ mode = 'branch' }) {
  const isBranch = mode === 'branch';
  const isManager = mode === 'warehouse';
  const [rows, setRows] = useState([]); const [selected, setSelected] = useState(null);
  const [variants, setVariants] = useState([]); const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]); const [branchId, setBranchId] = useState('');
  const [staff, setStaff] = useState([]); const [assignedStaffId, setAssignedStaffId] = useState('');
  const [storages, setStorages] = useState([]);
  const [lines, setLines] = useState([{ productId: '', variantId: '', quantityRequested: 1 }]);
  const [approval, setApproval] = useState({}); const [receipt, setReceipt] = useState({}); const [allocations, setAllocations] = useState({});
  const [showCreate, setShowCreate] = useState(false); const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const requests = [branchReturnService.list()];
      if (isBranch) requests.push(stockTransferService.getBranchContext());
      if (isBranch || isManager) requests.push(productVariantService.list());
      if (isManager) requests.push(branchReturnService.listStaff());
      if (!isBranch) requests.push(storageLocationService.list());
      const result = await Promise.all(requests); setRows(result[0]);
      let index = 1;
      if (isBranch) { const context = result[index++]; setBranches(context.branches || []); setBranchId(context.selectedBranch?.inventoryLocation ? idOf(context.selectedBranch._id) : ''); }
      if (isBranch || isManager) {
        const active = result[index++].filter((variant) => variant.status === 'active' && variant.productId?.status === 'active' && variant.productId?.isDeleted !== true);
        setVariants(active); setProducts([...new Map(active.map((variant) => [idOf(variant.productId), variant.productId])).values()]);
      }
      if (isManager) setStaff(result[index++]);
      if (!isBranch) setStorages(result[index].filter((storage) => storage.status === 'active' && storage.type === 'shelf'));
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [isBranch, isManager]);
  useEffect(() => { load(); }, [load]);

  const refresh = async (id) => {
    const transfer = await branchReturnService.get(id); setSelected(transfer); setAssignedStaffId(idOf(transfer.assignedStaffId));
    setApproval(Object.fromEntries((transfer.items || []).map((line) => [line._id, String(line.quantityApproved ?? line.quantityRequested)])));
    setReceipt(Object.fromEntries((transfer.items || []).map((line) => [line._id, {
      quantityReceived: String(line.quantityReceived || 0), quantityDamaged: String(line.quantityDamaged || 0),
      receivedItemIds: (line.receivedItemIds || []).map(idOf), damagedItemIds: (line.damagedItemIds || []).map(idOf),
    }])));
    setAllocations(Object.fromEntries((transfer.items || []).map((line) => {
      const accepted = Math.max(0, (line.quantityReceived || 0) - (line.quantityDamaged || 0));
      const saved = (line.putawayAllocations || []).map((row) => ({ storageId: idOf(row.storageId), quantity: String(row.quantity), itemIds: (row.itemIds || []).map(idOf) }));
      return [line._id, saved.length ? saved : accepted ? [{ storageId: '', quantity: String(accepted), itemIds: [] }] : []];
    })));
  };

  const act = async (callback, message) => {
    setBusy(true); setError(''); setNotice('');
    try { const updated = await callback(); await load(); await refresh(updated?._id || selected?._id); setNotice(message); }
    catch (actionError) { setError(actionError.message); }
    finally { setBusy(false); }
  };

  const create = (event) => {
    event.preventDefault();
    const items = lines.filter((line) => line.variantId && Number(line.quantityRequested) > 0).map(({ variantId, quantityRequested }) => ({ variantId, quantityRequested: Number(quantityRequested) }));
    return act(() => branchReturnService.create({ branchId, items }), 'Đã gửi yêu cầu trả hàng về kho tổng.').then(() => { setShowCreate(false); setLines([{ productId: '', variantId: '', quantityRequested: 1 }]); });
  };
  const decideRequest = async (decision) => {
    const items = (selected.items || []).map((line) => ({ detailId: line._id, quantityApproved: Number(approval[line._id] ?? line.quantityRequested) }));
    if (decision === 'approve' && !assignedStaffId) { setError('Chọn nhân viên kho phụ trách nhận hàng.'); return; }
    await act(() => branchReturnService.decide(selected._id, { decision, assignedStaffId, items }), decision === 'approve' ? 'Đã duyệt và khóa số lượng hàng trả tại chi nhánh.' : 'Đã từ chối yêu cầu trả hàng.');
  };
  const submitReceipt = () => act(() => branchReturnService.receive(selected._id, { items: selected.items.map((line) => {
    const data = receipt[line._id] || {}; const individual = line.variantId?.productId?.trackingType === 'individual';
    const receivedItemIds = individual ? (data.receivedItemIds || []) : [];
    const damagedItemIds = individual ? (data.damagedItemIds || []) : [];
    return { detailId: line._id, quantityReceived: individual ? receivedItemIds.length : Number(data.quantityReceived || 0), quantityDamaged: individual ? damagedItemIds.length : Number(data.quantityDamaged || 0), receivedItemIds, damagedItemIds };
  }) }), 'Đã gửi kết quả nhận hàng để quản lý kho duyệt.');
  const submitPutaway = () => act(() => branchReturnService.putaway(selected._id, { items: selected.items.map((line) => {
    const individual = line.variantId?.productId?.trackingType === 'individual'; const acceptedIds = (line.receivedItemIds || []).map(idOf).filter((itemId) => !(line.damagedItemIds || []).map(idOf).includes(itemId));
    let cursor = 0;
    const rowsForLine = (allocations[line._id] || []).filter((row) => row.storageId && Number(row.quantity) > 0).map((row) => {
      const count = Number(row.quantity); const itemIds = individual ? acceptedIds.slice(cursor, cursor + count) : [];
      cursor += count; return { storageId: row.storageId, quantity: count, itemIds };
    });
    return { detailId: line._id, allocations: rowsForLine };
  }) }), 'Đã xếp hàng trả vào kho tổng.');

  const title = isBranch ? 'Trả hàng về kho tổng' : isManager ? 'Duyệt hàng trả từ chi nhánh' : 'Nhận hàng trả từ chi nhánh';
  return <div className={isBranch ? 'shop-dashboard-layout' : 'wm-layout'}>
    {isBranch ? <BranchSidebar /> : <WarehouseSidebar mode={isManager ? 'manager' : 'staff'} />}
    <main className={isBranch ? 'shop-main-content wm-stock-control-page' : 'wm-main wm-stock-control-page'}>
      <header className="wm-header"><div><span>{isBranch ? 'CHI NHÁNH / ĐIỀU CHUYỂN' : 'WAREHOUSE / HÀNG TRẢ VỀ'}</span><h1>{title}</h1></div>{isBranch && <button className="wm-primary-button" type="button" onClick={() => { setShowCreate(!showCreate); setSelected(null); }}>+ Tạo phiếu trả</button>}</header>
      {error && <div className="wm-error">{error}</div>}{notice && <div className="wm-success">{notice}</div>}
      {showCreate && isBranch && <form className="wm-panel wm-form wm-stock-create" onSubmit={create}>
        <label>Chi nhánh<select required value={branchId} onChange={(event) => setBranchId(event.target.value)}><option value="">Chọn chi nhánh</option>{branches.filter((row) => row.inventoryLocation).map((row) => <option key={row._id} value={row._id}>{row.name}</option>)}</select></label>
        <strong>Mặt hàng cần trả</strong>{lines.map((line, index) => <div className="wm-new-item-row" key={index}>
          <select required value={line.productId} onChange={(event) => setLines((old) => old.map((row, i) => i === index ? { ...row, productId: event.target.value, variantId: '' } : row))}><option value="">Chọn sản phẩm</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}</select>
          <select required value={line.variantId} disabled={!line.productId} onChange={(event) => setLines((old) => old.map((row, i) => i === index ? { ...row, variantId: event.target.value } : row))}><option value="">Chọn biến thể</option>{variants.filter((row) => idOf(row.productId) === line.productId).map((row) => <option key={row._id} value={row._id}>{row.sku} · {row.size} · {row.color}</option>)}</select>
          <input aria-label="Số lượng trả" type="number" min="1" step="1" value={line.quantityRequested} onChange={(event) => setLines((old) => old.map((row, i) => i === index ? { ...row, quantityRequested: event.target.value } : row))} />
          <button className="danger" type="button" disabled={lines.length === 1} onClick={() => setLines((old) => old.filter((_, i) => i !== index))}>Xóa</button>
        </div>)}<button type="button" className="secondary" onClick={() => setLines((old) => [...old, { productId: '', variantId: '', quantityRequested: 1 }])}>+ Thêm mặt hàng</button>
        <footer><button type="button" className="secondary" onClick={() => setShowCreate(false)}>Hủy</button><button disabled={busy || !branchId}>Gửi yêu cầu</button></footer>
      </form>}
      <section className="wm-panel wm-list-panel"><div className="wm-table-wrap"><table><thead><tr><th>Mã phiếu</th><th>Chi nhánh</th><th>Mặt hàng</th><th>Trạng thái</th><th>Ngày tạo</th><th /></tr></thead><tbody>
        {loading ? <tr><td colSpan="6">Đang tải...</td></tr> : rows.length ? rows.map((row) => <tr key={row._id}><td><strong>{row.transferCode}</strong></td><td>{row.fromLocationId?.code} · {row.fromLocationId?.name}</td><td>{row.items?.length || 0}</td><td>{labels[row.status] || row.status}</td><td>{new Date(row.createdAt).toLocaleString('vi-VN')}</td><td><button className="secondary" type="button" onClick={() => refresh(row._id).catch((e) => setError(e.message))}>Chi tiết</button></td></tr>) : <tr><td colSpan="6">Chưa có phiếu trả hàng.</td></tr>}
      </tbody></table></div></section>
      {selected && <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="wm-crud-modal wm-transfer-modal wm-stock-detail">
        <div className="wm-stock-detail-heading"><div><small>{selected.transferCode} · {labels[selected.status] || selected.status}</small><h2>{selected.fromLocationId?.name} → {selected.toLocationId?.name}</h2><p>Người tạo: {selected.createdBy?.FullName || '—'} · Nhân viên nhận: {selected.assignedStaffId?.FullName || 'Chưa giao'}</p></div><button className="secondary" type="button" onClick={() => setSelected(null)}>Đóng</button></div>
        {isManager && selected.status === 'requested' && <label className="wm-staff-assign">Nhân viên nhận hàng<select value={assignedStaffId} onChange={(event) => setAssignedStaffId(event.target.value)}><option value="">Chọn nhân viên kho</option>{staff.map((member) => <option key={member._id} value={member._id}>{member.FullName} · {member.Email}</option>)}</select></label>}
        <div className="wm-table-wrap"><table><thead><tr><th>Sản phẩm / biến thể</th><th>Yêu cầu</th><th>Duyệt</th><th>Đã gửi</th><th>Thực nhận / hỏng / thiếu</th>{mode === 'staff' && selected.status === 'receipt_approved' && <th>Kệ nhập</th>}</tr></thead><tbody>{selected.items.map((line) => {
          const individual = line.variantId?.productId?.trackingType === 'individual'; const received = receipt[line._id] || { receivedItemIds: [], damagedItemIds: [] };
          return <tr key={line._id}><td>{itemLabel(line)}{line.itemIds?.length > 0 && <small className="wm-stock-subline">{line.itemIds.map((item) => item.itemCode || idOf(item).slice(-6)).join(', ')}</small>}</td><td>{line.quantityRequested}</td>
            <td>{isManager && selected.status === 'requested' ? <input className="wm-count-input" type="number" min="0" max={line.quantityRequested} value={approval[line._id] ?? line.quantityRequested} onChange={(e) => setApproval((old) => ({ ...old, [line._id]: e.target.value }))} /> : line.quantityApproved ?? '—'}</td><td>{line.quantityShipped || 0}</td>
            <td>{mode === 'staff' && selected.status === 'shipped' ? individual ? <div className="wm-transfer-picker-list">{line.itemIds.map((item) => { const itemId = idOf(item); const checked = received.receivedItemIds.includes(itemId); return <label key={itemId}><input type="checkbox" checked={checked} onChange={(e) => setReceipt((old) => ({ ...old, [line._id]: { ...received, receivedItemIds: e.target.checked ? [...received.receivedItemIds, itemId] : received.receivedItemIds.filter((id) => id !== itemId), damagedItemIds: e.target.checked ? received.damagedItemIds : received.damagedItemIds.filter((id) => id !== itemId) } }))} /><span><strong>{item.itemCode}</strong><small>{item.serialNumber || 'Không có serial'} · {item.condition}</small></span>{checked && <span><input aria-label="Đánh dấu hỏng" type="checkbox" checked={received.damagedItemIds.includes(itemId)} onChange={(e) => setReceipt((old) => ({ ...old, [line._id]: { ...received, damagedItemIds: e.target.checked ? [...received.damagedItemIds, itemId] : received.damagedItemIds.filter((id) => id !== itemId) } }))} /> Hỏng</span>}</label>; })}</div> : <div className="wm-transfer-quantity-inputs"><input type="number" min="0" max={line.quantityShipped} aria-label="Số lượng nhận" value={received.quantityReceived ?? line.quantityShipped} onChange={(e) => setReceipt((old) => ({ ...old, [line._id]: { ...received, quantityReceived: e.target.value } }))} /><input type="number" min="0" max={received.quantityReceived ?? line.quantityShipped} aria-label="Số lượng hỏng" value={received.quantityDamaged ?? 0} onChange={(e) => setReceipt((old) => ({ ...old, [line._id]: { ...received, quantityDamaged: e.target.value } }))} /></div> : `${line.quantityReceived || 0} / ${line.quantityDamaged || 0} / ${line.quantityMissing || 0}`}</td>
            {mode === 'staff' && selected.status === 'receipt_approved' && <td><div className="wm-pick-allocation-list">{(allocations[line._id] || []).map((allocation, index) => <div className="wm-pick-allocation" key={index}><select value={allocation.storageId} onChange={(e) => setAllocations((old) => ({ ...old, [line._id]: old[line._id].map((row, i) => i === index ? { ...row, storageId: e.target.value } : row) }))}><option value="">Chọn kệ</option>{storages.filter((storage) => idOf(storage.locationId) === idOf(selected.toLocationId)).map((storage) => <option key={storage._id} value={storage._id}>{storage.code} · {storage.name}</option>)}</select><input aria-label="Số lượng tại kệ" type="number" min="1" value={allocation.quantity} onChange={(e) => setAllocations((old) => ({ ...old, [line._id]: old[line._id].map((row, i) => i === index ? { ...row, quantity: e.target.value } : row) }))} />{(allocations[line._id] || []).length > 1 && <button className="danger" type="button" onClick={() => setAllocations((old) => ({ ...old, [line._id]: old[line._id].filter((_, i) => i !== index) }))}>Xóa</button>}</div>)}<button className="secondary" type="button" onClick={() => setAllocations((old) => ({ ...old, [line._id]: [...(old[line._id] || []), { storageId: '', quantity: '1', itemIds: [] }] }))}>+ Thêm kệ</button><small>Phân bổ: {(allocations[line._id] || []).reduce((sum, row) => sum + Number(row.quantity || 0), 0)} / {Math.max(0, line.quantityReceived - line.quantityDamaged)}</small></div></td>}
          </tr>;
        })}</tbody></table></div>
        <div className="wm-stock-actions">
          {isManager && selected.status === 'requested' && <><button className="danger" disabled={busy} onClick={() => decideRequest('reject')}>Từ chối</button><button disabled={busy} onClick={() => decideRequest('approve')}>Duyệt và khóa hàng</button></>}
          {isBranch && selected.status === 'approved' && <button disabled={busy} onClick={() => act(() => branchReturnService.dispatch(selected._id), 'Đã xác nhận gửi hàng về kho tổng.')}>Xác nhận gửi hàng</button>}
          {isBranch && selected.status === 'approved' && <button className="danger" disabled={busy} onClick={() => act(() => branchReturnService.cancel(selected._id), 'Đã hủy phiếu và mở khóa tồn tại chi nhánh.')}>Hủy phiếu</button>}
          {mode === 'staff' && selected.status === 'shipped' && <button disabled={busy} onClick={submitReceipt}><PackageCheck size={16} /> Gửi kết quả nhận hàng</button>}
          {isManager && selected.status === 'receipt_submitted' && <><button className="danger" disabled={busy} onClick={() => act(() => branchReturnService.decideReceipt(selected._id, { decision: 'reject' }), 'Đã yêu cầu kiểm nhận lại.')}>Yêu cầu kiểm lại</button><button disabled={busy} onClick={() => act(() => branchReturnService.decideReceipt(selected._id, { decision: 'approve' }), 'Đã duyệt kết quả nhận hàng.')}>Duyệt kết quả nhận</button></>}
          {mode === 'staff' && selected.status === 'receipt_approved' && <button disabled={busy} onClick={submitPutaway}>Hoàn tất xếp kệ</button>}
        </div>
      </section></div>}
    </main>
  </div>;
}
