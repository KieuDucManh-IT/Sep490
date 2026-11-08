/**
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-007
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-008
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-009
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-010
 * @ears .sdd/features/shopping-cart/SPEC.md#NFR-UX-01
 * Haute Couture Cart Item Card Component (Zero-Emoji, Zero-Native Dialogs)
 */

import React, { useState } from 'react';
import { Clock, ShoppingBag, Calendar, Plus, Minus, Trash2 } from 'lucide-react';
import { useCartStore } from '../../../stores/useCartStore';
import { formatCurrencyVND } from '../../../services/cart/cartCalculations';
import ConfirmRemoveModal from './ConfirmRemoveModal';
import RentalDatePickerModal from './RentalDatePickerModal';
import './CartComponents.css';

// Format YYYY-MM-DD sang DD/MM/YYYY
function formatDateDisplay(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export default function CartItemCard({ item }) {
  const { updateQuantity, updateRentalDates, removeItem } = useCartStore();

  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [isDatePickerModalOpen, setIsDatePickerModalOpen] = useState(false);

  if (!item) return null;

  const isRental = item.orderType === 'rental';

  const handleDecrement = () => {
    if (item.quantity <= 1) {
      // REQ-CART-008: Chặn giảm về 0, mở modal xác nhận xóa
      setIsRemoveModalOpen(true);
    } else {
      updateQuantity(item.cartItemId, item.quantity - 1);
    }
  };

  const handleIncrement = () => {
    if (item.quantity < 99) {
      updateQuantity(item.cartItemId, item.quantity + 1);
    }
  };

  const handleConfirmRemove = () => {
    removeItem(item.cartItemId);
    setIsRemoveModalOpen(false);
  };

  const handleSaveDates = (startDate, dueDate) => {
    updateRentalDates(item.cartItemId, startDate, dueDate);
    setIsDatePickerModalOpen(false);
  };

  return (
    <>
      <div className="vestora-cart-item-card" data-testid={`cart-item-${item.cartItemId}`}>
        <img
          src={
            item.thumbnailImage ||
            'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&q=80&w=200'
          }
          alt={item.name}
          className="vestora-cart-item-thumbnail"
        />

        <div className="vestora-cart-item-info">
          <div>
            <div className="vestora-cart-item-top">
              <div className="vestora-cart-item-badges">
                {isRental ? (
                  <span className="vestora-cart-badge-rental">
                    <Clock size={11} />
                    Thuê trang phục
                  </span>
                ) : (
                  <span className="vestora-cart-badge-sale">
                    <ShoppingBag size={11} />
                    Mua thanh lý
                  </span>
                )}
              </div>

              <button
                type="button"
                className="vestora-cart-remove-icon-btn"
                title="Xóa sản phẩm"
                aria-label={`Xóa ${item.name} khỏi giỏ`}
                onClick={() => setIsRemoveModalOpen(true)}
              >
                <Trash2 size={16} />
              </button>
            </div>

            <h4 className="vestora-cart-item-name" title={item.name}>
              {item.name}
            </h4>

            <div className="vestora-cart-item-variant">
              {item.size && <span>Size: <strong>{item.size}</strong></span>}
              {item.color && <span>• Màu: <strong>{item.color}</strong></span>}
              {item.sku && <span>• SKU: {item.sku}</span>}
            </div>

            {isRental && (
              <div className="vestora-cart-item-rental-dates">
                <div className="vestora-cart-item-date-text">
                  <Calendar size={13} color="#96723D" />
                  <span>
                    {formatDateDisplay(item.startDate)} - {formatDateDisplay(item.dueDate)} (
                    <strong>{item.rentalDays} ngày</strong>)
                  </span>
                </div>
                <button
                  type="button"
                  className="vestora-cart-btn-edit-date"
                  onClick={() => setIsDatePickerModalOpen(true)}
                >
                  Đổi ngày
                </button>
              </div>
            )}
          </div>

          <div className="vestora-cart-item-bottom">
            <div className="vestora-cart-item-pricing">
              <div className="vestora-cart-item-line-total">
                {formatCurrencyVND(item.lineTotal || 0)}
              </div>
              {isRental && item.lineDeposit > 0 && (
                <div className="vestora-cart-item-deposit-note">
                  + Cọc: {formatCurrencyVND(item.lineDeposit)} (Hoàn lại)
                </div>
              )}
            </div>

            <div className="vestora-cart-item-controls">
              <div className="vestora-cart-stepper">
                <button
                  type="button"
                  className="vestora-cart-stepper-btn"
                  onClick={handleDecrement}
                  aria-label="Giảm số lượng"
                >
                  <Minus size={13} />
                </button>
                <span className="vestora-cart-stepper-value" data-testid="item-quantity">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  className="vestora-cart-stepper-btn"
                  onClick={handleIncrement}
                  aria-label="Tăng số lượng"
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Haute Couture Custom Modals (Zero-Native Dialogs) */}
      <ConfirmRemoveModal
        isOpen={isRemoveModalOpen}
        item={item}
        onConfirm={handleConfirmRemove}
        onCancel={() => setIsRemoveModalOpen(false)}
      />

      {isRental && (
        <RentalDatePickerModal
          isOpen={isDatePickerModalOpen}
          item={item}
          onSave={handleSaveDates}
          onCancel={() => setIsDatePickerModalOpen(false)}
        />
      )}
    </>
  );
}
