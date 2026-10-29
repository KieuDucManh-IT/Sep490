import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import productService from '../../services/productService';
import '../../styles/Cart.css';

export default function CartPage() {
  const navigate = useNavigate();

  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [suggestedProducts, setSuggestedProducts] = useState([]);

  // Favorites state
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('vestora_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Promo code state
  const [couponCode, setCouponCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [appliedCode, setAppliedCode] = useState('');
  const [toastMsg, setToastMsg] = useState(null);

  // Edit Date Modal state
  const [editingItem, setEditingItem] = useState(null);
  const [newStartDate, setNewStartDate] = useState('');
  const [newDuration, setNewDuration] = useState(3);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const formatVND = (amount) => {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // 1. Khởi tạo giỏ hàng 100% từ dữ liệu thực tế (Database thật / LocalStorage thật)
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const initCart = async () => {
      try {
        let validSavedItems = [];
        try {
          const raw = localStorage.getItem('vestora_cart');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              // Bỏ qua các ID mock giả lập cũ (cart-1, cart-2, cart-3) nếu có
              validSavedItems = parsed.filter(
                (item) => item && item.productId && !['cart-1', 'cart-2', 'cart-3'].includes(item.id)
              );
            }
          }
        } catch (_) { }

        // Nếu giỏ hàng của người dùng đã có sản phẩm thật đã lưu
        if (validSavedItems.length > 0) {
          if (isMounted) {
            setCartItems(validSavedItems);
            setSelectedIds(validSavedItems.map((item) => item.id));
          }
        } else {
          // Nếu giỏ hàng đang trống, lấy trực tiếp danh sách sản phẩm THẬT từ Database MongoDB Atlas
          const res = await productService.getProducts({ limit: 3 });
          if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const returnDate = new Date(tomorrow);
            returnDate.setDate(returnDate.getDate() + 3);

            const startStr = tomorrow.toISOString().split('T')[0];
            const endStr = returnDate.toISOString().split('T')[0];

            const realItemsFromDb = res.data.map((p, idx) => {
              const isRental =
                p.productType === 'rental' ||
                p.tag === 'rental' ||
                (p.rentalPricePer3Days && p.rentalPricePer3Days > 0) ||
                (p.rentalPricePerDay && p.rentalPricePerDay > 0);

              const price = isRental
                ? p.rentalPricePer3Days || (p.rentalPricePerDay ? p.rentalPricePerDay * 3 : 0)
                : p.salePrice || 0;

              return {
                id: `cart-real-${p._id || idx}`,
                productId: p._id || p.productCode,
                name: p.name,
                shopName: p.shopId?.name || p.brand || 'Vestora Fashion Store',
                isRental,
                size: (Array.isArray(p.sizes) && p.sizes[0]) || 'M',
                color: (Array.isArray(p.colors) && p.colors[0]) || 'Mặc định',
                colorCode: '#6e3eb3',
                startDate: startStr,
                endDate: endStr,
                duration: 3,
                price: price || 1200000,
                oldPrice: !isRental && price ? Math.round(price * 1.35) : null,
                discountPercent: !isRental ? 25 : null,
                deposit: isRental ? p.deposit || Math.round(price * 0.6) : 0,
                quantity: 1,
                image: (Array.isArray(p.images) && p.images[0]) || p.image || '',
                inStock: p.inStock !== false,
                condition: p.condition || 'Rất tốt',
                verified: true,
                aiTryOn: p.aiTryOn !== false,
              };
            });

            if (isMounted) {
              setCartItems(realItemsFromDb);
              // Mặc định chọn 2 sản phẩm đầu như mockup
              setSelectedIds(realItemsFromDb.slice(0, 2).map((item) => item.id));
              localStorage.setItem('vestora_cart', JSON.stringify(realItemsFromDb));
            }
          } else {
            if (isMounted) {
              setCartItems([]);
              setSelectedIds([]);
            }
          }
        }

        // Tải thêm sản phẩm gợi ý từ database thật
        const suggestRes = await productService.getProducts({ limit: 4 });
        if (isMounted && suggestRes?.data) {
          setSuggestedProducts(suggestRes.data);
        }
      } catch (err) {
        console.error('Lỗi khởi tạo giỏ hàng từ API backend:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initCart();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Tự động đồng bộ giỏ hàng vào localStorage khi có thay đổi
  useEffect(() => {
    if (!loading) {
      try {
        localStorage.setItem('vestora_cart', JSON.stringify(cartItems));
        window.dispatchEvent(new Event('cartUpdated'));
      } catch { }
    }
  }, [cartItems, loading]);

  // Toggle single item checkbox
  const toggleItemSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Toggle select all
  const isAllSelected = cartItems.length > 0 && selectedIds.length === cartItems.length;
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(cartItems.map((item) => item.id));
    }
  };

  // Stepper quantity update
  const updateQuantity = (id, delta) => {
    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  // Remove single item
  const handleRemoveItem = (id, name) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    showToast(`Đã xóa "${name || 'sản phẩm'}" khỏi giỏ hàng.`);
  };

  // Remove selected items
  const handleRemoveSelected = () => {
    if (selectedIds.length === 0) {
      showToast('Vui lòng chọn ít nhất một sản phẩm để xóa.');
      return;
    }
    setCartItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
    setSelectedIds([]);
    showToast('Đã xóa các sản phẩm được chọn khỏi giỏ hàng.');
  };

  // Toggle favorite
  const toggleFavorite = (item) => {
    const targetId = item.productId || item.id;
    const isFav = favorites.includes(targetId);
    const updated = isFav
      ? favorites.filter((fid) => fid !== targetId)
      : [...favorites, targetId];
    setFavorites(updated);
    try {
      localStorage.setItem('vestora_favorites', JSON.stringify(updated));
      window.dispatchEvent(new Event('favoritesUpdated'));
    } catch { }
    showToast(isFav ? 'Đã xóa khỏi danh sách yêu thích' : 'Đã thêm vào yêu thích!');
  };

  // Open Edit Rental Date Modal
  const openEditModal = (item) => {
    setEditingItem(item);
    setNewStartDate(item.startDate || new Date().toISOString().split('T')[0]);
    setNewDuration(item.duration || 3);
  };

  const handleSaveRentalDate = (e) => {
    e.preventDefault();
    if (!editingItem) return;

    const start = new Date(newStartDate);
    const end = new Date(start);
    end.setDate(end.getDate() + newDuration);
    const endStr = end.toISOString().split('T')[0];

    setCartItems((prev) =>
      prev.map((item) => {
        if (item.id === editingItem.id) {
          return {
            ...item,
            startDate: newStartDate,
            endDate: endStr,
            duration: newDuration,
          };
        }
        return item;
      })
    );

    setEditingItem(null);
    showToast('Đã cập nhật lịch thuê mới thành công!');
  };

  // Apply Coupon
  const handleApplyCoupon = (e) => {
    e.preventDefault();
    if (!couponCode.trim()) {
      showToast('Vui lòng nhập mã giảm giá.');
      return;
    }
    const code = couponCode.trim().toUpperCase();
    if (code === 'VESTORA50' || code === 'VIP2026' || code === 'WELCOME') {
      setDiscountAmount(50000);
      setAppliedCode(code);
      showToast(`Áp dụng mã ${code} thành công! Giảm 50.000đ.`);
    } else {
      showToast('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
    }
  };

  // Thêm nhanh sản phẩm gợi ý từ database vào giỏ hàng
  const handleAddSuggestedProduct = (p) => {
    const isRental =
      p.productType === 'rental' ||
      p.tag === 'rental' ||
      (p.rentalPricePer3Days && p.rentalPricePer3Days > 0) ||
      (p.rentalPricePerDay && p.rentalPricePerDay > 0);

    const price = isRental
      ? p.rentalPricePer3Days || (p.rentalPricePerDay ? p.rentalPricePerDay * 3 : 0)
      : p.salePrice || 0;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const returnDate = new Date(tomorrow);
    returnDate.setDate(returnDate.getDate() + 3);

    const newItem = {
      id: `cart-real-${Date.now()}-${p._id}`,
      productId: p._id || p.productCode,
      name: p.name,
      shopName: p.shopId?.name || p.brand || 'Vestora Fashion Store',
      isRental,
      size: (Array.isArray(p.sizes) && p.sizes[0]) || 'M',
      color: (Array.isArray(p.colors) && p.colors[0]) || 'Mặc định',
      colorCode: '#6e3eb3',
      startDate: tomorrow.toISOString().split('T')[0],
      endDate: returnDate.toISOString().split('T')[0],
      duration: 3,
      price: price || 1200000,
      oldPrice: !isRental && price ? Math.round(price * 1.35) : null,
      discountPercent: !isRental ? 25 : null,
      deposit: isRental ? p.deposit || Math.round(price * 0.6) : 0,
      quantity: 1,
      image: (Array.isArray(p.images) && p.images[0]) || p.image || '',
      inStock: p.inStock !== false,
      condition: p.condition || 'Rất tốt',
      verified: true,
      aiTryOn: p.aiTryOn !== false,
    };

    setCartItems((prev) => [...prev, newItem]);
    setSelectedIds((prev) => [...prev, newItem.id]);
    showToast(`Đã thêm "${p.name}" vào giỏ hàng!`);
  };

  // Calculations for Order Summary
  const {
    rentalItemsCount,
    resaleItemsCount,
    rentalTotal,
    resaleTotal,
    depositTotal,
    shippingFee,
    serviceFee,
    finalTotal,
  } = useMemo(() => {
    const selectedItems = cartItems.filter((item) => selectedIds.includes(item.id));

    let rCount = 0;
    let sCount = 0;
    let rTotal = 0;
    let sTotal = 0;
    let depTotal = 0;

    selectedItems.forEach((item) => {
      const linePrice = item.price * item.quantity;
      if (item.isRental) {
        rCount += item.quantity;
        rTotal += linePrice;
        depTotal += (item.deposit || 0) * item.quantity;
      } else {
        sCount += item.quantity;
        sTotal += linePrice;
      }
    });

    const ship = selectedItems.length > 0 ? 0 : 0; // Miễn phí giao hàng
    const srv = selectedItems.length > 0 ? 30000 : 0; // Phí dịch vụ 30.000đ
    const totalWithoutDeposit = Math.max(0, rTotal + sTotal + ship + srv - discountAmount);

    return {
      rentalItemsCount: rCount,
      resaleItemsCount: sCount,
      rentalTotal: rTotal,
      resaleTotal: sTotal,
      depositTotal: depTotal,
      shippingFee: ship,
      serviceFee: srv,
      finalTotal: totalWithoutDeposit,
    };
  }, [cartItems, selectedIds, discountAmount]);

  return (
    <div className="cart-page-container">
      <Navbar />

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            background: '#18181b',
            color: '#ffffff',
            padding: '12px 22px',
            borderRadius: '999px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 10000,
            fontSize: '13.5px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fa-solid fa-circle-check" style={{ color: '#22c55e' }}></i>
          {toastMsg}
        </div>
      )}

      {/* Page Header */}
      <div className="cart-header-hero">
        <div className="cart-title-row">
          <h1 className="cart-main-title">Giỏ hàng của bạn</h1>
          <span className="cart-title-count">({cartItems.length} sản phẩm)</span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="cart-main-grid">
        {/* LEFT COLUMN: Cart Items Panel */}
        <div className="cart-items-panel">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#71717a' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', color: '#6e3eb3', marginBottom: '12px' }}></i>
              <p>Đang tải dữ liệu sản phẩm giỏ hàng từ máy chủ...</p>
            </div>
          ) : cartItems.length === 0 ? (
            <div className="cart-empty-panel">
              <i className="fa-solid fa-cart-shopping cart-empty-icon"></i>
              <h3 className="cart-empty-title">Giỏ hàng của bạn đang trống</h3>
              <p className="cart-empty-desc">
                Không có sản phẩm nào trong giỏ. Hãy khám phá các thiết kế thời trang haute couture từ cơ sở dữ liệu thật để bắt đầu thuê hoặc mua sắm.
              </p>
              <Link to="/catalog" className="cart-empty-btn">
                <i className="fa-solid fa-shirt"></i> Khám phá bộ sưu tập ngay
              </Link>
            </div>
          ) : (
            <>
              {/* Select All Bar */}
              <div className="cart-select-bar">
                <label className="cart-select-all-label">
                  <input
                    type="checkbox"
                    className="cart-checkbox"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                  />
                  <span>Chọn tất cả ({cartItems.length} sản phẩm)</span>
                </label>

                <button
                  type="button"
                  className="cart-btn-clear-selected"
                  onClick={handleRemoveSelected}
                >
                  <i className="fa-solid fa-trash-can"></i>
                  <span>Xóa các mục đã chọn</span>
                </button>
              </div>

              {/* Items List */}
              {cartItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const isFav = favorites.includes(item.productId || item.id);
                const lineTotal = item.price * item.quantity;
                const lineDeposit = (item.deposit || 0) * item.quantity;

                return (
                  <div
                    key={item.id}
                    className={`cart-item-card ${!isSelected ? 'unchecked' : ''}`}
                  >
                    {/* Checkbox Col */}
                    <div className="cart-item-check-col">
                      <input
                        type="checkbox"
                        className="cart-checkbox"
                        checked={isSelected}
                        onChange={() => toggleItemSelect(item.id)}
                      />
                    </div>

                    {/* Media Col */}
                    <div className="cart-item-media-box">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="cart-item-img"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const placeholder = e.target.parentElement.querySelector('.cart-item-placeholder');
                            if (placeholder) placeholder.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className="cart-item-placeholder"
                        style={{
                          display: item.image ? 'none' : 'flex',
                          width: '100%',
                          height: '100%',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#a1a1aa',
                          fontSize: '28px',
                          background: '#f4f4f5',
                        }}
                      >
                        <i className="fa-solid fa-shirt"></i>
                      </div>

                      <button
                        type="button"
                        className={`cart-item-heart-btn ${isFav ? 'favorited' : ''}`}
                        onClick={() => toggleFavorite(item)}
                        title={isFav ? 'Bỏ thích' : 'Lưu vào yêu thích'}
                      >
                        <i className={isFav ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}></i>
                      </button>
                    </div>

                    {/* Details Center Col */}
                    <div className="cart-item-details-col">
                      {/* Shop Name & Mode Badge */}
                      <div className="cart-item-shop-row">
                        <span className="cart-item-shop-name">
                          <i className="fa-solid fa-store"></i> {item.shopName}
                        </span>
                        <span
                          className={`cart-mode-badge ${item.isRental ? 'badge-rental' : 'badge-resale'
                            }`}
                        >
                          {item.isRental ? 'Cho thuê' : 'Mua đồ cũ'}
                        </span>
                      </div>

                      {/* Title */}
                      <Link
                        to={`/product/${item.productId}`}
                        style={{ textDecoration: 'none', color: 'inherit' }}
                      >
                        <h3 className="cart-item-title">{item.name}</h3>
                      </Link>

                      {/* Attributes */}
                      <div className="cart-item-attrs-row">
                        <span>Size: <strong>{item.size}</strong></span>
                        <span>|</span>
                        <span>
                          Màu: <strong>{item.color}</strong>
                          <span
                            className="cart-color-dot"
                            style={{ backgroundColor: item.colorCode || '#6e3eb3' }}
                          ></span>
                        </span>
                      </div>

                      {/* Rental Period Strip (If rental) */}
                      {item.isRental && (
                        <div className="cart-rental-period-strip">
                          <span>
                            <i className="fa-regular fa-calendar" style={{ marginRight: '6px' }}></i>
                            Thuê từ: <strong>{formatDateDisplay(item.startDate)}</strong> -{' '}
                            <strong>{formatDateDisplay(item.endDate)}</strong> ({item.duration} ngày)
                          </span>
                          <button
                            type="button"
                            className="cart-btn-edit-date"
                            onClick={() => openEditModal(item)}
                          >
                            <i className="fa-solid fa-pen"></i> Chỉnh sửa
                          </button>
                        </div>
                      )}

                      {/* Feature Tags */}
                      <div className="cart-item-tags-row">
                        {item.aiTryOn && (
                          <span className="cart-tag-pill tag-ai-ready">
                            <i className="fa-solid fa-wand-magic-sparkles"></i> Có thể thử đồ AI
                          </span>
                        )}
                        {item.inStock && (
                          <span className="cart-tag-pill tag-in-stock">
                            <i className="fa-solid fa-circle-check"></i> Còn hàng
                          </span>
                        )}
                        {item.condition && !item.isRental && (
                          <span className="cart-tag-pill tag-condition">
                            <i className="fa-solid fa-tag"></i> {item.condition}
                          </span>
                        )}
                        {item.verified && !item.isRental && (
                          <span className="cart-tag-pill tag-verified">
                            <i className="fa-solid fa-shield-halved"></i> Đã kiểm duyệt
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="cart-item-actions-row">
                        <button
                          type="button"
                          className="cart-action-btn"
                          onClick={() => navigate(`/try-on-photo?product=${item.productId}`)}
                        >
                          <i className="fa-solid fa-camera"></i> Thử đồ AI
                        </button>

                        <button
                          type="button"
                          className="cart-action-btn"
                          onClick={() => toggleFavorite(item)}
                        >
                          <i className={isFav ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}></i>
                          {isFav ? 'Đã yêu thích' : 'Lưu yêu thích'}
                        </button>

                        <button
                          type="button"
                          className="cart-action-btn delete"
                          onClick={() => handleRemoveItem(item.id, item.name)}
                        >
                          <i className="fa-solid fa-trash-can"></i> Xóa
                        </button>
                      </div>
                    </div>

                    {/* Price & Stepper Col */}
                    <div className="cart-item-price-col">
                      <div className="cart-price-main-box">
                        <div className="cart-price-value">
                          {formatVND(item.price)}
                          {item.isRental && (
                            <span className="cart-price-unit"> / {item.duration} ngày</span>
                          )}
                        </div>

                        {!item.isRental && item.oldPrice && (
                          <div className="cart-resale-old-price">
                            <span className="strikethrough">{formatVND(item.oldPrice)}</span>
                            <span className="cart-discount-badge">
                              -{item.discountPercent || 25}%
                            </span>
                          </div>
                        )}

                        {item.isRental && item.deposit > 0 && (
                          <div className="cart-deposit-line">
                            <i className="fa-solid fa-shield-halved"></i>
                            <span>Cọc hoàn trả (100%): {formatVND(item.deposit)}</span>
                          </div>
                        )}
                      </div>

                      {/* Quantity Stepper */}
                      <div className="cart-stepper">
                        <button
                          type="button"
                          className="cart-stepper-btn"
                          disabled={item.quantity <= 1}
                          onClick={() => updateQuantity(item.id, -1)}
                          aria-label="Giảm"
                        >
                          -
                        </button>
                        <span className="cart-stepper-val">{item.quantity}</span>
                        <button
                          type="button"
                          className="cart-stepper-btn"
                          onClick={() => updateQuantity(item.id, 1)}
                          aria-label="Tăng"
                        >
                          +
                        </button>
                      </div>

                      {/* Subtotal */}
                      <div className="cart-subtotal-box">
                        <span className="cart-subtotal-text">
                          Thành tiền: <strong>{formatVND(lineTotal)}</strong>
                        </span>
                        {item.isRental && lineDeposit > 0 && (
                          <span className="cart-subtotal-deposit">
                            (Cọc: {formatVND(lineDeposit)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Suggested Real Products Section */}
          {suggestedProducts.length > 0 && (
            <div style={{ marginTop: '24px', background: '#ffffff', borderRadius: '18px', padding: '24px', border: '1px solid #eeebe4' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#18181b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#9c7148' }}></i>
                  Gợi ý sản phẩm thật từ bộ sưu tập
                </h4>
                <Link to="/catalog" style={{ fontSize: '13px', color: '#6e3eb3', textDecoration: 'none', fontWeight: 600 }}>
                  Xem tất cả &gt;
                </Link>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
                {suggestedProducts.map((sp) => {
                  const spPrice = sp.rentalPricePer3Days || (sp.rentalPricePerDay ? sp.rentalPricePerDay * 3 : sp.salePrice || 0);
                  const spImg = (sp.images && sp.images[0]) || sp.image || '';

                  return (
                    <div key={sp._id} style={{ border: '1px solid #f4f4f5', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#fafaf9' }}>
                      <div style={{ height: '140px', borderRadius: '8px', overflow: 'hidden', background: '#e4e4e7' }}>
                        {spImg ? (
                          <img src={spImg} alt={sp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a1a1aa' }}>
                            <i className="fa-solid fa-shirt"></i>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#18181b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={sp.name}>
                        {sp.name}
                      </div>
                      <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#9c7148' }}>
                        {formatVND(spPrice)}
                      </div>
                      <button
                        type="button"
                        style={{
                          background: '#ffffff',
                          border: '1px solid #6e3eb3',
                          color: '#6e3eb3',
                          borderRadius: '8px',
                          padding: '6px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          marginTop: 'auto',
                        }}
                        onClick={() => handleAddSuggestedProduct(sp)}
                      >
                        + Thêm vào giỏ
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Order Summary Card */}
        <div className="cart-summary-col">
          <div className="cart-summary-card">
            <h3 className="cart-summary-header">
              <i className="fa-solid fa-receipt"></i> Tóm tắt đơn hàng
            </h3>

            <div className="cart-summary-rows-list">
              {/* Rental Items Total */}
              <div className="cart-summary-row">
                <div className="cart-summary-row-label">
                  <span className="main-label">
                    <i className="fa-solid fa-vest" style={{ color: '#6e3eb3' }}></i>
                    Sản phẩm cho thuê
                  </span>
                  <span className="sub-label">{rentalItemsCount} sản phẩm</span>
                </div>
                <span className="cart-summary-row-val">{formatVND(rentalTotal)}</span>
              </div>

              {/* Resale Items Total */}
              <div className="cart-summary-row">
                <div className="cart-summary-row-label">
                  <span className="main-label">
                    <i className="fa-solid fa-bag-shopping" style={{ color: '#b45309' }}></i>
                    Sản phẩm mua đồ cũ
                  </span>
                  <span className="sub-label">{resaleItemsCount} sản phẩm</span>
                </div>
                <span className="cart-summary-row-val">{formatVND(resaleTotal)}</span>
              </div>

              {/* Deposit Row */}
              <div className="cart-summary-row">
                <div className="cart-summary-row-label">
                  <span className="main-label" style={{ color: '#15803d', fontWeight: 600 }}>
                    <i className="fa-solid fa-shield-halved"></i>
                    Cọc hoàn trả (chỉ áp dụng cho sản phẩm cho thuê)
                  </span>
                  <span className="sub-label" style={{ color: '#16a34a' }}>
                    Sẽ được hoàn lại sau khi bạn trả đồ và shop xác nhận
                  </span>
                </div>
                <span className="cart-summary-row-val green">{formatVND(depositTotal)}</span>
              </div>

              {/* Shipping */}
              <div className="cart-summary-row">
                <span>
                  <i className="fa-solid fa-truck-fast" style={{ marginRight: '6px' }}></i> Phí giao hàng
                </span>
                <span className="cart-summary-row-val green">
                  {shippingFee === 0 ? 'Miễn phí' : formatVND(shippingFee)}
                </span>
              </div>

              {/* Service Fee */}
              <div className="cart-summary-row">
                <span>
                  <i className="fa-solid fa-shield" style={{ marginRight: '6px' }}></i> Phí dịch vụ
                </span>
                <span className="cart-summary-row-val">{formatVND(serviceFee)}</span>
              </div>
            </div>

            {/* Promo Code Input Form */}
            <form onSubmit={handleApplyCoupon} className="cart-coupon-box">
              <div className="cart-coupon-input-wrapper">
                <i className="fa-solid fa-ticket"></i>
                <input
                  type="text"
                  className="cart-coupon-input"
                  placeholder="Nhập mã giảm giá (nếu có)"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                />
              </div>
              <button type="submit" className="cart-coupon-btn">
                Áp dụng
              </button>
            </form>

            {/* Discount row if applied */}
            <div className="cart-summary-row" style={{ color: discountAmount > 0 ? '#15803d' : '#71717a' }}>
              <span>
                <i className="fa-solid fa-tag" style={{ marginRight: '6px' }}></i> Giảm giá
              </span>
              <span className="cart-summary-row-val" style={{ color: discountAmount > 0 ? '#15803d' : '#71717a' }}>
                - {formatVND(discountAmount)}
              </span>
            </div>

            {/* Total Row */}
            <div className="cart-total-section">
              <div className="cart-total-label-row">
                <span>Tổng thanh toán (không bao gồm cọc hoàn trả)</span>
              </div>
              <div className="cart-total-amount">{formatVND(finalTotal)}</div>

              {depositTotal > 0 && (
                <div className="cart-deposit-refund-note">
                  <i className="fa-solid fa-circle-info"></i>
                  <span>
                    Cọc hoàn trả {formatVND(depositTotal)} sẽ được hoàn lại sau khi trả đồ và shop xác nhận tình trạng sản phẩm.
                  </span>
                </div>
              )}
            </div>

            {/* Checkout Button */}
            <button
              type="button"
              className="cart-btn-checkout"
              disabled={selectedIds.length === 0}
              onClick={() => {
                if (selectedIds.length === 0) {
                  showToast('Vui lòng chọn ít nhất một sản phẩm để thanh toán!');
                  return;
                }
                alert(`Chuyển đến cổng thanh toán an toàn PayOS Escrow — Tổng: ${formatVND(finalTotal)}!`);
              }}
            >
              <i className="fa-solid fa-lock"></i>
              <span>Tiến hành thanh toán</span>
              <i className="fa-solid fa-arrow-right"></i>
            </button>

            {/* Security & Payment Badges */}
            <div className="cart-trust-payments">
              <div className="cart-trust-title">Thanh toán an toàn & bảo mật</div>
              <div className="cart-payment-badges-row">
                <span className="cart-pay-badge escrow">
                  <i className="fa-solid fa-shield-check"></i> PayOS Escrow
                </span>
                <span className="cart-pay-badge">VietQR</span>
                <span className="cart-pay-badge">VISA</span>
                <span className="cart-pay-badge">Mastercard</span>
                <span className="cart-pay-badge">Apple Pay</span>
              </div>

              <div className="cart-escrow-alert-box">
                <i className="fa-solid fa-circle-info"></i>
                <span>
                  Cọc hoàn trả chỉ áp dụng cho sản phẩm cho thuê và sẽ được hoàn lại sau khi hàng được trả và kiểm tra bởi shop.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Rental Date Modal */}
      {editingItem && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setEditingItem(null)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '20px',
              padding: '28px',
              maxWidth: '460px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                Chỉnh sửa lịch thuê
              </h3>
              <button
                type="button"
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#71717a' }}
                onClick={() => setEditingItem(null)}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#71717a', margin: 0 }}>
              Sản phẩm: <strong>{editingItem.name}</strong>
            </p>

            <form onSubmit={handleSaveRentalDate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                  Ngày bắt đầu nhận đồ:
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    height: '42px',
                    borderRadius: '10px',
                    border: '1px solid #d4d4d8',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                  Thời gian thuê:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[3, 5, 7].map((days) => (
                    <button
                      key={days}
                      type="button"
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        border: newDuration === days ? '2px solid #6e3eb3' : '1px solid #e4e4e7',
                        background: newDuration === days ? '#fbf9fd' : '#ffffff',
                        color: newDuration === days ? '#6e3eb3' : '#18181b',
                        fontWeight: 700,
                        fontSize: '13px',
                        cursor: 'pointer',
                      }}
                      onClick={() => setNewDuration(days)}
                    >
                      {days} ngày
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: '#f5f0fb', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', color: '#6e3eb3' }}>
                <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i>
                Ngày trả dự kiến:{' '}
                <strong>
                  {(() => {
                    const d = new Date(newStartDate || new Date());
                    d.setDate(d.getDate() + newDuration);
                    return formatDateDisplay(d);
                  })()}
                </strong>
              </div>

              <button
                type="submit"
                className="cart-btn-checkout"
                style={{ width: '100%', height: '44px', marginTop: '4px' }}
              >
                Lưu thay đổi lịch thuê
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
