import React from 'react';

export default function AdminAddAccountModal({
  isOpen,
  onClose,
  addForm,
  setAddForm,
  addFormErrors,
  setAddFormErrors,
  showAddPwd,
  setShowAddPwd,
  showAddConfirmPwd,
  setShowAddConfirmPwd,
  isSubmittingAdd,
  onSubmit,
  shops = [],
  loadingShops = false
}) {
  if (!isOpen) return null;

  return (
    <div className="admin-acc-modal-overlay" onClick={onClose}>
      <div className="admin-acc-modal-card admin-acc-add-user-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-acc-modal-head-rich">
          <div className="admin-acc-modal-head-left">
            <div className="admin-acc-modal-head-icon blue">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" y1="8" x2="19" y2="14" />
                <line x1="22" y1="11" x2="16" y2="11" />
              </svg>
            </div>
            <div>
              <h3 className="admin-acc-modal-title-rich">Thêm người dùng mới vào hệ thống</h3>
              <p className="admin-acc-modal-sub-rich">
                Tạo tài khoản người dùng và phân quyền truy cập cho hệ thống VESTORA
              </p>
            </div>
          </div>
          <button
            type="button"
            className="admin-acc-drawer-close"
            onClick={onClose}
            title="Đóng"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }}>
          <div className="admin-acc-modal-body admin-acc-add-modal-body">
            <div>
              <div className="admin-acc-section-head">
                <span className="admin-acc-section-num">1</span>
                <h4 className="admin-acc-section-title">Thông tin cơ bản</h4>
              </div>

              <div className="admin-acc-form-grid-2">
                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">
                    Họ và tên <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className={`admin-acc-form-input ${addFormErrors.name ? 'error' : ''}`}
                    placeholder="Nhập họ và tên"
                    value={addForm.name}
                    onChange={(e) => {
                      setAddForm({ ...addForm, name: e.target.value });
                      if (addFormErrors.name) setAddFormErrors({ ...addFormErrors, name: '' });
                    }}
                  />
                  {addFormErrors.name && (
                    <span className="admin-acc-field-error">{addFormErrors.name}</span>
                  )}
                </div>

                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">
                    Email tài khoản <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div className="admin-acc-input-wrap">
                    <span className="admin-acc-input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    </span>
                    <input
                      type="email"
                      className={`admin-acc-form-input ${addFormErrors.email ? 'error' : ''}`}
                      placeholder="Nhập email"
                      value={addForm.email}
                      onChange={(e) => {
                        setAddForm({ ...addForm, email: e.target.value });
                        if (addFormErrors.email) setAddFormErrors({ ...addFormErrors, email: '' });
                      }}
                    />
                  </div>
                  {addFormErrors.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px', color: '#EF4444', fontSize: '11.5px' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span>{addFormErrors.email}</span>
                    </div>
                  )}
                </div>

                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">
                    Số điện thoại <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div className="admin-acc-input-wrap">
                    <span className="admin-acc-input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </span>
                    <input
                      type="tel"
                      className={`admin-acc-form-input ${addFormErrors.phone ? 'error' : ''}`}
                      placeholder="Nhập số điện thoại"
                      value={addForm.phone}
                      onChange={(e) => {
                        setAddForm({ ...addForm, phone: e.target.value });
                        if (addFormErrors.phone) setAddFormErrors({ ...addFormErrors, phone: '' });
                      }}
                    />
                  </div>
                  <span className="admin-acc-field-hint">Định dạng: 0987 654 321</span>
                  {addFormErrors.phone && (
                    <span className="admin-acc-field-error">{addFormErrors.phone}</span>
                  )}
                </div>

                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">
                    Vai trò <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div className="admin-acc-input-wrap">
                    <span className="admin-acc-input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </span>
                    <select
                      className={`admin-acc-form-select ${addFormErrors.role ? 'error' : ''}`}
                      value={addForm.role}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setAddForm({
                          ...addForm,
                          role: newRole,
                          shopId: newRole === 'branch_manager' ? addForm.shopId : ''
                        });
                        if (addFormErrors.role) setAddFormErrors({ ...addFormErrors, role: '' });
                        if (newRole !== 'branch_manager' && addFormErrors.shopId) {
                          setAddFormErrors({ ...addFormErrors, shopId: '' });
                        }
                      }}
                    >
                      <option value="">Chọn vai trò nhân viên</option>
                      <option value="shopOwner">Chủ cửa hàng (shopOwner) - Quản lý toàn chuỗi</option>
                      <option value="branch_manager">Quản lý chi nhánh (branch_manager) - Phụ trách cơ sở</option>
                      <option value="warehouse_manager">Quản lý kho (warehouse_manager)</option>
                      <option value="warehouse_staff">Nhân viên kho (warehouse_staff)</option>
                    </select>
                  </div>
                  {addFormErrors.role && (
                    <span className="admin-acc-field-error">{addFormErrors.role}</span>
                  )}
                </div>

                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">
                    Trạng thái tài khoản <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div className="admin-acc-toggle-wrap">
                    <button
                      type="button"
                      className={`admin-acc-toggle-switch ${addForm.status === 'ACTIVE' ? 'active' : ''}`}
                      onClick={() => setAddForm({ ...addForm, status: addForm.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE' })}
                      role="switch"
                      aria-checked={addForm.status === 'ACTIVE'}
                    >
                      <span className="admin-acc-toggle-thumb" />
                    </button>
                    <span
                      className="admin-acc-toggle-label"
                      onClick={() => setAddForm({ ...addForm, status: addForm.status === 'ACTIVE' ? 'LOCKED' : 'ACTIVE' })}
                    >
                      Kích hoạt ngay sau khi tạo
                    </span>
                  </div>
                </div>

                {addForm.role === 'branch_manager' && (
                  <div className="admin-acc-form-group">
                    <label className="admin-acc-form-label">
                      Cơ sở / Chi nhánh quản lý <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div className="admin-acc-input-wrap">
                      <span className="admin-acc-input-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                      </span>
                      <select
                        className={`admin-acc-form-select ${addFormErrors.shopId ? 'error' : ''}`}
                        value={addForm.shopId || ''}
                        onChange={(e) => {
                          setAddForm({ ...addForm, shopId: e.target.value });
                          if (addFormErrors.shopId) setAddFormErrors({ ...addFormErrors, shopId: '' });
                        }}
                      >
                        <option value="">-- Chọn cơ sở phân công cho Quản lý chi nhánh --</option>
                        {loadingShops ? (
                          <option value="" disabled>Đang tải danh sách cơ sở từ máy chủ...</option>
                        ) : (
                          shops.map((shop) => (
                            <option key={shop._id} value={shop._id}>
                              {shop.name} {shop.city ? `(${shop.city})` : ''}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    {addFormErrors.shopId && (
                      <span className="admin-acc-field-error">{addFormErrors.shopId}</span>
                    )}
                    <span className="admin-acc-field-hint">
                      Quản lý chi nhánh phụ trách vận hành và quản lý trực tiếp tại cơ sở này
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="admin-acc-section-head">
                <span className="admin-acc-section-num">2</span>
                <h4 className="admin-acc-section-title">Thông tin đăng nhập</h4>
              </div>

              <div className="admin-acc-form-grid-2">
                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">
                    Mật khẩu <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div className="admin-acc-input-wrap">
                    <span className="admin-acc-input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <input
                      type={showAddPwd ? 'text' : 'password'}
                      className={`admin-acc-form-input ${addFormErrors.password ? 'error' : ''}`}
                      placeholder="Nhập mật khẩu"
                      value={addForm.password}
                      onChange={(e) => {
                        setAddForm({ ...addForm, password: e.target.value });
                        if (addFormErrors.password) setAddFormErrors({ ...addFormErrors, password: '' });
                      }}
                    />
                    <button
                      type="button"
                      className="admin-acc-input-eye-btn"
                      onClick={() => setShowAddPwd(!showAddPwd)}
                      title={showAddPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {showAddPwd ? (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        ) : (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                  {addFormErrors.password && (
                    <span className="admin-acc-field-error">{addFormErrors.password}</span>
                  )}

                  <div className="admin-acc-pwd-requirement-box">
                    <div className="admin-acc-pwd-requirement-title">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span>Mật khẩu cần có:</span>
                    </div>
                    <ul className="admin-acc-pwd-requirement-list">
                      <li>Tối thiểu 8 ký tự</li>
                      <li>Bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt</li>
                    </ul>
                  </div>
                </div>

                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">
                    Xác nhận mật khẩu <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div className="admin-acc-input-wrap">
                    <span className="admin-acc-input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <input
                      type={showAddConfirmPwd ? 'text' : 'password'}
                      className={`admin-acc-form-input ${addFormErrors.confirmPassword ? 'error' : ''}`}
                      placeholder="Nhập lại mật khẩu"
                      value={addForm.confirmPassword}
                      onChange={(e) => {
                        setAddForm({ ...addForm, confirmPassword: e.target.value });
                        if (addFormErrors.confirmPassword) setAddFormErrors({ ...addFormErrors, confirmPassword: '' });
                      }}
                    />
                    <button
                      type="button"
                      className="admin-acc-input-eye-btn"
                      onClick={() => setShowAddConfirmPwd(!showAddConfirmPwd)}
                      title={showAddConfirmPwd ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {showAddConfirmPwd ? (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        ) : (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        )}
                      </svg>
                    </button>
                  </div>
                  {addFormErrors.confirmPassword && (
                    <span className="admin-acc-field-error">{addFormErrors.confirmPassword}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="admin-acc-notify-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
              <span>
                Sau khi tạo, hệ thống sẽ tự động gửi email thông báo kèm mật khẩu đăng nhập cho nhân viên và hướng dẫn người dùng tự đổi lại mật khẩu trong lần truy cập đầu tiên.
              </span>
            </div>
          </div>

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
              disabled={isSubmittingAdd}
              style={{ background: '#2563EB', padding: '9px 22px', gap: '8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              <span>{isSubmittingAdd ? 'Đang tạo...' : 'Tạo người dùng'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
