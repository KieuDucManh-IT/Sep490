import React, { useEffect, useState } from 'react';
import { Button, Modal } from 'react-bootstrap';
import inventoryReportService from '../services/warehouse/inventoryReportService';
import { HIDDEN_ITEM_STATUSES, ITEM_STATUS_LABELS, labelOf } from '../constants/warehouseLabels';
import '../styles/WarehouseManager.css';

const NO_RECEIPT_KEY = 'no-receipt';
const receiptKeyOf = (serial) => String(serial.inboundReceiptDetail?._id || NO_RECEIPT_KEY);

/** Bộ lọc trạng thái: mặc định chỉ món đang trong kho; các trạng thái đã rời kho xem riêng (TASK-016 C4). */
const STATUS_FILTERS = [
  { value: '', label: 'Đang trong kho' },
  ...HIDDEN_ITEM_STATUSES.map((status) => ({ value: status, label: ITEM_STATUS_LABELS[status] })),
];

function loadDetails(item, statuses) {
  if (item.branchId) {
    return inventoryReportService.getBranchItemDetails({
      branchId: item.branchId, storageId: item.storageId, variantId: item.variantId, productId: item.productId, itemLevel: item.itemLevel, statuses,
    });
  }
  return inventoryReportService.getItemDetails({
    locationId: item.locationId, storageId: item.storageId, variantId: item.variantId, productId: item.productId, itemLevel: item.itemLevel, statuses,
  });
}

/** Gom các món hàng theo dòng phiếu nhập đã nhập chúng vào kho. */
function groupByReceipt(serials) {
  return Object.values(serials.reduce((grouped, serial) => {
    const key = receiptKeyOf(serial);
    if (!grouped[key]) grouped[key] = { key, detail: serial.inboundReceiptDetail, items: [] };
    grouped[key].items.push(serial);
    return grouped;
  }, {}));
}

function ReceiptGroup({ group, isOpen, onToggle, onItemClick }) {
  const { detail, items } = group;
  const receipt = detail?.receiptId;
  const receivedAt = receipt?.receivedAt || receipt?.createdAt || detail?.createdAt;
  const supplierCode = receipt?.supplierId?.supplierCode ? `${receipt.supplierId.supplierCode} — ` : '';
  return (
    <section className="wm-inventory-receipt-group">
      <button type="button" className="wm-inventory-receipt-heading" onClick={onToggle} aria-expanded={isOpen}>
        <span>
          <strong>{detail?.receiptDetailCode || 'Không có mã dòng phiếu nhập'}</strong>
          <small>{receipt?.receiptCode || 'Không rõ phiếu nhập'} · {supplierCode}{receipt?.supplierId?.name || 'Không rõ nhà cung cấp'}</small>
        </span>
        <span>
          <strong>{Number(detail?.unitCost || 0).toLocaleString('vi-VN')} ₫ / cái</strong>
          <small>Ngày nhập: {receivedAt ? new Date(receivedAt).toLocaleDateString('vi-VN') : '—'} · {items.length} món hàng</small>
        </span>
        <span className="wm-inventory-receipt-toggle">{isOpen ? 'Thu gọn' : 'Xem hàng'}</span>
      </button>
      {isOpen && (
        <div className="wm-table-wrap">
          <table>
            <thead>
              <tr><th>Biến thể</th><th>Mã hàng</th><th>Serial</th><th>Trạng thái</th></tr>
            </thead>
            <tbody>
              {items.map((serial) => (
                <tr key={serial._id}>
                  <td>{[serial.variantId?.sku, serial.variantId?.size, serial.variantId?.color].filter(Boolean).join(' · ')}</td>
                  <td>
                    {onItemClick ? (
                      <button type="button" className="wm-text-button" onClick={() => onItemClick(serial)}>{serial.itemCode}</button>
                    ) : serial.itemCode}
                  </td>
                  <td>{serial.serialNumber || 'Chưa ghi serial'}</td>
                  <td>
                    {labelOf(ITEM_STATUS_LABELS, serial.status, serial.status)}
                    {serial.soldOrder?.orderCode && <small className="d-block text-muted">Đơn bán {serial.soldOrder.orderCode}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/**
 * Danh sách món hàng (mã hàng / serial) tại một dòng báo cáo tồn, gom theo dòng phiếu nhập.
 * Dùng chung cho báo cáo tồn kho tổng và tồn chi nhánh (`item.branchId`).
 * `onItemClick` (tùy chọn): mã hàng thành nút để mở chi tiết / lịch sử mã hàng.
 */
export default function InventorySerialsModal({ item, onClose, onItemClick }) {
  const [serials, setSerials] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    loadDetails(item, statusFilter)
      .then((rows) => {
        if (!active) return;
        setSerials(rows);
        setExpanded(Object.fromEntries(rows.map((row) => [receiptKeyOf(row), true])));
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [item, statusFilter]);

  const groups = groupByReceipt(serials);
  const toggleGroup = (key) => setExpanded((value) => ({ ...value, [key]: !value[key] }));

  return (
    <Modal show onHide={onClose} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <div>
          <small className="text-muted">{item.locationCode} · {item.storagePath}</small>
          <Modal.Title as="h5">{item.productName}</Modal.Title>
          <small className="text-muted">{[item.productCode, item.sku, item.size, item.color].filter(Boolean).join(' · ')}</small>
        </div>
      </Modal.Header>
      <Modal.Body>
        <div className="d-flex justify-content-end mb-2">
          <select aria-label="Lọc theo trạng thái món" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            {STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        {error && <div className="wm-error">{error}</div>}
        {loading && <div className="wm-tree-empty">Đang tải các món hàng...</div>}
        {!loading && groups.length > 0 && (
          <div className="wm-inventory-receipt-groups">
            {groups.map((group) => (
              <ReceiptGroup key={group.key} group={group} isOpen={expanded[group.key] ?? false}
                onToggle={() => toggleGroup(group.key)} onItemClick={onItemClick} />
            ))}
          </div>
        )}
        {!loading && !groups.length && <div className="wm-tree-empty">Không có món hàng tại vị trí này.</div>}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose}>Đóng</Button>
      </Modal.Footer>
    </Modal>
  );
}
