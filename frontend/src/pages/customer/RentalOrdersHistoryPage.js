/**
 * Customer Orders History Page (Rental & Sale)
 * Trang lịch sử đơn thuê và đơn mua trang phục của khách hàng
 * Quản lý chu kỳ thuê, hạn trả đồ, theo dõi đơn mua đứt và vận chuyển
 * Zero-Alert, Zero-Emoji, Haute Couture Design
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import RentalOrderDetailModal from '../../components/customer/RentalOrderDetailModal';
import HauteCoutureModal from '../../components/HauteCoutureModal';
import { getRentalOrders } from '../../services/rentalOrderApi';
import { getMySalesOrders } from '../../services/salesOrderApi';
import { formatCurrencyVND } from '../../services/cart/cartCalculations';
import {
  Calendar,
  Package,
  ShoppingBag,
  Loader2,
  ChevronRight,
  AlertCircle,
  MapPin,
  Truck,
  Wallet,
  Banknote,
} from 'lucide-react';
import '../../styles/RentalOrdersHistory.css';

const RENTAL_TABS = [
  { id: 'all', label: 'Tất Cả Đơn Thuê' },
  { id: 'renting', label: 'Đang Trải Nghiệm' },
  { id: 'confirmed', label: 'Đã Đặt / Chuẩn Bị' },
  { id: 'returned', label: 'Đã Hoàn Tất' },
  { id: 'cancelled', label: 'Đã Hủy' },
];

const SALE_TABS = [
  { id: 'all', label: 'Tất Cả Đơn Mua' },
  { id: 'confirmed', label: 'Chờ Đóng Gói' },
  { id: 'processing', label: 'Đang Chuẩn Bị' },
  { id: 'shipped', label: 'Đang Giao Vận' },
  { id: 'completed', label: 'Đã Nhận Hàng' },
  { id: 'cancelled', label: 'Đã Hủy' },
];

const RENTAL_STATUS_MAP = {
  pending_payment: { label: 'Chờ Thanh Toán', color: '#D97706', bg: '#FFFBEB' },
  confirmed:       { label: 'Đã Xác Nhận',    color: '#2563EB', bg: '#EFF6FF' },
  preparing:       { label: 'Đang Chuẩn Bị',  color: '#7C3AED', bg: '#F5F3FF' },
  ready_for_pickup:{ label: 'Chờ Nhận Đồ',    color: '#059669', bg: '#ECFDF5' },
  renting:         { label: 'Đang Trải Nghiệm',color: '#0284C7', bg: '#F0F9FF' },
  overdue:         { label: 'Quá Hạn Trả',    color: '#DC2626', bg: '#FEF2F2' },
  returned:        { label: 'Đã Hoàn Trả',    color: '#16A34A', bg: '#F0FDF4' },
  cancelled:       { label: 'Đã Hủy',         color: '#6B7280', bg: '#F3F4F6' },
};

const SALE_STATUS_MAP = {
  confirmed:  { label: 'Chờ Đóng Gói', color: '#2563EB', bg: '#EFF6FF' },
  processing: { label: 'Đang Chuẩn Bị', color: '#96723D', bg: '#FAF5EE' },
  shipped:    { label: 'Đang Giao Hàng', color: '#7C3AED', bg: '#F5F3FF' },
  completed:  { label: 'Đã Giao Thành Công', color: '#16A34A', bg: '#F0FDF4' },
  cancelled:  { label: 'Đã Hủy', color: '#DC2626', bg: '#FEF2F2' },
};

function getRentalStatusInfo(status) {
  return RENTAL_STATUS_MAP[status] || { label: status, color: '#4B5563', bg: '#F3F4F6' };
}

function getSaleStatusInfo(status) {
  return SALE_STATUS_MAP[status] || { label: status, color: '#4B5563', bg: '#F3F4F6' };
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function RentalOrdersHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = searchParams.get('tab') === 'sale' ? 'sales' : 'rentals';

  const [category, setCategory] = useState(initialCategory); // 'rentals' | 'sales'
  const [activeRentalTab, setActiveRentalTab] = useState('all');
  const [activeSaleTab, setActiveSaleTab] = useState('all');

  // Dữ liệu đơn thuê
  const [rentalOrders, setRentalOrders] = useState([]);
  const [isRentalLoading, setIsRentalLoading] = useState(false);
  const [rentalError, setRentalError] = useState('');
  const [selectedRentalOrder, setSelectedRentalOrder] = useState(null);

  // Dữ liệu đơn mua
  const [saleOrders, setSaleOrders] = useState([]);
  const [isSaleLoading, setIsSaleLoading] = useState(false);
  const [saleError, setSaleError] = useState('');
  const [selectedSaleOrder, setSelectedSaleOrder] = useState(null);

  // Đổi category tab
  const handleCategoryChange = (newCat) => {
    setCategory(newCat);
    setSearchParams(newCat === 'sales' ? { tab: 'sale' } : { tab: 'rental' });
  };

  // Nạp đơn thuê
  const fetchRentalOrders = useCallback(async () => {
    setIsRentalLoading(true);
    setRentalError('');
    try {
      const params = {};
      if (activeRentalTab !== 'all') params.status = activeRentalTab;
      const res = await getRentalOrders(params);
      setRentalOrders(res.data || []);
    } catch (err) {
      setRentalError(err.message || 'Không thể tải lịch sử đơn thuê.');
    } finally {
      setIsRentalLoading(false);
    }
  }, [activeRentalTab]);

  // Nạp đơn mua
  const fetchSaleOrders = useCallback(async () => {
    setIsSaleLoading(true);
    setSaleError('');
    try {
      const params = {};
      if (activeSaleTab !== 'all') params.status = activeSaleTab;
      const res = await getMySalesOrders(params);
      setSaleOrders(res.data || []);
    } catch (err) {
      setSaleError(err.message || 'Không thể tải lịch sử đơn mua.');
    } finally {
      setIsSaleLoading(false);
    }
  }, [activeSaleTab]);

  useEffect(() => {
    if (category === 'rentals') {
      fetchRentalOrders();
    } else {
      fetchSaleOrders();
    }
  }, [category, fetchRentalOrders, fetchSaleOrders]);

  return (
    <div className="rental-history-page">
      <Navbar />

      <main className="rental-history-main">
        {/* ── Header ── */}
        <header className="rental-history-header">
          <h1 className="rental-history-title">
            {category === 'rentals' ? 'Lịch Sử Thuê Trang Phục' : 'Lịch Sử Mua Sắm'}
          </h1>
          <p className="rental-history-subtitle">
            {category === 'rentals'
              ? 'Theo dõi hành trình trang phục Haute Couture bạn đang thuê từ Vestora.'
              : 'Theo dõi các sản phẩm thời trang bạn đã sở hữu từ Vestora.'}
          </p>

          {/* ── Bộ chuyển đổi Danh mục chính (Rentals vs Sales) ── */}
          <div
            style={{
              display: 'inline-flex',
              background: '#F4F4F5',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid #E5E0D8',
              marginTop: '20px',
            }}
          >
            <button
              type="button"
              onClick={() => handleCategoryChange('rentals')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: category === 'rentals' ? '#171717' : 'transparent',
                color: category === 'rentals' ? '#FAF9F6' : '#52525B',
                transition: 'all 0.2s',
              }}
            >
              <Calendar size={16} />
              <span>Đơn Thuê Trang Phục</span>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange('sales')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 20px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: category === 'sales' ? '#171717' : 'transparent',
                color: category === 'sales' ? '#FAF9F6' : '#52525B',
                transition: 'all 0.2s',
              }}
            >
              <ShoppingBag size={16} />
              <span>Đơn Mua Sắm</span>
            </button>
          </div>
        </header>

        {/* ========================================================
            TAB 1: ĐƠN THUÊ TRANG PHỤC (RENTALS)
            ======================================================== */}
        {category === 'rentals' && (
          <>
            {/* Filter Tabs */}
            <div className="rental-history-tabs">
              {RENTAL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveRentalTab(tab.id)}
                  className={`rental-history-tab${activeRentalTab === tab.id ? ' rental-history-tab--active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Error */}
            {rentalError && (
              <div className="rental-history-error">
                <AlertCircle size={16} />
                <span>{rentalError}</span>
              </div>
            )}

            {/* Loading */}
            {isRentalLoading ? (
              <div className="rental-history-loading">
                <Loader2 size={32} className="roh-spin" />
                <p>Đang nạp danh sách đơn thuê của quý khách...</p>
              </div>
            ) : rentalOrders.length === 0 ? (
              <div className="rental-history-empty">
                <Package size={42} style={{ color: '#D6D3D1', margin: '0 auto 16px auto', display: 'block' }} />
                <h3>Chưa có đơn thuê nào</h3>
                <p>Khám phá bộ sưu tập đầm dạ hội và áo dài Haute Couture để trải nghiệm ngay hôm nay.</p>
                <Link
                  to="/catalog"
                  style={{
                    display: 'inline-block',
                    padding: '10px 24px',
                    backgroundColor: '#171717',
                    color: '#F8F7F4',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Khám Phá Bộ Sưu Tập Thuê
                </Link>
              </div>
            ) : (
              <div className="rental-history-list">
                {rentalOrders.map((o) => {
                  const statusInfo = getRentalStatusInfo(o.rentalStatus);
                  const items = o.items || o.orderDetails || [];
                  const orderLabel = o.orderCode || o._id?.slice(-6).toUpperCase();

                  return (
                    <div
                      key={o._id}
                      className="rental-order-card"
                      onClick={() => setSelectedRentalOrder(o)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedRentalOrder(o)}
                      aria-label={`Xem chi tiết đơn thuê ${orderLabel}`}
                    >
                      <div className="rental-order-card__header">
                        <div>
                          <div className="rental-order-card__code">#{orderLabel}</div>
                          <div className="rental-order-card__date">Ngày đặt: {formatDate(o.createdAt)}</div>
                        </div>
                        <span
                          className="rental-order-status-badge"
                          style={{ color: statusInfo.color, backgroundColor: statusInfo.bg }}
                        >
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="rental-order-card__meta">
                        <div className="rental-order-card__meta-item">
                          <Package size={14} color="#C5A880" />
                          <span>
                            {items[0]?.productName || items[0]?.name || 'Trang phục Haute Couture'}
                            {items.length > 1 && ` và ${items.length - 1} món khác`}
                          </span>
                        </div>
                        <div className="rental-order-card__meta-item">
                          <Calendar size={14} color="#C5A880" />
                          <span>{formatDate(o.startDate)} → {formatDate(o.dueDate)}</span>
                        </div>
                      </div>

                      <div className="rental-order-card__footer">
                        <div className="rental-order-card__price-block">
                          <span className="rental-order-card__price-label">Tiền thuê</span>
                          <span className="rental-order-card__price-value">{formatCurrencyVND(o.rentalFee)}</span>
                          <span className="rental-order-card__price-deposit">Cọc: {formatCurrencyVND(o.depositAmount)}</span>
                        </div>
                        <button
                          type="button"
                          className="rental-order-card__view-btn"
                          onClick={(e) => { e.stopPropagation(); setSelectedRentalOrder(o); }}
                        >
                          <span>Xem Chi Tiết</span>
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ========================================================
            TAB 2: ĐƠN MUA SẮM (SALES ORDERS)
            ======================================================== */}
        {category === 'sales' && (
          <>
            {/* Filter Tabs */}
            <div className="rental-history-tabs">
              {SALE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSaleTab(tab.id)}
                  className={`rental-history-tab${activeSaleTab === tab.id ? ' rental-history-tab--active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Error */}
            {saleError && (
              <div className="rental-history-error">
                <AlertCircle size={16} />
                <span>{saleError}</span>
              </div>
            )}

            {/* Loading */}
            {isSaleLoading ? (
              <div className="rental-history-loading">
                <Loader2 size={32} className="roh-spin" />
                <p>Đang nạp danh sách đơn mua của quý khách...</p>
              </div>
            ) : saleOrders.length === 0 ? (
              <div className="rental-history-empty">
                <ShoppingBag size={42} style={{ color: '#D6D3D1', margin: '0 auto 16px auto', display: 'block' }} />
                <h3>Chưa có đơn mua sắm nào</h3>
                <p>Khám phá các thiết kế thanh lý & mua đứt độc quyền từ Vestora để bổ sung vào tủ đồ của bạn.</p>
                <Link
                  to="/catalog"
                  style={{
                    display: 'inline-block',
                    padding: '10px 24px',
                    backgroundColor: '#171717',
                    color: '#F8F7F4',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Khám Phá Bộ Sưu Tập Mua
                </Link>
              </div>
            ) : (
              <div className="rental-history-list">
                {saleOrders.map((o) => {
                  const statusInfo = getSaleStatusInfo(o.orderStatus);
                  const items = o.items || [];
                  const firstItem = items[0];

                  return (
                    <div
                      key={o._id}
                      className="rental-order-card"
                      onClick={() => setSelectedSaleOrder(o)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedSaleOrder(o)}
                      aria-label={`Xem chi tiết đơn mua ${o.orderCode}`}
                    >
                      <div className="rental-order-card__header">
                        <div>
                          <div className="rental-order-card__code">#{o.orderCode}</div>
                          <div className="rental-order-card__date">Ngày đặt: {formatDate(o.createdAt)}</div>
                        </div>
                        <span
                          className="rental-order-status-badge"
                          style={{ color: statusInfo.color, backgroundColor: statusInfo.bg }}
                        >
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="rental-order-card__meta">
                        <div className="rental-order-card__meta-item">
                          <ShoppingBag size={14} color="#C5A880" />
                          <span>
                            {firstItem?.variantId?.productId?.name || 'Sản phẩm mua đứt Haute Couture'}
                            {items.length > 1 && ` và ${items.length - 1} món khác`}
                          </span>
                        </div>
                        <div className="rental-order-card__meta-item">
                          {o.paymentMethod === 'wallet' ? (
                            <>
                              <Wallet size={14} color="#15803D" />
                              <span style={{ color: '#15803D', fontWeight: 600 }}>Ví Vestora (Đã trừ ví)</span>
                            </>
                          ) : (
                            <>
                              <Banknote size={14} color="#B45309" />
                              <span style={{ color: '#B45309', fontWeight: 600 }}>
                                Thanh toán khi nhận hàng (COD)
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="rental-order-card__footer">
                        <div className="rental-order-card__price-block">
                          <span className="rental-order-card__price-label">Tổng thanh toán</span>
                          <span className="rental-order-card__price-value" style={{ color: '#96723D' }}>
                            {formatCurrencyVND(o.totalAmount)}
                          </span>
                          <span className="rental-order-card__price-deposit" style={{ color: '#16A34A' }}>
                            Miễn phí giao hàng
                          </span>
                        </div>
                        <button
                          type="button"
                          className="rental-order-card__view-btn"
                          onClick={(e) => { e.stopPropagation(); setSelectedSaleOrder(o); }}
                        >
                          <span>Xem Chi Tiết</span>
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />

      {/* Modal chi tiết đơn thuê */}
      <RentalOrderDetailModal
        isOpen={Boolean(selectedRentalOrder)}
        onClose={() => setSelectedRentalOrder(null)}
        order={selectedRentalOrder}
        onOrderUpdated={fetchRentalOrders}
      />

      {/* Modal chi tiết đơn mua (Haute Couture) */}
      <HauteCoutureModal
        isOpen={Boolean(selectedSaleOrder)}
        onClose={() => setSelectedSaleOrder(null)}
        title={`Đơn Mua: ${selectedSaleOrder?.orderCode || ''}`}
        subtitle="Chi tiết kiện hàng và tiến trình vận chuyển"
      >
        {selectedSaleOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '8px 0' }}>
            {/* Trạng thái & Phương thức */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: '#FAF9F6',
                borderRadius: '8px',
                border: '1px solid #E5E0D8',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', color: '#71717A', display: 'block' }}>Trạng thái đơn:</span>
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: '4px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: getSaleStatusInfo(selectedSaleOrder.orderStatus).color,
                    background: getSaleStatusInfo(selectedSaleOrder.orderStatus).bg,
                  }}
                >
                  {getSaleStatusInfo(selectedSaleOrder.orderStatus).label}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: '#71717A', display: 'block' }}>Thanh toán:</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#171717', marginTop: '4px', display: 'block' }}>
                  {selectedSaleOrder.paymentMethod === 'wallet' ? 'Ví nội bộ Vestora' : 'Thanh toán COD'}
                </span>
              </div>
            </div>

            {/* Địa chỉ nhận hàng */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid #E5E0D8',
                background: '#FFFFFF',
              }}
            >
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#171717', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={15} color="#96723D" />
                <span>Địa chỉ nhận hàng</span>
              </h4>
              <div style={{ fontSize: '13px', color: '#3F3F46', lineHeight: 1.6 }}>
                <div><strong>Người nhận:</strong> {selectedSaleOrder.shippingAddress?.receiverName} ({selectedSaleOrder.shippingAddress?.phone})</div>
                <div><strong>Địa chỉ:</strong> {selectedSaleOrder.shippingAddress?.street}, {selectedSaleOrder.shippingAddress?.city}</div>
                {selectedSaleOrder.note && (
                  <div style={{ marginTop: '4px', color: '#71717A', fontStyle: 'italic' }}>
                    <strong>Ghi chú:</strong> {selectedSaleOrder.note}
                  </div>
                )}
              </div>
            </div>

            {/* Thông tin vận chuyển nếu có */}
            {selectedSaleOrder.shipment?.trackingCode && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: '#FEF3C7',
                  border: '1px solid #F59E0B',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#92400E' }}>
                  <Truck size={16} color="#D97706" />
                  <span>Vận đơn: {selectedSaleOrder.shipment.trackingCode}</span>
                </div>
                <Link
                  to={`/tracking/${selectedSaleOrder.orderCode || selectedSaleOrder.shipment.trackingCode}`}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: '#B45309',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Theo dõi
                </Link>
              </div>
            )}

            {/* Danh sách sản phẩm */}
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 600, color: '#171717', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Package size={15} color="#96723D" />
                <span>Sản phẩm trong kiện hàng</span>
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {(selectedSaleOrder.items || []).map((it, idx) => (
                  <div
                    key={it._id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: '#FAF9F6',
                      borderRadius: '8px',
                      border: '1px solid #E5E0D8',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: '#171717' }}>
                        {it.variantId?.productId?.name || 'Sản phẩm Haute Couture'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#71717A' }}>
                        Size: {it.variantId?.size || 'M'} | SL: {it.quantity} x {formatCurrencyVND(it.unitPrice)}
                      </div>
                    </div>
                    <strong style={{ fontSize: '13px', color: '#96723D' }}>
                      {formatCurrencyVND(it.lineTotal || (it.unitPrice * it.quantity))}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Tổng tiền */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '12px',
                borderTop: '1px solid #E5E0D8',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>Tổng thanh toán:</span>
              <strong style={{ fontSize: '18px', color: '#96723D' }}>
                {formatCurrencyVND(selectedSaleOrder.totalAmount)}
              </strong>
            </div>
          </div>
        )}
      </HauteCoutureModal>
    </div>
  );
}
