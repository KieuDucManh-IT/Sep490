import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { Plus, Trash2 } from 'lucide-react';
import { idOf } from '../shared/slipHelpers';
import {
  buildPutawayPayload, initialPutawayLines, lineName, sumAllocated, validatePutaway,
} from './inboundHelpers';

function AllocationRow({ allocation, shelves, usedIds, canRemove, onChange, onRemove }) {
  const choices = shelves.filter((shelf) => !usedIds.includes(shelf._id) || shelf._id === allocation.storageId);
  return (
    <div className="wm-allocation-row">
      <label>
        Kệ
        <select required value={allocation.storageId} onChange={(event) => onChange('storageId', event.target.value)}>
          <option value="">Chọn kệ</option>
          {choices.map((shelf) => (
            <option key={shelf._id} value={shelf._id}>
              {shelf.code} — {shelf.name} (tối đa {shelf.maxCapacity ?? 0} món)
            </option>
          ))}
        </select>
      </label>
      <label>
        Số món
        <input required type="number" min="1" step="1" value={allocation.quantity}
          onChange={(event) => onChange('quantity', event.target.value)} />
      </label>
      {canRemove && (
        <button type="button" className="wm-icon-button danger" aria-label="Xóa vị trí" onClick={onRemove}>
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

/**
 * Danh sách kệ của một phần hàng (tốt hoặc hỏng) trong một dòng phiếu.
 * @param {{ title: string, total: number, allocations: object[], shelves: object[], onChange: (next: object[]) => void }} props
 */
function AllocationList({ title, total, allocations, shelves, onChange }) {
  const allocated = sumAllocated(allocations);
  const usedIds = allocations.map((allocation) => allocation.storageId).filter(Boolean);
  const update = (index, key, value) => onChange(allocations
    .map((allocation, j) => (j === index ? { ...allocation, [key]: value } : allocation)));
  const add = () => onChange([...allocations, { storageId: '', quantity: Math.max(1, total - allocated) }]);
  const remove = (index) => onChange(allocations.filter((_, j) => j !== index));
  return (
    <div className="wm-allocation-list">
      <small><strong>{title}</strong></small>
      {allocations.map((allocation, index) => (
        <AllocationRow
          key={index}
          allocation={allocation}
          shelves={shelves}
          usedIds={usedIds}
          canRemove={allocations.length > 1}
          onChange={(key, value) => update(index, key, value)}
          onRemove={() => remove(index)}
        />
      ))}
      <button type="button" className="wm-add-allocation" disabled={allocated >= total} onClick={add}>
        <Plus size={14} />Thêm vị trí
      </button>
      <small>Đã phân bổ {allocated} / {total} món</small>
    </div>
  );
}

/**
 * Nhân viên kho xếp hàng của phiếu nhập lên kệ. Mỗi đơn vị thực nhận thành một món có mã:
 * phần tốt sẵn sàng bán / thuê; phần hỏng vẫn xếp lên kệ (không khả dụng) để xử lý tiếp.
 * Một dòng hàng có thể chia ra nhiều kệ; backend kiểm sức chứa còn lại của kệ, dãy, khu và kho.
 */
export default function InboundPutawayForm({ receipt, shelves, onPutaway, onBack, onDone }) {
  const [lines, setLines] = useState(() => initialPutawayLines(receipt));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const receiptShelves = shelves.filter((shelf) => idOf(shelf.locationId) === idOf(receipt.locationId));

  const setLineField = (lineIndex, key, value) => setLines((old) => old
    .map((line, i) => (i === lineIndex ? { ...line, [key]: value } : line)));

  const submit = async (event) => {
    event.preventDefault();
    const message = validatePutaway(lines);
    if (message) {
      setError(message);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onPutaway(buildPutawayPayload(lines));
      onDone();
    } catch (putawayError) {
      setError(putawayError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <Modal.Body className="wm-receive-list">
        {error && <div className="wm-error">{error}</div>}
        <p>
          Chọn kệ cho từng dòng hàng. Mỗi món nhận được sẽ có mã hàng riêng; món hỏng cũng xếp lên kệ (không bán / cho thuê)
          để xử lý tiếp. Phân bổ được kiểm tra với sức chứa còn lại của kệ, dãy, khu và kho.
        </p>
        {receipt.items.map((item, index) => {
          const line = lines[index] || { accepted: 0, damaged: 0, allocations: [], damagedAllocations: [] };
          const nothing = line.accepted <= 0 && line.damaged <= 0;
          return (
            <div className="wm-putaway-row" key={item._id}>
              <strong>
                {lineName(item)}
                <small>{line.accepted} món tốt{line.damaged > 0 ? ` · ${line.damaged} món hỏng` : ''} cần xếp</small>
              </strong>
              {nothing && <span>Không có hàng cần xếp.</span>}
              <div>
                {line.accepted > 0 && (
                  <AllocationList title="Hàng tốt" total={line.accepted} allocations={line.allocations}
                    shelves={receiptShelves} onChange={(next) => setLineField(index, 'allocations', next)} />
                )}
                {line.damaged > 0 && (
                  <AllocationList title="Hàng hỏng" total={line.damaged} allocations={line.damagedAllocations}
                    shelves={receiptShelves} onChange={(next) => setLineField(index, 'damagedAllocations', next)} />
                )}
              </div>
            </div>
          );
        })}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" type="button" onClick={onBack}>Quay lại</Button>
        <Button variant="dark" type="submit" disabled={saving}>{saving ? 'Đang cập nhật kho...' : 'Hoàn tất xếp hàng'}</Button>
      </Modal.Footer>
    </form>
  );
}
