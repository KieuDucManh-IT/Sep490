import React, { useState } from 'react';
import {
  Truck,
  Clock,
  XCircle,
  Copy,
  Check,
  Printer,
  RotateCcw,
  Store,
  ExternalLink,
} from 'lucide-react';
import { SHIPMENT_STATUS_MAP, formatCurrency, formatDate } from './shippingUtils';
import { getPrintTokenApi } from '../../services/shippingApi';
import '../../styles/ShippingModal.css';

const sanitizeTimelineText = (text) => {
  if (!text) return 'Cập nhật tiến trình';
  return String(text)
    .replace(/\s*\(Cập nhật trạng thái vận chuyển qua Sandbox\)/gi, '')
    .replace(/\s*\(Sandbox\)/gi, '')
    .replace(/trên Shop ID \d+/gi, 'tại cửa hàng')
    .replace(/trên Shop \d+/gi, 'tại cửa hàng')
    .replace(/sang Shop ID \d+/gi, 'sang thông tin mới')
    .replace(/sang Shop \d+/gi, 'sang thông tin mới')
    .trim();
};

export default function ShipmentTrackingTimeline({
  shipment,
  onCancel,
  onRetry,
  isBranchManager = true,
}) {
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (!shipment) return null;

  const statusDef = SHIPMENT_STATUS_MAP[shipment.shipmentStatus] || {
    text: shipment.shipmentStatus || 'Chưa xác định',
    chipClass: 'pending',
  };

  const handleCopyCode = () => {
    const code = shipment.trackingCode;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = async () => {
    const code = shipment.trackingCode;
    if (!code) return;
    setIsPrinting(true);
    try {
      const res = await getPrintTokenApi(code);
      if (res?.success && res.data?.printUrl) {
        window.open(res.data.printUrl, '_blank');
      } else {
        alert('Không lấy được mã in phiếu từ GHN.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi mở phiếu in GHN');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCancelClick = async () => {
    const reason = window.prompt('Nhập lý do hủy vận đơn:');
    if (reason === null) return;
    if (onCancel) {
      setCancelling(true);
      try {
        await onCancel(shipment._id, reason);
      } finally {
        setCancelling(false);
      }
    }
  };

  const isPreparing = shipment.shipmentStatus === 'preparing';
  const isFailedOrCancelled = ['failed', 'cancelled'].includes(shipment.shipmentStatus);
  const isReturn = shipment.shipmentType === 'return';
  const trackingCode = shipment.trackingCode || '—';

  return (
    <div className="shipment-tracking-card border rounded-3 p-3 bg-white shadow-sm mb-3">
      {/* Header Info */}
      <div className="d-flex flex-wrap justify-content-between align-items-center pb-2 mb-2 border-bottom gap-2">
        <div className="d-flex align-items-center gap-2">
          <div className="p-2 rounded-circle bg-light text-primary">
            <Truck size={20} />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold fs-6">
                {shipment.carrierName || 'Giao Hàng Nhanh'}
              </span>
              <span className={`badge bg-${isReturn ? 'info' : 'primary'} text-white`}>
                {isReturn ? 'Thu hồi đồ thuê' : 'Giao hàng cho khách'}
              </span>
              <span className={`order-status-chip ${statusDef.chipClass}`}>
                {statusDef.text}
              </span>
            </div>
            <div className="small text-muted d-flex align-items-center gap-1 mt-1">
              <span>Mã vận đơn:</span>
              <strong className="text-dark font-monospace">{trackingCode}</strong>
              <button
                type="button"
                className="btn btn-sm btn-link p-0 text-muted ms-1"
                onClick={handleCopyCode}
                title="Sao chép mã vận đơn"
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="d-flex flex-wrap gap-2 align-items-center">
          {/* Nút In phiếu A5 */}
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1"
            onClick={handlePrint}
            disabled={isPrinting}
            title="In phiếu A5 gửi GHN"
          >
            <Printer size={14} />
            <span>{isPrinting ? 'Đang tạo...' : 'In phiếu A5'}</span>
          </button>

          {isBranchManager && isPreparing && (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
              onClick={handleCancelClick}
              disabled={cancelling}
            >
              <XCircle size={14} />
              <span>{cancelling ? 'Đang hủy...' : 'Hủy vận đơn'}</span>
            </button>
          )}

          {isBranchManager && isFailedOrCancelled && onRetry && (
            <button
              type="button"
              className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
              onClick={() => onRetry(shipment)}
            >
              <RotateCcw size={14} />
              <span>Giao lại</span>
            </button>
          )}
        </div>
      </div>

      {/* Meta Specs Grid */}
      <div className="row g-2 small text-muted mb-3 bg-light rounded-2 p-2">
        <div className="col-6 col-md-3">
          <span className="d-block text-secondary">Cước vận chuyển:</span>
          <strong className="text-dark">
            {formatCurrency(shipment.shippingFee || 0)}
          </strong>
          <span className="badge bg-light text-muted border ms-1">Shop trả</span>
        </div>
        <div className="col-6 col-md-3">
          <span className="d-block text-secondary">Thu hộ COD:</span>
          <strong className={shipment.codAmount > 0 ? 'text-danger' : 'text-success'}>
            {formatCurrency(shipment.codAmount || 0)}
          </strong>
        </div>
        <div className="col-6 col-md-3">
          <span className="d-block text-secondary">Kiện hàng:</span>
          <span className="text-dark">
            {shipment.weight || 500}g • {shipment.length || 30}x{shipment.width || 20}x{shipment.height || 10}cm
          </span>
        </div>
        <div className="col-6 col-md-3">
          <span className="d-block text-secondary">Giao dự kiến:</span>
          <span className="text-dark">
            {formatDate(shipment.expectedDeliveryTime)}
          </span>
        </div>
      </div>

      {/* Store Location Info */}
      {(() => {
        const storeInfo = isReturn ? shipment.receiverInfo : shipment.senderInfo;
        if (!storeInfo?.name && !storeInfo?.address) return null;
        const hasCoords = storeInfo.latitude && storeInfo.longitude;
        return (
          <div className="d-flex flex-wrap align-items-center justify-content-between p-2 mb-3 bg-light rounded-2 border small">
            <div className="d-flex align-items-center gap-1 text-dark">
              <Store size={14} className="text-primary flex-shrink-0" />
              <span>
                <strong>{storeInfo.name}</strong> • {storeInfo.address}
                {storeInfo.phone && <span className="text-muted ms-1">({storeInfo.phone})</span>}
              </span>
            </div>
            {hasCoords && (
              <a
                href={`https://www.google.com/maps?q=${storeInfo.latitude},${storeInfo.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-link p-0 text-primary text-decoration-none d-inline-flex align-items-center gap-1 ms-auto"
              >
                <ExternalLink size={12} /> Xem vị trí trên bản đồ
              </a>
            )}
          </div>
        );
      })()}

      {/* Status History Timeline */}
      <div className="shipment-timeline mt-2">
        <div className="small fw-bold text-uppercase text-muted mb-2 tracking-wider">
          Hành Trình Giao Nhận
        </div>

        {Array.isArray(shipment.statusHistory) && shipment.statusHistory.length > 0 ? (
          <div className="position-relative ps-3 border-start border-2 border-primary ms-2">
            {shipment.statusHistory
              .slice()
              .reverse()
              .map((item, idx) => {
                const isLatest = idx === 0;
                return (
                  <div key={item._id || `${item.status}-${item.timestamp || idx}`} className="mb-3 position-relative">
                    {/* Timeline bullet dot */}
                    <div
                      className={`position-absolute rounded-circle shipping-timeline-bullet ${
                        isLatest ? 'bg-primary' : 'bg-secondary'
                      }`}
                    />
                    <div className="d-flex align-items-center gap-2">
                      <span className={`small fw-bold ${isLatest ? 'text-primary' : 'text-dark'}`}>
                        {sanitizeTimelineText(item.description || item.status)}
                      </span>
                      {isLatest && (
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle small py-0">
                          Mới nhất
                        </span>
                      )}
                    </div>
                    <div className="text-muted shipping-timeline-timestamp">
                      <Clock size={12} className="me-1 inline" />
                      {formatDate(item.timestamp)}
                      {item.location && <span> • {item.location}</span>}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="small text-muted py-2 fst-italic">
            Chưa có lịch sử trạng thái ghi nhận từ đơn vị vận chuyển.
          </div>
        )}
      </div>
    </div>
  );
}

