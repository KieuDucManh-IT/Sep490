import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import '../../styles/Cart.css';

export default function CartPage() {
  const navigate = useNavigate();
  const [promoCode, setPromoCode] = useState('VIPSPRING2025');
  const [promoApplied, setPromoApplied] = useState(true);

  const formatVND = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  return (
    <div className="cart-page-container">
      <Navbar />

      {/* Header Banner */}
      <div className="cart-header-hero">
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1px', color: '#666', marginBottom: '8px' }}>
          TRANG CHỦ • GIỎ HÀNG CỦA BẠN
        </div>
        <div style={{ background: '#FEF3C7', color: '#92400E', padding: '4px 12px', borderRadius: '9999px', display: 'inline-flex', fontSize: '11px', fontWeight: 600, gap: '6px', marginBottom: '12px' }}>
          🔒 BẢO CHỨNG ESCROW AN TOÀN TUYỆT ĐỐI
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '40px', margin: 0 }}>
            Giỏ Hàng Của Bạn <span style={{ fontSize: '24px', fontWeight: 400, color: '#666' }}>(3 sản phẩm)</span>
          </h1>
          <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
            ● Bảo lưu trạng thái kho trong: <strong>14:56</strong>
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="cart-main-grid">
        {/* Left Column: Cart Items */}
        <div className="cart-items-panel">
          {/* Select all bar */}
          <div className="cart-select-bar">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px' }} />
              <span>Chọn tất cả (3 sản phẩm)</span>
            </label>
            <button style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              🗑️ XÓA CÁC MỤC ĐÃ CHỌN
            </button>
          </div>

          {/* Cart Item 1 */}
          <div className="cart-item-card">
            <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px', marginTop: '4px' }} />
            <img
              src="https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=400&q=80"
              alt="Dress"
              className="cart-item-img"
            />

            <div className="cart-item-info">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', color: '#666', fontWeight: 600 }}>THANH LỊCH BOUTIQUE • TP.HCM</span>
                  <span className="item-mode-badge">📅 CHO THUÊ</span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '18px', margin: '0 0 6px 0' }}>
                  Đầm Dạ Hội Lụa Satin Midnight Xếp Nếp
                </h3>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  Kích cỡ: <strong>S (EO 64–68)</strong> • Màu sắc: <strong>Midnight Navy</strong>
                </div>
                <div style={{ fontSize: '12px', background: '#F5F3EF', padding: '6px 12px', borderRadius: '8px', display: 'inline-flex', gap: '12px', alignItems: 'center' }}>
                  <span>📅 Từ: <strong>15/04/2025</strong> → Đến: <strong>18/04/2025</strong> (3 Ngày)</span>
                  <button style={{ background: 'none', border: 'none', color: 'var(--color-gold-deep)', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}>
                    CHỈNH SỬA NGÀY THUÊ
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '16px' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-black)' }}>
                    1.050.000 đ <small style={{ fontSize: '11px', fontWeight: 400, color: '#666' }}>(350.000đ / ngày x 3)</small>
                  </div>
                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                    ✓ Cọc Escrow: 700.000 đ (Hoàn cọc 100%)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                  <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => navigate('/try-on-photo')}>
                    ✨ THỬ ĐỒ AI 3D LẠI
                  </button>
                  <button className="btn-secondary" style={{ padding: '6px 12px' }}>
                    ♡ LƯU YÊU THÍCH
                  </button>
                  <button style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer' }}>
                    XÓA
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cart Item 2 */}
          <div className="cart-item-card">
            <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px', marginTop: '4px' }} />
            <img
              src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80"
              alt="Suit"
              className="cart-item-img"
            />

            <div className="cart-item-info">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', color: '#666', fontWeight: 600 }}>MAISON DE LUXE • HÀ NỘI</span>
                  <span className="item-mode-badge">📅 CHO THUÊ</span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '18px', margin: '0 0 6px 0' }}>
                  Bộ Suit Nữ Tuxedo Cắt May Định Hình
                </h3>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  Kích cỡ: <strong>M (Vai 39, Vòng 2 70–74)</strong> • Màu sắc: <strong>Đen Noir</strong>
                </div>
                <div style={{ fontSize: '12px', background: '#F5F3EF', padding: '6px 12px', borderRadius: '8px', display: 'inline-flex', gap: '12px', alignItems: 'center' }}>
                  <span>📅 Từ: <strong>16/04/2025</strong> → Đến: <strong>18/04/2025</strong> (2 Ngày)</span>
                  <button style={{ background: 'none', border: 'none', color: 'var(--color-gold-deep)', fontWeight: 600, fontSize: '11px', cursor: 'pointer' }}>
                    CHỈNH SỬA NGÀY THUÊ
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '16px' }}>
                <div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-black)' }}>
                    700.000 đ <small style={{ fontSize: '11px', fontWeight: 400, color: '#666' }}>(350.000đ / ngày x 2)</small>
                  </div>
                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                    ✓ Cọc Escrow: 800.000 đ (Hoàn cọc 100%)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                  <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => navigate('/try-on-photo')}>
                    ✨ THỬ ĐỒ AI 3D LẠI
                  </button>
                  <button className="btn-secondary" style={{ padding: '6px 12px' }}>
                    ♡ LƯU YÊU THÍCH
                  </button>
                  <button style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer' }}>
                    XÓA
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cart Item 3: Resale */}
          <div className="cart-item-card">
            <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px', marginTop: '4px' }} />
            <img
              src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80"
              alt="Jacket"
              className="cart-item-img"
            />

            <div className="cart-item-info">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '10px', color: '#666', fontWeight: 600 }}>ARCHIVE STUDIO • HÀ NỘI</span>
                  <span style={{ background: '#ECFDF5', color: '#059669', fontSize: '10px', fontWeight: 700, padding: '3px 10px', borderRadius: '9999px' }}>
                    🏷️ THANH LÝ SỞ HỮU
                  </span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '18px', margin: '0 0 6px 0' }}>
                  Áo Khoác Tweed Dệt Thủ Công Đính Cúc Ngọc Trai
                </h3>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                  Kích cỡ: <strong>S</strong> • Màu: <strong>Kem Ivory</strong> • <span style={{ color: '#059669', fontWeight: 600 }}>Mới 100% Nguyên Tag</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-black)' }}>800.000 đ</span>
                    <span style={{ fontSize: '12px', textDecoration: 'line-through', color: '#9CA3AF' }}>2.650.000 đ</span>
                    <span style={{ fontSize: '10px', background: '#FEE2E2', color: '#DC2626', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>-70% Gốc</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600, marginTop: '2px' }}>
                    ✓ Cọc bảo đảm: Miễn phí (Mua sở hữu luôn)
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', fontSize: '11px' }}>
                  <button className="btn-secondary" style={{ padding: '6px 12px' }} onClick={() => navigate('/try-on-photo')}>
                    ✨ THỬ ĐỒ AI 3D LẠI
                  </button>
                  <button style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer' }}>
                    XÓA
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery guarantee banner */}
          <div style={{ background: '#F5F3EF', borderRadius: '20px', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
              <span style={{ fontSize: '24px' }}>🚚</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Giao hàng chuẩn bảo quản chuyên dụng miễn phí</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Đơn hàng đủ điều kiện vận chuyển vali 2 chiều chuẩn Haute Couture.</div>
              </div>
            </div>
            <span style={{ background: '#059669', color: '#FFF', fontSize: '11px', fontWeight: 700, padding: '6px 14px', borderRadius: '9999px' }}>
              ĐÃ KÍCH HOẠT
            </span>
          </div>
        </div>

        {/* Right Column: Order Summary & Checkout */}
        <div>
          <div className="order-summary-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', margin: 0 }}>TÓM TẮT ĐƠN HÀNG</h3>
              <span style={{ fontSize: '11px', background: '#F3F4F6', padding: '4px 10px', borderRadius: '9999px', fontWeight: 600 }}>3 MÓN</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="summary-row">
                <span>Tiền thuê trang phục (2 món):</span>
                <strong style={{ color: '#000' }}>1.750.000 đ</strong>
              </div>
              <div className="summary-row">
                <span>Tiền mua đồ thanh lý (1 món):</span>
                <strong style={{ color: '#000' }}>800.000 đ</strong>
              </div>
              <div className="summary-row" style={{ background: '#ECFDF5', padding: '10px', borderRadius: '10px', color: '#059669' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>🔒 Tiền cọc PayOS Escrow (hoàn trả 100%):</div>
                  <div style={{ fontSize: '10px', opacity: 0.8 }}>(Đầm dạ hội: 700K + Tuxedo suit: 800K)</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ fontSize: '14px' }}>1.500.000 đ</strong>
                  <div style={{ fontSize: '10px' }}>Hoàn tiền 24h</div>
                </div>
              </div>
              <div className="summary-row">
                <span>Phí giặt hấp chuyên sâu IFAB:</span>
                <strong style={{ color: '#059669' }}>MIỄN PHÍ</strong>
              </div>
              <div className="summary-row">
                <span>Vận chuyển vali bảo quản 2 chiều:</span>
                <strong style={{ color: '#059669' }}>MIỄN PHÍ</strong>
              </div>
            </div>

            {/* Promo Code Box */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Mã ưu đãi..."
                style={{ flex: 1, padding: '10px 14px', borderRadius: '9999px', border: '1px solid var(--color-border)', outline: 'none', fontSize: '12px' }}
              />
              <button
                className="btn-primary"
                style={{ fontSize: '11px', padding: '10px 18px' }}
                onClick={() => setPromoApplied(true)}
              >
                ÁP DỤNG
              </button>
            </div>
            {promoApplied && (
              <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                ✓ Đã giảm thêm 500.000đ cho thành viên VIP Privé
              </div>
            )}

            {/* Total */}
            <div className="summary-row total">
              <div>
                <div>Tổng Thanh Toán:</div>
                <div style={{ fontSize: '10px', color: '#666', fontWeight: 400 }}>(Đã bao gồm VAT & toàn bộ dịch vụ)</div>
              </div>
              <div className="total-amount-display">{formatVND(4050000)}</div>
            </div>

            {/* Checkout Button */}
            <button
              className="btn-primary"
              style={{ width: '100%', padding: '16px', fontSize: '14px', letterSpacing: '1.5px' }}
              onClick={() => alert('Đang kết nối cổng thanh toán bảo chứng PayOS Escrow...')}
            >
              TIẾN HÀNH THANH TOÁN ➔
            </button>

            {/* Payment methods */}
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#666' }}>
              PHƯƠNG THỨC THANH TOÁN KÝ QUỸ TỨC THÌ
              <div style={{ display: 'flex', justifyCenter: 'center', gap: '10px', marginTop: '8px' }}>
                <span style={{ background: '#F3F4F6', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>PayOS Escrow</span>
                <span style={{ background: '#F3F4F6', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>VietQR PRO</span>
                <span style={{ background: '#F3F4F6', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>Visa/Master</span>
                <span style={{ background: '#F3F4F6', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>Apple Pay</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

