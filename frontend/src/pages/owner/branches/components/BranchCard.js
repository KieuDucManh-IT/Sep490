import React from 'react';
import {
  Store,
  Phone,
  Clock,
  MapPin,
  Compass,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  UserCheck,
} from 'lucide-react';
import { DEFAULT_SHOP_IMAGE, DEFAULT_SHOP_BANNER } from '../utils/branchConstants';

export default function BranchCard({
  branch,
  onEdit,
  onToggleSuspend,
  onViewMap,
  onDelete,
  onOpenLightbox,
}) {
  const bannerImage = branch.bannerUrl || DEFAULT_SHOP_BANNER;
  const avatarImage = branch.imageUrl || DEFAULT_SHOP_IMAGE;

  const manager = branch.managerId;
  const isHQ = Boolean(branch.isHQ);
  const isActive = branch.status === 'ACTIVE';

  return (
    <div className={`clean-branch-card ${isHQ ? 'is-hq' : ''}`}>
      <div className="branch-card-cover-wrap">
        <img
          src={bannerImage}
          alt={branch.name}
          className="branch-card-cover-img"
          onClick={() => onOpenLightbox({ url: bannerImage, title: `Ảnh bìa — ${branch.name}` })}
        />
        <div className="branch-card-cover-gradient" />

        {isHQ && (
          <div className="branch-card-badge-top-left">
            <span className="branch-card-badge-hq">
              TRỤ SỞ CHÍNH
            </span>
          </div>
        )}

        <div className="branch-card-badge-top-right">
          {isActive ? (
            <span className="branch-card-badge-active">
              <CheckCircle2 size={12} />
              <span>Đang mở</span>
            </span>
          ) : (
            <span className="branch-card-badge-suspended">
              <AlertCircle size={12} />
              <span>Tạm dừng</span>
            </span>
          )}
        </div>
      </div>

      <div className="branch-card-body-wrap">
        <div className="branch-card-avatar-wrap">
          <button
            type="button"
            className="branch-card-avatar-btn"
            onClick={() => {
              if (avatarImage) {
                onOpenLightbox({ url: avatarImage, title: `Logo — ${branch.name}` });
              }
            }}
            title="Xem ảnh logo"
          >
            {avatarImage ? (
              <img
                src={avatarImage}
                alt={branch.name}
                className="branch-card-avatar-img"
              />
            ) : (
              <div className="branch-card-avatar-img d-flex align-items-center justify-content-center text-secondary">
                <Store size={28} />
              </div>
            )}
          </button>
        </div>

        <h3 className="branch-card-name">
          {branch.name}
        </h3>

        <div className="branch-card-meta-list">
          <div className="branch-card-meta-item">
            <Phone size={14} className="branch-card-meta-icon" />
            <span className="branch-card-meta-text">
              {branch.phone || 'Chưa cập nhật số hotline'}
            </span>
          </div>

          <div className="branch-card-meta-item">
            <Clock size={14} className="branch-card-meta-icon" />
            <span className="branch-card-meta-text">
              {branch.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)'}
            </span>
          </div>

          <div className="branch-card-meta-item is-address">
            <MapPin size={14} className="branch-card-meta-icon" />
            <span className="branch-card-meta-text">
              {[branch.address, branch.ward, branch.city].filter(Boolean).join(', ') || 'Chưa cập nhật địa chỉ'}
            </span>
          </div>
        </div>

        <div className="branch-card-manager-box">
          <div className="branch-card-manager-header">
            <span className="branch-card-manager-title">
              <UserCheck size={13} />
              <span>Quản lý chi nhánh</span>
            </span>
          </div>

          {manager ? (
            <div className="branch-card-manager-content">
              {manager.Avatar ? (
                <img
                  src={manager.Avatar}
                  alt={manager.FullName || 'Quản lý'}
                  className="branch-card-manager-avatar"
                />
              ) : (
                <div className="branch-card-manager-avatar-placeholder">
                  {(manager.FullName || 'Q').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="branch-card-manager-info">
                <span className="branch-card-manager-name">
                  {manager.FullName || 'Quản lý chi nhánh'}
                </span>
                <span className="branch-card-manager-email">
                  {manager.Email || manager.phone || 'Tài khoản hoạt động'}
                </span>
              </div>
            </div>
          ) : (
            <div className="branch-card-manager-unassigned">
              Chưa có Quản lý được phân công
            </div>
          )}
        </div>

        <div className="branch-card-actions-row">
          <button
            type="button"
            className="branch-card-btn primary"
            onClick={() => onEdit(branch)}
            title="Chỉnh sửa chi nhánh"
          >
            <Edit2 size={13} />
            <span>Sửa</span>
          </button>

          <button
            type="button"
            className="branch-card-btn"
            onClick={() => onToggleSuspend(branch)}
            title={isActive ? 'Tạm ngưng nhận khách' : 'Kích hoạt lại'}
          >
            {isActive ? 'Tạm dừng' : 'Kích hoạt'}
          </button>

          <button
            type="button"
            className="branch-card-btn"
            onClick={() => onViewMap(branch)}
            title="Xem vị trí trên bản đồ"
          >
            <Compass size={13} />
            <span>Bản đồ</span>
          </button>

          {/* Quy tắc bảo vệ: Không cho phép xóa Trụ sở chính (HQ) trực tiếp */}
          <button
            type="button"
            className="branch-card-btn danger"
            onClick={() => onDelete(branch)}
            disabled={isHQ}
            title={isHQ ? 'Không thể xóa Trụ sở chính' : 'Xóa chi nhánh này'}
          >
            <Trash2 size={13} />
            <span>Xóa</span>
          </button>
        </div>
      </div>
    </div>
  );
}
