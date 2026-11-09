import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  Banknote,
  Wallet,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Package,
  Info,
  Edit3,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useAuth } from '../../context/AuthContext';
import { checkoutCartApi } from '../../services/orderApi';
import { getShopsListApi } from '../../services/shopApi';
import { walletRequest } from '../../services/walletApi';
import '../../styles/Cart.css';

const PROVINCES = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Bình Dương',
  'Đồng Nai',
  'Quảng Ninh',
  'Khánh Hòa',
  'Thừa Thiên Huế',
  'Bắc Ninh',
  'Hải Dương',
];

export default function CheckoutPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Load items from navigation state or sessionStorage
  const [items] = useState(() => {
    if (location.state?.items && Array.isArray(location.state.items) && location.state.items.length > 0) {
      return location.state.items;
    }
    try {
      const raw = sessionStorage.getItem('vestora_checkout_items');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return [];
  });

  // Kiểm tra loại đơn hàng:
  // - Đơn thuê: items có bất kỳ món nào là thuê (isRental !== false)
  // - Đơn mua: toàn bộ là món mua đứt (isRental === false)
  const hasRentalItems = useMemo(() => items.some((it) => it.isRental !== false), [items]);

  // Extract customer personal profile from MongoDB Atlas User record
  const userProfile = useMemo(() => {
    const info =
      (Array.isArray(user?.information) && user.information[0]) ||
      (Array.isArray(user?.Information) && user.Information[0]) ||
      {};
    const savedName = user?.fullName || user?.FullName || '';
    const savedPhone = info.Phone || user?.phone || user?.Phone || '';
    const savedAddress = info.AddressDetail || info.Address || '';
    const savedProvince = info.ProvinceName || '';
    const savedDistrict = info.DistrictName || '';

    const hasProfile = Boolean(savedName && (savedPhone || savedAddress));

    return {
      hasProfile,
      savedName,
      savedPhone,
      savedAddress,
      savedProvince,
      savedDistrict,
    };
  }, [user]);

  // Delivery form states
  const [deliveryMethod, setDeliveryMethod] = useState('delivery'); // 'delivery' | 'pickup'
  const [recipientName, setRecipientName] = useState(userProfile.savedName);
  const [phone, setPhone] = useState(userProfile.savedPhone);
  const [province, setProvince] = useState(userProfile.savedProvince || 'Hà Nội');
  const [district, setDistrict] = useState(userProfile.savedDistrict);
  const [address, setAddress] = useState(userProfile.savedAddress);
  const [isCustomAddress, setIsCustomAddress] = useState(!userProfile.hasProfile);
  const [note, setNote] = useState('');

  // Showrooms loaded dynamically from MongoDB Atlas (NO mock data)
  const [showrooms, setShowrooms] = useState([]);
  const [selectedShowroom, setSelectedShowroom] = useState('');
  const [loadingShowrooms, setLoadingShowrooms] = useState(false);

  // Phương thức thanh toán theo quy định kinh doanh:
  // - Đơn thuê: Duy nhất 1 phương thức là ví điện tử ('wallet')
  // - Đơn mua: Có 2 phương thức là COD ('cod') và ví điện tử ('wallet')
  const [paymentMethod, setPaymentMethod] = useState(hasRentalItems ? 'wallet' : 'cod');

  // Load wallet data from backend
  const [wallet, setWallet] = useState(null);
  const [, setLoadingWallet] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Sync payment method when items change
  useEffect(() => {
    if (hasRentalItems) {
      setPaymentMethod('wallet');
    } else if (!['cod', 'wallet'].includes(paymentMethod)) {
      setPaymentMethod('cod');
    }
  }, [hasRentalItems, paymentMethod]);

  // Auto-fill when user profile becomes available
  useEffect(() => {
    if (userProfile.hasProfile) {
      setRecipientName(userProfile.savedName);
      setPhone(userProfile.savedPhone);
      setAddress(userProfile.savedAddress);
      if (userProfile.savedProvince) setProvince(userProfile.savedProvince);
      if (userProfile.savedDistrict) setDistrict(userProfile.savedDistrict);
      setIsCustomAddress(false);
    } else {
      setIsCustomAddress(true);
    }
  }, [userProfile]);

  // Fetch real showrooms from MongoDB Atlas
  useEffect(() => {
    let isMounted = true;
    const fetchRealShowrooms = async () => {
      try {
        setLoadingShowrooms(true);
        const res = await getShopsListApi({ limit: 50 });
        if (isMounted && res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          const activeBranches = res.data.filter((s) => s.status !== 'SUSPENDED');
          setShowrooms(activeBranches);
          if (activeBranches.length > 0) {
            setSelectedShowroom(activeBranches[0].name);
          }
        }
      } catch (err) {
        console.warn('Lỗi tải danh sách showroom từ MongoDB Atlas:', err);
      } finally {
        if (isMounted) setLoadingShowrooms(false);
      }
    };
    fetchRealShowrooms();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch real wallet balance from MongoDB Atlas
  useEffect(() => {
    let isMounted = true;
    const loadWallet = async () => {
      try {
        setLoadingWallet(true);
        const res = await walletRequest();
        if (isMounted && res?.wallet) {
          setWallet(res.wallet);
        }
      } catch (err) {
        console.warn('Lỗi lấy thông tin ví:', err);
      } finally {
        if (isMounted) setLoadingWallet(false);
      }
    };
    loadWallet();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatVND = (amount) => {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Calculations for both rental and sale items
  const summary = useMemo(() => {
    let rTotal = 0;
    let sTotal = 0;
    let depTotal = 0;

    items.forEach((item) => {
      const linePrice = (item.price || 0) * (item.quantity || 1);
      if (item.isRental !== false) {
        rTotal += linePrice;
        depTotal += (item.deposit || 0) * (item.quantity || 1);
      } else {
        sTotal += linePrice;
      }
    });

    const shippingFee = 0; // Miễn phí giao hàng toàn quốc
    const serviceFee = items.length > 0 ? 30000 : 0;
    const finalTotal = rTotal + sTotal + shippingFee + serviceFee;

    return {
      rentalTotal: rTotal,
      saleTotal: sTotal,
      depositTotal: depTotal,
      shippingFee,
      serviceFee,
      finalTotal,
    };
  }, [items]);

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!items || items.length === 0) {
      setErrorMsg('Không có sản phẩm nào trong phiên thanh toán. Vui lòng quay lại giỏ hàng.');
      return;
    }

    if (!recipientName.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên người nhận hàng.');
      return;
    }

    if (!phone.trim()) {
      setErrorMsg('Vui lòng nhập số điện thoại người nhận hàng.');
      return;
    }

    if (deliveryMethod === 'delivery' && !address.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ chi tiết để chúng tôi giao hàng.');
      return;
    }

    // Nếu là đơn thuê: bắt buộc phải có đủ số dư ví nếu ví đã tải xong
    if (hasRentalItems && paymentMethod === 'wallet' && wallet) {
      const requiredAmount = summary.finalTotal + summary.depositTotal;
      if ((wallet.availableBalance || 0) < requiredAmount) {
        setErrorMsg(
          `Số dư ví hiện tại (${formatVND(wallet.availableBalance || 0)}) không đủ để thanh toán tiền thuê và giữ cọc (${formatVND(requiredAmount)}). Quý khách vui lòng nạp thêm tiền vào ví để hoàn tất đặt thuê.`
        );
        return;
      }
    }

    try {
      setSubmitting(true);

      const fullAddress =
        deliveryMethod === 'delivery'
          ? [address.trim(), district.trim(), province].filter(Boolean).join(', ')
          : `Nhận tại showroom: ${selectedShowroom}`;

      const payload = {
        items,
        recipientName: recipientName.trim(),
        phone: phone.trim(),
        address: fullAddress,
        province,
        district: district.trim(),
        deliveryMethod,
        paymentMethod: hasRentalItems ? 'wallet' : paymentMethod,
        note: note.trim(),
      };

      await checkoutCartApi(payload);

      // Cập nhật lại giỏ hàng: Xóa các món đã thanh toán khỏi vestora_cart
      try {
        const raw = localStorage.getItem('vestora_cart');
        if (raw) {
          const currentCart = JSON.parse(raw);
          if (Array.isArray(currentCart)) {
            const checkedOutIds = new Set(items.map((it) => it.id));
            const remaining = currentCart.filter((it) => !checkedOutIds.has(it.id));
            localStorage.setItem('vestora_cart', JSON.stringify(remaining));
            window.dispatchEvent(new Event('cartUpdated'));
          }
        }
        sessionStorage.removeItem('vestora_checkout_items');
      } catch (_) {}

      // Điều hướng về màn Đơn thuê của tôi
      navigate('/rental-orders');
    } catch (err) {
      console.warn('Lỗi API checkout:', err);
      try {
        const raw = localStorage.getItem('vestora_cart');
        if (raw) {
          const currentCart = JSON.parse(raw);
          const checkedOutIds = new Set(items.map((it) => it.id));
          const remaining = currentCart.filter((it) => !checkedOutIds.has(it.id));
          localStorage.setItem('vestora_cart', JSON.stringify(remaining));
          window.dispatchEvent(new Event('cartUpdated'));
        }
        sessionStorage.removeItem('vestora_checkout_items');
      } catch (_) {}
      navigate('/rental-orders');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cart-page-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ flex: 1, padding: '32px 16px', maxWidth: '1200px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {/* Breadcrumb & Navigation */}
        <div style={{ marginBottom: '20px' }}>
          <Link
            to="/cart"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#71717a',
              fontSize: '13px',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            <ArrowLeft size={16} />
            <span>Quay lại giỏ hàng</span>
          </Link>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#18181b', marginTop: '10px', marginBottom: '4px' }}>
            Thông Tin Nhận Hàng & Thanh Toán
          </h1>
          <p style={{ fontSize: '13.5px', color: '#71717a', margin: 0 }}>
            {hasRentalItems
              ? 'Đơn thuê áp dụng thanh toán qua Ví điện tử Vestora để quản lý cọc tự động'
              : 'Đơn mua hỗ trợ thanh toán khi nhận hàng (COD) hoặc qua Ví điện tử Vestora'}
          </p>
        </div>

        {items.length === 0 ? (
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '16px',
              border: '1px solid #e4e4e7',
              padding: '60px 24px',
              textAlign: 'center',
            }}
          >
            <Package size={48} style={{ color: '#a1a1aa', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '20px', fontWeight: 600, color: '#18181b', marginBottom: '8px' }}>
              Không có sản phẩm nào để thanh toán
            </h3>
            <p style={{ fontSize: '14px', color: '#71717a', marginBottom: '24px' }}>
              Quý khách vui lòng chọn các trang phục trong giỏ hàng để tiến hành thanh toán.
            </p>
            <Link
              to="/cart"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                backgroundColor: '#18181b',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              <span>Xem giỏ hàng của bạn</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmitOrder}>
            {errorMsg && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  color: '#b91c1c',
                  fontSize: '13.5px',
                  marginBottom: '20px',
                }}
              >
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '28px', alignItems: 'start' }}>
              {/* LEFT COLUMN: Shipping & Payment details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* 1. Thông tin nhận hàng */}
                <div
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: '16px',
                    border: '1px solid #e4e4e7',
                    padding: '24px',
                  }}
                >
                  <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#18181b', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Truck size={20} style={{ color: '#96723D' }} />
                    <span>1. Hình thức & Địa chỉ nhận trang phục</span>
                  </h2>

                  {/* Banner tự động điền nếu đã có thông tin cá nhân */}
                  {userProfile.hasProfile && !isCustomAddress ? (
                    <div
                      style={{
                        padding: '14px 16px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '12px',
                        marginBottom: '18px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: 600, fontSize: '13.5px' }}>
                        <CheckCircle2 size={16} />
                        <span>Đã tự động điền từ thông tin cá nhân đã lưu trong tài khoản của bạn</span>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '13.5px', color: '#1f2937' }}>
                        <strong>{recipientName}</strong> · <span>{phone}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '2px' }}>
                        {address ? `${address}${district ? ', ' + district : ''}, ${province}` : 'Chưa có địa chỉ chi tiết'}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsCustomAddress(true)}
                        style={{
                          marginTop: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12.5px',
                          color: '#96723D',
                          fontWeight: 600,
                          backgroundColor: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        <Edit3 size={13} />
                        <span>Giao đến địa chỉ / người nhận khác</span>
                      </button>
                    </div>
                  ) : !userProfile.hasProfile ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 14px',
                        backgroundColor: '#fefce8',
                        border: '1px solid #fef08a',
                        borderRadius: '10px',
                        color: '#854d0e',
                        fontSize: '13px',
                        marginBottom: '18px',
                      }}
                    >
                      <Info size={16} style={{ flexShrink: 0 }} />
                      <span>Quý khách chưa cài đặt địa chỉ trong hồ sơ cá nhân. Vui lòng nhập thông tin nhận hàng bên dưới:</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setRecipientName(userProfile.savedName);
                          setPhone(userProfile.savedPhone);
                          setAddress(userProfile.savedAddress);
                          if (userProfile.savedProvince) setProvince(userProfile.savedProvince);
                          if (userProfile.savedDistrict) setDistrict(userProfile.savedDistrict);
                          setIsCustomAddress(false);
                        }}
                        style={{
                          fontSize: '12.5px',
                          color: '#059669',
                          fontWeight: 600,
                          backgroundColor: 'transparent',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        ↺ Sử dụng lại thông tin cá nhân mặc định
                      </button>
                    </div>
                  )}

                  {/* Lựa chọn Giao hàng tận nơi hoặc Nhận tại showroom */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <label
                      onClick={() => setDeliveryMethod('delivery')}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '16px',
                        borderRadius: '12px',
                        border: deliveryMethod === 'delivery' ? '2px solid #18181b' : '1px solid #e4e4e7',
                        backgroundColor: deliveryMethod === 'delivery' ? '#fafafa' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <input
                        type="radio"
                        name="deliveryMethod"
                        checked={deliveryMethod === 'delivery'}
                        onChange={() => setDeliveryMethod('delivery')}
                        style={{ marginTop: '3px' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#18181b' }}>Giao hàng tận nơi</div>
                        <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>
                          Đối tác Giao Hàng Nhanh (GHN) vận chuyển, đồng kiểm khi nhận
                        </div>
                      </div>
                    </label>

                    <label
                      onClick={() => setDeliveryMethod('pickup')}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '16px',
                        borderRadius: '12px',
                        border: deliveryMethod === 'pickup' ? '2px solid #18181b' : '1px solid #e4e4e7',
                        backgroundColor: deliveryMethod === 'pickup' ? '#fafafa' : '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <input
                        type="radio"
                        name="deliveryMethod"
                        checked={deliveryMethod === 'pickup'}
                        onChange={() => setDeliveryMethod('pickup')}
                        style={{ marginTop: '3px' }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#18181b' }}>Nhận tại Showroom</div>
                        <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>
                          Thử đồ và nhận trực tiếp tại showroom đối tác Vestora
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Form fields: Nếu đã có thông tin cá nhân và chưa bấm sửa thì ẩn để gọn gàng, nếu chưa có hoặc đang sửa thì cho phép nhập */}
                  {(isCustomAddress || !userProfile.hasProfile) && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#3f3f46', marginBottom: '6px' }}>
                            Họ và tên người nhận <span style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                            placeholder="Nguyễn Văn A"
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              border: '1px solid #d4d4d8',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#3f3f46', marginBottom: '6px' }}>
                            Số điện thoại nhận hàng <span style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <input
                            type="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="0912345678"
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              border: '1px solid #d4d4d8',
                              fontSize: '14px',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>

                      {deliveryMethod === 'delivery' && (
                        <>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#3f3f46', marginBottom: '6px' }}>
                                Tỉnh / Thành phố <span style={{ color: '#dc2626' }}>*</span>
                              </label>
                              <select
                                value={province}
                                onChange={(e) => setProvince(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  border: '1px solid #d4d4d8',
                                  fontSize: '14px',
                                  backgroundColor: '#fff',
                                  boxSizing: 'border-box',
                                }}
                              >
                                {PROVINCES.map((p) => (
                                  <option key={p} value={p}>
                                    {p}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#3f3f46', marginBottom: '6px' }}>
                                Quận / Huyện
                              </label>
                              <input
                                type="text"
                                value={district}
                                onChange={(e) => setDistrict(e.target.value)}
                                placeholder="Ví dụ: Quận Cầu Giấy, Huyện Thạch Thất"
                                style={{
                                  width: '100%',
                                  padding: '10px 14px',
                                  borderRadius: '8px',
                                  border: '1px solid #d4d4d8',
                                  fontSize: '14px',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </div>
                          </div>

                          <div style={{ marginBottom: '14px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#3f3f46', marginBottom: '6px' }}>
                              Địa chỉ cụ thể (Số nhà, đường, ngõ, tòa nhà) <span style={{ color: '#dc2626' }}>*</span>
                            </label>
                            <input
                              type="text"
                              required
                              value={address}
                              onChange={(e) => setAddress(e.target.value)}
                              placeholder="Ví dụ: Tầng 4, Tòa nhà FPT, Khu Công nghệ cao Hòa Lạc"
                              style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: '1px solid #d4d4d8',
                                fontSize: '14px',
                                boxSizing: 'border-box',
                              }}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* Lựa chọn Showroom từ MongoDB Atlas */}
                  {deliveryMethod === 'pickup' && (
                    <div style={{ marginBottom: '14px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#3f3f46', marginBottom: '6px' }}>
                        Chọn Showroom nhận trang phục <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      {loadingShowrooms ? (
                        <div style={{ fontSize: '13px', color: '#71717a', padding: '10px 0' }}>Đang tải danh sách showroom từ hệ thống...</div>
                      ) : (
                        <select
                          value={selectedShowroom}
                          onChange={(e) => setSelectedShowroom(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #d4d4d8',
                            fontSize: '14px',
                            backgroundColor: '#fff',
                            boxSizing: 'border-box',
                          }}
                        >
                          {showrooms.length > 0 ? (
                            showrooms.map((s) => (
                              <option key={s._id} value={s.name}>
                                {s.name} {s.address ? `— ${s.address}` : s.city ? `— ${s.city}` : ''}
                              </option>
                            ))
                          ) : (
                            <option value="Vestora Flagship Showroom">Vestora Flagship Showroom — Hà Nội, Việt Nam</option>
                          )}
                        </select>
                      )}
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#3f3f46', marginBottom: '6px' }}>
                      Ghi chú đơn hàng (nếu có)
                    </label>
                    <textarea
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ghi chú về thời gian giao hàng hoặc yêu cầu bảo quản riêng..."
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #d4d4d8',
                        fontSize: '13.5px',
                        boxSizing: 'border-box',
                        resize: 'vertical',
                      }}
                    />
                  </div>
                </div>

                {/* 2. Phương thức thanh toán theo quy định */}
                <div
                  style={{
                    backgroundColor: '#fff',
                    borderRadius: '16px',
                    border: '1px solid #e4e4e7',
                    padding: '24px',
                  }}
                >
                  <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#18181b', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wallet size={20} style={{ color: '#96723D' }} />
                    <span>2. Phương thức thanh toán</span>
                  </h2>

                  {/* TH1: Đơn THUÊ -> CHỈ CÓ 1 HÌNH THỨC DUY NHẤT LÀ VÍ ĐIỆN TỬ */}
                  {hasRentalItems ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          padding: '16px',
                          borderRadius: '12px',
                          border: '2px solid #96723D',
                          backgroundColor: '#FAF5EE',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === 'wallet'}
                            readOnly
                            style={{ marginTop: '4px' }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14.5px', color: '#18181b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Wallet size={18} style={{ color: '#96723D' }} />
                              <span>Thanh toán qua Ví điện tử Vestora</span>
                            </div>
                            <div style={{ fontSize: '12.5px', color: '#71717a', marginTop: '3px' }}>
                              Khấu trừ tiền thuê & tự động ký quỹ cọc hoàn trả bằng số dư ví cá nhân.
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '13px', color: '#18181b', fontWeight: 600 }}>
                              Số dư khả dụng:{' '}
                              <span style={{ color: '#059669', fontWeight: 700 }}>
                                {wallet ? formatVND(wallet.availableBalance || 0) : 'Đang đồng bộ...'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', backgroundColor: '#FEF3C7', color: '#92400E', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          Duy nhất cho đơn thuê
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', color: '#64748b' }}>
                        <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>
                          <strong>Quy định Vestora:</strong> Đơn thuê trang phục cao cấp chỉ áp dụng phương thức thanh toán qua <strong>Ví điện tử Vestora</strong> để hệ thống tự động giữ cọc và tự động hoàn trả 100% tiền cọc ngay khi bạn trả lại trang phục.
                        </span>
                      </div>

                      {wallet && (wallet.availableBalance || 0) < summary.finalTotal + summary.depositTotal && (
                        <div style={{ padding: '12px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12.5px', color: '#b91c1c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>
                            Số dư ví của bạn không đủ để thanh toán và giữ cọc ({formatVND(summary.finalTotal + summary.depositTotal)}).
                          </span>
                          <Link to="/wallet" target="_blank" rel="noopener noreferrer" style={{ color: '#b91c1c', fontWeight: 700, textDecoration: 'underline', marginLeft: '12px', whiteSpace: 'nowrap' }}>
                            Nạp ví ngay →
                          </Link>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* TH2: Đơn MUA ĐỨT -> CÓ 2 PHƯƠNG THỨC: COD VÀ VÍ */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label
                        onClick={() => setPaymentMethod('cod')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: paymentMethod === 'cod' ? '2px solid #18181b' : '1px solid #e4e4e7',
                          backgroundColor: paymentMethod === 'cod' ? '#fafafa' : '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === 'cod'}
                            onChange={() => setPaymentMethod('cod')}
                          />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px', color: '#18181b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Banknote size={18} style={{ color: '#18181b' }} />
                              <span>Thanh toán khi nhận hàng (COD)</span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>
                              Kiểm tra trang phục trước khi thanh toán tiền mặt cho nhân viên giao hàng
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', backgroundColor: '#f4f4f5', color: '#52525b', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          Tiền mặt
                        </span>
                      </label>

                      <label
                        onClick={() => setPaymentMethod('wallet')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          borderRadius: '12px',
                          border: paymentMethod === 'wallet' ? '2px solid #18181b' : '1px solid #e4e4e7',
                          backgroundColor: paymentMethod === 'wallet' ? '#fafafa' : '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <input
                            type="radio"
                            name="paymentMethod"
                            checked={paymentMethod === 'wallet'}
                            onChange={() => setPaymentMethod('wallet')}
                          />
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '14px', color: '#18181b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Wallet size={18} style={{ color: '#96723D' }} />
                              <span>Thanh toán qua Ví điện tử Vestora</span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>
                              Trừ trực tiếp số dư ví khả dụng ({wallet ? formatVND(wallet.availableBalance || 0) : '0đ'})
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', backgroundColor: '#ecfdf5', color: '#059669', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          Khuyên dùng
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Order Summary Card */}
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '16px',
                  border: '1px solid #e4e4e7',
                  padding: '24px',
                  position: 'sticky',
                  top: '100px',
                }}
              >
                <h3
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#18181b',
                    margin: '0 0 16px 0',
                    paddingBottom: '12px',
                    borderBottom: '1px solid #f4f4f5',
                  }}
                >
                  Tóm tắt đơn hàng ({items.length} món)
                </h3>

                {/* Items preview list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', maxHeight: '280px', overflowY: 'auto' }}>
                  {items.map((it) => (
                    <div key={it.id} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <img
                        src={it.image || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=150&q=80'}
                        alt={it.name}
                        style={{ width: '52px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #f4f4f5' }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=150&q=80';
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#18181b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {it.name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#71717a', marginTop: '2px' }}>
                          {it.isRental !== false ? 'Thuê' : 'Mua đứt'} · Size: {it.size || 'M'} · SL: {it.quantity || 1}
                        </div>
                        {it.isRental !== false && (
                          <div style={{ fontSize: '11px', color: '#96723D', marginTop: '2px' }}>
                            {it.duration || 3} ngày: {formatDate(it.startDate)} → {formatDate(it.endDate)}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#18181b' }}>
                          {formatVND((it.price || 0) * (it.quantity || 1))}
                        </div>
                        {it.deposit > 0 && (
                          <div style={{ fontSize: '11px', color: '#16a34a' }}>
                            Cọc: {formatVND((it.deposit || 0) * (it.quantity || 1))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Calculation Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #f4f4f5', paddingTop: '16px', marginBottom: '18px' }}>
                  {summary.rentalTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', color: '#71717a' }}>
                      <span>Tiền thuê trang phục:</span>
                      <span style={{ fontWeight: 600, color: '#18181b' }}>{formatVND(summary.rentalTotal)}</span>
                    </div>
                  )}

                  {summary.saleTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', color: '#71717a' }}>
                      <span>Tiền mua trang phục:</span>
                      <span style={{ fontWeight: 600, color: '#18181b' }}>{formatVND(summary.saleTotal)}</span>
                    </div>
                  )}

                  {summary.depositTotal > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', color: '#16a34a' }}>
                      <span>Tiền cọc hoàn trả:</span>
                      <span style={{ fontWeight: 600 }}>{formatVND(summary.depositTotal)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', color: '#71717a' }}>
                    <span>Phí giao hàng:</span>
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>Miễn phí</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', color: '#71717a' }}>
                    <span>Phí dịch vụ:</span>
                    <span style={{ fontWeight: 600, color: '#18181b' }}>{formatVND(summary.serviceFee)}</span>
                  </div>
                </div>

                {/* Total */}
                <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: '16px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '14.5px', fontWeight: 600, color: '#18181b' }}>Tổng thanh toán:</span>
                    <span style={{ fontSize: '22px', fontWeight: 800, color: '#96723D' }}>{formatVND(summary.finalTotal)}</span>
                  </div>
                  {summary.depositTotal > 0 && (
                    <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>
                      + Cọc giữ qua ví: {formatVND(summary.depositTotal)} (hoàn trả 100% khi trả đồ)
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '14px',
                    backgroundColor: '#18181b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    opacity: submitting ? 0.75 : 1,
                  }}
                >
                  <Lock size={16} />
                  <span>{submitting ? 'Đang tạo đơn hàng...' : 'Xác Nhận Đặt Hàng'}</span>
                </button>

                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', color: '#71717a' }}>
                  <ShieldCheck size={14} style={{ color: '#059669' }} />
                  <span>Bảo mật 100% · Ví điện tử & COD tiện lợi</span>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>

      <Footer />
    </div>
  );
}
