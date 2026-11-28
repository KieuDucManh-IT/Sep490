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
            <button
              type="button"
              className={`admin-acc-tab-btn ${activeTab === 'VIOLATIONS' ? 'active' : ''}`}
              onClick={() => onTabChange('VIOLATIONS')}
            >
              Vi phạm {user.violations > 0 ? `(${user.violations})` : ''}
            </button>
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
                  {(() => {
                    const cleanRole = (user.role || '').toLowerCase().replace(/[_\s-]/g, '');
                    if (cleanRole === 'admin') {
                      return (
                        <div className="admin-acc-kv-row">
                          <span className="admin-acc-kv-key">Phạm vi cơ sở</span>
                          <span className="admin-acc-kv-val">
                            <span className="admin-acc-scope-tag system">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="2" y1="12" x2="22" y2="12" />
                                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                              </svg>
                              Toàn hệ thống
                            </span>
                          </span>
                        </div>
                      );
                    }
                    if (cleanRole === 'shopowner' || cleanRole === 'owner') {
                      return (
                        <div className="admin-acc-kv-row">
                          <span className="admin-acc-kv-key">Phạm vi cơ sở</span>
                          <span className="admin-acc-kv-val">
                            <span className="admin-acc-scope-tag all-branches">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                                <polyline points="9 22 9 12 15 12 15 22" />
                              </svg>
                              Tất cả chi nhánh
                            </span>
                          </span>
                        </div>
                      );
                    }
                    if (cleanRole === 'warehousemanager' || cleanRole === 'warehousestaff' || cleanRole === 'warehouse_manager' || cleanRole === 'warehouse_staff') {
                      return (
                        <div className="admin-acc-kv-row">
                          <span className="admin-acc-kv-key">Phạm vi cơ sở</span>
                          <span className="admin-acc-kv-val">
                            <span className="admin-acc-scope-tag warehouse">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                                <line x1="12" y1="22.08" x2="12" y2="12" />
                              </svg>
                              Kho tổng
                            </span>
                          </span>
                        </div>
                      );
                    }
                    if (cleanRole === 'branch_manager' || cleanRole === 'branchmanager') {
                      const hasShop = user.shopName && user.shopName !== 'Tất cả chi nhánh';
                      return (
                        <div className="admin-acc-kv-row">
                          <span className="admin-acc-kv-key">Cơ sở trực thuộc</span>
                          <span className="admin-acc-kv-val">
                            {hasShop ? (
                              <span className="admin-acc-scope-tag branch">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                  <circle cx="12" cy="10" r="3" />
                                </svg>
                                {user.shopName} {user.shopCity ? `(${user.shopCity})` : ''}
                              </span>
                            ) : (
                              <span className="admin-acc-scope-tag unassigned">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="8" x2="12" y2="12" />
                                  <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                Chưa phân công cơ sở
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              <div>
                <h4 className="admin-acc-sec-title" style={{ marginBottom: '12px' }}>
                  Trạng thái tài khoản
                </h4>

                <div className="admin-acc-status-box">
                  <div className="admin-acc-status-row">
                    <span style={{ fontSize: '13px', color: '#475569' }}>Trạng thái hoạt động</span>
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
                </div>
              </div>

              {!isUserAdmin(user) && (
                <div>
                  <h4 className="admin-acc-sec-title" style={{ marginBottom: '12px' }}>
                    {isCustomer(user) ? 'Thống kê hệ thống' : 'Kỷ luật & Mức độ tuân thủ'}
                  </h4>

                  <div className="admin-acc-stats-grid">
                    <div className="admin-acc-stat-box">
                      <div className="admin-acc-stat-box-icon green">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          <polyline points="9 12 11 14 15 10" />
                        </svg>
                      </div>
                      <div className="admin-acc-stat-box-label">
                        {isCustomer(user) ? 'Điểm uy tín' : 'Độ tin cậy'}
                      </div>
                      <div className="admin-acc-stat-box-val" style={{ color: user.violations > 0 ? '#D97706' : '#059669' }}>
                        {isCustomer(user) ? user.rating : (user.violations > 0 ? `${user.violations} lần vi phạm` : 'Chuẩn mực')}
                      </div>
                      <div className="admin-acc-stat-box-sub">
                        {isCustomer(user) ? 'Đánh giá khách hàng' : 'Tuân thủ nội quy'}
                      </div>
                    </div>

                    <div className="admin-acc-stat-box">
                      <div className="admin-acc-stat-box-icon red">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      </div>
                      <div className="admin-acc-stat-box-label">
                        {isCustomer(user) ? 'Vi phạm' : 'Số lần bị khóa'}
                      </div>
                      <div className="admin-acc-stat-box-val" style={{ color: user.violations > 0 ? '#EF4444' : '#10B981' }}>
                        {user.violations} lần
                      </div>
                      <div className="admin-acc-stat-box-sub">
                        {isCustomer(user) ? 'An toàn hợp đồng' : 'Lịch sử kỷ luật'}
                      </div>
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
                      onClick={() => onTabChange('VIOLATIONS')}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span>Xem lịch sử vi phạm &amp; khóa</span>
                    </button>

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

          {activeTab === 'VIOLATIONS' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <h4 className="admin-acc-sec-title" style={{ margin: 0 }}>
                    Lịch sử vi phạm &amp; Khóa tài khoản
                  </h4>
                  <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
                    Nhật ký ghi nhận các lần tạm khóa, xử lý kỷ luật và lý do vi phạm từ Ban Quản trị.
                  </div>
                </div>
              </div>

              {/* Status summary banner */}
              <div
                style={{
                  background: user.status === 'LOCKED' ? '#FEF2F2' : '#F0FDF4',
                  border: `1px solid ${user.status === 'LOCKED' ? '#FECACA' : '#DCFCE7'}`,
                  borderRadius: '10px',
                  padding: '12px 14px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: user.status === 'LOCKED' ? '#FEE2E2' : '#DCFCE7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {user.status === 'LOCKED' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <polyline points="9 12 11 14 15 10" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: user.status === 'LOCKED' ? '#991B1B' : '#166534' }}>
                      {user.status === 'LOCKED' ? 'Tài khoản đang bị tạm khóa' : 'Tài khoản đang hoạt động bình thường'}
                    </div>
                    <div style={{ fontSize: '11.5px', color: user.status === 'LOCKED' ? '#B91C1C' : '#15803D' }}>
                      {user.violations > 0
                        ? `Ghi nhận tổng cộng ${user.violations} lần vi phạm / khóa tài khoản`
                        : 'Không có ghi nhận vi phạm nào'}
                    </div>
                  </div>
                </div>

                {!isUserAdmin(user) && (
                  <button
                    type="button"
                    onClick={() => onToggleLock(user.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: user.status === 'LOCKED' ? '#16A34A' : '#DC2626',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {user.status === 'LOCKED' ? 'Mở khóa ngay' : 'Khóa tài khoản'}
                  </button>
                )}
              </div>

              {/* Lock / Violation Records List */}
              {(!user.lockHistory || user.lockHistory.length === 0) && user.violations === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 16px', background: '#FFFFFF', borderRadius: '10px', border: '1px dashed #CBD5E1' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: '#ECFDF5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px'
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#0F172A' }}>
                    Hồ sơ chuẩn mực - Không có vi phạm
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px', maxWidth: '320px', marginInline: 'auto' }}>
                    Tài khoản nhân viên này hoạt động chuẩn mực theo đúng quy định, chưa từng bị ghi nhận vi phạm hay bị khóa tài khoản.
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(() => {
                    const records = Array.isArray(user.lockHistory) && user.lockHistory.length > 0
                      ? [...user.lockHistory].reverse()
                      : [
                          {
                            action: 'LOCK',
                            reason: 'Tài khoản bị khóa do ghi nhận vi phạm quy định vận hành.',
                            performedByName: 'Ban Quản trị VESTORA',
                            createdAt: user.lastLogin || new Date().toISOString()
                          }
                        ];

                    return records.map((item, idx) => {
                      const isLockAction = (item.action || 'LOCK').toUpperCase() === 'LOCK';
                      const formattedTime = item.createdAt
                        ? new Date(item.createdAt).toLocaleString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })
                        : 'Vừa xong';

                      return (
                        <div
                          key={item._id || idx}
                          style={{
                            background: '#FFFFFF',
                            border: `1px solid ${isLockAction ? '#FCA5A5' : '#BBF7D0'}`,
                            borderRadius: '10px',
                            padding: '14px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                            position: 'relative'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  background: isLockAction ? '#FEE2E2' : '#DCFCE7',
                                  color: isLockAction ? '#DC2626' : '#15803D'
                                }}
                              >
                                {isLockAction ? (
                                  <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    ĐÃ KHÓA TÀI KHOẢN
                                  </>
                                ) : (
                                  <>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    ĐÃ MỞ KHÓA
                                  </>
                                )}
                              </span>
                              <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>
                                #{records.length - idx}
                              </span>
                            </div>

                            <span style={{ fontSize: '12px', color: '#64748B', fontWeight: 500 }}>
                              {formattedTime}
                            </span>
                          </div>

                          <div
                            style={{
                              background: isLockAction ? '#FFF5F5' : '#F8FAFC',
                              borderRadius: '8px',
                              padding: '10px 12px',
                              marginTop: '8px',
                              fontSize: '12.5px',
                              lineHeight: 1.5,
                              color: '#1E293B',
                              borderLeft: `3px solid ${isLockAction ? '#EF4444' : '#10B981'}`
                            }}
                          >
                            <div style={{ fontSize: '11px', fontWeight: 700, color: isLockAction ? '#B91C1C' : '#047857', marginBottom: '3px', textTransform: 'uppercase' }}>
                              Lý do ghi nhận:
                            </div>
                            <div>{item.reason || 'Không có lý do chi tiết'}</div>
                          </div>

                          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748B' }}>
                            <span>
                              Thực hiện bởi: <strong style={{ color: '#334155' }}>{item.performedByName || 'Quản trị viên'}</strong>
                              {item.performedByEmail ? ` (${item.performedByEmail})` : ''}
                            </span>
                            <span style={{ color: '#94A3B8' }}>Hệ thống VESTORA</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
