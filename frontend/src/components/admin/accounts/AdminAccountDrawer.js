import React from 'react';
import { ROLE_LABELS } from './accountHelpers';

export default function AdminAccountDrawer({
  isOpen,
  onClose,
  user,
  activeTab,
  onTabChange,
  onOpenEdit,
  onToggleLock,
  onOpenResetPassword,
  onOpenNotify,
  isUserAdmin,
  isCustomer,
  isGoogleUser
}) {
  if (!isOpen || !user) return null;

  return (
    <>
      <div
        className="admin-acc-drawer-backdrop"
        onClick={onClose}
      />

      <div className="admin-acc-drawer">
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

        <div className="admin-acc-drawer-hero">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="admin-acc-drawer-avatar"
            />
          ) : (
            <div
              className="admin-acc-drawer-avatar-letter"
              style={{ background: user.letterColor || '#3B82F6' }}
            >
              {user.letter || user.name.charAt(0)}
            </div>
          )}

          <div className="admin-acc-drawer-name">{user.name}</div>
          <div className="admin-acc-drawer-email">{user.email}</div>
          <span className={`role-pill ${user.role}`}>
            {ROLE_LABELS[user.role] || user.role}
          </span>
        </div>

        <div className="admin-acc-drawer-tabs">
          <button
            type="button"
            className={`admin-acc-tab-btn ${activeTab === 'INFO' ? 'active' : ''}`}
            onClick={() => onTabChange('INFO')}
          >
            Thông tin
          </button>
          <button
            type="button"
            className={`admin-acc-tab-btn ${activeTab === 'ACTIVITY' ? 'active' : ''}`}
            onClick={() => onTabChange('ACTIVITY')}
          >
            Hoạt động
          </button>
          {!isUserAdmin(user) && (
            <>
              <button
                type="button"
                className={`admin-acc-tab-btn ${activeTab === 'TRANSACTIONS' ? 'active' : ''}`}
                onClick={() => onTabChange('TRANSACTIONS')}
              >
                Giao dịch
              </button>
              <button
                type="button"
                className={`admin-acc-tab-btn ${activeTab === 'VIOLATIONS' ? 'active' : ''}`}
                onClick={() => onTabChange('VIOLATIONS')}
              >
                Vi phạm
              </button>
            </>
          )}
        </div>

        <div className="admin-acc-drawer-body">
          {activeTab === 'INFO' && (
            <>
              <div>
                <div className="admin-acc-sec-header">
                  <h4 className="admin-acc-sec-title">Thông tin cơ bản</h4>
                  {!isUserAdmin(user) && !isCustomer(user) && (
                    <button
                      type="button"
                      className="btn-acc-sec-edit"
                      onClick={() => onOpenEdit(user)}
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
                    <span className="admin-acc-kv-val" style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>
                      {user.id}
                    </span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Họ và tên</span>
                    <span className="admin-acc-kv-val">{user.name}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Email</span>
                    <span className="admin-acc-kv-val">
                      {user.email}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Số điện thoại</span>
                    <span className="admin-acc-kv-val">{user.phone}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Ngày sinh</span>
                    <span className="admin-acc-kv-val">{user.dob || '15/08/2000'}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Giới tính</span>
                    <span className="admin-acc-kv-val">{user.gender || 'Nữ'}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Địa chỉ</span>
                    <span className="admin-acc-kv-val">{user.address}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Ngày tham gia</span>
                    <span className="admin-acc-kv-val">{user.joinDateTime || user.joinDate}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Cập nhật cuối</span>
                    <span className="admin-acc-kv-val">{user.lastLogin}</span>
                  </div>
                  <div className="admin-acc-kv-row">
                    <span className="admin-acc-kv-key">Vai trò</span>
                    <span className="admin-acc-kv-val" style={{ color: '#2563EB', fontWeight: 600 }}>
                      {ROLE_LABELS[user.role] ? `${ROLE_LABELS[user.role]} (${user.role})` : user.role}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="admin-acc-sec-title" style={{ marginBottom: '12px' }}>
                  Trạng thái &amp; Xác minh
                </h4>

                <div className="admin-acc-status-box">
                  <div className="admin-acc-status-row">
                    <span style={{ fontSize: '13px', color: '#475569' }}>Trạng thái tài khoản</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className={`status-dot-pill ${user.status === 'ACTIVE' ? 'active' : 'locked'}`}>
                        <span className="dot" />
                        {user.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}
                      </span>
                      {!isUserAdmin(user) && (
                        <button
                          type="button"
                          className={`btn-acc-lock-toggle ${user.status === 'LOCKED' ? 'unlock' : 'lock'}`}
                          onClick={() => onToggleLock(user.id)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                          {user.status === 'LOCKED' ? 'Mở khóa' : 'Tạm khóa'}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="admin-acc-status-row">
                    <span style={{ fontSize: '13px', color: '#475569' }}>Xác minh Email</span>
                    <span className="verify-pill verified">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Đã xác minh
                    </span>
                  </div>
                </div>
              </div>

              {isCustomer(user) && (
                <div>
                  <h4 className="admin-acc-sec-title" style={{ marginBottom: '12px' }}>
                    Thống kê hệ thống
                  </h4>

                  <div className="admin-acc-stats-grid">
                    <div className="admin-acc-stat-box">
                      <div className="admin-acc-stat-box-icon blue">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                          <line x1="3" y1="6" x2="21" y2="6" />
                          <path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                      </div>
                      <div className="admin-acc-stat-box-label">Giao dịch thuê</div>
                      <div className="admin-acc-stat-box-val">{user.totalOrders} đơn</div>
                      <div className="admin-acc-stat-box-sub">{user.totalDeposit}</div>
                    </div>

                    <div className="admin-acc-stat-box">
                      <div className="admin-acc-stat-box-icon green">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          <polyline points="9 12 11 14 15 10" />
                        </svg>
                      </div>
                      <div className="admin-acc-stat-box-label">Điểm uy tín</div>
                      <div className="admin-acc-stat-box-val" style={{ color: '#059669' }}>
                        {user.rating}
                      </div>
                      <div className="admin-acc-stat-box-sub">Đánh giá khách hàng</div>
                    </div>

                    <div className="admin-acc-stat-box">
                      <div className="admin-acc-stat-box-icon red">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      </div>
                      <div className="admin-acc-stat-box-label">Vi phạm</div>
                      <div className="admin-acc-stat-box-val" style={{ color: user.violations > 0 ? '#EF4444' : '#10B981' }}>
                        {user.violations} lần
                      </div>
                      <div className="admin-acc-stat-box-sub">An toàn hợp đồng</div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="admin-acc-sec-title" style={{ marginBottom: '12px' }}>
                  Thao tác nhanh
                </h4>

                <div className="admin-acc-quick-actions">
                  <div className="admin-acc-btn-row">
                    {!isUserAdmin(user) && !isCustomer(user) && (
                      <button
                        type="button"
                        className="btn-acc-action-primary"
                        onClick={() => onOpenEdit(user)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <span>Chỉnh sửa</span>
                      </button>
                    )}

                    {!isUserAdmin(user) && (
                      <button
                        type="button"
                        className={user.status === 'LOCKED' ? 'btn-acc-action-primary' : 'btn-acc-action-danger'}
                        onClick={() => onToggleLock(user.id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        <span>{user.status === 'LOCKED' ? 'Mở khóa' : 'Tạm khóa'}</span>
                      </button>
                    )}

                    {!isUserAdmin(user) && !isCustomer(user) && !isGoogleUser(user) && (
                      <button
                        type="button"
                        className="btn-acc-action-secondary"
                        onClick={() => onOpenResetPassword(user)}
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
                      onClick={() => onTabChange('ACTIVITY')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span>Xem lịch sử hoạt động</span>
                    </button>

                    {!isUserAdmin(user) && !isCustomer(user) && (
                      <button
                        type="button"
                        className="btn-acc-action-secondary"
                        onClick={() => onOpenNotify(user)}
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

          {activeTab === 'ACTIVITY' && (
            <div>
              <h4 className="admin-acc-sec-title" style={{ marginBottom: '14px' }}>
                Nhật ký hoạt động tài khoản
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                <div style={{ borderLeft: '2px solid #2563EB', paddingLeft: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>Cập nhật thông tin gần nhất</div>
                  <div style={{ color: '#64748B', fontSize: '11.5px' }}>{user.lastLogin} • Hệ thống MongoDB</div>
                </div>

                <div style={{ borderLeft: '2px solid #10B981', paddingLeft: '12px' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>Khởi tạo tài khoản thành công</div>
                  <div style={{ color: '#64748B', fontSize: '11.5px' }}>{user.joinDateTime || user.joinDate} • VESTORA Server</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'TRANSACTIONS' && (
            <div>
              <h4 className="admin-acc-sec-title" style={{ marginBottom: '14px' }}>
                Lịch sử thuê đồ &amp; Tiền đặt cọc
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px', color: '#0F172A' }}>Giao dịch gần đây</span>
                    <span style={{ color: '#059669', fontWeight: 600, fontSize: '13px' }}>{user.totalDeposit}</span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tổng số đơn thuê: {user.totalOrders} đơn</span>
                    <span style={{ color: '#0284C7' }}>Thanh toán qua PayOS</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'VIOLATIONS' && (
            <div>
              <h4 className="admin-acc-sec-title" style={{ marginBottom: '14px' }}>
                Báo cáo &amp; Biên bản vi phạm
              </h4>

              {user.violations === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 10px', color: '#059669' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '8px' }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>Tài khoản chuẩn mực</div>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    Chưa ghi nhận bất kỳ vi phạm hợp đồng hoặc báo cáo khiếu nại nào.
                  </div>
                </div>
              ) : (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', fontSize: '12.5px', color: '#B91C1C' }}>
                  <strong>Cảnh báo vi phạm:</strong> Tài khoản này có {user.violations} lần cảnh báo vi phạm được ghi nhận trong cơ sở dữ liệu.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
