import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import { StatusBadge } from '../../../components/warehouse';
import { INBOUND_STATUS_DETAIL_LABELS } from '../../../constants/warehouseLabels';
import { codeAndName } from '../shared/slipHelpers';
import RecountNotice from './RecountNotice';
import { CANCELLABLE_STATUSES, lineName, money, storedPositions } from './inboundHelpers';

function ReceiptInfo({ receipt }) {
  return (
    <div className="wm-detail-grid">
      <div>
        <small>Trạng thái</small>
        <StatusBadge status={receipt.status} labels={INBOUND_STATUS_DETAIL_LABELS} fallback={receipt.status} />
      </div>
      <div><small>Kho / cửa hàng</small><strong>{codeAndName(receipt.locationId)}</strong></div>
      <div>
        <small>Nhà cung cấp</small>
        <strong>{receipt.supplierId?.supplierCode} — {receipt.supplierId?.name}</strong>
      </div>
      <div><small>Người tạo</small><strong>{receipt.createdBy?.FullName || '—'}</strong></div>
      <div><small>Nhân viên được giao</small><strong>{receipt.assignedStaffId?.FullName || '—'}</strong></div>
      {receipt.note && <div><small>Ghi chú</small><strong>{receipt.note}</strong></div>}
      {receipt.recountCount > 0 && (
        <div><small>Số lần kiểm nhận lại</small><strong>{receipt.recountCount}</strong></div>
      )}
    </div>
  );
}

function ReceiptLines({ items }) {
  return (
    <div className="wm-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mặt hàng</th>
            <th>Dự kiến</th>
            <th>Giá nhập / cái</th>
            <th>Thành tiền dự kiến</th>
            <th>Đã nhận</th>
            <th>Hỏng</th>
            <th>Vị trí xếp</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item._id}>
              <td>{lineName(item)}</td>
              <td>{item.quantityExpected}</td>
              <td>{money(item.unitCost)}</td>
              <td>{money(item.quantityExpected * (item.unitCost || 0))}</td>
              <td>{item.quantityReceived}</td>
              <td>{item.quantityDamaged}</td>
              <td>{storedPositions(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Xem phiếu nhập và các nút theo vai trò:
 * chủ kho hủy / duyệt / yêu cầu kiểm nhận lại; nhân viên ghi nhận thực nhận và xếp hàng lên kệ.
 */
export default function InboundDetailView({ receipt, role, onClose, onCancel, onApprove, onRecount, onSwitchMode }) {
  const isManager = role === 'warehouse_manager';
  const isStaff = role === 'warehouse_staff';
  const status = receipt.status;
  return (
    <>
      <Modal.Body className="wm-inbound-detail">
        <RecountNotice receipt={receipt} />
        <ReceiptInfo receipt={receipt} />
        <ReceiptLines items={receipt.items || []} />
        {isManager && CANCELLABLE_STATUSES.includes(status) && (
          <p className="small text-muted mt-3 mb-0">
            Hủy phiếu = không nhập lô này nữa.
            {status === 'received' && ' Yêu cầu kiểm nhận lại = nhân viên đếm lại hàng của phiếu này.'}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Đóng</Button>
        {isManager && onCancel && CANCELLABLE_STATUSES.includes(status) && (
          <Button variant="outline-danger" onClick={onCancel}>Hủy phiếu</Button>
        )}
        {isStaff && status === 'awaiting_receiving' && (
          <Button variant="dark" onClick={() => onSwitchMode('receive')}>Ghi nhận thực nhận</Button>
        )}
        {isManager && status === 'received' && (
          <>
            <Button variant="outline-warning" onClick={onRecount}>Yêu cầu kiểm nhận lại</Button>
            <Button variant="dark" onClick={onApprove}>Duyệt phiếu</Button>
          </>
        )}
        {isStaff && status === 'approved' && (
          <Button variant="dark" onClick={() => onSwitchMode('putaway')}>Xếp hàng lên kệ</Button>
        )}
      </Modal.Footer>
    </>
  );
}
