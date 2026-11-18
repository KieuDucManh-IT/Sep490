import React from 'react';
import { X, Send, Loader2, Key } from 'lucide-react';

export default function AdminResetPasswordModal({
  isOpen,
  onClose,
  user,
  resetPwdValue,
  setResetPwdValue,
  isResettingPwd,
  onConfirm
}) {
  if (!isOpen || !user) return null;

  return (
    <div className="admin-acc-modal-overlay" onClick={onClose}>
      <div className="admin-acc-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="admin-acc-modal-head">
          <h3 className="admin-acc-modal-title">Đặt lại mật khẩu cho {user.name}</h3>
          <button
            type="button"
            className="admin-acc-drawer-close"
            onClick={onClose}
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="admin-acc-modal-body">
          <div style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '14px',
            fontSize: '13px',
            color: '#166534',
            lineHeight: '1.5'
          }}>
            <div style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Send size={15} />
              Gửi email tự động & Bắt buộc đổi mật khẩu
            </div>
            Hệ thống sẽ cập nhật mật khẩu mới và tự động gửi email thông báo tới <strong>{user.email}</strong>. Khi người dùng đăng nhập bằng mật khẩu này, hệ thống sẽ yêu cầu đổi mật khẩu mới để bảo mật.
          </div>

          <div className="admin-acc-form-group">
            <label className="admin-acc-form-label">Mật khẩu mới khởi tạo *</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="admin-acc-form-input"
                value={resetPwdValue}
                disabled={isResettingPwd}
                onChange={(e) => setResetPwdValue(e.target.value)}
                placeholder="Nhập mật khẩu mới..."
              />
              <button
                type="button"
                className="btn-acc-outline"
                disabled={isResettingPwd}
                onClick={() => setResetPwdValue('Vestora@' + Math.floor(1000 + Math.random() * 9000))}
              >
                Tạo lại
              </button>
            </div>
            <small style={{ color: '#64748B', fontSize: '12px', marginTop: '4px', display: 'block' }}>
              Gợi ý: Mật khẩu nên gồm ít nhất 8 ký tự, có chữ hoa, chữ thường và số.
            </small>
          </div>
        </div>

        <div className="admin-acc-modal-foot">
          <button
            type="button"
            className="btn-acc-outline"
            disabled={isResettingPwd}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn-acc-primary"
            disabled={isResettingPwd}
            onClick={onConfirm}
          >
            {isResettingPwd ? (
              <>
                <Loader2 size={16} className="admin-acc-spin" style={{ marginRight: '6px' }} />
                Đang xử lý & Gửi email...
              </>
            ) : (
              <>
                <Key size={16} style={{ marginRight: '6px' }} />
                Cập nhật & Gửi email mật khẩu
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
