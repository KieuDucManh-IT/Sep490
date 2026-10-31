import React from 'react';
import { Row, Col, Form, Spinner } from 'react-bootstrap';
import { Upload, Camera, Image as ImageIcon } from 'lucide-react';
import OpeningHoursInput from '../../../../components/OpeningHoursInput';

export default function ShopIdentityCard({
  formData,
  formErrors,
  shop,
  isActive,
  uploadingAvatar,
  uploadingBanner,
  avatarFileRef,
  bannerFileRef,
  onFieldChange,
  onUploadImageFile,
  onOpenLightbox,
}) {
  return (
    <div className="settings-section-card">
      {/* Header */}
      <div className="settings-card-header">
        <div>
          <h5 className="settings-card-title">Hồ Sơ Gian Hàng & Liên Hệ</h5>
          <div className="settings-card-subtitle">
            Thông tin nhận diện cửa hàng hiển thị với khách hàng
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className={`settings-status-indicator ${isActive ? 'open' : 'closed'}`}>
            ● {isActive ? 'ĐANG MỞ CỬA' : 'TẠM DỪNG'}
          </span>
          <Form.Check
            type="switch"
            id="shop-active-switch"
            checked={Boolean(formData.isOpen)}
            onChange={(e) => onFieldChange('isOpen', e.target.checked)}
            title="Bật/Tắt trạng thái mở cửa đón khách"
          />
        </div>
      </div>

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={bannerFileRef}
        accept="image/*"
        className="d-none"
        onChange={(e) => onUploadImageFile(e, 'banner')}
      />
      <input
        type="file"
        ref={avatarFileRef}
        accept="image/*"
        className="d-none"
        onChange={(e) => onUploadImageFile(e, 'avatar')}
      />

      {/* Visual Media Cards */}
      <div className="settings-media-box">
        <Row className="g-3">
          {/* Logo Upload & Preview */}
          <Col sm={5}>
            <div className="settings-media-label">
              <ImageIcon size={14} className="text-slate-500" />
              <span>Logo Cửa Hàng</span>
            </div>
            <div className="settings-media-preview-row">
              <div
                className="settings-logo-preview"
                onClick={() => {
                  const logoSrc = formData.imageUrl || shop?.imageUrl;
                  if (logoSrc) {
                    onOpenLightbox({
                      url: logoSrc,
                      title: `${formData.name || shop?.name || 'Cửa Hàng'} — Logo Cửa Hàng (Kích Thước Thật)`,
                    });
                  }
                }}
                title={formData.imageUrl || shop?.imageUrl ? 'Bấm xem ảnh logo chi tiết' : 'Logo Cửa Hàng'}
              >
                {formData.imageUrl ? (
                  <img src={formData.imageUrl} alt="Logo Cửa Hàng" className="settings-logo-img" />
                ) : (
                  <div className="settings-logo-placeholder">LOGO</div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1 settings-media-btn"
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
                <div className="settings-media-hint">Vuông 1:1, tối đa 10MB</div>
              </div>
            </div>
          </Col>

          {/* Banner Upload & Preview */}
          <Col sm={7}>
            <div className="settings-media-label">
              <Camera size={14} className="text-slate-500" />
              <span>Ảnh Bìa Cửa Hàng (Banner)</span>
            </div>
            <div className="settings-media-preview-row">
              <div
                className="settings-banner-preview"
                onClick={() => {
                  const bannerSrc =
                    formData.bannerUrl ||
                    shop?.bannerUrl ||
                    'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80';
                  onOpenLightbox({
                    url: bannerSrc,
                    title: `${formData.name || shop?.name || 'Cửa Hàng'} — Ảnh Bìa (Kích Thước Thật)`,
                  });
                }}
                title="Bấm xem ảnh phóng to"
              >
                <img
                  src={
                    formData.bannerUrl ||
                    'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'
                  }
                  alt="Banner Cửa Hàng"
                  className="settings-banner-img"
                />
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1 settings-media-btn"
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
                <div className="settings-media-hint">Tỉ lệ 16:9, tối đa 10MB</div>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Name & Phone */}
      <Row className="g-3 mb-3">
        <Col md={7}>
          <Form.Group controlId="shopName">
            <Form.Label className="settings-field-label">
              Tên Gian Hàng / Cửa Hàng <span className="req">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              value={formData.name}
              onChange={(e) => onFieldChange('name', e.target.value)}
              isInvalid={Boolean(formErrors.name)}
              placeholder="Ví dụ: VESTORA - Quý Tộc Boutique"
              className="settings-field-input"
            />
            {formErrors.name && (
              <div className="vestora-invalid-feedback d-block">{formErrors.name}</div>
            )}
          </Form.Group>
        </Col>

        <Col md={5}>
          <Form.Group controlId="shopPhone">
            <Form.Label className="settings-field-label">
              Hotline Liên Hệ <span className="req">*</span>
            </Form.Label>
            <Form.Control
              type="text"
              value={formData.phone}
              onChange={(e) => onFieldChange('phone', e.target.value)}
              isInvalid={Boolean(formErrors.phone)}
              placeholder="Ví dụ: 0912 345 678"
              className="settings-field-input"
            />
            {formErrors.phone && (
              <div className="vestora-invalid-feedback d-block">{formErrors.phone}</div>
            )}
          </Form.Group>
        </Col>
      </Row>

      {/* Opening Hours Input */}
      <div className="mb-3">
        <OpeningHoursInput
          value={formData.openingHours}
          onChange={(val) => onFieldChange('openingHours', val)}
          isInvalid={Boolean(formErrors.openingHours)}
          errorMessage={formErrors.openingHours}
        />
      </div>

      {/* Description Textarea */}
      <Form.Group controlId="shopDescription" className="mb-0">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <Form.Label className="settings-field-label mb-0">
            Mô Tả Giới Thiệu Cửa Hàng
          </Form.Label>
          <span className="settings-char-count">
            {(formData.description || '').length} / 1000 ký tự
          </span>
        </div>
        <Form.Control
          as="textarea"
          rows={3}
          value={formData.description}
          onChange={(e) => onFieldChange('description', e.target.value)}
          isInvalid={Boolean(formErrors.description)}
          placeholder="Mô tả phong cách thời trang, dòng trang phục chủ đạo (dạ hội, cưới hỏi, veston cao cấp)..."
          className="settings-field-input"
        />
        {formErrors.description && (
          <div className="vestora-invalid-feedback d-block">{formErrors.description}</div>
        )}
      </Form.Group>
    </div>
  );
}
