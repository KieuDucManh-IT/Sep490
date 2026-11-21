import React, { useState } from 'react';
import { Modal } from 'react-bootstrap';
import WarehouseWorkflowProgress from '../../../components/WarehouseWorkflowProgress';
import { WarehouseCancelledNote } from '../../../components/WarehouseCancelSlipModal';
import InboundCreateForm from './InboundCreateForm';
import InboundDetailView from './InboundDetailView';
import InboundPutawayForm from './InboundPutawayForm';
import InboundReceiveForm from './InboundReceiveForm';

function modalTitle(mode, receipt) {
  if (mode === 'create') return 'Tạo phiếu nhập từ nhà cung cấp';
  if (mode === 'receive') return 'Ghi nhận hàng thực nhận';
  if (mode === 'putaway') return 'Xếp hàng lên kệ';
  return receipt?.receiptCode || 'Chi tiết phiếu nhập';
}

/**
 * Hộp thoại quy trình nhập kho. Một modal, bốn chế độ:
 * `create` (chủ kho tạo phiếu), `view` (xem + nút theo vai trò), `receive` và `putaway` (nhân viên kho).
 * `receipt` phải là phiếu đầy đủ chi tiết (GET /:id), không phải dòng trong danh sách.
 */
export default function InboundReceiptModal({
  mode, role, receipt, centralLocation, suppliers, staff, shelves, hidden, error,
  onClose, onCreate, onReceive, onApprove, onRecount, onPutaway, onCancel,
}) {
  const [activeMode, setActiveMode] = useState(mode);
  const showProgress = receipt && activeMode !== 'create';
  const backToView = () => setActiveMode('view');

  return (
    <Modal show={!hidden} onHide={onClose} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <div>
          <small className="wh-page-eyebrow">QUY TRÌNH NHẬP KHO</small>
          <Modal.Title as="h5">{modalTitle(activeMode, receipt)}</Modal.Title>
        </div>
      </Modal.Header>
      {showProgress && (
        <div className="px-3 pt-3">
          <WarehouseWorkflowProgress flow="inbound" status={receipt.status} />
          <WarehouseCancelledNote slip={receipt} />
          {error && activeMode === 'view' && <div className="wm-error">{error}</div>}
        </div>
      )}
      {activeMode === 'create' && (
        <InboundCreateForm
          centralLocation={centralLocation}
          suppliers={suppliers}
          staff={staff}
          onCreate={onCreate}
          onClose={onClose}
        />
      )}
      {activeMode === 'view' && receipt && (
        <InboundDetailView
          receipt={receipt}
          role={role}
          onClose={onClose}
          onCancel={onCancel}
          onApprove={onApprove}
          onRecount={onRecount}
          onSwitchMode={setActiveMode}
        />
      )}
      {activeMode === 'receive' && receipt && (
        <InboundReceiveForm receipt={receipt} onReceive={onReceive} onBack={backToView} onDone={onClose} />
      )}
      {activeMode === 'putaway' && receipt && (
        <InboundPutawayForm receipt={receipt} shelves={shelves} onPutaway={onPutaway} onBack={backToView} onDone={onClose} />
      )}
    </Modal>
  );
}
