import React, { useState, useEffect, useCallback, useRef } from 'react';
import HauteCoutureModal from '../HauteCoutureModal';
import { trackShipmentApi } from '../../services/shippingApi';
import { cancelRentalOrder } from '../../services/rentalOrderApi';
import { createRentalClaim } from '../../services/rentalReturnApi';
import { formatCurrencyVND } from '../../services/cart/cartCalculations';
import {
  RentalReturnWorkflow,
  RentalDeliveryVideos,
  SalesReturnWorkflow,
  SalesDeliveryVideos,
} from '../../pages/shipping/ShipmentReturnModal';
import {
  Truck,
  Package,
  CheckCircle,
  Clock,
  MapPin,
  Calendar,
  ShieldCheck,
  User,
  Store,
  ExternalLink,
  XCircle,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { sanitizeTimelineText } from '../../pages/shipping/shippingUtils';
import '../../styles/CustomerOrderTracking.css';

const getStepIndex = (status, displayStatusText = '') => {
  if (String(displayStatusText).toLowerCase().includes('chuẩn bị lại')) {
    return 1;
  }

  switch (status) {
    case 'pending_confirmation':
      return 0;
    case 'preparing':
      return 1;
    case 'shipped':
      return 2;
    case 'delivered':
      return 3;
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

/* ==========================================================================
   SUB-COMPONENTS
   ========================================================================== */

/** 1. Header thẻ vận đơn GHN */
function TrackingHeader({ trackingData }) {
  return (
    <div
      className="tracking-card-header"
      style={{ paddingBottom: '16px', marginBottom: '16px' }}
    >
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

        <div
          className="tracking-meta-section"
          style={{ marginTop: '8px' }}
        >
          <div className="tracking-type-label tracking-meta-code">
            <span>
              Mã vận đơn GHN:{' '}
              <strong
                className={
                  trackingData.hasGhnShipment
                    ? 'tracking-order-code-highlight'
                    : 'tracking-code-empty'
                }
              >
                {trackingData.hasGhnShipment
                  ? trackingData.trackingCode
                  : 'Chưa có mã vận đơn'}
              </strong>
            </span>
          </div>

          <div className="tracking-type-label">
            <span className="me-2">
              Mã đơn hàng:{' '}
              <strong className="tracking-order-code-highlight">
                {trackingData.orderCode || trackingData.trackingCode}
              </strong>
            </span>
          </div>
        </div>
      </div>

      <div className="text-end">
        <span className="tracking-status-sub">
          Trạng thái hiện tại:
        </span>

        <div className="tracking-status-actions">
          <span
            className={`tracking-status-badge status-${trackingData.shipmentStatus}`}
          >
            {trackingData.displayStatusText ||
              trackingData.shipmentStatus}
          </span>
        </div>
      </div>
    </div>
  );
}

/** 2. Thông báo chuẩn bị tại cửa hàng */
function TrackingShopNotice({ shipmentStatus }) {
  return (
    <div
      className="tracking-shop-notice"
      style={{ marginBottom: '16px' }}
    >
      <Clock size={16} className="tracking-notice-icon" />

      <span>
        {shipmentStatus === 'pending_confirmation'
          ? 'Đơn hàng đang chờ cửa hàng liên hệ xác nhận (Đơn ship COD). Sau khi xác nhận, đơn sẽ được đóng gói giao cho shipper GHN.'
          : 'Cửa hàng đang đóng gói sản phẩm và chờ shipper GHN đến lấy hàng. Mã vận đơn GHN chính thức sẽ được kích hoạt ngay khi bưu tá nhận kiện.'}
      </span>
    </div>
  );
}

/** 3. Tiến trình vận chuyển 4 bước */
function TrackingStepper({ currentStep, shipmentStatus }) {
  const steps = [
    {
      label:
        shipmentStatus === 'pending_confirmation'
          ? 'Chờ xác nhận'
          : 'Tiếp nhận',
      icon: shipmentStatus === 'pending_confirmation' ? Clock : Package,
      step: 0,
    },
    { label: 'Chờ lấy hàng', icon: ShieldCheck, step: 1 },
    { label: 'Đang giao hàng', icon: Truck, step: 2 },
    { label: 'Giao thành công', icon: CheckCircle, step: 3 },
  ];

  return (
    <div
      className="tracking-stepper-wrap"
      style={{ margin: '16px 0 20px 0' }}
    >
      <div className="tracking-stepper">
        <div className="stepper-progress-bg" />
        <div
          className="stepper-progress-fill"
          data-step={currentStep}
        />

        {steps.map((item, idx) => {
          const isDone = currentStep >= item.step;
          const isActive = currentStep === item.step;
          const StepIcon = item.icon;

          return (
            <div
              key={idx}
              className={`stepper-step ${isDone ? 'completed' : ''} ${
                isActive ? 'active' : ''
              }`}
            >
              <div className="stepper-circle">
                <StepIcon size={16} />
              </div>

              <div className="stepper-label">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 4. Lưới 3 khối thông tin chi tiết */
function TrackingInfoGrid({
  receiverInfo,
  storeInfo,
  expectedDeliveryTime,
  deliveredAt,
}) {
  return (
    <div
      className="tracking-info-grid"
      style={{ marginBottom: '16px' }}
    >
      {/* Card 1: Người nhận */}
      <div className="info-block">
        <div className="info-block-header">
          <span className="info-block-title">
            <User size={14} /> Người nhận
          </span>

          {receiverInfo?.isMasked === false ? (
            <span
              className="info-block-badge"
              style={{
                backgroundColor: '#ECFDF5',
                color: '#059669',
                borderColor: '#A7F3D0',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <ShieldCheck size={11} /> Đã xác thực
            </span>
          ) : (
            <span className="info-block-badge">
              Bảo mật
            </span>
          )}
        </div>

        <div className="info-main-text">
          {receiverInfo?.name}
        </div>

        <div className="info-sub-text">
          {receiverInfo?.phone}
        </div>

        <div className="info-sub-text info-address-row">
          <MapPin size={13} className="info-icon-green" />
          <span>
            {receiverInfo?.address || receiverInfo?.maskedAddress}
          </span>
        </div>
      </div>

      {/* Card 2: Cửa hàng gửi đồ */}
      <div className="info-block">
        <div className="info-block-header">
          <span className="info-block-title">
            <Store size={14} /> Cửa hàng gửi đồ
          </span>
        </div>

        <div className="info-main-text">
          {storeInfo?.name || 'Vestora Showroom'}
        </div>

        <div className="info-sub-text info-address-row">
          <MapPin size={13} className="info-icon-green" />
          <span>
            {storeInfo?.address || 'Hệ thống Showroom Vestora'}
          </span>
        </div>

        {storeInfo?.latitude && storeInfo?.longitude && (
          <a
            href={`https://www.google.com/maps?q=${storeInfo.latitude},${storeInfo.longitude}`}
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

        {expectedDeliveryTime ? (
          <>
            <div className="info-sub-text">
              Thời gian dự kiến:
            </div>

            <div className="info-main-text info-main-text-green">
              {formatDate(expectedDeliveryTime)}
            </div>
          </>
        ) : (
          <div className="info-sub-text">
            Đang cập nhật lịch trình...
          </div>
        )}

        {deliveredAt && (
          <div className="info-delivered-tag">
            <CheckCircle size={13} className="info-icon-shrink" />
            <span>
              Đã giao thành công lúc {formatDate(deliveredAt)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** 5. Bằng chứng giao hàng & Lý do hủy/thất bại */
function TrackingProofAndFailureAlerts({
  deliveryProofImage,
  failureReason,
  cancellationReason,
  onImageClick,
}) {
  return (
    <>
      {deliveryProofImage && (
        <div
          style={{
            margin: '0 0 16px 0',
            padding: '10px 14px',
            background: '#F0FDF4',
            borderRadius: '8px',
            border: '1px solid #BBF7D0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <img
              src={deliveryProofImage}
              alt="Ảnh xác nhận nhận hàng"
              style={{
                width: '44px',
                height: '44px',
                objectFit: 'cover',
                borderRadius: '6px',
                cursor: 'pointer',
                border: '1px solid #86EFAC',
              }}
              onClick={() => onImageClick(deliveryProofImage)}
              title="Bấm để xem ảnh phóng to"
            />

            <div>
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#166534',
                }}
              >
                ✓ Ảnh chụp khi giao hàng thành công
              </div>

              <div
                style={{
                  fontSize: '11px',
                  color: '#15803D',
                }}
              >
                Ảnh do shipper chụp khi giao kiện hàng cho bạn.
              </div>
            </div>
          </div>

          <button
            type="button"
            style={{
              padding: '4px 10px',
              fontSize: '11.5px',
              background: '#FFFFFF',
              color: '#166534',
              border: '1px solid #86EFAC',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500,
            }}
            onClick={() => onImageClick(deliveryProofImage)}
          >
            Xem ảnh
          </button>
        </div>
      )}

      {(failureReason || cancellationReason) && (
        <div
          style={{
            margin: '0 0 16px 0',
            padding: '10px 14px',
            background: '#FEF2F2',
            borderRadius: '8px',
            border: '1px solid #FECACA',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#B91C1C',
            fontSize: '12.5px',
          }}
        >
          <AlertCircle size={16} />

          <span>
            <strong>
              {cancellationReason && !failureReason
                ? 'Lý do hủy đơn:'
                : 'Lý do chưa giao được / hủy:'}
            </strong>{' '}
            {failureReason || cancellationReason}
          </span>
        </div>
      )}
    </>
  );
}

/** 6. Lịch sử hành trình vận chuyển chi tiết */
function TrackingTimeline({ statusHistory, onImageClick }) {
  return (
    <div
      className="tracking-timeline-section"
      style={{ margin: 0, padding: '16px' }}
    >
      <h3
        className="timeline-heading"
        style={{ fontSize: '13px', marginBottom: '12px' }}
      >
        <Clock size={16} className="timeline-heading-icon" />
        Lịch Sử Hành Trình Chi Tiết
      </h3>

      {Array.isArray(statusHistory) && statusHistory.length > 0 ? (
        <div className="timeline-list">
          {statusHistory
            .slice()
            .reverse()
            .map((item, idx) => {
              const isLatest = idx === 0;

              return (
                <div
                  key={
                    item._id ||
                    `${item.status}-${item.timestamp || idx}`
                  }
                  className={`timeline-item ${
                    isLatest ? 'latest' : ''
                  }`}
                >
                  <div className="timeline-node" />

                  <div
                    className="timeline-item-title"
                    style={{ fontSize: '12px' }}
                  >
                    {sanitizeTimelineText(
                      item.description || item.status
                    )}
                  </div>

                  <div
                    className="timeline-item-time"
                    style={{ fontSize: '11px' }}
                  >
                    <Clock size={11} />
                    {formatDate(item.timestamp)}
                    {item.location && (
                      <span>• {item.location}</span>
                    )}
                  </div>

                  {item.evidenceImage && (
                    <div style={{ marginTop: '6px' }}>
                      <img
                        src={item.evidenceImage}
                        alt="Ảnh khi nhận hàng"
                        style={{
                          width: '44px',
                          height: '44px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          border: '1px solid #D1D5DB',
                        }}
                        onClick={() =>
                          onImageClick(item.evidenceImage)
                        }
                        title="Bấm để xem ảnh phóng to"
                      />
                    </div>
                  )}

                  {item.failReason && (
                    <div
                      style={{
                        marginTop: '4px',
                        fontSize: '11.5px',
                        color: '#DC2626',
                      }}
                    >
                      Lý do chưa giao được:{' '}
                      <em>{item.failReason}</em>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      ) : (
        <div
          className="timeline-empty-msg"
          style={{ fontSize: '12px', padding: '12px' }}
        >
          Đơn hàng đang chờ bưu tá GHN tiếp nhận gói hàng tại cửa hàng.
        </div>
      )}
    </div>
  );
}

/** 7. Danh sách trang phục trong đơn */
function OrderProductsList({ orderItems }) {
  return (
    <div
      style={{
        padding: '16px',
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid #E5E0D8',
      }}
    >
      <h4
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#171717',
          margin: '0 0 12px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Package size={16} color="#96723D" />
        <span>
          Danh Sách Trang Phục ({orderItems.length} món)
        </span>
      </h4>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {orderItems.map((item, idx) => {
          const prodName =
            item.productName ||
            item.name ||
            item.variantId?.productId?.name ||
            `Trang phục #${idx + 1}`;

          const prodSize =
            item.size || item.variantId?.size || 'M';

          const prodPrice =
            item.rentalPrice ||
            item.unitPrice ||
            item.unitRentalFee ||
            item.lineTotal ||
            0;

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
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#171717',
                  }}
                >
                  {prodName}
                </div>

                <div
                  style={{
                    fontSize: '11px',
                    color: '#78716C',
                    marginTop: '2px',
                  }}
                >
                  Size: {prodSize} • Số lượng: {prodQty}
                </div>
              </div>

              <strong
                style={{
                  fontSize: '13px',
                  color: '#96723D',
                }}
              >
                {formatCurrencyVND(prodPrice * prodQty)}
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 8. Bảng kê tài chính đơn hàng */
function OrderFinancialSummary({ order, isRental }) {
  return (
    <div
      style={{
        padding: '16px',
        background: '#FAFAF9',
        borderRadius: '12px',
        border: '1px solid #E5E0D8',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontSize: '13px',
        }}
      >
        <span style={{ color: '#78716C' }}>
          {isRental ? 'Tiền thuê trang phục:' : 'Tiền hàng:'}
        </span>

        <strong style={{ color: '#171717' }}>
          {formatCurrencyVND(
            isRental ? order.rentalFee : order.totalAmount
          )}
        </strong>
      </div>

      {isRental && order.depositAmount > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '8px',
            fontSize: '13px',
          }}
        >
          <span style={{ color: '#78716C' }}>
            Tiền đặt cọc bảo đảm:
          </span>

          <strong style={{ color: '#C5A880' }}>
            {formatCurrencyVND(order.depositAmount)}
          </strong>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontSize: '13px',
        }}
      >
        <span style={{ color: '#78716C' }}>
          Phương thức thanh toán:
        </span>

        <strong
          style={{
            color:
              order.paymentMethod === 'wallet'
                ? '#15803D'
                : '#B45309',
          }}
        >
          {order.paymentMethod === 'wallet'
            ? 'Ví nội bộ Vestora (Đã thanh toán)'
            : 'Thanh toán khi nhận hàng (COD)'}
        </strong>
      </div>

      <hr
        style={{
          border: 'none',
          borderTop: '1px solid #E5E0D8',
          margin: '10px 0',
        }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '14px',
        }}
      >
        <span style={{ fontWeight: 600, color: '#171717' }}>
          Tổng thanh toán:
        </span>

        <strong
          style={{
            fontSize: '16px',
            color: '#96723D',
          }}
        >
          {formatCurrencyVND(
            isRental
              ? (order.rentalFee || 0) + (order.depositAmount || 0)
              : order.totalAmount || 0
          )}
        </strong>
      </div>
    </div>
  );
}

/** 9. Form Hủy Đơn Thuê */
function CancelOrderForm({
  cancelReason,
  setCancelReason,
  isSubmitting,
  onBack,
  onSubmit,
}) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div
        style={{
          fontSize: '13px',
          color: '#57534E',
          lineHeight: 1.6,
        }}
      >
        Đơn đã xác nhận và chưa bàn giao được hủy tự động. Hủy trước
        thời điểm bắt đầu thuê từ 24 giờ trở lên: hoàn toàn bộ tiền
        thuê và tiền cọc vào ví Vestora. Hủy khi còn dưới 24 giờ: giữ
        phí một ngày thuê, hoàn phần tiền thuê còn lại và toàn bộ
        tiền cọc.
      </div>

      <div>
        <label
          htmlFor="rental-cancel-reason"
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: '#171717',
            marginBottom: '6px',
          }}
        >
          Lý Do Hủy Đơn:{' '}
          <span style={{ color: '#DC2626' }}>*</span>
        </label>

        <textarea
          id="rental-cancel-reason"
          rows={3}
          required
          minLength={3}
          maxLength={500}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="VD: Thay đổi kế hoạch sự kiện, chọn nhầm kích thước..."
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid #D6D3D1',
            fontSize: '13px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '10px',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #D6D3D1',
            background: '#FFFFFF',
            color: '#44403C',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Quay Lại
        </button>

        <button
          type="submit"
          disabled={
            isSubmitting ||
            cancelReason.trim().length < 3 ||
            cancelReason.trim().length > 500
          }
          style={{
            padding: '8px 18px',
            borderRadius: '6px',
            border: 'none',
            background: '#DC2626',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isSubmitting ? 'Đang Hủy...' : 'Xác Nhận Hủy Đơn'}
        </button>
      </div>
    </form>
  );
}

/** 10. Form Khiếu Nại Đổi Trả 24h */
function DisputeOrderForm({
  disputeReason,
  setDisputeReason,
  disputeDesc,
  setDisputeDesc,
  evidenceUrl,
  setEvidenceUrl,
  isSubmitting,
  onBack,
  onSubmit,
}) {
  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '8px',
          color: '#1E40AF',
          fontSize: '12px',
        }}
      >
        Chính sách bảo đảm Haute Couture: Quý khách được quyền
        khiếu nại đổi trả trong vòng 24 giờ kể từ thời điểm shipper
        GHN giao đồ thành công.
      </div>

      <div>
        <label
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: '#171717',
            marginBottom: '6px',
          }}
        >
          Lý Do Đổi Trả:
        </label>

        <select
          value={disputeReason}
          onChange={(e) => setDisputeReason(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid #D6D3D1',
            fontSize: '13px',
            boxSizing: 'border-box',
          }}
        >
          <option value="manufacturing_defect">
            Lỗi từ xưởng may / rách chỉ / thiếu cúc
          </option>
          <option value="stain_damage">
            Trang phục bị ố bẩn trước khi nhận
          </option>
          <option value="wrong_item">
            Giao sai mẫu / sai kích thước yêu cầu
          </option>
          <option value="other">
            Lý do kỹ thuật khác
          </option>
        </select>
      </div>

      <div>
        <label
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: '#171717',
            marginBottom: '6px',
          }}
        >
          Mô Tả Chi Tiết Lỗi:{' '}
          <span style={{ color: '#DC2626' }}>*</span>
        </label>

        <textarea
          rows={3}
          required
          value={disputeDesc}
          onChange={(e) => setDisputeDesc(e.target.value)}
          placeholder="Mô tả cụ thể vị trí lỗi trên trang phục (tối thiểu 10 ký tự)..."
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid #D6D3D1',
            fontSize: '13px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div>
        <label
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: '#171717',
            marginBottom: '6px',
          }}
        >
          Đường Dẫn Ảnh Minh Chứng (URL):
        </label>

        <input
          type="text"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="https://... (phân cách bằng dấu phẩy nếu nhiều ảnh)"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: '6px',
            border: '1px solid #D6D3D1',
            fontSize: '13px',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '10px',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: '1px solid #D6D3D1',
            background: '#FFFFFF',
            color: '#44403C',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          Quay Lại
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: '8px 18px',
            borderRadius: '6px',
            border: 'none',
            background: '#D97706',
            color: '#FFFFFF',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {isSubmitting ? 'Đang Gửi...' : 'Nộp Đơn Khiếu Nại'}
        </button>
      </div>
    </form>
  );
}

/** 11. Lightbox phóng to ảnh bằng chứng */
function EvidenceLightboxModal({ imageSrc, onClose }) {
  if (!imageSrc) return null;

  return (
    <div
      role="dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          background: '#FFFFFF',
          padding: '8px',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            borderBottom: '1px solid #E5E7EB',
            marginBottom: '8px',
          }}
        >
          <strong
            style={{
              fontSize: '13px',
              color: '#166534',
            }}
          >
            Ảnh chụp khi giao hàng thành công
          </strong>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              lineHeight: 1,
              color: '#6B7280',
            }}
          >
            ✕
          </button>
        </div>

        <img
          src={imageSrc}
          alt="Ảnh xác nhận khi nhận hàng"
          style={{
            maxWidth: '100%',
            maxHeight: '75vh',
            objectFit: 'contain',
            borderRadius: '8px',
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}

/* ==========================================================================
   MAIN COMPONENT: OrderTrackingDetailModal
   ========================================================================== */

export default function OrderTrackingDetailModal({
  isOpen,
  onClose,
  order,
  orderType = 'rental',
  onOrderUpdated,
}) {
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Các chế độ: tracking | cancel | dispute | return.
  const [viewMode, setViewMode] = useState('tracking');
  const [cancelReason, setCancelReason] = useState('');
  const [disputeReason, setDisputeReason] = useState(
    'manufacturing_defect'
  );
  const [disputeDesc, setDisputeDesc] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [selectedEvidenceImage, setSelectedEvidenceImage] =
    useState(null);

  // Giữ cơ chế xử lý hủy đơn từ main2.
  const cancellationInFlight = useRef(false);
  const cancellationContext = useRef(0);
  const cancelCloseTimer = useRef(null);

  // Nạp dữ liệu vận chuyển thời gian thực từ GHN.
  const fetchTracking = useCallback(async (code, force = false) => {
    if (!code) return;

    if (force) {
      setSyncing(true);
    } else {
      setLoading(true);
    }

    setErrorMsg('');

    try {
      const res = await trackShipmentApi(code, { force });

      if (res?.success && res.data) {
        setTrackingData(res.data);
      } else {
        setErrorMsg(
          res?.message || 'Không tìm thấy dữ liệu vận chuyển.'
        );
      }
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.message ||
          err?.message ||
          'Lỗi khi tải dữ liệu vận chuyển.'
      );
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    cancellationContext.current += 1;

    if (isOpen && order) {
      setViewMode('tracking');
      setActionError('');
      setActionSuccess('');
      cancellationInFlight.current = false;
      setIsSubmitting(false);
      setCancelReason('');
      setDisputeDesc('');

      const targetCode =
        order.orderCode ||
        order.shipment?.trackingCode ||
        order._id;

      fetchTracking(targetCode);
    } else {
      setTrackingData(null);
      setErrorMsg('');
    }

    return () => {
      cancellationContext.current += 1;
      clearTimeout(cancelCloseTimer.current);
    };
  }, [isOpen, order, fetchTracking]);

  if (!isOpen || !order) return null;

  const isRental =
    orderType === 'rental' ||
    Boolean(order.rentalFee !== undefined && order.rentalStatus);

  const orderItems =
    order.items || order.orderDetails || order.details || [];

  const currentStep = trackingData
    ? getStepIndex(
        trackingData.shipmentStatus,
        trackingData.displayStatusText
      )
    : 1;

  // Kiểm tra điều kiện nộp khiếu nại đổi trả 24h của đơn thuê.
  const isWithin24hWindow = () => {
    if (
      !['renting', 'ready_for_pickup'].includes(order.rentalStatus)
    ) {
      return false;
    }

    const baseDate =
      order.actualPickupDate ||
      order.actualDeliveryDate ||
      order.startDate ||
      order.updatedAt;

    const elapsed = Date.now() - new Date(baseDate).getTime();

    return elapsed <= 24 * 60 * 60 * 1000;
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();

    if (cancellationInFlight.current || actionSuccess) return;

    const reason = cancelReason.trim();

    if (reason.length < 3 || reason.length > 500) {
      setActionError('Lý do hủy đơn cần từ 3 đến 500 ký tự');
      return;
    }

    cancellationInFlight.current = true;

    const requestContext = cancellationContext.current;

    setIsSubmitting(true);
    setActionError('');

    try {
      const result = await cancelRentalOrder(order._id, reason);

      if (onOrderUpdated) onOrderUpdated();

      if (requestContext !== cancellationContext.current) return;

      const summary = result?.data?.refundSummary;

      setActionSuccess(
        summary
          ? `Hủy đơn thuê thành công! Hoàn vào ví ${formatCurrencyVND(
              summary.rentalFeeRefunded +
                summary.totalDepositRefunded
            )}. Phí hủy: ${formatCurrencyVND(
              summary.cancellationFee
            )}.`
          : 'Hủy đơn thuê thành công!'
      );

      cancelCloseTimer.current = setTimeout(onClose, 1200);
    } catch (err) {
      if (requestContext === cancellationContext.current) {
        setActionError(
          err?.response?.data?.message ||
            err?.message ||
            'Không thể hủy đơn thuê.'
        );
      }
    } finally {
      if (requestContext === cancellationContext.current) {
        cancellationInFlight.current = false;
        setIsSubmitting(false);
      }
    }
  };

  const handleDisputeSubmit = async (e) => {
    e.preventDefault();

    if (!disputeDesc.trim() || disputeDesc.trim().length < 10) {
      setActionError(
        'Vui lòng mô tả chi tiết lỗi phát hiện (tối thiểu 10 ký tự)'
      );
      return;
    }

    setIsSubmitting(true);
    setActionError('');

    try {
      const images = evidenceUrl.trim()
        ? evidenceUrl
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [
            'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
          ];

      await createRentalClaim(order._id, {
        reason: disputeReason,
        description: disputeDesc,
        evidenceImages: images,
      });

      setActionSuccess(
        'Đã nộp phiếu yêu cầu đổi trả 24h thành công! CSKH sẽ phản hồi trong 72h.'
      );

      setTimeout(() => {
        if (onOrderUpdated) onOrderUpdated();
        onClose();
      }, 1500);
    } catch (err) {
      setActionError(
        err?.response?.data?.message ||
          err?.message ||
          'Không thể gửi khiếu nại đổi trả.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mở đúng luồng trả hàng theo loại đơn.
  if (viewMode === 'return') {
    const ReturnWorkflow = isRental
      ? RentalReturnWorkflow
      : SalesReturnWorkflow;

    return (
      <ReturnWorkflow
        show
        orderId={order._id}
        onClose={() => {
          setViewMode('tracking');
          onOrderUpdated?.();
        }}
      />
    );
  }

  return (
    <HauteCoutureModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        viewMode === 'cancel'
          ? 'Hủy Đơn Thuê Trang Phục'
          : viewMode === 'dispute'
            ? 'Yêu Cầu Đổi Trả Do Lỗi Sản Xuất (24h)'
            : `Tiến Trình & Chi Tiết Đơn Hàng #${
                order.orderCode ||
                order._id?.slice(-6).toUpperCase()
              }`
      }
      subtitle={
        viewMode === 'tracking'
          ? `${
              isRental ? 'Đơn thuê trang phục' : 'Đơn mua sắm'
            } • Ngày đặt: ${formatDate(order.createdAt)}`
          : undefined
      }
      maxWidth="780px"
    >
      {/* Thông báo lỗi / thành công khi thao tác */}
      {actionError && (
        <div
          style={{
            padding: '12px 16px',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            color: '#DC2626',
            marginBottom: '16px',
            fontSize: '13px',
          }}
        >
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div
          style={{
            padding: '12px 16px',
            background: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '8px',
            color: '#16A34A',
            marginBottom: '16px',
            fontSize: '13px',
          }}
        >
          {actionSuccess}
        </div>
      )}

      {/* MODE 1: HỦY ĐƠN THUÊ */}
      {viewMode === 'cancel' && !actionSuccess && (
        <CancelOrderForm
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          isSubmitting={isSubmitting}
          onBack={() => setViewMode('tracking')}
          onSubmit={handleCancelSubmit}
        />
      )}

      {/* MODE 2: KHIẾU NẠI ĐỔI TRẢ 24H */}
      {viewMode === 'dispute' && (
        <DisputeOrderForm
          disputeReason={disputeReason}
          setDisputeReason={setDisputeReason}
          disputeDesc={disputeDesc}
          setDisputeDesc={setDisputeDesc}
          evidenceUrl={evidenceUrl}
          setEvidenceUrl={setEvidenceUrl}
          isSubmitting={isSubmitting}
          onBack={() => setViewMode('tracking')}
          onSubmit={handleDisputeSubmit}
        />
      )}

      {/* MODE 3: TIẾN TRÌNH VẬN CHUYỂN & CHI TIẾT ĐƠN HÀNG */}
      {viewMode === 'tracking' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {loading && !trackingData ? (
            <div
              style={{
                padding: '40px 0',
                textAlign: 'center',
                color: '#78716C',
              }}
            >
              <Loader2
                size={32}
                className="animate-spin"
                style={{
                  margin: '0 auto 12px auto',
                  display: 'block',
                  color: '#96723D',
                }}
              />

              <p style={{ fontSize: '13px', margin: 0 }}>
                Đang nạp tiến trình vận chuyển thời gian thực từ GHN...
              </p>
            </div>
          ) : errorMsg && !trackingData ? (
            <div
              style={{
                padding: '16px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '13px',
              }}
            >
              {errorMsg}
            </div>
          ) : null}

          {/* KHỐI 1: TIẾN TRÌNH VẬN CHUYỂN & TRẠNG THÁI GHN */}
          {trackingData && (
            <div
              className="tracking-result-card"
              style={{
                margin: 0,
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #E5E0D8',
              }}
            >
              <TrackingHeader trackingData={trackingData} />

              {!trackingData.hasGhnShipment && (
                <TrackingShopNotice
                  shipmentStatus={trackingData.shipmentStatus}
                />
              )}

              <TrackingStepper
                currentStep={currentStep}
                shipmentStatus={trackingData.shipmentStatus}
              />

              <TrackingInfoGrid
                receiverInfo={trackingData.receiverInfo}
                storeInfo={trackingData.storeInfo}
                expectedDeliveryTime={
                  trackingData.expectedDeliveryTime
                }
                deliveredAt={trackingData.deliveredAt}
              />

              <TrackingProofAndFailureAlerts
                deliveryProofImage={
                  trackingData.deliveryProofImage
                }
                failureReason={trackingData.failureReason}
                cancellationReason={
                  trackingData.cancellationReason
                }
                onImageClick={(img) =>
                  setSelectedEvidenceImage(img)
                }
              />

              <TrackingTimeline
                statusHistory={trackingData.statusHistory}
                onImageClick={(img) =>
                  setSelectedEvidenceImage(img)
                }
              />
            </div>
          )}

          {/* KHỐI 2: DANH SÁCH SẢN PHẨM TRONG ĐƠN */}
          <OrderProductsList orderItems={orderItems} />

          {/* KHỐI 3: CHI TIẾT TÀI CHÍNH & THANH TOÁN */}
          <OrderFinancialSummary
            order={order}
            isRental={isRental}
          />

          {/* VIDEO GIAO HÀNG VÀ NHẬN HÀNG */}
          {isRental ? (
            <RentalDeliveryVideos orderId={order._id} />
          ) : (
            <SalesDeliveryVideos orderId={order._id} />
          )}

          {/* KẾT QUẢ TRẢ HÀNG MUA */}
          {!isRental && order.returnStatus === 'completed' && (
            <div role="status" className="alert alert-success">
              Đã trả hàng hoàn tất.

              {order.paymentStatus === 'refunded' && (
                <>
                  {' '}Đã hoàn{' '}
                  {formatCurrencyVND(order.refundedAmount)}
                  {' '}vào Ví Vestora của bạn.
                </>
              )}
            </div>
          )}

          {/* KHỐI 4: CÁC NÚT HÀNH ĐỘNG */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
              paddingTop: '8px',
            }}
          >
            <div>
              {/* HỦY ĐƠN THUÊ: giữ điều kiện của main2 */}
              {isRental && order.rentalStatus === 'confirmed' && (
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

              {/* KHIẾU NẠI ĐƠN THUÊ */}
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

              {/* TRẢ HÀNG ĐÃ MUA */}
              {!isRental && order.orderStatus === 'completed' && (
                <button
                  type="button"
                  className="btn btn-primary me-2 mb-2"
                  onClick={() => setViewMode('return')}
                >
                  {order.returnStatus === 'completed'
                    ? 'Xem kết quả trả hàng'
                    : order.returnStatus &&
                        order.returnStatus !== 'none'
                      ? 'Theo dõi trả hàng mua'
                      : 'Trả hàng đã mua'}
                </button>
              )}

              {/* TRẢ ĐỒ THUÊ */}
              {isRental && order.rentalStatus !== 'cancelled' && (
                <button
                  type="button"
                  className="btn btn-primary me-2 mb-2"
                  onClick={() => setViewMode('return')}
                >
                  {['renting', 'overdue'].includes(
                    order.rentalStatus
                  )
                    ? 'Trả đồ'
                    : 'Video bàn giao / Theo dõi trả đồ'}
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
        </div>
      )}

      {/* Lightbox xem ảnh bằng chứng giao hàng */}
      <EvidenceLightboxModal
        imageSrc={selectedEvidenceImage}
        onClose={() => setSelectedEvidenceImage(null)}
      />
    </HauteCoutureModal>
  );
}