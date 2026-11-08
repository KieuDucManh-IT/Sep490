/**
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-012
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-013
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-015
 * @ears .sdd/features/shopping-cart/SPEC.md#NFR-UX-01
 * Haute Couture Offcanvas Cart Drawer (Zero-Emoji, Zero-Native Dialogs)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, X, Trash2, Sparkles } from 'lucide-react';
import { useCartStore } from '../../../stores/useCartStore';
import CartItemCard from './CartItemCard';
import CartSummary from './CartSummary';
import ConfirmRemoveModal from './ConfirmRemoveModal';
import './CartDrawer.css';

export default function CartDrawer() {
  const navigate = useNavigate();
  const { items, isOpen, totalItemCount, closeCart, clearCart } = useCartStore();
  const [isConfirmClearOpen, setIsConfirmClearOpen] = useState(false);

  const hasItems = items && items.length > 0;

  const handleExploreCatalog = () => {
    closeCart();
    navigate('/catalog');
  };

  const handleConfirmClear = () => {
    clearCart();
    setIsConfirmClearOpen(false);
  };

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        className={`vestora-cart-drawer-overlay ${isOpen ? 'is-visible' : ''}`}
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Offcanvas Drawer */}
      <aside
        className={`vestora-cart-drawer ${isOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-label="Giỏ hàng thời trang Vestora"
        aria-modal="true"
      >
        {/* Drawer Header */}
        <div className="vestora-cart-drawer-header">
          <div className="vestora-cart-drawer-title-group">
            <h3 className="vestora-cart-drawer-title">Giỏ hàng</h3>
            <span className="vestora-cart-item-count-badge" data-testid="cart-badge-count">
              {totalItemCount} món
            </span>
          </div>

          <div className="vestora-cart-drawer-header-actions">
            {hasItems && (
              <button
                type="button"
                className="vestora-cart-btn-clear"
                onClick={() => setIsConfirmClearOpen(true)}
                title="Xóa tất cả sản phẩm"
                aria-label="Làm trống giỏ hàng"
              >
                <Trash2 size={13} />
                <span>Làm trống</span>
              </button>
            )}

            <button
              type="button"
              className="vestora-cart-drawer-close-btn"
              onClick={closeCart}
              aria-label="Đóng giỏ hàng"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="vestora-cart-drawer-body">
          {!hasItems ? (
            <div className="vestora-cart-empty-state" data-testid="cart-empty-state">
              <div className="vestora-cart-empty-icon-wrap">
                <ShoppingBag size={34} strokeWidth={1.5} />
              </div>
              <h4 className="vestora-cart-empty-title">Giỏ hàng đang trống</h4>
              <p className="vestora-cart-empty-text">
                Quý khách chưa chọn món đồ nào cho dịp đặc biệt sắp tới của mình.
              </p>
              <button
                type="button"
                className="vestora-cart-empty-cta"
                onClick={handleExploreCatalog}
              >
                <Sparkles size={16} />
                <span>Khám phá bộ sưu tập</span>
              </button>
            </div>
          ) : (
            <div className="vestora-cart-items-list" data-testid="cart-items-list">
              {items.map((item) => (
                <CartItemCard key={item.cartItemId} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        {hasItems && (
          <div className="vestora-cart-drawer-footer">
            <CartSummary />
          </div>
        )}
      </aside>

      {/* Modal xác nhận làm trống toàn bộ giỏ */}
      <ConfirmRemoveModal
        isOpen={isConfirmClearOpen}
        title="Làm trống giỏ hàng"
        message="Quý khách có chắc chắn muốn xóa toàn bộ sản phẩm đang có trong giỏ hàng?"
        onConfirm={handleConfirmClear}
        onCancel={() => setIsConfirmClearOpen(false)}
      />
    </>
  );
}
