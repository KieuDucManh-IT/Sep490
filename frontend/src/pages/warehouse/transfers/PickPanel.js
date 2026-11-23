import React, { useState } from 'react';
import { Alert } from 'react-bootstrap';
import stockTransferService from '../../../services/warehouse/stockTransferService';
import { ItemCodeGroup, fillItemIds } from '../../../components/warehouse';
import TransferLinesTable from './TransferLinesTable';
import PickItemsModal from './PickItemsModal';
import { idOf, itemCodeOf } from './transferHelpers';
import usePickSuggestion from './usePickSuggestion';
import PickSuggestionList from './PickSuggestionList';

const initialAllocations = (transfer) => Object.fromEntries((transfer.items || []).map((line) => [
  line._id,
  (line.pickAllocations || []).map((allocation) => ({
    storageId: idOf(allocation.storageId),
    quantity: String(allocation.quantity),
    itemIds: (allocation.itemIds || []).map(idOf),
  })),
]));

/** Ghi nhớ mã hàng theo id để hiển thị gọn danh sách món đã chọn. */
const codesFromItems = (items = []) => Object.fromEntries(items.map((item) => [idOf(item), itemCodeOf(item)]));

const candidateKey = (lineId, storageId) => `${lineId}:${storageId}`;

/**
 * Nhân viên kho soạn hàng theo món. Không bắt tích từng món:
 * - "Lấy theo gợi ý" điền sẵn kệ + món cho mọi dòng;
 * - tự sửa kệ / số lượng thì khi lưu hệ thống tự chọn món sớm nhất tại kệ cho đủ số;
 * - muốn chọn món cụ thể thì bấm "Đổi món".
 */
