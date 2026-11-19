import React from 'react';
import { Alert, Modal } from 'react-bootstrap';
import { PackageCheck } from 'lucide-react';
import WarehouseWorkflowProgress from '../../../components/WarehouseWorkflowProgress';
import { WarehouseCancelledNote } from '../../../components/WarehouseCancelSlipModal';
import { TRANSFER_STATUS_LABELS, labelOf } from '../../../constants/warehouseLabels';
import stockTransferService from '../../../services/warehouse/stockTransferService';
import TransferLinesTable from './TransferLinesTable';
import ApprovePanel from './ApprovePanel';
import PickPanel from './PickPanel';
import ReceivePanel from './ReceivePanel';
import { locationName } from './transferHelpers';

const RECEIVING_STATUSES = ['shipped', 'partially_received'];

/** Panel nhập liệu ứng với vai trò + trạng thái phiếu; null = chỉ xem. */
function panelFor(mode, status) {
  if (mode === 'warehouse' && status === 'requested') return 'approve';
  if (mode === 'staff' && status === 'approved') return 'pick';
  if (mode === 'branch' && RECEIVING_STATUSES.includes(status)) return 'receive';
  return null;
}

function guidanceFor(mode, status) {
  if (mode === 'warehouse' && status === 'requested') return 'Kiểm tra số lượng khả dụng, chọn nhân viên phụ trách rồi duyệt phiếu.';
  if (mode === 'staff' && status === 'approved') return 'Chọn vị trí lấy hàng và tick đúng món hàng nếu sản phẩm theo dõi từng món.';
  if (mode === 'staff' && status === 'preparing') return 'Rà soát phân bổ trước khi xác nhận xuất hàng khỏi kho tổng.';
  if (mode === 'branch' && RECEIVING_STATUSES.includes(status)) return 'Chi nhánh kiểm đếm số thực nhận, đánh dấu món hỏng nếu có, rồi xác nhận.';
  return '';
}

function canCancel(mode, status) {
  if (mode === 'warehouse') return ['requested', 'approved', 'preparing'].includes(status);
  return mode === 'branch' && status === 'requested';
}

/** Chi tiết một phiếu điều chuyển kèm panel thao tác theo vai trò. */
export default function TransferDetailModal({ mode, transfer, staff, storages, busy, error, notice, onAction, onError, onCancel, onHide }) {
  const { status } = transfer;
  const panel = panelFor(mode, status);
  const guidance = guidanceFor(mode, status);
  const cancelButton = canCancel(mode, status)
    ? <button type="button" className="danger" disabled={busy} onClick={onCancel}>Hủy phiếu</button>
    : null;
  // Panel mount lại khi phiếu được tải lại để lấy số liệu mới nhất từ server.
  const panelKey = `${transfer._id}:${status}:${transfer.updatedAt || ''}`;
  const panelProps = { transfer, busy, onAction, onError, cancelButton };

  return <Modal show onHide={onHide} size="xl" centered scrollable dialogClassName="wm-transfer-modal">
    <Modal.Header closeButton>
      <div className="wm-stock-detail-heading mb-0">
        <div>
          <small>{transfer.transferCode} · {labelOf(TRANSFER_STATUS_LABELS, status, status)}</small>
          <Modal.Title as="h2">{locationName(transfer.toLocationId)}</Modal.Title>
          <p>Kho xuất: {locationName(transfer.fromLocationId)} · Người tạo: {transfer.createdBy?.FullName || '—'}</p>
        </div>
      </div>
    </Modal.Header>
    <Modal.Body className="wm-stock-detail">
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      {notice && <Alert variant="success" className="py-2">{notice}</Alert>}
      <WarehouseWorkflowProgress flow="transfer" status={status} />
      <WarehouseCancelledNote slip={transfer} />
      {guidance && <div className="wm-action-guidance"><PackageCheck size={17} /><div><strong>Bước tiếp theo</strong>{guidance}</div></div>}
      {panel === 'approve' && <ApprovePanel key={panelKey} {...panelProps} staff={staff} />}
      {panel === 'pick' && <PickPanel key={panelKey} {...panelProps} storages={storages} />}
      {panel === 'receive' && <ReceivePanel key={panelKey} {...panelProps} />}
      {!panel && <>
        <TransferLinesTable transfer={transfer} />
        <div className="wm-stock-actions">
          {cancelButton}
          {mode === 'staff' && status === 'preparing' && <button type="button" disabled={busy}
            onClick={() => onAction(() => stockTransferService.ship(transfer._id), 'Đã xác nhận xuất hàng khỏi kho tổng.')}>Xác nhận xuất kho</button>}
        </div>
      </>}
    </Modal.Body>
  </Modal>;
}
