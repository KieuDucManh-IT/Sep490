import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, RefreshCw, ExternalLink } from 'lucide-react';

export default function BranchEmptyState({ onRetry, onRefresh }) {
  const handleAction = onRetry || onRefresh;
  return (
    <div className="text-center py-5">
      <div className="branch-empty-card">
        <div className="branch-empty-icon-wrap">
          <Building2 size={36} strokeWidth={1.8} />
        </div>
        <h3 className="branch-empty-title">
          Chưa Được Phân Công Chi Nhánh
        </h3>
        <p className="branch-empty-desc">
          Tài khoản của bạn hiện chưa được Chủ sở hữu chuỗi (Shop Owner) bổ nhiệm quản lý
          cửa hàng nào trong hệ thống VESTORA. Vui lòng liên hệ quản lý để được chỉ định
          chi nhánh vận hành.
        </p>
        <div className="branch-empty-actions">
          <button
            type="button"
            className="btn btn-outline-secondary d-inline-flex align-items-center gap-2 branch-empty-btn-retry"
            onClick={handleAction}
          >
            <RefreshCw size={14} />
            <span>Tải Lại Dữ Liệu</span>
          </button>
          <Link
            to="/"
            className="btn btn-dark d-inline-flex align-items-center gap-2 branch-empty-btn-home"
          >
            <span>Về Cổng Khách Hàng</span>
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
