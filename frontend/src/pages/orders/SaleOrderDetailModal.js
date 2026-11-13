import React, { useState, useEffect } from 'react';
import { Modal } from 'react-bootstrap';
import {
  User,
  Truck,
  CreditCard,
  Printer,
  PackageCheck,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShoppingBag,
  Clock,
  MapPin,
  Phone,
  Mail,
  Store,
} from 'lucide-react';
import { getSaleOrderDetailApi } from '../../services/orderApi';
import {
  formatCurrency,
  formatDate,
  PAYMENT_STATUS_MAP,
  resolveOrderDisplayStatus,
} from './orderUtils';
import {
  ShipmentTrackingTimeline,
  ShipmentCreateModal,
} from '../shipping';
import { cancelShipmentApi } from '../../services/shippingApi';
import '../../styles/ShopBranches.css';
import '../../styles/OrderMonitoring.css';

export default function SaleOrderDetailModal({
  isOpen,
  onClose,
  orderId,
  initialOrder = null,
  isReadOnly = false,
  onAction = () => {},
}) {
  const [loading, setLoading] = useState(false);
  const [detailData, setDetailData] = useState(null);
  const [error, setError] = useState('');
  const [isCreateShipmentOpen, setIsCreateShipmentOpen] = useState(false);
  const [retryShipment, setRetryShipment] = useState(null);

  const refetchOrder = () => {
    if (orderId) {
      getSaleOrderDetailApi(orderId)
        .then((res) => {
          if (res.success && res.data) {
            setDetailData(res.data);
          }
        })
        .catch(() => {});
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

    getSaleOrderDetailApi(orderId)
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setDetailData(res.data);
        } else {
          setError(res.message || 'Không thể tải chi tiết đơn bán.');
        }
        setLoading(false);
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Không thể tải chi tiết đơn bán.');
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
  const rawShipments = detailData?.shipments || order.shipments || [];
  const shipments = Array.isArray(rawShipments)
    ? [...rawShipments].sort((a, b) => {
        const timeA = new Date(a.createdAt || a.updatedAt || 0).getTime();
        const timeB = new Date(b.createdAt || b.updatedAt || 0).getTime();
        return timeB - timeA; // Vận đơn mới nhất lên trên đầu
      })
    : [];

  const statusDef = resolveOrderDisplayStatus(
    { ...order, shipments, shipment: detailData?.shipment || order.shipment },
    'sale',
    !isReadOnly
  );

  const paymentDef = PAYMENT_STATUS_MAP[order.paymentStatus] || {
    text: order.paymentStatus || 'Chưa thanh toán',
    chipClass: 'cancelled',
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
            <ShoppingBag size={20} />
          </div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h5 className="modal-title-main">
                Đơn Bán #{order.orderCode || String(order._id || '').slice(-6).toUpperCase()}
              </h5>
              <span className={`order-badge ${statusDef.chipClass}`}>
                <span className="order-badge-dot" />
                {statusDef.text}
              </span>
              <span className={`order-badge ${paymentDef.chipClass}`}>
                <CreditCard size={12} className="me-1" />
                {paymentDef.text}
              </span>
              {isReadOnly ? (
                <span className="order-readonly-badge">
                  <ShieldCheck size={12} />
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
              Ngày đặt: {formatDate(order.createdAt)} • Chi nhánh xuất hàng: {branchName}
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
            {/* Section 1: Khách hàng & Giao nhận */}
            <div className="modal-section-card">
              <div className="modal-section-header">
                <span className="modal-section-title">
                  <User size={16} className="text-primary me-2" />
                  <span>1. Khách Hàng & Địa Chỉ Nhận Hàng</span>
                </span>
                <span className="modal-section-badge">
                  {branchName}
                </span>
              </div>

              <div className="row g-3">
                <div className="col-12 col-md-6 border-end">
                  <div className="small text-muted mb-1">Người nhận</div>
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
                </div>

                <div className="col-12 col-md-6 ps-md-3">
                  <div className="small text-muted mb-1">Địa chỉ giao hàng</div>
                  <div className="d-flex align-items-start gap-2">
                    <MapPin size={16} className="text-primary mt-1 flex-shrink-0" />
                    <div>
                      <div className="text-dark fw-medium small">
                        {customerAddress}
                      </div>
                    </div>
                  </div>

                  <div className="small text-muted d-flex align-items-center gap-2 mt-2 pt-2 border-top">
                    <Clock size={13} />
                    <span>Tạo lúc: {formatDate(order.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Danh sách sản phẩm mua */}
            <div className="modal-section-card">
              <div className="modal-section-header">
                <span className="modal-section-title">
                  <ShoppingBag size={16} className="text-primary me-2" />
                  <span>2. Danh Sách Sản Phẩm Mua ({items.length})</span>
                </span>
              </div>

              <div className="order-items-table-wrap">
                <table className="order-items-table">
                  <thead>
                    <tr>
                      <th>Sản phẩm / Mẫu hàng</th>
                      <th style={{ width: '90px' }}>Phân loại</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>SL</th>
                      <th style={{ width: '140px', textAlign: 'right' }}>Đơn giá (VND)</th>
                      <th style={{ width: '140px', textAlign: 'right' }}>Thành tiền (VND)</th>
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
                              {it.variantId?.productId?.name || it.productName || it.name || 'Sản phẩm thời trang'}
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
                            {formatCurrency(it.unitPrice || it.price || it.variantId?.productId?.salePrice)}
                          </td>
                          <td style={{ textAlign: 'right', color: '#0F172A', fontWeight: 600 }}>
                            {formatCurrency((it.unitPrice || it.price || it.variantId?.productId?.salePrice || 0) * (it.quantity || 1))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Thanh toán & Hóa đơn */}
            <div className="modal-section-card">
              <div className="modal-section-header">
                <span className="modal-section-title">
                  <CreditCard size={16} className="text-primary me-2" />
                  <span>3. Thanh Toán & Tổng Tiền Hóa Đơn</span>
                </span>
                <span className={`order-badge ${paymentDef.chipClass}`}>
                  <CreditCard size={12} className="me-1" />
                  {paymentDef.text}
                </span>
              </div>

              <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
                <div>
                  <div className="small text-muted">
                    Phương thức thanh toán:{' '}
                    <strong>{order.paymentMethod === 'bank_transfer' ? 'Chuyển khoản / PayOS' : order.paymentMethod || 'Tiền mặt'}</strong>
                  </div>
                  <div className="small text-muted mt-1">
                    Trạng thái hóa đơn: <strong className="text-dark">{paymentDef.text}</strong>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div className="small text-muted">
                    Tiền hàng:{' '}
                    <strong className="text-dark" style={{ fontFeatureSettings: 'tnum' }}>
                      {formatCurrency(order.subtotal || order.totalAmount)}
                    </strong>
                  </div>
                  {order.discountAmount > 0 && (
                    <div className="small text-success mt-1">
                      Giảm giá:{' '}
                      <strong style={{ fontFeatureSettings: 'tnum' }}>
                        -{formatCurrency(order.discountAmount)}
                      </strong>
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-top">
                    <span className="small text-muted me-2">Tổng thanh toán:</span>
                    <strong style={{ fontSize: '18px', color: '#0F172A', fontFeatureSettings: 'tnum' }}>
                      {formatCurrency(order.totalAmount || order.finalAmount)}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Vận đơn giao hàng GHN */}
            {(() => {
              const isPickup = order?.deliveryMethod === 'pickup' || (order?.note && order.note.includes('Nhận tại'));
              const hasActiveOutbound = shipments.some(
                (s) => s.shipmentType === 'outbound' && ['preparing', 'shipped'].includes(s.shipmentStatus) && s.trackingCode && !s.trackingCode.startsWith('SHP-') && !s.trackingCode.startsWith('TRK-')
              );
              const canCreateOutbound = !isReadOnly && !isPickup && !hasActiveOutbound && ['draft', 'confirmed', 'processing'].includes(order.orderStatus || order.status);

              return (
                <div className="modal-section-card">
                  <div className="modal-section-header d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <span className="modal-section-title">
                      <Truck size={16} className="text-primary me-2" />
                      <span>4. Vận Chuyển & Giao Hàng (GHN)</span>
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
                          onClick={() => {
                            setRetryShipment(null);
                            setIsCreateShipmentOpen(true);
                          }}
                        >
                          <Truck size={14} />
                          <span>+ Tạo vận đơn GHN</span>
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
                          onRetry={
                            !hasActiveOutbound
                              ? (targetShipment) => {
                                  setRetryShipment(targetShipment || s);
                                  setIsCreateShipmentOpen(true);
                                }
                              : null
                          }
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
                <span>In Hóa Đơn</span>
              </button>

              {order.orderStatus === 'confirmed' && (
                <button
                  type="button"
                  className="btn-modal-primary d-flex align-items-center gap-1"
                  onClick={() => onAction('start_packing', order)}
                >
                  <PackageCheck size={15} />
                  <span>Bắt Đầu Đóng Gói</span>
                </button>
              )}

              {order.orderStatus === 'processing' && (
                <button
                  type="button"
                  className="btn-modal-primary d-flex align-items-center gap-1"
                  style={{ background: '#059669', borderColor: '#059669' }}
                  onClick={() => onAction('complete', order)}
                >
                  <CheckCircle2 size={15} />
                  <span>Xác Nhận Đã Giao</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Shipment Create Modal */}
      <ShipmentCreateModal
        show={isCreateShipmentOpen}
        onClose={() => {
          setIsCreateShipmentOpen(false);
          setRetryShipment(null);
        }}
        order={order}
        initialShipment={retryShipment}
        orderType="sale"
        onSuccess={() => refetchOrder()}
      />
    </Modal>
  );
}

