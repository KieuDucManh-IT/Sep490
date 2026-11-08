/**
 * Customer Rental Order Detail & Action Modal
 * Xem chi tiết đơn thuê, hủy đơn khi chưa giao, hoặc nộp đơn khiếu nại đổi trả 24h
 * Zero-Alert, Zero-Emoji, Haute Couture Design
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-002
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-009..REQ-RENT-012
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-018
 */

import React, { useState } from 'react';
import HauteCoutureModal from '../HauteCoutureModal';
import { cancelRentalOrder } from '../../services/rentalOrderApi';
import { createRentalClaim } from '../../services/rentalReturnApi';
import {
  Calendar,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  RotateCcw,
  CheckCircle2,
  Loader2,
  Clock,
  Info,
} from 'lucide-react';

export default function RentalOrderDetailModal({
  isOpen,
  onClose,
  order,
  onOrderUpdated,
}) {
  const [viewMode, setViewMode] = useState('details'); // 'details' | 'cancel' | 'dispute'
  const [cancelReason, setCancelReason] = useState('');
  const [disputeReason, setDisputeReason] = useState('manufacturing_defect');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!order) return null;

  const orderItems = order.items || order.orderDetails || [];

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

  // Kiểm tra điều kiện nộp đơn khiếu nại 24h
  const isWithin24hWindow = () => {
    if (!['renting', 'ready_for_pickup'].includes(order.rentalStatus)) return false;
    const baseDate = order.actualPickupDate || order.startDate || order.updatedAt;
    const elapsed = Date.now() - new Date(baseDate).getTime();
    return elapsed <= 24 * 60 * 60 * 1000;
  };

  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setErrorMessage('Vui lòng nhập lý do hủy đơn thuê');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      await cancelRentalOrder(order._id, cancelReason);
      setSuccessMessage('Hủy đơn thuê thành công!');
      setTimeout(() => {
        if (onOrderUpdated) onOrderUpdated();
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMessage(err.message || 'Không thể hủy đơn thuê.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!disputeDesc.trim() || disputeDesc.trim().length < 10) {
      setErrorMessage('Vui lòng mô tả chi tiết lỗi phát hiện (tối thiểu 10 ký tự)');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const images = evidenceUrl.trim()
        ? evidenceUrl.split(',').map((s) => s.trim()).filter(Boolean)
        : ['https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80'];

      await createRentalClaim(order._id, {
        reason: disputeReason,
        description: disputeDesc,
        evidenceImages: images,
      });

      setSuccessMessage('Đã nộp phiếu yêu cầu đổi trả 24h thành công! CSKH sẽ phản hồi trong 72h.');
      setTimeout(() => {
        if (onOrderUpdated) onOrderUpdated();
        onClose();
      }, 1500);
    } catch (err) {
      setErrorMessage(err.message || 'Không thể gửi khiếu nại đổi trả.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <HauteCoutureModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        viewMode === 'cancel'
          ? 'Hủy Đơn Thuê Trang Phục'
          : viewMode === 'dispute'
          ? 'Yêu Cầu Đổi Trả Do Lỗi Sản Xuất (24h)'
          : `Chi Tiết Đơn Thuê #${order.orderCode || order._id.slice(-6).toUpperCase()}`
      }
      subtitle={
        viewMode === 'details'
          ? `Ngày tạo: ${formatDate(order.createdAt)} • Trạng thái: ${order.rentalStatus}`
          : undefined
      }
      maxWidth="640px"
    >
      {errorMessage && (
        <div
          style={{
            padding: '12px 16px',
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
          <AlertTriangle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div
          style={{
            padding: '12px 16px',
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
          <span>{successMessage}</span>
        </div>
      )}

      {viewMode === 'details' && (
        <div>
          {/* Thời hạn thuê */}
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: '#FCFAF8',
              border: '1px solid #E5E0D8',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={18} color="#C5A880" />
              <div>
                <div style={{ fontSize: '11px', color: '#78716C', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Thời Hạn Thuê & Trả Đồ
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>
                  {formatDate(order.startDate)} → {formatDate(order.dueDate)}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#78716C', textTransform: 'uppercase' }}>Trạng Thái Cọc</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#C5A880' }}>
                {order.depositStatus === 'held' ? 'Shop đang giữ cọc' : order.depositStatus}
              </div>
            </div>
          </div>

          {/* Danh sách trang phục */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 10px 0', color: '#171717' }}>
              Trang Phục Trong Đơn
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {orderItems.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    border: '1px solid #F1ECE4',
                    borderRadius: '6px',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#171717' }}>
                      {item.productName || item.name || `Sản phẩm #${idx + 1}`}
                    </div>
                    <div style={{ fontSize: '11px', color: '#78716C' }}>
                      Số lượng: {item.quantity || 1}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}>
                      {formatPrice(item.rentalPrice || item.lineTotal || order.rentalFee)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chi tiết tài chính */}
          <div
            style={{
              padding: '16px',
              backgroundColor: '#FAFAF9',
              borderRadius: '8px',
              border: '1px solid #E5E0D8',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <span style={{ color: '#78716C' }}>Tiền thuê trang phục:</span>
              <strong style={{ color: '#171717' }}>{formatPrice(order.rentalFee)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px' }}>
              <span style={{ color: '#78716C' }}>Tiền đặt cọc bảo đảm:</span>
              <strong style={{ color: '#C5A880' }}>{formatPrice(order.depositAmount)}</strong>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid #E5E0D8', margin: '10px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
              <span style={{ fontWeight: 600, color: '#171717' }}>Tổng thanh toán & cọc:</span>
              <strong style={{ fontSize: '16px', color: '#171717' }}>
                {formatPrice((order.rentalFee || 0) + (order.depositAmount || 0))}
              </strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              {['confirmed', 'preparing', 'pending_payment'].includes(order.rentalStatus) && (
                <button
                  type="button"
                  onClick={() => setViewMode('cancel')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #FECACA',
                    backgroundColor: '#FEF2F2',
                    color: '#DC2626',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <XCircle size={15} />
                  <span>Hủy Đơn Thuê</span>
                </button>
              )}

              {isWithin24hWindow() && (
                <button
                  type="button"
                  onClick={() => setViewMode('dispute')}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #C5A880',
                    backgroundColor: '#FCFAF8',
                    color: '#785A28',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <RotateCcw size={15} />
                  <span>Yêu Cầu Đổi Trả (24h)</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 20px',
                borderRadius: '6px',
                border: '1px solid #D6D3D1',
                backgroundColor: '#FFFFFF',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* Chế độ HỦY ĐƠN */}
      {viewMode === 'cancel' && (
        <form onSubmit={handleCancelSubmit}>
          <p style={{ fontSize: '13px', color: '#44403C', margin: '0 0 16px 0' }}>
            Hủy đơn trước 24h tính từ giờ bắt đầu thuê sẽ được hoàn tiền 100%. Nếu hủy trong vòng 24h trước khi thuê, phí thuê 1 ngày đầu sẽ được giữ lại theo chính sách.
          </p>

          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#171717', marginBottom: '6px' }}>
            Lý do hủy đơn:
          </label>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ví dụ: Thay đổi kế hoạch dự tiệc, lịch công tác bị hoãn..."
            rows={3}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              border: '1px solid #D6D3D1',
              fontSize: '13px',
              boxSizing: 'border-box',
              marginBottom: '20px',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setViewMode('details')}
              disabled={isSubmitting}
              style={{
                padding: '9px 16px',
                borderRadius: '6px',
                border: '1px solid #D6D3D1',
                backgroundColor: '#FFFFFF',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Quay Lại
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '9px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>Xác Nhận Hủy Đơn</span>
            </button>
          </div>
        </form>
      )}

      {/* Chế độ KHIẾU NẠI ĐỔI TRẢ 24H (MIN.DE POLICY) */}
      {viewMode === 'dispute' && (
        <form onSubmit={handleDisputeSubmit}>
          <div
            style={{
              padding: '12px',
              backgroundColor: '#FCFAF8',
              border: '1px solid #E5E0D8',
              borderRadius: '6px',
              marginBottom: '16px',
              fontSize: '12px',
              color: '#785A28',
              display: 'flex',
              gap: '8px',
            }}
          >
            <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong>Chính sách đổi trả Min.de / Vestora:</strong> Thông báo trong vòng 24h kể từ khi nhận hàng. CSKH xử lý trong 72h. Khách hàng có 10 ngày để gửi trả hàng về showroom. Hoàn tiền 100% sau khi kiểm duyệt KCS.
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#171717', marginBottom: '4px' }}>
              Lý do đổi trả:
            </label>
            <select
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #D6D3D1',
                fontSize: '13px',
                backgroundColor: '#FFFFFF',
              }}
            >
              <option value="manufacturing_defect">Lỗi từ nhà sản xuất (rách đường chỉ, lỗi khóa kéo, bung cúc)</option>
              <option value="shipping_damage">Hư hỏng trong quá trình vận chuyển (bao bì rách, dập gãy)</option>
              <option value="wrong_item">Giao sai mẫu mã, sai kích thước hoặc thiếu phụ kiện đính kèm</option>
            </select>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#171717', marginBottom: '4px' }}>
              Mô tả chi tiết tình trạng lỗi (*):
            </label>
            <textarea
              value={disputeDesc}
              onChange={(e) => setDisputeDesc(e.target.value)}
              placeholder="Vui lòng mô tả cụ thể vị trí và tình trạng lỗi trên trang phục..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #D6D3D1',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#171717', marginBottom: '4px' }}>
              Link ảnh / video bằng chứng (cách nhau dấu phẩy):
            </label>
            <input
              type="text"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://cloudinary.com/image1.jpg, https://..."
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: '1px solid #D6D3D1',
                fontSize: '13px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setViewMode('details')}
              disabled={isSubmitting}
              style={{
                padding: '9px 16px',
                borderRadius: '6px',
                border: '1px solid #D6D3D1',
                backgroundColor: '#FFFFFF',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Quay Lại
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '9px 20px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: '#171717',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              <span>Gửi Phiếu Khiếu Nại 24h</span>
            </button>
          </div>
        </form>
      )}
    </HauteCoutureModal>
  );
}
