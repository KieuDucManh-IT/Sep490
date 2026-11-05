import React from 'react';
import { Row, Col, Form, Spinner } from 'react-bootstrap';
import {
  MapPin,
  Navigation,
  RefreshCw,
  AlertCircle,
  Info,
  Compass,
} from 'lucide-react';
import SearchableSelect from '../../../../components/SearchableSelect';
import LeafletMapPicker from '../../../../components/LeafletMapPicker';
import { FALLBACK_PROVINCES } from '../../../owner/branches/utils/branchConstants';

export default function BranchLocationCard({
  formData,
  formErrors,
  provinces,
  wards,
  loadingProvinces,
  loadingWards,
  isLocating,
  isSyncingAddress,
  onProvinceChange,
  onWardChange,
  onFieldChange,
  onGetDeviceLocation,
  onSyncAddressFromPin,
  onMapLocationChange,
}) {
  const currentProvinces = provinces.length > 0 ? provinces : FALLBACK_PROVINCES;

  return (
    <div className="branch-settings-card">
      <div className="branch-card-header">
        <div className="branch-card-icon-wrap">
          <MapPin size={20} />
        </div>
        <div>
          <h5 className="branch-card-title">
            Địa Chỉ & Ghim Vị Trí Bản Đồ
          </h5>
          <div className="branch-card-subtitle">
            Định vị vị trí cửa ra vào cửa hàng để khách tìm đường và tính cước vận
            chuyển giao đồ
          </div>
        </div>
      </div>

      {/* Administrative Division Selects with Fast Search */}
      <Row className="g-3 mb-3">
        <Col md={6}>
          <Form.Group controlId="branchCity">
            <Form.Label className="branch-form-label">
              Tỉnh / Thành Phố <span className="branch-form-label-required">*</span>
            </Form.Label>
            <SearchableSelect
              id="branchCity"
              options={currentProvinces.map((p) => ({
                value: p.name,
                label: p.name,
                name: p.name,
                code: p.code,
              }))}
              value={formData.city || ''}
              onChange={(val, opt) => onProvinceChange(val, opt)}
              placeholder={
                loadingProvinces
                  ? 'Đang tải danh sách Tỉnh / Thành...'
                  : '-- Chọn hoặc tìm Tỉnh / Thành phố --'
              }
              searchPlaceholder="Gõ tìm nhanh Tỉnh / Thành phố..."
              isInvalid={Boolean(formErrors.city)}
              disabled={loadingProvinces}
            />
            {formErrors.city && (
              <div className="vestora-invalid-feedback d-block">
                {formErrors.city}
              </div>
            )}
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group controlId="branchWard">
            <Form.Label className="branch-form-label">
              Phường / Xã
            </Form.Label>
            <SearchableSelect
              id="branchWard"
              options={wards.map((w) => ({
                value: w.name,
                label: w.name,
                name: w.name,
                code: w.code,
              }))}
              value={formData.ward || ''}
              onChange={(val, opt) => onWardChange(val, opt)}
              placeholder={
                loadingWards
                  ? 'Đang tải danh sách Phường / Xã...'
                  : wards.length > 0
                  ? '-- Chọn hoặc tìm Phường / Xã --'
                  : formData.city
                  ? '-- Không tìm thấy Phường / Xã --'
                  : '-- Chọn Tỉnh / Thành phố trước --'
              }
              searchPlaceholder="Gõ tìm nhanh Phường / Xã..."
              disabled={!formData.city || loadingWards}
              allowClear
            />
          </Form.Group>
        </Col>
      </Row>

      {/* Street Address */}
      <Form.Group controlId="branchAddress" className="mb-3">
        <Form.Label className="branch-form-label">
          Địa Chỉ Chi Tiết (Số nhà, Tên đường, Tòa nhà)
        </Form.Label>
        <Form.Control
          type="text"
          value={formData.address}
          onChange={(e) => onFieldChange('address', e.target.value)}
          isInvalid={Boolean(formErrors.address)}
          placeholder="Ví dụ: Tầng 1, Tòa nhà VESTORA, 120 Phố Huế"
          className="branch-form-input"
        />
        {formErrors.address && (
          <div className="vestora-invalid-feedback d-block">
            {formErrors.address}
          </div>
        )}
      </Form.Group>

      {/* GPS Quick Action Toolbar */}
      <div className="branch-gps-toolbar">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1 branch-gps-btn"
            onClick={onGetDeviceLocation}
            disabled={isLocating}
          >
            {isLocating ? (
              <Spinner size="sm" animation="border" />
            ) : (
              <Navigation size={13} />
            )}
            <span>Lấy GPS Thiết Bị</span>
          </button>
        </div>

        <button
          type="button"
          className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1 branch-gps-btn"
          onClick={onSyncAddressFromPin}
          disabled={
            isSyncingAddress || !formData.latitude || !formData.longitude
          }
          title="Dịch ngược tọa độ ghim hiện tại để điền Tỉnh/Thành, Phường/Xã và Số nhà"
        >
          {isSyncingAddress ? (
            <Spinner size="sm" animation="border" />
          ) : (
            <RefreshCw size={13} />
          )}
          <span>Đồng Bộ Địa Chỉ Từ Ghim</span>
        </button>
      </div>

      {/* Interactive Leaflet Map Picker Container */}
      <div
        id="branch-map-container"
        className={`branch-map-wrapper ${formErrors.coordinates ? 'has-error' : ''}`}
      >
        <LeafletMapPicker
          latitude={formData.latitude}
          longitude={formData.longitude}
          cityName={formData.city}
          onChange={onMapLocationChange}
        />
      </div>

      {formErrors.coordinates && (
        <div className="branch-coords-error">
          <AlertCircle size={15} className="flex-shrink-0 text-danger" />
          <span>{formErrors.coordinates}</span>
        </div>
      )}

      {/* Map Coordinate Chip & Guidance */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-2 pt-1">
        <span className="branch-map-hint">
          <Info size={13} className="text-slate-400" />
          <span>
            Click vào vị trí trên bản đồ để di chuyển ghim đỏ tới cửa hàng
          </span>
        </span>
        {formData.latitude && formData.longitude && (
          <span className="branch-coords-chip">
            <Compass size={12} className="text-slate-400" />
            Tọa độ: {Number(formData.latitude).toFixed(4)},{' '}
            {Number(formData.longitude).toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}
