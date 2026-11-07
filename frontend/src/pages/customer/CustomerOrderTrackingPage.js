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

export default function CustomerOrderTrackingPage() {
  const { trackingCode: urlCode } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialCode = urlCode || searchParams.get('code') || '';
  const [searchInput, setSearchInput] = useState(initialCode);
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchTracking = async (code) => {
    if (!code || !code.trim()) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await trackPublicShipmentApi(code.trim());
      if (res?.success && res.data) {
        setTrackingData(res.data);
      } else {
        setErrorMsg(res?.message || 'Không tìm thấy thông tin vận đơn khớp với mã vận đơn GHN đã cung cấp.');
        setTrackingData(null);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi tra cứu hành trình vận đơn.');
      setTrackingData(null);
    } finally {
      setLoading(false);
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
  const getStepIndex = (status) => {
    switch (status) {
      case 'preparing':
        return 0; // Đã tiếp nhận đơn
      case 'shipped':
        return 2; // Đang vận chuyển
      case 'delivered':
        return 3; // Giao thành công
      case 'failed':
      case 'cancelled':
        return -1;
      default:
        return 1; // Đã lấy hàng
    }
  };

  const currentStep = trackingData ? getStepIndex(trackingData.shipmentStatus) : 0;
  const statusDef = trackingData
    ? SHIPMENT_STATUS_MAP[trackingData.shipmentStatus] || { text: trackingData.shipmentStatus, chipClass: 'pending' }
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
                placeholder="Nhập mã vận đơn"
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
              <strong style={{ fontSize: '15px' }}>Không tìm thấy vận đơn</strong>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>{errorMsg}</div>
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
                <span className="tracking-carrier-tag">
                  {trackingData.carrierName || 'Giao Hàng Nhanh'}
                </span>
                <h2 className="tracking-code-display">{trackingData.trackingCode}</h2>
                <div className="tracking-type-label">
                  {trackingData.shipmentType === 'return'
                    ? 'Đơn thu hồi trang phục cho thuê'
                    : 'Đơn giao trang phục thời trang cao cấp'}
                </div>
              </div>
              <div className="text-end">
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', display: 'block', marginBottom: '4px' }}>
                  Trạng thái hiện tại:
                </span>
                <span className={`tracking-status-badge status-${trackingData.shipmentStatus}`}>
                  {statusDef?.text || trackingData.shipmentStatus}
                </span>
              </div>
            </div>

            {/* Stepper Progress */}
            <div className="tracking-stepper-wrap">
              <div className="tracking-stepper">
                <div className="stepper-progress-bg" />
                <div
                  className="stepper-progress-fill"
                  style={{
                    width: `${Math.max(0, (currentStep / 3) * 100)}%`,
                  }}
                />

                {[
                  { label: 'Tiếp nhận', icon: Package, step: 0 },
                  { label: 'Đã lấy hàng', icon: ShieldCheck, step: 1 },
                  { label: 'Đang vận chuyển', icon: Truck, step: 2 },
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
                  <MapPin size={13} style={{ color: '#5b6e4e', flexShrink: 0, marginTop: '3px' }} />
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
                  <MapPin size={13} style={{ color: '#5b6e4e', flexShrink: 0, marginTop: '3px' }} />
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
                    <div className="info-main-text" style={{ color: '#5b6e4e', marginTop: '2px' }}>
                      {formatDate(trackingData.expectedDeliveryTime)}
                    </div>
                  </>
                ) : (
                  <div className="info-sub-text">Đang cập nhật lịch trình giao...</div>
                )}
                {trackingData.deliveredAt && (
                  <div className="info-delivered-tag">
                    <CheckCircle size={13} style={{ flexShrink: 0 }} />
                    <span>Đã giao thành công lúc {formatDate(trackingData.deliveredAt)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline History */}
            <div className="tracking-timeline-section">
              <h3 className="timeline-heading">
                <Clock size={18} style={{ color: '#5b6e4e' }} />
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
                <div style={{ color: '#888', fontStyle: 'italic', fontSize: '14px' }}>
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
