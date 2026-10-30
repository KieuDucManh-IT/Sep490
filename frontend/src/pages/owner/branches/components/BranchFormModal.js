import React, { useRef } from 'react';
import { Modal, Form, Row, Col, Spinner, Button } from 'react-bootstrap';
import {
  Store,
  Edit2,
  Navigation,
  Upload,
  AlertCircle,
  Building2,
  MapPin,
  Camera,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import LeafletMapPicker from '../../../../components/LeafletMapPicker';
import SearchableSelect from '../../../../components/SearchableSelect';
import OpeningHoursInput from '../../../../components/OpeningHoursInput';
import GeoLocateButton from '../../../../components/GeoLocateButton';

export default function BranchFormModal({
  show,
  onHide,
  mode = 'create',
  formData,
  formErrors,
  onFieldChange,
  onProvinceChange,
  onMapLocationChange,
  onSyncAddressFromPin,
  onGetDeviceLocation,
  onUploadImage,
  onSubmit,
  submitting,
  isLocating,
  isSyncingAddress,
  uploadingAvatar,
  uploadingBanner,
  isDraggingBanner,
  setIsDraggingBanner,
  provinces = [],
  wards = [],
  loadingWards,
  managers = [],
  activeBranch,
}) {
  const isEditMode = mode === 'edit';
  const avatarFileInputRef = useRef(null);
  const bannerFileInputRef = useRef(null);

  const handleFileSelected = (e, imageType) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadImage(file, imageType);
    }
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingBanner(true);
  };

  const handleDragLeave = () => {
    setIsDraggingBanner(false);
  };

  const handleDropBanner = (e) => {
    e.preventDefault();
    setIsDraggingBanner(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUploadImage(file, 'banner');
    }
  };

  // Chuẩn bị danh sách Quản lý: Hiển thị số chi nhánh đang phụ trách (hỗ trợ mô hình 1 quản lý : N chi nhánh)
  const managerOptions = [
    {
      value: '',
      label: '— Không chỉ định (Chưa có Quản lý) —',
      subtext: 'Chi nhánh sẽ hoạt động độc lập hoặc do Chủ chuỗi quản lý trực tiếp',
    },
    ...managers.map((m) => {
      const branchCount = m.assignedBranchesCount || 0;
      let branchLabel = 'Chưa phụ trách chi nhánh nào';
      if (branchCount === 1) {
        branchLabel = 'Đang quản lý 1 chi nhánh';
      } else if (branchCount > 1) {
        branchLabel = `Đang quản lý ${branchCount} chi nhánh`;
      }

      return {
        value: String(m._id),
        label: m.FullName || 'Quản lý chi nhánh',
        subtext: `${m.Email || 'Không có email'} • ${branchLabel}`,
        avatar: m.Avatar || '',
        phone: m.phone || '',
      };
    }),
  ];

  return (
    <Modal
      show={show}
      onHide={onHide}
      dialogClassName="vestora-modal-dialog"
      backdrop="static"
      keyboard={false}
      centered
    >
      <div className="vestora-modal-header">
        <div className="modal-header-brand-wrap">
          <div className={`modal-header-icon-badge ${isEditMode ? 'edit' : 'create'}`}>
            {isEditMode ? <Edit2 size={20} /> : <Store size={20} />}
          </div>
          <div>
            <h5 className="modal-title-main">
              {isEditMode ? `Cập Nhật Chi Nhánh — ${activeBranch?.name || ''}` : 'Khởi Tạo Chi Nhánh Showroom Mới'}
            </h5>
            <p className="modal-subtitle-text">
              {isEditMode
                ? 'Chỉnh sửa thông số vận hành, địa chỉ bản đồ và bổ nhiệm nhân sự phụ trách'
                : 'Thêm một địa điểm kinh doanh mới vào mạng lưới chuỗi thời trang cao cấp VESTORA'}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-close"
          onClick={onHide}
          disabled={submitting}
          aria-label="Đóng"
        />
      </div>

      <div className="vestora-modal-body">
        <Form onSubmit={onSubmit}>
          <div className="modal-section-card">
            <div className="modal-section-header">
              <span className="modal-section-title">
                <Store size={14} />
                <span>1. Thông Tin Nhận Diện Chi Nhánh</span>
              </span>
              <span className="badge bg-light text-dark border">Bắt buộc</span>
            </div>

            <Row className="g-3">
              <Col md={8}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-dark">
                    Tên Showroom / Chi Nhánh <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ví dụ: VESTORA Flagship Tràng Tiền"
                    value={formData.name}
                    onChange={(e) => onFieldChange('name', e.target.value)}
                    isInvalid={Boolean(formErrors.name)}
                  />
                  {formErrors.name && (
                    <div className="vestora-invalid-feedback">
                      <AlertCircle size={12} />
                      <span>{formErrors.name}</span>
                    </div>
                  )}
                </Form.Group>
              </Col>

              <Col md={4}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-dark">
                    Hotline Liên Hệ <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="0912345678"
                    value={formData.phone}
                    onChange={(e) => onFieldChange('phone', e.target.value)}
                    isInvalid={Boolean(formErrors.phone)}
                  />
                  {formErrors.phone && (
                    <div className="vestora-invalid-feedback">
                      <AlertCircle size={12} />
                      <span>{formErrors.phone}</span>
                    </div>
                  )}
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-dark">
                    Khung Giờ Hoạt Động & Ngày Trong Tuần
                  </Form.Label>
                  <OpeningHoursInput
                    value={formData.openingHours}
                    onChange={(newHours) => onFieldChange('openingHours', newHours)}
                    error={formErrors.openingHours}
                  />
                </Form.Group>
              </Col>

              <Col md={12}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-dark">
                    Mô Tả Giới Thiệu Showroom
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    placeholder="Mô tả phong cách, không gian thử đồ VIP và các dịch vụ của chi nhánh..."
                    value={formData.description}
                    onChange={(e) => onFieldChange('description', e.target.value)}
                    isInvalid={Boolean(formErrors.description)}
                  />
                  {formErrors.description && (
                    <div className="vestora-invalid-feedback">
                      <AlertCircle size={12} />
                      <span>{formErrors.description}</span>
                    </div>
                  )}
                </Form.Group>
              </Col>
            </Row>
          </div>

          <div className="modal-section-card">
            <div className="modal-section-header">
              <span className="modal-section-title">
                <MapPin size={14} />
                <span>2. Địa Giới Hành Chính & Định Vị Bản Đồ Số</span>
              </span>
              <span className="badge bg-light text-dark border">Bản đồ trực quan</span>
            </div>

            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-dark">
                    Tỉnh / Thành Phố <span className="text-danger">*</span>
                  </Form.Label>
                  <SearchableSelect
                    options={provinces.map((p) => ({
                      value: p.name,
                      label: p.name,
                      code: p.code,
                    }))}
                    value={formData.city}
                    onChange={(val, opt) => onProvinceChange(val, opt)}
                    placeholder="Chọn Tỉnh / Thành phố..."
                    isInvalid={Boolean(formErrors.city)}
                  />
                  {formErrors.city && (
                    <div className="vestora-invalid-feedback">
                      <AlertCircle size={12} />
                      <span>{formErrors.city}</span>
                    </div>
                  )}
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-dark">
                    Phường / Xã
                  </Form.Label>
                  <SearchableSelect
                    options={wards.map((w) => ({
                      value: w.name,
                      label: w.name,
                      code: w.code,
                    }))}
                    value={formData.ward}
                    onChange={(val) => onFieldChange('ward', val)}
                    placeholder={loadingWards ? 'Đang nạp danh sách phường/xã...' : 'Chọn Phường / Xã...'}
                    disabled={loadingWards || wards.length === 0}
                  />
                </Form.Group>
              </Col>

              <Col md={7}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-dark">
                    Số Nhà, Tên Đường
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Ví dụ: Số 18 Tràng Tiền"
                    value={formData.address}
                    onChange={(e) => onFieldChange('address', e.target.value)}
                    isInvalid={Boolean(formErrors.address)}
                  />
                  {formErrors.address && (
                    <div className="vestora-invalid-feedback">
                      <AlertCircle size={12} />
                      <span>{formErrors.address}</span>
                    </div>
                  )}
                </Form.Group>
              </Col>

              <Col md={5} className="d-flex align-items-end gap-2">
                <GeoLocateButton
                  onClick={onGetDeviceLocation}
                  loading={isLocating}
                />

                <Button
                  variant="outline-secondary"
                  size="sm"
                  className="d-inline-flex align-items-center gap-1 flex-grow-1"
                  onClick={onSyncAddressFromPin}
                  disabled={isSyncingAddress || !formData.latitude || !formData.longitude}
                  title="Tự động tìm tên Tỉnh, Phường theo điểm đã ghim trên bản đồ"
                >
                  {isSyncingAddress ? <Spinner size="sm" animation="border" /> : <Navigation size={13} />}
                  <span>{isSyncingAddress ? 'Đang tìm...' : 'Lấy địa chỉ từ ghim'}</span>
                </Button>
              </Col>

              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small text-muted">
                    Vĩ độ
                  </Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    placeholder="Chưa có tọa độ"
                    value={formData.latitude}
                    onChange={(e) => onFieldChange('latitude', e.target.value)}
                    isInvalid={Boolean(formErrors.coordinates)}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label className="small text-muted">
                    Kinh độ
                  </Form.Label>
                  <Form.Control
                    type="text"
                    size="sm"
                    placeholder="Chưa có tọa độ"
                    value={formData.longitude}
                    onChange={(e) => onFieldChange('longitude', e.target.value)}
                    isInvalid={Boolean(formErrors.coordinates)}
                  />
                </Form.Group>
              </Col>
              {formErrors.coordinates && (
                <Col md={12}>
                  <div className="vestora-invalid-feedback">
                    <AlertCircle size={12} />
                    <span>{formErrors.coordinates}</span>
                  </div>
                </Col>
              )}

              <Col md={12}>
                <div className="form-map-picker-box">
                  <LeafletMapPicker
                    latitude={parseFloat(formData.latitude) || 21.028511}
                    longitude={parseFloat(formData.longitude) || 105.854167}
                    onChange={onMapLocationChange}
                    height="280px"
                  />
                </div>
              </Col>
            </Row>
          </div>

          <div className="modal-section-card">
            <div className="modal-section-header">
              <span className="modal-section-title">
                <ImageIcon size={14} />
                <span>3. Hình Ảnh Nhận Diện & Không Gian Showroom</span>
              </span>
              <span className="badge bg-light text-dark border">Ảnh cửa hàng</span>
            </div>

            <Row className="g-3">
              <Col md={8}>
                <Form.Label className="small fw-bold text-dark">
                  Ảnh Bìa Không Gian Showroom
                </Form.Label>
                <div
                  className={`form-banner-dropzone ${isDraggingBanner ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDropBanner}
                  onClick={() => bannerFileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={bannerFileInputRef}
                    className="d-none"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleFileSelected(e, 'banner')}
                  />
                  {formData.bannerUrl ? (
                    <div>
                      <img
                        src={formData.bannerUrl}
                        alt="Ảnh bìa"
                        className="form-banner-preview-img"
                      />
                      <div className="small text-muted mt-2">
                        {uploadingBanner ? (
                          <span className="text-warning fw-semibold">
                            <Spinner size="sm" animation="border" className="me-1" />
                            Đang tải ảnh lên hệ thống...
                          </span>
                        ) : (
                          <span>Nhấp hoặc kéo thả file ảnh mới để thay thế</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="form-banner-placeholder">
                      <Upload size={28} />
                      <span className="small fw-semibold">Kéo thả ảnh bìa hoặc nhấp để chọn tệp</span>
                      <span className="smaller text-muted">Hỗ trợ JPG, PNG, WEBP (Tối đa 10MB)</span>
                    </div>
                  )}
                </div>
              </Col>

              <Col md={4}>
                <Form.Label className="small fw-bold text-dark">
                  Logo / Avatar Chi Nhánh
                </Form.Label>
                <div className="form-avatar-preview-wrap">
                  {formData.imageUrl ? (
                    <img
                      src={formData.imageUrl}
                      alt="Logo chi nhánh"
                      className="form-avatar-img"
                    />
                  ) : (
                    <div className="form-avatar-img d-flex align-items-center justify-content-center text-muted">
                      <Store size={26} />
                    </div>
                  )}
                  <div className="form-avatar-controls">
                    <input
                      type="file"
                      ref={avatarFileInputRef}
                      className="d-none"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => handleFileSelected(e, 'avatar')}
                    />
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => avatarFileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                    >
                      {uploadingAvatar ? <Spinner size="sm" animation="border" /> : <Camera size={13} className="me-1" />}
                      <span>{uploadingAvatar ? 'Đang tải...' : 'Tải logo'}</span>
                    </Button>
                    <span className="text-muted form-subtext-note">
                      Kích thước vuông 512x512
                    </span>
                  </div>
                </div>
              </Col>
            </Row>
          </div>

          <div className="modal-section-card">
            <div className="modal-section-header">
              <span className="modal-section-title">
                <Building2 size={14} />
                <span>4. Bổ Nhiệm Quản Lý & Cấu Hình Vận Hành</span>
              </span>
              <span className="badge bg-light text-dark border">Phân quyền</span>
            </div>

            <Row className="g-3">
              <Col md={12}>
                <Form.Group>
                  <Form.Label className="small fw-bold text-dark">
                    Bổ Nhiệm Quản Lý Chi Nhánh
                  </Form.Label>
                  <SearchableSelect
                    options={managerOptions}
                    value={formData.managerId}
                    onChange={(val) => onFieldChange('managerId', val)}
                    placeholder="Tìm theo tên, email, số điện thoại của Quản lý chi nhánh..."
                  />
                  <Form.Text className="text-muted small">
                    Hệ thống chỉ cho phép bổ nhiệm các tài khoản đã được cấp quyền Quản lý chi nhánh. Một quản lý có thể phụ trách nhiều chi nhánh.
                  </Form.Text>
                </Form.Group>
              </Col>

              {/* Ràng buộc toàn hệ thống: Chỉ duy nhất 1 chi nhánh được gán isHQ = true */}
              <Col md={6}>
                <div className="d-flex align-items-center justify-content-between p-3 border rounded-3 bg-light">
                  <div>
                    <div className="small fw-bold text-dark">Đặt Làm Trụ Sở Chính</div>
                    <div className="text-muted form-switch-description">
                      {isEditMode && Boolean(activeBranch?.isHQ)
                        ? 'Chi nhánh này đang là Trụ sở chính. Để chuyển giao, hãy chọn chi nhánh khác.'
                        : 'Toàn chuỗi chỉ có duy nhất 1 chi nhánh giữ vai trò Trụ sở chính.'}
                    </div>
                  </div>
                  <Form.Check
                    type="switch"
                    id="isHQ-switch"
                    checked={formData.isHQ}
                    disabled={isEditMode && Boolean(activeBranch?.isHQ)}
                    onChange={(e) => onFieldChange('isHQ', e.target.checked)}
                  />
                </div>
              </Col>

              <Col md={6}>
                <div className="d-flex align-items-center justify-content-between p-3 border rounded-3 bg-light">
                  <div>
                    <div className="small fw-bold text-dark">Trạng Thái Hoạt Động</div>
                    <div className="text-muted form-switch-description">
                      {formData.status === 'ACTIVE' ? 'Showroom đang mở cửa tiếp khách' : 'Tạm dừng tiếp khách'}
                    </div>
                  </div>
                  <Form.Check
                    type="switch"
                    id="status-switch"
                    checked={formData.status === 'ACTIVE'}
                    onChange={(e) => onFieldChange('status', e.target.checked ? 'ACTIVE' : 'SUSPENDED')}
                  />
                </div>
              </Col>
            </Row>
          </div>
        </Form>
      </div>

      <div className="modal-footer">
        <button
          type="button"
          className="btn-modal-secondary"
          onClick={onHide}
          disabled={submitting}
        >
          Hủy Bỏ
        </button>

        <button
          type="button"
          className="btn-modal-primary"
          onClick={onSubmit}
          disabled={submitting || uploadingAvatar || uploadingBanner}
        >
          {submitting ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              <span>Đang lưu thông tin...</span>
            </>
          ) : (
            <>
              <Check size={14} className="me-1" />
              <span>{isEditMode ? 'Lưu Thay Đổi' : 'Tạo Chi Nhánh'}</span>
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
