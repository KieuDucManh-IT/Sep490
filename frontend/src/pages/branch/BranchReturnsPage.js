/**
 * Branch Returns & Deposit Settlement Page
 * Tiếp nhận trả đồ, kiểm định KCS và quyết toán hoàn tiền cọc
 * Zero-Alert, Zero-Emoji, 100% Native Fetch API
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-013..REQ-RENT-017
 */

import React, { useState, useEffect, useCallback } from 'react';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import HauteCoutureModal from '../../components/HauteCoutureModal';
import { getRentalOrders } from '../../services/rentalOrderApi';
import { createRentalReturn } from '../../services/rentalReturnApi';
import {
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Calendar,
  ShieldCheck,
} from 'lucide-react';
import '../../styles/ShopDashboard.css';

export default function BranchReturnsPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('renting');
  const [searchTerm, setSearchTerm] = useState('');
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Return Inspection Modal State
  const [inspectingOrder, setInspectingOrder] = useState(null);
  const [inspectionItems, setInspectionItems] = useState([]);
  const [inspectionNote, setInspectionNote] = useState('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [settlementResult, setSettlementResult] = useState(null);

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
      setErrorNotice(err.message || 'Không thể tải danh sách đơn trả đồ.');
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

  const handleOpenInspection = (order) => {
    setInspectingOrder(order);
    setSettlementResult(null);
    setInspectionNote('');
    const items = (order.items || order.orderDetails || []).map((it) => ({
      itemId: it.assignedItemIds?.[0] || it.itemId || it._id,
      productName: it.productName || it.name || 'Trang phục thuê',
      conditionOnReturn: 'good',
      damageFee: 0,
      note: '',
    }));
    setInspectionItems(items);
  };

  const handleItemConditionChange = (idx, field, value) => {
    setInspectionItems((prev) => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        [field]: value,
      };
      return updated;
    });
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    if (!inspectingOrder) return;

    setIsSubmittingReturn(true);
    setErrorNotice('');
    try {
      const payload = {
        items: inspectionItems.map((it) => ({
          itemId: it.itemId,
          conditionOnReturn: it.conditionOnReturn,
          damageFee: Number(it.damageFee) || 0,
          note: it.note || '',
        })),
        note: inspectionNote,
      };

      const res = await createRentalReturn(inspectingOrder._id, payload);
      setSettlementResult(res.settlementSummary);
      showToast('Nghiệm thu KCS và quyết toán cọc thành công!');
      fetchOrders();
    } catch (err) {
      setErrorNotice(err.message || 'Có lỗi xảy ra khi quyết toán trả đồ.');
    } finally {
      setIsSubmittingReturn(false);
    }
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
          breadcrumb="Kiểm Định Nhận Trả & Hoàn Cọc"
        />

        <div className="shop-content-scroll">
          {/* Page Hero */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
            <div>
              <h1 className="admin-page-title" style={{ fontSize: '26px', margin: '0 0 4px 0', fontFamily: 'serif' }}>
                Xác Nhận Trả Hàng & Quyết Toán Hoàn Cọc
              </h1>
              <p className="admin-page-desc" style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                Kiểm định chất lượng trang phục thực tế sau thuê, tự động tính phí trễ hạn (150%) và giải ngân cọc về Ví khách hàng.
              </p>
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

          {/* Filters */}
          <div className="dashboard-table-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'renting', label: 'Đang Thuê / Cần Trả' },
                  { id: 'returned', label: 'Đã Nghiệm Thu Hoàn Tất' },
                  { id: 'all', label: 'Tất Cả' },
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

            {/* Table */}
            {isLoading ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#78716C' }}>
                <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
                <p style={{ fontSize: '14px', margin: 0 }}>Đang nạp danh sách trả đồ...</p>
              </div>
            ) : orders.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#78716C' }}>
                <ShieldCheck size={36} style={{ margin: '0 auto 12px auto', color: '#D6D3D1' }} />
                <p style={{ fontSize: '15px', fontWeight: 500, margin: '0 0 4px 0' }}>Không có đơn nào cần xử lý trả đồ</p>
                <p style={{ fontSize: '13px', margin: 0, color: '#A8A29E' }}>Toàn bộ đơn thuê đã được nghiệm thu và quyết toán cọc đầy đủ.</p>
              </div>
            ) : (
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>MÃ ĐƠN THUÊ</th>
                    <th>KHÁCH HÀNG</th>
                    <th>THỜI HẠN TRẢ ĐỒ</th>
                    <th>TIỀN CỌC ĐANG GIỮ</th>
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
                          <span>Hạn trả: {formatDate(o.dueDate)}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#C5A880' }}>
                          {formatPrice(o.depositAmount)}
                        </div>
                        <div style={{ fontSize: '11px', color: '#059669' }}>
                          {o.depositStatus === 'held' ? 'Đang tạm giữ' : o.depositStatus}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: o.rentalStatus === 'returned' ? '#16A34A' : '#0284C7',
                            backgroundColor: o.rentalStatus === 'returned' ? '#F0FDF4' : '#F0F9FF',
                            textTransform: 'uppercase',
                          }}
                        >
                          {o.rentalStatus === 'returned' ? 'ĐÃ TRẢ ĐỒ' : 'ĐANG THUÊ'}
                        </span>
                      </td>
                      <td>
                        {o.rentalStatus !== 'returned' ? (
                          <button
                            type="button"
                            onClick={() => handleOpenInspection(o)}
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
                            <RotateCcw size={13} />
                            <span>Nghiệm Thu Trả Đồ</span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600 }}>
                            ✓ Đã Quyết Toán
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal Nghiệm Thu KCS & Quyết Toán Cọc */}
      <HauteCoutureModal
        isOpen={Boolean(inspectingOrder)}
        onClose={() => {
          setInspectingOrder(null);
          setSettlementResult(null);
        }}
        title="Biên Bản Nghiệm Thu KCS & Quyết Toán Cọc"
        subtitle={`Đơn thuê #${inspectingOrder?.orderCode || inspectingOrder?._id} • Cọc gốc: ${formatPrice(inspectingOrder?.depositAmount)}`}
        maxWidth="680px"
      >
        {settlementResult ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <CheckCircle2 size={32} />
            </div>
            <h4 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0', color: '#171717' }}>
              Quyết Toán Tiền Cọc Thành Công!
            </h4>
            <p style={{ fontSize: '13px', color: '#78716C', margin: '0 0 24px 0' }}>
              Hệ thống đã tự động hoàn trả số dư khả dụng vào Ví nội bộ của khách hàng.
            </p>

            <div style={{ backgroundColor: '#F8F7F4', border: '1px solid #E5E0D8', borderRadius: '8px', padding: '16px', textAlign: 'left', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#78716C', fontSize: '13px' }}>Tổng tiền cọc ban đầu:</span>
                <strong style={{ color: '#171717' }}>{formatPrice(settlementResult.totalDeposit)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#78716C', fontSize: '13px' }}>Phạt trễ hạn ({settlementResult.lateDays || 0} ngày):</span>
                <span style={{ color: settlementResult.lateFee > 0 ? '#DC2626' : '#171717' }}>
                  -{formatPrice(settlementResult.lateFee)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#78716C', fontSize: '13px' }}>Khấu trừ hư hỏng KCS:</span>
                <span style={{ color: settlementResult.totalDamageFee > 0 ? '#DC2626' : '#171717' }}>
                  -{formatPrice(settlementResult.totalDamageFee)}
                </span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px dashed #D6D3D1', margin: '10px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px' }}>
                <strong style={{ color: '#059669' }}>Thực hoàn về Ví khách:</strong>
                <strong style={{ color: '#059669', fontSize: '16px' }}>{formatPrice(settlementResult.refundDeposit)}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setInspectingOrder(null);
                setSettlementResult(null);
              }}
              style={{
                padding: '10px 24px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#171717',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hoàn Tất Đóng Biên Bản
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitReturn}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              {inspectionItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '14px',
                    border: '1px solid #E5E0D8',
                    borderRadius: '8px',
                    backgroundColor: '#FAFAF9',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#171717', fontSize: '14px', marginBottom: '10px' }}>
                    {item.productName}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#44403C', marginBottom: '4px' }}>
                        Tình trạng kiểm định:
                      </label>
                      <select
                        value={item.conditionOnReturn}
                        onChange={(e) => handleItemConditionChange(idx, 'conditionOnReturn', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '6px',
                          border: '1px solid #D6D3D1',
                          fontSize: '13px',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <option value="good">Hoàn hảo (Không trầy xước / ố bẩn)</option>
                        <option value="worn">Hao mòn nhẹ bình thường</option>
                        <option value="damaged">Hư hỏng nhẹ (Cần giặt tẩy chuyên sâu)</option>
                        <option value="unrepairable">Rách nặng / Không thể khắc phục</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#44403C', marginBottom: '4px' }}>
                        Phí khấu trừ hư hỏng (VND):
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={item.damageFee}
                        onChange={(e) => handleItemConditionChange(idx, 'damageFee', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px',
                          borderRadius: '6px',
                          border: '1px solid #D6D3D1',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Ghi chú chi tiết tình trạng lỗi nếu có..."
                      value={item.note}
                      onChange={(e) => handleItemConditionChange(idx, 'note', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #D6D3D1',
                        fontSize: '12px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#171717', marginBottom: '6px' }}>
                Ghi chú nghiệm thu chung:
              </label>
              <textarea
                value={inspectionNote}
                onChange={(e) => setInspectionNote(e.target.value)}
                placeholder="Ghi chú thêm về đơn hàng hoặc thỏa thuận với khách..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #D6D3D1',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setInspectingOrder(null)}
                disabled={isSubmittingReturn}
                style={{
                  padding: '10px 18px',
                  borderRadius: '6px',
                  border: '1px solid #D6D3D1',
                  backgroundColor: '#FFFFFF',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Hủy Bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmittingReturn}
                style={{
                  padding: '10px 22px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#171717',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isSubmittingReturn ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {isSubmittingReturn ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang Quyết Toán Cọc...</span>
                  </>
                ) : (
                  <span>Xác Nhận & Hoàn Cọc Ví</span>
                )}
              </button>
            </div>
          </form>
        )}
      </HauteCoutureModal>
    </div>
  );
}
