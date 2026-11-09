import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Truck,
  Package,
  Search,
  CheckCircle,
  Clock,
  MapPin,
  Calendar,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  User,
  Store,
  ExternalLink,
  RotateCw,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import AiStylistWidget from '../../components/AiStylistWidget';
import { trackPublicShipmentApi } from '../../services/shippingApi';
import { SHIPMENT_STATUS_MAP, formatDate } from '../shipping/shippingUtils';
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

const getShipmentTypeLabel = (data) => {
  if (!data) return 'Đơn giao hàng';
  if (data.shipmentType === 'return') {
    return 'Đơn thu hồi trang phục cho thuê';
  }
  if (data.orderType === 'rental' || data.orderCode?.startsWith('RNT')) {
    return 'Đơn thuê trang phục';
  }
  if (data.orderType === 'sale' || data.orderCode?.startsWith('SAL') || data.orderCode?.startsWith('ORD')) {
    return 'Đơn mua hàng';
  }
  return 'Đơn giao hàng';
};

export default function CustomerOrderTrackingPage() {
  const { trackingCode: urlCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialCode = urlCode || searchParams.get('code') || '';
  const [searchInput, setSearchInput] = useState(initialCode);
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchTracking = async (code, force = false) => {
    if (!code || !code.trim()) return;
    if (force) {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    setErrorMsg('');
    try {
      const res = await trackPublicShipmentApi(code.trim(), { force });
      if (res?.success && res.data) {
        setTrackingData(res.data);
        // Mã hiển thị trên thanh search luôn là mã đơn hàng của sàn
        if (res.data.orderCode) {
          setSearchInput(res.data.orderCode);
        }
      } else {
        setErrorMsg(res?.message || 'Không tìm thấy đơn hàng hoặc mã vận đơn phù hợp.');
        setTrackingData(null);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi tra cứu hành trình vận đơn.');
      setTrackingData(null);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (initialCode) {
      setSearchInput(initialCode);
      fetchTracking(initialCode);
    }
  }, [initialCode]);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    const code = searchInput.trim();
    if (code) {
      navigate(`/tracking/${encodeURIComponent(code)}`);
      fetchTracking(code);
    }
  };

  // Tính bước tiến trình hiện tại (0 -> 3)
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

  const currentStep = trackingData ? getStepIndex(trackingData.shipmentStatus, trackingData.displayStatusText) : 0;
  const statusDef = trackingData
    ? SHIPMENT_STATUS_MAP[trackingData.shipmentStatus] || { text: trackingData.displayStatusText || trackingData.shipmentStatus, chipClass: 'pending' }
    : null;

  return (
    <div className="vestora-page-wrapper">
      <Navbar />

      <main className="tracking-main-container">
        {/* 1. Hero Section */}
        <section className="tracking-hero-section">
          <h1 className="tracking-title">Tra Cứu Đơn Hàng</h1>
        </section>

        {/* 2. Search Box Card */}
        <section className="tracking-search-card">
          <form onSubmit={handleSearchSubmit} className="tracking-search-form">
            <div className="tracking-input-wrapper">
              <Search size={20} className="tracking-input-icon" />
              <input
                type="text"
                className="tracking-search-input"
                placeholder="Nhập mã vận đơn GHN hoặc mã đơn hàng (VD: RNT-195647-586, LY7UKP)..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="tracking-search-btn"
              disabled={loading || !searchInput.trim()}
            >
              {loading ? (
                <span>Đang tra cứu...</span>
              ) : (
                <>
                  <span>Tra cứu</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </form>
        </section>

        {/* 3. Error Alert */}
        {errorMsg && (
          <div className="tracking-alert">
            <AlertCircle size={24} className="tracking-alert-icon" />
            <div>
              <strong className="tracking-alert-title">Không tìm thấy đơn hàng hoặc vận đơn</strong>
              <div className="tracking-alert-desc">{errorMsg}</div>
            </div>
          </div>
        )}

        {/* 4. Empty Initial Guide (khi chưa có kết quả) */}
        {!trackingData && !errorMsg && !loading && (
          <div className="tracking-empty-guide">
          </div>
        )}

        {/* 5. Tracking Detail Card */}
        {trackingData && (
          <div className="tracking-result-card">
            {/* Header Banner */}
            <div className="tracking-card-header">
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
                <div className="tracking-meta-section">
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
                      Mã đơn hàng: <strong className="tracking-order-code-highlight">{trackingData.orderCode || trackingData.trackingCode}</strong> •
                    </span>
                    <span>{getShipmentTypeLabel(trackingData)}</span>
                  </div>
                </div>
              </div>
              <div className="text-end">
                <span className="tracking-status-sub">
                  Trạng thái hiện tại:
                </span>
                <div className="tracking-status-actions">
                  <span className={`tracking-status-badge status-${trackingData.shipmentStatus}`}>
                    {trackingData.displayStatusText || statusDef?.text || trackingData.shipmentStatus}
                  </span>
                  {trackingData.hasGhnShipment && (
                    <button
                      type="button"
                      onClick={() => fetchTracking(trackingData.trackingCode || trackingData.orderCode, true)}
                      disabled={syncing || loading}
                      title="Cập nhật trạng thái mới nhất trực tiếp từ GHN"
                      className="tracking-sync-btn"
                    >
                      <RotateCw size={13} className={syncing ? 'animate-spin' : ''} />
                      <span>{syncing ? 'Đang đồng bộ...' : 'Làm mới'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Thông báo tiến độ khi shop chưa gửi bưu tá GHN */}
            {!trackingData.hasGhnShipment && (
              <div className="tracking-shop-notice">
                <Clock size={18} className="tracking-notice-icon" />
                <span>
                  {trackingData.shipmentStatus === 'pending_confirmation'
                    ? 'Đơn hàng đang chờ cửa hàng liên hệ xác nhận (Đơn ship COD). Sau khi xác nhận, đơn sẽ được đóng gói giao cho bưu tá GHN.'
                    : 'Cửa hàng đang chuẩn bị sản phẩm và chờ shipper GHN đến lấy hàng. Mã vận đơn GHN chính thức sẽ được kích hoạt ngay khi bưu tá nhận kiện hàng.'}
                </span>
              </div>
            )}

            {/* Stepper Progress */}
            <div className="tracking-stepper-wrap">
              <div className="tracking-stepper">
                <div className="stepper-progress-bg" />
                <div
                  className="stepper-progress-fill"
                  data-step={currentStep}
                />

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
                    <div
                      key={idx}
                      className={`stepper-step ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}`}
                    >
                      <div className="stepper-circle">
                        <StepIcon size={18} />
                      </div>
                      <div className="stepper-label">{item.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detail Info Grid */}
            <div className="tracking-info-grid">
              {/* Card 1: Người nhận */}
              <div className="info-block">
                <div className="info-block-header">
                  <span className="info-block-title">
                    <User size={14} /> Người nhận
                  </span>
                  <span className="info-block-badge">Bảo mật</span>
                </div>
                <div className="info-main-text">{trackingData.receiverInfo?.name}</div>
                <div className="info-sub-text">{trackingData.receiverInfo?.phone}</div>
                <div className="info-sub-text info-address-row">
                  <MapPin size={13} className="info-icon-green" />
                  <span>{trackingData.receiverInfo?.maskedAddress}</span>
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
                  <span>{trackingData.storeInfo?.address || 'Hệ thống cửa hàng Vestora'}</span>
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
                  <div className="info-sub-text">Đang cập nhật lịch trình giao...</div>
                )}
                {trackingData.deliveredAt && (
                  <div className="info-delivered-tag">
                    <CheckCircle size={13} className="info-icon-shrink" />
                    <span>Đã giao thành công lúc {formatDate(trackingData.deliveredAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline History */}
            <div className="tracking-timeline-section">
              <h3 className="timeline-heading">
                <Clock size={18} className="timeline-heading-icon" />
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
                          <div className="timeline-item-title">
                            {sanitizeTimelineText(item.description || item.status)}
                          </div>
                          <div className="timeline-item-time">
                            <Clock size={12} />
                            {formatDate(item.timestamp)}
                            {item.location && <span>• {item.location}</span>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="timeline-empty-msg">
                  Đơn hàng đang chờ bưu tá GHN tiếp nhận gói hàng tại cửa hàng.
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
      <AiStylistWidget />
    </div>
  );
}
