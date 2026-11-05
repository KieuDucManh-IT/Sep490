import React from 'react';
import { Form } from 'react-bootstrap';
import { Clock } from 'lucide-react';
import OpeningHoursInput from '../../../../components/OpeningHoursInput';

export default function BranchOperatingHoursCard({
  formData,
  formErrors,
  onFieldChange,
}) {
  const isActive = Boolean(formData.isOpen);

  return (
    <div className="branch-settings-card">
      <div className="branch-card-header">
        <div className="branch-card-icon-wrap">
          <Clock size={20} />
        </div>
        <div>
          <h5 className="branch-card-title">
            Lịch Hoạt Động & Tiếp Khách
          </h5>
          <div className="branch-card-subtitle">
            Quy định khung giờ phục vụ và trạng thái nhận khách hẹn thử đồ tại cửa hàng
          </div>
        </div>
      </div>

      {/* Interactive Operational Status Switch Card */}
      <div
        className={`branch-status-switch-card ${isActive ? 'open' : 'closed'}`}
      >
        <div className="d-flex align-items-center justify-content-between gap-3">
          <div>
            <div className="branch-status-switch-title">
              {isActive
                ? '● ĐANG MỞ CỬA PHỤC VỤ KHÁCH HÀNG'
                : '● TẠM ĐÓNG CỬA CỬA HÀNG'}
            </div>
            <div className="branch-status-switch-desc">
              {isActive
                ? 'Khách hàng có thể tìm thấy cửa hàng trên ứng dụng và đặt lịch hẹn thử đồ trực tiếp.'
                : 'Tạm dừng đón khách trực tiếp (ví dụ: đang nâng cấp nội thất, kiểm kê hoặc nghỉ lễ).'}
            </div>
          </div>
          <Form.Check
            type="switch"
            id="branch-operational-switch"
            className="branch-status-switch"
            checked={formData.isOpen}
            onChange={(e) => onFieldChange('isOpen', e.target.checked)}
            title="Bật/Tắt trạng thái mở cửa đón khách"
          />
        </div>
      </div>

      {/* Opening Hours Input Component */}
      <OpeningHoursInput
        value={formData.openingHours}
        onChange={(val) => onFieldChange('openingHours', val)}
        isInvalid={Boolean(formErrors.openingHours)}
        errorMessage={formErrors.openingHours}
      />
    </div>
  );
}
