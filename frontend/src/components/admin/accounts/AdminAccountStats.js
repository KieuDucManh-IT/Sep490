import React from 'react';

export default function AdminAccountStats({ stats }) {
  return (
    <div className="admin-acc-kpis">
      <div className="admin-acc-kpi-card">
        <div className="admin-acc-kpi-icon blue">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div className="admin-acc-kpi-content">
          <div className="admin-acc-kpi-label">Tổng tài khoản</div>
          <div className="admin-acc-kpi-row">
            <span className="admin-acc-kpi-value">{stats.total}</span>
            <span className="admin-acc-kpi-trend up">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
              100%
            </span>
          </div>
          <div className="admin-acc-kpi-sub">Dữ liệu MongoDB Atlas</div>
        </div>
      </div>

      <div className="admin-acc-kpi-card">
        <div className="admin-acc-kpi-icon green">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </div>
        <div className="admin-acc-kpi-content">
          <div className="admin-acc-kpi-label">Đang hoạt động</div>
          <div className="admin-acc-kpi-row">
            <span className="admin-acc-kpi-value">{stats.active}</span>
            <span className="admin-acc-kpi-trend up">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
              {stats.activePercent}%
            </span>
          </div>
          <div className="admin-acc-kpi-sub">{stats.activePercent}% tổng tài khoản</div>
        </div>
      </div>

      <div className="admin-acc-kpi-card">
        <div className="admin-acc-kpi-icon orange">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="admin-acc-kpi-content">
          <div className="admin-acc-kpi-label">Nhân sự / Quản lý</div>
          <div className="admin-acc-kpi-row">
            <span className="admin-acc-kpi-value">{stats.staff}</span>
            <span className="admin-acc-kpi-trend up">
              {stats.staffPercent}%
            </span>
          </div>
          <div className="admin-acc-kpi-sub">{stats.staffPercent}% tổng tài khoản</div>
        </div>
      </div>

      <div className="admin-acc-kpi-card">
        <div className="admin-acc-kpi-icon red">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="admin-acc-kpi-content">
          <div className="admin-acc-kpi-label">Tạm khóa</div>
          <div className="admin-acc-kpi-row">
            <span className="admin-acc-kpi-value">{stats.locked}</span>
            <span className="admin-acc-kpi-trend down">
              {stats.lockedPercent}%
            </span>
          </div>
          <div className="admin-acc-kpi-sub">{stats.lockedPercent}% tổng tài khoản</div>
        </div>
      </div>
    </div>
  );
}