export default function PickPanel({ transfer, storages, busy, onAction, onError, cancelButton }) {
  const [allocations, setAllocations] = useState(() => initialAllocations(transfer));
  const [candidates, setCandidates] = useState({});
  const [codes, setCodes] = useState({});
  const [picker, setPicker] = useState(null);
  const suggestion = usePickSuggestion(transfer._id);
  const [applied, setApplied] = useState(false);
  const fromLocationId = idOf(transfer.fromLocationId);
  const shelves = storages.filter((storage) => idOf(storage.locationId) === fromLocationId && storage.type === 'shelf');
  const shelfCode = (storageId) => shelves.find((storage) => idOf(storage) === storageId)?.code || '';

  const updateRow = (lineId, index, changes) => setAllocations((old) => ({
    ...old, [lineId]: (old[lineId] || []).map((row, i) => (i === index ? { ...row, ...changes } : row)),
  }));
  const addRow = (lineId) => setAllocations((old) => ({ ...old, [lineId]: [...(old[lineId] || []), { storageId: '', quantity: '1', itemIds: [] }] }));
  const removeRow = (lineId, index) => setAllocations((old) => ({ ...old, [lineId]: old[lineId].filter((_, i) => i !== index) }));

  /** Món sẵn sàng tại một kệ (FIFO), có cache theo dòng + kệ. */
  const loadCandidates = async (lineId, storageId) => {
    const key = candidateKey(lineId, storageId);
    if (candidates[key]) return candidates[key];
    const result = await stockTransferService.pickCandidates(transfer._id, lineId, storageId);
    const items = Array.isArray(result) ? result : [];
    setCandidates((old) => ({ ...old, [key]: items }));
    setCodes((old) => ({ ...old, ...codesFromItems(items) }));
    return items;
  };

  const openPicker = async (line, row, index) => {
    if (!row.storageId) { onError('Chọn kệ trước khi đổi món.'); return; }
    try {
      await loadCandidates(line._id, row.storageId);
      setPicker({ lineId: line._id, index });
    } catch (loadError) { onError(loadError.message); }
  };

  /** Điền kế hoạch lấy hàng theo gợi ý (ít kệ nhất, theo mã vị trí). Nhân viên vẫn sửa được trước khi lưu. */
  const applySuggestion = async () => {
    try {
      const lines = await suggestion.load();
      const byDetail = new Map(lines.map((line) => [String(line.detailId), line]));
      const suggestedCodes = {};
      setAllocations((old) => {
        const next = { ...old };
        for (const line of transfer.items || []) {
          const suggested = byDetail.get(String(line._id));
          if (!suggested || !(Number(line.quantityApproved) > 0)) continue;
          next[line._id] = suggested.picks.map((pick) => {
            const itemIds = (pick.itemIds || []).map(idOf);
            itemIds.forEach((itemId, i) => { suggestedCodes[itemId] = pick.itemCodes?.[i] || itemId.slice(-6); });
            return { storageId: idOf(pick.storageId), quantity: String(pick.quantity), itemIds };
          });
        }
        return next;
      });
      setCodes((old) => ({ ...old, ...suggestedCodes }));
      setApplied(true);
    } catch (loadError) { onError(loadError.message); }
  };

  /** Dòng nào số món đã chọn chưa khớp số lượng thì tự chọn món tại kệ (giữ món người dùng đã chọn). */
  const completeAllocations = async () => {
    const next = {};
    for (const line of (transfer.items || []).filter((row) => Number(row.quantityApproved) > 0)) {
      next[line._id] = [];
      const rows = allocations[line._id] || [];
      for (const [index, row] of rows.entries()) {
        if (!row.storageId) throw new Error(`Dòng "${line.variantId?.sku || ''}": chọn kệ lấy hàng.`);
        let itemIds = row.itemIds || [];
        if (itemIds.length !== Number(row.quantity)) {
          // Không lấy trùng món đã dùng ở các kệ khác của cùng dòng.
          const usedElsewhere = new Set([
            ...next[line._id].flatMap((done) => done.itemIds),
            ...rows.slice(index + 1).flatMap((other) => other.itemIds || []),
          ]);
          const items = (await loadCandidates(line._id, row.storageId)).filter((item) => !usedElsewhere.has(idOf(item)));
          itemIds = fillItemIds(itemIds, items, Number(row.quantity));
          if (itemIds.length < Number(row.quantity)) {
            throw new Error(`Kệ ${shelfCode(row.storageId) || ''} chỉ còn ${itemIds.length} món sẵn sàng cho dòng "${line.variantId?.sku || ''}".`);
          }
        }
        next[line._id].push({ ...row, itemIds });
      }
    }
    setAllocations((old) => ({ ...old, ...next }));
    return next;
  };

  const save = () => onAction(async () => {
    const filled = await completeAllocations();
    return stockTransferService.savePick(transfer._id, {
      items: Object.entries(filled).map(([detailId, rows]) => ({
        detailId,
        allocations: rows.map((row) => ({ storageId: row.storageId, quantity: Number(row.quantity), itemIds: row.itemIds })),
      })),
    });
  }, 'Đã lưu phân bổ hàng theo vị trí.');

  const renderRowItems = (row) => {
    const label = row.storageId ? `Kệ ${shelfCode(row.storageId) || '—'}` : 'Chưa chọn kệ';
    if (row.itemIds.length === Number(row.quantity)) {
      return <ItemCodeGroup label={label} items={row.itemIds} codeOf={(itemId) => codes[itemId] || itemId.slice(-6)} />;
    }
    return <small>{label}: {row.itemIds.length}/{row.quantity || 0} món — khi lưu sẽ tự chọn món sớm nhất tại kệ.</small>;
  };

  const renderAllocations = (line) => {
    const rows = allocations[line._id] || [];
    const allocated = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const suggested = applied ? suggestion.byDetail.get(String(line._id)) : null;
    return <div className="wm-pick-allocation-list">
      {suggested && <PickSuggestionList line={suggested} />}
      {rows.map((row, index) => <div className="wm-pick-allocation" key={index}>
        <select aria-label="Kệ lấy hàng" value={row.storageId} onChange={(event) => updateRow(line._id, index, { storageId: event.target.value, itemIds: [] })}>
          <option value="">Chọn kệ</option>
          {shelves.map((storage) => <option key={storage._id} value={storage._id}>{storage.code} · {storage.name}</option>)}
        </select>
        <input aria-label="Số món tại kệ" type="number" min="1" value={row.quantity} onChange={(event) => updateRow(line._id, index, { quantity: event.target.value })} />
        <button className="secondary" type="button" onClick={() => openPicker(line, row, index)}>Đổi món</button>
        {rows.length > 1 && <button className="danger" type="button" onClick={() => removeRow(line._id, index)}>Xóa</button>}
        <div style={{ gridColumn: '1 / -1' }}>{renderRowItems(row)}</div>
      </div>)}
      <button className="secondary" type="button" onClick={() => addRow(line._id)}>+ Thêm kệ</button>
      <small>Đã phân bổ: {allocated}/{line.quantityApproved} món</small>
    </div>;
  };

  const pickerLine = picker && (transfer.items || []).find((line) => line._id === picker.lineId);
  const pickerRow = picker && allocations[picker.lineId]?.[picker.index];
  const togglePicked = (itemId, checked) => {
    const chosen = pickerRow.itemIds;
    updateRow(picker.lineId, picker.index, { itemIds: checked ? [...chosen, itemId] : chosen.filter((id) => id !== itemId) });
  };

  const shortLines = applied ? suggestion.lines.filter((line) => line.shortage > 0 && line.needed > 0) : [];

  return <>
    <div className="wm-stock-actions justify-content-start mt-0 mb-2">
      <button type="button" className="secondary" disabled={busy || suggestion.loading} onClick={applySuggestion}>
        {suggestion.loading ? 'Đang tính gợi ý...' : 'Lấy theo gợi ý'}
      </button>
    </div>
    {applied && <Alert variant={shortLines.length ? 'warning' : 'info'} className="py-2">
      Đã điền kệ và món theo gợi ý: ít kệ nhất, đi theo thứ tự mã vị trí. Có thể sửa trước khi lưu; khi lưu, hệ thống kiểm lại tồn thực tế.
      {shortLines.length > 0 && ` ${shortLines.length} dòng không đủ hàng tại kho tổng — xem cảnh báo ở từng dòng.`}
    </Alert>}
    <TransferLinesTable
      transfer={transfer}
      className="wm-transfer-picking-table"
      rowClassName={(line) => (applied && suggestion.byDetail.get(String(line._id))?.shortage > 0 ? 'wm-transfer-row-short' : '')}
      extraColumn={{ header: 'Kệ / món lấy hàng', render: renderAllocations }}
    />
    <div className="wm-stock-actions">
      {cancelButton}
      <button type="button" disabled={busy} onClick={save}>Lưu phân bổ</button>
    </div>
    {pickerLine && pickerRow && <PickItemsModal
      line={pickerLine}
      allocation={pickerRow}
      candidates={candidates[candidateKey(picker.lineId, pickerRow.storageId)]}
      onToggle={togglePicked}
      onHide={() => setPicker(null)}
    />}
  </>;
}
