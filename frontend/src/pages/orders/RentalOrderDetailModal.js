import React, { useState, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import {
  User,
  Truck,
  ShieldCheck,
  Printer,
  CheckCircle2,
  Search,
  CalendarRange,
  Clock,
  AlertCircle,
  MapPin,
  Phone,
  Mail,
  Store,
} from 'lucide-react';
import RentalEvidenceSection from '../../components/orders/RentalEvidenceSection';
import { getRentalOrderDetailApi } from '../../services/orderApi';
import {
  formatCurrency,
  formatDate,
  DEPOSIT_STATUS_MAP,
  resolveOrderDisplayStatus,
} from './orderUtils';
import {
  ShipmentTrackingTimeline,
  ShipmentCreateModal,
  ShipmentReturnModal,
} from '../shipping';
import { cancelShipmentApi } from '../../services/shippingApi';
import '../../styles/ShopBranches.css';
import '../../styles/OrderMonitoring.css';

export default function RentalOrderDetailModal({
  isOpen,
  onClose,
  orderId,
  initialOrder = null,
  isReadOnly = false,
  onAction = () => { },
}) {
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [error, setError] = useState('');
  const [isCreateShipmentOpen, setIsCreateShipmentOpen] = useState(false);
  const [isReturnShipmentOpen, setIsReturnShipmentOpen] = useState(false);

  const refetchOrder = () => {
    if (orderId) {
      getRentalOrderDetailApi(orderId)
        .then((res) => {
          if (res.success && res.data) {
            setDetailData(res.data);
          }
        })
        .catch(() => { });
    }
  };

  const handleCancelShipment = async (shipmentId, reason) => {
    try {
      const res = await cancelShipmentApi(shipmentId, reason);
      if (res?.success) {
        refetchOrder();
      } else {
        alert(res?.message || 'Không thể hủy vận đơn.');
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi hủy vận đơn');
    }
  };

  useEffect(() => {
    if (!isOpen || !orderId) {
      setDetailData(null);
      setError('');
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError('');

    getRentalOrderDetailApi(orderId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setDetailData(res.data);
        } else {
          setError(res.message || 'Không thể tải chi tiết đơn thuê.');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Không thể tải chi tiết đơn thuê.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  const order = detailData?.order || detailData || initialOrder || {};
  const customer = order.customerId || order.customerInfo || order.customer || {};
  const customerInfo = Array.isArray(customer.Information) ? customer.Information[0] : (customer.Information || {});
  const customerName = order.shippingAddress?.receiverName || customer.FullName || customer.fullName || customer.name || 'Khách vãng lai';
  const customerPhone = order.shippingAddress?.phone || customerInfo?.Phone || customer.phone || 'Chưa cập nhật';
  const customerEmail = customer.Email || customer.email || '';
  let noteDeliveryAddress = '';
  if (order.note) {
    const match = order.note.match(/\[Giao tận nơi:\s*([^-]+?)\s*-\s*([^-]+?)\s*-\s*([^\]]+)\]/);
    if (match) noteDeliveryAddress = match[3].trim();
  }
  const customerAddress = order.shippingAddress?.street
    ? [order.shippingAddress.street, order.shippingAddress.ward, order.shippingAddress.city].filter(Boolean).join(', ')
    : (noteDeliveryAddress || customerInfo?.Address || customerInfo?.AddressDetail || customer.address || 'Nhận tại cửa hàng');
  const items = detailData?.items || order.items || initialOrder?.items || [];
  const shipments = detailData?.shipments || order.shipments || [];

  const statusDef = resolveOrderDisplayStatus(
    { ...order, shipments, shipment: detailData?.shipment || order.shipment },
    'rental',
    !isReadOnly
  );

  const depositDef = DEPOSIT_STATUS_MAP[order.depositStatus] || {
    text: order.depositStatus || 'Chưa đặt cọc',
    chipClass: 'pending',
  };

  const branchName =
    order.locationId?.shopId?.name ||
    order.locationId?.name ||
    order.branchId?.name ||
    order.branchId?.shopName ||
    order.branchName ||
    'Chi nhánh hệ thống';

  const isHQ = Boolean(
    order.locationId?.shopId?.isHQ ||
    order.locationId?.isHQ ||
    order.shopId?.isHQ ||
    order.isHQ ||
    order.branchId?.isHQ
  );

  return (
    <Modal
      show={isOpen}
      onHide={onClose}
      dialogClassName="vestora-modal-dialog"
      centered
      backdrop="static"
      animation
      size="lg"
    >
      {/* 1. Modal Header */}
      <div className="vestora-modal-header">
        <div className="modal-header-brand-wrap">
          <div className="modal-header-icon-badge create">
            <CalendarRange size={20} />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h5 className="modal-title-main">
                Đơn Thuê #{order.orderCode || String(order._id || '').slice(-6).toUpperCase()}
              </h5>
              <span className={`order-badge ${statusDef.chipClass}`}>
                <span className="order-badge-dot" />
                {statusDef.text}
              </span>
              {isReadOnly ? (
                <span className="order-readonly-badge">
                </span>
              ) : (
                <span className="order-active-branch-badge">
                  <MapPin size={12} />
                  <span>{branchName}</span>
                  {isHQ && <span className="branch-tag-hq ms-1">Trụ sở chính</span>}
                </span>
              )}
            </div>
            <p className="modal-subtitle-text">
              Ngày tạo: {formatDate(order.createdAt)} • Chi nhánh phục vụ: {branchName}
              {isHQ && <span className="branch-tag-hq ms-2">Trụ sở chính</span>}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-close"
          onClick={onClose}
          aria-label="Đóng"
        />
      </div>

      {/* 2. Modal Body */}
      <div className="vestora-modal-body">
        {loading ? (
          <div className="p-4 text-center">
            <div className="order-skeleton" style={{ height: '70px', marginBottom: '16px' }} />
            <div className="order-skeleton" style={{ height: '140px', marginBottom: '16px' }} />
            <div className="order-skeleton" style={{ height: '90px' }} />
          </div>
        ) : error ? (
          <div className="order-error-banner m-3">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        ) : (
          <>
            {/* Section 1: Khách hàng & Lịch trình thuê */}
            <div className="modal-section-card">
              <div className="modal-section-header">
                <span className="modal-section-title">
                  <User size={16} className="text-primary me-2" />
                  <span>1. Khách Hàng & Thời Gian Thuê</span>
                </span>
                <span className="modal-section-badge">
                  {branchName}
                </span>
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-6 border-end">
                  <div className="small text-muted mb-1">Thông tin liên hệ</div>
                  <div className="fw-semibold text-dark fs-6">
                    {customerName}
                  </div>
                  <div className="small text-muted d-flex align-items-center gap-1 mt-1">
                    <Phone size={13} />
                    <span>{customerPhone}</span>
                  </div>
                  {customerEmail && (
                    <div className="small text-muted d-flex align-items-center gap-1 mt-1">
                      <Mail size={13} />
                      <span>{customerEmail}</span>
                    </div>
                  )}
                  {customerAddress && (
                    <div className="small text-muted d-flex align-items-center gap-1 mt-1">
                      <MapPin size={13} />
                      <span className="text-truncate">{customerAddress}</span>
                    </div>
                  )}
                </div>

                <div className="col-12 col-md-6 ps-md-3">
                  <div className="small text-muted mb-1">Thời gian thuê trang phục</div>
                  <div className="d-flex align-items-center gap-2">
                    <Clock size={16} className="text-primary" />
                    <div>
                      <div className="small">
                        Bắt đầu:{' '}
                        <strong>
                          {order.rentalStartDate ? formatDate(order.rentalStartDate) : 'Chưa giao đồ'}
                        </strong>
                      </div>
                      <div className="small mt-1">
                        Hạn trả:{' '}
                        <strong className="text-danger">
                          {order.rentalEndDate ? formatDate(order.rentalEndDate) : 'Chưa ấn định'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {order.actualReturnDate && (
                    <div className="small text-success mt-2 pt-2 border-top">
                      Đã trả ngày: {formatDate(order.actualReturnDate)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Danh sách trang phục thuê */}
            <div className="modal-section-card">
              <div className="modal-section-header">
                <span className="modal-section-title">
                  <CalendarRange size={16} className="text-primary me-2" />
                  <span>2. Danh Sách Trang Phục Thuê ({items.length})</span>
                </span>
              </div>

              <div className="order-items-table-wrap">
                <table className="order-items-table">
                  <thead>
                    <tr>
                      <th>Sản phẩm / Mẫu đồ</th>
                      <th style={{ width: '90px' }}>Phân loại</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>SL</th>
                      <th style={{ width: '140px', textAlign: 'right' }}>Tiền thuê (VND)</th>
                      <th style={{ width: '140px', textAlign: 'right' }}>Tiền cọc (VND)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-3 text-muted">
                          Không có thông tin sản phẩm
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={it._id || idx}>
                          <td>
                            <div className="order-product-name">
                              {it.variantId?.productId?.name || it.productName || it.name || 'Trang phục'}
                            </div>
                            <div className="order-product-variant">
                              SKU: {it.variantId?.sku || it.sku || it.productSku || '—'}
                            </div>
                          </td>
                          <td>
                            <span className="badge bg-light text-dark border">
                              {it.variantId?.size || it.size || 'F'} • {it.variantId?.color || it.color || 'Mặc định'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>
                            {it.quantity || 1}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {formatCurrency(it.rentalPrice || it.price || it.variantId?.productId?.rentalPricePerDay)}
                          </td>
                          <td style={{ textAlign: 'right', color: '#D97706', fontWeight: 600 }}>
                            {formatCurrency(it.depositAmount || it.deposit || it.variantId?.productId?.deposit)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Tiền cọc & Tài chính */}
            <div className="modal-section-card">
              <div className="modal-section-header">
                <span className="modal-section-title">
                  <ShieldCheck size={16} className="text-success me-2" />
                  <span>3. Tiền Cọc & Thanh Toán Đơn Hàng</span>
                </span>
                <span className={`order-badge ${depositDef.chipClass}`}>
                  <span className="order-badge-dot" />
                  {depositDef.text}
                </span>
              </div>

              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div>
                  <div className="small text-muted">
                    Trạng thái tiền cọc: <strong>{depositDef.text}</strong>
                  </div>
                  {order.note && (
                    <div className="small text-muted mt-1">
                      <strong>Ghi chú:</strong> {order.note}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="small text-muted">
                    Tiền thuê trang phục:{' '}
                    <strong className="text-dark" style={{ fontFeatureSettings: 'tnum' }}>
                      {formatCurrency(order.rentalFee)}
                    </strong>
                  </div>
                  <div className="small text-muted mt-1">
                    Tiền cọc giữ đồ:{' '}
                    <strong style={{ color: '#D97706', fontFeatureSettings: 'tnum' }}>
                      {formatCurrency(order.depositAmount)}
                    </strong>
                  </div>
                  <div className="mt-2 pt-2 border-top">
                    <span className="small text-muted me-2">Tổng thanh toán ban đầu:</span>
                    <strong style={{ fontSize: '18px', color: '#059669', fontFeatureSettings: 'tnum' }}>
                      {formatCurrency((order.rentalFee || 0) + (order.depositAmount || 0))}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Vận Chuyển & Giao Nhận */}
            {(() => {
              const isPickup = order?.deliveryMethod === 'pickup' || (order?.note && order.note.includes('Nhận tại'));
              const hasActiveOutbound = shipments.some(
                (s) => s.shipmentType === 'outbound' && ['preparing', 'shipped'].includes(s.shipmentStatus) && s.trackingCode && !s.trackingCode.startsWith('SHP-') && !s.trackingCode.startsWith('TRK-')
              );
              const hasActiveReturn = shipments.some(
                (s) => s.shipmentType === 'return' && ['preparing', 'shipped'].includes(s.shipmentStatus) && s.trackingCode && !s.trackingCode.startsWith('SHP-') && !s.trackingCode.startsWith('TRK-')
              );
              const canCreateOutbound = !isReadOnly && !isPickup && !hasActiveOutbound && ['draft', 'confirmed'].includes(order.rentalStatus || order.status);
              const canCreateReturn = !isReadOnly && !hasActiveReturn && ['renting', 'partially_returned', 'overdue'].includes(order.rentalStatus || order.status);

              return (
                <>
                  {/* 4. Vận chuyển và giao nhận */}
                  <div className="modal-section-card">
                    <div className="modal-section-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                      <span className="modal-section-title">
                        <Truck
                          size={16}
                          className="text-primary me-2"
                        />

                        <span>
                          4. Vận Chuyển & Giao Nhận (GHN)
                        </span>
                      </span>

                      <div className="d-flex align-items-center gap-2">
                        {isPickup && (
                          <span className="badge bg-light text-secondary border px-2 py-1 d-flex align-items-center gap-1">
                            <Store size={13} />
                            <span>Nhận tại Showroom</span>
                          </span>
                        )}

                        {canCreateOutbound && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary d-flex align-items-center gap-1"
                            onClick={() => setIsCreateShipmentOpen(true)}
                          >
                            <Truck size={14} />
                            <span>+ Tạo vận đơn GHN</span>
                          </button>
                        )}

                        {canCreateReturn && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-info d-flex align-items-center gap-1"
                            onClick={() => setIsReturnShipmentOpen(true)}
                          >
                            <Truck size={14} />
                            <span>+ Thu hồi đồ thuê</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {shipments.length > 0 ? (
                      <div className="mt-3">
                        {shipments.map((s) => (
                          <ShipmentTrackingTimeline
                            key={s._id}
                            shipment={s}
                            onCancel={handleCancelShipment}
                            onRetry={(targetShipment) => {
                              if (
                                (targetShipment || s)?.shipmentType === 'return'
                              ) {
                                setIsReturnShipmentOpen(true);
                              } else {
                                setIsCreateShipmentOpen(true);
                              }
                            }}
                            isBranchManager={!isReadOnly}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="small text-muted py-2 fst-italic">
                        Đơn hàng chưa tạo vận đơn chuyển phát nào qua GHN.
                      </div>
                    )}
                  </div>

                  {/* 5. Video bằng chứng giao nhận */}
                  {(orderId || order._id) && (
                    <RentalEvidenceSection
                      key={orderId || order._id}
                      orderId={orderId || order._id}
                    />
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>

      {/* 3. Modal Footer */}
      <div className="vestora-modal-footer">
        {isReadOnly ? (
          <div className="d-flex justify-content-end w-100">
            <button
              type="button"
              className="btn-modal-secondary px-4"
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        ) : (
          <div className="d-flex justify-content-between align-items-center w-100">
            <button
              type="button"
              className="btn-modal-secondary"
              onClick={onClose}
            >
              Đóng
            </button>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="btn-modal-secondary d-flex align-items-center gap-1"
                onClick={() => onAction('print', order)}
              >
                <Printer size={15} />
                <span>In Phiếu Bàn Giao</span>
              </button>

              {order.rentalStatus === 'draft' && (
                <button
                  type="button"
                  className="btn-modal-primary d-flex align-items-center gap-1"
                  onClick={() => onAction('confirm', order)}
                >
                  <CheckCircle2 size={15} />
                  <span>Xác Nhận Đơn</span>
                </button>
              )}

              {(order.rentalStatus === 'renting' || order.rentalStatus === 'confirmed') && (
                <button
                  type="button"
                  className="btn-modal-primary d-flex align-items-center gap-1"
                  style={{ background: '#059669', borderColor: '#059669' }}
                  onClick={() => onAction('inspect_return', order)}
                >
                  <Search size={15} />
                  <span>Nghiệm Thu Trả Đồ</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Shipment Create Modal */}
      <ShipmentCreateModal
        show={isCreateShipmentOpen}
        onClose={() => setIsCreateShipmentOpen(false)}
        order={order}
        orderType="rental"
        onSuccess={() => refetchOrder()}
      />

      {/* Shipment Return Modal */}
      <ShipmentReturnModal
        show={isReturnShipmentOpen}
        onClose={() => setIsReturnShipmentOpen(false)}
        order={order}
        onSuccess={() => refetchOrder()}
      />
    </Modal>
  );
}

