import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import WarehouseWorkflowProgress from '../../../components/WarehouseWorkflowProgress';
import { StatusBadge } from '../../../components/warehouse';
import {
  ADJUSTMENT_ACTION_LABELS, ADJUSTMENT_STATUS_LABELS, ITEM_STATUS_LABELS, formatVariantName, labelOf,
} from '../../../constants/warehouseLabels';
import { codeAndName, idOf } from '../shared/slipHelpers';

/** Số thay đổi có dấu: "+3", "-2", "0". */
export function formatChange(value) {
  const number = Number(value || 0);
  if (number > 0) return `+${number}`;
  return String(number);
}

/** Trạng thái món ghi theo dòng điều chỉnh (TASK-016: bỏ tình trạng; phiếu cũ chỉ còn để xem). */
const statusLabel = (line) => (line.itemStatus ? labelOf(ITEM_STATUS_LABELS, line.itemStatus, line.itemStatus) : '—');

/** Loại dòng; dòng cũ không có `action`: −1 = mất, +1 = món mới. */
const actionOf = (line) => line.action || (Number(line.quantityChange) < 0 ? 'lost' : 'create');

/** Vị trí: dòng chuyển kệ / cần xử lý đổi kệ hiện "kệ cũ → kệ mới". */
function placeOf(line) {
  const from = line.storageId?.code || 'Chưa gán';
  const to = line.toStorageId?.code;
  return to && idOf(line.toStorageId) !== idOf(line.storageId) ? `${from} → ${to}` : from;
}

function AdjustmentLinesTable({ lines }) {
  return (
    <div className="wm-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mặt hàng / mã hàng</th>
            <th>Loại</th>
            <th>Vị trí</th>
            <th>Tồn trước</th>
            <th>Thay đổi</th>
            <th>Tồn sau</th>
            <th>Trạng thái món</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={idOf(line._id)}>
              <td>
                {formatVariantName(line.variantId)}
                <small className="wm-stock-subline">
                  {line.itemCode || (line.quantityChange > 0 ? 'Món mới (mã tự sinh khi áp dụng)' : '—')}
                  {line.serialNumber ? ` · ${line.serialNumber}` : ''}
                </small>
              </td>
              <td>{labelOf(ADJUSTMENT_ACTION_LABELS, actionOf(line), actionOf(line))}{line.reason && <small className="wm-stock-subline">{line.reason}</small>}</td>
              <td>{placeOf(line)}</td>
              <td>{line.quantityBefore}</td>
              <td>{formatChange(line.quantityChange)}</td>
              <td>{line.quantityAfter}</td>
              <td>{statusLabel(line)}</td>
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
