import React from 'react';
import { Lock, X, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';

export default function AdminLockAccountModal({
  isOpen,
  onClose,
  isLocking,
  reasonText,
  setReasonText,
  onConfirm
}) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLocking) onClose();
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          width: '100%',
          maxWidth: '490px',
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.16)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            background: '#FFFFFF'
          }}
        >
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Lock size={19} color="#DC2626" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '16px', lineHeight: 1.3 }}>
              Khóa Tài Khoản
            </div>
            <div style={{ color: '#64748B', fontSize: '12.5px', marginTop: '3px' }}>
              Hệ thống sẽ gửi email thông báo lý do tới người dùng
            </div>
          </div>
          <button
            type="button"
            onClick={() => !isLocking && onClose()}
            disabled={isLocking}
            style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              cursor: isLocking ? 'not-allowed' : 'pointer',
              color: '#64748B',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              transition: 'all 0.15s ease'
            }}
            title="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          <div
            style={{
              background: '#FFF7ED',
              border: '1px solid #FFEDD5',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '20px'
            }}
          >
            <div
              style={{
                color: '#C2410C',
                fontSize: '12px',
                fontWeight: 700,
                marginBottom: '5px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                letterSpacing: '0.3px'
              }}
            >
              <AlertTriangle size={14} color="#EA580C" />
              <span>LƯU Ý</span>
            </div>
            <div style={{ color: '#9A3412', fontSize: '13px', lineHeight: 1.6 }}>
              Người dùng sẽ nhận được email thông báo kèm lý do khóa ngay sau khi bạn xác nhận.
              Tài khoản bị khóa sẽ không thể đăng nhập cho đến khi được mở khóa.
            </div>
          </div>

          <label
            style={{
              display: 'block',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 700,
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Lý do khóa tài khoản <span style={{ color: '#DC2626' }}>*</span>
          </label>

          {/* Quick preset chips */}
          <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[
              'Vi phạm quy trình vận hành',
              'Vi phạm kỷ luật & nội quy',
              'Sai lệch kiểm kê hàng hóa',
              'Vi phạm bảo mật tài khoản',
              'Tạm khóa phục vụ đối soát nội bộ'
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReasonText(preset)}
                style={{
                  background: reasonText === preset ? '#EFF6FF' : '#F1F5F9',
                  border: `1px solid ${reasonText === preset ? '#93C5FD' : '#E2E8F0'}`,
                  color: reasonText === preset ? '#1D4ED8' : '#475569',
                  fontSize: '11px',
                  fontWeight: 500,
                  padding: '4px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                + {preset}
              </button>
            ))}
          </div>

          <textarea
            rows={4}
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Vd: Vi phạm quy trình vận hành cửa hàng, sai lệch số liệu kiểm kê kho, vi phạm kỷ luật..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: '#FFFFFF',
              border: `1px solid ${reasonText.trim().length > 0 && reasonText.trim().length < 5 ? '#DC2626' : '#CBD5E1'
                }`,
              borderRadius: '10px',
              color: '#0F172A',
              fontSize: '13.5px',
              padding: '12px 14px',
              resize: 'vertical',
              lineHeight: 1.6,
              outline: 'none',
              fontFamily: 'inherit',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
            }}
          />
          {reasonText.trim().length > 0 && reasonText.trim().length < 5 && (
            <div
              style={{
                color: '#DC2626',
                fontSize: '12px',
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <AlertCircle size={13} />
              <span>Lý do phải có ít nhất 5 ký tự.</span>
            </div>
          )}
          <div style={{ color: '#94A3B8', fontSize: '11.5px', marginTop: '6px', textAlign: 'right' }}>
            {reasonText.length} ký tự
          </div>
        </div>

        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #F1F5F9',
            background: '#F8FAFC',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            alignItems: 'center'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isLocking}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: '13px',
              cursor: isLocking ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLocking || reasonText.trim().length < 5}
            style={{
              padding: '10px 22px',
              borderRadius: '8px',
              border: 'none',
              background: reasonText.trim().length >= 5 && !isLocking ? '#DC2626' : '#94A3B8',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              cursor: reasonText.trim().length >= 5 && !isLocking ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow:
                reasonText.trim().length >= 5 && !isLocking
                  ? '0 2px 8px rgba(220, 38, 38, 0.25)'
                  : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            {isLocking ? (
              <>
                <Loader2 size={16} className="admin-acc-spin" />
                <span>Đang xử lý...</span>
              </>
            ) : (
              <>
                <Lock size={16} />
                <span>Xác nhận khóa & Gửi email</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
