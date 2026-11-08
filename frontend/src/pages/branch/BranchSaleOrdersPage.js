/**
 * Branch Sale Orders Management Page
 * Quản lý đơn bán đứt / thanh lý tại chi nhánh showroom
 * Haute Couture design tokens, Zero-Native Dialogs, Zero-Emoji, 100% Native Fetch API
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import HauteCoutureModal from '../../components/HauteCoutureModal';
import {
  getBranchSalesOrders,
  updateSalesOrderStatus,
} from '../../services/salesOrderApi';
import { formatCurrencyVND } from '../../services/cart/cartCalculations';
import {
  Search,
  RefreshCw,
  ShoppingBag,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
  FileSpreadsheet,
  XCircle,
  MapPin,
  Phone,
  User,
  Wallet,
  Banknote,
  Loader2,
} from 'lucide-react';
import '../../styles/ShopDashboard.css';

const STATUS_TABS = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'confirmed', label: 'Chờ đóng gói' },
  { key: 'processing', label: 'Đang xử lý' },
  { key: 'shipped', label: 'Đang giao vận' },
  { key: 'completed', label: 'Đã hoàn tất' },
  { key: 'cancelled', label: 'Đã hủy' },
];

export default function BranchSaleOrdersPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Lấy chi nhánh đang chọn từ storage / cache
  const [branchId, setBranchId] = useState(() => {
    try {
      const activeId = localStorage.getItem('vestora_active_branch_id');
      if (activeId) return activeId;
      const cached = JSON.parse(localStorage.getItem('vestora_branch_cache') || '{}');
      return cached?.locationId || cached?._id || 'all';
    } catch {
      return 'all';
    }
  });

  // Modal Chi tiết & Cập nhật đơn
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionNote, setActionNote] = useState('');

  // Tải danh sách đơn từ API
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setErrorNotice('');
    try {
      const params = {};
      if (activeTab !== 'ALL') {
        params.orderStatus = activeTab;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await getBranchSalesOrders(branchId, params);
      setOrders(res?.data || []);
    } catch (err) {
      setErrorNotice(err.message || 'Không thể tải danh sách đơn bán hàng.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, activeTab, searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Lắng nghe sự kiện chuyển chi nhánh từ Header
  useEffect(() => {
    const onBranchChanged = (e) => {
      const nextId = e.detail?.locationId || e.detail?.branchId || e.detail?.branch?._id || 'all';
      setBranchId(nextId);
    };
    window.addEventListener('vestora_branch_changed', onBranchChanged);
    return () => window.removeEventListener('vestora_branch_changed', onBranchChanged);
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Cập nhật trạng thái đơn
  const handleUpdateStatus = async (orderId, newStatus) => {
    setActionLoading(true);
    try {
      await updateSalesOrderStatus(orderId, {
        orderStatus: newStatus,
        note: actionNote || undefined,
      });

      showToast(`Đã cập nhật trạng thái đơn hàng sang ${getStatusText(newStatus)}!`);
      setSelectedOrder(null);
      setActionNote('');
      fetchOrders();
    } catch (err) {
      setErrorNotice(err.message || 'Cập nhật trạng thái thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'confirmed':
        return 'Chờ đóng gói';
      case 'processing':
        return 'Đang đóng gói';
      case 'shipped':
        return 'Đang giao hàng';
      case 'completed':
        return 'Đã hoàn tất';
      case 'cancelled':
        return 'Đã hủy đơn';
      default:
        return status;
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      confirmed: { label: 'Chờ đóng gói', bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
      processing: { label: 'Đang đóng gói', bg: '#FAF5EE', color: '#96723D', border: '#E8DECF' },
      shipped: { label: 'Đang giao hàng', bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
      completed: { label: 'Đã hoàn tất', bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
      cancelled: { label: 'Đã hủy đơn', bg: '#FEF2F2', color: '#B91C1C', border: '#FCA5A5' },
    };
    const c = config[status] || { label: status, bg: '#F4F4F5', color: '#52525B', border: '#E4E4E7' };

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: 600,
          background: c.bg,
          color: c.color,
          border: `1px solid ${c.border}`,
        }}
      >
        {c.label}
      </span>
    );
  };

  const getPaymentBadge = (method, status) => {
    if (method === 'wallet') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: 600,
            background: '#F0FDF4',
            color: '#15803D',
            border: '1px solid #BBF7D0',
          }}
        >
          <Wallet size={12} />
          <span>Ví Vestora (Đã trả)</span>
        </span>
      );
    }

    const isPaid = status === 'paid';
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          padding: '3px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 600,
          background: isPaid ? '#F0FDF4' : '#FFFBEB',
          color: isPaid ? '#15803D' : '#B45309',
          border: `1px solid ${isPaid ? '#BBF7D0' : '#FDE68A'}`,
        }}
      >
        <Banknote size={12} />
        <span>COD {isPaid ? '(Đã thu tiền)' : '(Thu tiền khi giao)'}</span>
      </span>
    );
  };

  return (
    <div className="shop-dashboard-layout">
      {/* Sidebar Navigation */}
      <BranchSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Viewport */}
      <div className="admin-main-viewport">
        {/* Top Header */}
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb="Đơn Bán Đứt"
        />

        {/* Main Content Area */}
        <main className="shop-main-content" style={{ padding: '24px 32px' }}>
          {/* Header Title */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              paddingBottom: '20px',
              borderBottom: '1px solid #E5E0D8',
              marginBottom: '24px',
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
                  fontSize: '26px',
                  fontWeight: 600,
                  color: '#171717',
                  margin: '0 0 6px 0',
                }}
              >
                Quản Lý Đơn Mua Thanh Lý & Bán Thẳng
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#71717A' }}>
                Tiếp nhận đơn mua, điều phối đóng gói xuất kho và cập nhật giao vận sản phẩm Haute Couture
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={fetchOrders}
                disabled={loading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #E5E0D8',
                  background: '#FFFFFF',
                  color: '#171717',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                <span>Làm mới</span>
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div
              style={{
                marginBottom: '20px',
                padding: '12px 18px',
                borderRadius: '8px',
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                color: '#15803D',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={18} />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Error Notice */}
          {errorNotice && (
            <div
              style={{
                marginBottom: '20px',
                padding: '12px 18px',
                borderRadius: '8px',
                background: '#FEF2F2',
                border: '1px solid #FCA5A5',
                color: '#B91C1C',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={18} />
              <span>{errorNotice}</span>
            </div>
          )}

          {/* Filter Tabs & Search Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            {/* Status Tabs */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {STATUS_TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: isActive ? '1px solid #C5A880' : '1px solid #E5E0D8',
                      background: isActive ? '#171717' : '#FFFFFF',
                      color: isActive ? '#FAF9F6' : '#52525B',
                      transition: 'all 0.2s',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search
                size={16}
                color="#71717A"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Tìm mã đơn, tên, số điện thoại..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid #D4D4D8',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Orders Table Container */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              border: '1px solid #E5E0D8',
              overflow: 'hidden',
            }}
          >
            {loading ? (
              <div style={{ padding: '60px 0', textAlign: 'center', color: '#71717A' }}>
                <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                <p style={{ margin: 0, fontSize: '14px' }}>Đang nạp danh sách đơn bán hàng...</p>
              </div>
            ) : orders.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#71717A' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#FAF5EE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    color: '#96723D',
                  }}
                >
                  <ShoppingBag size={28} />
                </div>
                <h4 style={{ fontSize: '16px', color: '#171717', margin: '0 0 6px 0', fontWeight: 600 }}>
                  Không tìm thấy đơn bán nào
                </h4>
                <p style={{ fontSize: '13px', color: '#71717A', margin: 0 }}>
                  Chưa có đơn bán đứt nào khớp với tiêu chí tìm kiếm hiện tại.
                </p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#FAF9F6', borderBottom: '1px solid #E5E0D8', color: '#52525B' }}>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Mã Đơn</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Sản Phẩm</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Người Nhận</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Tổng Tiền</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Thanh Toán</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600 }}>Trạng Thái</th>
                    <th style={{ padding: '14px 16px', fontWeight: 600, textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const firstItem = order.items?.[0];
                    const itemCount = order.items?.length || 0;
                    const dateFormatted = order.createdAt
                      ? new Date(order.createdAt).toLocaleString('vi-VN', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '---';

                    return (
                      <tr
                        key={order._id}
                        style={{
                          borderBottom: '1px solid #F4F4F5',
                          transition: 'background 0.15s',
                        }}
                      >
                        {/* 1. Mã đơn & Thời gian */}
                        <td style={{ padding: '14px 16px' }}>
                          <strong style={{ color: '#171717', fontSize: '13px', display: 'block' }}>
                            {order.orderCode}
                          </strong>
                          <span style={{ fontSize: '11px', color: '#71717A' }}>{dateFormatted}</span>
                        </td>

                        {/* 2. Sản phẩm */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#171717', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {firstItem?.variantId?.productId?.name || 'Sản phẩm Haute Couture'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#96723D' }}>
                            Size: {firstItem?.variantId?.size || 'M'} | SL: {firstItem?.quantity || 1}
                            {itemCount > 1 ? ` (+${itemCount - 1} món khác)` : ''}
                          </div>
                        </td>

                        {/* 3. Người nhận */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#171717' }}>
                            {order.shippingAddress?.receiverName || 'Khách vãng lai'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#71717A' }}>
                            {order.shippingAddress?.phone}
                          </div>
                          <div style={{ fontSize: '11px', color: '#71717A', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {order.shippingAddress?.street}, {order.shippingAddress?.city}
                          </div>
                        </td>

                        {/* 4. Tổng tiền */}
                        <td style={{ padding: '14px 16px', fontWeight: 700, color: '#96723D' }}>
                          {formatCurrencyVND(order.totalAmount || 0)}
                        </td>

                        {/* 5. Thanh toán */}
                        <td style={{ padding: '14px 16px' }}>
                          {getPaymentBadge(order.paymentMethod, order.paymentStatus)}
                        </td>

                        {/* 6. Trạng thái */}
                        <td style={{ padding: '14px 16px' }}>
                          {getStatusBadge(order.orderStatus)}
                        </td>

                        {/* 7. Thao tác */}
                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid #E5E0D8',
                              background: '#FAF9F6',
                              color: '#171717',
                              fontSize: '12px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Eye size={14} />
                            <span>Chi tiết</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {/* MODAL CHI TIẾT ĐƠN HÀNG & THAO TÁC (HAUTE COUTURE) */}
      <HauteCoutureModal
        isOpen={Boolean(selectedOrder)}
        onClose={() => {
          setSelectedOrder(null);
          setActionNote('');
        }}
        title={`Đơn Bán: ${selectedOrder?.orderCode || ''}`}
        subtitle="Chi tiết thông tin kiện hàng và điều phối quy trình xuất kho"
      >
        {selectedOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '10px 0' }}>
            {/* Thông tin trạng thái */}
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
                <div style={{ marginTop: '4px' }}>{getStatusBadge(selectedOrder.orderStatus)}</div>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: '#71717A', display: 'block' }}>Phương thức thanh toán:</span>
                <div style={{ marginTop: '4px' }}>
                  {getPaymentBadge(selectedOrder.paymentMethod, selectedOrder.paymentStatus)}
                </div>
              </div>
            </div>

            {/* Thông tin người nhận */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                border: '1px solid #E5E0D8',
                background: '#FFFFFF',
              }}
            >
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#171717', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={16} color="#96723D" />
                <span>Địa chỉ giao nhận hàng</span>
              </h4>

              <div style={{ fontSize: '13px', color: '#27272A', lineHeight: 1.6 }}>
                <div><strong>Người nhận:</strong> {selectedOrder.shippingAddress?.receiverName}</div>
                <div><strong>Số điện thoại:</strong> {selectedOrder.shippingAddress?.phone}</div>
                <div>
                  <strong>Địa chỉ:</strong> {selectedOrder.shippingAddress?.street},{' '}
                  {selectedOrder.shippingAddress?.district ? `${selectedOrder.shippingAddress?.district}, ` : ''}
                  {selectedOrder.shippingAddress?.city}
                </div>
                {selectedOrder.note && (
                  <div style={{ marginTop: '6px', color: '#71717A', fontStyle: 'italic' }}>
                    <strong>Ghi chú:</strong> "{selectedOrder.note}"
                  </div>
                )}
              </div>
            </div>

            {/* Danh sách sản phẩm trong đơn */}
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#171717', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Package size={16} color="#96723D" />
                <span>Danh sách trang phục ({selectedOrder.items?.length || 0} sản phẩm)</span>
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {(selectedOrder.items || []).map((it, idx) => (
                  <div
                    key={it._id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
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
                        Size: {it.variantId?.size || 'M'} | Đơn giá: {formatCurrencyVND(it.unitPrice)} | SL: {it.quantity}
                      </div>
                    </div>

                    <strong style={{ fontSize: '14px', color: '#96723D' }}>
                      {formatCurrencyVND(it.lineTotal || (it.unitPrice * it.quantity))}
                    </strong>
                  </div>
                ))}
              </div>

              {/* Tổng kết tiền */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid #E5E0D8',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>Tổng giá trị đơn:</span>
                <strong style={{ fontSize: '18px', color: '#96723D' }}>
                  {formatCurrencyVND(selectedOrder.totalAmount || 0)}
                </strong>
              </div>
            </div>

            {/* Các nút hành động xử lý trạng thái */}
            <div
              style={{
                paddingTop: '16px',
                borderTop: '1px solid #E5E0D8',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <h5 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#52525B' }}>
                Thao tác chuyển trạng thái:
              </h5>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {selectedOrder.orderStatus === 'confirmed' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedOrder._id, 'processing')}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#171717',
                      color: '#FAF9F6',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                    <span>Xác nhận đóng gói xong</span>
                  </button>
                )}

                {selectedOrder.orderStatus === 'processing' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedOrder._id, 'shipped')}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#7C3AED',
                      color: '#FAF9F6',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
                    <span>Bàn giao vận chuyển</span>
                  </button>
                )}

                {selectedOrder.orderStatus === 'shipped' && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedOrder._id, 'completed')}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#16A34A',
                      color: '#FAF9F6',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    <span>Đã giao & Hoàn tất đơn</span>
                  </button>
                )}

                {!['completed', 'cancelled'].includes(selectedOrder.orderStatus) && (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleUpdateStatus(selectedOrder._id, 'cancelled')}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: '1px solid #FCA5A5',
                      background: '#FEF2F2',
                      color: '#B91C1C',
                      fontWeight: 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
                  >
                    <XCircle size={16} />
                    <span>Hủy đơn</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </HauteCoutureModal>
    </div>
  );
}
