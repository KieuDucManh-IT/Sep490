import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import WarehouseItemChecklist from '../../../components/WarehouseItemChecklist';
import { lineName } from './transferHelpers';

/** Nhân viên kho tick các món hàng sẽ xuất từ một vị trí lấy hàng. */
export default function PickItemsModal({ line, allocation, candidates, onToggle, onHide }) {
  const target = Number(allocation.quantity);
  const chosen = allocation.itemIds || [];
  return <Modal show onHide={onHide} centered size="lg" className="wm-transfer-stacked" backdropClassName="wm-transfer-stacked-backdrop">
    <Modal.Header closeButton>
      <div>
        <small className="text-muted">Chọn món hàng để xuất</small>
        <Modal.Title as="h5">{lineName(line)}</Modal.Title>
        <small>Đã chọn {chosen.length}/{allocation.quantity}</small>
      </div>
    </Modal.Header>
    <Modal.Body>
      <WarehouseItemChecklist
        items={Array.isArray(candidates) ? candidates : []}
        selectedIds={chosen}
        maxSelectable={target}
        onToggle={onToggle}
        emptyMessage="Không có món hàng sẵn sàng ở vị trí đã chọn."
      />
    </Modal.Body>
    <Modal.Footer>
      <Button variant="dark" onClick={onHide}>Xong ({chosen.length}/{allocation.quantity})</Button>
    </Modal.Footer>
  </Modal>;
}
