/**
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-012
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-016
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-017
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-018
 * Haute Couture Cart Summary Component
 */

import React, { useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useCartStore } from '../../../stores/useCartStore';
import { ORDER_TYPES } from '../../../services/cart/cartTypes';
import { formatCurrencyVND } from '../../../services/cart/cartCalculations';
import { AuthContext } from '../../../context/AuthContext';
import './CartDrawer.css';

export default function CartSummary({ showViewCartLink = true, onAfterCheckoutClick }) {
  const navigate = useNavigate();
  const {
    items,
    rentalFeeSubtotal,
    depositSubtotal,
    saleSubtotal,
    grandTotal,
    closeCart,
  } = useCartStore();

  // Kiểm tra trạng thái đăng nhập
  const authState = useContext(AuthContext);
  const isAuthenticated = Boolean(authState?.user);

  const isCartEmpty = !items || items.length === 0;

  const hasRentalItems = (items || []).some((it) => it.orderType === ORDER_TYPES.RENTAL);
  const hasSaleItems = (items || []).some((it) => it.orderType === ORDER_TYPES.SALE);

  const navigateToCheckout = (targetUrl) => {
    if (isCartEmpty) return;

    if (onAfterCheckoutClick) {
      onAfterCheckoutClick();
    }
    closeCart();

    if (isAuthenticated) {
      navigate(targetUrl);
    } else {
      try {
        sessionStorage.setItem('vestora_return_url', targetUrl);
      } catch (e) {
        console.warn('SessionStorage unavailable:', e);
      }
      navigate('/login', { state: { from: targetUrl } });
    }
  };

  const handleRentalCheckout = () => navigateToCheckout('/checkout');
  const handleSaleCheckout = () => navigateToCheckout('/checkout/sale');

  return (
    <div className="vestora-cart-summary">
      {/* 4 financial lines */}
      <div className="vestora-cart-summary-line">
        <span>Phí thuê trang phục</span>
        <strong>{formatCurrencyVND(rentalFeeSubtotal)}</strong>
      </div>

      <div className="vestora-cart-summary-line">
        <div>
          <span>Tiền cọc bảo đảm</span>
          <span className="vestora-cart-summary-label-sub">
            (Được hoàn lại 100% khi hoàn trả nguyên vẹn)
          </span>
        </div>
        <strong style={{ color: '#96723D' }}>{formatCurrencyVND(depositSubtotal)}</strong>
      </div>

      <div className="vestora-cart-summary-line">
        <span>Tiền mua thanh lý</span>
        <strong>{formatCurrencyVND(saleSubtotal)}</strong>
      </div>

      <div className="vestora-cart-summary-line is-total">
        <span>Tổng thanh toán tạm tính</span>
        <strong style={{ fontSize: '18px' }}>{formatCurrencyVND(grandTotal)}</strong>
      </div>

      <div className="vestora-cart-summary-actions">
        {hasRentalItems && hasSaleItems ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            <button
              type="button"
              className="vestora-cart-btn-checkout"
              onClick={handleRentalCheckout}
              aria-label="Thanh toán đơn thuê"
            >
              <span>Thanh toán đơn thuê</span>
              <ArrowRight size={18} />
            </button>
            <button
              type="button"
              className="vestora-cart-btn-checkout"
              style={{
                backgroundColor: '#FAF5EE',
                color: '#96723D',
                border: '1px solid #C5A880',
              }}
              onClick={handleSaleCheckout}
              aria-label="Thanh toán đơn mua"
            >
              <span>Thanh toán đơn mua</span>
              <ShoppingBag size={18} />
            </button>
          </div>
        ) : hasSaleItems ? (
          <button
            type="button"
            className="vestora-cart-btn-checkout"
            onClick={handleSaleCheckout}
            disabled={isCartEmpty}
            aria-label="Tiến hành đặt mua"
          >
            <span>Tiến hành đặt mua</span>
            <ShoppingBag size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="vestora-cart-btn-checkout"
            onClick={handleRentalCheckout}
            disabled={isCartEmpty}
            aria-label="Tiến hành đặt thuê"
          >
            <span>Tiến hành đặt thuê</span>
            <ArrowRight size={18} />
          </button>
        )}

        {showViewCartLink && (
          <Link
            to="/cart"
            className="vestora-cart-btn-view-page"
            onClick={closeCart}
          >
            Xem giỏ hàng chi tiết
          </Link>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 8,
          fontSize: '11px',
          color: '#9CA3AF',
        }}
      >
        <ShieldCheck size={14} color="#96723D" />
        <span>Giao dịch bảo mật & Miễn phí đổi trả tại cửa hàng</span>
      </div>
    </div>
  );
}
