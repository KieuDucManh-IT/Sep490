import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarRange,
  Search,
  Truck,
  Clock,
  Eye,
  Store,
  ShoppingBag,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getMyRentalOrdersApi, getMySaleOrdersApi } from '../../services/orderApi';
import { resolveOrderDisplayStatus } from '../orders/orderUtils';
import '../../styles/OrderMonitoring.css';

const RENTAL_STATUS_TABS = [
  { key: 'all', label: 'Tất Cả' },
  { key: 'confirmed', label: 'Chờ Giao Đồ' },
  { key: 'renting', label: 'Đang Thuê' },
  { key: 'overdue', label: 'Quá Hạn' },
  { key: 'returned', label: 'Đã Trả Đồ' },
  { key: 'cancelled', label: 'Đã Hủy' },
];

const SALE_STATUS_TABS = [
  { key: 'all', label: 'Tất Cả' },
  { key: 'confirmed', label: 'Đã Xác Nhận' },
  { key: 'processing', label: 'Đang Chuẩn Bị' },
  { key: 'completed', label: 'Đã Hoàn Tất' },
  { key: 'cancelled', label: 'Đã Hủy' },
];

const DEPOSIT_STATUS_MAP = {
  pending: { text: 'Chờ Cọc', chipClass: 'pending' },
  held: { text: 'Đã Giữ Cọc', chipClass: 'held' },
  partially_refunded: { text: 'Hoàn Cọc 1 Phần', chipClass: 'partially_refunded' },
  refunded: { text: 'Đã Hoàn Cọc 100%', chipClass: 'refunded' },
  forfeited: { text: 'Tịch Thu Cọc', chipClass: 'forfeited' },
  partially_deducted: { text: 'Khấu Trừ Vi Phạm', chipClass: 'deducted' },
};

const DEFAULT_OUTFIT_IMAGE =
  'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=300&q=80';

function getItemImage(item) {
  if (!item) return '';
  const product = item.variantId?.productId || item.productId || {};
  const variant = item.variantId || {};

  const candidates = [
    item.image,
    item.imageUrl,
    item.productImage,
    variant.image,
    variant.imageUrl,
    product.image,
    product.imageUrl,
    Array.isArray(product.images) ? product.images.find(Boolean) : null,
    Array.isArray(item.images) ? item.images.find(Boolean) : null,
    product.thumbnail,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === 'string' &&
      candidate.trim().length > 0 &&
      !candidate.includes('undefined') &&
      !candidate.includes('null')
    ) {
      return candidate.trim();
    }
  }

  return '';
}

function formatCurrency(amount) {
  if (!amount || isNaN(amount)) return '0 ₫';
  return Number(amount).toLocaleString('vi-VN') + ' ₫';
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
}

