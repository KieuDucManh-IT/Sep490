import CheckoutBranchPicker from '../../components/customer/cart/CheckoutBranchPicker';
import { quoteCheckout, groupCheckoutItems, submitCheckoutGroups, checkoutFingerprint } from '../../services/cart/checkoutFlow';
/**
 * Sale Checkout Page — Dedicated Purchase Flow for Vestora
 * Haute Couture design tokens, zero native dialogs, zero emoji, zero axios.
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Wallet,
  Banknote,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Package,
  ShoppingBag,
  Loader2,
  Truck,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import HauteCoutureModal from '../../components/HauteCoutureModal';
import GhnAddressSelector from '../../components/common/GhnAddressSelector';
import { useCartStore } from '../../stores/useCartStore';
import { ORDER_TYPES } from '../../services/cart/cartTypes';
import { formatCurrencyVND } from '../../services/cart/cartCalculations';
import { createSalesOrder } from '../../services/salesOrderApi';
import { walletRequest } from '../../services/walletApi';
import '../../styles/Cart.css';

export default function SaleCheckoutPage() {
  const navigate = useNavigate();
  const submissionLock = useRef(false);
  const [createdOrders, setCreatedOrders] = useState([]);
  const { items, removeItems } = useCartStore();

  // Danh sách các sản phẩm mua đứt
  const saleItems = useMemo(
    () => (items || []).filter((it) => it.orderType === ORDER_TYPES.SALE),
    [items]
  );
  const rentalItems = useMemo(
    () => (items || []).filter((it) => it.orderType === ORDER_TYPES.RENTAL),
    [items]
  );
  const hasSaleItems = saleItems.length > 0;
  const hasRentalItems = rentalItems.length > 0;

  // Lấy chi nhánh mặc định từ các sản phẩm mua
  const resolvingBranch = false;
  const branchRows = [...new Map(saleItems.filter(it => it.selectedBranch?.locationId).map(it => [it.selectedBranch.locationId, it.selectedBranch])).values()];
  const resolvedBranchInfo = { name: branchRows.map(b => b.name).join(', ') || 'Chưa chọn chi nhánh', address: branchRows.map(b => b.address).filter(Boolean).join('; ') };

  // Thông tin ví người dùng
  const [walletBalance, setWalletBalance] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(true);

  // Biểu mẫu giao hàng
  const [shippingAddress, setShippingAddress] = useState({
    receiverName: '',
    phone: '',
    street: '',
    ward: '',
    district: '',
    city: '',
    provinceId: null,
    districtId: null,
    wardCode: '',
  });

  const handleDivisionsChange = useCallback((divisionData) => {
    setShippingAddress((prev) => ({
      ...prev,
      provinceId: divisionData.provinceId,
      city: divisionData.city,
      districtId: divisionData.districtId,
      district: divisionData.district,
      wardCode: divisionData.wardCode,
      ward: divisionData.ward,
    }));
  }, []);

  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'wallet' | 'cod'

  // Trạng thái submit
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [successOrder, setSuccessOrder] = useState(null);

  // Tính tổng tiền mua
  const saleSubtotal = useMemo(() => {
    return saleItems.reduce((acc, it) => {
      const price = Number(it.salePrice) || 0;
      const qty = Math.max(1, Number(it.quantity) || 1);
      return acc + price * qty;
    }, 0);
  }, [saleItems]);

  const shippingFee = 0; // Miễn phí vận chuyển theo chính sách hiện hành
  const grandTotal = saleSubtotal + shippingFee;

  // Tải số dư ví
  useEffect(() => {
    let isMounted = true;
    async function loadWallet() {
      try {
        setLoadingWallet(true);
        const data = await walletRequest('');
        if (isMounted && data?.wallet) {
          setWalletBalance(Number(data.wallet.availableBalance ?? data.wallet.available) || 0);
        }
      } catch (err) {
        console.warn('Không thể tải số dư ví:', err.message);
      } finally {
        if (isMounted) setLoadingWallet(false);
      }
    }
    loadWallet();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleInputChange = (field, value) => {
    setShippingAddress((prev) => ({ ...prev, [field]: value }));
  };

  const isWalletInsufficient =
    paymentMethod === 'wallet' &&
    walletBalance !== null &&
    walletBalance < grandTotal;

  // Xác thực tính hợp lệ của từng sản phẩm và chi nhánh
  const validateItems = useCallback(() => {
    for (const item of saleItems) {
      if (!item.variantId || !/^[0-9a-fA-F]{24}$/.test(String(item.variantId))) {
        return `Biến thể của sản phẩm "${item.name}" chưa hợp lệ. Vui lòng chọn lại sản phẩm vào giỏ hàng.`;
      }
      const locId = item.selectedBranch?.locationId;
      if (!locId || !/^[0-9a-fA-F]{24}$/.test(String(locId))) {
        return `Sản phẩm "${item.name}" chưa xác định được chi nhánh khả dụng. Vui lòng thử lại sau giây lát.`;
      }
      const qty = Number(item.quantity);
      if (Number.isNaN(qty) || qty < 1) {
        return `Số lượng mua của sản phẩm "${item.name}" không hợp lệ.`;
      }
    }
    return '';
  }, [saleItems]);

  // Xử lý gửi đơn mua hàng
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (submissionLock.current) return;
    setValidationError('');
    setSubmitError('');

    if (!hasSaleItems) return;

    const itemError = validateItems();
    if (itemError) {
      setValidationError(itemError);
      return;
    }

    if (!shippingAddress.receiverName.trim()) {
      setValidationError('Vui lòng nhập họ và tên người nhận hàng');
      return;
    }
    if (!shippingAddress.phone.trim()) {
      setValidationError('Vui lòng nhập số điện thoại người nhận');
      return;
    }
    if (!shippingAddress.provinceId) {
      setValidationError('Vui lòng chọn Tỉnh / Thành phố nhận hàng');
      return;
    }
    if (!shippingAddress.districtId) {
      setValidationError('Vui lòng chọn Quận / Huyện nhận hàng');
      return;
    }
    if (!shippingAddress.wardCode) {
      setValidationError('Vui lòng chọn Phường / Xã nhận hàng');
      return;
    }
    if (!shippingAddress.street.trim()) {
      setValidationError('Vui lòng nhập số nhà, tên đường chi tiết');
      return;
    }

    submissionLock.current = true;
    setSubmitting(true);

    try {
      const snapshot = saleItems;
      const fingerprint = checkoutFingerprint(snapshot);
      const quote = await quoteCheckout(snapshot);
      const ids = new Set(snapshot.map(it => it.cartItemId));
      const current = useCartStore.getState().items.filter(it => ids.has(it.cartItemId));
      if (checkoutFingerprint(current) !== fingerprint) throw new Error('Giỏ hàng đã thay đổi. Vui lòng kiểm tra và xác nhận lại.');
      useCartStore.getState().applyQuote(quote.rows);
      if (!quote.valid) { setValidationError(quote.errors.join(' ')); return; }
      if (quote.changed) { setValidationError('Giá đã cập nhật. Vui lòng kiểm tra tổng tiền mới và bấm đặt hàng lần nữa để xác nhận.'); return; }
      const orders = await submitCheckoutGroups(groupCheckoutItems(snapshot), async (group) => {
        const payload = {
          locationId: String(group.locationId),
          expectedTotalAmount: group.items.reduce((sum, it) => { const price = quote.rows.find(row => row.cartItemId === it.cartItemId).authoritative; return sum + price.lineTotal + price.lineDeposit; }, 0),
          items: group.items.map((it) => ({
            variantId: String(it.variantId),
            quantity: Math.max(1, Number(it.quantity) || 1),
            ...(it.note ? { note: it.note } : {}),
          })),
          paymentMethod,
          shippingAddress: {
            receiverName: shippingAddress.receiverName.trim(),
            phone: shippingAddress.phone.trim(),
            street: shippingAddress.street.trim(),
            ward: shippingAddress.ward.trim(),
            district: shippingAddress.district.trim(),
            city: shippingAddress.city.trim(),
            provinceId: shippingAddress.provinceId ? Number(shippingAddress.provinceId) : null,
            districtId: shippingAddress.districtId ? Number(shippingAddress.districtId) : null,
            wardCode: shippingAddress.wardCode ? String(shippingAddress.wardCode).trim() : null,
          },
          ...(note.trim() ? { note: note.trim() } : {}),
        };
        return createSalesOrder(payload);
      }, (group, order) => {
        removeItems(group.items.map(it => it.cartItemId));
        setCreatedOrders(previous => [...previous, order]);
      });
      setSuccessOrder(orders[orders.length - 1]);
    } catch (err) {
      // TASK-010: hết hàng khi giữ chỗ (409 ERR_OUT_OF_STOCK) — message dạng "Sản phẩm … chỉ còn N."
      setSubmitError((err.code || err.data?.code) === 'ERR_OUT_OF_STOCK'
        ? `${err.message} Vui lòng giảm số lượng hoặc chọn chi nhánh khác.`
        : (err.message || 'Đặt mua thất bại. Vui lòng thử lại.'));
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      {createdOrders.length > 0 && <p className="cart-checkout-progress" role="status">Đã tạo thành công: {createdOrders.map(order => order.orderCode || order._id).join(', ')}. Các sản phẩm tương ứng đã được bỏ khỏi giỏ.</p>}

      {/* Embedded CSS for responsive 2-column layout */}
      <style>{`
        .sale-checkout-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          gap: 32px;
          align-items: start;
        }
        @media (max-width: 992px) {
          .sale-checkout-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }
        .sale-checkout-input:focus {
          border-color: #C5A880 !important;
          box-shadow: 0 0 0 3px rgba(197, 168, 128, 0.15) !important;
        }
        .sale-checkout-btn-submit:hover:not(:disabled) {
          background-color: #C5A880 !important;
          transform: translateY(-1px);
        }
      `}</style>

      {/* Page Header */}
      <div style={styles.headerHero}>
        <div style={{ marginBottom: 12 }}>
          <Link to="/cart" style={styles.backLink}>
            <ArrowLeft size={16} />
            <span>Quay lại giỏ hàng</span>
          </Link>
        </div>

        <div style={styles.titleRow}>
          <h1 style={styles.mainTitle}>Xác nhận đơn mua hàng</h1>
        </div>
        <p style={{ margin: '6px 0 0 0', fontSize: 14, color: '#71717A' }}>
          Kiểm tra thông tin giao hàng và xác nhận mua trang phục cao cấp từ Vestora
        </p>
      </div>

      <main style={styles.mainContainer}>
        {!hasSaleItems ? (
          <div style={styles.emptyCard}>
            <div style={styles.emptyIconWrap}>
              <ShoppingBag size={38} strokeWidth={1.5} />
            </div>
            <h3 style={styles.emptyTitle}>
              Không có sản phẩm mua đứt nào trong giỏ hàng
            </h3>
            <p style={styles.emptyText}>
              Quý khách hiện chưa chọn sản phẩm mua hoặc giỏ hàng đang trống.
            </p>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link to="/catalog" style={styles.primaryButton}>
                <Package size={16} />
                <span>Khám phá bộ sưu tập mua</span>
              </Link>

              {hasRentalItems && (
                <Link to="/checkout" style={styles.secondaryButton}>
                  <Sparkles size={16} />
                  <span>Chuyển sang thanh toán đơn thuê ({rentalItems.length} món)</span>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmitOrder}>
            <CheckoutBranchPicker items={saleItems} disabled={submitting} />
            {/* Rental items banner notice if cart also has rental items */}
            {hasRentalItems && (
              <div style={styles.infoBanner}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1, color: '#D97706' }} />
                <span>
                  Giỏ hàng của bạn còn có <strong>{rentalItems.length} sản phẩm thuê</strong>.{' '}
                  <Link
                    to="/checkout"
                    style={{ color: '#96723D', fontWeight: 600, textDecoration: 'underline' }}
                  >
                    Bấm vào đây để hoàn tất thanh toán đơn thuê
                  </Link>
                  .
                </span>
              </div>
            )}

            <div className="sale-checkout-grid">
              {/* ========================================================
                  CỘT TRÁI (1.4fr): SẢN PHẨM, ĐỊA CHỈ & PHƯƠNG THỨC THANH TOÁN
                  ======================================================== */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* 1. Danh sách sản phẩm mua đứt */}
                <div style={styles.card}>
                  <h3 style={styles.sectionTitle}>
                    <Package size={18} style={{ color: '#C5A880' }} />
                    Danh sách sản phẩm mua ({saleItems.length} sản phẩm)
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {saleItems.map((item, idx) => {
                      const isLast = idx === saleItems.length - 1;
                      const itemTotal = (Number(item.salePrice) || 0) * (Number(item.quantity) || 1);
                      return (
                        <div
                          key={item.cartItemId || idx}
                          style={{
                            ...styles.itemRow,
                            ...(isLast ? { borderBottom: 'none' } : {}),
                          }}
                        >
                          <img
                            src={item.thumbnailImage || '/placeholder-dress.jpg'}
                            alt={item.name}
                            style={styles.itemImage}
                          />

                          <div style={styles.itemDetails}>
                            <p style={styles.itemName}>{item.name}</p>

                            <div style={styles.itemMeta}>
                              {[item.size ? `Size: ${item.size}` : '', item.color ? `Màu: ${item.color}` : '']
                                .filter(Boolean)
                                .join(' | ')}
                              {' '}&bull;{' '}
                              <span style={{ fontWeight: 600, color: '#18181B' }}>
                                Số lượng: {item.quantity || 1}
                              </span>
                            </div>

                            {item.selectedBranch?.name && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: '#71717A',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  marginTop: 2,
                                }}
                              >
                                <MapPin size={12} style={{ color: '#C5A880' }} />
                                <span>Kho xuất: {item.selectedBranch.name}</span>
                              </div>
                            )}
                          </div>

                          <div style={styles.itemPrice}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: '#18181B' }}>
                              {formatCurrencyVND(itemTotal)}
                            </div>
                            {item.quantity > 1 && (
                              <div style={{ fontSize: 11.5, color: '#71717A', marginTop: 2 }}>
                                {formatCurrencyVND(item.salePrice)} / cái
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Địa chỉ nhận hàng */}
                <div style={styles.card}>
                  <h3 style={styles.sectionTitle}>
                    <MapPin size={18} style={{ color: '#C5A880' }} />
                    Địa chỉ nhận hàng
                  </h3>
                  <p style={{ fontSize: 13, color: '#71717A', margin: '-8px 0 16px 0' }}>
                    Vestora sẽ giao hàng tiêu chuẩn tận nơi theo địa chỉ này.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                      <div>
                        <label style={styles.label}>Họ và tên người nhận *</label>
                        <input
                          type="text"
                          required
                          value={shippingAddress.receiverName}
                          onChange={(e) => handleInputChange('receiverName', e.target.value)}
                          placeholder="Ví dụ: Nguyễn Văn A"
                          className="sale-checkout-input"
                          style={styles.input}
                        />
                      </div>

                      <div>
                        <label style={styles.label}>Số điện thoại liên hệ *</label>
                        <input
                          type="tel"
                          required
                          value={shippingAddress.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          placeholder="Ví dụ: 0912 345 678"
                          className="sale-checkout-input"
                          style={styles.input}
                        />
                      </div>
                    </div>

                    <GhnAddressSelector
                      provinceId={shippingAddress.provinceId}
                      districtId={shippingAddress.districtId}
                      wardCode={shippingAddress.wardCode}
                      onChange={handleDivisionsChange}
                      required
                    />

                    <div>
                      <label style={styles.label}>Số nhà, tên đường chi tiết *</label>
                      <input
                        type="text"
                        required
                        value={shippingAddress.street}
                        onChange={(e) => handleInputChange('street', e.target.value)}
                        placeholder="Ví dụ: Số 72 Lê Thánh Tôn"
                        className="sale-checkout-input"
                        style={styles.input}
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Phương thức thanh toán */}
                <div style={styles.card}>
                  <h3 style={styles.sectionTitle}>
                    <Wallet size={18} style={{ color: '#C5A880' }} />
                    Phương thức thanh toán
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* COD Option */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: 16,
                        borderRadius: 10,
                        border: paymentMethod === 'cod' ? '2px solid #C5A880' : '1px solid #E5E0D8',
                        background: paymentMethod === 'cod' ? '#FAF5EE' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cod"
                        checked={paymentMethod === 'cod'}
                        onChange={() => setPaymentMethod('cod')}
                        style={{ marginTop: 4, accentColor: '#96723D' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <Banknote size={18} color="#96723D" />
                          <strong style={{ fontSize: 14.5, color: '#171717' }}>
                            Thanh toán khi nhận hàng (COD)
                          </strong>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: '#71717A', lineHeight: 1.5 }}>
                          Quý khách thanh toán tiền mặt trực tiếp cho nhân viên giao hàng khi nhận và kiểm tra kiện hàng.
                        </p>
                      </div>
                    </label>

                    {/* Wallet Option */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: 16,
                        borderRadius: 10,
                        border: paymentMethod === 'wallet' ? '2px solid #C5A880' : '1px solid #E5E0D8',
                        background: paymentMethod === 'wallet' ? '#FAF5EE' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="wallet"
                        checked={paymentMethod === 'wallet'}
                        onChange={() => setPaymentMethod('wallet')}
                        style={{ marginTop: 4, accentColor: '#96723D' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Wallet size={18} color="#96723D" />
                            <strong style={{ fontSize: 14.5, color: '#171717' }}>
                              Ví nội bộ Vestora
                            </strong>
                          </div>

                          <div style={{ fontSize: 13, fontWeight: 600, color: '#96723D' }}>
                            {loadingWallet
                              ? 'Đang kiểm tra ví...'
                              : `Số dư: ${formatCurrencyVND(walletBalance || 0)}`}
                          </div>
                        </div>

                        <p style={{ margin: 0, fontSize: 13, color: '#71717A', lineHeight: 1.5 }}>
                          Khấu trừ trực tiếp từ số dư khả dụng trong ví Vestora. Giao dịch tức thì, bảo mật tuyệt đối.
                        </p>

                        {isWalletInsufficient && (
                          <div style={styles.walletAlert}>
                            <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                            <span>
                              Số dư ví không đủ. Quý khách vui lòng{' '}
                              <Link to="/wallet" target="_blank" style={{ color: '#B91C1C', fontWeight: 600, textDecoration: 'underline' }}>
                                nạp thêm tiền
                              </Link>{' '}
                              hoặc chuyển sang thanh toán COD.
                            </span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* ========================================================
                  CỘT PHẢI (1fr): TÓM TẮT ĐƠN HÀNG & NÚT ĐẶT MUA
                  ======================================================== */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={styles.stickyCard}>
                  <h3 style={styles.sectionTitle}>
                    Thông tin đơn mua
                  </h3>

                  {/* Branch info */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={styles.label}>
                      <MapPin size={14} style={{ color: '#C5A880' }} />
                      Chi nhánh xuất kho
                    </label>
                    {resolvingBranch ? (
                      <div style={styles.resolvingBranchBox}>
                        <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Đang xác định chi nhánh khả dụng...</span>
                      </div>
                    ) : (
                      <div style={styles.branchBox}>
                        <MapPin size={15} style={{ color: '#C5A880', flexShrink: 0, marginTop: 1 }} />
                        <div>
                          <div style={{ fontWeight: 600, color: '#171717', fontSize: 13.5 }}>
                            {resolvedBranchInfo?.name || 'Chi nhánh Vestora'}
                          </div>
                          {resolvedBranchInfo?.address && (
                            <div style={{ fontSize: 12, color: '#71717A', marginTop: 2 }}>
                              {resolvedBranchInfo.address}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Shipping method badge */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={styles.label}>
                      <Truck size={14} style={{ color: '#C5A880' }} />
                      Phương thức vận chuyển
                    </label>
                    <div style={styles.shippingBadge}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#171717', fontSize: 13 }}>
                        <Clock size={14} color="#96723D" />
                        <span>Giao hàng tiêu chuẩn (1 - 3 ngày)</span>
                      </div>
                      <span style={{ fontSize: 12.5, color: '#16A34A', fontWeight: 600 }}>Miễn phí</span>
                    </div>
                  </div>

                  {/* Order Note */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={styles.label}>
                      <FileText size={14} style={{ color: '#C5A880' }} />
                      Ghi chú đơn hàng (Tuỳ chọn)
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Giao giờ hành chính, gọi trước..."
                      className="sale-checkout-input"
                      style={styles.input}
                    />
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: '1px solid #E5E0D8', margin: '0 0 16px 0' }} />

                  {/* Financial Breakdown */}
                  <div style={styles.summaryRow}>
                    <span>Tiền hàng ({saleItems.length} sản phẩm)</span>
                    <strong style={{ color: '#18181B' }}>{formatCurrencyVND(saleSubtotal)}</strong>
                  </div>

                  <div style={styles.summaryRow}>
                    <span>Phí vận chuyển</span>
                    <strong style={{ color: '#16A34A' }}>Miễn phí</strong>
                  </div>

                  <div style={styles.summaryTotal}>
                    <span style={styles.totalLabel}>Tổng thanh toán</span>
                    <span style={styles.totalAmount}>{formatCurrencyVND(grandTotal)}</span>
                  </div>

                  {/* Validation Error */}
                  {validationError && (
                    <div style={styles.errorBox}>
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1, color: '#DC2626' }} />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {/* Submit Error */}
                  {submitError && (
                    <div style={styles.errorBox}>
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1, color: '#DC2626' }} />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="sale-checkout-btn-submit"
                    style={{
                      ...styles.submitButton,
                      ...(submitting ? styles.submitButtonDisabled : {}),
                    }}
                    aria-label="Xác nhận Đặt Mua Hàng"
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Đang xử lý đơn mua...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={18} />
                        <span>Xác nhận Đặt Mua Hàng</span>
                      </>
                    )}
                  </button>

                  {/* Trust badges */}
                  <div style={styles.trustGroup}>
                    <div style={styles.trustLine}>
                      <ShieldCheck size={13} color="#C5A880" />
                      <span>Thanh toán an toàn & bảo mật tuyệt đối</span>
                    </div>
                    <div style={styles.trustLine}>
                      <CheckCircle2 size={13} color="#C5A880" />
                      <span>Kiểm tra hàng trước khi thanh toán (COD)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>

      {/* MODAL XÁC NHẬN ĐƠN MUA THÀNH CÔNG (HAUTE COUTURE) */}
      <HauteCoutureModal
        isOpen={Boolean(successOrder)}
        onClose={() => navigate('/catalog')}
        title="Đặt Mua Thành Công"
        subtitle={`Mã đơn hàng: ${successOrder?.orderCode || ''}`}
      >
        <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
          <div style={styles.successIconWrap}>
            <CheckCircle2 size={36} color="#16A34A" />
          </div>

          <p style={{ fontSize: 14, color: '#52525B', lineHeight: 1.6, marginBottom: 20 }}>
            Cảm ơn quý khách đã tin tưởng và mua sắm tại <strong>Vestora</strong>.
            {successOrder?.paymentMethod === 'wallet' ? (
              <span> Đơn hàng đã được thanh toán thành công qua Ví nội bộ Vestora.</span>
            ) : (
              <span> Đơn hàng sẽ được giao đến địa chỉ của quý khách và thanh toán tiền mặt khi nhận hàng (COD).</span>
            )}
          </p>

          <div style={styles.successTotalCard}>
            <span style={{ fontSize: 13, color: '#71717A' }}>Tổng số tiền thanh toán:</span>
            <strong style={{ fontSize: 18, color: '#96723D' }}>
              {formatCurrencyVND(successOrder?.totalAmount || grandTotal)}
            </strong>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => navigate('/rental-orders?tab=sale')}
              style={styles.modalSecondaryBtn}
            >
              Xem đơn mua của tôi
            </button>

            <button
              type="button"
              onClick={() => navigate('/catalog')}
              style={styles.modalPrimaryBtn}
            >
              Tiếp tục mua sắm
            </button>
          </div>
        </div>
      </HauteCoutureModal>

      <Footer />
    </div>
  );
}

// ========================================================
// HAUTE COUTURE LUXURY DESIGN STYLES OBJECT
// ========================================================
const styles = {
  pageContainer: {
    backgroundColor: '#FAF9F6',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: '#27272A',
  },
  headerHero: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '32px 24px 16px 24px',
    width: '100%',
    boxSizing: 'border-box',
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: '#71717A',
    fontSize: 13,
    textDecoration: 'none',
    fontWeight: 500,
    transition: 'color 0.15s ease',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 12,
  },
  mainTitle: {
    fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
    fontSize: 32,
    fontWeight: 600,
    color: '#18181B',
    margin: 0,
    letterSpacing: '-0.3px',
  },
  mainContainer: {
    maxWidth: 1200,
    margin: '16px auto 60px auto',
    padding: '0 24px',
    width: '100%',
    boxSizing: 'border-box',
  },
  card: {
    background: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid #E5E0D8',
    padding: 24,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
  },
  stickyCard: {
    background: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid #E5E0D8',
    padding: 24,
    position: 'sticky',
    top: 90,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
  },
  sectionTitle: {
    fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
    fontSize: 20,
    fontWeight: 600,
    color: '#171717',
    margin: '0 0 18px 0',
    paddingBottom: 14,
    borderBottom: '1px solid #E5E0D8',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  itemRow: {
    display: 'flex',
    gap: 14,
    padding: '16px 0',
    borderBottom: '1px solid #F4F4F5',
    alignItems: 'center',
  },
  itemImage: {
    width: 68,
    height: 84,
    borderRadius: 10,
    objectFit: 'cover',
    background: '#F4F4F5',
    flexShrink: 0,
    border: '1px solid #E5E0D8',
  },
  itemDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  itemName: {
    fontSize: 14.5,
    fontWeight: 600,
    color: '#18181B',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  itemMeta: {
    fontSize: 12.5,
    color: '#71717A',
  },
  itemPrice: {
    textAlign: 'right',
    flexShrink: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#3F3F46',
    marginBottom: 8,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #D4D4D8',
    fontSize: 13.5,
    color: '#18181B',
    outline: 'none',
    background: '#FFFFFF',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  },
  branchBox: {
    background: '#F8F7F4',
    border: '1px solid #E5E0D8',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  resolvingBranchBox: {
    fontSize: 13,
    color: '#71717A',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 0',
  },
  shippingBadge: {
    background: '#FAF5EE',
    border: '1px solid #E8DECF',
    borderRadius: 10,
    padding: '10px 14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  walletAlert: {
    marginTop: 10,
    padding: '8px 12px',
    background: '#FEF2F2',
    borderRadius: 6,
    border: '1px solid #FCA5A5',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 1.4,
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13.5,
    color: '#3F3F46',
    padding: '6px 0',
  },
  summaryTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1.5px dashed #E5E0D8',
    paddingTop: 14,
    marginTop: 10,
  },
  totalLabel: {
    fontSize: 14.5,
    fontWeight: 600,
    color: '#171717',
  },
  totalAmount: {
    fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
    fontSize: 24,
    fontWeight: 700,
    color: '#96723D',
    letterSpacing: '-0.4px',
  },
  errorBox: {
    background: '#FEF2F2',
    border: '1px solid #FECACA',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 1.5,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 14,
  },
  submitButton: {
    width: '100%',
    height: 50,
    background: '#171717',
    color: '#F8F7F4',
    border: 'none',
    borderRadius: 12,
    fontSize: 14.5,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 14px rgba(23, 23, 23, 0.18)',
  },
  submitButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  trustGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 16,
    paddingTop: 12,
    borderTop: '1px solid #F4F4F5',
  },
  trustLine: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontSize: 11.5,
    color: '#71717A',
  },
  infoBanner: {
    background: '#FFFBEB',
    border: '1px solid #FDE68A',
    borderRadius: 12,
    padding: '14px 18px',
    fontSize: 13.5,
    color: '#92400E',
    lineHeight: 1.6,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 20,
  },
  emptyCard: {
    background: '#FFFFFF',
    borderRadius: 16,
    border: '1px solid #E5E0D8',
    padding: '60px 24px',
    textAlign: 'center',
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: '#FAF5EE',
    border: '1px solid #E8DECF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px auto',
    color: '#96723D',
  },
  emptyTitle: {
    fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
    fontSize: 22,
    fontWeight: 600,
    color: '#171717',
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#71717A',
    marginBottom: 24,
  },
  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    background: '#171717',
    color: '#FAF9F6',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 14,
    transition: 'background 0.15s ease',
  },
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 24px',
    background: '#FAF5EE',
    color: '#96723D',
    border: '1px solid #C5A880',
    borderRadius: 8,
    textDecoration: 'none',
    fontWeight: 600,
    fontSize: 14,
    transition: 'all 0.15s ease',
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#F0FDF4',
    border: '1px solid #BBF7D0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px auto',
  },
  successTotalCard: {
    background: '#FAF5EE',
    borderRadius: 8,
    border: '1px solid #E8DECF',
    padding: '12px 16px',
    marginBottom: 24,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalSecondaryBtn: {
    flex: 1,
    padding: '12px',
    background: '#FAF5EE',
    color: '#96723D',
    border: '1px solid #C5A880',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalPrimaryBtn: {
    flex: 1,
    padding: '12px',
    background: '#171717',
    color: '#FAF9F6',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
