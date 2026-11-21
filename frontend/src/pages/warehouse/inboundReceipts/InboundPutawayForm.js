import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { Plus, Trash2 } from 'lucide-react';
import { idOf } from '../shared/slipHelpers';
import {
  acceptedQuantity, buildPutawayPayload, initialPutawayLines, lineName, sumAllocated, validatePutaway,
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
              {shelf.code} — {shelf.name} (tối đa {shelf.maxCapacity ?? 0} cái)
            </option>
          ))}
        </select>
      </label>
      <label>
        Số lượng
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
 * Nhân viên kho xếp hàng đạt chất lượng của phiếu nhập lên kệ. Một dòng hàng có thể chia ra nhiều kệ;
 * backend kiểm sức chứa còn lại của kệ, dãy, khu và kho.
 */
export default function InboundPutawayForm({ receipt, shelves, onPutaway, onBack, onDone }) {
  const [lines, setLines] = useState(() => initialPutawayLines(receipt));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const receiptShelves = shelves.filter((shelf) => idOf(shelf.locationId) === idOf(receipt.locationId));

  const updateLine = (lineIndex, mapAllocations) => {
    setLines((old) => old.map((line, i) => (i === lineIndex ? { ...line, allocations: mapAllocations(line) } : line)));
  };
  const updateAllocation = (lineIndex, allocationIndex, key, value) => updateLine(lineIndex, (line) => line.allocations
    .map((allocation, j) => (j === allocationIndex ? { ...allocation, [key]: value } : allocation)));
  const addAllocation = (lineIndex) => updateLine(lineIndex, (line) => [
    ...line.allocations,
    { storageId: '', quantity: Math.max(1, line.accepted - sumAllocated(line.allocations)) },
  ]);
  const removeAllocation = (lineIndex, allocationIndex) => updateLine(lineIndex, (line) => line.allocations
    .filter((_, j) => j !== allocationIndex));

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
        <p>Chọn kệ cho từng dòng hàng đạt chất lượng. Phân bổ được kiểm tra với sức chứa còn lại của kệ, dãy, khu và kho.</p>
        {receipt.items.map((item, index) => {
          const accepted = acceptedQuantity(item);
          const allocations = lines[index]?.allocations || [];
          const allocated = sumAllocated(allocations);
          const usedIds = allocations.map((allocation) => allocation.storageId).filter(Boolean);
          return (
            <div className="wm-putaway-row" key={item._id}>
              <strong>{lineName(item)}<small>{accepted} cái cần xếp</small></strong>
              {accepted > 0 ? (
                <div className="wm-allocation-list">
                  {allocations.map((allocation, allocationIndex) => (
                    <AllocationRow
                      key={`${item._id}-${allocationIndex}`}
                      allocation={allocation}
                      shelves={receiptShelves}
                      usedIds={usedIds}
                      canRemove={allocations.length > 1}
                      onChange={(key, value) => updateAllocation(index, allocationIndex, key, value)}
                      onRemove={() => removeAllocation(index, allocationIndex)}
                    />
                  ))}
                  <button type="button" className="wm-add-allocation" disabled={allocated >= accepted}
                    onClick={() => addAllocation(index)}>
                    <Plus size={14} />Thêm vị trí
                  </button>
                  <small>Đã phân bổ {allocated} / {accepted} cái</small>
                </div>
              ) : <span>Không có hàng tốt cần xếp.</span>}
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
