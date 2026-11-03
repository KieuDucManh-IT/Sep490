import { useRef, memo } from 'react';
import { Modal } from 'react-bootstrap';
import {
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
 * Đồng bộ hoàn toàn theo hệ thống Vestora Modal Specification:
 * - Thư viện: react-bootstrap Modal (đồng bộ với BranchFormModal, DeleteBranchModal, CreatePolicyModal)
 * - Container & Classes: vestora-modal-dialog, vestora-modal-header, vestora-modal-body, modal-section-card, vestora-modal-footer
 * - /ck:web-design-guidelines: WCAG AA, semantic HTML5 (<output>, <label>), tabular-nums, focus rings, auto-focus
 * - /ck:ui-ux-pro-max: Tailored luxury aesthetics, visual hierarchy, instant live calculation feedback
 * - /ck:ui-styling: Consistent tokens, subtle elevation, responsive dialog
 * - /ck:react-best-practices: Pure component, memoized props, zero re-render waste
 *
 * Lưu ý nghiêm ngặt: Giữ nguyên toàn bộ props, data fields và logic tính toán tự động.
 */
function PricingEditModal({
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
  const salePriceInputRef = useRef(null);

  // Tự động focus vào ô nhập giá trị khi mở modal
  const handleEntered = () => {
    if (salePriceInputRef.current) {
      salePriceInputRef.current.focus();
    }
  };

  if (!editingItem) return null;

  return (
    <Modal
      show={Boolean(editingItem)}
      onHide={submitting ? () => {} : onClose}
      onEntered={handleEntered}
      centered
      backdrop="static"
      keyboard={!submitting}
      dialogClassName="vestora-modal-dialog pricing-modal-dialog"
      aria-labelledby="pricing-modal-title"
    >
      {/* 1. Modal Header chuẩn Vestora */}
      <div className="vestora-modal-header">
        <div className="modal-header-brand-wrap">
          <div className="modal-header-icon-badge gold" aria-hidden="true">
            <Sparkles size={20} />
          </div>
          <div>
            <h5 id="pricing-modal-title" className="modal-title-main">
              Cấu Hình Biểu Phí & Tiền Cọc Chuỗi
            </h5>
            <p className="modal-subtitle-text">
              Mẫu: <strong className="text-dark">{editingItem.name}</strong> • Mã SP: <span className="pricing-modal-code">{editingItem.code}</span> • {editingItem.category}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn-close"
          onClick={onClose}
          disabled={submitting}
          aria-label="Đóng cửa sổ chỉnh sửa"
        />
      </div>

      {/* 2. Modal Body với cuộn mượt */}
      <div className="vestora-modal-body">
        {/* Thông báo lỗi nếu có */}
        {modalError ? (
          <div role="alert" aria-live="assertive" className="pricing-modal-error-box mb-3">
            <AlertCircle size={16} className="pricing-modal-error-icon" aria-hidden="true" />
            <span>{modalError}</span>
          </div>
        ) : null}

        {/* Trạng thái lưu thành công */}
        {saveSuccess ? (
          <div role="status" aria-live="polite" className="pricing-modal-success-box my-3">
            <div className="pricing-modal-success-icon-wrap" aria-hidden="true">
              <CheckCircle2 size={36} color="#059669" />
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
          <form id="pricing-edit-form" onSubmit={onSave} noValidate={false}>
            <div className="modal-section-card mb-3">
              <div className="modal-section-header">
                <span className="modal-section-title">
                  <Tag size={14} className="text-warning" aria-hidden="true" />
                  <span>1. Giá Trị Định Giá Sản Phẩm (Kho / Bán)</span>
                </span>
                <span className="badge bg-light text-dark border">Giá trị ước tính</span>
              </div>

              <div className="pricing-form-group">
                <label htmlFor="input-sale-price" className="modal-field-label">
                  <span>Giá trị mặt hàng / Giá bán định giá từ kho (VND)</span>
                  <span className="req" aria-hidden="true">*</span>
                </label>
                <div className="pricing-currency-input-wrap">
                  <input
                    ref={salePriceInputRef}
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
            </div>

            {/* Khối 2: Cấu hình tự động Giá thuê mỗi ngày theo % */}
            <div className="modal-section-card mb-3">
              <div className="modal-section-header">
                <span className="modal-section-title">
                  <Calendar size={14} className="text-warning" aria-hidden="true" />
                  <span>2. Tỷ Lệ Giá Thuê Theo Ngày (%)</span>
                </span>
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
            <div className="modal-section-card mb-3">
              <div className="modal-section-header">
                <span className="modal-section-title">
                  <ShieldCheck size={14} className="text-success" aria-hidden="true" />
                  <span>3. Tỷ Lệ Tiền Cọc Bảo Đảm (%)</span>
                </span>
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
          </form>
        )}
      </div>

      {/* 3. Modal Footer chuẩn Vestora */}
      {!saveSuccess ? (
        <div className="vestora-modal-footer">
          <button
            type="button"
            className="btn-modal-secondary"
            onClick={onClose}
            disabled={submitting}
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            form="pricing-edit-form"
            className="btn-modal-primary btn-modal-gold"
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
                <span>Lưu</span>
              </>
            )}
          </button>
        </div>
      ) : null}
    </Modal>
  );
}

export default memo(PricingEditModal);
