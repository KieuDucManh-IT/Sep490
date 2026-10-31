import React from 'react';
import { Eye, Store, Sparkles, Star, MapPin, Phone, Clock, Navigation } from 'lucide-react';
import { DEFAULT_SHOP_BANNER } from '../../../owner/branches/utils/branchConstants';

export default function BranchHeroCard({ shop, formData, onOpenLightbox }) {
  const isActive = Boolean(formData.isOpen);

  return (
    <div className="branch-hero-card">
      {/* Store Cover Banner */}
      <div className="branch-hero-banner-wrap">
        <img
          src={
            formData.bannerUrl ||
            DEFAULT_SHOP_BANNER
          }
          alt="Cover Banner"
          className="branch-hero-banner-img"
          onClick={() => {
            const bannerSrc =
              formData.bannerUrl ||
              shop?.bannerUrl ||
              DEFAULT_SHOP_BANNER;
            onOpenLightbox({
              url: bannerSrc,
              title: `${formData.name || shop?.name || 'Cửa Hàng'} — Ảnh Bìa (Kích Thước Thật)`,
            });
          }}
          title="Bấm để xem ảnh bìa chi tiết"
        />
        <div className="branch-hero-banner-gradient" />
        {/* Subtle Lightbox Affordance Badge */}
        <div className="branch-hero-view-badge">
          <Eye size={13} strokeWidth={2} />
          <span>Xem ảnh bìa</span>
        </div>
      </div>

      {/* Store Info Header Section */}
      <div className="branch-hero-body">
        <div className="branch-hero-header-row">
          <div className="d-flex align-items-end gap-3">
            {/* Floating Store Circular Logo */}
            <div
              className="branch-hero-logo-wrap"
              onClick={() => {
                const logoSrc = formData.imageUrl || shop?.imageUrl;
                if (logoSrc) {
                  onOpenLightbox({
                    url: logoSrc,
                    title: `${
                      formData.name || shop?.name || 'Cửa Hàng'
                    } — Logo Cửa Hàng (Kích Thước Thật)`,
                  });
                }
              }}
              title={
                formData.imageUrl || shop?.imageUrl
                  ? 'Bấm để xem ảnh logo chi tiết'
                  : 'Logo Cửa Hàng'
              }
            >
              {formData.imageUrl ? (
                <img
                  src={formData.imageUrl}
                  alt="Logo Cửa Hàng"
                  className="branch-hero-logo-img"
                />
              ) : (
                <div className="branch-hero-logo-placeholder">
                  <Store size={32} className="text-slate-400" />
                </div>
              )}
            </div>

            {/* Title & Micro Tags */}
            <div className="branch-hero-title-meta">
              <div className="branch-hero-tags-row">
                <span className="branch-badge-assigned">
                  <Sparkles size={11} />
                  CHI NHÁNH PHỤ TRÁCH
                </span>
                {shop?.isHQ && (
                  <span className="branch-badge-hq">
                    <Star size={11} fill="#B45309" />
                    TRỤ SỞ CHÍNH (HQ)
                  </span>
                )}
              </div>
              <h1 className="branch-hero-title">
                {formData.name || shop?.name || 'Chi Nhánh Cửa Hàng'}
              </h1>
            </div>
          </div>

          {/* Operational Status Pill */}
          <div>
            <span className={`branch-status-pill ${isActive ? 'open' : 'closed'}`}>
              <span className="branch-status-dot" />
              {isActive ? 'ĐANG MỞ CỬA TIẾP KHÁCH' : 'TẠM NGƯNG ĐÓN TIẾP'}
            </span>
          </div>
        </div>

        {/* Quick Info Chip Row */}
        <div className="branch-hero-chips-grid">
          <div className="branch-hero-chip">
            <MapPin size={15} className="text-slate-400 flex-shrink-0" />
            <div>
              <strong className="branch-hero-chip-label">Địa Chỉ:</strong>{' '}
              {formData.address ? `${formData.address}, ` : ''}
              {formData.city || 'Chưa cập nhật'}
            </div>
          </div>
          <div className="branch-hero-chip">
            <Phone size={15} className="text-slate-400 flex-shrink-0" />
            <div>
              <strong className="branch-hero-chip-label">Hotline:</strong>{' '}
              {formData.phone || 'Chưa cập nhật'}
            </div>
          </div>
          <div className="branch-hero-chip">
            <Clock size={15} className="text-slate-400 flex-shrink-0" />
            <div>
              <strong className="branch-hero-chip-label">Giờ Đón Khách:</strong>{' '}
              {formData.openingHours || '09:00 - 21:30'}
            </div>
          </div>
          <div className="branch-hero-chip">
            <Navigation size={15} className="text-slate-400 flex-shrink-0" />
            <div>
              <strong className="branch-hero-chip-label">Định Vị GPS:</strong>{' '}
              {formData.latitude && formData.longitude ? (
                <span className="branch-gps-status active">
                  ✓ Đã Ghim Vị Trí
                </span>
              ) : (
                <span className="branch-gps-status inactive">
                  Chưa Ghim Bản Đồ
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
