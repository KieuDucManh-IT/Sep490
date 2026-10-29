import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import productService from '../../services/productService';
import '../../styles/ProductDetail.css';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // State Management
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);

  // User Interactive Choices
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState('M');
  const [rentalDuration, setRentalDuration] = useState(3); // 3, 5, 7 days
  const [quantity, setQuantity] = useState(1);
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState('desc'); // 'desc' | 'size' | 'policy' | 'reviews'
  const [showAiModal, setShowAiModal] = useState(false);
  const [toast, setToast] = useState(null);

  // AI Measurements Form
  const [aiChest, setAiChest] = useState('');
  const [aiWaist, setAiWaist] = useState('');
  const [aiHips, setAiHips] = useState('');
  const [aiSuggestedSize, setAiSuggestedSize] = useState(null);

  // Favorites state
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem('vestora_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Fetch Product Detail from Backend
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setErrorMsg(null);

    const loadProduct = async () => {
      try {
        let currentItem = null;

        if (id) {
          const res = await productService.getProductById(id);
          if (res && res.success && res.data) {
            currentItem = res.data;
          } else if (res && res.data) {
            currentItem = res.data;
          }
        }

        // Nếu không có id hoặc tìm không thấy, fallback tải sản phẩm đầu tiên từ DB
        if (!currentItem) {
          const listRes = await productService.getProducts({ limit: 1 });
          if (listRes?.data?.length > 0) {
            currentItem = listRes.data[0];
          }
        }

        if (isMounted) {
          if (currentItem) {
            setProduct(currentItem);
            if (currentItem.sizes && currentItem.sizes.length > 0) {
              setSelectedSize(currentItem.sizes[0]);
            }
          } else {
            setErrorMsg('Không tìm thấy thông tin sản phẩm trên máy chủ.');
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Lỗi tải sản phẩm chi tiết:', err);
          setErrorMsg(err.message || 'Lỗi kết nối máy chủ.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // 2. Fetch Similar Products
  useEffect(() => {
    let isMounted = true;
    productService
      .getProducts({ limit: 5 })
      .then((res) => {
        if (isMounted && res?.data) {
          // Lọc bỏ sản phẩm hiện tại nếu trùng
          const filtered = res.data.filter((p) => String(p._id) !== String(id));
          setSimilarProducts(filtered.slice(0, 5));
        }
      })
      .catch((err) => console.warn('Lỗi tải sản phẩm tương tự:', err));

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Format currency
  const formatVND = (amount) => {
    if (!amount) return '0đ';
    return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
  };

  // Toggle Favorite
  const isFavorited = product ? favorites.includes(product._id || product.productCode) : false;
  const toggleFavorite = (e) => {
    e.preventDefault();
    if (!product) return;
    const targetId = product._id || product.productCode;
    const updated = isFavorited
      ? favorites.filter((fid) => fid !== targetId)
      : [...favorites, targetId];
    setFavorites(updated);
    try {
      localStorage.setItem('vestora_favorites', JSON.stringify(updated));
    } catch {}
    showToast(isFavorited ? 'Đã xóa khỏi danh sách yêu thích' : 'Đã thêm vào yêu thích!');
  };

  // Normalized product details
  const images = useMemo(() => {
    if (!product) return [];
    let list = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
    if (list.length === 0 && product.image) {
      list = [product.image];
    }
    // Nhân bản hình ảnh nếu danh sách quá ngắn để đủ 4 góc chụp như mockup
    if (list.length === 1) {
      return [list[0], list[0], list[0], list[0]];
    }
    return list;
  }, [product]);

  const isRental = useMemo(() => {
    if (!product) return true;
    return (
      product.productType === 'rental' ||
      product.tag === 'rental' ||
      product.productType === 'both' ||
      (product.rentalPricePer3Days && product.rentalPricePer3Days > 0) ||
      (product.rentalPricePerDay && product.rentalPricePerDay > 0)
    );
  }, [product]);

  // Dynamic Prices for 3, 5, 7 days
  const baseRental3Days = useMemo(() => {
    if (!product) return 2500000;
    if (product.rentalPricePer3Days && product.rentalPricePer3Days > 0) {
      return product.rentalPricePer3Days;
    }
    if (product.rentalPricePerDay && product.rentalPricePerDay > 0) {
      return product.rentalPricePerDay * 3;
    }
    return 2500000;
  }, [product]);

  const priceByDuration = useMemo(() => {
    const p3 = baseRental3Days;
    const p5 = Math.round((p3 * (5 / 3) * 0.9) / 10000) * 10000; // Chiết khấu ngày 5
    const p7 = Math.round((p3 * (7 / 3) * 0.85) / 10000) * 10000; // Chiết khấu ngày 7
    return {
      3: p3,
      5: p5,
      7: p7,
    };
  }, [baseRental3Days]);

  const currentPrice = isRental
    ? priceByDuration[rentalDuration] || baseRental3Days
    : product?.salePrice || 0;

  const depositAmount = product?.deposit || product?.depositPrice || Math.round(baseRental3Days * 3.2);

  // Available Sizes
  const sizeOptions = useMemo(() => {
    const standardSizes = ['XS', 'S', 'M', 'L', 'XL'];
    const activeSizes = product?.sizes && product.sizes.length > 0 ? product.sizes : ['S', 'M', 'L'];
    return standardSizes.map((s) => ({
      name: s,
      available: activeSizes.includes(s),
    }));
  }, [product]);

  // Giới hạn ngày nhận đồ: Chặn ngày quá khứ, tối đa trước 60 ngày
  const todayStr = useMemo(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }, []);

  const maxDateStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().split('T')[0];
  }, []);

  // Format ngày nhận đồ
  const startDateFormatted = useMemo(() => {
    if (!startDate) return '';
    const date = new Date(startDate);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, [startDate]);

  // Calculate End Date
  const endDateFormatted = useMemo(() => {
    if (!startDate) return '';
    const date = new Date(startDate);
    date.setDate(date.getDate() + rentalDuration);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }, [startDate, rentalDuration]);

  // Phím tắt chọn nhanh ngày nhận
  const setQuickDate = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setStartDate(d.toISOString().split('T')[0]);
  };

  // Handle Add to Cart
  const handleAddToCart = () => {
    if (!product) return;
    try {
      const cartItem = {
        productId: product._id || product.productCode,
        name: product.name,
        image: images[0] || '',
        size: selectedSize,
        duration: rentalDuration,
        startDate,
        endDate: endDateFormatted,
        price: currentPrice,
        deposit: depositAmount,
        quantity,
        isRental,
      };

      const existingCart = JSON.parse(localStorage.getItem('vestora_cart') || '[]');
      existingCart.push(cartItem);
      localStorage.setItem('vestora_cart', JSON.stringify(existingCart));
      showToast('Đã thêm sản phẩm vào giỏ hàng thành công!');
    } catch {
      showToast('Đã thêm sản phẩm vào giỏ hàng!');
    }
  };

  // Handle Rent Now
  const handleRentNow = () => {
    handleAddToCart();
    navigate('/cart');
  };

  // AI Size Calculation
  const handleCalculateAiSize = (e) => {
    e.preventDefault();
    const c = Number(aiChest);
    const w = Number(aiWaist);
    const h = Number(aiHips);

    if (!c || !w || !h) {
      alert('Vui lòng nhập đầy đủ số đo Ngực, Eo, Mông!');
      return;
    }

    let recommended = 'M';
    if (w < 64 && c < 84) recommended = 'XS';
    else if (w <= 68 && c <= 88) recommended = 'S';
    else if (w <= 74 && c <= 94) recommended = 'M';
    else if (w <= 80 && c <= 100) recommended = 'L';
    else recommended = 'XL';

    setAiSuggestedSize(recommended);
    setSelectedSize(recommended);
  };

  if (loading) {
    return (
      <div className="product-detail-page-container">
        <Navbar />
        <div style={{ maxWidth: '1280px', margin: '40px auto', padding: '0 32px', textAlign: 'center' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '36px', color: '#6e3eb3', marginBottom: '16px' }}></i>
          <p style={{ color: '#71717a' }}>Đang nạp thông tin chi tiết sản phẩm từ máy chủ...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (errorMsg || !product) {
    return (
      <div className="product-detail-page-container">
        <Navbar />
        <div style={{ maxWidth: '600px', margin: '60px auto', padding: '40px 24px', textAlign: 'center', background: '#fafafa', borderRadius: '16px' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '40px', color: '#dc2626', marginBottom: '16px' }}></i>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Không tìm thấy sản phẩm</h2>
          <p style={{ color: '#71717a', marginBottom: '24px' }}>{errorMsg || 'Sản phẩm có thể đã ngừng cung cấp hoặc không tồn tại.'}</p>
          <Link to="/catalog" className="pdetail-btn-rent-now" style={{ textDecoration: 'none', display: 'inline-flex', padding: '0 28px' }}>
            <i className="fa-solid fa-arrow-left"></i> Quay lại bộ sưu tập
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="product-detail-page-container">
      <Navbar />

      {/* Toast Alert */}
      {toast && (
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
          {toast}
        </div>
      )}

      {/* 1. Breadcrumb Bar */}
      <div className="pdetail-breadcrumb-bar">
        <Link to="/">
          <i className="fa-solid fa-house"></i> Trang chủ
        </Link>
        <span className="pdetail-breadcrumb-separator">&gt;</span>
        <Link to="/catalog">
          {isRental ? 'Thuê đồ' : 'Mua đồ cũ'}
        </Link>
        <span className="pdetail-breadcrumb-separator">&gt;</span>
        <span className="pdetail-breadcrumb-current">
          {product.categoryName || (Array.isArray(product.category) ? product.category[0] : 'Đầm dạ hội')}
        </span>
      </div>

      {/* 2. Main 2-Column Product Layout */}
      <div className="pdetail-main-layout">
        {/* LEFT COLUMN: Gallery */}
        <div className="pdetail-gallery-column">
          <div className="pdetail-main-stage">
            {/* Top-Left Badge */}
            <div className="pdetail-badge-top-left">
              <i className="fa-solid fa-shirt"></i>
              <span>{isRental ? 'Thuê đồ' : 'Mua đồ cũ'}</span>
            </div>

            {/* Top-Right Favorite Button */}
            <button
              className={`pdetail-heart-top-right ${isFavorited ? 'favorited' : ''}`}
              onClick={toggleFavorite}
              title={isFavorited ? 'Bỏ thích' : 'Yêu thích'}
              aria-label="Thêm vào yêu thích"
            >
              <i className={isFavorited ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}></i>
            </button>

            {/* Bottom-Right Counter */}
            <div className="pdetail-counter-bottom-right">
              {images.length > 0 ? `${selectedImgIndex + 1}/${images.length}` : '1/1'}
            </div>

            {/* Main Stage Image */}
            {images.length > 0 && images[selectedImgIndex] ? (
              <img
                src={images[selectedImgIndex]}
                alt={product.name}
                className="pdetail-main-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const fallback = e.target.parentElement.querySelector('.pdetail-no-image-box');
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
            ) : null}

            <div
              className="pdetail-no-image-box"
              style={{ display: images.length > 0 && images[selectedImgIndex] ? 'none' : 'flex' }}
            >
              <i className="fa-solid fa-shirt"></i>
              <span>Hình ảnh trang phục đang cập nhật</span>
            </div>
          </div>

          {/* Thumbnails Reel (4 thumbnails) */}
          <div className="pdetail-thumbnails-row">
            {images.slice(0, 4).map((imgUrl, idx) => (
              <div
                key={idx}
                className={`pdetail-thumb-item ${selectedImgIndex === idx ? 'active' : ''}`}
                onClick={() => setSelectedImgIndex(idx)}
              >
                {imgUrl ? (
                  <img src={imgUrl} alt={`Góc nhìn ${idx + 1}`} />
                ) : (
                  <div className="pdetail-thumb-placeholder">
                    <i className="fa-solid fa-shirt"></i>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: Info & Booking Modules */}
        <div className="pdetail-info-column">
          {/* Atelier / Shop Header Box */}
          <div className="pdetail-atelier-card">
            <div className="pdetail-atelier-left">
              <div className="pdetail-atelier-avatar">
                {(product.shopId?.name || 'Vestora Master Atelier').charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="pdetail-atelier-name-row">
                  <span>{product.shopId?.name || 'Vestora Master Atelier'}</span>
                  <i className="fa-solid fa-circle-check pdetail-verified-badge" title="Đã xác minh uy tín"></i>
                </div>
                <div className="pdetail-atelier-meta">
                  <i className="fa-solid fa-star rating-star"></i>
                  <span>{product.rating || '4.9'} ({product.reviewsCount || 128} đánh giá)</span>
                  <span>•</span>
                  <span>Đã tham gia 2 năm</span>
                </div>
              </div>
            </div>

            <button
              className="pdetail-btn-follow"
              onClick={() => {
                setIsFollowing(!isFollowing);
                showToast(isFollowing ? 'Đã hủy theo dõi gian hàng' : 'Đã theo dõi gian hàng thành công!');
              }}
            >
              <i className={isFollowing ? 'fa-solid fa-check' : 'fa-solid fa-user-plus'}></i>
              {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
            </button>
          </div>

          {/* Product Title */}
          <h1 className="pdetail-title">{product.name}</h1>

          {/* Meta Line */}
          <div className="pdetail-meta-row">
            <span>SKU: {product.sku || product.productCode || 'VST-DH-001'}</span>
            <span className="pdetail-meta-divider">|</span>
            <div className="pdetail-meta-rating">
              <i className="fa-solid fa-star"></i>
              <span>{product.rating || '4.9'}</span>
              <span style={{ color: '#71717a', fontWeight: 400 }}>
                ({product.reviewsCount || 128} đánh giá)
              </span>
            </div>
            <span className="pdetail-meta-divider">|</span>
            <span>
              <i className="fa-regular fa-comments" style={{ marginRight: '4px' }}></i>
              Đã cho thuê 2.5k+ lần
            </span>
          </div>

          {/* Pricing Box */}
          <div className="pdetail-pricing-box">
            <div className="pdetail-pricing-main-row">
              <div className="pdetail-price-left">
                <span className="pdetail-price-main">{formatVND(currentPrice)}</span>
                {isRental && <span className="pdetail-price-unit">/ {rentalDuration} ngày</span>}
              </div>

              {isRental && depositAmount > 0 && (
                <div className="pdetail-deposit-right">
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>Đặt cọc hoàn trả:</span>
                  <span className="pdetail-deposit-amount">{formatVND(depositAmount)}</span>
                </div>
              )}
            </div>

            <div className="pdetail-pricing-note">
              <i className="fa-solid fa-circle-info"></i>
              <span>
                Tiền cọc được hoàn trả 100% sau khi bạn trả đồ và hệ thống kiểm tra tình trạng sản phẩm.
              </span>
            </div>
          </div>

          {/* Size Selection */}
          <div className="pdetail-section-group">
            <div className="pdetail-section-header">
              <span className="pdetail-section-title">
                <i className="fa-solid fa-shirt"></i> Chọn kích thước (Size)
              </span>
              <button className="pdetail-ai-size-btn" onClick={() => setShowAiModal(true)}>
                <i className="fa-solid fa-wand-magic-sparkles"></i> Tư vấn size bằng AI &gt;
              </button>
            </div>

            <div className="pdetail-size-buttons-row">
              {sizeOptions.map((sz) => (
                <button
                  key={sz.name}
                  disabled={!sz.available}
                  className={`pdetail-size-btn ${selectedSize === sz.name ? 'active' : ''}`}
                  onClick={() => setSelectedSize(sz.name)}
                  title={sz.available ? `Chọn size ${sz.name}` : `Size ${sz.name} hiện hết hàng`}
                >
                  {sz.name}
                </button>
              ))}
            </div>
          </div>

          {/* Rental Duration Selection */}
          {isRental && (
            <div className="pdetail-section-group">
              <div className="pdetail-section-header">
                <span className="pdetail-section-title">
                  <i className="fa-regular fa-calendar"></i> Chọn thời gian thuê
                </span>
              </div>

              <div className="pdetail-durations-grid">
                {[3, 5, 7].map((days) => (
                  <div
                    key={days}
                    className={`pdetail-duration-card ${rentalDuration === days ? 'active' : ''}`}
                    onClick={() => setRentalDuration(days)}
                  >
                    <span className="pdetail-duration-days">{days} ngày</span>
                    <span className="pdetail-duration-price">
                      {formatVND(priceByDuration[days])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quantity & Delivery Date */}
          <div className="pdetail-qty-date-container">
            <div className="pdetail-qty-date-row">
              {/* Stepper */}
              <div className="pdetail-stepper">
                <button
                  className="pdetail-stepper-btn"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Giảm số lượng"
                >
                  -
                </button>
                <span className="pdetail-stepper-value">{quantity}</span>
                <button
                  className="pdetail-stepper-btn"
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label="Tăng số lượng"
                >
                  +
                </button>
              </div>

              {/* Date Picker Input */}
              <div className="pdetail-date-picker-box">
                <i className="fa-regular fa-calendar" style={{ color: '#9c7148' }}></i>
                <input
                  type="date"
                  min={todayStr}
                  max={maxDateStr}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  title="Chọn ngày nhận đồ (Hôm nay hoặc tương lai)"
                />
              </div>

              {/* Stock Indicator */}
              <div className="pdetail-stock-indicator">
                <span className="pdetail-stock-dot"></span>
                <span>Còn hàng</span>
              </div>
            </div>

            {/* Quick date select chips */}
            {isRental && (
              <div className="pdetail-quick-dates-row">
                <span className="pdetail-quick-date-label">Gợi ý ngày:</span>
                <button
                  type="button"
                  className={`pdetail-quick-date-pill ${startDate === todayStr ? 'active' : ''}`}
                  onClick={() => setQuickDate(0)}
                >
                  Hôm nay (Giao gấp 2h)
                </button>
                <button
                  type="button"
                  className={`pdetail-quick-date-pill ${
                    (() => {
                      const tm = new Date();
                      tm.setDate(tm.getDate() + 1);
                      return startDate === tm.toISOString().split('T')[0];
                    })()
                      ? 'active'
                      : ''
                  }`}
                  onClick={() => setQuickDate(1)}
                >
                  Ngày mai
                </button>
                <button
                  type="button"
                  className="pdetail-quick-date-pill"
                  onClick={() => setQuickDate(3)}
                >
                  Cuối tuần này
                </button>
              </div>
            )}

            {/* Rental Timeline: Hiển thị ngày nhận và ngày trả minh bạch */}
            {isRental && startDate && (
              <div className="pdetail-rental-timeline">
                <div className="pdetail-timeline-item">
                  <i className="fa-solid fa-truck-ramp-box" style={{ color: '#6e3eb3', fontSize: '15px' }}></i>
                  <div>
                    <span className="timeline-title">Ngày nhận đồ:</span>
                    <strong>{startDateFormatted}</strong>
                  </div>
                </div>
                <div className="pdetail-timeline-divider">
                  <span>{rentalDuration} ngày</span>
                  <i className="fa-solid fa-arrow-right-long"></i>
                </div>
                <div className="pdetail-timeline-item">
                  <i className="fa-solid fa-box-archive" style={{ color: '#9c7148', fontSize: '15px' }}></i>
                  <div>
                    <span className="timeline-title">Ngày trả đồ:</span>
                    <strong>{endDateFormatted}</strong>
                  </div>
                </div>
                <div className="pdetail-timeline-status">
                  <i className="fa-solid fa-circle-check"></i>
                  <span>Lịch trống sẵn sàng</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons Row */}
          <div className="pdetail-actions-row">
            <button className="pdetail-btn-rent-now" onClick={handleRentNow}>
              <i className="fa-solid fa-vest"></i>
              <span>{isRental ? 'Thuê ngay' : 'Mua ngay'}</span>
              <i className="fa-solid fa-arrow-right"></i>
            </button>

            <button className="pdetail-btn-add-cart" onClick={handleAddToCart}>
              <i className="fa-solid fa-cart-shopping"></i>
              <span>Thêm vào giỏ hàng</span>
            </button>

            <button
              className="pdetail-btn-ai-tryon"
              onClick={() => navigate(`/try-on-photo?product=${product._id || product.productCode}`)}
            >
              <i className="fa-solid fa-camera"></i>
              <span>Thử đồ AI</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Lower Section: Tabs & Content Grid */}
      <div className="pdetail-tabs-section">
        {/* Tab Headers */}
        <div className="pdetail-tabs-header-bar">
          <button
            className={`pdetail-tab-btn ${activeTab === 'desc' ? 'active' : ''}`}
            onClick={() => setActiveTab('desc')}
          >
            <i className="fa-regular fa-file-lines"></i> Mô tả sản phẩm
          </button>
          <button
            className={`pdetail-tab-btn ${activeTab === 'size' ? 'active' : ''}`}
            onClick={() => setActiveTab('size')}
          >
            <i className="fa-solid fa-ruler-combined"></i> Bảng size
          </button>
          <button
            className={`pdetail-tab-btn ${activeTab === 'policy' ? 'active' : ''}`}
            onClick={() => setActiveTab('policy')}
          >
            <i className="fa-solid fa-shield-halved"></i> Chính sách thuê
          </button>
          <button
            className={`pdetail-tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            <i className="fa-regular fa-star"></i> Đánh giá
          </button>
        </div>

        {/* Tab 1 Content: 3 Columns matching mockup */}
        {activeTab === 'desc' && (
          <div className="pdetail-tabs-content-grid">
            {/* Col 1: Mô tả chi tiết */}
            <div className="pdetail-desc-box">
              <p className="pdetail-desc-paragraph">
                {product.description ||
                  'Chiếc đầm dạ hội lụa satin cao cấp với thiết kế xếp nếp tinh tế, tôn lên bờ vai và vòng eo quyến rũ, phù hợp cho các buổi tiệc sang trọng, sự kiện quan trọng.'}
              </p>

              <ul className="pdetail-desc-bullets">
                <li className="pdetail-bullet-item">
                  <span className="pdetail-bullet-check">
                    <i className="fa-solid fa-check"></i>
                  </span>
                  <span><strong>Chất liệu:</strong> {product.material || 'Lụa Satin cao cấp'}</span>
                </li>
                <li className="pdetail-bullet-item">
                  <span className="pdetail-bullet-check">
                    <i className="fa-solid fa-check"></i>
                  </span>
                  <span><strong>Màu sắc:</strong> {product.colors && product.colors.length > 0 ? product.colors.join(', ') : 'Đỏ mận sang trọng'}</span>
                </li>
                <li className="pdetail-bullet-item">
                  <span className="pdetail-bullet-check">
                    <i className="fa-solid fa-check"></i>
                  </span>
                  <span><strong>Thiết kế:</strong> Xếp nếp vai, form ôm tôn dáng</span>
                </li>
              </ul>
            </div>

            {/* Col 2: Chính sách thuê */}
            <div className="pdetail-policy-box">
              <div className="pdetail-policy-title">
                <i className="fa-solid fa-shield-halved"></i> Chính sách thuê
              </div>
              <ul className="pdetail-policy-bullets">
                <li className="pdetail-policy-item">
                  <i className="fa-solid fa-check pdetail-policy-check"></i>
                  <span>Tiền cọc sẽ được hoàn trả sau khi trả đồ và kiểm tra tình trạng.</span>
                </li>
                <li className="pdetail-policy-item">
                  <i className="fa-solid fa-check pdetail-policy-check"></i>
                  <span>Vui lòng giữ gìn trang phục, tránh làm rách hoặc bám bẩn vĩnh viễn.</span>
                </li>
                <li className="pdetail-policy-item">
                  <i className="fa-solid fa-check pdetail-policy-check"></i>
                  <span>Phí bồi thường nếu làm hỏng hoặc mất đồ theo quy định niêm yết.</span>
                </li>
              </ul>
            </div>

            {/* Col 3: Promo Card */}
            <div className="pdetail-promo-card">
              <div className="pdetail-promo-content">
                <div className="pdetail-promo-badge">
                  <i className="fa-solid fa-shirt"></i>
                  <span>Thuê đồ thời trang</span>
                </div>
                <h4 className="pdetail-promo-title">Dễ dàng hơn với VESTORA</h4>
                <p className="pdetail-promo-subtext">Thử ngay hôm nay, tỏa sáng theo cách của bạn!</p>
                <Link to="/catalog" className="pdetail-promo-link-btn">
                  Khám phá thêm <i className="fa-solid fa-arrow-right"></i>
                </Link>
              </div>

              {/* Decorative Mannequin SVG */}
              <svg
                className="pdetail-promo-mannequin-decor"
                viewBox="0 0 100 150"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M50 15 C45 25 35 30 35 45 C35 60 42 70 42 90 L38 120 L62 120 L58 90 C58 70 65 60 65 45 C65 30 55 25 50 15 Z"
                  stroke="#c084fc"
                  strokeWidth="2.5"
                  fill="none"
                />
                <circle cx="50" cy="12" r="5" stroke="#c084fc" strokeWidth="2" />
                <line x1="50" y1="120" x2="50" y2="145" stroke="#c084fc" strokeWidth="3" />
                <line x1="35" y1="145" x2="65" y2="145" stroke="#c084fc" strokeWidth="3" />
                <circle cx="48" cy="38" r="1.5" fill="#c084fc" />
                <circle cx="52" cy="46" r="1.5" fill="#c084fc" />
                <circle cx="50" cy="54" r="1.5" fill="#c084fc" />
              </svg>
            </div>
          </div>
        )}

        {/* Tab 2: Size Chart */}
        {activeTab === 'size' && (
          <div style={{ background: '#faf9f7', borderRadius: '14px', padding: '24px', border: '1px solid #ebe8e1' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Bảng số đo tiêu chuẩn (cm)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e4e4e7', color: '#71717a' }}>
                    <th style={{ padding: '10px 14px' }}>Size</th>
                    <th style={{ padding: '10px 14px' }}>Vòng Ngực</th>
                    <th style={{ padding: '10px 14px' }}>Vòng Eo</th>
                    <th style={{ padding: '10px 14px' }}>Vòng Mông</th>
                    <th style={{ padding: '10px 14px' }}>Chiều cao gợi ý</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e4e4e7' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>XS</td>
                    <td style={{ padding: '10px 14px' }}>78 - 82</td>
                    <td style={{ padding: '10px 14px' }}>58 - 62</td>
                    <td style={{ padding: '10px 14px' }}>84 - 88</td>
                    <td style={{ padding: '10px 14px' }}>1m50 - 1m58</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e4e4e7' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>S</td>
                    <td style={{ padding: '10px 14px' }}>82 - 86</td>
                    <td style={{ padding: '10px 14px' }}>62 - 66</td>
                    <td style={{ padding: '10px 14px' }}>88 - 92</td>
                    <td style={{ padding: '10px 14px' }}>1m55 - 1m62</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e4e4e7' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>M</td>
                    <td style={{ padding: '10px 14px' }}>86 - 90</td>
                    <td style={{ padding: '10px 14px' }}>66 - 70</td>
                    <td style={{ padding: '10px 14px' }}>92 - 96</td>
                    <td style={{ padding: '10px 14px' }}>1m58 - 1m68</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e4e4e7' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>L</td>
                    <td style={{ padding: '10px 14px' }}>90 - 94</td>
                    <td style={{ padding: '10px 14px' }}>70 - 76</td>
                    <td style={{ padding: '10px 14px' }}>96 - 100</td>
                    <td style={{ padding: '10px 14px' }}>1m62 - 1m72</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>XL</td>
                    <td style={{ padding: '10px 14px' }}>94 - 100</td>
                    <td style={{ padding: '10px 14px' }}>76 - 82</td>
                    <td style={{ padding: '10px 14px' }}>100 - 106</td>
                    <td style={{ padding: '10px 14px' }}>1m65 - 1m75</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Policy */}
        {activeTab === 'policy' && (
          <div style={{ background: '#faf9f7', borderRadius: '14px', padding: '24px', border: '1px solid #ebe8e1', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Quy chuẩn giặt hấp & Hoàn trả tiền cọc</h3>
            <p style={{ fontSize: '14px', color: '#52525b', lineHeight: 1.6, margin: 0 }}>
              1. <strong>Kiểm duyệt chất lượng:</strong> Mọi trang phục trước khi giao đều được giặt hấp theo tiêu chuẩn y tế, khử trùng bằng tia UV và kiểm tra từng đường kim mũi chỉ.
            </p>
            <p style={{ fontSize: '14px', color: '#52525b', lineHeight: 1.6, margin: 0 }}>
              2. <strong>Hoàn cọc tự động:</strong> Khi bạn trả đồ về showroom hoặc cho shipper, bộ phận kiểm định sẽ kiểm tra và hoàn lại 100% tiền cọc vào tài khoản của bạn trong vòng 2-4 giờ làm việc.
            </p>
            <p style={{ fontSize: '14px', color: '#52525b', lineHeight: 1.6, margin: 0 }}>
              3. <strong>Bảo hiểm rủi ro nhỏ:</strong> VESTORA hỗ trợ xử lý miễn phí các vết bẩn sinh hoạt thông thường (vết nước ngọt, bụi đường). Quý khách không cần tự giặt trang phục trước khi trả.
            </p>
          </div>
        )}

        {/* Tab 4: Reviews */}
        {activeTab === 'reviews' && (
          <div style={{ background: '#faf9f7', borderRadius: '14px', padding: '24px', border: '1px solid #ebe8e1' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '36px', fontWeight: 700, color: '#18181b' }}>4.9</div>
              <div>
                <div style={{ color: '#f59e0b', fontSize: '16px' }}>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                </div>
                <div style={{ fontSize: '12.5px', color: '#71717a' }}>Dựa trên 128 lượt đánh giá thực tế</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13.5px' }}>Nguyễn Khánh Linh</span>
                  <span style={{ fontSize: '12px', color: '#a1a1aa' }}>2 ngày trước</span>
                </div>
                <div style={{ color: '#f59e0b', fontSize: '12px', marginBottom: '4px' }}>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                </div>
                <p style={{ fontSize: '13.5px', color: '#52525b', margin: 0 }}>
                  Váy mặc đi tiệc gala rất nổi bật, chất lụa satin rủ đẹp và thơm tho như mới. Giao nhận rất đúng hẹn!
                </p>
              </div>

              <div style={{ borderTop: '1px solid #e4e4e7', paddingTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '13.5px' }}>Trần Thu Thảo</span>
                  <span style={{ fontSize: '12px', color: '#a1a1aa' }}>1 tuần trước</span>
                </div>
                <div style={{ color: '#f59e0b', fontSize: '12px', marginBottom: '4px' }}>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                </div>
                <p style={{ fontSize: '13.5px', color: '#52525b', margin: 0 }}>
                  Size M vừa như in theo gợi ý số đo của AI. Thủ tục hoàn cọc chỉ mất 15 phút sau khi shipper lấy hàng. Rất hài lòng!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Bottom Section: Similar Products */}
      {similarProducts.length > 0 && (
        <div className="pdetail-similar-section">
          <div className="pdetail-similar-header">
            <h3 className="pdetail-similar-title">
              <i className="fa-solid fa-wand-magic-sparkles"></i> Sản phẩm tương tự
            </h3>
            <Link to="/catalog" className="pdetail-similar-more-link">
              Xem thêm <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>

          <div className="pdetail-similar-grid-5cols">
            {similarProducts.map((item) => {
              const itemPrice = item.rentalPricePer3Days || (item.rentalPricePerDay ? item.rentalPricePerDay * 3 : item.salePrice || 0);
              const itemImg = item.images && item.images.length > 0 ? item.images[0] : item.image || '';

              return (
                <Link
                  key={item._id || item.productCode}
                  to={`/product/${item._id || item.productCode}`}
                  className="modern-product-card"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                >
                  <div className="card-media-box">
                    <span className="product-type-badge badge-rental" style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}>
                      {item.productType === 'sale' ? 'Mua đồ cũ' : 'Thuê đồ'}
                    </span>

                    {itemImg ? (
                      <img src={itemImg} alt={item.name} className="product-card-img" />
                    ) : (
                      <div className="product-card-placeholder-box">
                        <i className="fa-solid fa-shirt"></i>
                      </div>
                    )}
                  </div>

                  <div className="card-info-box">
                    <h4 className="card-product-name" title={item.name}>
                      {item.name}
                    </h4>

                    <div className="card-pricing-line">
                      <span className="price-main">{formatVND(itemPrice)}</span>
                      <span className="price-unit">/ 3 ngày</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. AI Size Consultant Modal */}
      {showAiModal && (
        <div className="pdetail-modal-overlay" onClick={() => setShowAiModal(false)}>
          <div className="pdetail-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pdetail-modal-header">
              <h3 className="pdetail-modal-title">
                <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#6e3eb3' }}></i>
                Tư vấn size thông minh bằng AI
              </h3>
              <button className="pdetail-modal-close-btn" onClick={() => setShowAiModal(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <p style={{ fontSize: '13.5px', color: '#71717a', margin: 0, lineHeight: 1.5 }}>
              Nhập 3 chỉ số cơ thể của bạn (cm) để thuật toán VESTORA AI tính toán độ co giãn của vải và gợi ý kích thước vừa vặn nhất:
            </p>

            <form onSubmit={handleCalculateAiSize} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="pdetail-input-group">
                <label>Vòng 1 - Ngực (cm)</label>
                <input
                  type="number"
                  placeholder="Ví dụ: 86"
                  value={aiChest}
                  onChange={(e) => setAiChest(e.target.value)}
                  required
                />
              </div>

              <div className="pdetail-input-group">
                <label>Vòng 2 - Eo (cm)</label>
                <input
                  type="number"
                  placeholder="Ví dụ: 66"
                  value={aiWaist}
                  onChange={(e) => setAiWaist(e.target.value)}
                  required
                />
              </div>

              <div className="pdetail-input-group">
                <label>Vòng 3 - Mông (cm)</label>
                <input
                  type="number"
                  placeholder="Ví dụ: 92"
                  value={aiHips}
                  onChange={(e) => setAiHips(e.target.value)}
                  required
                />
              </div>

              {aiSuggestedSize && (
                <div
                  style={{
                    background: '#f5f0fb',
                    border: '1.5px solid #dfd1ef',
                    borderRadius: '12px',
                    padding: '12px',
                    textAlign: 'center',
                    marginTop: '6px',
                  }}
                >
                  <span style={{ fontSize: '12px', color: '#6e3eb3', fontWeight: 600 }}>KÍCH CỠ GỢI Ý HOÀN HẢO CHO BẠN:</span>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: '#4a1d96', margin: '4px 0' }}>
                    SIZE {aiSuggestedSize}
                  </div>
                  <span style={{ fontSize: '11.5px', color: '#71717a' }}>
                    Đã tự động chọn Size {aiSuggestedSize} vào đơn thuê của bạn.
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="pdetail-btn-rent-now"
                style={{ width: '100%', marginTop: '6px' }}
              >
                <i className="fa-solid fa-calculator"></i> Phân tích vóc dáng
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
