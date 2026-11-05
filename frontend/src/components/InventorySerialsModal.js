import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import inventoryReportService from '../services/warehouse/inventoryReportService';
import '../styles/WarehouseManager.css';

export default function InventorySerialsModal({ item, onClose }) {
  const [serials, setSerials] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    (item.branchId
      ? inventoryReportService.getBranchItemDetails({ branchId: item.branchId, storageId: item.storageId, variantId: item.variantId, productId: item.productId, itemLevel: item.itemLevel })
      : inventoryReportService.getItemDetails({ locationId: item.locationId, storageId: item.storageId, variantId: item.variantId, productId: item.productId, itemLevel: item.itemLevel }))
      .then((rows) => { if (active) { setSerials(rows); setExpanded(Object.fromEntries(rows.map((row) => [String(row.inboundReceiptDetail?._id || 'no-receipt'), true]))); } })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [item]);

  const groups = Object.values(serials.reduce((grouped, serial) => {
    const key = String(serial.inboundReceiptDetail?._id || 'no-receipt');
    if (!grouped[key]) grouped[key] = { key, detail: serial.inboundReceiptDetail, items: [] };
    grouped[key].items.push(serial);
    return grouped;
  }, {}));
  const toggleGroup = (key) => setExpanded((value) => ({ ...value, [key]: !value[key] }));

  return <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="wm-crud-modal wm-serial-modal" role="dialog" aria-modal="true" aria-labelledby="serial-modal-title">
      <header><div><span>{item.locationCode} · {item.storagePath}</span><h2 id="serial-modal-title">{item.productName}</h2><p>{[item.productCode, item.sku, item.size, item.color].filter(Boolean).join(' · ')}</p></div><button type="button" className="wm-modal-close" onClick={onClose} aria-label="Đóng"><X size={20} /></button></header>
      {error && <div className="wm-error">{error}</div>}
      {loading ? <div className="wm-tree-empty">Đang tải InventoryItem...</div> : groups.length ? <div className="wm-inventory-receipt-groups">{groups.map(({ key, detail, items }) => {
        const receipt = detail?.receiptId;
        const isOpen = expanded[key] ?? false;
        const receivedAt = receipt?.receivedAt || receipt?.createdAt || detail?.createdAt;
        return <section className="wm-inventory-receipt-group" key={key}>
          <button type="button" className="wm-inventory-receipt-heading" onClick={() => toggleGroup(key)} aria-expanded={isOpen}>
            <span><strong>{detail?.receiptDetailCode || 'Không có mã dòng phiếu nhập'}</strong><small>{receipt?.receiptCode || 'Không rõ phiếu nhập'} · {receipt?.supplierId?.supplierCode ? `${receipt.supplierId.supplierCode} — ` : ''}{receipt?.supplierId?.name || 'Không rõ nhà cung cấp'}</small></span>
            <span><strong>{Number(detail?.unitCost || 0).toLocaleString('vi-VN')} ₫ / cái</strong><small>Ngày nhập: {receivedAt ? new Date(receivedAt).toLocaleDateString('vi-VN') : '—'} · {items.length} InventoryItem</small></span>
            <span className="wm-inventory-receipt-toggle">{isOpen ? 'Thu gọn' : 'Xem hàng'}</span>
          </button>
          {isOpen && <div className="wm-table-wrap"><table><thead><tr><th>Biến thể</th><th>Mã hàng</th><th>Serial</th><th>Condition</th><th>Trạng thái</th></tr></thead><tbody>{items.map((serial) => <tr key={serial._id}><td>{[serial.variantId?.sku, serial.variantId?.size, serial.variantId?.color].filter(Boolean).join(' · ')}</td><td>{serial.itemCode}</td><td>{serial.serialNumber || 'Chưa ghi serial'}</td><td>{serial.condition}</td><td>{serial.status}</td></tr>)}</tbody></table></div>}
        </section>;
      })}</div> : <div className="wm-tree-empty">Không có InventoryItem tại vị trí này.</div>}
      <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={onClose}>Đóng</button></footer>
    </section>
  </div>;
}
