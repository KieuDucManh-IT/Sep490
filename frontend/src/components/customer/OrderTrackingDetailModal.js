import React, { useState, useEffect, useCallback } from 'react';
import HauteCoutureModal from '../HauteCoutureModal';
import { trackPublicShipmentApi } from '../../services/shippingApi';
import { cancelRentalOrder } from '../../services/rentalOrderApi';
import { createRentalClaim } from '../../services/rentalReturnApi';
import { formatCurrencyVND } from '../../services/cart/cartCalculations';
import {
  Truck,
  Package,
  CheckCircle,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  ShieldCheck,
  User,
  Store,
  ExternalLink,
  RotateCw,
  XCircle,
  RotateCcw,
  ShoppingBag,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import '../../styles/CustomerOrderTracking.css';

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

const getStepIndex = (status, displayStatusText = '') => {
  if (String(displayStatusText).toLowerCase().includes('chuẩn bị lại')) {
    return 1;
  }
  switch (status) {
    case 'pending_confirmation':
      return 0; // Chờ xác nhận
    case 'preparing':
      return 1; // Chờ lấy hàng
    case 'shipped':
      return 2; // Đang giao hàng
    case 'delivered':
      return 3; // Giao thành công
    case 'failed':
    case 'cancelled':
      return -1;
    default:
      return 1;
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

export default function OrderTrackingDetailModal({
  isOpen,
  onClose,
  order,
  orderType = 'rental', // 'rental' | 'sale'
  onOrderUpdated,
}) {
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Dispute & Cancel View Modes (Dành cho đơn thuê)
  const [viewMode, setViewMode] = useState('tracking'); // 'tracking' | 'cancel' | 'dispute'
  const [cancelReason, setCancelReason] = useState('');
  const [disputeReason, setDisputeReason] = useState('manufacturing_defect');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Nạp dữ liệu vận chuyển thời gian thực từ GHN
  const fetchTracking = useCallback(async (code, force = false) => {
    if (!code) return;
    if (force) {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    setErrorMsg('');
    try {
      const res = await trackPublicShipmentApi(code, { force });
      if (res?.success && res.data) {
        setTrackingData(res.data);
      } else {
        setErrorMsg(res?.message || 'Không tìm thấy dữ liệu vận chuyển.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi tải dữ liệu vận chuyển.');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && order) {
      setViewMode('tracking');
      setActionError('');
      setActionSuccess('');
      setCancelReason('');
      setDisputeDesc('');
      const targetCode = order.orderCode || order.shipment?.trackingCode || order._id;
      fetchTracking(targetCode);
    } else {
      setTrackingData(null);
      setErrorMsg('');
    }
  }, [isOpen, order, fetchTracking]);

  if (!isOpen || !order) return null;

  const isRental = orderType === 'rental' || Boolean(order.rentalFee !== undefined && order.rentalStatus);
  const orderItems = order.items || order.orderDetails || order.details || [];
  const currentStep = trackingData ? getStepIndex(trackingData.shipmentStatus, trackingData.displayStatusText) : 1;

  // Kiểm tra điều kiện nộp khiếu nại đổi trả 24h (đơn thuê)
  const isWithin24hWindow = () => {
    if (!['renting', 'ready_for_pickup'].includes(order.rentalStatus)) return false;
    const baseDate = order.actualPickupDate || order.actualDeliveryDate || order.startDate || order.updatedAt;
    const elapsed = Date.now() - new Date(baseDate).getTime();
    return elapsed <= 24 * 60 * 60 * 1000;
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setActionError('Vui lòng nhập lý do hủy đơn thuê');
      return;
    }
    setIsSubmitting(true);
    setActionError('');
    try {
      await cancelRentalOrder(order._id, cancelReason);
      setActionSuccess('Hủy đơn thuê thành công!');
      setTimeout(() => {
        if (onOrderUpdated) onOrderUpdated();
        onClose();
      }, 1200);
    } catch (err) {
      setActionError(err.message || 'Không thể hủy đơn thuê.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!disputeDesc.trim() || disputeDesc.trim().length < 10) {
      setActionError('Vui lòng mô tả chi tiết lỗi phát hiện (tối thiểu 10 ký tự)');
      return;
    }
    setIsSubmitting(true);
    setActionError('');
    try {
      const images = evidenceUrl.trim()
        ? evidenceUrl.split(',').map((s) => s.trim()).filter(Boolean)
        : ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80'];

      await createRentalClaim(order._id, {
        reason: disputeReason,
        description: disputeDesc,
        evidenceImages: images,
      });

      setActionSuccess('Đã nộp phiếu yêu cầu đổi trả 24h thành công! CSKH sẽ phản hồi trong 72h.');
      setTimeout(() => {
        if (onOrderUpdated) onOrderUpdated();
        onClose();
      }, 1500);
    } catch (err) {
      setActionError(err.message || 'Không thể gửi khiếu nại đổi trả.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <HauteCoutureModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        viewMode === 'cancel'
          ? 'Hủy Đơn Thuê Trang Phục'
          : viewMode === 'dispute'
          ? 'Yêu Cầu Đổi Trả Do Lỗi Sản Xuất (24h)'
          : `Tiến Trình & Chi Tiết Đơn Hàng #${order.orderCode || order._id?.slice(-6).toUpperCase()}`
      }
      subtitle={
        viewMode === 'tracking'
          ? `${isRental ? 'Đơn thuê trang phục' : 'Đơn mua sắm'} • Ngày đặt: ${formatDate(order.createdAt)}`
          : undefined
      }
      maxWidth="780px"
    >
      {/* Thông báo lỗi / thành công khi thao tác Action */}
      {actionError && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', marginBottom: '16px', fontSize: '13px' }}>
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div style={{ padding: '12px 16px', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', color: '#16A34A', marginBottom: '16px', fontSize: '13px' }}>
          {actionSuccess}
        </div>
      )}

      {/* ========================================================
          MODE 1: HỦY ĐƠN THUÊ
          ======================================================== */}
      {viewMode === 'cancel' && (
        <form onSubmit={handleCancelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '13px', color: '#57534E', lineHeight: 1.6 }}>
            Quý khách chỉ có thể hủy đơn khi trang phục chưa được bàn giao cho đơn vị vận chuyển GHN. Số tiền thuê và tiền cọc (nếu đã trừ qua ví) sẽ được hoàn trả tự động vào ví Vestora.
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#171717', marginBottom: '6px' }}>
              Lý Do Hủy Đơn: <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <textarea
              rows={3}
              required
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="VD: Thay đổi kế hoạch sự kiện, chọn nhầm kích thước..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setViewMode('tracking')}
              disabled={isSubmitting}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #D6D3D1', background: '#FFFFFF', color: '#44403C', fontSize: '13px', cursor: 'pointer' }}
            >
              Quay Lại
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              {isSubmitting ? 'Đang Hủy...' : 'Xác Nhận Hủy Đơn'}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================
          MODE 2: KHIẾU NẠI ĐỔI TRẢ 24H
          ======================================================== */}
      {viewMode === 'dispute' && (
        <form onSubmit={handleDisputeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '12px 14px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', color: '#1E40AF', fontSize: '12px' }}>
            Chính sách bảo đảm Haute Couture: Quý khách được quyền khiếu nại đổi trả trong vòng 24 giờ kể từ thời điểm shipper GHN giao đồ thành công.
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#171717', marginBottom: '6px' }}>
              Lý Do Đổi Trả:
            </label>
            <select
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
            >
              <option value="manufacturing_defect">Lỗi từ xưởng may / rách chỉ / thiếu cúc</option>
              <option value="stain_damage">Trang phục bị ố bẩn trước khi nhận</option>
              <option value="wrong_item">Giao sai mẫu / sai kích thước yêu cầu</option>
              <option value="other">Lý do kỹ thuật khác</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#171717', marginBottom: '6px' }}>
              Mô Tả Chi Tiết Lỗi: <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <textarea
              rows={3}
              required
              value={disputeDesc}
              onChange={(e) => setDisputeDesc(e.target.value)}
              placeholder="Mô tả cụ thể vị trí lỗi trên trang phục (tối thiểu 10 ký tự)..."
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#171717', marginBottom: '6px' }}>
              Đường Dẫn Ảnh Minh Chứng (URL):
            </label>
            <input
              type="text"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://... (phân cách bằng dấu phẩy nếu nhiều ảnh)"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D6D3D1', fontSize: '13px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setViewMode('tracking')}
              disabled={isSubmitting}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #D6D3D1', background: '#FFFFFF', color: '#44403C', fontSize: '13px', cursor: 'pointer' }}
            >
              Quay Lại
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#D97706', color: '#FFFFFF', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
            >
              {isSubmitting ? 'Đang Gửi...' : 'Nộp Đơn Khiếu Nại'}
            </button>
          </div>
        </form>
      )}

      {/* ========================================================
          MODE 3: TIẾN TRÌNH VẬN CHUYỂN & CHI TIẾT ĐƠN HÀNG
          ======================================================== */}
      {viewMode === 'tracking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {loading && !trackingData ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#78716C' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px auto', display: 'block', color: '#96723D' }} />
              <p style={{ fontSize: '13px', margin: 0 }}>Đang nạp tiến trình vận chuyển thời gian thực từ GHN...</p>
            </div>
          ) : errorMsg && !trackingData ? (
            <div style={{ padding: '16px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', color: '#DC2626', fontSize: '13px' }}>
              {errorMsg}
            </div>
          ) : (
            <>
              {/* KHỐI 1: FORM TIẾN TRÌNH VẬN CHUYỂN & TRẠNG THÁI GHN */}
              {trackingData && (
                <div className="tracking-result-card" style={{ margin: 0, padding: '20px', borderRadius: '12px', border: '1px solid #E5E0D8' }}>
                  {/* Header Banner */}
                  <div className="tracking-card-header" style={{ paddingBottom: '16px', marginBottom: '16px' }}>
                    <div>
                      <div className="tracking-header-tags">
                        <span className="tracking-carrier-tag">
                          {trackingData.carrierName || 'Giao Hàng Nhanh'}
                        </span>
                        {trackingData.hasGhnShipment ? (
                          <span className="tracking-badge-delivered">
                            <CheckCircle size={13} /> Đã bàn giao GHN
                          </span>
                        ) : (
                          <span className="tracking-badge-preparing">
                            <Clock size={13} /> Đang chuẩn bị tại Shop
                          </span>
                        )}
                      </div>
                      <div className="tracking-meta-section" style={{ marginTop: '8px' }}>
                        <div className="tracking-type-label tracking-meta-code">
                          <span>
                            Mã vận đơn GHN:{' '}
                            <strong className={trackingData.hasGhnShipment ? 'tracking-order-code-highlight' : 'tracking-code-empty'}>
                              {trackingData.hasGhnShipment ? trackingData.trackingCode : 'Chưa có mã vận đơn'}
                            </strong>
                          </span>
                        </div>
                        <div className="tracking-type-label">
                          <span className="me-2">
                            Mã đơn hàng: <strong className="tracking-order-code-highlight">{trackingData.orderCode || trackingData.trackingCode}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-end">
                      <span className="tracking-status-sub">Trạng thái hiện tại:</span>
                      <div className="tracking-status-actions">
                        <span className={`tracking-status-badge status-${trackingData.shipmentStatus}`}>
                          {trackingData.displayStatusText || trackingData.shipmentStatus}
                        </span>
                        {trackingData.hasGhnShipment && (
                          <button
                            type="button"
                            onClick={() => fetchTracking(trackingData.trackingCode || trackingData.orderCode, true)}
                            disabled={syncing || loading}
                            title="Đồng bộ trực tiếp từ GHN API"
                            className="tracking-sync-btn"
                          >
                            <RotateCw size={13} className={syncing ? 'animate-spin' : ''} />
                            <span>{syncing ? 'Đang đồng bộ...' : 'Làm mới'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Thông báo chuẩn bị nếu chưa bàn giao GHN */}
                  {!trackingData.hasGhnShipment && (
                    <div className="tracking-shop-notice" style={{ marginBottom: '16px' }}>
                      <Clock size={16} className="tracking-notice-icon" />
                      <span>
                        {trackingData.shipmentStatus === 'pending_confirmation'
                          ? 'Đơn hàng đang chờ cửa hàng liên hệ xác nhận (Đơn ship COD). Sau khi xác nhận, đơn sẽ được đóng gói giao cho shipper GHN.'
                          : 'Cửa hàng đang đóng gói sản phẩm và chờ shipper GHN đến lấy hàng. Mã vận đơn GHN chính thức sẽ được kích hoạt ngay khi bưu tá nhận kiện.'}
                      </span>
                    </div>
                  )}

                  {/* Stepper Progress 4 Bước */}
                  <div className="tracking-stepper-wrap" style={{ margin: '16px 0 20px 0' }}>
                    <div className="tracking-stepper">
                      <div className="stepper-progress-bg" />
                      <div className="stepper-progress-fill" data-step={currentStep} />

                      {[
                        {
                          label: trackingData.shipmentStatus === 'pending_confirmation' ? 'Chờ xác nhận' : 'Tiếp nhận',
                          icon: trackingData.shipmentStatus === 'pending_confirmation' ? Clock : Package,
                          step: 0,
                        },
                        { label: 'Chờ lấy hàng', icon: ShieldCheck, step: 1 },
                        { label: 'Đang giao hàng', icon: Truck, step: 2 },
                        { label: 'Giao thành công', icon: CheckCircle, step: 3 },
                      ].map((item, idx) => {
                        const isDone = currentStep >= item.step;
                        const isActive = currentStep === item.step;
                        const StepIcon = item.icon;
                        return (
                          <div key={idx} className={`stepper-step ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}`}>
                            <div className="stepper-circle">
                              <StepIcon size={16} />
                            </div>
                            <div className="stepper-label">{item.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grid 3 Card Chi Tiết: Người Nhận, Cửa Hàng, Dự Kiến */}
                  <div className="tracking-info-grid" style={{ marginBottom: '16px' }}>
                    {/* Card 1: Người nhận */}
                    <div className="info-block">
                      <div className="info-block-header">
                        <span className="info-block-title">
                          <User size={14} /> Người nhận
                        </span>
                        {trackingData.receiverInfo?.isMasked === false ? (
                          <span className="info-block-badge" style={{ backgroundColor: '#ECFDF5', color: '#059669', borderColor: '#A7F3D0', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <ShieldCheck size={11} /> Đã xác thực
                          </span>
                        ) : (
                          <span className="info-block-badge">Bảo mật</span>
                        )}
                      </div>
                      <div className="info-main-text">{trackingData.receiverInfo?.name}</div>
                      <div className="info-sub-text">{trackingData.receiverInfo?.phone}</div>
                      <div className="info-sub-text info-address-row">
                        <MapPin size={13} className="info-icon-green" />
                        <span>{trackingData.receiverInfo?.address || trackingData.receiverInfo?.maskedAddress}</span>
                      </div>
                    </div>

                    {/* Card 2: Cửa hàng gửi đồ */}
                    <div className="info-block">
                      <div className="info-block-header">
                        <span className="info-block-title">
                          <Store size={14} /> Cửa hàng gửi đồ
                        </span>
                      </div>
                      <div className="info-main-text">{trackingData.storeInfo?.name || 'Vestora Showroom'}</div>
                      <div className="info-sub-text info-address-row">
                        <MapPin size={13} className="info-icon-green" />
                        <span>{trackingData.storeInfo?.address || 'Hệ thống Showroom Vestora'}</span>
                      </div>
                      {trackingData.storeInfo?.latitude && trackingData.storeInfo?.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${trackingData.storeInfo.latitude},${trackingData.storeInfo.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="info-map-pill"
                          title="Mở chỉ đường trên Google Maps"
                        >
                          <ExternalLink size={11} /> Google Maps
                        </a>
                      )}
                    </div>

                    {/* Card 3: Dự kiến giao nhận */}
                    <div className="info-block">
                      <div className="info-block-header">
                        <span className="info-block-title">
                          <Calendar size={14} /> Dự kiến giao nhận
                        </span>
                      </div>
                      {trackingData.expectedDeliveryTime ? (
                        <>
                          <div className="info-sub-text">Thời gian dự kiến:</div>
                          <div className="info-main-text info-main-text-green">
                            {formatDate(trackingData.expectedDeliveryTime)}
                          </div>
                        </>
                      ) : (
                        <div className="info-sub-text">Đang cập nhật lịch trình...</div>
                      )}
                      {trackingData.deliveredAt && (
                        <div className="info-delivered-tag">
                          <CheckCircle size={13} className="info-icon-shrink" />
                          <span>Đã giao thành công lúc {formatDate(trackingData.deliveredAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timeline Hành Trình Chi Tiết */}
                  <div className="tracking-timeline-section" style={{ margin: 0, padding: '16px' }}>
                    <h3 className="timeline-heading" style={{ fontSize: '13px', marginBottom: '12px' }}>
                      <Clock size={16} className="timeline-heading-icon" />
                      Lịch Sử Hành Trình Chi Tiết
                    </h3>

                    {Array.isArray(trackingData.statusHistory) && trackingData.statusHistory.length > 0 ? (
                      <div className="timeline-list">
                        {trackingData.statusHistory
                          .slice()
                          .reverse()
                          .map((item, idx) => {
                            const isLatest = idx === 0;
                            return (
                              <div key={item._id || `${item.status}-${item.timestamp || idx}`} className={`timeline-item ${isLatest ? 'latest' : ''}`}>
                                <div className="timeline-node" />
                                <div className="timeline-item-title" style={{ fontSize: '12px' }}>
                                  {sanitizeTimelineText(item.description || item.status)}
                                </div>
                                <div className="timeline-item-time" style={{ fontSize: '11px' }}>
                                  <Clock size={11} />
                                  {formatDate(item.timestamp)}
                                  {item.location && <span>• {item.location}</span>}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="timeline-empty-msg" style={{ fontSize: '12px', padding: '12px' }}>
                        Đơn hàng đang chờ bưu tá GHN tiếp nhận gói hàng tại cửa hàng.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* KHỐI 2: DANH SÁCH SẢN PHẨM TRONG ĐƠN */}
              <div style={{ padding: '16px', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E5E0D8' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#171717', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={16} color="#96723D" />
                  <span>Danh Sách Trang Phục ({orderItems.length} món)</span>
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {orderItems.map((item, idx) => {
                    const prodName = item.productName || item.name || item.variantId?.productId?.name || `Trang phục #${idx + 1}`;
                    const prodSize = item.size || item.variantId?.size || 'M';
                    const prodPrice = item.rentalPrice || item.unitPrice || item.unitRentalFee || item.lineTotal || 0;
                    const prodQty = item.quantity || 1;

                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: '#FAF9F6',
                          borderRadius: '8px',
                          border: '1px solid #E5E0D8',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}>{prodName}</div>
                          <div style={{ fontSize: '11px', color: '#78716C', marginTop: '2px' }}>
                            Size: {prodSize} • Số lượng: {prodQty}
                          </div>
                        </div>
                        <strong style={{ fontSize: '13px', color: '#96723D' }}>
                          {formatCurrencyVND(prodPrice * prodQty)}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* KHỐI 3: CHI TIẾT TÀI CHÍNH & THANH TOÁN */}
              <div style={{ padding: '16px', background: '#FAFAF9', borderRadius: '12px', border: '1px solid #E5E0D8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: '#78716C' }}>{isRental ? 'Tiền thuê trang phục:' : 'Tiền hàng:'}</span>
                  <strong style={{ color: '#171717' }}>{formatCurrencyVND(isRental ? order.rentalFee : order.totalAmount)}</strong>
                </div>

                {isRental && order.depositAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#78716C' }}>Tiền đặt cọc bảo đảm:</span>
                    <strong style={{ color: '#C5A880' }}>{formatCurrencyVND(order.depositAmount)}</strong>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
                  <span style={{ color: '#78716C' }}>Phương thức thanh toán:</span>
                  <strong style={{ color: order.paymentMethod === 'wallet' ? '#15803D' : '#B45309' }}>
                    {order.paymentMethod === 'wallet' ? 'Ví nội bộ Vestora (Đã thanh toán)' : 'Thanh toán khi nhận hàng (COD)'}
                  </strong>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #E5E0D8', margin: '10px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ fontWeight: 600, color: '#171717' }}>Tổng thanh toán:</span>
                  <strong style={{ fontSize: '16px', color: '#96723D' }}>
                    {formatCurrencyVND(isRental ? (order.rentalFee || 0) + (order.depositAmount || 0) : order.totalAmount || 0)}
                  </strong>
                </div>
              </div>

              {/* KHỐI 4: CÁC NÚT HÀNH ĐỘNG */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '8px' }}>
                <div>
                  {isRental && ['confirmed', 'preparing', 'pending_payment'].includes(order.rentalStatus) && (
                    <button
                      type="button"
                      onClick={() => setViewMode('cancel')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: '1px solid #FECACA',
                        backgroundColor: '#FEF2F2',
                        color: '#DC2626',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <XCircle size={15} />
                      <span>Hủy Đơn Thuê</span>
                    </button>
                  )}

                  {isRental && isWithin24hWindow() && (
                    <button
                      type="button"
                      onClick={() => setViewMode('dispute')}
                      style={{
                        padding: '8px 14px',
                        borderRadius: '6px',
                        border: '1px solid #FED7AA',
                        backgroundColor: '#FFFBEB',
                        color: '#D97706',
                        fontSize: '12px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <RotateCcw size={15} />
                      <span>Khiếu Nại Đổi Trả (24h)</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: '1px solid #E5E0D8',
                    background: '#171717',
                    color: '#F8F7F4',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Đóng
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </HauteCoutureModal>
  );
}

