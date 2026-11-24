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
import OrderTrackingDetailModal from '../../components/customer/OrderTrackingDetailModal';
import { resolveOrderDisplayStatus } from '../orders/orderUtils';
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
  Truck,
  Wallet,
  Banknote,
  RotateCcw,
} from 'lucide-react';
import '../../styles/RentalOrdersHistory.css';

const RENTAL_TABS = [
  { id: 'all', label: 'Tất Cả Đơn Thuê' },
  { id: 'renting', label: 'Đang Trải Nghiệm' },
  { id: 'confirmed', label: 'Đã Đặt / Chuẩn Bị' },
  { id: 'overdue', label: 'Quá Hạn Trả' },
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
  draft: {
    label: 'Bản Nháp',
    color: '#6B7280',
    bg: '#F3F4F6',
  },
  pending_payment: {
    label: 'Chờ Thanh Toán',
    color: '#D97706',
    bg: '#FFFBEB',
  },
  confirmed: {
    label: 'Đã Xác Nhận',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  preparing: {
    label: 'Đang Chuẩn Bị',
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  ready_for_pickup: {
    label: 'Chờ Nhận Đồ',
    color: '#059669',
    bg: '#ECFDF5',
  },
  renting: {
    label: 'Đang Trải Nghiệm',
    color: '#0284C7',
    bg: '#F0F9FF',
  },
  overdue: {
    label: 'Quá Hạn Trả',
    color: '#DC2626',
    bg: '#FEF2F2',
  },
  partially_returned: {
    label: 'Đang Trả Một Phần',
    color: '#B45309',
    bg: '#FFF7ED',
  },
  returned: {
    label: 'Đã Hoàn Trả',
    color: '#16A34A',
    bg: '#F0FDF4',
  },
  cancelled: {
    label: 'Đã Hủy',
    color: '#6B7280',
    bg: '#F3F4F6',
  },
};

const SALE_STATUS_MAP = {
  draft: {
    label: 'Bản Nháp',
    color: '#6B7280',
    bg: '#F3F4F6',
  },
  confirmed: {
    label: 'Chờ Đóng Gói',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  processing: {
    label: 'Đang Chuẩn Bị',
    color: '#96723D',
    bg: '#FAF5EE',
  },
  shipped: {
    label: 'Đang Giao Hàng',
    color: '#7C3AED',
    bg: '#F5F3FF',
  },
  completed: {
    label: 'Đã Giao Thành Công',
    color: '#16A34A',
    bg: '#F0FDF4',
  },
  cancelled: {
    label: 'Đã Hủy',
    color: '#DC2626',
    bg: '#FEF2F2',
  },
};

function getRentalStatusInfo(status) {
  return (
    RENTAL_STATUS_MAP[status] || {
      label: status,
      color: '#4B5563',
      bg: '#F3F4F6',
    }
  );
}

function getSaleStatusInfo(status) {
  return (
    SALE_STATUS_MAP[status] || {
      label: status,
      color: '#4B5563',
      bg: '#F3F4F6',
    }
  );
}

function getOrderSmartStatus(order, type = 'rental') {
  const resolved = resolveOrderDisplayStatus(order, type, false);
  const colorMap = {
    renting: { color: '#0284C7', bg: '#F0F9FF' },
    confirmed: { color: '#2563EB', bg: '#EFF6FF' },
    processing: { color: '#7C3AED', bg: '#F5F3FF' },
    warning: { color: '#D97706', bg: '#FFFBEB' },
    returned: { color: '#16A34A', bg: '#F0FDF4' },
    completed: { color: '#16A34A', bg: '#F0FDF4' },
    overdue: { color: '#DC2626', bg: '#FEF2F2' },
    cancelled: { color: '#6B7280', bg: '#F3F4F6' },
    partially_returned: { color: '#B45309', bg: '#FFF7ED' },
  };
  const theme = colorMap[resolved.chipClass] || { color: '#4B5563', bg: '#F3F4F6' };
  return {
    label: resolved.text,
    color: theme.color,
    bg: theme.bg,
    chipClass: resolved.chipClass,
  };
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

  const initialCategory =
    searchParams.get('tab') === 'sale' ? 'sales' : 'rentals';

  const [category, setCategory] = useState(initialCategory);
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

    setSearchParams(
      newCat === 'sales' ? { tab: 'sale' } : { tab: 'rental' }
    );
  };

  // Nạp đơn thuê
  const fetchRentalOrders = useCallback(async () => {
    setIsRentalLoading(true);
    setRentalError('');

    try {
      const params = {};

      if (activeRentalTab !== 'all') {
        params.rentalStatus = activeRentalTab;
      }

      const res = await getRentalOrders(params);
      setRentalOrders(res.data || []);
    } catch (err) {
      setRentalError(
        err.message || 'Không thể tải lịch sử đơn thuê.'
      );
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

      if (activeSaleTab !== 'all') {
        params.status = activeSaleTab;
      }

      const res = await getMySalesOrders(params);
      const orders = res.data || [];

      setSaleOrders(orders);

      setSelectedSaleOrder((previous) =>
        previous
          ? orders.find((item) => item._id === previous._id) ||
            previous
          : null
      );
    } catch (err) {
      setSaleError(
        err.message || 'Không thể tải lịch sử đơn mua.'
      );
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

  // Tự động mở modal nếu có code / orderCode / trackingCode trên URL.
  const targetCode =
    searchParams.get('code') ||
    searchParams.get('orderCode') ||
    searchParams.get('trackingCode');

  useEffect(() => {
    if (!targetCode) return;

    if (category === 'rentals' && rentalOrders.length > 0) {
      const match = rentalOrders.find(
        (o) =>
          o.orderCode === targetCode ||
          o.shipment?.trackingCode === targetCode ||
          o._id === targetCode
      );

      if (match) setSelectedRentalOrder(match);
    } else if (category === 'sales' && saleOrders.length > 0) {
      const match = saleOrders.find(
        (o) =>
          o.orderCode === targetCode ||
          o.shipment?.trackingCode === targetCode ||
          o._id === targetCode
      );

      if (match) setSelectedSaleOrder(match);
    }
  }, [targetCode, category, rentalOrders, saleOrders]);

  const displayedRentalOrders = rentalOrders.filter(
    (o) => o.rentalStatus !== 'draft'
  );

  const displayedSaleOrders = saleOrders.filter(
    (o) => o.orderStatus !== 'draft'
  );

  return (
    <div className="rental-history-page">
      <Navbar />

      <main className="rental-history-main">
        {/* Header */}
        <header className="rental-history-header">
          <h1 className="rental-history-title">
            {category === 'rentals'
              ? 'Lịch Sử Thuê Trang Phục'
              : 'Lịch Sử Mua Sắm'}
          </h1>

          <p className="rental-history-subtitle">
            {category === 'rentals'
              ? 'Theo dõi hành trình trang phục Haute Couture bạn đang thuê từ Vestora.'
              : 'Theo dõi các sản phẩm thời trang bạn đã sở hữu từ Vestora.'}
          </p>

          {/* Bộ chuyển đổi danh mục Rentals / Sales */}
          <div className="rental-category-switcher">
            <button
              type="button"
              onClick={() => handleCategoryChange('rentals')}
              className={`rental-category-tab ${
                category === 'rentals'
                  ? 'rental-category-tab--active'
                  : ''
              }`}
            >
              <Calendar size={16} />
              <span>Đơn Thuê Trang Phục</span>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange('sales')}
              className={`rental-category-tab ${
                category === 'sales'
                  ? 'rental-category-tab--active'
                  : ''
              }`}
            >
              <ShoppingBag size={16} />
              <span>Đơn Mua Sắm</span>
            </button>
          </div>
        </header>

        {/* TAB 1: ĐƠN THUÊ TRANG PHỤC */}
        {category === 'rentals' && (
          <>
            {/* Bộ lọc */}
            <div className="rental-history-tabs">
              {RENTAL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveRentalTab(tab.id)}
                  className={`rental-history-tab${
                    activeRentalTab === tab.id
                      ? ' rental-history-tab--active'
                      : ''
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Lỗi */}
            {rentalError && (
              <div className="rental-history-error">
                <AlertCircle size={16} />
                <span>{rentalError}</span>
              </div>
            )}

            {/* Đang tải / danh sách */}
            {isRentalLoading ? (
              <div className="rental-history-loading">
                <Loader2 size={32} className="roh-spin" />
                <p>
                  Đang nạp danh sách đơn thuê của quý khách...
                </p>
              </div>
            ) : displayedRentalOrders.length === 0 ? (
              <div className="rental-history-empty">
                <Package
                  size={42}
                  className="rental-history-empty__icon"
                />

                <h3>Chưa có đơn thuê nào</h3>

                <p>
                  Khám phá bộ sưu tập đầm dạ hội và áo dài Haute
                  Couture để trải nghiệm ngay hôm nay.
                </p>

                <Link
                  to="/catalog"
                  className="rental-history-empty__link"
                >
                  Khám Phá Bộ Sưu Tập Thuê
                </Link>
              </div>
            ) : (
              <div className="rental-history-list">
                {displayedRentalOrders.map((o) => {
                  const statusInfo = getOrderSmartStatus(o, 'rental');

                  const items = o.items || o.orderDetails || [];

                  const orderLabel =
                    o.orderCode || o._id?.slice(-6).toUpperCase();

                  const allShipments = Array.isArray(o.shipments) ? o.shipments : (o.shipment ? [o.shipment] : []);
                  const hasActiveReturn = allShipments.some(
                    (s) => s.shipmentType === 'return' && ['preparing', 'shipped'].includes(s.shipmentStatus)
                  );
                  const canReturn = ['renting', 'overdue'].includes(o.rentalStatus) && !hasActiveReturn;

                  return (
                    <div
                      key={o._id}
                      className="rental-order-card"
                      onClick={() => setSelectedRentalOrder(o)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) =>
                        e.key === 'Enter' &&
                        setSelectedRentalOrder(o)
                      }
                      aria-label={`Xem chi tiết đơn thuê ${orderLabel}`}
                    >
                      <div className="rental-order-card__header">
                        <div>
                          <div className="rental-order-card__code">
                            #{orderLabel}
                          </div>

                          <div className="rental-order-card__date">
                            Ngày đặt: {formatDate(o.createdAt)}
                          </div>
                        </div>

                        <span
                          className="rental-order-status-badge"
                          style={{
                            color: statusInfo.color,
                            backgroundColor: statusInfo.bg,
                          }}
                        >
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="rental-order-card__meta">
                        <div className="rental-order-card__meta-item">
                          <Package
                            size={14}
                            color="#C5A880"
                          />

                          <span>
                            {items[0]?.productName ||
                              items[0]?.name ||
                              'Trang phục Haute Couture'}

                            {items.length > 1 &&
                              ` và ${items.length - 1} món khác`}
                          </span>
                        </div>

                        <div className="rental-order-card__meta-item">
                          <Calendar
                            size={14}
                            color="#C5A880"
                          />

                          <span>
                            {formatDate(o.startDate)} →{' '}
                            {formatDate(o.dueDate)}
                          </span>
                        </div>

                        {o.shipment?.trackingCode && (
                          <div className="rental-order-card__meta-item rental-order-card__meta-item--tracking">
                            <Truck
                              size={14}
                              color="#D97706"
                            />

                            <span>
                              Vận đơn: {o.shipment.trackingCode}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="rental-order-card__footer">
                        <div className="rental-order-card__price-block">
                          <span className="rental-order-card__price-label">
                            Tiền thuê
                          </span>

                          <span className="rental-order-card__price-value">
                            {formatCurrencyVND(o.rentalFee)}
                          </span>

                          <span className="rental-order-card__price-deposit">
                            Cọc: {formatCurrencyVND(o.depositAmount)}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="rental-order-card__view-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRentalOrder(o);
                          }}
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

        {/* TAB 2: ĐƠN MUA SẮM */}
        {category === 'sales' && (
          <>
            {/* Bộ lọc */}
            <div className="rental-history-tabs">
              {SALE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSaleTab(tab.id)}
                  className={`rental-history-tab${
                    activeSaleTab === tab.id
                      ? ' rental-history-tab--active'
                      : ''
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Lỗi */}
            {saleError && (
              <div className="rental-history-error">
                <AlertCircle size={16} />
                <span>{saleError}</span>
              </div>
            )}

            {/* Đang tải / danh sách */}
            {isSaleLoading ? (
              <div className="rental-history-loading">
                <Loader2 size={32} className="roh-spin" />
                <p>
                  Đang nạp danh sách đơn mua của quý khách...
                </p>
              </div>
            ) : displayedSaleOrders.length === 0 ? (
              <div className="rental-history-empty">
                <ShoppingBag
                  size={42}
                  className="rental-history-empty__icon"
                />

                <h3>Chưa có đơn mua sắm nào</h3>

                <p>
                  Khám phá các thiết kế thanh lý & mua đứt độc quyền
                  từ Vestora để bổ sung vào tủ đồ của bạn.
                </p>

                <Link
                  to="/catalog"
                  className="rental-history-empty__link"
                >
                  Khám Phá Bộ Sưu Tập Mua
                </Link>
              </div>
            ) : (
              <div className="rental-history-list">
                {displayedSaleOrders.map((o) => {
                  const statusInfo = getOrderSmartStatus(o, 'sale');

                  const items = o.items || [];
                  const firstItem = items[0];

                  return (
                    <div
                      key={o._id}
                      className="rental-order-card"
                      onClick={() => setSelectedSaleOrder(o)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) =>
                        e.key === 'Enter' &&
                        setSelectedSaleOrder(o)
                      }
                      aria-label={`Xem chi tiết đơn mua ${o.orderCode}`}
                    >
                      <div className="rental-order-card__header">
                        <div>
                          <div className="rental-order-card__code">
                            #{o.orderCode}
                          </div>

                          <div className="rental-order-card__date">
                            Ngày đặt: {formatDate(o.createdAt)}
                          </div>
                        </div>

                        <span
                          className="rental-order-status-badge"
                          style={{
                            color: statusInfo.color,
                            backgroundColor: statusInfo.bg,
                          }}
                        >
                          {statusInfo.label}
                        </span>
                      </div>

                      <div className="rental-order-card__meta">
                        <div className="rental-order-card__meta-item">
                          <ShoppingBag
                            size={14}
                            color="#C5A880"
                          />

                          <span>
                            {firstItem?.variantId?.productId?.name ||
                              'Sản phẩm mua đứt Haute Couture'}

                            {items.length > 1 &&
                              ` và ${items.length - 1} món khác`}
                          </span>
                        </div>

                        <div className="rental-order-card__meta-item">
                          {o.paymentMethod === 'wallet' ? (
                            <>
                              <Wallet
                                size={14}
                                color="#15803D"
                              />

                              <span className="rental-order-card__payment--wallet">
                                Ví Vestora (Đã trừ ví)
                              </span>
                            </>
                          ) : (
                            <>
                              <Banknote
                                size={14}
                                color="#B45309"
                              />

                              <span className="rental-order-card__payment--cod">
                                Thanh toán khi nhận hàng (COD)
                              </span>
                            </>
                          )}
                        </div>

                        {o.shipment?.trackingCode && (
                          <div className="rental-order-card__meta-item rental-order-card__meta-item--tracking">
                            <Truck
                              size={14}
                              color="#D97706"
                            />

                            <span>
                              Vận đơn: {o.shipment.trackingCode}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="rental-order-card__footer">
                        <div className="rental-order-card__price-block">
                          <span className="rental-order-card__price-label">
                            Tổng thanh toán
                          </span>

                          <span className="rental-order-card__price-value rental-order-card__price-value--gold">
                            {formatCurrencyVND(o.totalAmount)}
                          </span>

                          <span className="rental-order-card__price-deposit rental-order-card__price-deposit--free">
                            Miễn phí giao hàng
                          </span>
                        </div>

                        <button
                          type="button"
                          className="rental-order-card__view-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSaleOrder(o);
                          }}
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
      <OrderTrackingDetailModal
        isOpen={Boolean(selectedRentalOrder)}
        onClose={() => setSelectedRentalOrder(null)}
        order={selectedRentalOrder}
        orderType="rental"
        onOrderUpdated={fetchRentalOrders}
      />

      {/* Modal chi tiết đơn mua */}
      <OrderTrackingDetailModal
        isOpen={Boolean(selectedSaleOrder)}
        onClose={() => setSelectedSaleOrder(null)}
        order={selectedSaleOrder}
        orderType="sale"
        onOrderUpdated={fetchSaleOrders}
      />
    </div>
  );
}