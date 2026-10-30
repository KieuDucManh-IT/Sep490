import React from 'react';

export default function AccountDetailDrawer({
  isOpen,
  onClose,
  selectedUser,
  activeDrawerTab,
  setActiveDrawerTab,
  ROLE_LABELS = {},
  isUserAdmin = () => false,
  isCustomer = () => false,
  isGoogleUser = () => false,
  openEditModalForUser,
  handleToggleLock,
  openResetPasswordModal,
  setShowNotifyModal,
}) {
  if (!isOpen || !selectedUser) return null;

  return (
    <>
      <div
        className="admin-acc-drawer-backdrop"
        onClick={onClose}
      />

      <div className="admin-acc-drawer">
        {/* Drawer Header */}
        <div className="admin-acc-drawer-header">
          <h3 className="admin-acc-drawer-title">Chi tiết tài khoản</h3>
          <button
            type="button"
            className="admin-acc-drawer-close"
            onClick={onClose}
            title="Đóng chi tiết"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* User Identity Hero */}
        <div className="admin-acc-drawer-hero">
          {selectedUser.avatar ? (
            <img
              src={selectedUser.avatar}
              alt={selectedUser.name}
              className="admin-acc-drawer-avatar"
            />
          ) : (
            <div
              className="admin-acc-drawer-avatar-letter"
              style={{ '--letter-bg': selectedUser.letterColor || '#3B82F6' }}
            >
              {selectedUser.letter || selectedUser.name.charAt(0)}
            </div>
          )}

          <div className="admin-acc-drawer-name">{selectedUser.name}</div>
          <div className="admin-acc-drawer-email">{selectedUser.email}</div>
          <span className={`role-pill ${selectedUser.role}`}>
            {ROLE_LABELS[selectedUser.role] || selectedUser.role}
          </span>
        </div>

        {/* Drawer Tabs */}
        <div className="admin-acc-drawer-tabs">
          <button
            type="button"
            className={`admin-acc-tab-btn ${activeDrawerTab === 'INFO' ? 'active' : ''}`}
            onClick={() => setActiveDrawerTab('INFO')}
          >
            Thông tin
          </button>
          <button
            type="button"
            className={`admin-acc-tab-btn ${activeDrawerTab === 'ACTIVITY' ? 'active' : ''}`}
            onClick={() => setActiveDrawerTab('ACTIVITY')}
          >
            Hoạt động
          </button>
          {!isUserAdmin(selectedUser) && (
            <>
              <button
                type="button"
                className={`admin-acc-tab-btn ${activeDrawerTab === 'TRANSACTIONS' ? 'active' : ''}`}
                onClick={() => setActiveDrawerTab('TRANSACTIONS')}
              >
                Giao dịch
              </button>
              <button
                type="button"
                className={`admin-acc-tab-btn ${activeDrawerTab === 'VIOLATIONS' ? 'active' : ''}`}
                onClick={() => setActiveDrawerTab('VIOLATIONS')}
              >
                Vi phạm
              </button>
            </>
          )}
        </div>

        {/* Drawer Body Content */}
        <div className="admin-acc-drawer-body">
          {activeDrawerTab === 'INFO' && (
            <>
              {/* Section 1: Thông tin cơ bản */}
              <div>
                <div className="admin-acc-sec-header">
                  <h4 className="admin-acc-sec-title">Thông tin cơ bản</h4>
                  {!isUserAdmin(selectedUser) && !isCustomer(selectedUser) && (
                    <button
                      type="button"
                      className="btn-acc-sec-edit"
                      onClick={() => openEditModalForUser(selectedUser)}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      <span>Chỉnh sửa</span>
                    </button>
                  )}
                </div>

                <div className="admin-acc-kv-list">
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Mã User (ID)</span>
                    <span className="admin-acc-kv-val admin-acc-code-val">
                      {selectedUser.id}
                    </span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Họ và tên</span>
                    <span className="admin-acc-kv-val">{selectedUser.name}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Email</span>
                    <span className="admin-acc-kv-val">
                      {selectedUser.email}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Số điện thoại</span>
                    <span className="admin-acc-kv-val">{selectedUser.phone}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Ngày sinh</span>
                    <span className="admin-acc-kv-val">{selectedUser.dob || '15/08/2000'}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Giới tính</span>
                    <span className="admin-acc-kv-val">{selectedUser.gender || 'Nữ'}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Địa chỉ</span>
                    <span className="admin-acc-kv-val">{selectedUser.address}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Ngày tham gia</span>
                    <span className="admin-acc-kv-val">{selectedUser.joinDateTime || selectedUser.joinDate}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Cập nhật cuối</span>
                    <span className="admin-acc-kv-val">{selectedUser.lastLogin}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Vai trò</span>
                    <span className="admin-acc-kv-val admin-acc-stat-blue">
                      {selectedUser.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Trạng thái & Xác minh */}
              <div>
                <h4 className="admin-acc-sec-title admin-acc-sec-title-mb-12">
                  Trạng thái &amp; Xác minh
                </h4>

                <div className="admin-acc-status-box">
                  <div className="admin-acc-status-row">
                    <span className="admin-acc-drawer-status-label">Trạng thái tài khoản</span>
                    <div className="admin-acc-drawer-status-val">
                      <span className={`status-dot-pill ${selectedUser.status === 'ACTIVE' ? 'active' : 'locked'}`}>
                        <span className="dot" />
                        {selectedUser.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}
                      </span>
                      {!isUserAdmin(selectedUser) && (
                        <button
                          type="button"
                          className={`btn-acc-lock-toggle ${selectedUser.status === 'LOCKED' ? 'unlock' : 'lock'}`}
                          onClick={() => handleToggleLock(selectedUser.id)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          {selectedUser.status === 'LOCKED' ? 'Mở khóa' : 'Tạm khóa'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="admin-acc-status-row">
                    <span className="admin-acc-drawer-status-label">Xác minh Email</span>
                    <span className="verify-pill verified">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Đã xác minh
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 3: Thống kê (Chỉ hiển thị riêng cho vai trò Customer, các role khác ẩn hoàn toàn) */}
              {isCustomer(selectedUser) && (
                <div>
                  <h4 className="admin-acc-sec-title admin-acc-sec-title-mb-12">
                    Thống kê hệ thống
                  </h4>

                  <div className="admin-acc-stats-grid">
                    {/* Box 1 */}
                    <div className="admin-acc-stat-box">
                      <div className="admin-acc-stat-box-icon blue">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                          <line x1="3" y1="6" x2="21" y2="6" />
                          <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                      </div>
                      <div className="admin-acc-stat-box-label">Giao dịch thuê</div>
                      <div className="admin-acc-stat-box-val">{selectedUser.totalOrders} đơn</div>
                      <div className="admin-acc-stat-box-sub">{selectedUser.totalDeposit}</div>
                    </div>

                    {/* Box 2 */}
                    <div className="admin-acc-stat-box">
                      <div className="admin-acc-stat-box-icon green">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          <polyline points="9 12 11 14 15 10" />
                        </svg>
                      </div>
                      <div className="admin-acc-stat-box-label">Điểm uy tín Escrow</div>
                      <div className="admin-acc-stat-box-val admin-acc-stat-green">
                        {selectedUser.rating}
                      </div>
                      <div className="admin-acc-stat-box-sub">PayOS Bảo đảm</div>
                    </div>

                    {/* Box 3 */}
                    <div className="admin-acc-stat-box">
                      <div className="admin-acc-stat-box-icon red">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      </div>
                      <div className="admin-acc-stat-box-label">Vi phạm</div>
                      <div className={`admin-acc-stat-box-val ${selectedUser.violations > 0 ? 'is-violation' : 'is-clean'}`}>
                        {selectedUser.violations} lần
                      </div>
                      <div className="admin-acc-stat-box-sub">An toàn hợp đồng</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 4: Thao tác nhanh */}
              <div>
                <h4 className="admin-acc-sec-title admin-acc-sec-title-mb-12">
                  Thao tác nhanh
                </h4>

                <div className="admin-acc-quick-actions">
                  <div className="admin-acc-btn-row">
                    {!isUserAdmin(selectedUser) && !isCustomer(selectedUser) && (
                      <button
                        type="button"
                        className="btn-acc-action-primary"
                        onClick={() => openEditModalForUser(selectedUser)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Chỉnh sửa</span>
                      </button>
                    )}

                    {!isUserAdmin(selectedUser) && (
                      <button
                        type="button"
                        className={selectedUser.status === 'LOCKED' ? 'btn-acc-action-primary' : 'btn-acc-action-danger'}
                        onClick={() => handleToggleLock(selectedUser.id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span>{selectedUser.status === 'LOCKED' ? 'Mở khóa' : 'Tạm khóa'}</span>
                      </button>
                    )}

                    {!isUserAdmin(selectedUser) && !isCustomer(selectedUser) && !isGoogleUser(selectedUser) && (
                      <button
                        type="button"
                        className="btn-acc-action-secondary"
                        onClick={() => openResetPasswordModal(selectedUser)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="16" r="1" />
                          <rect x="3" y="10" width="18" height="12" rx="2" />
                          <path d="M7 10V7a5 5 0 0 1 10 0v3" />
                        </svg>
                        <span>Đặt lại mật khẩu</span>
                      </button>
                    )}
                  </div>

                  <div className="admin-acc-btn-row-2">
                    <button
                      type="button"
                      className="btn-acc-action-secondary"
                      onClick={() => setActiveDrawerTab('ACTIVITY')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>Xem lịch sử hoạt động</span>
                    </button>

                    {!isUserAdmin(selectedUser) && !isCustomer(selectedUser) && (
                      <button
                        type="button"
                        className="btn-acc-action-secondary"
                        onClick={() => setShowNotifyModal(true)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="22" y1="2" x2="11" y2="13" />
                          <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                        <span>Gửi thông báo</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Tab 2: Hoạt động */}
          {activeDrawerTab === 'ACTIVITY' && (
            <div>
              <h4 className="admin-acc-sec-title admin-acc-sec-title-mb">
                Nhật ký hoạt động tài khoản
              </h4>

              <div className="admin-acc-activity-list">
                <div className="admin-acc-activity-item blue">
                  <div className="admin-acc-activity-title">Cập nhật thông tin gần nhất</div>
                  <div className="admin-acc-activity-meta">{selectedUser.lastLogin} • Hệ thống MongoDB</div>
                </div>

                <div className="admin-acc-activity-item green">
                  <div className="admin-acc-activity-title">Khởi tạo tài khoản thành công</div>
                  <div className="admin-acc-activity-meta">{selectedUser.joinDateTime} • VESTORA Server</div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Giao dịch */}
          {activeDrawerTab === 'TRANSACTIONS' && (
            <div>
              <h4 className="admin-acc-sec-title admin-acc-sec-title-mb">
                Lịch sử thuê đồ &amp; Cọc Escrow PayOS
              </h4>

              <div className="admin-acc-trans-list">
                <div className="admin-acc-trans-card">
                  <div className="admin-acc-trans-row">
                    <span className="admin-acc-trans-title">Giao dịch gần đây</span>
                    <span className="admin-acc-trans-val">{selectedUser.totalDeposit}</span>
                  </div>
                  <div className="admin-acc-trans-meta">
                    <span>Tổng số đơn thuê: {selectedUser.totalOrders} đơn</span>
                    <span className="admin-acc-trans-tag">Hợp đồng bảo đảm PayOS</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Vi phạm */}
          {activeDrawerTab === 'VIOLATIONS' && (
            <div>
              <h4 className="admin-acc-sec-title admin-acc-sec-title-mb">
                Báo cáo &amp; Biên bản vi phạm
              </h4>

              {selectedUser.violations === 0 ? (
                <div className="admin-acc-violation-clean">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="admin-acc-violation-clean-icon">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  <div className="admin-acc-violation-clean-title">Tài khoản chuẩn mực</div>
                  <div className="admin-acc-violation-clean-desc">
                    Chưa ghi nhận bất kỳ vi phạm hợp đồng hoặc báo cáo khiếu nại nào.
                  </div>
                </div>
              ) : (
                <div className="admin-acc-violation-alert">
                  <strong>Cảnh báo vi phạm:</strong> Tài khoản này có {selectedUser.violations} lần cảnh báo vi phạm được ghi nhận trong cơ sở dữ liệu.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

