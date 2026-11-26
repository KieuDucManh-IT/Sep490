import React from 'react';
import { ROLE_LABELS } from './accountHelpers';

export default function AdminAccountTable({
  isLoading,
  paginatedUsers,
  filteredTotal,
  selectedIds,
  onSelectAll,
  onSelectRow,
  selectedUser,
  onSelectUser,
  openActionId,
  setOpenActionId,
  actionMenuRef,
  onOpenEdit,
  onToggleLock,
  onOpenResetPassword,
  isUserAdmin,
  isCustomer,
  isGoogleUser,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange
}) {
  return (
    <div className="admin-acc-table-card">
      <div className="admin-acc-table-responsive">
        <table className="admin-acc-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedIds.includes(u.id))}
                  onChange={onSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th>NGƯỜI DÙNG</th>
              <th style={{ minWidth: '135px', whiteSpace: 'nowrap' }}>VAI TRÒ</th>
              <th>CƠ SỞ / CHI NHÁNH</th>
              <th>TRẠNG THÁI</th>
              <th>NGÀY THAM GIA</th>
              <th>ĐĂNG NHẬP CUỐI</th>
              <th style={{ textAlign: 'center' }}>THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  Đang đồng bộ danh sách tài khoản từ máy chủ MongoDB Atlas...
                </td>
              </tr>
            ) : paginatedUsers.map((u, index) => {
              const isRowSelected = selectedUser && selectedUser.id === u.id;
              const isChecked = selectedIds.includes(u.id);
              const isNearBottom = index >= Math.max(1, paginatedUsers.length - 3);

              return (
                <tr
                  key={u.id}
                  className={isRowSelected ? 'selected' : ''}
                  onClick={() => onSelectUser(u)}
                  style={{
                    cursor: 'pointer',
                    position: openActionId === u.id ? 'relative' : 'static',
                    zIndex: openActionId === u.id ? 25 : 1
                  }}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => onSelectRow(u.id, e)}
                      style={{ cursor: 'pointer' }}
                    />
                  </td>

                  <td>
                    <div className="admin-acc-user-cell">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="admin-acc-avatar" />
                      ) : (
                        <div
                          className="admin-acc-avatar-letter"
                          style={{ background: u.letterColor || '#3B82F6' }}
                        >
                          {u.letter || u.name.charAt(0)}
                        </div>
                      )}
                      <div className="admin-acc-user-meta">
                        <span className="admin-acc-user-name" title={u.name}>{u.name}</span>
                        <span className="admin-acc-user-email" title={u.email}>{u.email}</span>
                      </div>
                    </div>
                  </td>

                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className={`role-pill ${u.role}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>

                  <td style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                    {(() => {
                      const cleanRole = (u.role || '').toLowerCase().replace(/[_\s-]/g, '');
                      if (cleanRole === 'shopowner' || cleanRole === 'owner') {
                        return (
                          <span className="admin-acc-all-branches-badge">
                            Tất cả chi nhánh
                          </span>
                        );
                      }
                      if (cleanRole === 'branch_manager' || cleanRole === 'branchmanager') {
                        return (u.shopName && u.shopName !== 'Tất cả chi nhánh') ? (
                          <span className="admin-acc-branch-assigned">
                            {u.shopName}
                          </span>
                        ) : (
                          <span className="admin-acc-branch-unassigned">
                            Chưa phân công
                          </span>
                        );
                      }
                      if (cleanRole === 'admin') {
                        return <span style={{ color: '#64748B', fontSize: '12.5px' }}>Toàn hệ thống</span>;
                      }
                      return <span style={{ color: '#94A3B8', fontSize: '12.5px' }}>—</span>;
                    })()}
                  </td>

                  <td>
                    <span className={`status-dot-pill ${u.status === 'ACTIVE' ? 'active' : 'locked'}`}>
                      <span className="dot" />
                      {u.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}
                    </span>
                  </td>

                  <td style={{ color: '#475569' }}>{u.joinDate}</td>

                  <td style={{ color: '#64748B' }}>{u.lastLogin}</td>

                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="admin-acc-action-cell" style={{ justifyContent: 'center', position: 'relative' }}>
                      <button
                        type="button"
                        className="btn-acc-action"
                        title="Xem chi tiết tài khoản"
                        onClick={() => onSelectUser(u)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        className="btn-acc-action"
                        title="Thao tác khác"
                        onClick={() => setOpenActionId(openActionId === u.id ? null : u.id)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="12" cy="5" r="1" />
                          <circle cx="12" cy="19" r="1" />
                        </svg>
                      </button>

                      {openActionId === u.id && (
                        <div
                          ref={actionMenuRef}
                          className={`admin-acc-action-dropdown ${isNearBottom ? 'drop-up' : 'drop-down'}`}
                        >
                          <button
                            type="button"
                            className="admin-acc-action-dropdown-item"
                            onClick={() => {
                              onSelectUser(u);
                              setOpenActionId(null);
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                            <span>Xem chi tiết</span>
                          </button>

                          {!isUserAdmin(u) && !isCustomer(u) && (
                            <button
                              type="button"
                              className="admin-acc-action-dropdown-item"
                              onClick={() => {
                                onOpenEdit(u);
                                setOpenActionId(null);
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              <span>Chỉnh sửa thông tin</span>
                            </button>
                          )}

                          {!isUserAdmin(u) && (
                            <button
                              type="button"
                              className={`admin-acc-action-dropdown-item ${u.status === 'LOCKED' ? 'success' : 'danger'}`}
                              onClick={() => {
                                onToggleLock(u.id);
                                setOpenActionId(null);
                              }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                              <span>{u.status === 'LOCKED' ? 'Mở khóa tài khoản' : 'Tạm khóa tài khoản'}</span>
                            </button>
                          )}

                          {!isUserAdmin(u) && !isCustomer(u) && (
                            !isGoogleUser(u) ? (
                              <button
                                type="button"
                                className="admin-acc-action-dropdown-item"
                                onClick={() => {
                                  onOpenResetPassword(u);
                                  setOpenActionId(null);
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="16" r="1" />
                                  <rect x="3" y="10" width="18" height="12" rx="2" />
                                  <path d="M7 10V7a5 5 0 0 1 10 0v3" />
                                </svg>
                                <span>Đặt lại mật khẩu</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="admin-acc-action-dropdown-item"
                                disabled
                                style={{ opacity: 0.5, cursor: 'not-allowed' }}
                                title="Tài khoản đăng nhập bằng Google không hỗ trợ đặt lại mật khẩu"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="16" r="1" />
                                  <rect x="3" y="10" width="18" height="12" rx="2" />
                                  <path d="M7 10V7a5 5 0 0 1 10 0v3" />
                                </svg>
                                <span>Đăng nhập Google (Không đổi MK)</span>
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {!isLoading && filteredTotal === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                  Không tìm thấy tài khoản người dùng phù hợp trong cơ sở dữ liệu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-acc-pagination-bar">
        <div>
          Hiển thị {filteredTotal > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
          {Math.min(currentPage * pageSize, filteredTotal)} trong{' '}
          <strong>{filteredTotal}</strong> tài khoản thực tế
        </div>

        <div className="admin-acc-pagination-pages">
          <button
            type="button"
            className="btn-page-num"
            disabled={currentPage === 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          >
            &lt;
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              type="button"
              className={`btn-page-num ${currentPage === p ? 'active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ))}

          <button
            type="button"
            className="btn-page-num"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            &gt;
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Hiển thị</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              height: '32px',
              padding: '0 8px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '12px'
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>/ trang</span>
        </div>
      </div>
    </div>
  );
}
