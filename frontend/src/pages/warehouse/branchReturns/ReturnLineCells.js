import React, { useState } from 'react';
import { Button } from 'react-bootstrap';
import { StockDiscrepancyBadge } from '../../../components/StockDiscrepancyDetail';
import { ItemCodeGroup, ItemReceiptModal, receiptCounts } from '../../../components/warehouse';
import { formatVariantName } from '../../../constants/warehouseLabels';
import { codeAndName } from '../shared/slipHelpers';
import { acceptedQuantity, splitAcceptedItems, sumQuantity } from './branchReturnHelpers';

/** Nhân viên kho nhận hàng theo món: mặc định mọi món nhận tốt, chỉ mở modal để đánh dấu món hỏng / thiếu. */
function ItemReceiptSummary({ line, received, onChange }) {
  const [open, setOpen] = useState(false);
  const counts = receiptCounts(received, (line.itemIds || []).length);
  return (
    <div>
      <small className="wm-stock-subline mt-0">Tốt {counts.good} · Hỏng {counts.damaged} · Thiếu {counts.missing}</small>
      <button type="button" className="wm-text-button p-0" onClick={() => setOpen(true)}>Đánh dấu món hỏng / thiếu</button>
      {open && (
        <ItemReceiptModal
          title={formatVariantName(line.variantId)}
          items={line.itemIds || []}
          entry={received}
          onChange={onChange}
          onHide={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/** Ô "Thực nhận / hỏng / thiếu": nhân viên nhập khi phiếu đang chuyển, các trường hợp khác chỉ hiển thị. */
export function ReceiptCell({ line, editable, received, onChange }) {
  if (editable) return <ItemReceiptSummary line={line} received={received} onChange={onChange} />;
  return (
    <>
      {`${line.quantityReceived || 0} / ${line.quantityDamaged || 0} / ${line.quantityMissing || 0}`}
      {line.discrepancyId && (
        <div><StockDiscrepancyBadge discrepancy={line.discrepancyId} quantityMissing={line.quantityMissing} /></div>
      )}
    </>
  );
}

/** Ô "Kệ nhập": nhân viên chia món tốt của dòng ra một hoặc nhiều kệ; món được chia lần lượt theo số lượng. */
export function PutawayCell({ line, allocations, shelves, onChange }) {
  const rows = allocations || [];
  const updateRow = (index, patch) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeRow = (index) => onChange(rows.filter((_, i) => i !== index));
  const addRow = () => onChange([...rows, { storageId: '', quantity: '1', itemIds: [] }]);
  const split = splitAcceptedItems(line, rows);
  const shelfLabel = (storageId) => {
    const shelf = shelves.find((storage) => storage._id === storageId);
    return shelf ? `Kệ ${shelf.code}` : 'Chưa chọn kệ';
  };
  return (
    <div className="wm-pick-allocation-list">
      {rows.map((allocation, index) => (
        <div className="wm-pick-allocation" key={index}>
          <select value={allocation.storageId} onChange={(event) => updateRow(index, { storageId: event.target.value })}>
            <option value="">Chọn kệ</option>
            {shelves.map((storage) => <option key={storage._id} value={storage._id}>{codeAndName(storage)}</option>)}
          </select>
          <input aria-label="Số món tại kệ" type="number" min="1" value={allocation.quantity}
            onChange={(event) => updateRow(index, { quantity: event.target.value })} />
          {rows.length > 1 && (
            <Button size="sm" variant="outline-danger" onClick={() => removeRow(index)}>Xóa</Button>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <ItemCodeGroup label={shelfLabel(allocation.storageId)} items={split[index]?.items || []} />
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline-secondary" onClick={addRow}>+ Thêm kệ</Button>
      <small>Phân bổ: {sumQuantity(rows)} / {acceptedQuantity(line)} món</small>
    </div>
  );
}
