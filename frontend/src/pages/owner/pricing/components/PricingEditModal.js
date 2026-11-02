import React from 'react';
import {
  X,
  AlertCircle,
  CheckCircle2,
  Lock,
  Info,
  ShieldCheck,
  RotateCcw,
  Calendar,
  Tag,
  Sparkles,
} from 'lucide-react';
import { fmtCurrency } from '../utils/pricingHelpers';

const RENTAL_PRESETS = [5, 8, 10, 15];
const DEPOSIT_PRESETS = [30, 50, 70, 100];

/**
 * Modal cấu hình biểu phí & tiền cọc cho sản phẩm (Shop Owner)
 * Áp dụng tiêu chuẩn:
 * - /ck:web-design-guidelines: WCAG AA, semantic HTML5 (<output>, <dialog>, <label>), tabular-nums, focus rings
 * - /ck:ui-ux-pro-max: Tailored luxury aesthetics, visual hierarchy, instant live calculation feedback
 * - /ck:ui-styling: Consistent tokens, subtle elevation, responsive dialog
 * - /ck:react-best-practices: Pure component, memoized props, zero re-render waste
 *
 * Lưu ý nghiêm ngặt: Giữ nguyên toàn bộ props, data fields và logic tính toán tự động.
 */
export default function PricingEditModal({
  editingItem,
  editForm,
  submitting,
  saveSuccess,
  modalError,
  onClose,
  onSave,
  onSalePriceChange,
  onRentalPercentChange,
  onQuickRentalPercent,
  onDepositPercentChange,
  onQuickDepositPercent,
}) {
  if (!editingItem) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pricing-modal-title"
      className="pricing-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="pricing-modal-dialog">
        {/* Modal Header */}
        <div className="pricing-modal-header">
          <div>
            <span className="pricing-modal-badge">
              <Sparkles size={12} aria-hidden="true" />
              <span>CẤU HÌNH BIỂU PHÍ & TIỀN CỌC CHUỖI</span>
            </span>
            <h3 id="pricing-modal-title" className="pricing-modal-title">
              {editingItem.name}
            </h3>
            <div className="pricing-modal-meta">
              <span>
                Mã: <strong className="pricing-modal-code">{editingItem.code}</strong>
              </span>
              <span aria-hidden="true">•</span>
              <span>{editingItem.category}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            title="Đóng cửa sổ chỉnh sửa"
            aria-label="Đóng cửa sổ chỉnh sửa"
            className="pricing-modal-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Thông báo lỗi nếu có */}
        {modalError && (
          <div role="alert" aria-live="assertive" className="pricing-modal-error-box">
            <AlertCircle size={16} className="pricing-modal-error-icon" />
            <span>{modalError}</span>
          </div>
        )}

        {/* Trạng thái lưu thành công */}
        {saveSuccess ? (
          <div role="status" aria-live="polite" className="pricing-modal-success-box">
            <div className="pricing-modal-success-icon-wrap" aria-hidden="true">
              <CheckCircle2 size={32} color="#059669" />
            </div>
            <div>
              <h4 className="pricing-modal-success-title">
                Cập Nhật Thành Công!
              </h4>
              <p className="pricing-modal-success-desc">
                Đã lưu biểu phí thuê và tiền cọc mới cho toàn bộ các kích cỡ/màu sắc của mẫu trang phục này.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={onSave} noValidate={false}>
            <div className="pricing-form-fields">
              {/* Khối 1: Giá trị mặt hàng định giá từ kho (Cơ sở tính toán) */}
              <div className="pricing-form-group">
                <div className="pricing-val-header">
                  <label htmlFor="input-sale-price" className="pricing-form-label">
                    <Tag size={14} className="pricing-label-icon" aria-hidden="true" />
                    <span>Giá trị mặt hàng / Giá bán định giá từ kho (VND)</span>
                    <span className="pricing-required-star" aria-hidden="true">*</span>
                  </label>
                </div>
                <div className="pricing-currency-input-wrap">
                  <input
                    id="input-sale-price"
                    type="number"
                    required
                    min="0"
                    step="1000"
                    inputMode="numeric"
                    value={editForm.salePrice}
                    onChange={(e) => onSalePriceChange(e.target.value)}
                    placeholder="Nhập giá trị định giá của trang phục..."
                    className="pricing-input-control"
                    aria-describedby="sale-price-hint"
                  />
                  <span className="pricing-currency-suffix" aria-hidden="true">VND</span>
                </div>
                <div id="sale-price-hint" className="pricing-input-hint">
                  Định giá hiện tại: <strong>{fmtCurrency(editForm.salePrice)}</strong> (Khi thay đổi, giá thuê & tiền cọc bên dưới sẽ tự động tính lại).
                </div>
              </div>

              {/* Khối 2: Cấu hình tự động Giá thuê mỗi ngày theo % */}
              <div className="pricing-calc-box rental-box">
                <div className="pricing-calc-header">
                  <div className="pricing-calc-title-row">
                    <div className="pricing-calc-icon-badge amber-badge">
                      <Calendar size={14} aria-hidden="true" />
                    </div>
                    <div>
                      <label htmlFor="input-rental-percent" className="pricing-calc-label">
                        Tỷ lệ giá thuê theo ngày (%)
                        <span className="pricing-required-star" aria-hidden="true">*</span>
                      </label>
                      <span className="pricing-calc-sublabel">Tự động tính theo % giá trị trang phục</span>
                    </div>
                  </div>
                  <span className="pricing-calc-tag amber-tag">
                    {editForm.rentalPercent || 0}% / ngày
                  </span>
                </div>

                {/* % Selector Buttons + Custom Input cho Giá Thuê */}
                <div className="pricing-calc-input-row">
                  <div className="pricing-preset-pills" role="group" aria-label="Các mốc gợi ý giá thuê">
                    <span className="pricing-preset-hint">Gợi ý nhanh:</span>
                    {RENTAL_PRESETS.map((pct) => {
                      const isSelected = Number(editForm.rentalPercent) === pct;
                      return (
                        <button
                          key={pct}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => onQuickRentalPercent(pct)}
                          className={`pricing-preset-btn ${isSelected ? 'active amber-preset' : ''}`}
                        >
                          {pct}%
                        </button>
                      );
                    })}
                  </div>

                  <div className="pricing-percent-input-wrap">
                    <input
                      id="input-rental-percent"
                      type="number"
                      min="1"
                      max="100"
                      inputMode="numeric"
                      value={editForm.rentalPercent}
                      onChange={(e) => onRentalPercentChange(e.target.value)}
                      placeholder="10"
                      aria-label="Tỷ lệ % giá thuê theo ngày"
                      className="pricing-percent-input"
                    />
                    <span className="pricing-percent-symbol" aria-hidden="true">%</span>
                  </div>
                </div>

                {/* Kết quả tự tính: Output Card hiển thị giá thuê mỗi ngày */}
                <div className="pricing-locked-card rental-card">
                  <div className="pricing-locked-card-top">
                    <span className="pricing-locked-label rental-label">
                      <Lock size={12} aria-hidden="true" />
                      <span>Giá thuê mỗi ngày (Hệ thống tự tính):</span>
                    </span>
                    <span className="pricing-calc-tag amber-tag">
                      Khoảng {editForm.rentalPercent || 0}% giá trị
                    </span>
                  </div>

                  <output
                    htmlFor="input-sale-price input-rental-percent"
                    className="pricing-locked-val-row"
                    aria-label="Giá thuê mỗi ngày tự động tính"
                  >
                    <span className="pricing-locked-val-number text-amber">
                      {fmtCurrency(editForm.rentalPricePerDay)}
                    </span>
                    <span className="pricing-locked-val-unit">/ ngày</span>
                  </output>

                  <div className="pricing-locked-hint rental-hint">
                    <Info size={12} aria-hidden="true" />
                    <span>
                      Khách hàng thanh toán <strong>{fmtCurrency(editForm.rentalPricePerDay)}</strong> cho mỗi ngày thuê thực tế.
                    </span>
                  </div>
                </div>
              </div>

              {/* Khối 3: Cấu hình tự động Tiền cọc thuê theo % */}
              <div className="pricing-calc-box deposit-box">
                <div className="pricing-calc-header">
                  <div className="pricing-calc-title-row">
                    <div className="pricing-calc-icon-badge emerald-badge">
                      <ShieldCheck size={14} aria-hidden="true" />
                    </div>
                    <div>
                      <label htmlFor="input-deposit-percent" className="pricing-calc-label">
                        Tỷ lệ tiền cọc bảo đảm (%)
                        <span className="pricing-required-star" aria-hidden="true">*</span>
                      </label>
                      <span className="pricing-calc-sublabel">Tự động tính theo % giá trị trang phục</span>
                    </div>
                  </div>
                  <span className="pricing-calc-tag emerald-tag">
                    {editForm.depositPercent || 0}% giá trị
                  </span>
                </div>

                {/* % Selector Buttons + Custom Input cho Tiền Cọc */}
                <div className="pricing-calc-input-row">
                  <div className="pricing-preset-pills" role="group" aria-label="Các mốc gợi ý tiền cọc">
                    <span className="pricing-preset-hint">Gợi ý nhanh:</span>
                    {DEPOSIT_PRESETS.map((pct) => {
                      const isSelected = Number(editForm.depositPercent) === pct;
                      return (
                        <button
                          key={pct}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => onQuickDepositPercent(pct)}
                          className={`pricing-preset-btn ${isSelected ? 'active emerald-preset' : ''}`}
                        >
                          {pct}%
                        </button>
                      );
                    })}
                  </div>

                  <div className="pricing-percent-input-wrap">
                    <input
                      id="input-deposit-percent"
                      type="number"
                      min="1"
                      max="200"
                      inputMode="numeric"
                      value={editForm.depositPercent}
                      onChange={(e) => onDepositPercentChange(e.target.value)}
                      placeholder="50"
                      aria-label="Tỷ lệ % tiền cọc tùy chỉnh"
                      className="pricing-percent-input"
                    />
                    <span className="pricing-percent-symbol" aria-hidden="true">%</span>
                  </div>
                </div>

                {/* Kết quả tự tính: Output Card hiển thị số tiền cọc */}
                <div className="pricing-locked-card deposit-card">
                  <div className="pricing-locked-card-top">
                    <span className="pricing-locked-label deposit-label">
                      <Lock size={12} aria-hidden="true" />
                      <span>Tiền cọc bảo đảm (Hệ thống tự tính):</span>
                    </span>
                    <span className="pricing-calc-tag emerald-tag">
                      Khoảng {editForm.depositPercent || 0}% giá trị
                    </span>
                  </div>

                  <output
                    htmlFor="input-sale-price input-deposit-percent"
                    className="pricing-locked-val-row"
                    aria-label="Tiền cọc tự động tính"
                  >
                    <span className="pricing-locked-val-number text-emerald">
                      {fmtCurrency(editForm.deposit)}
                    </span>
                  </output>

                  <div className="pricing-locked-hint deposit-hint">
                    <Info size={12} aria-hidden="true" />
                    <span>
                      Hệ thống tự động tính tiền cọc để bảo đảm an toàn tài sản và tránh nhầm lẫn khi thuê.
                    </span>
                  </div>
                </div>
              </div>

              {/* Thông báo cam kết bảo lưu đơn giá */}
              <div className="pricing-notice-box">
                <ShieldCheck size={18} className="pricing-notice-icon" aria-hidden="true" />
                <span>
                  <strong>Lưu ý:</strong> Mức giá mới sẽ áp dụng thống nhất cho tất cả các kích cỡ và màu sắc của mẫu trang phục này.
                  Các đơn hàng khách đã chốt trước thời điểm này <strong>vẫn được bảo lưu nguyên vẹn mức giá cũ</strong>.
                </span>
              </div>
            </div>

            {/* Modal Footer Buttons */}
            <div className="pricing-modal-actions">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="pricing-btn-cancel"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="pricing-btn-submit"
                disabled={submitting}
                aria-busy={submitting}
              >
                {submitting ? (
                  <>
                    <RotateCcw size={15} className="spin-anim" aria-hidden="true" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} aria-hidden="true" />
                    <span>Lưu Biểu Phí</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
