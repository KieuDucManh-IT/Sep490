import React from 'react';
import { X, Send } from 'lucide-react';

export default function AdminSendNotifyModal({
  isOpen,
  onClose,
  user,
  notifyForm,
  setNotifyForm,
  onSend
}) {
  if (!isOpen || !user) return null;

  return (
    <div className="admin-acc-modal-overlay" onClick={onClose}>
      <div className="admin-acc-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="admin-acc-modal-head">
          <h3 className="admin-acc-modal-title">Gửi thông báo tới {user.name}</h3>
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
          <div className="admin-acc-form-group">
            <label className="admin-acc-form-label">Tiêu đề thông báo *</label>
            <input
              type="text"
              className="admin-acc-form-input"
              value={notifyForm.title}
              onChange={(e) => setNotifyForm({ ...notifyForm, title: e.target.value })}
              placeholder="Vd: Thông báo cập nhật tài khoản, Nhắc nhở lịch hẹn..."
            />
          </div>

          <div className="admin-acc-form-group">
            <label className="admin-acc-form-label">Loại thông báo</label>
            <select
              className="admin-acc-form-select"
              value={notifyForm.type}
              onChange={(e) => setNotifyForm({ ...notifyForm, type: e.target.value })}
            >
              <option value="SYSTEM">Hệ thống (System)</option>
              <option value="ORDER">Đơn hàng & Thuê đồ (Order)</option>
              <option value="PROMOTION">Khuyến mãi / Ưu đãi (Promotion)</option>
              <option value="WARNING">Cảnh báo / Vi phạm (Warning)</option>
            </select>
          </div>

          <div className="admin-acc-form-group">
            <label className="admin-acc-form-label">Nội dung thông báo *</label>
            <textarea
              className="admin-acc-form-textarea"
              rows={4}
              value={notifyForm.message}
              onChange={(e) => setNotifyForm({ ...notifyForm, message: e.target.value })}
              placeholder="Nhập nội dung thông điệp gửi tới người dùng qua email / web..."
            />
          </div>
        </div>

        <div className="admin-acc-modal-foot">
          <button
            type="button"
            className="btn-acc-outline"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn-acc-primary"
            onClick={onSend}
          >
            <Send size={15} style={{ marginRight: '6px' }} />
            Gửi thông báo
          </button>
        </div>
      </div>
    </div>
  );
}
