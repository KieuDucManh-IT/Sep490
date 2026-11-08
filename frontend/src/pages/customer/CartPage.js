/**
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-001
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-012
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-013
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-016
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-017
 * @ears .sdd/features/shopping-cart/SPEC.md#REQ-CART-018
 * @ears .sdd/features/shopping-cart/SPEC.md#NFR-UX-01
 * Haute Couture Cart Page (Client-Side Reactive Cart)
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Trash2, Sparkles, ArrowLeft, Calendar, Package } from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useCartStore } from '../../stores/useCartStore';
import { ORDER_TYPES } from '../../services/cart/cartTypes';
import CartItemCard from '../../components/customer/cart/CartItemCard';
import CartSummary from '../../components/customer/cart/CartSummary';
import ConfirmRemoveModal from '../../components/customer/cart/ConfirmRemoveModal';
import '../../styles/Cart.css';

export default function CartPage() {
  const { items, totalItemCount, clearCart } = useCartStore();
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const hasItems = items && items.length > 0;
  const rentalItems = (items || []).filter((it) => it.orderType === ORDER_TYPES.RENTAL);
  const saleItems = (items || []).filter((it) => it.orderType === ORDER_TYPES.SALE);

  const handleConfirmClear = () => {
    clearCart();
    setIsClearModalOpen(false);
  };

  return (
    <div className="cart-page-container">
      <Navbar />

      {/* Page Header */}
      <div className="cart-header-hero">
        <div style={{ marginBottom: 12 }}>
          <Link
            to="/catalog"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#71717A',
              fontSize: '13px',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} />
            <span>Tiếp tục mua sắm</span>
          </Link>
        </div>

        <div className="cart-title-row">
          <h1 className="cart-main-title">Giỏ hàng thời trang</h1>
          <span className="cart-title-count">({totalItemCount} sản phẩm)</span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="cart-main-grid">
        {/* LEFT COLUMN: Cart Items Panel */}
        <div className="cart-items-panel">
          {!hasItems ? (
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '16px',
                border: '1px solid #E5E0D8',
                padding: '60px 24px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: '#FAF5EE',
                  border: '1px solid #E8DECF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '20px',
                  color: '#96723D',
                }}
              >
                <ShoppingBag size={38} strokeWidth={1.5} />
              </div>
              <h3
                style={{
                  fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
                  fontSize: '24px',
                  fontWeight: 600,
                  color: '#171717',
                  marginBottom: '10px',
                }}
              >
                Giỏ hàng của quý khách đang trống
              </h3>
              <p
                style={{
                  fontSize: '14px',
                  color: '#71717A',
                  maxWidth: '420px',
                  lineHeight: '1.6',
                  marginBottom: '28px',
                }}
              >
                Quý khách chưa lựa chọn bộ trang phục nào. Hãy khám phá các thiết kế thời
                trang cao cấp để bắt đầu thuê hoặc mua sắm.
              </p>
              <Link
                to="/catalog"
                style={{
                  padding: '12px 28px',
                  background: '#171717',
                  color: '#F8F7F4',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.2s',
                }}
              >
                <Sparkles size={16} />
                <span>Khám phá bộ sưu tập ngay</span>
              </Link>
            </div>
          ) : (
            <>
              {/* Action Bar */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '10px',
                  border: '1px solid #E5E0D8',
                  padding: '14px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#171717' }}>
                  Danh sách trang phục ({items.length} món độc lập)
                </span>

                <button
                  type="button"
                  onClick={() => setIsClearModalOpen(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#B91C1C',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  aria-label="Làm trống giỏ hàng"
                >
                  <Trash2 size={15} />
                  <span>Làm trống giỏ hàng</span>
                </button>
              </div>

              {/* Items List Split */}
              <div className="cart-items-list" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {rentalItems.length > 0 && (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                        padding: '8px 12px',
                        background: '#FAF5EE',
                        borderRadius: '8px',
                        border: '1px solid #E8DECF',
                        color: '#96723D',
                        fontWeight: 600,
                        fontSize: '14px',
                      }}
                    >
                      <Calendar size={18} />
                      <span>Trang phục cho thuê ({rentalItems.length} món)</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {rentalItems.map((item) => (
                        <CartItemCard key={item.cartItemId} item={item} />
                      ))}
                    </div>
                  </div>
                )}

                {saleItems.length > 0 && (
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                        padding: '8px 12px',
                        background: '#F4F4F5',
                        borderRadius: '8px',
                        border: '1px solid #E4E4E7',
                        color: '#18181B',
                        fontWeight: 600,
                        fontSize: '14px',
                      }}
                    >
                      <ShoppingBag size={18} />
                      <span>Sản phẩm mua đứt / thanh lý ({saleItems.length} món)</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {saleItems.map((item) => (
                        <CartItemCard key={item.cartItemId} item={item} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* RIGHT COLUMN: Order Summary */}
        {hasItems && (
          <div className="cart-summary-panel">
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E5E0D8',
                padding: '24px',
                position: 'sticky',
                top: '100px',
              }}
            >
              <h3
                style={{
                  fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#171717',
                  margin: '0 0 18px 0',
                  paddingBottom: '14px',
                  borderBottom: '1px solid #E5E0D8',
                }}
              >
                Tổng đơn hàng
              </h3>

              <CartSummary showViewCartLink={false} />
            </div>
          </div>
        )}
      </div>

      <Footer />

      {/* Modal xác nhận làm trống giỏ hàng */}
      <ConfirmRemoveModal
        isOpen={isClearModalOpen}
        title="Làm trống giỏ hàng"
        message="Quý khách có chắc chắn muốn bỏ toàn bộ các bộ trang phục ra khỏi giỏ hàng?"
        onConfirm={handleConfirmClear}
        onCancel={() => setIsClearModalOpen(false)}
      />
    </div>
  );
}
