import React, { useState } from 'react';
import { Alert, Form } from 'react-bootstrap';
import stockTransferService from '../../../services/warehouse/stockTransferService';
import TransferLinesTable from './TransferLinesTable';
import { idOf } from './transferHelpers';
import usePickSuggestion from './usePickSuggestion';

const initialQuantities = (transfer) => Object.fromEntries(
  (transfer.items || []).map((line) => [line._id, String(line.quantityRequested)]),
);

/** Chủ kho duyệt / từ chối yêu cầu bổ sung hàng và giao nhân viên soạn hàng. */
export default function ApprovePanel({ transfer, staff, busy, onAction, onError, cancelButton }) {
  const [quantities, setQuantities] = useState(() => initialQuantities(transfer));
  const [assignedStaffId, setAssignedStaffId] = useState(() => idOf(transfer.assignedStaffId));
  // TASK-014 D1: chỉ hiển thị khả dụng kho tổng; quy tắc duyệt vẫn do server kiểm (không đổi).
  const stock = usePickSuggestion(transfer._id, { auto: true });
  const availableOf = (line) => stock.byDetail.get(String(line._id))?.centralAvailable;
  const shortOf = (line) => {
    const available = availableOf(line);
    return available == null ? 0 : Math.max(0, Number(line.quantityRequested || 0) - available);
  };
  const lines = transfer.items || [];
  const enoughCount = lines.filter((line) => availableOf(line) != null && shortOf(line) === 0).length;

  const reject = () => onAction(() => stockTransferService.decide(transfer._id, { decision: 'reject', note: '' }), 'Đã từ chối yêu cầu.');

  const approve = () => {
    const items = lines.map((line) => ({ detailId: line._id, quantityApproved: Number(quantities[line._id] ?? line.quantityRequested) }));
    const outOfRange = items.some((item, index) => !Number.isInteger(item.quantityApproved) || item.quantityApproved < 0
      || item.quantityApproved > Number(lines[index].quantityRequested));
    if (outOfRange || !items.some((item) => item.quantityApproved > 0)) {
      onError('Số lượng duyệt phải là số nguyên từ 0 đến số yêu cầu và cần duyệt ít nhất một mặt hàng.');
      return;
    }
    if (!assignedStaffId) { onError('Chọn nhân viên kho phụ trách soạn hàng và xuất hàng.'); return; }
    onAction(() => stockTransferService.decide(transfer._id, { decision: 'approve', assignedStaffId, note: '', items }), 'Đã duyệt và giao việc xuất kho.');
  };

  const renderAvailable = (line) => {
    const available = availableOf(line);
    if (available == null) return stock.loading ? '…' : '—';
    const short = shortOf(line);
    return <>
      <strong>{available}</strong>
      {short > 0 && <div className="wm-transfer-short-label">Thiếu {short}</div>}
    </>;
  };

  const renderApproved = (line) => <input
    className="wm-count-input" type="number" min="0" max={line.quantityRequested} aria-label="Số lượng duyệt"
    value={quantities[line._id] ?? line.quantityRequested}
    onChange={(event) => setQuantities({ ...quantities, [line._id]: event.target.value })}
  />;

  return <>
    <Form.Group className="wm-staff-assign" controlId="transfer-assigned-staff">
      <Form.Label className="mb-0">Nhân viên kho phụ trách</Form.Label>
      <Form.Select value={assignedStaffId} onChange={(event) => setAssignedStaffId(event.target.value)}>
        <option value="">Chọn nhân viên</option>
        {staff.map((member) => <option key={member._id} value={member._id}>{member.FullName} · {member.Email}</option>)}
      </Form.Select>
    </Form.Group>
    {stock.error && <Alert variant="warning" className="py-2">{stock.error}</Alert>}
    {!stock.error && stock.lines.length > 0 && (
      <Alert variant={enoughCount === lines.length ? 'success' : 'warning'} className="py-2">
        {enoughCount}/{lines.length} dòng đủ hàng tại kho tổng (theo số chi nhánh yêu cầu).
      </Alert>
    )}
    <TransferLinesTable
      transfer={transfer}
      renderApproved={renderApproved}
      rowClassName={(line) => (shortOf(line) > 0 ? 'wm-transfer-row-short' : '')}
      extraColumn={{ header: 'Khả dụng kho tổng', render: renderAvailable }}
    />
    <div className="wm-stock-actions">
      {cancelButton}
      <button type="button" className="danger" disabled={busy} onClick={reject}>Từ chối</button>
      <button type="button" disabled={busy} onClick={approve}>Duyệt yêu cầu</button>
    </div>
  </>;
}
