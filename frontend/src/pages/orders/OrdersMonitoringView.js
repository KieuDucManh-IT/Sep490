import React, { useState, useMemo } from 'react';
import {
  CalendarRange,
  ShoppingBag,
  Store,
  Building2,
  MapPin,
  Eye,
  AlertTriangle,
  RotateCcw,
  Inbox,
  CreditCard,
} from 'lucide-react';
import OwnerSidebar from '../../components/OwnerSidebar';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import OrderFilterBar, { OrderPagination } from './OrderFilterBar';
import OrderKpiCards from './OrderKpiCards';
import RentalOrderDetailModal from './RentalOrderDetailModal';
import SaleOrderDetailModal from './SaleOrderDetailModal';
import { useOrders } from './useOrders';
import {
  formatCurrency,
  formatDate,
  formatPeriod,
  RENTAL_STATUS_MAP,
  SALES_STATUS_MAP,
  DEPOSIT_STATUS_MAP,
  PAYMENT_STATUS_MAP,
} from './orderUtils';
import '../../styles/ShopDashboard.css';
import '../../styles/ShopBranches.css';
import '../../styles/OrderMonitoring.css';


export default function OrdersMonitoringView({ type = 'rental', isBranch = false }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const Sidebar = isBranch ? BranchSidebar : OwnerSidebar;

  const {
    orders,
    metrics,
    scopeInfo,
    loading,
    error,
    activeTab,
    searchQuery,
    selectedBranchId,
    branchesList,
    activeBranch,
    activeBranchName,
    isActiveBranchHQ,
    isChainScope,
    pagination,
    selectedOrderId,
    isModalOpen,
    setSearchQuery,
    changeTab,
    changeBranch,
    changePage,
    openOrderDetail,
    closeOrderDetail,
    refetch,
  } = useOrders(type, '', isBranch);

  // Status tabs config with friendly customer-centric terminology
  const statusTabs = useMemo(() => {
    if (type === 'rental') {
      const m = metrics || {};
      return [
        { key: 'all', label: 'Tất Cả', count: m.total },
        { key: 'renting', label: 'Đang Cho Thuê', count: m.renting },
        { key: 'overdue', label: 'Quá Hạn Trả', count: m.overdue },
        { key: 'partially_returned', label: 'Trả 1 Phần', count: m.partially_returned || m.partiallyReturned },
        { key: 'returned', label: 'Đã Trả Đồ', count: m.returned },
        { key: 'cancelled', label: 'Đã Hủy', count: m.cancelled },
      ];
    }
    const m = metrics || {};
    return [
      { key: 'all', label: 'Tất Cả', count: m.total },
      { key: 'confirmed', label: 'Chờ Đóng Gói', count: m.confirmed },
      { key: 'processing', label: 'Đang Chuẩn Bị', count: m.processing },
      { key: 'completed', label: 'Giao Thành Công', count: m.completed },
      { key: 'cancelled', label: 'Đã Hủy', count: m.cancelled },
    ];
  }, [type, metrics]);

  // Page title & subtitle with friendly terms
  const pageTitle = useMemo(() => {
    if (type === 'rental') {
      return isBranch
        ? `Quản Lý Đơn Thuê Chi Nhánh${activeBranchName ? ` - ${activeBranchName}` : ''}`
        : 'Theo Dõi Đơn Thuê Chuỗi Cửa Hàng';
    }
    return isBranch
      ? `Quản Lý Đơn Bán Chi Nhánh${activeBranchName ? ` - ${activeBranchName}` : ''}`
      : 'Theo Dõi Đơn Bán Chuỗi Cửa Hàng';
  }, [type, isBranch, activeBranchName]);

  const pageDesc = useMemo(() => {
    if (type === 'rental') {
      return isBranch
        ? 'Theo dõi và xử lý giao nhận trang phục, bảo lưu tiền cọc và tiếp nhận hoàn trả tại chi nhánh phụ trách.'
        : 'Theo dõi toàn bộ chu kỳ thuê trang phục, trạng thái tiền cọc và lịch trình hoàn trả trên toàn chuỗi cửa hàng.';
    }
    return isBranch
      ? 'Theo dõi và xử lý đóng gói, xuất kho và bàn giao trang phục cho khách tại chi nhánh phụ trách.'
      : 'Theo dõi toàn bộ đơn bán hàng, tiến độ giao vận và doanh thu bán lẻ trên toàn chuỗi cửa hàng.';
  }, [type, isBranch]);

  const breadcrumbText = useMemo(() => {
    if (type === 'rental') {
      return isBranch ? 'Theo Dõi Đơn Thuê Chi Nhánh' : 'Theo Dõi Đơn Thuê Chuỗi';
    }
    return isBranch ? 'Theo Dõi Đơn Bán Chi Nhánh' : 'Theo Dõi Đơn Bán Chuỗi';
  }, [type, isBranch]);

  return (
    <div className="shop-dashboard-layout">
      {/* 1. Left Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* 2. Main Viewport */}
      <div className="owner-branches-viewport">
        {/* Top Header */}
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb={breadcrumbText}
        />

        {/* Content Container */}
        <main className="owner-branches-main-content">
          <div className="store-mgmt-container">
            {/* Page Hero Bar */}
            <div className="admin-page-hero d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
              <div>
                <h1 className="admin-page-title d-flex align-items-center gap-2">
                  {type === 'rental' ? (
                    <CalendarRange size={24} color="#B45309" />
                  ) : (
                    <ShoppingBag size={24} color="#B45309" />
                  )}
                  <span>{pageTitle}</span>
                </h1>
                <p className="admin-page-desc mb-0">{pageDesc}</p>
              </div>

              <div className="d-flex align-items-center gap-2 flex-wrap">
                {activeBranchName || scopeInfo?.shop?.name ? (
                  <span className="badge bg-light text-dark border px-3 py-2 d-flex align-items-center gap-1">
                    <MapPin size={13} color="#B45309" />
                    <span>Cơ sở: <strong>{activeBranchName || scopeInfo?.shop?.name}</strong></span>
                    {(isActiveBranchHQ || scopeInfo?.shop?.isHQ) && (
                      <span className="branch-tag-hq ms-1">Trụ sở chính</span>
                    )}
                  </span>
                ) : (
                  <span className="badge bg-light text-dark border px-3 py-2 d-flex align-items-center gap-1">
                    <Building2 size={13} color="#B45309" />
                    <span>Toàn Hệ Thống</span>
                  </span>
                )}
                <span className="badge bg-light text-dark border px-3 py-2">
                  Hiển thị <strong>{orders.length}</strong> / {pagination?.totalItems || orders.length} đơn
                </span>
              </div>
            </div>

            {/* Clean KPI Cards */}
            <OrderKpiCards
              type={type}
              metrics={metrics}
              isChainScope={isChainScope}
              branchName={activeBranchName || scopeInfo?.shop?.name}
              loading={loading && !metrics}
            />

            {/* Unified Taskbar */}
            <OrderFilterBar
              type={type}
              statusTabs={statusTabs}
              activeTab={activeTab}
              onTabChange={changeTab}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              branches={branchesList}
              selectedBranchId={selectedBranchId}
              onSelectBranch={changeBranch}
              isBranchMode={isBranch}
              activeBranch={activeBranch}
              onRefresh={refetch}
              loading={loading}
            />

            {/* Error Banner */}
            {error && (
              <div className="order-error-banner mb-3">
                <AlertTriangle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Orders Table Card */}
            <div className="order-table-card">
              <div className="order-table-responsive">
                <table className="order-table">
                  <thead>
                    {type === 'rental' ? (
                      <tr>
                        <th>MÃ ĐƠN</th>
                        <th>KHÁCH HÀNG</th>
                        <th>TRANG PHỤC THUÊ</th>
                        <th>CHI NHÁNH</th>
                        <th>THỜI HẠN THUÊ</th>
                        <th style={{ textAlign: 'right' }}>TIỀN THUÊ (VND)</th>
                        <th style={{ textAlign: 'right' }}>TIỀN CỌC (VND)</th>
                        <th style={{ textAlign: 'center' }}>TRẠNG THÁI</th>
                        <th style={{ textAlign: 'center' }}>{isBranch ? 'XỬ LÝ' : 'CHI TIẾT'}</th>
                      </tr>
                    ) : (
                      <tr>
                        <th>MÃ ĐƠN</th>
                        <th>KHÁCH HÀNG</th>
                        <th>SẢN PHẨM MUA</th>
                        <th>CHI NHÁNH</th>
                        <th style={{ textAlign: 'right' }}>TỔNG TIỀN (VND)</th>
                        <th style={{ textAlign: 'center' }}>THANH TOÁN</th>
                        <th style={{ textAlign: 'center' }}>TRẠNG THÁI</th>
                        <th style={{ textAlign: 'center' }}>{isBranch ? 'XỬ LÝ' : 'CHI TIẾT'}</th>
                      </tr>
                    )}
                  </thead>

                  <tbody>
                    {loading && !orders.length ? (
                      [1, 2, 3, 4, 5].map((row) => (
                        <tr key={row}>
                          <td colSpan={type === 'rental' ? 9 : 8} style={{ padding: '12px 16px' }}>
                            <div className="order-skeleton" style={{ height: '24px' }} />
                          </td>
                        </tr>
                      ))
                    ) : orders.length === 0 ? (
                      <tr>
                        <td colSpan={type === 'rental' ? 9 : 8}>
                          <div className="branch-empty-box py-5 my-2 text-center">
                            <div className="empty-icon-wrap mb-2 mx-auto">
                              <Inbox size={28} />
                            </div>
                            <h5 className="empty-title mb-1">
                              {type === 'rental' ? 'Không Tìm Thấy Đơn Thuê Nào' : 'Không Tìm Thấy Đơn Bán Nào'}
                            </h5>
                            <p className="empty-desc text-muted small mb-0">
                              {searchQuery || activeTab !== 'all' || selectedBranchId
                                ? 'Hãy điều chỉnh từ khóa tìm kiếm, tab trạng thái hoặc chi nhánh.'
                                : 'Hiện chưa có đơn hàng nào được ghi nhận.'}
                            </p>
                            {(searchQuery || activeTab !== 'all' || selectedBranchId) && (
                              <button
                                type="button"
                                className="btn-modal-secondary d-inline-flex align-items-center gap-1 mt-3 mx-auto"
                                onClick={() => {
                                  setSearchQuery('');
                                  changeTab('all');
                                  changeBranch('');
                                }}
                              >
                                <RotateCcw size={13} />
                                <span>Đặt Lại Bộ Lọc</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      orders.map((o) => {
                        const cust = o.customerId || o.customerInfo || o.customer || {};
                        const customerName = cust.FullName || cust.fullName || cust.name || 'Khách vãng lai';
                        const customerPhone = cust.Information?.Phone || cust.phone || cust.Email || cust.email || '—';
                        const branchName =
                          o.locationId?.shopId?.name ||
                          o.locationId?.name ||
                          o.branchId?.name ||
                          o.branchId?.shopName ||
                          o.branchName ||
                          'Cửa hàng chính';
                        const isOrderHQ = Boolean(
                          o.locationId?.shopId?.isHQ ||
                          o.locationId?.isHQ ||
                          o.shopId?.isHQ ||
                          o.isHQ ||
                          o.branchId?.isHQ
                        );

                        const firstItem = o.items?.[0] || {};
                        const productInfo = firstItem.variantId?.productId || o.productId || {};
                        const variantInfo = firstItem.variantId || o.variantId || {};
                        const extraCount = Math.max(0, (o.items?.length || 1) - 1);

                        if (type === 'rental') {
                          const statusDef = RENTAL_STATUS_MAP[o.rentalStatus || o.status] || {
                            text: o.rentalStatus || o.status || 'Chưa rõ',
                            chipClass: 'draft',
                          };
                          const depositDef = DEPOSIT_STATUS_MAP[o.depositStatus] || {
                            text: o.depositStatus || 'Chưa cọc',
                            chipClass: 'pending',
                          };

                          const isOverdue =
                            (o.rentalStatus === 'overdue' || o.status === 'overdue') ||
                            ((o.rentalStatus === 'renting' || o.status === 'renting') &&
                              (o.dueDate || o.rentalEndDate) &&
                              new Date(o.dueDate || o.rentalEndDate) < new Date());

                          return (
                            <tr key={o._id}>
                              {/* 1. Mã đơn */}
                              <td>
                                <div className="order-code-title">
                                  {o.orderCode || `#THUE-${String(o._id || '').slice(-6).toUpperCase()}`}
                                </div>
                                <div className="order-code-date">{formatDate(o.createdAt)}</div>
                              </td>

                              {/* 2. Khách hàng */}
                              <td>
                                <div className="order-customer-name">{customerName}</div>
                                <div className="order-customer-sub">{customerPhone}</div>
                              </td>

                              {/* 3. Trang phục thuê */}
                              <td>
                                <div className="order-product-name">
                                  {productInfo?.name || firstItem?.productName || 'Trang phục thuê'}
                                  {extraCount > 0 && (
                                    <span className="order-product-extra ms-1">
                                      +{extraCount} món
                                    </span>
                                  )}
                                </div>
                                <div className="order-product-variant">
                                  {variantInfo?.size ? `Size ${variantInfo.size}` : ''}
                                  {variantInfo?.color ? ` • ${variantInfo.color}` : ''}
                                </div>
                              </td>

                              {/* 4. Chi nhánh */}
                              <td>
                                <div className="order-branch-col-name d-flex align-items-center gap-1 flex-wrap">
                                  <Store size={13} className="text-muted" />
                                  <span>{branchName}</span>
                                  {isOrderHQ && (
                                    <span className="branch-tag-hq ms-1">Trụ sở chính</span>
                                  )}
                                </div>
                              </td>

                              {/* 5. Thời hạn thuê */}
                              <td>
                                <div className="order-period-text">
                                  {formatPeriod(o.rentalStartDate || o.startDate, o.dueDate || o.rentalEndDate)}
                                </div>
                                {isOverdue && (
                                  <div className="order-overdue-tag">
                                    <AlertTriangle size={11} /> Quá hạn
                                  </div>
                                )}
                              </td>

                              {/* 6. Tiền thuê */}
                              <td style={{ textAlign: 'right' }}>
                                <div className="order-fee-primary">
                                  {formatCurrency(o.rentalFee || o.totalRentalFee || o.totalAmount)}
                                </div>
                              </td>

                              {/* 7. Tiền cọc */}
                              <td style={{ textAlign: 'right' }}>
                                <div className="order-deposit-amount">
                                  {formatCurrency(o.depositAmount)}
                                </div>
                                <span className={`order-badge ${depositDef.chipClass}`} style={{ fontSize: '11px', padding: '2px 6px' }}>
                                  <span className="order-badge-dot" />
                                  {depositDef.text}
                                </span>
                              </td>

                              {/* 8. Trạng thái */}
                              <td style={{ textAlign: 'center' }}>
                                <span className={`order-badge ${statusDef.chipClass}`}>
                                  <span className="order-badge-dot" />
                                  {statusDef.text}
                                </span>
                              </td>

                              {/* 9. Thao tác */}
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="order-action-btn"
                                  onClick={() => openOrderDetail(o._id)}
                                  title={isBranch ? 'Xử lý đơn thuê' : 'Xem chi tiết đơn thuê'}
                                >
                                  <Eye size={13} />
                                  <span>{isBranch ? 'Xử Lý' : 'Xem'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        // type === 'sale'
                        const salesStatusDef = SALES_STATUS_MAP[o.orderStatus || o.salesStatus || o.status] || {
                          text: o.orderStatus || o.salesStatus || o.status || 'Chưa rõ',
                          chipClass: 'draft',
                        };
                        const payDef = PAYMENT_STATUS_MAP[o.paymentStatus] || {
                          text: o.paymentStatus || 'Chưa thanh toán',
                          chipClass: 'cancelled',
                        };

                        return (
                          <tr key={o._id}>
                            {/* 1. Mã đơn & Ngày tạo */}
                            <td>
                              <div className="order-code-title">
                                {o.orderCode || `#BAN-${String(o._id || '').slice(-6).toUpperCase()}`}
                              </div>
                              <div className="order-code-date">{formatDate(o.createdAt)}</div>
                            </td>

                            {/* 2. Khách hàng */}
                            <td>
                              <div className="order-customer-name">{customerName}</div>
                              <div className="order-customer-sub">{customerPhone}</div>
                            </td>

                            {/* 3. Sản phẩm mua */}
                            <td>
                              <div className="order-product-name">
                                {productInfo?.name || firstItem?.productName || 'Trang phục bán'}
                                {extraCount > 0 && (
                                  <span className="order-product-extra ms-1">
                                    +{extraCount} món
                                  </span>
                                )}
                              </div>
                              <div className="order-product-variant">
                                {variantInfo?.size ? `Size ${variantInfo.size}` : ''}
                                {variantInfo?.color ? ` • ${variantInfo.color}` : ''}
                              </div>
                            </td>

                            {/* 4. Chi nhánh */}
                            <td>
                              <div className="order-branch-col-name d-flex align-items-center gap-1 flex-wrap">
                                <Store size={13} className="text-muted" />
                                <span>{branchName}</span>
                                {isOrderHQ && (
                                  <span className="branch-tag-hq ms-1">Trụ sở chính</span>
                                )}
                              </div>
                            </td>

                            {/* 5. Tổng tiền */}
                            <td style={{ textAlign: 'right' }}>
                              <div className="order-fee-primary">
                                {formatCurrency(o.totalAmount || o.finalAmount)}
                              </div>
                            </td>

                            {/* 6. Thanh toán */}
                            <td style={{ textAlign: 'center' }}>
                              <span className={`order-badge ${payDef.chipClass}`} style={{ fontSize: '11px', padding: '2px 6px' }}>
                                <CreditCard size={11} className="me-1" />
                                {payDef.text}
                              </span>
                            </td>

                            {/* 7. Trạng thái */}
                            <td style={{ textAlign: 'center' }}>
                              <span className={`order-badge ${salesStatusDef.chipClass}`}>
                                <span className="order-badge-dot" />
                                {salesStatusDef.text}
                              </span>
                            </td>

                            {/* 8. Thao tác */}
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="order-action-btn"
                                onClick={() => openOrderDetail(o._id)}
                                title={isBranch ? 'Xử lý đơn bán' : 'Xem chi tiết đơn bán'}
                              >
                                <Eye size={13} />
                                <span>{isBranch ? 'Xử Lý' : 'Xem'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <OrderPagination
                pagination={pagination}
                onPageChange={changePage}
                entityName={type === 'rental' ? 'đơn thuê' : 'đơn bán'}
              />
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      {type === 'rental' ? (
        <RentalOrderDetailModal
          isOpen={isModalOpen}
          onClose={closeOrderDetail}
          orderId={selectedOrderId}
          isReadOnly={!isBranch}
          onAction={(act, ord) => {
            if (act === 'print') {
              window.print();
            }
          }}
        />
      ) : (
        <SaleOrderDetailModal
          isOpen={isModalOpen}
          onClose={closeOrderDetail}
          orderId={selectedOrderId}
          isReadOnly={!isBranch}
          onAction={(act, ord) => {
            if (act === 'print') {
              window.print();
            }
          }}
        />
      )}
    </div>
  );
}

export const RentalOrdersView = (props) => (
  <OrdersMonitoringView type="rental" {...props} />
);

export const SaleOrdersView = (props) => (
  <OrdersMonitoringView type="sale" {...props} />
);
