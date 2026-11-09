/**
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-005
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-009
 * @ears .sdd/features/shopping-cart/SPEC.md#NFR-UX-01
 * Custom Haute Couture Modal for Modifying Rental Dates (Zero-Native Dialogs)
 */

import React, { useState, useEffect } from 'react';
import { Calendar, AlertCircle, X, Check } from 'lucide-react';
import {
  calculateRentalDays,
  validateRentalDates,
  calculateRentalLineTotals,
  formatCurrencyVND,
} from '../../../services/cart/cartCalculations';
import './CartComponents.css';

export default function RentalDatePickerModal({
  isOpen,
  item,
  onSave,
  onCancel,
}) {
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [validationError, setValidationError] = useState('');

  // Lấy ngày hôm nay định dạng YYYY-MM-DD làm min date
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (item) {
      setStartDate(item.startDate ? item.startDate.split('T')[0] : todayStr);
      setDueDate(item.dueDate ? item.dueDate.split('T')[0] : todayStr);
      setValidationError('');
    }
  }, [item, isOpen, todayStr]);

  if (!isOpen || !item) return null;

  // Tính toán trước thông số với ngày được chọn
  const validation = validateRentalDates(startDate, dueDate);
  const rentalDays = validation.isValid ? validation.rentalDays : calculateRentalDays(startDate, dueDate);
  const lineTotals = calculateRentalLineTotals(
    item.rentalPricePerDay,
    item.depositAmount,
    rentalDays,
    item.quantity || 1
  );

  const handleStartDateChange = (e) => {
    const newStart = e.target.value;
    setStartDate(newStart);
    setValidationError('');
    // Nếu dueDate nhỏ hơn startDate mới, tự động đẩy dueDate bằng startDate
    if (dueDate && newStart > dueDate) {
      setDueDate(newStart);
    }
  };

  const handleDueDateChange = (e) => {
    setDueDate(e.target.value);
    setValidationError('');
  };

  const handleSave = () => {
    const val = validateRentalDates(startDate, dueDate);
    if (!val.isValid) {
      setValidationError(val.errorMessage);
      return;
    }

    onSave(startDate, dueDate);
  };

  return (
    <div
      className="vestora-cart-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rental-date-picker-title"
      onClick={onCancel}
    >
      <div
        className="vestora-cart-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="vestora-cart-modal-header">
          <div className="vestora-cart-modal-header-icon">
            <Calendar size={20} color="#96723D" />
            <h3 id="rental-date-picker-title" className="vestora-cart-modal-title">
              Thay đổi thời gian thuê
            </h3>
          </div>
          <button
            type="button"
            className="vestora-cart-modal-close-btn"
            onClick={onCancel}
            aria-label="Đóng hộp thoại"
          >
            <X size={18} />
          </button>
        </div>

        <div className="vestora-cart-modal-body">
          <div className="vestora-cart-modal-product-name" style={{ marginBottom: 12 }}>
            {item.name}
          </div>

          <div className="vestora-date-input-group">
            <label className="vestora-date-input-label" htmlFor="cart-rental-start-date">
              Ngày nhận trang phục
            </label>
            <input
              id="cart-rental-start-date"
              type="date"
              className="vestora-date-input"
              min={todayStr}
              value={startDate}
              onChange={handleStartDateChange}
            />
          </div>

          <div className="vestora-date-input-group">
            <label className="vestora-date-input-label" htmlFor="cart-rental-due-date">
              Ngày trả trang phục
            </label>
            <input
              id="cart-rental-due-date"
              type="date"
              className="vestora-date-input"
              min={startDate || todayStr}
              value={dueDate}
              onChange={handleDueDateChange}
            />
          </div>

          {validationError && (
            <div className="vestora-date-error-msg">
              <AlertCircle size={14} />
              <span>{validationError}</span>
            </div>
          )}

          <div className="vestora-date-summary-box">
            <div className="vestora-date-summary-row">
              <span>Thời gian thuê tính toán:</span>
              <strong>{rentalDays} ngày</strong>
            </div>
            <div className="vestora-date-summary-row">
              <span>Đơn giá thuê:</span>
              <span>{formatCurrencyVND(item.rentalPricePerDay)}/ngày</span>
            </div>
            <div className="vestora-date-summary-row">
              <span>Thành tiền thuê ({item.quantity} sản phẩm):</span>
              <strong>{formatCurrencyVND(lineTotals.lineRentalFee)}</strong>
            </div>
            <div className="vestora-date-summary-row">
              <span>Tiền cọc bảo hiểm (hoàn lại):</span>
              <span style={{ color: '#96723D' }}>{formatCurrencyVND(lineTotals.lineDeposit)}</span>
            </div>
          </div>
        </div>

        <div className="vestora-cart-modal-footer">
          <button
            type="button"
            className="vestora-cart-btn-secondary"
            onClick={onCancel}
          >
            Đóng
          </button>
          <button
            type="button"
            className="vestora-cart-btn-primary"
            onClick={handleSave}
            disabled={!validation.isValid}
          >
            <Check size={16} />
            Cập nhật ngày thuê
          </button>
        </div>
      </div>
    </div>
  );
}
