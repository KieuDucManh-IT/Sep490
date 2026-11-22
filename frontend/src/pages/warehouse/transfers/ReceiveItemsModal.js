import React from 'react';
import { Button, Modal } from 'react-bootstrap';
import WarehouseItemChecklist from '../../../components/WarehouseItemChecklist';
import { lineName } from './transferHelpers';

const without = (ids, id) => ids.filter((value) => value !== id);

/** Chi nhánh tick từng món hàng đã nhận và đánh dấu món hỏng. */
export default function ReceiveItemsModal({ line, entry, onChange, onHide }) {
  const received = entry.receivedItemIds || [];
  const damaged = entry.damagedItemIds || [];
  const shipped = Number(line.quantityShipped || 0);

  const toggleReceived = (itemId, checked) => onChange({
    ...entry,
    receivedItemIds: checked ? [...received, itemId] : without(received, itemId),
    damagedItemIds: checked ? damaged : without(damaged, itemId),
  });
  const toggleDamaged = (itemId, checked) => onChange({
    ...entry, damagedItemIds: checked ? [...damaged, itemId] : without(damaged, itemId),
  });

  const renderDamaged = (item, itemId, isReceived) => <span className="wm-receipt-damaged" onClick={(event) => event.stopPropagation()}>
    <input type="checkbox" aria-label="Đánh dấu hàng hỏng" disabled={!isReceived} checked={damaged.includes(itemId)} onChange={(event) => toggleDamaged(itemId, event.target.checked)} /> Hỏng
  </span>;

  return <Modal show onHide={onHide} centered size="lg" className="wm-transfer-stacked" backdropClassName="wm-transfer-stacked-backdrop">
    <Modal.Header closeButton>
      <div>
        <small className="text-muted">Xác nhận hàng đã nhận</small>
        <Modal.Title as="h5">{lineName(line)}</Modal.Title>
        <small>Đã nhận {received.length}/{shipped} · Hỏng {damaged.length}</small>
      </div>
    </Modal.Header>
    <Modal.Body>
      <WarehouseItemChecklist
        items={line.itemIds || []}
        selectedIds={received}
        maxSelectable={shipped}
        onToggle={toggleReceived}
        renderExtra={renderDamaged}
        emptyMessage="Phiếu chưa có món hàng nào được xuất."
      />
    </Modal.Body>
    <Modal.Footer>
      <Button variant="dark" onClick={onHide}>Xong ({received.length}/{shipped})</Button>
    </Modal.Footer>
  </Modal>;
}
