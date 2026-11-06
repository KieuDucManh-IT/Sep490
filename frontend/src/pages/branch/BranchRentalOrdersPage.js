/**
 * Branch Rental Orders Management Page
 * Quản lý đơn thuê tại showroom: duyệt đơn, gán mã vạch hiện vật, bàn giao cho khách
 * Zero-Alert, Zero-Emoji, 100% Native Fetch API
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-006..REQ-RENT-008
 */

import React, { useState, useEffect, useCallback } from 'react';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import BarcodeScannerModal from '../../components/BarcodeScannerModal';
import HauteCoutureModal from '../../components/HauteCoutureModal';
import {
  getRentalOrders,
  handoverRentalOrder,
} from '../../services/rentalOrderApi';
import {
  Search,
  FileSpreadsheet,
  PackageCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  ScanBarcode,
  Loader2,
  Calendar,
} from 'lucide-react';
import '../../styles/ShopDashboard.css';

export default function BranchRentalOrdersPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Modals state
  const [selectedOrderForScan, setSelectedOrderForScan] = useState(null);
  const [selectedOrderForHandover, setSelectedOrderForHandover] = useState(null);
  const [handoverNote, setHandoverNote] = useState('');
  const [isHandoverLoading, setIsHandoverLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    setErrorNotice('');
    try {
      const params = {};
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      if (searchTerm) {
        params.search = searchTerm;
      }
      const res = await getRentalOrders(params);
      setOrders(res.data || []);
    } catch (err) {
      setErrorNotice(err.message || 'Không thể tải danh sách đơn thuê.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, searchTerm]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleConfirmHandover = async () => {
    if (!selectedOrderForHandover) return;
    setIsHandoverLoading(true);
    try {
      await handoverRentalOrder(selectedOrderForHandover._id, handoverNote);
      showToast(`Đã bàn giao trang phục cho đơn #${selectedOrderForHandover.orderCode || selectedOrderForHandover._id}!`);
      setSelectedOrderForHandover(null);
      setHandoverNote('');
      fetchOrders();
    } catch (err) {
      setErrorNotice(err.message || 'Không thể xác nhận bàn giao đồ.');
    } finally {
      setIsHandoverLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      pending_payment: { label: 'Chờ Thanh Toán', color: '#D97706', bg: '#FFFBEB' },
      confirmed: { label: 'Đã Xác Nhận', color: '#2563EB', bg: '#EFF6FF' },
      preparing: { label: 'Đang Chuẩn Bị', color: '#7C3AED', bg: '#F5F3FF' },
      ready_for_pickup: { label: 'Sẵn Sàng Giao', color: '#059669', bg: '#ECFDF5' },
      renting: { label: 'Đang Cho Thuê', color: '#0284C7', bg: '#F0F9FF' },
      overdue: { label: 'Quá Hạn Trả', color: '#DC2626', bg: '#FEF2F2' },
      returned: { label: 'Đã Trả Đồ', color: '#16A34A', bg: '#F0FDF4' },
      cancelled: { label: 'Đã Hủy Đơn', color: '#6B7280', bg: '#F3F4F6' },
    };
    const s = map[status] || { label: status, color: '#4B5563', bg: '#F3F4F6' };
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '4px 10px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 600,
          color: s.color,
          backgroundColor: s.bg,
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        {s.label}
      </span>
    );
  };

  const formatPrice = (amount) => {
    return (Number(amount) || 0).toLocaleString('vi-VN') + ' đ';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="shop-dashboard-layout">
      <BranchSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className="admin-main-viewport">
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb="Đơn Thuê Trang Phục"
        />

        <div className="shop-content-scroll">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h1 className="admin-page-title" style={{ fontSize: '26px', margin: '0 0 4px 0', fontFamily: 'serif' }}>
                Quản Lý Đơn Thuê Showroom
              </h1>
              <p className="admin-page-desc" style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                Kiểm soát chu kỳ thuê trang phục, phân bổ hiện vật kho mã vạch và bàn giao trực tiếp tại quầy.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn-secondary"
                style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => showToast('Tính năng xuất báo cáo Excel đang được tạo.')}
              >
                <FileSpreadsheet size={16} />
                <span>XUẤT BÁO CÁO</span>
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div
              style={{
                padding: '12px 18px',
                backgroundColor: '#ECFDF5',
                border: '1px solid #A7F3D0',
                borderRadius: '8px',
                color: '#059669',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{toastMessage}</span>
            </div>
          )}

          {errorNotice && (
            <div
              style={{
                padding: '12px 18px',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                color: '#DC2626',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={16} />
              <span>{errorNotice}</span>
            </div>
          )}

          {/* Filter Tabs & Search */}
          <div className="dashboard-table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: 'Tất Cả' },
                  { id: 'confirmed', label: 'Cần Gán Mã Vạch' },
                  { id: 'ready_for_pickup', label: 'Chờ Bàn Giao' },
                  { id: 'renting', label: 'Đang Cho Thuê' },
                  { id: 'returned', label: 'Đã Trả Đồ' },
                  { id: 'cancelled', label: 'Đã Hủy' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={`category-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                    style={{ fontSize: '12px', padding: '6px 14px' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="search-input-box" style={{ width: '260px', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
                    <Search size={16} />
                  </div>
                  <input
                    type="text"
                    placeholder="Tìm mã đơn, tên khách..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '34px' }}
                  />
                </div>
              </div>
            </div>

            {/* Orders Table */}
            {isLoading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#78716C' }}>
                <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
                <p style={{ fontSize: '14px', margin: 0 }}>Đang nạp dữ liệu đơn thuê từ kho...</p>
              </div>
            ) : orders.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#78716C' }}>
                <PackageCheck size={36} style={{ margin: '0 auto 12px auto', color: '#D6D3D1' }} />
                <p style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px 0' }}>Không có đơn thuê nào</p>
                <p style={{ fontSize: '13px', margin: 0, color: '#A8A29E' }}>Chưa có đơn thuê trang phục theo bộ lọc hiện tại.</p>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>MÃ ĐƠN HÀNG</th>
                    <th>KHÁCH HÀNG</th>
                    <th>THỜI GIAN THUÊ</th>
                    <th>TIỀN THUÊ</th>
                    <th>TIỀN ĐẶT CỌC</th>
                    <th>TRẠNG THÁI</th>
                    <th>HÀNH ĐỘNG</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o._id}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#171717' }}>#{o.orderCode || o._id.slice(-6).toUpperCase()}</div>
                        <div style={{ fontSize: '11px', color: '#9CA3AF' }}>{formatDate(o.createdAt)}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{o.customerId?.name || o.customerId?.phone || 'Khách hàng'}</div>
                        <div style={{ fontSize: '11px', color: '#6B7280' }}>{o.customerId?.phone || ''}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={14} color="#78716C" />
                          <span>{formatDate(o.startDate)} → {formatDate(o.dueDate)}</span>
                        </div>
                      </td>
                      <td>
                        <strong style={{ fontSize: '13px', color: '#171717' }}>{formatPrice(o.rentalFee)}</strong>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#C5A880' }}>
                          {formatPrice(o.depositAmount)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#78716C' }}>
                          {o.depositStatus === 'held' ? '✓ Shop đang giữ cọc' : o.depositStatus}
                        </div>
                      </td>
                      <td>{getStatusBadge(o.rentalStatus)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {['confirmed', 'preparing'].includes(o.rentalStatus) && (
                            <button
                              type="button"
                              onClick={() => setSelectedOrderForScan(o)}
                              style={{
                                padding: '6px 12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '4px',
                                border: '1px solid #171717',
                                backgroundColor: '#171717',
                                color: '#FFFFFF',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <ScanBarcode size={13} />
                              <span>Gán Mã Vạch</span>
                            </button>
                          )}

                          {['ready_for_pickup'].includes(o.rentalStatus) && (
                            <button
                              type="button"
                              onClick={() => setSelectedOrderForHandover(o)}
                              style={{
                                padding: '6px 12px',
                                fontSize: '11px',
                                fontWeight: 600,
                                borderRadius: '4px',
                                border: '1px solid #059669',
                                backgroundColor: '#059669',
                                color: '#FFFFFF',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <CheckCircle2 size={13} />
                              <span>Bàn Giao Đồ</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal Quét Mã Vạch */}
      <BarcodeScannerModal
        isOpen={Boolean(selectedOrderForScan)}
        onClose={() => setSelectedOrderForScan(null)}
        order={selectedOrderForScan}
        onSuccess={() => {
          showToast('Đã gán hiện vật kho thành công!');
          fetchOrders();
        }}
      />

      {/* Modal Bàn Giao Đồ */}
      <HauteCoutureModal
        isOpen={Boolean(selectedOrderForHandover)}
        onClose={() => setSelectedOrderForHandover(null)}
        title="Xác Nhận Bàn Giao Trang Phục"
        subtitle={`Đơn thuê #${selectedOrderForHandover?.orderCode || selectedOrderForHandover?._id}`}
        maxWidth="520px"
      >
        <div>
          <p style={{ margin: '0 0 16px 0', fontSize: '14px', color: '#44403C' }}>
            Vui lòng kiểm tra trang phục nguyên vẹn và xác nhận bàn giao cho khách tại showroom hoặc đơn vị vận chuyển.
          </p>

          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#171717' }}>
            Ghi chú phụ kiện đi kèm (túi bụi, móc treo, tag):
          </label>
          <textarea
            value={handoverNote}
            onChange={(e) => setHandoverNote(e.target.value)}
            placeholder="Ví dụ: Đầy đủ túi bụi nhung, móc áo gỗ, khách đã ký biên bản nhận..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #D6D3D1',
              fontSize: '13px',
              boxSizing: 'border-box',
              marginBottom: '20px',
              fontFamily: 'inherit',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setSelectedOrderForHandover(null)}
              disabled={isHandoverLoading}
              style={{
                padding: '9px 16px',
                borderRadius: '6px',
                border: '1px solid #D6D3D1',
                backgroundColor: '#FFFFFF',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleConfirmHandover}
              disabled={isHandoverLoading}
              style={{
                padding: '9px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#171717',
                color: '#F8F7F4',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isHandoverLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isHandoverLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <span>Xác Nhận Bàn Giao</span>
              )}
            </button>
          </div>
        </div>
      </HauteCoutureModal>
    </div>
  );
}
