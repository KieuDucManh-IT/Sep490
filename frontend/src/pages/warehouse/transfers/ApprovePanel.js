import React, { useState } from 'react';
import { Form } from 'react-bootstrap';
import stockTransferService from '../../../services/warehouse/stockTransferService';
import TransferLinesTable from './TransferLinesTable';
import { idOf } from './transferHelpers';

const initialQuantities = (transfer) => Object.fromEntries(
  (transfer.items || []).map((line) => [line._id, String(line.quantityRequested)]),
);

/** Chủ kho duyệt / từ chối yêu cầu bổ sung hàng và giao nhân viên soạn hàng. */
export default function ApprovePanel({ transfer, staff, busy, onAction, onError, cancelButton }) {
  const [quantities, setQuantities] = useState(() => initialQuantities(transfer));
  const [assignedStaffId, setAssignedStaffId] = useState(() => idOf(transfer.assignedStaffId));

  const reject = () => onAction(() => stockTransferService.decide(transfer._id, { decision: 'reject', note: '' }), 'Đã từ chối yêu cầu.');

  const approve = () => {
    const lines = transfer.items || [];
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
    <TransferLinesTable transfer={transfer} renderApproved={renderApproved} />
    <div className="wm-stock-actions">
      {cancelButton}
      <button type="button" className="danger" disabled={busy} onClick={reject}>Từ chối</button>
      <button type="button" disabled={busy} onClick={approve}>Duyệt yêu cầu</button>
    </div>
  </>;
}
