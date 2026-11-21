import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import { AlertTriangle } from 'lucide-react';
import { StockDiscrepancyDetailBody, discrepancyVariantLabel } from '../../../components/StockDiscrepancyDetail';
import { StatusBadge } from '../../../components/warehouse';
import {
  DISCREPANCY_STATUS_CLASS, DISCREPANCY_STATUS_LABELS, TRANSFER_DIRECTION_LABELS, labelOf,
} from '../../../constants/warehouseLabels';
import { codeAndName } from '../shared/slipHelpers';
import { remainingQuantity } from './discrepancyHelpers';

/** Chi tiết phiếu chênh lệch (chỉ đọc) kèm nút mở form kết luận khi phiếu chưa xử lý xong. */
export default function DiscrepancyDetailModal({ discrepancy, onClose, onResolve }) {
  const unresolved = discrepancy.status !== 'resolved';
  const direction = labelOf(TRANSFER_DIRECTION_LABELS, discrepancy.direction, discrepancy.direction);
  return (
    <Modal show onHide={onClose} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h5">
          {discrepancy.discrepancyCode} · {discrepancyVariantLabel(discrepancy) || 'Phiếu chênh lệch'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-3">
          <StatusBadge status={discrepancy.status} labels={DISCREPANCY_STATUS_LABELS} classMap={DISCREPANCY_STATUS_CLASS} />
          {' '}{direction} · {codeAndName(discrepancy.fromLocationId)} → {codeAndName(discrepancy.toLocationId)}
        </p>
        {unresolved && (
          <div className="wm-action-guidance">
            <AlertTriangle size={17} />
            <div>
              <strong>Còn {remainingQuantity(discrepancy)} đang điều tra</strong>
              Có thể kết luận nhiều lần, mỗi lần cho một phần số lượng hoặc một số món.
            </div>
          </div>
        )}
        <StockDiscrepancyDetailBody discrepancy={discrepancy} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Đóng</Button>
        {unresolved && <Button variant="dark" onClick={onResolve}>Kết luận</Button>}
      </Modal.Footer>
    </Modal>
  );
}
