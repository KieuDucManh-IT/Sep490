import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import { StatusBadge } from '../../../components/warehouse';
import {
  RELOCATION_STATUS_LABELS, RELOCATION_TYPE_LABELS, formatVariantName, labelOf,
} from '../../../constants/warehouseLabels';
import { codeAndName, idOf } from '../shared/slipHelpers';

/** Xem chi tiết (chỉ đọc) phiếu tách / gộp: mặt hàng, kệ nguồn → kệ đích, số lượng, mã hàng đã giữ. */
export default function RelocationDetailModal({ relocation, onClose }) {
  const lines = relocation.items || [];
  return (
    <Modal show onHide={onClose} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h5">
          {relocation.relocationCode} · {labelOf(RELOCATION_TYPE_LABELS, relocation.operationType, '')}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-3">
          <StatusBadge status={relocation.status} labels={RELOCATION_STATUS_LABELS} fallback={relocation.status} />
          {' '}Kho: {codeAndName(relocation.locationId)} · Nhân viên: {relocation.assignedStaffId?.FullName || '—'}
        </p>
        <div className="wm-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mặt hàng</th>
                <th>Kệ nguồn</th>
                <th>Kệ đích</th>
                <th>Số lượng</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={idOf(line)}>
                  <td>
                    {formatVariantName(line.variantId)}
                    {line.itemIds?.length > 0 && (
                      <small className="wm-stock-subline">
                        {line.itemIds.map((item) => item.itemCode || idOf(item).slice(-6)).join(', ')}
                      </small>
                    )}
                  </td>
                  <td>{codeAndName(line.fromStorageId)}</td>
                  <td>{codeAndName(line.toStorageId)}</td>
                  <td>{line.quantity}</td>
                </tr>
              ))}
              {!lines.length && <tr><td colSpan="4">Phiếu không có dòng hàng.</td></tr>}
            </tbody>
          </table>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Đóng</Button>
      </Modal.Footer>
    </Modal>
  );
}
