import React, { useState } from 'react';
import { PackageCheck } from 'lucide-react';
import stockTransferService from '../../../services/warehouse/stockTransferService';
import { DISCREPANCY_CHANGED_EVENT } from '../../../services/warehouse/stockDiscrepancyService';
import { ItemReceiptModal, defaultReceipt, receiptCounts } from '../../../components/warehouse';
import TransferLinesTable from './TransferLinesTable';
import { idOf, lineName } from './transferHelpers';

/** Món đã ghi nhận ở lần nhận trước (không được bỏ). */
const previousOf = (line) => ({
  receivedIds: (line.receivedItemIds || []).map(idOf),
  damagedIds: (line.damagedItemIds || []).map(idOf),
});

/** Mặc định: giữ kết quả lần nhận trước, chưa nhận thì mọi món đã xuất là "nhận tốt". */
const initialReceipt = (transfer) => Object.fromEntries((transfer.items || []).map((line) => {
  const previous = previousOf(line);
  return [line._id, defaultReceipt({ shippedIds: (line.itemIds || []).map(idOf), ...previous })];
}));

/** Dữ liệu gửi API nhận hàng cho một dòng phiếu: số lượng = số món. */
const toReceiptLine = (line, entry = {}) => {
  const receivedItemIds = entry.receivedItemIds || [];
  const damagedItemIds = entry.damagedItemIds || [];
  return {
    detailId: line._id,
    quantityReceived: receivedItemIds.length,
    quantityDamaged: damagedItemIds.length,
    receivedItemIds,
    damagedItemIds,
  };
};

/** Chi nhánh nhận hàng theo món (có thể nhận nhiều đợt): mặc định nhận tốt, chỉ đánh dấu món hỏng / thiếu. */
export default function ReceivePanel({ transfer, busy, onAction, cancelButton }) {
  const [receipt, setReceipt] = useState(() => initialReceipt(transfer));
  const [pickerLineId, setPickerLineId] = useState('');
  const setEntry = (lineId, entry) => setReceipt((old) => ({ ...old, [lineId]: entry }));

  const confirm = async (complete) => {
    const items = (transfer.items || []).map((line) => toReceiptLine(line, receipt[line._id]));
    const message = complete ? 'Đã xác nhận hoàn tất nhận hàng.' : 'Đã ghi nhận số hàng nhận đợt này.';
    const ok = await onAction(() => stockTransferService.receive(transfer._id, { complete, items }), message);
    // Nhận thiếu có thể sinh phiếu chênh lệch: báo sidebar đếm lại.
    if (ok) window.dispatchEvent(new CustomEvent(DISCREPANCY_CHANGED_EVENT));
  };

  const renderReceived = (line) => {
    const counts = receiptCounts(receipt[line._id], (line.itemIds || []).length);
    return <div>
      <small className="wm-stock-subline mt-0">Tốt {counts.good} · Hỏng {counts.damaged} · Thiếu {counts.missing}</small>
      <button type="button" className="wm-text-button p-0" onClick={() => setPickerLineId(line._id)}>
        Đánh dấu món hỏng / thiếu
      </button>
    </div>;
  };

  const pickerLine = pickerLineId && (transfer.items || []).find((line) => line._id === pickerLineId);

  return <>
    <TransferLinesTable transfer={transfer} receivedHeader="Kết quả nhận" renderReceived={renderReceived} />
    <div className="wm-stock-actions">
      {cancelButton}
      <button type="button" className="secondary" disabled={busy} onClick={() => confirm(false)}><PackageCheck size={16} /> Ghi nhận nhận một phần</button>
      <button type="button" disabled={busy} onClick={() => confirm(true)}><PackageCheck size={16} /> Hoàn tất nhận hàng</button>
    </div>
    {pickerLine && <ItemReceiptModal
      title={lineName(pickerLine)}
      items={pickerLine.itemIds || []}
      entry={receipt[pickerLine._id]}
      previous={previousOf(pickerLine)}
      onChange={(entry) => setEntry(pickerLine._id, entry)}
      onHide={() => setPickerLineId('')}
    />}
  </>;
}
