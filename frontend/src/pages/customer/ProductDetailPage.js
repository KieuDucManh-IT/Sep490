import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import productService from '../../services/productService';
import chatApi from '../../services/chatApi';
import { useAuth } from '../../context/AuthContext';
import { getUserLocation } from '../../utils/userLocation';
import { calculateHaversineDistanceKm, formatDistanceLabel } from '../../utils/geoUtils';
import { PROVINCE_DEFAULT_COORDS } from '../owner/branches/utils/branchConstants';
import '../../styles/ProductDetail.css';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State Management
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [similarProducts, setSimilarProducts] = useState([]);

  // User Interactive Choices
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState('M');
  const [rentalDuration, setRentalDuration] = useState(1); // 3, 5, 7 days
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
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [userLoc, setUserLoc] = useState(() => getUserLocation());

  useEffect(() => {
    const onLocChange = () => setUserLoc(getUserLocation());
    window.addEventListener('userLocationChanged', onLocChange);
    return () => window.removeEventListener('userLocationChanged', onLocChange);
  }, []);

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
      window.dispatchEvent(new Event('favoritesUpdated'));
    } catch { }
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

  // Ép kiểu Boolean chuẩn xác 100%, không bao giờ trả về số 0
  const isRental = useMemo(() => {
    if (!product) return true;
    return Boolean(
      product.tag === 'rental' ||
      product.tag === 'rental' ||
      product.tag === 'both' ||
      Number(product.rentalPricePer3Days) > 0 ||
      Number(product.rentalPricePerDay) > 0
    );
  }, [product]);

  // Giá thuê mặc định 1 ngày
  const rentalPricePerDay = useMemo(() => {
    if (!product) return 0;
    if (product.rentalPricePerDay && product.rentalPricePerDay > 0) {
      return product.rentalPricePerDay;
    }
    if (product.rentalPricePer3Days && product.rentalPricePer3Days > 0) {
      return Math.round(product.rentalPricePer3Days / 3);
    }
    return 0;
  }, [product]);

  const currentPrice = isRental
    ? rentalPricePerDay
    : product?.salePrice || 0;

  // Hàng mua bán thì không có tiền cọc
  const depositAmount = useMemo(() => {
    if (!isRental) return 0;
    return Number(product?.deposit || product?.depositAmount || 0);
  }, [isRental, product]);

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

  // Sắp xếp chi nhánh ưu tiên theo khoảng cách gần vị trí người dùng nhất (bỏ kho tổng)
  const sortedBranches = useMemo(() => {
    let rawBranches = Array.isArray(product?.branches) ? product.branches : [];

    // Bỏ kho tổng, chỉ lấy ở các chi nhánh (store / showroom)
    rawBranches = rawBranches.filter((b) => {
      const name = String(b.name || '').toLowerCase();
      const type = String(b.type || '').toLowerCase();
      return (
        type !== 'warehouse' &&
        !name.includes('kho tổng') &&
        !name.includes('kho tong') &&
        !name.includes('kho trung tâm')
      );
    });

    if (rawBranches.length === 0) {
      if (
        product?.branchAddress &&
        product.branchAddress !== 'Chưa có hàng tại chi nhánh' &&
        !product.branchName?.toLowerCase().includes('kho tổng') &&
        !product.branchName?.toLowerCase().includes('kho tong')
      ) {
        return [{
          locationId: 'single-branch',
          name: product.branchName || 'Chi nhánh',
          address: product.branchAddress,
          quantity: product.quantity || 1,
          distanceKm: null,
        }];
      }
      return [];
    }

    const resolveCoords = (address = '', city = '') => {
      const text = `${city} ${address}`.toLowerCase();
      if (
        text.includes('hồ chí minh') ||
        text.includes('ho chi minh') ||
        text.includes('tphcm') ||
        text.includes('tp.hcm') ||
        text.includes('sài gòn') ||
        text.includes('quận 1') ||
        text.includes('quan 1')
      ) {
        return { lat: 10.776889, lng: 106.700806 };
      }
      if (text.includes('hà nội') || text.includes('ha noi')) {
        return { lat: 21.028511, lng: 105.854167 };
      }
      if (text.includes('đà nẵng') || text.includes('da nang')) {
        return { lat: 16.054407, lng: 108.202167 };
      }
      if (text.includes('hải phòng') || text.includes('hai phong')) {
        return { lat: 20.844912, lng: 106.688084 };
      }
      if (text.includes('cần thơ') || text.includes('can tho')) {
        return { lat: 10.045162, lng: 105.746857 };
      }
      if (PROVINCE_DEFAULT_COORDS) {
        for (const [prov, coords] of Object.entries(PROVINCE_DEFAULT_COORDS)) {
          if (text.includes(prov.toLowerCase())) {
            return { lat: coords.lat, lng: coords.lng };
          }
        }
      }
      return null;
    };

    const withDistance = rawBranches.map((b) => {
      let lat = b.latitude;
      let lng = b.longitude;
      if (lat == null || lng == null) {
        const resolved = resolveCoords(b.address, b.city);
        if (resolved) {
          lat = resolved.lat;
          lng = resolved.lng;
        }
      }

      let distanceKm = null;
      if (userLoc?.latitude != null && userLoc?.longitude != null && lat != null && lng != null) {
        distanceKm = calculateHaversineDistanceKm(userLoc.latitude, userLoc.longitude, lat, lng);
      }

      return {
        ...b,
        distanceKm,
      };
    });

    // Ưu tiên chi nhánh gần với vị trí của người dùng nhất
    return withDistance.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }, [product?.branches, product?.branchAddress, product?.branchName, product?.quantity, userLoc]);

  // Tự động chọn chi nhánh gần nhất khi danh sách chi nhánh sẵn sàng
  useEffect(() => {
    if (sortedBranches.length > 0 && !selectedBranchId) {
      setSelectedBranchId(String(sortedBranches[0].locationId || sortedBranches[0].name));
    }
  }, [sortedBranches, selectedBranchId]);

  const currentSelectedBranch = useMemo(() => {
    if (!sortedBranches.length) return null;
    return (
      sortedBranches.find((b) => String(b.locationId || b.name) === String(selectedBranchId)) ||
      sortedBranches[0]
    );
  }, [sortedBranches, selectedBranchId]);

  // Handle Add to Cart
  const handleAddToCart = () => {
    if (!product) return;
    try {
      const cartItem = {
        id: `cart-${Date.now()}-${product._id || product.productCode}`,
        productId: product._id || product.productCode,
        name: product.name,
        shopName: product.shopId?.name || product.brand || 'Vestora Fashion Store',
        image: images[0] || product.image || '',
        size: selectedSize,
        color: (Array.isArray(product.colors) && product.colors[0]) || 'Mặc định',
        colorCode: '#6e3eb3',
        duration: isRental ? rentalDuration : null,
        startDate: isRental ? startDate : null,
        endDate: isRental ? endDateFormatted : null,
        price: currentPrice,
        deposit: depositAmount,
        quantity,
        isRental,
        condition: product.condition || 'Rất tốt',
        inStock: product.inStock !== false,
        selectedBranch: currentSelectedBranch
          ? {
              locationId: currentSelectedBranch.locationId,
              name: currentSelectedBranch.name,
              address: currentSelectedBranch.address,
            }
          : null,
        aiTryOn: product.aiTryOn !== false,
      };

      const existingCart = JSON.parse(localStorage.getItem('vestora_cart') || '[]');
      const existingIdx = existingCart.findIndex(
        (ci) =>
          ci.productId === cartItem.productId &&
          ci.size === cartItem.size &&
          ci.isRental === cartItem.isRental &&
          ci.startDate === cartItem.startDate
      );
      if (existingIdx >= 0) {
        existingCart[existingIdx].quantity += quantity;
      } else {
        existingCart.push(cartItem);
      }
      localStorage.setItem('vestora_cart', JSON.stringify(existingCart));
      window.dispatchEvent(new Event('cartUpdated'));
      showToast('Đã thêm sản phẩm vào giỏ hàng thành công!');
    } catch {
      showToast('Đã thêm sản phẩm vào giỏ hàng!');
    }
  };

  // Handle Rent / Buy Now
  const handleRentNow = () => {
    handleAddToCart();
    navigate('/cart');
  };

  // Handle Chat with Shop (Brand Manager)
  const handleChatWithShop = async () => {
    if (!user) {
      showToast('Vui lòng đăng nhập để nhắn tin tư vấn với Shop!', 'info');
      navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    try {
      const branchLabel = currentSelectedBranch?.name
        ? `cơ sở ${currentSelectedBranch.name}`
        : 'Shop';
      showToast(`Đang kết nối với ${branchLabel}...`, 'info');
      let targetShopId = null;
      if (currentSelectedBranch?.shopId) {
        targetShopId =
          typeof currentSelectedBranch.shopId === 'object'
            ? currentSelectedBranch.shopId._id
            : currentSelectedBranch.shopId;
      }
      if (!targetShopId && product?.shopId) {
        if (typeof product.shopId === 'object' && product.shopId._id) {
          targetShopId = product.shopId._id;
        } else if (typeof product.shopId === 'string' && product.shopId.length === 24) {
          targetShopId = product.shopId;
        }
      }
      const res = await chatApi.getOrCreateConversation({
        productId: product?._id,
        shopId: targetShopId,
        branchId: currentSelectedBranch?.locationId,
        branchName: currentSelectedBranch?.name,
      });

      if (res?.conversation?._id) {
        navigate(`/chat/${res.conversation._id}`);
      } else {
        showToast('Không thể tạo cuộc trò chuyện với Shop. Vui lòng thử lại sau!', 'error');
      }
    } catch (err) {
      console.error('Lỗi mở chat tư vấn:', err);
      if (err.response?.status === 401 || err.status === 401) {
        showToast('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại!', 'error');
        navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      showToast(err.message || 'Không thể kết nối tư vấn với Shop', 'error');
    }
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
              {isRental ? 'Đã cho thuê 2.5k+ lần' : 'Đã bán 860+ lượt'}
            </span>
          </div>

          {/* Pricing Box - Tuyệt đối không còn hiển thị số 0 dư thừa */}
          <div className="pdetail-pricing-box">
            <div className="pdetail-pricing-main-row">
              <div className="pdetail-price-left">
                <span className="pdetail-price-main">{formatVND(currentPrice)}</span>
                {isRental ? (
                  <span className="pdetail-price-unit">/ ngày</span>
                ) : (
                  <span className="pdetail-price-unit" style={{ color: '#059669', fontWeight: 600 }}>
                    (Giá sở hữu)
                  </span>
                )}
              </div>

              {isRental && depositAmount > 0 ? (
                <div className="pdetail-deposit-right">
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>Đặt cọc hoàn trả:</span>
                  <span className="pdetail-deposit-amount">{formatVND(depositAmount)}</span>
                </div>
              ) : null}
            </div>

            <div className="pdetail-pricing-note">
              <i
                className={`fa-solid ${isRental ? 'fa-circle-info' : 'fa-certificate'}`}
                style={{ color: isRental ? '#a1a1aa' : '#059669' }}
              ></i>
              <span>
                {isRental
                  ? 'Tiền cọc được hoàn trả 100% sau khi bạn trả đồ và hệ thống kiểm tra tình trạng sản phẩm.'
                  : 'Sản phẩm mua bán chính hãng, kiểm định IFAB, bảo vệ người mua 100% qua PayOS Escrow.'}
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
                <i className="fa-solid fa-ruler-combined"></i> Gợi ý chọn size theo số đo &gt;
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

          {/* Quantity & Delivery */}
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

              {/* Delivery / Date Picker Input */}
              {isRental ? (
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
              ) : (
                <div className="pdetail-shipping-badge">
                  <i className="fa-solid fa-truck-fast"></i>
                  <span>Giao hàng toàn quốc (1 - 3 ngày)</span>
                </div>
              )}

              {/* Stock Indicator */}
              <div className="pdetail-stock-indicator">
                <span className={`pdetail-stock-dot ${product.inStock === false || (typeof product.quantity === 'number' && product.quantity <= 0) ? 'out-of-stock' : ''}`}></span>
                <span>
                  {product.inStock !== false && (product.quantity == null || product.quantity > 0)
                    ? `Còn hàng (${product.quantity ?? 1} sản phẩm)`
                    : 'Hết hàng'}
                </span>
              </div>
            </div>

            {/* Quick date select chips (Chỉ cho thuê) */}
            {/* Chi nhánh có sẵn hàng (Dạng Select dropdown, ưu tiên gần nhất) */}
            {sortedBranches.length > 0 && (
              <div
                className="pdetail-branch-select-box"
                style={{
                  marginTop: '14px',
                  marginBottom: '16px',
                  padding: '14px 16px',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    gap: '8px',
                  }}
                >
                  <label
                    htmlFor="pdetail-branch-select"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '600',
                      color: '#1e293b',
                      fontSize: '13.5px',
                    }}
                  >
                    <i className="fa-solid fa-location-dot" style={{ color: '#e11d48' }}></i>
                    <span>Chi nhánh có sẵn hàng ({sortedBranches.length}):</span>
                  </label>
                  {userLoc?.shortCity && sortedBranches.length > 1 && (
                    <span
                      style={{
                        fontSize: '11.5px',
                        color: '#0284c7',
                        background: '#e0f2fe',
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontWeight: '500',
                      }}
                    >
                      <i className="fa-solid fa-location-crosshairs" style={{ marginRight: '4px' }}></i>
                      Ưu tiên theo khoảng cách ({userLoc.shortCity})
                    </span>
                  )}
                </div>

                {/* Dropdown Select */}
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                  <select
                    id="pdetail-branch-select"
                    value={selectedBranchId || ''}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 36px 10px 12px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13.5px',
                      fontWeight: '500',
                      color: '#0f172a',
                      appearance: 'none',
                      cursor: 'pointer',
                      outline: 'none',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}
                  >
                    {sortedBranches.map((b) => {
                      const distText =
                        b.distanceKm != null
                          ? ` (~${formatDistanceLabel(b.distanceKm)})`
                          : '';
                      return (
                        <option
                          key={b.locationId || b.name}
                          value={String(b.locationId || b.name)}
                        >
                          {b.name} — Còn {b.quantity} cái{distText}
                        </option>
                      );
                    })}
                  </select>
                  <i
                    className="fa-solid fa-chevron-down"
                    style={{
                      position: 'absolute',
                      right: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none',
                      color: '#64748b',
                      fontSize: '12px',
                    }}
                  ></i>
                </div>

                {/* Chi tiết chi nhánh đang chọn */}
                {currentSelectedBranch && (
                  <div
                    style={{
                      background: '#ffffff',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '12.5px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px',
                      }}
                    >
                      <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                        {currentSelectedBranch.name}
                      </strong>
                      <span
                        style={{
                          color: '#059669',
                          fontWeight: '700',
                          background: '#ecfdf5',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '11.5px',
                        }}
                      >
                        Sẵn có {currentSelectedBranch.quantity} cái
                      </span>
                    </div>
                    <div
                      style={{
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '6px',
                        lineHeight: 1.4,
                      }}
                    >
                      <i
                        className="fa-solid fa-map-pin"
                        style={{ color: '#94a3b8', marginTop: '2px', fontSize: '11px' }}
                      ></i>
                      <span>{currentSelectedBranch.address || 'Địa chỉ đang cập nhật'}</span>
                    </div>
                    {currentSelectedBranch.distanceKm != null && (
                      <div
                        style={{
                          marginTop: '6px',
                          color: '#0369a1',
                          fontSize: '11.5px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <i className="fa-solid fa-route"></i>
                        <span>
                          Khoảng cách: <strong>{formatDistanceLabel(currentSelectedBranch.distanceKm)}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {isRental ? (
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
            ) : null}

            {/* Rental Timeline (Chỉ cho thuê) */}
            {isRental && startDate ? (
              <div className="pdetail-rental-timeline">
                <div className="pdetail-timeline-item">
                  <i className="fa-solid fa-truck-ramp-box" style={{ color: '#6e3eb3', fontSize: '15px' }}></i>
                  <div>
                    <span className="timeline-title">Ngày nhận đồ:</span>
                    <strong>{startDateFormatted}</strong>
                  </div>
                </div>
                <div className="pdetail-timeline-divider">
                  <span>1 ngày</span>
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
            ) : null}
          </div>

          {/* Action Buttons Row */}
          <div className="pdetail-actions-row">
            <button className="pdetail-btn-rent-now" onClick={handleRentNow}>
              <i className={isRental ? 'fa-solid fa-vest' : 'fa-solid fa-bag-shopping'}></i>
              <span>{isRental ? 'Thuê ngay' : 'Mua ngay'}</span>
              <i className="fa-solid fa-arrow-right"></i>
            </button>

            <button className="pdetail-btn-add-cart" onClick={handleAddToCart}>
              <i className="fa-solid fa-cart-shopping"></i>
              <span>Thêm vào giỏ hàng</span>
            </button>

            <button
              className="pdetail-btn-ai-tryon"
              onClick={() => navigate(`/try-on/photo?product=${product._id || product.productCode}`)}
            >
              <i className="fa-solid fa-camera"></i>
              <span>Thử đồ AI</span>
            </button>
          </div>

          {/* Full-width Chat with Shop Button */}
          <button
            type="button"
            className="pdetail-btn-chat-shop"
            onClick={handleChatWithShop}
            title={
              currentSelectedBranch?.name
                ? `Nhắn tin tư vấn với cơ sở ${currentSelectedBranch.name}`
                : 'Nhắn tin tư vấn với Shop'
            }
          >
            <i className="fa-regular fa-comment-dots"></i>
            <span>
              {currentSelectedBranch?.name
                ? `Nhắn tin tư vấn (${currentSelectedBranch.name})`
                : 'Nhắn tin tư vấn với Shop'}
            </span>
          </button>
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
            <i className="fa-solid fa-shield-halved"></i> {isRental ? 'Chính sách thuê' : 'Chính sách mua hàng'}
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

            {/* Col 2: Chính sách thuê / mua hàng */}
            <div className="pdetail-policy-box">
              <div className="pdetail-policy-title">
                <i className="fa-solid fa-shield-halved"></i> {isRental ? 'Chính sách thuê' : 'Chính sách mua hàng'}
              </div>
              <ul className="pdetail-policy-bullets">
                {isRental ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <li className="pdetail-policy-item">
                      <i className="fa-solid fa-check pdetail-policy-check"></i>
                      <span>Cam kết 100% trang phục chính hãng, đã qua kiểm định IFAB.</span>
                    </li>
                    <li className="pdetail-policy-item">
                      <i className="fa-solid fa-check pdetail-policy-check"></i>
                      <span>Được đồng kiểm trang phục khi nhận hàng trước khi thanh toán.</span>
                    </li>
                    <li className="pdetail-policy-item">
                      <i className="fa-solid fa-check pdetail-policy-check"></i>
                      <span>Bảo vệ quyền lợi người mua qua PayOS Escrow, hoàn tiền nếu lỗi mô tả.</span>
                    </li>
                  </>
                )}
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
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
              {isRental ? 'Quy chuẩn giặt hấp & Hoàn trả tiền cọc' : 'Chính sách mua bán & Bảo vệ người mua'}
            </h3>
            {isRental ? (
              <>
                <p style={{ fontSize: '14px', color: '#52525b', lineHeight: 1.6, margin: 0 }}>
                  1. <strong>Kiểm duyệt chất lượng:</strong> Mọi trang phục trước khi giao đều được giặt hấp theo tiêu chuẩn y tế, khử trùng bằng tia UV và kiểm tra từng đường kim mũi chỉ.
                </p>
                <p style={{ fontSize: '14px', color: '#52525b', lineHeight: 1.6, margin: 0 }}>
                  2. <strong>Hoàn cọc tự động:</strong> Khi bạn trả đồ về showroom hoặc cho shipper, bộ phận kiểm định sẽ kiểm tra và hoàn lại 100% tiền cọc vào tài khoản của bạn trong vòng 2-4 giờ làm việc.
                </p>
                <p style={{ fontSize: '14px', color: '#52525b', lineHeight: 1.6, margin: 0 }}>
                  3. <strong>Bảo hiểm rủi ro nhỏ:</strong> VESTORA hỗ trợ xử lý miễn phí các vết bẩn sinh hoạt thông thường (vết nước ngọt, bụi đường). Quý khách không cần tự giặt trang phục trước khi trả.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: '14px', color: '#52525b', lineHeight: 1.6, margin: 0 }}>
                  1. <strong>Kiểm định chính hãng 100%:</strong> Sản phẩm được thẩm định nguồn gốc xuất xứ, độ bền vải và đường may bởi chuyên viên thời trang VESTORA.
                </p>
                <p style={{ fontSize: '14px', color: '#52525b', lineHeight: 1.6, margin: 0 }}>
                  2. <strong>Thanh toán đảm bảo PayOS Escrow:</strong> Tiền mua hàng được giữ an toàn trên hệ thống ký quỹ trung gian, chỉ chuyển cho shop sau khi bạn nhận và xác nhận hài lòng.
                </p>
                <p style={{ fontSize: '14px', color: '#52525b', lineHeight: 1.6, margin: 0 }}>
                  3. <strong>Đồng kiểm & Đổi trả trong 48h:</strong> Quý khách được quyền kiểm tra hàng trước khi nhận, đổi trả hoặc hoàn tiền 100% nếu sản phẩm có lỗi sai khác so với hình ảnh mô tả.
                </p>
              </>
            )}
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
                      {item.tag === 'sale' ? 'Mua đồ cũ' : 'Thuê đồ'}
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
                <i className="fa-solid fa-ruler-combined" style={{ color: '#6e3eb3' }}></i> Gợi ý kích cỡ chuẩn theo số đo
              </h3>
              <button className="pdetail-modal-close-btn" onClick={() => setShowAiModal(false)}>
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <p style={{ fontSize: '13.5px', color: '#71717a', margin: 0, lineHeight: 1.5 }}>
              Nhập 3 chỉ số cơ thể của bạn (cm) để hệ thống tự động đối chiếu bảng size chuẩn và gợi ý kích cỡ vừa vặn nhất:
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
                <i className="fa-solid fa-calculator"></i> Tính kích cỡ phù hợp
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
