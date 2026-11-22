import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import { PackageCheck } from 'lucide-react';
import WarehouseWorkflowProgress from '../../../components/WarehouseWorkflowProgress';
import { ItemCodeGroup, StatusBadge } from '../../../components/warehouse';
import { BRANCH_RETURN_STATUS_LABELS, formatVariantName } from '../../../constants/warehouseLabels';
import { idOf } from '../shared/slipHelpers';
import { PutawayCell, ReceiptCell } from './ReturnLineCells';

function StaffAssign({ staff, value, onChange }) {
  return (
    <label className="wm-staff-assign">
      Nhân viên nhận hàng
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Chọn nhân viên kho</option>
        {staff.map((member) => <option key={member._id} value={member._id}>{member.FullName} · {member.Email}</option>)}
      </select>
    </label>
  );
}

function LineName({ line }) {
  return (
    <td>
      {formatVariantName(line.variantId)}
      {line.itemIds?.length > 0 && <ItemCodeGroup label="Mã hàng" items={line.itemIds} />}
    </td>
  );
}

function ReturnLinesTable({ transfer, role, form }) {
  const status = transfer.status;
  const approving = role.isManager && status === 'requested';
  const receiving = role.isStaff && status === 'shipped';
  const puttingAway = role.isStaff && status === 'receipt_approved';
  const shelves = form.storages.filter((storage) => idOf(storage.locationId) === idOf(transfer.toLocationId));
  return (
    <div className="wm-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Sản phẩm / biến thể</th>
            <th>Yêu cầu</th>
            <th>Duyệt</th>
            <th>Đã gửi</th>
            <th>Thực nhận / hỏng / thiếu</th>
            {puttingAway && <th>Kệ nhập</th>}
          </tr>
        </thead>
        <tbody>
          {transfer.items.map((line) => (
            <tr key={line._id}>
              <LineName line={line} />
              <td>{line.quantityRequested}</td>
              <td>
                {approving ? (
                  <input className="wm-count-input" type="number" min="0" max={line.quantityRequested}
                    value={form.approval[line._id] ?? line.quantityRequested}
                    onChange={(event) => form.setApprovalFor(line._id, event.target.value)} />
                ) : line.quantityApproved ?? '—'}
              </td>
              <td>{line.quantityShipped || 0}</td>
              <td>
                <ReceiptCell
                  line={line}
                  editable={receiving}
                  received={form.receipt[line._id] || { receivedItemIds: [], damagedItemIds: [] }}
                  onChange={(value) => form.setReceiptFor(line._id, value)}
                />
              </td>
              {puttingAway && (
                <td>
                  <PutawayCell
                    line={line}
                    allocations={form.allocations[line._id]}
                    shelves={shelves}
                    onChange={(value) => form.setAllocationsFor(line._id, value)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailActions({ transfer, role, busy, actions }) {
  const status = transfer.status;
  return (
    <>
      {role.isManager && status === 'requested' && (
        <>
          <Button variant="outline-danger" disabled={busy} onClick={actions.rejectRequest}>Từ chối</Button>
          <Button variant="dark" disabled={busy} onClick={actions.approveRequest}>Duyệt và khóa hàng</Button>
        </>
      )}
      {role.isBranch && status === 'approved' && (
        <>
          <Button variant="dark" disabled={busy} onClick={actions.dispatch}>Xác nhận gửi hàng</Button>
          <Button variant="outline-danger" disabled={busy} onClick={actions.cancel}>Hủy phiếu</Button>
        </>
      )}
      {role.isStaff && status === 'shipped' && (
        <Button variant="dark" disabled={busy} onClick={actions.submitReceipt}>
          <PackageCheck size={16} /> Gửi kết quả nhận hàng
        </Button>
      )}
      {role.isManager && status === 'receipt_submitted' && (
        <>
          <Button variant="outline-danger" disabled={busy} onClick={actions.rejectReceipt}>Yêu cầu kiểm lại</Button>
          <Button variant="dark" disabled={busy} onClick={actions.approveReceipt}>Duyệt kết quả nhận</Button>
        </>
      )}
      {role.isStaff && status === 'receipt_approved' && (
        <Button variant="dark" disabled={busy} onClick={actions.submitPutaway}>Hoàn tất xếp kệ</Button>
      )}
    </>
  );
}

/**
 * Chi tiết phiếu trả hàng và thao tác theo vai trò:
 * chủ kho duyệt yêu cầu / duyệt kết quả nhận; chi nhánh gửi hàng hoặc hủy; nhân viên kho nhận và xếp kệ.
 */
export default function BranchReturnDetailModal({ transfer, role, form, staff, busy, error, actions, onClose }) {
  return (
    <Modal show onHide={onClose} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h5">
          {transfer.transferCode} · {transfer.fromLocationId?.name} → {transfer.toLocationId?.name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          <StatusBadge status={transfer.status} labels={BRANCH_RETURN_STATUS_LABELS} fallback={transfer.status} />
          {' '}Người tạo: {transfer.createdBy?.FullName || '—'}
          {' · '}Nhân viên nhận: {transfer.assignedStaffId?.FullName || 'Chưa giao'}
        </p>
        <WarehouseWorkflowProgress flow="branchReturn" status={transfer.status} />
        {error && <div className="wm-error">{error}</div>}
        {role.isManager && transfer.status === 'requested' && (
          <StaffAssign staff={staff} value={form.assignedStaffId} onChange={form.setAssignedStaffId} />
        )}
        <ReturnLinesTable transfer={transfer} role={role} form={form} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Đóng</Button>
        <DetailActions transfer={transfer} role={role} busy={busy} actions={actions} />
      </Modal.Footer>
    </Modal>
  );
}
