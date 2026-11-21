import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import WarehouseWorkflowProgress from '../../../components/WarehouseWorkflowProgress';
import { StatusBadge } from '../../../components/warehouse';
import { ADJUSTMENT_STATUS_LABELS, formatVariantName } from '../../../constants/warehouseLabels';
import { codeAndName, idOf } from '../shared/slipHelpers';

/** Số thay đổi có dấu: "+3", "-2", "0". */
export function formatChange(value) {
  const number = Number(value || 0);
  if (number > 0) return `+${number}`;
  return String(number);
}

/** Hàng số lượng từ kiểm kê: "không khả dụng" trước → sau (sau = min(số hỏng, tồn sau)). */
function damagedLabel(line) {
  if (line.damagedQuantity == null) return '—';
  const after = Math.min(Number(line.damagedQuantity), Number(line.quantityAfter || 0));
  return `${line.unavailableBefore ?? 0} → ${after}`;
}

function AdjustmentLinesTable({ lines }) {
  return (
    <div className="wm-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mặt hàng / mã hàng</th>
            <th>Vị trí</th>
            <th>Tồn trước</th>
            <th>Thay đổi</th>
            <th>Tồn sau</th>
            <th>Không khả dụng (hỏng)</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={idOf(line._id)}>
              <td>
                {formatVariantName(line.variantId)}
                {line.itemCode && (
                  <small className="wm-stock-subline">
                    {line.itemCode}
                    {line.serialNumber ? ` · ${line.serialNumber}` : ''}
                  </small>
                )}
              </td>
              <td>{line.storageId?.code || 'Chưa gán'}</td>
              <td>{line.quantityBefore}</td>
              <td>{formatChange(line.quantityChange)}</td>
              <td>{line.quantityAfter}</td>
              <td>{damagedLabel(line)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Chi tiết phiếu điều chỉnh và các nút duyệt / từ chối / áp dụng. */
export default function AdjustmentDetailModal({ adjustment, busy, onClose, onApprove, onReject, onApply }) {
  const status = adjustment.status;
  return (
    <Modal show onHide={onClose} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title as="h5">
          {adjustment.adjustmentCode} · {codeAndName(adjustment.locationId)}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-2">
          <StatusBadge status={status} labels={ADJUSTMENT_STATUS_LABELS} /> {adjustment.reason}
        </p>
        <WarehouseWorkflowProgress flow="adjustment" status={status} />
        <AdjustmentLinesTable lines={adjustment.items || []} />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Đóng</Button>
        {status === 'requested' && (
          <>
            <Button variant="outline-danger" disabled={busy} onClick={onReject}>Từ chối</Button>
            <Button variant="dark" disabled={busy} onClick={onApprove}>Duyệt điều chỉnh</Button>
          </>
        )}
        {status === 'approved' && (
          <Button variant="dark" disabled={busy} onClick={onApply}>Áp dụng vào tồn kho</Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
