/**
 * Barcode Scanner & Physical Item Assignment Modal
 * Cho phép nhân viên chi nhánh quét/nhập mã vạch hiện vật kho để gán vào đơn thuê
 * Zero-Alert, Zero-Emoji, 100% lucide-react
 * @ears .sdd/features/rental-orders/SPEC.md#REQ-RENT-006
 */

import React, { useState } from 'react';
import HauteCoutureModal from './HauteCoutureModal';
import { ScanBarcode, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { assignPhysicalItems } from '../services/rentalOrderApi';

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  order,
  onSuccess,
}) {
  const [barcodeInputs, setBarcodeInputs] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!order) return null;

  const orderItems = order.items || order.orderDetails || [];

  const handleInputChange = (itemId, value) => {
    setBarcodeInputs((prev) => ({
      ...prev,
      [itemId]: value,
    }));
    setErrorMessage('');
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Chuẩn bị payload assignments
    const assignments = [];
    for (const item of orderItems) {
      const codeStr = (barcodeInputs[item._id] || '').trim();
      if (!codeStr) {
        setErrorMessage(`Vui lòng quét hoặc nhập mã vạch hiện vật cho món: ${item.productName || item.name || 'trang phục'}`);
        return;
      }
      // Mỗi món có thể có 1 hoặc nhiều mã cách nhau bằng dấu phẩy
      const itemIds = codeStr.split(',').map((s) => s.trim()).filter(Boolean);
      assignments.push({
        orderItemId: item._id,
        assignedItemIds: itemIds,
      });
    }

    setIsSubmitting(true);
    try {
      const res = await assignPhysicalItems(order._id, assignments);
      setSuccessMessage(res.message || 'Gán mã vạch hiện vật thành công!');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1000);
    } catch (err) {
      setErrorMessage(err.message || 'Không thể gán hiện vật kho. Vui lòng kiểm tra lại mã.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <HauteCoutureModal
      isOpen={isOpen}
      onClose={onClose}
      title="Gán Mã Vạch Hiện Vật Kho"
      subtitle={`Đơn thuê #${order.orderCode || order.id || order._id} • ${orderItems.length} món trang phục`}
      maxWidth="620px"
    >
      <form onSubmit={handleAssign}>
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
            <AlertCircle size={16} />
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
          {orderItems.map((item, idx) => (
            <div
              key={item._id || idx}
              style={{
                padding: '14px',
                border: '1px solid #E5E0D8',
                borderRadius: '8px',
                backgroundColor: '#FAFAF9',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, color: '#171717', fontSize: '13px' }}>
                  {item.productName || item.name || `Sản phẩm #${idx + 1}`}
                </span>
                <span style={{ fontSize: '12px', color: '#78716C' }}>
                  Số lượng: {item.quantity || 1}
                </span>
              </div>

              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#A8A29E',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ScanBarcode size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Quét hoặc nhập mã vạch hiện vật kho (Serial / Barcode ID)..."
                  value={barcodeInputs[item._id] || ''}
                  onChange={(e) => handleInputChange(item._id, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 40px',
                    borderRadius: '6px',
                    border: '1px solid #D6D3D1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '10px 18px',
              borderRadius: '6px',
              border: '1px solid #D6D3D1',
              backgroundColor: '#FFFFFF',
              color: '#44403C',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Hủy Bỏ
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              padding: '10px 22px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#171717',
              color: '#F8F7F4',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Đang Gán Hiện Vật...</span>
              </>
            ) : (
              <span>Xác Nhận Gán Mã Vạch</span>
            )}
          </button>
        </div>
      </form>
    </HauteCoutureModal>
  );
}
