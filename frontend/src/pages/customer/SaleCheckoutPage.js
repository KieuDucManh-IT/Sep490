/**
 * Sale Checkout Page — Dedicated Purchase Flow for Vestora
 * Haute Couture design tokens, zero native dialogs, zero emoji, zero axios.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import HauteCoutureModal from '../../components/HauteCoutureModal';
import { useCartStore } from '../../stores/useCartStore';
import { ORDER_TYPES } from '../../services/cart/cartTypes';
import { formatCurrencyVND } from '../../services/cart/cartCalculations';
import { createSalesOrder } from '../../services/salesOrderApi';
import { walletRequest } from '../../services/walletApi';
import productService from '../../services/productService';
import { getUserLocation } from '../../utils/userLocation';
import { calculateHaversineDistanceKm } from '../../utils/geoUtils';
import '../../styles/Cart.css';

export default function SaleCheckoutPage() {
  const navigate = useNavigate();
  const { items, removeItems } = useCartStore();

  // Danh sách các sản phẩm mua đứt
  const saleItems = useMemo(
    () => (items || []).filter((it) => it.orderType === ORDER_TYPES.SALE),
    [items]
  );
  const hasSaleItems = saleItems.length > 0;

  // Lấy chi nhánh mặc định từ các sản phẩm mua
  const [resolvedLocationId, setResolvedLocationId] = useState('');
  const [resolvingBranch, setResolvingBranch] = useState(false);

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
    city: 'Hồ Chí Minh',
  });
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

  // Tự động gán chi nhánh có sẵn hàng gần nhất
  useEffect(() => {
    if (!hasSaleItems) return;

    // 1. Kiểm tra xem item đầu tiên đã có selectedBranch chưa
    const firstBranchLocId = saleItems[0]?.selectedBranch?.locationId;
    if (firstBranchLocId && /^[0-9a-fA-F]{24}$/.test(String(firstBranchLocId))) {
      setResolvedLocationId(String(firstBranchLocId));
      return;
    }

    // 2. Nếu chưa có, gọi productService để lấy danh sách chi nhánh của sản phẩm
    let isMounted = true;
    async function resolveBranch() {
      setResolvingBranch(true);
      try {
        const prodId = saleItems[0]?.productId;
        if (!prodId) return;

        const prod = await productService.getProductById(prodId);
        const branches = prod?.branches || [];
        if (branches.length > 0) {
          let chosenLocId = branches[0].locationId;

          // Thử tối ưu theo vị trí người dùng nếu có
          const userLoc = await getUserLocation().catch(() => null);
          if (userLoc && userLoc.latitude && userLoc.longitude) {
            let minDistance = Infinity;
            for (const b of branches) {
              if (b.latitude && b.longitude) {
                const dist = calculateHaversineDistanceKm(
                  userLoc.latitude,
                  userLoc.longitude,
                  b.latitude,
                  b.longitude
                );
                if (dist < minDistance) {
                  minDistance = dist;
                  chosenLocId = b.locationId;
                }
              }
            }
          }

          if (isMounted && chosenLocId) {
            setResolvedLocationId(String(chosenLocId));
          }
        }
      } catch (e) {
        console.warn('Lỗi định vị chi nhánh:', e);
      } finally {
        if (isMounted) setResolvingBranch(false);
      }
    }

    resolveBranch();
    return () => {
      isMounted = false;
    };
  }, [hasSaleItems, saleItems]);

  const handleInputChange = (field, value) => {
    setShippingAddress((prev) => ({ ...prev, [field]: value }));
  };

  const isWalletInsufficient =
    paymentMethod === 'wallet' &&
    walletBalance !== null &&
    walletBalance < grandTotal;

  // Xử lý gửi đơn mua hàng
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setValidationError('');
    setSubmitError('');

    if (!hasSaleItems) return;

    if (!shippingAddress.receiverName.trim()) {
      setValidationError('Vui lòng nhập họ và tên người nhận hàng');
      return;
    }
    if (!shippingAddress.phone.trim()) {
      setValidationError('Vui lòng nhập số điện thoại người nhận');
      return;
    }
    if (!shippingAddress.street.trim()) {
      setValidationError('Vui lòng nhập địa chỉ nhà, tên đường');
      return;
    }
    if (!shippingAddress.city.trim()) {
      setValidationError('Vui lòng chọn Tỉnh / Thành phố');
      return;
    }

    if (!resolvedLocationId) {
      setValidationError('Hệ thống chưa tìm thấy chi nhánh khả dụng để xuất kho. Vui lòng thử lại sau giây lát.');
      return;
    }

    if (isWalletInsufficient) {
      setValidationError('Số dư Ví Vestora không đủ. Vui lòng nạp thêm tiền hoặc chọn thanh toán COD.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        locationId: resolvedLocationId,
        items: saleItems.map((it) => ({
          variantId: String(it.variantId),
          quantity: Math.max(1, Number(it.quantity) || 1),
          note: it.note || '',
        })),
        paymentMethod,
        shippingAddress,
        note,
      };

      const res = await createSalesOrder(payload);

      if (res?.success && res.data) {
        // Loại bỏ các sản phẩm đã mua khỏi giỏ hàng
        const purchasedCartIds = saleItems.map((it) => it.cartItemId);
        removeItems(purchasedCartIds);
        setSuccessOrder(res.data);
      } else {
        throw new Error(res?.message || 'Không thể tạo đơn mua hàng');
      }
    } catch (err) {
      setSubmitError(err.message || 'Đặt mua thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cart-page-container" style={{ background: '#FAF9F6', minHeight: '100vh' }}>
      <Navbar />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px 80px' }}>
        {/* Breadcrumb Navigation */}
        <div style={{ marginBottom: '20px' }}>
          <Link
            to="/cart"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#71717A',
              fontSize: '13px',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} />
            <span>Quay lại giỏ hàng</span>
          </Link>
        </div>

        {/* Hero Title */}
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
              fontSize: '32px',
              fontWeight: 600,
              color: '#171717',
              margin: '0 0 8px 0',
            }}
          >
            Thanh toán Đơn Mua Hàng
          </h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#71717A' }}>
            Sở hữu các thiết kế thời trang cao cấp độc quyền từ Vestora
          </p>
        </div>

        {!hasSaleItems ? (
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E5E0D8',
              padding: '60px 24px',
              textAlign: 'center',
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
                margin: '0 auto 20px',
                color: '#96723D',
              }}
            >
              <ShoppingBag size={38} strokeWidth={1.5} />
            </div>
            <h3
              style={{
                fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
                fontSize: '22px',
                color: '#171717',
                marginBottom: '10px',
              }}
            >
              Không có sản phẩm mua đứt nào trong giỏ hàng
            </h3>
            <p style={{ fontSize: '14px', color: '#71717A', marginBottom: '24px' }}>
              Quý khách hiện chỉ có trang phục thuê hoặc giỏ hàng đang trống.
            </p>
            <Link
              to="/catalog"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                background: '#171717',
                color: '#FAF9F6',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              <Package size={16} />
              <span>Khám phá bộ sưu tập mua</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmitOrder}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '32px',
                alignItems: 'start',
              }}
            >
              {/* CỘT TRÁI: ĐỊA CHỈ & PHƯƠNG THỨC THANH TOÁN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* 1. Thông tin giao hàng */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E5E0D8',
                    padding: '24px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '20px',
                      color: '#96723D',
                    }}
                  >
                    <MapPin size={20} />
                    <h2
                      style={{
                        fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
                        fontSize: '20px',
                        color: '#171717',
                        margin: 0,
                      }}
                    >
                      Địa chỉ nhận hàng
                    </h2>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#27272A',
                            marginBottom: '6px',
                          }}
                        >
                          Họ và tên người nhận *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingAddress.receiverName}
                          onChange={(e) => handleInputChange('receiverName', e.target.value)}
                          placeholder="Ví dụ: Nguyễn Văn A"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #D4D4D8',
                            fontSize: '14px',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#27272A',
                            marginBottom: '6px',
                          }}
                        >
                          Số điện thoại liên hệ *
                        </label>
                        <input
                          type="tel"
                          required
                          value={shippingAddress.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          placeholder="Ví dụ: 0912 345 678"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #D4D4D8',
                            fontSize: '14px',
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#27272A',
                            marginBottom: '6px',
                          }}
                        >
                          Tỉnh / Thành phố *
                        </label>
                        <input
                          type="text"
                          required
                          value={shippingAddress.city}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          placeholder="TP. Hồ Chí Minh"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #D4D4D8',
                            fontSize: '14px',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <div>
                        <label
                          style={{
                            display: 'block',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#27272A',
                            marginBottom: '6px',
                          }}
                        >
                          Quận / Huyện
                        </label>
                        <input
                          type="text"
                          value={shippingAddress.district}
                          onChange={(e) => handleInputChange('district', e.target.value)}
                          placeholder="Quận 1"
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #D4D4D8',
                            fontSize: '14px',
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#27272A',
                          marginBottom: '6px',
                        }}
                      >
                        Địa chỉ đường / số nhà cụ thể *
                      </label>
                      <input
                        type="text"
                        required
                        value={shippingAddress.street}
                        onChange={(e) => handleInputChange('street', e.target.value)}
                        placeholder="Số 72 Lê Thánh Tôn, Phường Bến Nghé"
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #D4D4D8',
                          fontSize: '14px',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#27272A',
                          marginBottom: '6px',
                        }}
                      >
                        Ghi chú đơn hàng (Tùy chọn)
                      </label>
                      <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Lưu ý giao hàng giờ hành chính, gọi trước khi đến..."
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #D4D4D8',
                          fontSize: '14px',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Phương thức thanh toán */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E5E0D8',
                    padding: '24px',
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
                      fontSize: '20px',
                      color: '#171717',
                      margin: '0 0 16px 0',
                    }}
                  >
                    Phương thức thanh toán
                  </h2>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* COD Option */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '16px',
                        borderRadius: '10px',
                        border: paymentMethod === 'cod' ? '2px solid #C5A880' : '1px solid #E5E0D8',
                        background: paymentMethod === 'cod' ? '#FAF5EE' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="cod"
                        checked={paymentMethod === 'cod'}
                        onChange={() => setPaymentMethod('cod')}
                        style={{ marginTop: '3px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <Banknote size={18} color="#96723D" />
                          <strong style={{ fontSize: '15px', color: '#171717' }}>
                            Thanh toán khi nhận hàng (COD)
                          </strong>
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#71717A', lineHeight: 1.5 }}>
                          Quý khách thanh toán tiền mặt trực tiếp cho bưu tá khi nhận và kiểm tra trang phục.
                        </p>
                      </div>
                    </label>

                    {/* Wallet Option */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '16px',
                        borderRadius: '10px',
                        border: paymentMethod === 'wallet' ? '2px solid #C5A880' : '1px solid #E5E0D8',
                        background: paymentMethod === 'wallet' ? '#FAF5EE' : '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="wallet"
                        checked={paymentMethod === 'wallet'}
                        onChange={() => setPaymentMethod('wallet')}
                        style={{ marginTop: '3px' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Wallet size={18} color="#96723D" />
                            <strong style={{ fontSize: '15px', color: '#171717' }}>
                              Ví nội bộ Vestora
                            </strong>
                          </div>

                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#96723D' }}>
                            {loadingWallet
                              ? 'Đang kiểm tra ví...'
                              : `Số dư: ${formatCurrencyVND(walletBalance || 0)}`}
                          </div>
                        </div>

                        <p style={{ margin: 0, fontSize: '13px', color: '#71717A', lineHeight: 1.5 }}>
                          Trừ trực tiếp từ số dư khả dụng trong ví của quý khách. Giao dịch được xác thực an toàn tuyệt đối.
                        </p>

                        {isWalletInsufficient && (
                          <div
                            style={{
                              marginTop: '8px',
                              padding: '8px 12px',
                              background: '#FEF2F2',
                              borderRadius: '6px',
                              border: '1px solid #FCA5A5',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12px',
                              color: '#B91C1C',
                            }}
                          >
                            <AlertTriangle size={15} />
                            <span>
                              Số dư ví không đủ. Quý khách vui lòng{' '}
                              <Link to="/wallet" target="_blank" style={{ color: '#B91C1C', fontWeight: 600 }}>
                                nạp thêm tiền
                              </Link>{' '}
                              hoặc chuyển sang phương thức COD.
                            </span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* CỘT PHẢI: CHI TIẾT SẢN PHẨM & TỔNG TIỀN */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E5E0D8',
                    padding: '24px',
                    position: 'sticky',
                    top: '90px',
                  }}
                >
                  <h3
                    style={{
                      fontFamily: "'Newsreader', 'Playfair Display', Georgia, serif",
                      fontSize: '20px',
                      color: '#171717',
                      margin: '0 0 16px 0',
                    }}
                  >
                    Kiện hàng mua sắm ({saleItems.length} sản phẩm)
                  </h3>

                  {/* Danh sách items nhỏ gọn */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      maxHeight: '260px',
                      overflowY: 'auto',
                      paddingRight: '6px',
                      marginBottom: '20px',
                      borderBottom: '1px solid #F4F4F5',
                      paddingBottom: '16px',
                    }}
                  >
                    {saleItems.map((it) => (
                      <div
                        key={it.cartItemId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                        }}
                      >
                        <img
                          src={it.thumbnailImage || '/placeholder-dress.jpg'}
                          alt={it.name}
                          style={{
                            width: '52px',
                            height: '64px',
                            objectFit: 'cover',
                            borderRadius: '6px',
                            border: '1px solid #E5E0D8',
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4
                            style={{
                              margin: '0 0 4px 0',
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#171717',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {it.name}
                          </h4>
                          <div style={{ fontSize: '12px', color: '#71717A' }}>
                            Size: {it.size || 'M'} | Số lượng: {it.quantity || 1}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#96723D', marginTop: '2px' }}>
                            {formatCurrencyVND((it.salePrice || 0) * (it.quantity || 1))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Dòng giá */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#52525B' }}>
                      <span>Tiền hàng</span>
                      <span>{formatCurrencyVND(saleSubtotal)}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#52525B' }}>
                      <span>Phí vận chuyển</span>
                      <span style={{ color: '#16A34A', fontWeight: 500 }}>Miễn phí toàn quốc</span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#171717',
                        paddingTop: '12px',
                        borderTop: '1px solid #E5E0D8',
                      }}
                    >
                      <span>Tổng thanh toán</span>
                      <span style={{ fontSize: '18px', color: '#96723D' }}>{formatCurrencyVND(grandTotal)}</span>
                    </div>
                  </div>

                  {/* Cảnh báo lỗi validate / submit */}
                  {validationError && (
                    <div
                      style={{
                        marginBottom: '16px',
                        padding: '10px 12px',
                        background: '#FEF2F2',
                        border: '1px solid #FCA5A5',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#B91C1C',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                      <span>{validationError}</span>
                    </div>
                  )}

                  {submitError && (
                    <div
                      style={{
                        marginBottom: '16px',
                        padding: '10px 12px',
                        background: '#FEF2F2',
                        border: '1px solid #FCA5A5',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: '#B91C1C',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Nút Đặt Mua */}
                  <button
                    type="submit"
                    disabled={submitting || isWalletInsufficient}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: submitting || isWalletInsufficient ? '#A1A1AA' : '#171717',
                      color: '#FAF9F6',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '15px',
                      fontWeight: 600,
                      cursor: submitting || isWalletInsufficient ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'background 0.2s',
                    }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        <span>Đang xử lý đơn mua...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={18} />
                        <span>Xác nhận Đặt Mua Hàng</span>
                      </>
                    )}
                  </button>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      marginTop: '12px',
                      fontSize: '11px',
                      color: '#A1A1AA',
                    }}
                  >
                    <Truck size={14} />
                    <span>Giao hàng tiêu chuẩn 1 - 3 ngày làm việc</span>
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
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              color: '#16A34A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <CheckCircle2 size={36} />
          </div>

          <p style={{ fontSize: '14px', color: '#52525B', lineHeight: 1.6, marginBottom: '20px' }}>
            Cảm ơn quý khách đã tin tưởng và mua sắm tại <strong>Vestora</strong>.
            {successOrder?.paymentMethod === 'wallet' ? (
              <span> Đơn hàng đã được thanh toán thành công qua Ví nội bộ Vestora.</span>
            ) : (
              <span> Đơn hàng sẽ được giao đến địa chỉ của quý khách và thanh toán tiền mặt khi nhận hàng (COD).</span>
            )}
          </p>

          <div
            style={{
              background: '#FAF5EE',
              borderRadius: '8px',
              border: '1px solid #E8DECF',
              padding: '12px 16px',
              marginBottom: '24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '13px', color: '#71717A' }}>Tổng số tiền thanh toán:</span>
            <strong style={{ fontSize: '16px', color: '#96723D' }}>
              {formatCurrencyVND(successOrder?.totalAmount || 0)}
            </strong>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => navigate('/rental-orders?tab=sale')}
              style={{
                flex: 1,
                padding: '12px',
                background: '#FAF5EE',
                color: '#96723D',
                border: '1px solid #C5A880',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Xem đơn mua của tôi
            </button>

            <button
              type="button"
              onClick={() => navigate('/catalog')}
              style={{
                flex: 1,
                padding: '12px',
                background: '#171717',
                color: '#FAF9F6',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
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
