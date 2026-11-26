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
import { getRentalOrders, submitRentalDispute } from '../../services/rentalOrderApi';
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

  // UC-41: State modal khiếu nại / báo cáo vấn đề
  const [disputeOrder, setDisputeOrder] = useState(null);
  const [disputeReason, setDisputeReason] = useState('wrong_item');
  const [disputeDescription, setDisputeDescription] = useState('');
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);
  const [disputeResult, setDisputeResult] = useState(null);

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

  // UC-41: Submit khiếu nại (trong vòng 24h kể từ bàn giao)
  const handleSubmitDispute = async () => {
    if (!disputeOrder) return;
    if (!disputeDescription.trim()) {
      alert('Vui lòng mô tả chi tiết vấn đề bạn gặp phải.');
      return;
    }
    setIsSubmittingDispute(true);
    try {
      const res = await submitRentalDispute(disputeOrder._id, {
        reason: disputeReason,
        description: disputeDescription.trim(),
      });
      setDisputeResult({ success: true, message: res?.data?.disputeCode
        ? `Khiếu nại ${res.data.disputeCode} đã được ghi nhận. Chúng tôi sẽ phản hồi trong 72 giờ.`
        : 'Khiếu nại đã được ghi nhận thành công. Vui lòng chờ CSKH liên hệ.' });
    } catch (err) {
      setDisputeResult({ success: false, message: err.message || 'Không gửi được khiếu nại, vui lòng thử lại.' });
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  const closeDisputeModal = () => {
    setDisputeOrder(null);
    setDisputeReason('wrong_item');
    setDisputeDescription('');
    setDisputeResult(null);
  };

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
                  const statusInfo = getRentalStatusInfo(
                    o.rentalStatus
                  );

                  const items = o.items || o.orderDetails || [];

                  const orderLabel =
                    o.orderCode || o._id?.slice(-6).toUpperCase();

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

                        {/* UC-41: Nút khiếu nại — chỉ hiển thị khi đơn đang ở trạng thái renting */}
                        {o.rentalStatus === 'renting' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDisputeOrder(o);
                            }}
                            style={{
                              padding: '7px 12px', borderRadius: '7px',
                              border: '1px solid #dc2626', background: '#fff',
                              color: '#dc2626', fontSize: '11.5px', fontWeight: 600,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                            }}
                            title="Báo cáo vấn đề với đơn thuê này (trong 24h kể từ nhận hàng)"
                          >
                            <AlertCircle size={12} />
                            Khiếu nại
                          </button>
                        )}
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
                  const statusInfo = getSaleStatusInfo(
                    o.orderStatus
                  );

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

      {/* UC-41: Modal gửi khiếu nại / báo cáo vấn đề đơn thuê (trong 24h) */}
      {disputeOrder && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
          onClick={closeDisputeModal}
        >
          <div
            style={{
              background: '#fff', borderRadius: '14px',
              padding: '28px 32px', maxWidth: '480px', width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 4px 0', color: '#1f2421' }}>
              Báo cáo vấn đề — Đơn thuê #{disputeOrder.orderCode}
            </h3>
            <p style={{ fontSize: '12px', color: '#6e7569', margin: '0 0 20px 0' }}>
              Chỉ áp dụng trong vòng 24 giờ kể từ khi nhận trang phục. Vui lòng mô tả rõ vấn đề để CSKH xử lý nhanh nhất.
            </p>

            {disputeResult ? (
              <div style={{
                padding: '14px 18px', borderRadius: '8px',
                background: disputeResult.success ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${disputeResult.success ? '#16a34a' : '#dc2626'}`,
                color: disputeResult.success ? '#15803d' : '#dc2626',
                fontSize: '13px', marginBottom: '20px',
              }}>
                {disputeResult.message}
              </div>
            ) : (
              <>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                  Loại vấn đề *
                </label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '7px',
                    border: '1px solid #d1d5db', fontSize: '13px',
                    marginBottom: '14px', background: '#fff',
                  }}
                >
                  <option value="wrong_item">Nhận sai sản phẩm / size / màu</option>
                  <option value="damaged_item">Sản phẩm bị hư hỏng khi nhận</option>
                  <option value="missing_item">Thiếu món đồ trong đơn</option>
                  <option value="quality_issue">Chất lượng không như mô tả</option>
                  <option value="late_delivery">Giao hàng trễ hơn cam kết</option>
                  <option value="other">Vấn đề khác</option>
                </select>

                <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '6px' }}>
                  Mô tả chi tiết *
                </label>
                <textarea
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  placeholder="Mô tả rõ vấn đề bạn gặp phải để CSKH có thể hỗ trợ nhanh nhất..."
                  rows={4}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: '7px',
                    border: '1px solid #d1d5db', fontSize: '13px',
                    resize: 'vertical', boxSizing: 'border-box',
                    marginBottom: '20px', fontFamily: 'inherit',
                  }}
                />
              </>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={closeDisputeModal}
                style={{
                  padding: '9px 18px', borderRadius: '7px',
                  border: '1px solid #d1d5db', background: '#fff',
                  fontSize: '13px', cursor: 'pointer', color: '#374151',
                }}
              >
                {disputeResult ? 'Đóng' : 'Hủy bỏ'}
              </button>
              {!disputeResult && (
                <button
                  type="button"
                  onClick={handleSubmitDispute}
                  disabled={isSubmittingDispute}
                  style={{
                    padding: '9px 20px', borderRadius: '7px',
                    border: 'none', background: '#dc2626',
                    color: '#fff', fontSize: '13px', fontWeight: 600,
                    cursor: isSubmittingDispute ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingDispute ? 0.7 : 1,
                  }}
                >
                  {isSubmittingDispute ? 'Đang gửi...' : 'Gửi khiếu nại'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}