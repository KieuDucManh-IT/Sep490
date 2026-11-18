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
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  RefreshCw,
  Camera,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  SHIPMENT_STATUS_MAP,
  formatCurrency,
  formatDate,
  sanitizeTimelineText,
} from './shippingUtils';
import {
  getPrintTokenApi,
  updateManualShipmentStatusApi,
  simulateGhnApi,
  uploadShipmentProofApi,
} from '../../services/shippingApi';
import '../../styles/ShippingModal.css';

export default function ShipmentTrackingTimeline({
  shipment,
  onCancel,
  onRetry,
  onStatusUpdated,
  isBranchManager = true,
  isLatest = true,
}) {
  const [copied, setCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulateFeedback, setSimulateFeedback] = useState(null);
  const [activeAction, setActiveAction] = useState(null); // null | 'delivered' | 'failed'
  const [proofFile, setProofFile] = useState(null);
  const [proofPreview, setProofPreview] = useState('');
  const [failReasonInput, setFailReasonInput] = useState('');
  const [selectedImageModal, setSelectedImageModal] = useState(null);

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

  const handleManualStatusChange = async (newStatus) => {
    let confirmMsg = '';
    if (newStatus === 'shipped') {
      confirmMsg = 'Xác nhận kiện hàng đã được bàn giao cho bưu tá GHN bắt đầu đi giao?';
    } else if (newStatus === 'delivered') {
      confirmMsg = 'Xác nhận khách hàng đã thực nhận hàng? Hành động này sẽ kích hoạt chu kỳ đơn hàng.';
    } else if (newStatus === 'failed') {
      const reason = window.prompt('Nhập lý do giao hàng thất bại (ví dụ: Khách hẹn lại ngày giao):');
      if (reason === null) return;
      return executeManualUpdate(newStatus, reason);
    }

    if (confirmMsg && !window.confirm(confirmMsg)) return;
    return executeManualUpdate(newStatus);
  };

  const executeManualUpdate = async (newStatus, reason = '') => {
    setUpdatingStatus(true);
    try {
      const res = await updateManualShipmentStatusApi(shipment._id, { newStatus, reason });
      if (res?.success) {
        if (onStatusUpdated) onStatusUpdated();
      } else {
        alert(res?.message || 'Không thể cập nhật trạng thái');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Lỗi khi cập nhật trạng thái');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleProofFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    const reader = new FileReader();
    reader.onload = () => setProofPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveProofFile = () => {
    setProofFile(null);
    setProofPreview('');
  };

  const handleSimulateDirect = async (ghnStatus, customPayload = {}) => {
    if (!shipment.trackingCode) {
      alert('Vận đơn chưa có trackingCode');
      return;
    }
    setSimulating(true);
    setSimulateFeedback(null);
    try {
      const res = await simulateGhnApi({
        trackingCode: shipment.trackingCode,
        ghnStatus,
        ...customPayload,
      });
      if (res?.success) {
        setSimulateFeedback({
          type: 'success',
          text: `Đã cập nhật trạng thái vận đơn sang [${ghnStatus}]`,
        });
        setActiveAction(null);
        setProofFile(null);
        setProofPreview('');
        setFailReasonInput('');
        if (onStatusUpdated) {
          await onStatusUpdated();
        }
        setTimeout(() => setSimulateFeedback(null), 4000);
      } else {
        const errMsg = res?.data?.message || res?.message || 'Mô phỏng thất bại';
        setSimulateFeedback({ type: 'error', text: errMsg });
        alert(errMsg);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Lỗi mô phỏng GHN';
      setSimulateFeedback({ type: 'error', text: errMsg });
      alert(errMsg);
    } finally {
      setSimulating(false);
    }
  };

  const handleConfirmDelivered = async () => {
    if (!proofFile && !proofPreview) {
      alert('Vui lòng chọn ảnh chụp khi giao hàng thành công (Bắt buộc).');
      return;
    }
    let uploadedUrl = proofPreview || null;
    if (proofFile) {
      try {
        const uploadRes = await uploadShipmentProofApi(proofFile);
        if (uploadRes?.imageUrl) uploadedUrl = uploadRes.imageUrl;
      } catch {
        // Fallback sang base64 preview nếu dịch vụ upload gặp sự cố
      }
    }

    if (!uploadedUrl) {
      alert('Vui lòng chọn ảnh chụp khi giao hàng thành công (Bắt buộc).');
      return;
    }

    await handleSimulateDirect('delivered', {
      evidenceImage: uploadedUrl,
      reason: 'Giao hàng thành công (Có ảnh xác nhận)',
    });
  };

  const handleConfirmFailed = async () => {
    const reasonText = failReasonInput.trim();
    if (!reasonText) {
      alert('Vui lòng nhập lý do chưa giao được hàng');
      return;
    }
    await handleSimulateDirect('delivery_fail', {
      failReason: reasonText,
      reason: `Chưa giao được hàng: ${reasonText}`,
    });
  };

  const isPreparing = shipment.shipmentStatus === 'preparing';
  const isShipped = shipment.shipmentStatus === 'shipped';
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


          {isBranchManager && isLatest && !isReturn && isShipped && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-success d-flex align-items-center gap-1"
                onClick={() => handleManualStatusChange('delivered')}
                disabled={updatingStatus}
                title="Xác nhận khách hàng đã nhận hàng"
              >
                <Check size={14} />
                <span>{updatingStatus ? 'Đang lưu...' : 'Khách đã nhận'}</span>
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-warning d-flex align-items-center gap-1"
                onClick={() => handleManualStatusChange('failed')}
                disabled={updatingStatus}
                title="Báo cáo giao hàng thất bại"
              >
                <XCircle size={14} />
                <span>Báo giao thất bại</span>
              </button>
            </>
          )}

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

      {/* Hiển thị Bằng Chứng Giao Hàng Thành Công nếu có */}
      {shipment.deliveryProofImage && (
        <div
          className="d-flex align-items-center justify-content-between p-2 px-3 rounded-2 mb-3"
          style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}
        >
          <div className="d-flex align-items-center gap-2">
            <img
              src={shipment.deliveryProofImage}
              alt="Ảnh xác nhận nhận hàng"
              className="rounded border"
              style={{ width: '44px', height: '44px', objectFit: 'cover', cursor: 'pointer' }}
              onClick={() => setSelectedImageModal(shipment.deliveryProofImage)}
              title="Bấm để xem ảnh phóng to"
            />
            <div>
              <div className="fw-bold text-success d-flex align-items-center gap-1" style={{ fontSize: '12.5px' }}>
                <CheckCircle2 size={14} /> Đã có ảnh chụp xác nhận khi giao hàng
              </div>
              <div className="text-muted" style={{ fontSize: '11.5px' }}>
                Đơn hàng đã được giao và chụp ảnh xác nhận thành công
              </div>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-success py-1 px-2 d-flex align-items-center gap-1"
            style={{ fontSize: '12px' }}
            onClick={() => setSelectedImageModal(shipment.deliveryProofImage)}
          >
            <Camera size={13} />
            <span>Xem ảnh</span>
          </button>
        </div>
      )}

      {/* Hiển thị Lý Do Giao Thất Bại nếu có */}
      {shipment.failureReason && (
        <div
          className="d-flex align-items-center gap-2 p-2 px-3 rounded-2 mb-3 text-danger"
          style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', fontSize: '12.5px' }}
        >
          <AlertTriangle size={16} />
          <div>
            <strong>Lý do chưa giao được hàng:</strong> {shipment.failureReason}
          </div>
        </div>
      )}

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

                    {/* Hiển thị ảnh chụp trong bước tiến trình nếu có */}
                    {item.evidenceImage && (
                      <div className="mt-2 d-flex align-items-center gap-2">
                        <img
                          src={item.evidenceImage}
                          alt="Ảnh chụp xác nhận khi giao hàng"
                          className="rounded border"
                          style={{ width: '48px', height: '48px', objectFit: 'cover', cursor: 'pointer' }}
                          onClick={() => setSelectedImageModal(item.evidenceImage)}
                          title="Bấm để xem ảnh phóng to"
                        />
                        <div className="small">
                          <span className="fw-semibold text-success d-block" style={{ fontSize: '11.5px' }}>
                            ✓ Ảnh chụp khi giao hàng
                          </span>
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-0 text-primary text-decoration-none"
                            style={{ fontSize: '11px' }}
                            onClick={() => setSelectedImageModal(item.evidenceImage)}
                          >
                            Phóng to ảnh
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Hiển thị lý do thất bại nếu có */}
                    {item.failReason && (
                      <div
                        className="mt-1 py-1 px-2 rounded small text-danger d-inline-block"
                        style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', fontSize: '11.5px' }}
                      >
                        Lý do chưa giao được: <strong>{item.failReason}</strong>
                      </div>
                    )}
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

      {/* Dev Mode Sandbox Simulation */}
      {isBranchManager && isLatest && process.env.NODE_ENV !== 'production' && (
        <div className="mt-3 pt-3 border-top" style={{ borderColor: '#f1f5f9' }}>
          <div
            role="button"
            tabIndex={0}
            className="d-flex align-items-center justify-content-between p-2 px-3 rounded-2"
            style={{
              backgroundColor: '#f8fafc',
              border: '1px dashed #cbd5e1',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'background-color 0.15s ease',
            }}
            onClick={() => setShowSimulator((prev) => !prev)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setShowSimulator((prev) => !prev);
              }
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <div
                className="d-flex align-items-center justify-content-center rounded-2"
                style={{
                  width: '24px',
                  height: '24px',
                  backgroundColor: '#e2e8f0',
                  color: '#475569',
                }}
              >
                <SlidersHorizontal size={13} />
              </div>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#334155' }}>
                Mô phỏng trạng thái giao hàng
              </span>
              <span
                className="badge rounded-pill"
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  backgroundColor: '#e0e7ff',
                  color: '#4338ca',
                  padding: '2px 8px',
                }}
              >
                Thử nghiệm
              </span>
            </div>
            <div className="d-flex align-items-center gap-1 text-muted" style={{ fontSize: '12px' }}>
              <span>{showSimulator ? 'Thu gọn' : 'Mở công cụ'}</span>
              {showSimulator ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </div>

          {showSimulator && (
            <div
              className="mt-2 p-3 rounded-2"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                <span className="text-secondary fw-semibold" style={{ fontSize: '12.5px' }}>
                  Chọn trạng thái mô phỏng:
                </span>
                <span className="font-monospace text-muted" style={{ fontSize: '11.5px' }}>
                  Vận đơn: {trackingCode}
                </span>
              </div>

              {/* Dàn ngang các nút bấm trạng thái: Chỉ viết text thuần túy trong nút */}
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary py-1 px-3"
                  style={{ fontSize: '12.5px', borderRadius: '6px' }}
                  onClick={() => {
                    setActiveAction(null);
                    handleSimulateDirect('picking', { reason: 'Bưu tá tiếp nhận kiện hàng' });
                  }}
                  disabled={simulating}
                >
                  Đang lấy hàng
                </button>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary py-1 px-3"
                  style={{ fontSize: '12.5px', borderRadius: '6px' }}
                  onClick={() => {
                    setActiveAction(null);
                    handleSimulateDirect('delivering', { reason: 'Shipper đang đi giao hàng' });
                  }}
                  disabled={simulating}
                >
                  Đang giao hàng
                </button>

                <button
                  type="button"
                  className={`btn btn-sm py-1 px-3 ${
                    activeAction === 'delivered' ? 'btn-success text-white' : 'btn-outline-success'
                  }`}
                  style={{ fontSize: '12.5px', borderRadius: '6px', fontWeight: 600 }}
                  onClick={() => setActiveAction((prev) => (prev === 'delivered' ? null : 'delivered'))}
                  disabled={simulating}
                >
                  Giao thành công
                </button>

                <button
                  type="button"
                  className={`btn btn-sm py-1 px-3 ${
                    activeAction === 'failed' ? 'btn-warning text-dark' : 'btn-outline-warning'
                  }`}
                  style={{ fontSize: '12.5px', borderRadius: '6px', fontWeight: 600 }}
                  onClick={() => setActiveAction((prev) => (prev === 'failed' ? null : 'failed'))}
                  disabled={simulating}
                >
                  Giao thất bại
                </button>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger py-1 px-3"
                  style={{ fontSize: '12.5px', borderRadius: '6px' }}
                  onClick={() => {
                    if (window.confirm('Xác nhận hủy vận đơn này?')) {
                      setActiveAction(null);
                      handleSimulateDirect('cancel', { reason: 'Hủy vận đơn' });
                    }
                  }}
                  disabled={simulating}
                >
                  Hủy vận đơn
                </button>
              </div>

              {/* KHỐI 1: Tải ảnh bằng chứng khi giao hàng thành công (Bắt buộc) */}
              {activeAction === 'delivered' && (
                <div
                  className="mt-3 p-3 rounded-2"
                  style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <Camera size={16} className="text-success" />
                      <strong style={{ fontSize: '13px', color: '#166534' }}>
                        Tải ảnh chụp khi giao hàng thành công <span className="text-danger">* (Bắt buộc)</span>
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="btn-close btn-close-sm"
                      onClick={() => setActiveAction(null)}
                    />
                  </div>

                  <p className="text-muted small mb-2" style={{ fontSize: '12px' }}>
                    Chụp hoặc tải ảnh kiện hàng khi giao cho người nhận làm bằng chứng xác nhận. Khách hàng và cửa hàng đều có thể xem ảnh này.
                  </p>

                  <div className="d-flex flex-wrap align-items-center gap-3">
                    <div className="d-flex align-items-center gap-2">
                      <input
                        type="file"
                        id="proof-image-file"
                        accept="image/*"
                        className="d-none"
                        onChange={handleProofFileChange}
                        disabled={simulating}
                      />
                      <label
                        htmlFor="proof-image-file"
                        className="btn btn-sm btn-outline-success d-flex align-items-center gap-1 py-1 px-3"
                        style={{ cursor: 'pointer', fontSize: '12.5px' }}
                      >
                        <UploadCloud size={14} />
                        <span>{proofFile ? 'Đổi ảnh khác' : 'Chọn ảnh chụp khi giao hàng *'}</span>
                      </label>

                      {proofPreview ? (
                        <div className="position-relative">
                          <img
                            src={proofPreview}
                            alt="Preview"
                            className="rounded border"
                            style={{ width: '48px', height: '48px', objectFit: 'cover', cursor: 'pointer' }}
                            onClick={() => setSelectedImageModal(proofPreview)}
                          />
                          <button
                            type="button"
                            className="btn btn-sm btn-danger position-absolute top-0 end-0 p-0 rounded-circle d-flex align-items-center justify-content-center"
                            style={{ width: '16px', height: '16px', transform: 'translate(30%, -30%)' }}
                            onClick={handleRemoveProofFile}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <span className="text-danger small fst-italic" style={{ fontSize: '11.5px' }}>
                          * Chưa chọn ảnh
                        </span>
                      )}
                    </div>

                    <div className="ms-auto d-flex gap-2">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary py-1 px-3"
                        onClick={() => setActiveAction(null)}
                        disabled={simulating}
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-success py-1 px-3 d-flex align-items-center gap-1"
                        style={{ fontSize: '13px', fontWeight: 600 }}
                        onClick={handleConfirmDelivered}
                        disabled={(!proofFile && !proofPreview) || simulating}
                      >
                        {simulating ? (
                          <>
                            <RefreshCw size={13} className="spin" />
                            <span>Đang lưu...</span>
                          </>
                        ) : (
                          <>
                            <Check size={14} />
                            <span>Xác nhận giao thành công</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* KHỐI 2: Nhập lý do khi giao hàng thất bại */}
              {activeAction === 'failed' && (
                <div
                  className="mt-3 p-3 rounded-2"
                  style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}
                >
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <div className="d-flex align-items-center gap-2">
                      <AlertTriangle size={16} className="text-warning" />
                      <strong style={{ fontSize: '13px', color: '#92400e' }}>
                        Lý do chưa giao được hàng
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="btn-close btn-close-sm"
                      onClick={() => setActiveAction(null)}
                    />
                  </div>

                  <p className="text-muted small mb-2" style={{ fontSize: '12px' }}>
                    Lý do chưa giao được sẽ được hiển thị trên hành trình đơn hàng để khách hàng và cửa hàng cùng nắm thông tin.
                  </p>

                  <div className="mb-2">
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="Nhập lý do chưa giao được (ví dụ: Khách hẹn giao lại vào ngày mai)..."
                      value={failReasonInput}
                      onChange={(e) => setFailReasonInput(e.target.value)}
                      style={{ fontSize: '13px' }}
                    />
                  </div>

                  <div className="d-flex flex-wrap gap-1 mb-3">
                    <span className="small text-muted me-1" style={{ fontSize: '11.5px' }}>Gợi ý:</span>
                    {[
                      'Khách hẹn lại ngày mai',
                      'Không liên lạc được người nhận',
                      'Khách đổi địa chỉ giao hàng',
                      'Khách bận đi công tác',
                      'Địa chỉ không tìm thấy'
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="badge bg-white text-secondary border border-secondary-subtle py-1 px-2"
                        style={{ cursor: 'pointer', fontSize: '11.5px' }}
                        onClick={() => setFailReasonInput(preset)}
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>

                  <div className="d-flex justify-content-end gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary py-1 px-3"
                      onClick={() => setActiveAction(null)}
                      disabled={simulating}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-warning text-dark py-1 px-3 d-flex align-items-center gap-1"
                      style={{ fontSize: '13px', fontWeight: 600 }}
                      onClick={handleConfirmFailed}
                      disabled={!failReasonInput.trim() || simulating}
                    >
                      {simulating ? 'Đang lưu...' : 'Xác nhận chưa giao được'}
                    </button>
                  </div>
                </div>
              )}

              {simulateFeedback && (
                <div
                  className={`mt-2 py-1 px-2 rounded-2 small d-flex align-items-center gap-1 ${
                    simulateFeedback.type === 'error' ? 'text-danger' : 'text-success'
                  }`}
                  style={{
                    backgroundColor: simulateFeedback.type === 'error' ? '#fef2f2' : '#ecfdf5',
                    border: `1px solid ${simulateFeedback.type === 'error' ? '#fecaca' : '#a7f3d0'}`,
                    fontSize: '12px',
                  }}
                >
                  <Check size={13} />
                  <span>{simulateFeedback.text}</span>
                </div>
              )}

              <div
                className="mt-2 pt-2 border-top d-flex align-items-center justify-content-between text-muted"
                style={{ fontSize: '11.5px', borderColor: '#f1f5f9' }}
              >
                <span>Mô phỏng thay đổi trạng thái vận chuyển từ GHN.</span>
                <span className="font-monospace text-secondary">Mã: {trackingCode}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lightbox xem ảnh bằng chứng giao hàng full size */}
      {selectedImageModal && (
        <div
          role="dialog"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedImageModal(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              background: '#ffffff',
              padding: '8px',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex align-items-center justify-content-between p-2 border-bottom mb-2">
              <strong style={{ fontSize: '13px', color: '#166534' }}>
                Ảnh chụp xác nhận khi giao hàng
              </strong>
              <button
                type="button"
                className="btn-close btn-close-sm"
                onClick={() => setSelectedImageModal(null)}
              />
            </div>
            <img
              src={selectedImageModal}
              alt="Bằng chứng giao hàng"
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                borderRadius: '8px',
                display: 'block',
              }}
            />
            <div className="text-center text-muted mt-2" style={{ fontSize: '12px' }}>
              Mã vận đơn: <span className="font-monospace fw-bold">{trackingCode}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

