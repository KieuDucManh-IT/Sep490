import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import '../styles/WarehouseManager.css';

const statusLabels = {
  awaiting_receiving: 'Chờ nhân viên tiếp nhận',
  received: 'Chờ chủ kho duyệt',
  approved: 'Chờ sắp xếp vào kệ',
  completed: 'Hoàn tất',
  rejected: 'Đã từ chối',
  cancelled: 'Đã hủy',
};
const productName = (line) => {
  const variant = line.variantId;
  const product = variant?.productId;
  return [product?.name, variant?.variantName, variant?.sku].filter(Boolean).join(' · ') || 'Mặt hàng';
};

export default function InboundReceiptModal({ mode, role, receipt, locations, suppliers, products, variants, staff, shelves, onClose, onCreate, onReceive, onApprove, onPutaway }) {
  const [activeMode, setActiveMode] = useState(mode);
  const [locationId, setLocationId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([{ productId: '', variantId: '', quantityExpected: '', unitCost: '' }]);
  const [received, setReceived] = useState([]);
  const [putawayItems, setPutawayItems] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (receipt && activeMode === 'receive') {
      setReceived(receipt.items.map((item) => ({ detailId: item._id, quantityReceived: '', quantityDamaged: 0, note: item.note || '' })));
    }
    if (receipt && activeMode === 'putaway') {
      setPutawayItems(receipt.items.map((item) => {
        const accepted = Math.max(0, item.quantityReceived - item.quantityDamaged);
        const saved = item.storageAllocations?.length
          ? item.storageAllocations.map((allocation) => ({ storageId: allocation.storageId?._id || allocation.storageId || '', quantity: allocation.quantity }))
          : item.storageId ? [{ storageId: item.storageId?._id || item.storageId, quantity: accepted }] : [];
        return { detailId: item._id, allocations: saved.length ? saved : (accepted > 0 ? [{ storageId: '', quantity: accepted }] : []), accepted };
      }));
    }
  }, [activeMode, receipt]);

  const updateLine = (index, key, value) => setLines((old) => old.map((line, i) => i === index ? { ...line, [key]: value, ...(key === 'productId' ? { variantId: '' } : {}) } : line));
  const updateReceive = (index, key, value) => setReceived((old) => old.map((line, i) => i === index ? { ...line, [key]: value } : line));
  const updatePutaway = (lineIndex, allocationIndex, key, value) => setPutawayItems((old) => old.map((line, i) => i === lineIndex ? {
    ...line,
    allocations: line.allocations.map((allocation, j) => j === allocationIndex ? { ...allocation, [key]: value } : allocation),
  } : line));
  const addPutawayLocation = (index) => setPutawayItems((old) => old.map((line, i) => {
    if (i !== index) return line;
    const allocated = line.allocations.reduce((total, allocation) => total + (Number(allocation.quantity) || 0), 0);
    return { ...line, allocations: [...line.allocations, { storageId: '', quantity: Math.max(1, line.accepted - allocated) }] };
  }));
  const removePutawayLocation = (lineIndex, allocationIndex) => setPutawayItems((old) => old.map((line, i) => i === lineIndex
    ? { ...line, allocations: line.allocations.filter((_, j) => j !== allocationIndex) }
    : line));

  const submitCreate = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    const payload = {
      locationId, supplierId, assignedStaffId, note,
      items: lines.map((line) => ({ variantId: line.variantId, quantityExpected: Number(line.quantityExpected), unitCost: Number(line.unitCost) })),
    };
    try {
      await onCreate(payload);
      onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const submitReceive = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await onReceive({ items: received.map((line) => ({ ...line, quantityReceived: Number(line.quantityReceived), quantityDamaged: Number(line.quantityDamaged) })) });
      onClose();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const submitPutaway = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const invalidLine = putawayItems.find((line) => line.allocations.reduce((total, allocation) => total + (Number(allocation.quantity) || 0), 0) !== line.accepted || line.allocations.some((allocation) => !allocation.storageId || !(Number(allocation.quantity) > 0)));
      if (invalidLine) throw new Error('Tổng số lượng phân bổ và vị trí shelf phải khớp với số lượng hàng đạt chất lượng.');
      await onPutaway({ items: putawayItems.map(({ detailId, allocations }) => ({ detailId, allocations: allocations.map(({ storageId, quantity }) => ({ storageId, quantity: Number(quantity) })) })) });
      onClose();
    }
    catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const title = activeMode === 'create' ? 'Tạo phiếu nhập từ nhà cung cấp'
    : activeMode === 'receive' ? 'Ghi nhận hàng thực nhận'
      : activeMode === 'putaway' ? 'Sắp xếp hàng vào kệ'
        : receipt?.receiptCode || 'Chi tiết phiếu nhập';

  return <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="wm-crud-modal wm-inbound-modal" role="dialog" aria-modal="true" aria-labelledby="inbound-modal-title">
      <header><div><span>QUY TRÌNH NHẬP KHO</span><h2 id="inbound-modal-title">{title}</h2></div><button type="button" className="wm-modal-close" onClick={onClose} aria-label="Đóng"><X size={20} /></button></header>
      {error && <div className="wm-error">{error}</div>}
      {activeMode === 'create' && <form className="wm-form" onSubmit={submitCreate}>
        <label>Kho / cửa hàng<select required value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Chọn kho/cửa hàng</option>{locations.map((location) => <option key={location._id} value={location._id}>{location.code} — {location.name}</option>)}</select></label>
        <label>Nhà cung cấp<select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)}><option value="">Chọn nhà cung cấp</option>{suppliers.map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.supplierCode} — {supplier.name}</option>)}</select></label>
        <label>Nhân viên kho được giao<select required value={assignedStaffId} onChange={(event) => setAssignedStaffId(event.target.value)}><option value="">Chọn nhân viên</option>{staff.map((person) => <option key={person._id} value={person._id}>{person.FullName} — {person.Email}</option>)}</select></label>
        <div className="wm-inbound-lines">
          <div className="wm-inbound-lines-heading"><strong>Mặt hàng dự kiến</strong><button type="button" className="secondary" onClick={() => setLines([...lines, { productId: '', variantId: '', quantityExpected: '', unitCost: '' }])}><Plus size={14} />Thêm dòng</button></div>
          {lines.map((line, index) => <div className="wm-inbound-line" key={index}>
            <label>Sản phẩm<select required value={line.productId} onChange={(event) => updateLine(index, 'productId', event.target.value)}><option value="">Chọn sản phẩm</option>{products.map((product) => <option key={product._id} value={product._id}>{product.productCode} — {product.name}</option>)}</select></label>
            <label>Biến thể<select required disabled={!line.productId} value={line.variantId} onChange={(event) => updateLine(index, 'variantId', event.target.value)}><option value="">Chọn biến thể</option>{variants.filter((variant) => (variant.productId?._id || variant.productId) === line.productId).map((variant) => <option key={variant._id} value={variant._id}>{variant.sku} — {variant.variantName}</option>)}</select></label>
            <label>Số lượng dự kiến<input required type="number" min="1" step="1" value={line.quantityExpected} onChange={(event) => updateLine(index, 'quantityExpected', event.target.value)} /></label>
            <label>Giá nhập / cái<input required type="number" min="0" step="1" value={line.unitCost} onChange={(event) => updateLine(index, 'unitCost', event.target.value)} /></label>
            {lines.length > 1 && <button type="button" className="wm-icon-button danger" aria-label="Xóa dòng hàng" onClick={() => setLines(lines.filter((_, i) => i !== index))}><Trash2 size={16} /></button>}
          </div>)}
        </div>
        <label className="wm-full-row">Ghi chú<textarea maxLength={1000} rows="2" value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <footer><button type="button" className="secondary" onClick={onClose}>Hủy</button><button disabled={saving}>{saving ? 'Đang tạo...' : 'Tạo phiếu nhập'}</button></footer>
      </form>}
      {activeMode === 'view' && receipt && <div className="wm-inbound-detail">
        <div className="wm-detail-grid">
          <div><small>Trạng thái</small><strong>{statusLabels[receipt.status] || receipt.status}</strong></div>
          <div><small>Kho / cửa hàng</small><strong>{receipt.locationId?.code} — {receipt.locationId?.name}</strong></div>
          <div><small>Nhà cung cấp</small><strong>{receipt.supplierId?.supplierCode} — {receipt.supplierId?.name}</strong></div>
          <div><small>Người tạo</small><strong>{receipt.createdBy?.FullName || '—'}</strong></div>
          <div><small>Nhân viên được giao</small><strong>{receipt.assignedStaffId?.FullName || '—'}</strong></div>
          {receipt.note && <div><small>Ghi chú</small><strong>{receipt.note}</strong></div>}
        </div>
        <div className="wm-table-wrap"><table><thead><tr><th>Mặt hàng</th><th>Dự kiến</th><th>Giá nhập / cái</th><th>Thành tiền dự kiến</th><th>Đã nhận</th><th>Hỏng</th><th>Vị trí xếp</th></tr></thead><tbody>{receipt.items.map((item) => {
          const positions = item.storageAllocations?.length ? item.storageAllocations.map((allocation) => `${allocation.storageId?.code || 'Shelf'} (${allocation.quantity})`).join(', ') : item.storageId?.code || 'Chưa xếp';
          return <tr key={item._id}><td>{productName(item)}</td><td>{item.quantityExpected}</td><td>{Number(item.unitCost || 0).toLocaleString('vi-VN')} ₫</td><td>{(item.quantityExpected * (item.unitCost || 0)).toLocaleString('vi-VN')} ₫</td><td>{item.quantityReceived}</td><td>{item.quantityDamaged}</td><td>{positions}</td></tr>;
        })}</tbody></table></div>
        <footer className="wm-modal-footer">
          <button type="button" className="secondary" onClick={onClose}>Đóng</button>
          {role === 'warehouse_staff' && receipt.status === 'awaiting_receiving' && <button type="button" onClick={() => setActiveMode('receive')}>Ghi nhận thực nhận</button>}
          {role === 'warehouse_manager' && receipt.status === 'received' && <><button type="button" className="danger" onClick={() => onApprove('reject')}>Từ chối phiếu</button><button type="button" onClick={() => onApprove('approve')}>Duyệt phiếu</button></>}
          {role === 'warehouse_staff' && receipt.status === 'approved' && <button type="button" onClick={() => setActiveMode('putaway')}>Sắp xếp vào kệ</button>}
        </footer>
      </div>}
      {activeMode === 'receive' && receipt && <form className="wm-receive-list" onSubmit={submitReceive}>
        <p>Nhập số lượng thực nhận và số lượng hỏng cho từng mặt hàng.</p>
        {receipt.items.map((item, index) => <div className="wm-receive-row" key={item._id}>
          <strong>{productName(item)} <small>Dự kiến: {item.quantityExpected}</small></strong>
          <label>Thực nhận<input required type="number" min="0" step="1" value={received[index]?.quantityReceived ?? ''} onChange={(event) => updateReceive(index, 'quantityReceived', event.target.value)} /></label>
          <label>Hỏng<input required type="number" min="0" step="1" value={received[index]?.quantityDamaged ?? 0} onChange={(event) => updateReceive(index, 'quantityDamaged', event.target.value)} /></label>
          <label>Ghi chú<input value={received[index]?.note || ''} onChange={(event) => updateReceive(index, 'note', event.target.value)} /></label>
        </div>)}
        <footer><button type="button" className="secondary" onClick={() => setActiveMode('view')}>Quay lại</button><button disabled={saving}>{saving ? 'Đang gửi...' : 'Xác nhận đã nhận hàng'}</button></footer>
      </form>}
      {activeMode === 'putaway' && receipt && <form className="wm-receive-list" onSubmit={submitPutaway}>
        <p>Chọn shelf cho từng dòng hàng đạt chất lượng. Phân bổ được kiểm tra với sức chứa còn lại của cả shelf, row, zone và kho.</p>
        {receipt.items.map((item, index) => {
          const accepted = Math.max(0, item.quantityReceived - item.quantityDamaged);
          return <div className="wm-putaway-row" key={item._id}>
            <strong>{productName(item)}<small>{accepted} cái cần xếp</small></strong>
            {accepted > 0 ? <div className="wm-allocation-list">
              {putawayItems[index]?.allocations.map((allocation, allocationIndex) => <div className="wm-allocation-row" key={`${item._id}-${allocationIndex}`}>
                <label>Shelf<select required value={allocation.storageId} onChange={(event) => updatePutaway(index, allocationIndex, 'storageId', event.target.value)}><option value="">Chọn shelf</option>{shelves.filter((shelf) => (shelf.locationId?._id === receipt.locationId?._id || shelf.locationId === receipt.locationId?._id) && !putawayItems[index].allocations.some((other, otherIndex) => otherIndex !== allocationIndex && other.storageId === shelf._id)).map((shelf) => <option key={shelf._id} value={shelf._id}>{shelf.code} — {shelf.name} (tối đa {shelf.maxCapacity ?? 0} cái)</option>)}</select></label>
                <label>Số lượng<input required type="number" min="1" step="1" value={allocation.quantity} onChange={(event) => updatePutaway(index, allocationIndex, 'quantity', event.target.value)} /></label>
                {putawayItems[index].allocations.length > 1 && <button type="button" className="wm-icon-button danger" aria-label="Xóa vị trí" onClick={() => removePutawayLocation(index, allocationIndex)}><Trash2 size={15} /></button>}
              </div>)}
              <button type="button" className="wm-add-allocation" disabled={putawayItems[index]?.allocations.reduce((total, allocation) => total + (Number(allocation.quantity) || 0), 0) >= accepted} onClick={() => addPutawayLocation(index)}><Plus size={14} />Thêm vị trí</button>
              <small>Đã phân bổ {putawayItems[index]?.allocations.reduce((total, allocation) => total + (Number(allocation.quantity) || 0), 0) || 0} / {accepted} cái</small>
            </div> : <span>Không có hàng tốt cần xếp.</span>}
          </div>;
        })}
        <footer><button type="button" className="secondary" onClick={() => setActiveMode('view')}>Quay lại</button><button disabled={saving}>{saving ? 'Đang cập nhật kho...' : 'Hoàn tất sắp xếp'}</button></footer>
      </form>}
    </section>
  </div>;
}