export default function RentalOrdersHistoryPage() {
  const navigate = useNavigate();

  const [orderMode, setOrderMode] = useState('rental'); // 'rental' | 'sale'
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const apiFn = orderMode === 'sale' ? getMySaleOrdersApi : getMyRentalOrdersApi;
      const res = await apiFn(params);
      if (res?.success && Array.isArray(res.data)) {
        setOrders(res.data);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách đơn hàng:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [orderMode, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const currentTabs = orderMode === 'sale' ? SALE_STATUS_TABS : RENTAL_STATUS_TABS;

  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((o) => {
      if (activeTab === 'all') return true;
      const isCancelled = o.rentalStatus === 'cancelled' || o.orderStatus === 'cancelled';
      if (orderMode === 'sale') {
        if (activeTab === 'cancelled') return isCancelled;
        return o.orderStatus === activeTab;
      }
      if (activeTab === 'overdue') {
        return (
          o.rentalStatus === 'overdue' ||
          (o.rentalStatus === 'renting' && o.dueDate && new Date(o.dueDate) < new Date())
        );
      }
      if (activeTab === 'cancelled') {
        return isCancelled;
      }
      if (activeTab === 'confirmed') {
        return (o.rentalStatus === 'confirmed' || o.rentalStatus === 'draft') && !isCancelled;
      }
      if (activeTab === 'returned') {
        return o.rentalStatus === 'returned' || o.rentalStatus === 'partially_returned';
      }
      return o.rentalStatus === activeTab;
    });
  }, [orders, orderMode, activeTab]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#FDFCFB' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '32px 16px', maxWidth: '1200px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#78716C', marginBottom: '20px' }}>
          <Link to="/" style={{ color: '#78716C', textDecoration: 'none' }}>Trang chủ</Link>
          <ChevronRight size={14} />
          <Link to="/profile" style={{ color: '#78716C', textDecoration: 'none' }}>Tài khoản</Link>
          <ChevronRight size={14} />
          <span style={{ color: '#1C1917', fontWeight: 600 }}>Đơn thuê của tôi</span>
        </div>

        {/* Hero Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1C1917 0%, #292524 100%)',
          borderRadius: '16px',
          padding: '28px 32px',
          color: '#F8F7F4',
          marginBottom: '28px',
          boxShadow: '0 10px 25px -5px rgba(28, 25, 23, 0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              {orderMode === 'rental' ? (
                <CalendarRange size={24} color="#D97706" />
              ) : (
                <ShoppingBag size={24} color="#D97706" />
              )}
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                {orderMode === 'rental' ? 'Đơn Thuê Trang Phục Của Tôi' : 'Đơn Mua Hàng Của Tôi'}
              </h1>
            </div>
            <p style={{ margin: 0, fontSize: '13.5px', color: '#A8A29E', maxWidth: '600px', lineHeight: 1.5 }}>
              {orderMode === 'rental'
                ? 'Giám sát chu kỳ fitting, thời hạn hoàn trả và trạng thái hoàn tiền cọc an toàn, minh bạch.'
                : 'Theo dõi đơn đặt mua sản phẩm thời trang, quy trình đóng gói và giao hàng nhanh chóng.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <Link
              to="/tracking"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: '8px',
                backgroundColor: 'rgba(217, 119, 6, 0.15)',
                color: '#FBBF24',
                border: '1px solid rgba(217, 119, 6, 0.3)',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <Truck size={15} />
              <span>Tra Cứu Vận Đơn GHN</span>
            </Link>
            <Link
              to="/catalog"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '8px',
                backgroundColor: '#D97706',
                color: '#FFFFFF',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <ShoppingBag size={15} />
              <span>{orderMode === 'rental' ? 'Thuê Thêm Đồ' : 'Mua Thêm Đồ'}</span>
            </Link>
          </div>
        </div>

        {/* Order Mode Switcher */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
          <button
            type="button"
            onClick={() => {
              setOrderMode('rental');
              setActiveTab('all');
            }}
            style={{
              padding: '9px 20px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: 600,
              backgroundColor: orderMode === 'rental' ? '#1C1917' : '#FFFFFF',
              color: orderMode === 'rental' ? '#F8F7F4' : '#78716C',
              border: orderMode === 'rental' ? '1px solid #1C1917' : '1px solid #E7E5E4',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              boxShadow: orderMode === 'rental' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <CalendarRange size={16} color={orderMode === 'rental' ? '#D97706' : '#78716C'} />
            <span>Đơn Thuê Trang Phục</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setOrderMode('sale');
              setActiveTab('all');
            }}
            style={{
              padding: '9px 20px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: 600,
              backgroundColor: orderMode === 'sale' ? '#1C1917' : '#FFFFFF',
              color: orderMode === 'sale' ? '#F8F7F4' : '#78716C',
              border: orderMode === 'sale' ? '1px solid #1C1917' : '1px solid #E7E5E4',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.15s ease',
              boxShadow: orderMode === 'sale' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <ShoppingBag size={16} color={orderMode === 'sale' ? '#D97706' : '#78716C'} />
            <span>Đơn Mua Hàng</span>
          </button>
        </div>

        {/* Filter Taskbar */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid #E7E5E4',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {currentTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: activeTab === tab.key ? 600 : 500,
                  border: activeTab === tab.key ? '1px solid #1C1917' : '1px solid #E7E5E4',
                  backgroundColor: activeTab === tab.key ? '#1C1917' : '#FFFFFF',
                  color: activeTab === tab.key ? '#F8F7F4' : '#57534E',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', width: '260px' }}>
            <Search size={15} color="#A8A29E" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Tìm theo mã đơn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '38px',
                paddingLeft: '36px',
                paddingRight: '12px',
                borderRadius: '8px',
                border: '1px solid #E7E5E4',
                fontSize: '13px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Content list */}
        {loading ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#78716C' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px auto', display: 'block', color: '#D97706' }} />
            <p style={{ margin: 0, fontSize: '14px' }}>Đang tải danh sách đơn thuê của bạn...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            border: '1px dashed #D6D3D1',
            padding: '50px 20px',
            textAlign: 'center',
            color: '#78716C'
          }}>
            <CalendarRange size={48} color="#D6D3D1" style={{ margin: '0 auto 16px auto', display: 'block' }} />
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#292524' }}>Chưa có đơn thuê nào</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '13.5px', color: '#78716C' }}>
              Quý khách chưa có đơn thuê nào ở trạng thái này. Khám phá ngay các bộ sưu tập Haute Couture mới nhất!
            </p>
            <Link
              to="/catalog"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                backgroundColor: '#1C1917',
                color: '#F8F7F4',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              <span>Xem Bộ Sưu Tập</span>
              <ChevronRight size={15} />
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredOrders.map((order) => {
              const isSale = orderMode === 'sale' || Boolean(order.orderStatus && !order.rentalStatus);
              const statusDef = resolveOrderDisplayStatus(order, isSale ? 'sale' : 'rental', false);
              const depositDef = !isSale
                ? (DEPOSIT_STATUS_MAP[order.depositStatus] || { text: order.depositStatus || 'Chưa rõ', chipClass: 'pending' })
                : null;
              const isOverdue =
                !isSale &&
                (order.rentalStatus === 'overdue' ||
                  (order.rentalStatus === 'renting' && order.dueDate && new Date(order.dueDate) < new Date()));

              const firstItem = order.items?.[0] || {};
              const product = firstItem.variantId?.productId || firstItem.productId || {};
              const variant = firstItem.variantId || {};
              const itemImage = getItemImage(firstItem) || DEFAULT_OUTFIT_IMAGE;
              const extraCount = Math.max(0, (order.items?.length || 1) - 1);

              return (
                <div
                  key={order._id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: '14px',
                    border: '1px solid #E7E5E4',
                    padding: '20px 24px',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
                    transition: 'box-shadow 0.2s ease',
                  }}
                >
                  {/* Order Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F5F5F4', paddingBottom: '14px', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#1C1917' }}>
                        {order.orderCode || (isSale ? `#MUA-${String(order._id).slice(-6).toUpperCase()}` : `#THUE-${String(order._id).slice(-6).toUpperCase()}`)}
                      </span>
                      <span style={{ fontSize: '12px', color: '#78716C' }}>
                        Đặt lúc: {formatDate(order.createdAt)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {depositDef && (
                        <span className={`order-badge ${depositDef.chipClass}`} style={{ fontSize: '11.5px', padding: '3px 8px' }}>
                          <span className="order-badge-dot" />
                          {depositDef.text}
                        </span>
                      )}
                      <span className={`order-badge ${statusDef.chipClass}`} style={{ fontSize: '11.5px', padding: '3px 8px' }}>
                        <span className="order-badge-dot" />
                        {statusDef.text}
                      </span>
                    </div>
                  </div>

                  {/* Order Body Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '20px', alignItems: 'center' }}>
                    {/* Outfit Image */}
                    <img
                      src={itemImage}
                      alt={product.name || firstItem.productName || (isSale ? 'Sản phẩm mua' : 'Trang phục thuê')}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = DEFAULT_OUTFIT_IMAGE;
                      }}
                      style={{ width: '70px', height: '90px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #F5F5F4' }}
                    />

                    {/* Outfit Info */}
                    <div>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 600, color: '#1C1917' }}>
                        {product.name || firstItem.productName || (isSale ? 'Sản Phẩm Thời Trang Vestora' : 'Trang Phục Haute Couture')}
                        {extraCount > 0 && (
                          <span style={{ fontSize: '12px', color: '#D97706', fontWeight: 500, marginLeft: '6px' }}>
                            (+{extraCount} món khác)
                          </span>
                        )}
                      </h4>

                      <div style={{ fontSize: '12.5px', color: '#78716C', marginBottom: '6px' }}>
                        {variant.size ? `Size: ${variant.size}` : ''}
                        {variant.color ? ` • Màu: ${variant.color}` : ''}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12.5px', color: '#44403C', flexWrap: 'wrap' }}>
                        {!isSale && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <Clock size={13} color="#D97706" />
                            <span>Hạn thuê: <strong>{formatDate(order.startDate)} → {formatDate(order.dueDate)}</strong></span>
                            {isOverdue && (
                              <span style={{ backgroundColor: '#FEE2E2', color: '#DC2626', fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px' }}>
                                Quá hạn
                              </span>
                            )}
                          </span>
                        )}

                        {order.locationId && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#78716C' }}>
                            <Store size={13} />
                            <span>{order.locationId.name || 'Showroom Vestora'}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pricing & Actions */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ fontSize: '11.5px', color: '#78716C' }}>
                          {isSale ? 'Tổng tiền thanh toán:' : 'Tiền thuê trang phục:'}
                        </div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1C1917' }}>
                          {formatCurrency(isSale ? order.totalAmount : order.rentalFee)}
                        </div>
                        {!isSale && (
                          <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: 500, marginTop: '2px' }}>
                            Tiền cọc: {formatCurrency(order.depositAmount)}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '10px' }}>
                        {order.shipment?.trackingCode ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/tracking/${order.orderCode || order.shipment.trackingCode}`)}
                            className="order-tracking-btn"
                          >
                            <Truck size={13} color="#D97706" />
                            <span>Tra Cứu Giao Hàng</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate(`/tracking/${order.orderCode || order._id}`)}
                            className="order-tracking-btn"
                          >
                            <Truck size={13} />
                            <span>Vận Đơn</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          style={{
                            padding: '7px 14px',
                            borderRadius: '6px',
                            backgroundColor: '#1C1917',
                            color: '#F8F7F4',
                            border: 'none',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Eye size={13} />
                          <span>Chi Tiết</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal Chi Tiết Đơn Thuê */}
      {selectedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
            backdropFilter: 'blur(3px)',
          }}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #F5F5F4', paddingBottom: '16px', marginBottom: '18px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#1C1917' }}>
                  {orderMode === 'sale' || (selectedOrder.orderStatus && !selectedOrder.rentalStatus)
                    ? `Chi Tiết Đơn Mua ${selectedOrder.orderCode || `#MUA-${String(selectedOrder._id).slice(-6).toUpperCase()}`}`
                    : `Chi Tiết Đơn Thuê ${selectedOrder.orderCode || `#THUE-${String(selectedOrder._id).slice(-6).toUpperCase()}`}`}
                </h3>
                <span style={{ fontSize: '12.5px', color: '#78716C' }}>
                  Tạo ngày: {formatDate(selectedOrder.createdAt)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#78716C' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13.5px' }}>
              {orderMode === 'sale' || (selectedOrder.orderStatus && !selectedOrder.rentalStatus) ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#F8F7F4', borderRadius: '8px' }}>
                    <span style={{ color: '#78716C' }}>Trạng thái đơn hàng:</span>
                    <strong>{resolveOrderDisplayStatus(selectedOrder, 'sale', false).text}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#F8F7F4', borderRadius: '8px' }}>
                    <span style={{ color: '#78716C' }}>Hình thức thanh toán:</span>
                    <strong style={{ color: selectedOrder.paymentStatus === 'paid' ? '#059669' : '#D97706' }}>
                      {selectedOrder.paymentStatus === 'paid' ? 'Đã Thanh Toán (Ví)' : 'Thanh Toán Khi Nhận Hàng (COD)'}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#F8F7F4', borderRadius: '8px' }}>
                    <span style={{ color: '#78716C' }}>Showroom xử lý:</span>
                    <span><strong>{selectedOrder.locationId?.name || 'Showroom Vestora Hà Nội'}</strong></span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderTop: '1px solid #E7E5E4', marginTop: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Tổng tiền đơn mua:</span>
                    <strong style={{ fontSize: '16px', color: '#D97706' }}>{formatCurrency(selectedOrder.totalAmount)}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#F8F7F4', borderRadius: '8px' }}>
                    <span style={{ color: '#78716C' }}>Trạng thái thuê:</span>
                    <strong>{resolveOrderDisplayStatus(selectedOrder, 'rental', false).text}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#F8F7F4', borderRadius: '8px' }}>
                    <span style={{ color: '#78716C' }}>Trạng thái tiền cọc:</span>
                    <strong style={{ color: '#059669' }}>{DEPOSIT_STATUS_MAP[selectedOrder.depositStatus]?.text || selectedOrder.depositStatus}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#F8F7F4', borderRadius: '8px' }}>
                    <span style={{ color: '#78716C' }}>Thời hạn thuê đồ:</span>
                    <span><strong>{formatDate(selectedOrder.startDate)}</strong> đến <strong>{formatDate(selectedOrder.dueDate)}</strong></span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: '#F8F7F4', borderRadius: '8px' }}>
                    <span style={{ color: '#78716C' }}>Chi nhánh showroom:</span>
                    <span><strong>{selectedOrder.locationId?.name || 'Showroom Vestora Hà Nội'}</strong></span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', borderTop: '1px solid #E7E5E4', marginTop: '8px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>Tổng tiền thanh toán thuê:</span>
                    <strong style={{ fontSize: '16px', color: '#D97706' }}>{formatCurrency(selectedOrder.rentalFee)}</strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 14px' }}>
                    <span style={{ fontSize: '13px', color: '#78716C' }}>Tiền cọc:</span>
                    <strong style={{ fontSize: '14px', color: '#059669' }}>{formatCurrency(selectedOrder.depositAmount)}</strong>
                  </div>
                </>
              )}

              {/* Danh sách sản phẩm */}
              <div style={{ marginTop: '10px', paddingTop: '12px', borderTop: '1px solid #E7E5E4' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1C1917', marginBottom: '10px' }}>
                  {orderMode === 'sale' || (selectedOrder.orderStatus && !selectedOrder.rentalStatus)
                    ? `Danh sách sản phẩm mua (${selectedOrder.items?.length || 0})`
                    : `Danh sách trang phục thuê (${selectedOrder.items?.length || 0})`}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(selectedOrder.items || []).map((it, idx) => {
                    const itProd = it.variantId?.productId || it.productId || {};
                    const itVar = it.variantId || {};
                    const itImg = getItemImage(it) || DEFAULT_OUTFIT_IMAGE;
                    return (
                      <div
                        key={it._id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          backgroundColor: '#F8F7F4',
                          borderRadius: '8px',
                          border: '1px solid #E7E5E4',
                        }}
                      >
                        <img
                          src={itImg}
                          alt={itProd.name || it.productName || 'Trang phục'}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = DEFAULT_OUTFIT_IMAGE;
                          }}
                          style={{
                            width: '50px',
                            height: '62px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            border: '1px solid #E7E5E4',
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1C1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {itProd.name || it.productName || 'Trang Phục Haute Couture'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#78716C', marginTop: '2px' }}>
                            {itVar.size ? `Size: ${itVar.size}` : ''}
                            {itVar.color ? ` • Màu: ${itVar.color}` : ''}
                            {` • SL: ${it.quantity || 1}`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#1C1917' }}>
                            {formatCurrency(it.lineTotal || it.unitRentalFee)}
                          </div>
                          {it.depositPerUnit > 0 && (
                            <div style={{ fontSize: '11px', color: '#059669' }}>
                              Cọc: {formatCurrency(it.depositPerUnit)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedOrder.shipment?.trackingCode ? (
                <div className="order-tracking-banner-active">
                  <div className="order-tracking-banner-title active">
                    <Truck size={16} color="#D97706" />
                    <span>Vận đơn GHN: {selectedOrder.shipment.trackingCode} • {resolveOrderDisplayStatus(selectedOrder, 'rental', false).text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/tracking/${selectedOrder.orderCode || selectedOrder.shipment.trackingCode}`)}
                    className="order-tracking-banner-action-active"
                  >
                    Theo Dõi Lộ Trình
                  </button>
                </div>
              ) : (
                <div className="order-tracking-banner-muted">
                  <div className="order-tracking-banner-title muted">
                    <Truck size={16} color="#78716C" />
                    <span>Trạng thái: {resolveOrderDisplayStatus(selectedOrder, 'rental', false).text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/tracking/${selectedOrder.orderCode || selectedOrder._id}`)}
                    className="order-tracking-banner-action-dark"
                  >
                    Theo Dõi Vận Đơn
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                style={{
                  padding: '9px 20px',
                  borderRadius: '6px',
                  backgroundColor: '#1C1917',
                  color: '#F8F7F4',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

