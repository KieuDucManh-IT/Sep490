import React, { useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import { ItemCodeGroup, StatusBadge } from '../../../components/warehouse';
import {
  RELOCATION_STATUS_LABELS, RELOCATION_TYPE_LABELS, formatVariantName, labelOf,
} from '../../../constants/warehouseLabels';
import { codeAndName, idOf } from '../shared/slipHelpers';
import { confirmationError, initialConfirmations } from './relocationHelpers';

/** Ô xác nhận của nhân viên khi phiếu đang thực hiện: điền sẵn các món đã giữ, không phải tích từng món. */
function ConfirmCell({ line, value }) {
  const error = confirmationError(line, value);
  return (
    <td>
      <ItemCodeGroup label="Chuyển đủ" items={line.itemIds || []} />
      {error && <small className="text-danger d-block">{error}</small>}
    </td>
  );
}
function confirmedText(line) {
  if (line.confirmedQuantity == null) return '—';
  return line.confirmedQuantity;
}

/**
 * Chi tiết phiếu di chuyển hàng. Nhân viên được giao: "Bắt đầu" (đã giao → đang thực hiện), nhập số thực tế
 * rồi "Hoàn tất". Chủ kho: xem, hủy khi phiếu chưa hoàn tất (nhả hàng đang giữ ở kệ nguồn).
 */
export default function RelocationDetailModal({
  relocation, isManager, isStaff, busy, error, onStart, onComplete, onCancel, onClose,
}) {
  const lines = relocation.items || [];
  const status = relocation.status;
  const confirming = isStaff && status === 'in_progress';
  const [confirmations] = useState(() => initialConfirmations(relocation));
  const hasErrors = confirming && lines.some((line) => confirmationError(line, confirmations[idOf(line)]));
  const canCancel = isManager && ['assigned', 'in_progress'].includes(status);

  return (
    <Modal show onHide={onClose} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h5">
          {relocation.relocationCode} · {labelOf(RELOCATION_TYPE_LABELS, relocation.operationType, 'Di chuyển hàng')}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-3">
          <StatusBadge status={status} labels={RELOCATION_STATUS_LABELS} fallback={status} />
          {' '}Kho: {codeAndName(relocation.locationId)} · Nhân viên: {relocation.assignedStaffId?.FullName || '—'}
        </p>
        {error && <div className="wm-error">{error}</div>}
        {isStaff && status === 'assigned' && (
          <p className="wm-stock-subline">Bấm “Bắt đầu” khi bắt tay vào chuyển hàng. Hàng đã được giữ sẵn ở kệ nguồn.</p>
        )}
        {confirming && (
          <p className="wm-stock-subline">
            Chuyển đủ các món đã giữ từ kệ nguồn sang kệ đích rồi bấm “Hoàn tất”. Nếu thực tế không đủ món, báo quản lý kho xử lý phiếu.
          </p>
        )}
        <div className="wm-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mặt hàng</th>
                <th>Từ kệ</th>
                <th>Đến kệ</th>
                <th>Số lượng</th>
                <th>{confirming ? 'Thực tế đã chuyển' : 'Đã xác nhận'}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={idOf(line)}>
                  <td>
                    {formatVariantName(line.variantId)}
                    {!confirming && line.itemIds?.length > 0 && <ItemCodeGroup label="Mã hàng" items={line.itemIds} />}
                  </td>
                  <td>{codeAndName(line.fromStorageId)}</td>
                  <td>{codeAndName(line.toStorageId)}</td>
                  <td>{line.quantity}</td>
                  {confirming ? (
                    <ConfirmCell line={line} value={confirmations[idOf(line)]} />
                  ) : <td>{confirmedText(line)}</td>}
                </tr>
              ))}
              {!lines.length && <tr><td colSpan="5">Phiếu không có dòng hàng.</td></tr>}
            </tbody>
          </table>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Đóng</Button>
        {canCancel && <Button variant="outline-danger" disabled={busy} onClick={onCancel}>Hủy phiếu</Button>}
        {isStaff && status === 'assigned' && (
          <Button variant="dark" disabled={busy} onClick={onStart}>Bắt đầu</Button>
        )}
        {confirming && (
          <Button variant="dark" disabled={busy || hasErrors} onClick={() => onComplete(confirmations)}>Hoàn tất</Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
