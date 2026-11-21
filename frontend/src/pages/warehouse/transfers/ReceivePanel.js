import React, { useState } from 'react';
import { PackageCheck } from 'lucide-react';
import stockTransferService from '../../../services/warehouse/stockTransferService';
import { DISCREPANCY_CHANGED_EVENT } from '../../../services/warehouse/stockDiscrepancyService';
import TransferLinesTable from './TransferLinesTable';
import ReceiveItemsModal from './ReceiveItemsModal';
import { idOf, isIndividual } from './transferHelpers';

const initialReceipt = (transfer) => Object.fromEntries((transfer.items || []).map((line) => [line._id, {
  quantityReceived: String(line.quantityReceived || 0),
  quantityDamaged: String(line.quantityDamaged || 0),
  receivedItemIds: (line.receivedItemIds || []).map(idOf),
  damagedItemIds: (line.damagedItemIds || []).map(idOf),
}]));

/** Dữ liệu gửi API nhận hàng cho một dòng phiếu. */
const toReceiptLine = (line, entry = {}) => {
  const individual = isIndividual(line);
  const receivedItemIds = individual ? (entry.receivedItemIds || []) : [];
  const damagedItemIds = individual ? (entry.damagedItemIds || []) : [];
  return {
    detailId: line._id,
    quantityReceived: individual ? receivedItemIds.length : Number(entry.quantityReceived || 0),
    quantityDamaged: individual ? damagedItemIds.length : Number(entry.quantityDamaged || 0),
    receivedItemIds,
    damagedItemIds,
  };
};

const isValidReceipt = (receiptLine, line) => Number.isInteger(receiptLine.quantityReceived)
  && receiptLine.quantityReceived >= Number(line.quantityReceived || 0)
  && receiptLine.quantityReceived <= Number(line.quantityShipped || 0)
  && Number.isInteger(receiptLine.quantityDamaged)
  && receiptLine.quantityDamaged >= 0
  && receiptLine.quantityDamaged <= receiptLine.quantityReceived;

/** Chi nhánh kiểm đếm hàng nhận (có thể nhận nhiều đợt) và báo hàng hỏng. */
export default function ReceivePanel({ transfer, busy, onAction, onError, cancelButton }) {
  const [receipt, setReceipt] = useState(() => initialReceipt(transfer));
  const [pickerLineId, setPickerLineId] = useState('');
  const setEntry = (lineId, entry) => setReceipt((old) => ({ ...old, [lineId]: entry }));

  const confirm = async (complete) => {
    const lines = transfer.items || [];
    const items = lines.map((line) => toReceiptLine(line, receipt[line._id]));
    if (items.some((item, index) => !isValidReceipt(item, lines[index]))) {
      onError('Số nhận phải là số nguyên trong phạm vi đã xuất; số hỏng không được vượt quá số nhận.');
      return;
    }
    const message = complete ? 'Đã xác nhận hoàn tất nhận hàng.' : 'Đã ghi nhận số hàng nhận đợt này.';
    const ok = await onAction(() => stockTransferService.receive(transfer._id, { complete, items }), message);
    // Nhận thiếu có thể sinh phiếu chênh lệch: báo sidebar đếm lại.
    if (ok) window.dispatchEvent(new CustomEvent(DISCREPANCY_CHANGED_EVENT));
  };

  const renderReceived = (line) => {
    const entry = receipt[line._id] || {};
    if (isIndividual(line)) {
      return <button type="button" className="secondary" onClick={() => setPickerLineId(line._id)}>
        Xem / xác nhận nhận ({(entry.receivedItemIds || []).length}/{line.quantityShipped || 0})
      </button>;
    }
    return <div className="wm-transfer-quantity-inputs">
      <input type="number" min={line.quantityReceived || 0} max={line.quantityShipped} aria-label="Số lượng nhận"
        value={entry.quantityReceived ?? line.quantityShipped}
        onChange={(event) => setEntry(line._id, { ...entry, quantityReceived: event.target.value })} />
      <input type="number" min={line.quantityDamaged || 0} max={entry.quantityReceived ?? line.quantityShipped} aria-label="Số lượng hỏng"
        value={entry.quantityDamaged ?? line.quantityDamaged ?? 0}
        onChange={(event) => setEntry(line._id, { ...entry, quantityDamaged: event.target.value })} />
    </div>;
  };

  const pickerLine = pickerLineId && (transfer.items || []).find((line) => line._id === pickerLineId);

  return <>
    <TransferLinesTable transfer={transfer} receivedHeader="Xác nhận nhận" renderReceived={renderReceived} />
    <div className="wm-stock-actions">
      {cancelButton}
      <button type="button" className="secondary" disabled={busy} onClick={() => confirm(false)}><PackageCheck size={16} /> Ghi nhận nhận một phần</button>
      <button type="button" disabled={busy} onClick={() => confirm(true)}><PackageCheck size={16} /> Hoàn tất nhận hàng</button>
    </div>
    {pickerLine && <ReceiveItemsModal
      line={pickerLine}
      entry={receipt[pickerLine._id] || {}}
      onChange={(entry) => setEntry(pickerLine._id, entry)}
      onHide={() => setPickerLineId('')}
    />}
  </>;
}
