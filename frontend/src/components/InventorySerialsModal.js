import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import inventoryReportService from '../services/warehouse/inventoryReportService';
import '../styles/WarehouseManager.css';

export default function InventorySerialsModal({ item, onClose }) {
  const [serials, setSerials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    inventoryReportService.getItemDetails({ locationId: item.locationId, storageId: item.storageId, variantId: item.variantId, productId: item.productId, itemLevel: item.itemLevel })
      .then((rows) => { if (active) setSerials(rows); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [item]);

  return <div className="wm-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="wm-crud-modal wm-serial-modal" role="dialog" aria-modal="true" aria-labelledby="serial-modal-title">
      <header><div><span>{item.locationCode} · {item.storagePath}</span><h2 id="serial-modal-title">{item.productName}</h2><p>{[item.productCode, item.sku, item.variantName, item.size, item.color].filter(Boolean).join(' · ')}</p></div><button type="button" className="wm-modal-close" onClick={onClose} aria-label="Đóng"><X size={20} /></button></header>
      {error && <div className="wm-error">{error}</div>}
      <div className="wm-table-wrap"><table><thead><tr><th>Biến thể</th><th>Mã hàng</th><th>Serial</th><th>Tình trạng</th><th>Trạng thái kho</th></tr></thead><tbody>
        {loading ? <tr><td colSpan={5}>Đang tải serial...</td></tr> : serials.length ? serials.map((serial) => <tr key={serial._id}><td>{[serial.variantId?.sku, serial.variantId?.variantName, serial.variantId?.size, serial.variantId?.color].filter(Boolean).join(' · ')}</td><td>{serial.itemCode}</td><td>{serial.serialNumber || 'Chưa ghi serial'}</td><td>{serial.condition}</td><td>{serial.status}</td></tr>) : <tr><td colSpan={5}>Không có mã hàng tại vị trí này.</td></tr>}
      </tbody></table></div>
      <footer className="wm-modal-footer"><button type="button" className="secondary" onClick={onClose}>Đóng</button></footer>
    </section>
  </div>;
}
