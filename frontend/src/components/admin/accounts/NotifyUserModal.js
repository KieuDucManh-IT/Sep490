import React from 'react';

export default function NotifyUserModal({
  isOpen,
  onClose,
  selectedUser,
  notifyForm,
  setNotifyForm,
  showToast,
}) {
  if (!isOpen || !selectedUser) return null;

  return (
    <div className="admin-acc-modal-overlay" onClick={onClose}>
      <div className="admin-acc-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="admin-acc-modal-head">
          <h3 className="admin-acc-modal-title">Gửi thông báo tới {selectedUser.name}</h3>
          <button
            type="button"
            className="admin-acc-drawer-close"
            onClick={onClose}
            title="Đóng"
          >
            <i className="fa-solid fa-xmark admin-acc-close-icon" />
          </button>
        </div>

        <div className="admin-acc-modal-body">
          <div className="admin-acc-form-group">
            <label className="admin-acc-form-label">Tiêu đề thông báo *</label>
            <input
              type="text"
              className="admin-acc-form-input"
              placeholder="VD: Cập nhật thông tin định danh CCCD"
              value={notifyForm.title}
              onChange={(e) => setNotifyForm({ ...notifyForm, title: e.target.value })}
            />
          </div>

          <div className="admin-acc-form-group">
            <label className="admin-acc-form-label">Loại thông báo</label>
            <select
              className="admin-acc-form-select"
              value={notifyForm.type}
              onChange={(e) => setNotifyForm({ ...notifyForm, type: e.target.value })}
            >
              <option value="SYSTEM">Hệ thống</option>
              <option value="WARNING">Cảnh báo vi phạm</option>
              <option value="PROMO">Khuyến mãi / Tri ân</option>
            </select>
          </div>

          <div className="admin-acc-form-group">
            <label className="admin-acc-form-label">Nội dung chi tiết</label>
            <textarea
              rows="4"
              className="admin-acc-form-textarea"
              placeholder="Nhập nội dung thông báo gửi đến người dùng..."
              value={notifyForm.message}
              onChange={(e) => setNotifyForm({ ...notifyForm, message: e.target.value })}
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
            onClick={() => {
              showToast(`Đã gửi thông báo thành công tới ${selectedUser.email}!`, 'success');
              onClose();
              setNotifyForm({ title: '', message: '', type: 'SYSTEM' });
            }}
          >
            <i className="fa-solid fa-paper-plane admin-acc-btn-icon" />
            Gửi thông báo
          </button>
        </div>
      </div>
    </div>
  );
}

