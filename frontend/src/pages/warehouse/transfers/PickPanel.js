import React, { useState } from 'react';
import stockTransferService from '../../../services/warehouse/stockTransferService';
import TransferLinesTable from './TransferLinesTable';
import PickItemsModal from './PickItemsModal';
import { idOf, isIndividual } from './transferHelpers';

const initialAllocations = (transfer) => Object.fromEntries((transfer.items || []).map((line) => [
  line._id,
  (line.pickAllocations || []).map((allocation) => ({
    storageId: idOf(allocation.storageId) || 'none',
    quantity: String(allocation.quantity),
    itemIds: (allocation.itemIds || []).map(idOf),
  })),
]));

/** Nhân viên kho chọn vị trí lấy hàng (và món hàng nếu theo dõi từng món) cho từng dòng phiếu. */
export default function PickPanel({ transfer, storages, busy, onAction, onError, cancelButton }) {
  const [allocations, setAllocations] = useState(() => initialAllocations(transfer));
  const [candidates, setCandidates] = useState({});
  const [picker, setPicker] = useState(null);
  const fromLocationId = idOf(transfer.fromLocationId);

  const updateRow = (lineId, index, changes) => setAllocations((old) => ({
    ...old, [lineId]: (old[lineId] || []).map((row, i) => (i === index ? { ...row, ...changes } : row)),
  }));
  const addRow = (lineId) => setAllocations((old) => ({ ...old, [lineId]: [...(old[lineId] || []), { storageId: '', quantity: '1', itemIds: [] }] }));
  const removeRow = (lineId, index) => setAllocations((old) => ({ ...old, [lineId]: old[lineId].filter((_, i) => i !== index) }));

  const checkStock = async (line, allocation, index) => {
    try {
      const result = await stockTransferService.pickCandidates(transfer._id, line._id, allocation.storageId);
      setCandidates((old) => ({ ...old, [`${line._id}:${index}`]: result }));
      if (isIndividual(line)) setPicker({ lineId: line._id, index });
    } catch (loadError) { onError(loadError.message); }
  };

  const save = () => onAction(() => stockTransferService.savePick(transfer._id, {
    items: (transfer.items || []).filter((line) => Number(line.quantityApproved) > 0).map((line) => ({
      detailId: line._id,
      allocations: (allocations[line._id] || []).map((row) => ({
        storageId: row.storageId === 'none' ? null : row.storageId, quantity: Number(row.quantity), itemIds: row.itemIds || [],
      })),
    })),
  }), 'Đã lưu phân bổ hàng theo vị trí.');

  const renderAllocations = (line) => {
    const individual = isIndividual(line);
    const options = storages.filter((storage) => idOf(storage.locationId) === fromLocationId && (!individual || storage.type === 'shelf'));
    const rows = allocations[line._id] || [];
    const allocated = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    return <div className="wm-pick-allocation-list">
      {rows.map((row, index) => {
        const available = candidates[`${line._id}:${index}`]?.available;
        return <div className="wm-pick-allocation" key={index}>
          <select aria-label="Vị trí lấy hàng" value={row.storageId} onChange={(event) => updateRow(line._id, index, { storageId: event.target.value, itemIds: [] })}>
            <option value="">Chọn kệ</option>
            <option value="none">Chưa gán vị trí</option>
            {options.map((storage) => <option key={storage._id} value={storage._id}>{storage.code} · {storage.name}</option>)}
          </select>
          <input aria-label="Số lượng tại vị trí" type="number" min="1" value={row.quantity} onChange={(event) => updateRow(line._id, index, { quantity: event.target.value })} />
          <button className="secondary" type="button" onClick={() => checkStock(line, row, index)}>
            {individual ? `Chọn món hàng (${row.itemIds.length}/${row.quantity})` : 'Kiểm tra tồn'}
          </button>
          {rows.length > 1 && <button className="danger" type="button" onClick={() => removeRow(line._id, index)}>Xóa</button>}
          <small>{available != null ? `Khả dụng: ${available}` : ''}</small>
        </div>;
      })}
      <button className="secondary" type="button" onClick={() => addRow(line._id)}>+ Thêm vị trí</button>
      <small>Đã phân bổ: {allocated}/{line.quantityApproved}</small>
    </div>;
  };

  const pickerLine = picker && (transfer.items || []).find((line) => line._id === picker.lineId);
  const pickerRow = picker && allocations[picker.lineId]?.[picker.index];
  const togglePicked = (itemId, checked) => {
    const chosen = pickerRow.itemIds;
    updateRow(picker.lineId, picker.index, { itemIds: checked ? [...chosen, itemId] : chosen.filter((id) => id !== itemId) });
  };

  return <>
    <TransferLinesTable
      transfer={transfer}
      className="wm-transfer-picking-table"
      extraColumn={{ header: 'Vị trí lấy hàng', render: renderAllocations }}
    />
    <div className="wm-stock-actions">
      {cancelButton}
      <button type="button" disabled={busy} onClick={save}>Lưu phân bổ</button>
    </div>
    {pickerLine && pickerRow && <PickItemsModal
      line={pickerLine}
      allocation={pickerRow}
      candidates={candidates[`${picker.lineId}:${picker.index}`]}
      onToggle={togglePicked}
      onHide={() => setPicker(null)}
    />}
  </>;
}
