import React from 'react';

export default function EditUserModal({
  isOpen,
  onClose,
  selectedUser,
  editForm,
  setEditForm,
  editFormErrors,
  setEditFormErrors,
  avatarFileInputRef,
  handleAvatarFileChange,
  handleRemoveAvatar,
  handleSaveEdit,
}) {
  if (!isOpen || !selectedUser) return null;

  return (
    <div className="admin-acc-modal-overlay" onClick={onClose}>
      <div className="admin-acc-modal-card admin-acc-edit-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="admin-acc-modal-head-rich">
          <div className="admin-acc-modal-head-left">
            <div className="admin-acc-modal-head-icon blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h3 className="admin-acc-modal-title-rich">
                Chỉnh sửa thông tin nhân viên
              </h3>
              <p className="admin-acc-modal-sub-rich">
                Cập nhật thông tin cá nhân và vai trò phân công của nhân viên
              </p>
            </div>
          </div>
          <button
            type="button"
            className="admin-acc-drawer-close"
            onClick={onClose}
            title="Đóng modal"
          >
            <i className="fa-solid fa-xmark admin-acc-close-icon" />
          </button>
        </div>

        <form onSubmit={handleSaveEdit} className="admin-acc-edit-form">
          <div className="admin-acc-modal-body admin-acc-edit-modal-body">
            {/* 1. Phần Chỉnh Sửa Avatar */}
            <div className="admin-acc-edit-avatar-box">
              <div className="admin-acc-edit-avatar-preview-wrap">
                {editForm.avatar ? (
                  <img
                    src={editForm.avatar}
                    alt="Preview Avatar"
                    className="admin-acc-edit-avatar-img"
                  />
                ) : (
                  <div
                    className="admin-acc-edit-avatar-letter"
                    style={{ '--letter-bg': selectedUser.letterColor || '#3B82F6' }}
                  >
                    {editForm.name ? editForm.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div className="admin-acc-edit-avatar-badge" title="Đổi ảnh đại diện">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </div>
              </div>

              <div className="admin-acc-edit-avatar-actions">
                <div className="admin-acc-edit-avatar-title">
                  <span>Ảnh đại diện người dùng</span>
                </div>
                <p className="admin-acc-edit-avatar-desc">
                  Tải lên hình ảnh đại diện (PNG, JPG, WEBP tối đa 5MB)
                </p>
                <div className="admin-acc-edit-avatar-btns">
                  <input
                    type="file"
                    ref={avatarFileInputRef}
                    onChange={handleAvatarFileChange}
                    accept="image/png, image/jpeg, image/jpg, image/webp"
                    className="admin-acc-hidden-input"
                  />
                  <button
                    type="button"
                    className="btn-upload-avatar"
                    onClick={() => avatarFileInputRef.current?.click()}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span>Tải ảnh mới</span>
                  </button>
                  {editForm.avatar && (
                    <button
                      type="button"
                      className="btn-remove-avatar"
                      onClick={handleRemoveAvatar}
                    >
                      Gỡ ảnh (dùng chữ cái)
                    </button>
                  )}
                </div>
              </div>
            </div>
            {editFormErrors.avatar && (
              <span className="admin-acc-field-error">{editFormErrors.avatar}</span>
            )}

            {/* 2. Họ và tên * */}
            <div className="admin-acc-form-group">
              <label className="admin-acc-form-label">
                Họ và tên <span className="admin-acc-req-star">*</span>
              </label>
              <div className="admin-acc-input-wrap">
                <span className="admin-acc-input-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  type="text"
                  required
                  className="admin-acc-form-input"
                  placeholder="Nhập họ và tên đầy đủ"
                  value={editForm.name}
                  onChange={(e) => {
                    setEditForm({ ...editForm, name: e.target.value });
                    if (editFormErrors.name) setEditFormErrors(prev => ({ ...prev, name: null }));
                  }}
                />
              </div>
              {editFormErrors.name && (
                <span className="admin-acc-field-error">{editFormErrors.name}</span>
              )}
            </div>

            {/* 3. Row: Email * | Số điện thoại */}
            <div className="admin-acc-form-grid-1-2">
              <div className="admin-acc-form-group">
                <label className="admin-acc-form-label">
                  Email <span className="admin-acc-req-star">*</span>
                </label>
                <div className="admin-acc-input-wrap">
                  <span className="admin-acc-input-icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  </span>
                  <input
                    type="email"
                    disabled
                    className="admin-acc-form-input"
                    value={editForm.email || selectedUser.email}
                  />
                </div>
                <span className="admin-acc-field-hint">Email không thể chỉnh sửa</span>
              </div>

              <div className="admin-acc-form-group">
                <label className="admin-acc-form-label">Số điện thoại</label>
                <div className="admin-acc-input-wrap">
                  <span className="admin-acc-input-icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="admin-acc-form-input"
                    placeholder="0912345678"
                    value={editForm.phone}
                    onChange={(e) => {
                      setEditForm({ ...editForm, phone: e.target.value });
                      if (editFormErrors.phone) setEditFormErrors(prev => ({ ...prev, phone: null }));
                    }}
                  />
                </div>
                {editFormErrors.phone && (
                  <span className="admin-acc-field-error">{editFormErrors.phone}</span>
                )}
              </div>
            </div>

            {/* 4. Row: Vai trò nhân viên * */}
            <div className="admin-acc-form-group">
              <label className="admin-acc-form-label">
                Vai trò nhân viên <span className="admin-acc-req-star">*</span>
              </label>
              <div className="admin-acc-input-wrap">
                <span className="admin-acc-input-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <select
                  className={`admin-acc-form-select ${editFormErrors.role ? 'error' : ''}`}
                  value={editForm.role}
                  onChange={(e) => {
                    setEditForm({ ...editForm, role: e.target.value });
                    if (editFormErrors.role) setEditFormErrors(prev => ({ ...prev, role: null }));
                  }}
                >
                  <option value="shopOwner">Chủ gian hàng (shopOwner)</option>
                  <option value="brandmanager">Quản lý thương hiệu (brandmanager)</option>
                  <option value="warehouseManager">Quản lý kho (warehouseManager)</option>
                  <option value="warehousestaff">Nhân viên kho (warehousestaff)</option>
                </select>
              </div>
              {editFormErrors.role && (
                <span className="admin-acc-field-error">{editFormErrors.role}</span>
              )}
              <span className="admin-acc-field-hint">
                Chỉ cập nhật vai trò phân công cho nhân viên (không bao gồm Quản trị viên và Khách hàng)
              </span>
            </div>

            {/* 4. Row: Ngày sinh | Giới tính */}
            <div className="admin-acc-form-grid-2">
              <div className="admin-acc-form-group">
                <label className="admin-acc-form-label">Ngày sinh</label>
                <div className="admin-acc-input-wrap">
                  <span className="admin-acc-input-icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="admin-acc-form-input"
                    placeholder="15/08/2000"
                    value={editForm.dob}
                    onChange={(e) => {
                      setEditForm({ ...editForm, dob: e.target.value });
                      if (editFormErrors.dob) setEditFormErrors(prev => ({ ...prev, dob: null }));
                    }}
                  />
                </div>
                {editFormErrors.dob && (
                  <span className="admin-acc-field-error">{editFormErrors.dob}</span>
                )}
              </div>

              <div className="admin-acc-form-group">
                <label className="admin-acc-form-label">Giới tính</label>
                <div className="admin-acc-input-wrap">
                  <span className="admin-acc-input-icon">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="9" r="5" />
                      <line x1="12" y1="14" x2="12" y2="21" />
                      <line x1="9" y1="18" x2="15" y2="18" />
                    </svg>
                  </span>
                  <select
                    className="admin-acc-form-select"
                    value={editForm.gender}
                    onChange={(e) => {
                      setEditForm({ ...editForm, gender: e.target.value });
                      if (editFormErrors.gender) setEditFormErrors(prev => ({ ...prev, gender: null }));
                    }}
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
                {editFormErrors.gender && (
                  <span className="admin-acc-field-error">{editFormErrors.gender}</span>
                )}
              </div>
            </div>

            {/* 5. Địa chỉ */}
            <div className="admin-acc-form-group">
              <label className="admin-acc-form-label">Địa chỉ</label>
              <div className="admin-acc-input-wrap has-textarea">
                <span className="admin-acc-input-icon">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <textarea
                  rows={2}
                  className="admin-acc-form-textarea"
                  placeholder="123 Nguyễn Văn Cừ, Quận Long Biên, Hà Nội"
                  value={editForm.address}
                  onChange={(e) => {
                    setEditForm({ ...editForm, address: e.target.value });
                    if (editFormErrors.address) setEditFormErrors(prev => ({ ...prev, address: null }));
                  }}
                />
              </div>
              {editFormErrors.address && (
                <span className="admin-acc-field-error">{editFormErrors.address}</span>
              )}
            </div>

            {/* 6. Info Banner Alert */}
            <div className="admin-acc-edit-info-alert">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>Các trường có dấu <strong className="admin-acc-req-star">*</strong> là bắt buộc. Email không thể thay đổi.</span>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="admin-acc-modal-foot-rich">
            <button
              type="button"
              className="btn-acc-modal-cancel"
              onClick={onClose}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn-acc-modal-save"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>Lưu thay đổi</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

