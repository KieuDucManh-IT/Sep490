import React from 'react';
import { Button } from 'react-bootstrap';
import { StockDiscrepancyBadge } from '../../../components/StockDiscrepancyDetail';
import { CONDITION_LABELS, labelOf } from '../../../constants/warehouseLabels';
import { codeAndName, idOf } from '../shared/slipHelpers';
import { acceptedQuantity, isIndividualLine, sumQuantity, toggleId } from './branchReturnHelpers';

/** Nhân viên kho tick từng món đã nhận; món đã nhận có thể đánh dấu thêm là hỏng. */
function ItemReceiptChecklist({ line, received, onChange }) {
  return (
    <div className="wm-transfer-picker-list">
      {line.itemIds.map((item) => {
        const itemId = idOf(item);
        const checked = received.receivedItemIds.includes(itemId);
        const toggleReceived = (event) => onChange({
          ...received,
          receivedItemIds: toggleId(received.receivedItemIds, itemId, event.target.checked),
          // Bỏ tick "đã nhận" thì cũng bỏ đánh dấu hỏng của món đó.
          damagedItemIds: event.target.checked
            ? received.damagedItemIds
            : received.damagedItemIds.filter((id) => id !== itemId),
        });
        const toggleDamaged = (event) => onChange({
          ...received,
          damagedItemIds: toggleId(received.damagedItemIds, itemId, event.target.checked),
        });
        return (
          <label key={itemId}>
            <input type="checkbox" checked={checked} onChange={toggleReceived} />
            <span>
              <strong>{item.itemCode}</strong>
              <small>{item.serialNumber || 'Không có serial'} · {labelOf(CONDITION_LABELS, item.condition, item.condition)}</small>
            </span>
            {checked && (
              <span>
                <input aria-label="Đánh dấu hỏng" type="checkbox" checked={received.damagedItemIds.includes(itemId)}
                  onChange={toggleDamaged} /> Hỏng
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}

function QuantityReceiptInputs({ line, received, onChange }) {
  return (
    <div className="wm-transfer-quantity-inputs">
      <input type="number" min="0" max={line.quantityShipped} aria-label="Số lượng nhận"
        value={received.quantityReceived ?? line.quantityShipped}
        onChange={(event) => onChange({ ...received, quantityReceived: event.target.value })} />
      <input type="number" min="0" max={received.quantityReceived ?? line.quantityShipped} aria-label="Số lượng hỏng"
        value={received.quantityDamaged ?? 0}
        onChange={(event) => onChange({ ...received, quantityDamaged: event.target.value })} />
    </div>
  );
}

/** Ô "Thực nhận / hỏng / thiếu": nhân viên nhập khi phiếu đang chuyển, các trường hợp khác chỉ hiển thị. */
export function ReceiptCell({ line, editable, received, onChange }) {
  if (editable && isIndividualLine(line)) return <ItemReceiptChecklist line={line} received={received} onChange={onChange} />;
  if (editable) return <QuantityReceiptInputs line={line} received={received} onChange={onChange} />;
  return (
    <>
      {`${line.quantityReceived || 0} / ${line.quantityDamaged || 0} / ${line.quantityMissing || 0}`}
      {line.discrepancyId && (
        <div><StockDiscrepancyBadge discrepancy={line.discrepancyId} quantityMissing={line.quantityMissing} /></div>
      )}
    </>
  );
}

/** Ô "Kệ nhập": nhân viên chia hàng tốt của dòng ra một hoặc nhiều kệ trong kho tổng. */
export function PutawayCell({ line, allocations, shelves, onChange }) {
  const rows = allocations || [];
  const updateRow = (index, patch) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const removeRow = (index) => onChange(rows.filter((_, i) => i !== index));
  const addRow = () => onChange([...rows, { storageId: '', quantity: '1', itemIds: [] }]);
  return (
    <div className="wm-pick-allocation-list">
      {rows.map((allocation, index) => (
        <div className="wm-pick-allocation" key={index}>
          <select value={allocation.storageId} onChange={(event) => updateRow(index, { storageId: event.target.value })}>
            <option value="">Chọn kệ</option>
            {shelves.map((storage) => <option key={storage._id} value={storage._id}>{codeAndName(storage)}</option>)}
          </select>
          <input aria-label="Số lượng tại kệ" type="number" min="1" value={allocation.quantity}
            onChange={(event) => updateRow(index, { quantity: event.target.value })} />
          {rows.length > 1 && (
            <Button size="sm" variant="outline-danger" onClick={() => removeRow(index)}>Xóa</Button>
          )}
        </div>
      ))}
      <Button size="sm" variant="outline-secondary" onClick={addRow}>+ Thêm kệ</Button>
      <small>Phân bổ: {sumQuantity(rows)} / {acceptedQuantity(line)}</small>
    </div>
  );
}
