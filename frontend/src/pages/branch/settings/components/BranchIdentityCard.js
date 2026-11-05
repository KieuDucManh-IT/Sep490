import React from 'react';
import { Row, Col, Form, Spinner } from 'react-bootstrap';
import { Store, Image as ImageIcon, Check, Upload, Camera } from 'lucide-react';
import { DEFAULT_SHOP_BANNER } from '../../../owner/branches/utils/branchConstants';

export default function BranchIdentityCard({
  formData,
  formErrors,
  shop,
  avatarFileRef,
  bannerFileRef,
  uploadingAvatar,
  uploadingBanner,
  onFieldChange,
  onUploadImageFile,
  onOpenLightbox,
}) {
  return (
    <div className="branch-settings-card">
      <div className="branch-card-header">
        <div className="branch-card-icon-wrap">
          <Store size={20} />
        </div>
        <div>
          <h5 className="branch-card-title">
            Thông Tin Nhận Diện Cửa Hàng
          </h5>
          <div className="branch-card-subtitle">
            Hình ảnh đại diện, ảnh bìa và giới thiệu không gian phục vụ khách hàng
          </div>
        </div>
      </div>

      <input
        type="file"
        ref={bannerFileRef}
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="d-none"
        onChange={(e) => onUploadImageFile(e, 'banner')}
      />
      <input
        type="file"
        ref={avatarFileRef}
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="d-none"
        onChange={(e) => onUploadImageFile(e, 'avatar')}
      />

      {/* Media Upload Area (Logo & Banner) */}
      <div className="branch-media-upload-box">
        <div className="branch-media-section-header">
          <div className="branch-media-section-title">
            <ImageIcon size={15} className="text-slate-600" />
            <span>Hình Ảnh Nhận Diện Cửa Hàng</span>
          </div>
          <span
            className="branch-auto-save-badge"
            title="Khi bạn tải ảnh mới, ảnh sẽ tự động được lưu ngay vào hệ thống mà không cần bấm nút Lưu bên dưới"
          >
            <Check size={12} strokeWidth={2.5} />
            Tự động lưu khi tải ảnh mới
          </span>
        </div>
        <Row className="g-3 align-items-center">
          <Col sm={5}>
            <div className="branch-media-item-title">
              <ImageIcon size={14} className="text-slate-500" />
              <span>Logo Cửa Hàng</span>
            </div>
            <div className="d-flex align-items-center gap-3">
              <div
                className="branch-logo-preview-box"
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
                    ? 'Bấm xem ảnh logo chi tiết'
                    : 'Logo Cửa Hàng'
                }
              >
                {formData.imageUrl ? (
                  <img
                    src={formData.imageUrl}
                    alt="Logo Cửa Hàng"
                    className="branch-logo-preview-img"
                  />
                ) : (
                  <div className="branch-logo-placeholder">
                    LOGO
                  </div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1 branch-upload-btn"
                  onClick={() => avatarFileRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Spinner size="sm" animation="border" className="me-1" />
                  ) : (
                    <Upload size={12} />
                  )}
                  <span>Đổi Logo</span>
                </button>
                <div className="branch-upload-hint">
                  Vuông 1:1, tối đa 10MB •{' '}
                  <span className="branch-text-autosave">
                    Tự động lưu
                  </span>
                </div>
              </div>
            </div>
          </Col>
          <Col sm={7}>
            <div className="branch-media-item-title">
              <Camera size={14} className="text-slate-500" />
              <span>Ảnh Bìa Cửa Hàng (Banner)</span>
            </div>
            <div className="d-flex align-items-center gap-3">
              <div
                className="branch-banner-preview-box"
                onClick={() => {
                  const bannerSrc =
                    formData.bannerUrl ||
                    shop?.bannerUrl ||
                    DEFAULT_SHOP_BANNER;
                  onOpenLightbox({
                    url: bannerSrc,
                    title: `${
                      formData.name || shop?.name || 'Cửa Hàng'
                    } — Ảnh Bìa (Kích Thước Thật)`,
                  });
                }}
                title="Bấm xem ảnh phóng to"
              >
                <img
                  src={
                    formData.bannerUrl ||
                    DEFAULT_SHOP_BANNER
                  }
                  alt="Banner Cửa Hàng"
                  className="branch-banner-preview-img"
                />
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1 branch-upload-btn"
                  onClick={() => bannerFileRef.current?.click()}
                  disabled={uploadingBanner}
                >
                  {uploadingBanner ? (
                    <Spinner size="sm" animation="border" className="me-1" />
                  ) : (
                    <Upload size={12} />
                  )}
                  <span>Đổi Ảnh Bìa</span>
                </button>
                <div className="branch-upload-hint">
                  Tỉ lệ 16:9, tối đa 10MB •{' '}
                  <span className="branch-text-autosave">
                    Tự động lưu
                  </span>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Name & Phone */}
      <Row className="g-3 mb-3">
        <Col md={7}>
          <Form.Group controlId="branchName">
            <Form.Label className="branch-form-label">
              Tên Chi Nhánh Cửa Hàng <span className="branch-form-label-required">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              value={formData.name}
              onChange={(e) => onFieldChange('name', e.target.value)}
              isInvalid={Boolean(formErrors.name)}
              placeholder="Ví dụ: VESTORA - Cửa Hàng Phố Huế"
              className="branch-form-input"
            />
            {formErrors.name ? (
              <div className="vestora-invalid-feedback d-block">
                {formErrors.name}
              </div>
            ) : (
              <Form.Text className="branch-form-hint">
                Tên hiển thị công khai trên phiếu giao nhận và bản đồ số
              </Form.Text>
            )}
          </Form.Group>
        </Col>
        <Col md={5}>
          <Form.Group controlId="branchPhone">
            <Form.Label className="branch-form-label">
              Hotline Đón Tiếp <span className="branch-form-label-required">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              value={formData.phone}
              onChange={(e) => onFieldChange('phone', e.target.value)}
              isInvalid={Boolean(formErrors.phone)}
              placeholder="0912 345 678"
              className="branch-form-input"
            />
            {formErrors.phone ? (
              <div className="vestora-invalid-feedback d-block">
                {formErrors.phone}
              </div>
            ) : (
              <Form.Text className="branch-form-hint">
                Số điện thoại khách liên hệ thử đồ (10 chữ số)
              </Form.Text>
            )}
          </Form.Group>
        </Col>
      </Row>

      {/* Description with Character Counter */}
      <Form.Group controlId="branchDescription" className="mb-2">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <Form.Label className="branch-form-label mb-0">
            Giới Thiệu Không Gian Trải Nghiệm
          </Form.Label>
          <span
            className={`branch-char-count ${formErrors.description ? 'has-error' : ''}`}
          >
            {(formData.description || '').length} / 1000 ký tự
          </span>
        </div>
        <Form.Control
          as="textarea"
          rows={3}
          value={formData.description}
          maxLength={1000}
          isInvalid={Boolean(formErrors.description)}
          onChange={(e) => onFieldChange('description', e.target.value)}
          placeholder="Mô tả không gian thử đồ cao cấp, phòng VIP riêng tư, bãi đỗ ô tô, đồ uống phục vụ miễn phí..."
          className="branch-form-textarea"
        />
        {formErrors.description && (
          <div className="vestora-invalid-feedback d-block">
            {formErrors.description}
          </div>
        )}
      </Form.Group>
    </div>
  );
}
