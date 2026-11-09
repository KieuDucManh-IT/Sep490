import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Shirt,
  Sparkles,
  Store,
  ShieldCheck,
  ArrowRight,
  PlayCircle,
  Tag,
  Camera,
  Video,
  ChevronRight,
  Heart,
  Star,
  Package,
  MapPin,
  Map,
  Crosshair,
  SlidersHorizontal,
  Leaf,
  Users,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import productService from '../../services/productService';
import { getUserLocation } from '../../utils/userLocation';
import '../../styles/HomePage.css';

// 5 Featured Products exactly matching the reference mockup
const FEATURED_PRODUCTS = [
  {
    id: 'VESTORA-DR-089',
    type: 'Cho thuê',
    typeBadge: 'rental',
    title: 'Đầm dạ hội ánh tím',
    rating: '4.9',
    reviews: '128',
    inStock: true,
    price: 350000,
    priceUnit: '/ 3 ngày',
    image: '/assets/purple_gown.jpg',
    isRental: true,
  },
  {
    id: 'VESTORA-BZ-012',
    type: 'Mua sản phẩm',
    typeBadge: 'sale',
    title: 'Blazer thanh lịch',
    rating: '4.8',
    reviews: '96',
    inStock: true,
    price: 180000,
    priceUnit: '',
    image: '/assets/beige_blazer.jpg',
    isRental: false,
    isSale: true,
  },
  {
    id: 'VESTORA-AD-007',
    type: 'Cho thuê',
    typeBadge: 'rental',
    title: 'Áo dài cách tân',
    rating: '4.9',
    reviews: '74',
    inStock: true,
    price: 250000,
    priceUnit: '/ 3 ngày',
    image: '/assets/ao_dai.jpg',
    isRental: true,
  },
  {
    id: 'VESTORA-BG-045',
    type: 'Mua sản phẩm',
    typeBadge: 'sale',
    title: 'Túi dây tiệc mini',
    rating: '4.7',
    reviews: '52',
    inStock: true,
    price: 120000,
    priceUnit: '',
    image: '/assets/mini_bag.jpg',
    isRental: false,
    isSale: true,
  },
  {
    id: 'VESTORA-BD-022',
    type: 'Cho thuê',
    typeBadge: 'rental',
    title: 'Đầm body đen',
    rating: '4.8',
    reviews: '110',
    inStock: true,
    price: 300000,
    priceUnit: '/ 3 ngày',
    image: '/assets/black_dress.jpg',
    isRental: true,
  },
];



// Style suggestion categories
const STYLE_CATEGORIES = [
  {
    id: 'thanh-lich',
    title: 'Thanh lịch',
    desc: 'Tối giản, tinh tế, sang trọng',
    image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'du-tiec',
    title: 'Dự tiệc',
    desc: 'Tỏa sáng trong mọi khoảnh khắc',
    image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'nang-dong',
    title: 'Năng động',
    desc: 'Thoải mái, cá tính, trẻ trung',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'cong-so',
    title: 'Công sở',
    desc: 'Thanh lịch, chuyên nghiệp',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [productFilter, setProductFilter] = useState('ALL');
  const [quickMode, setQuickMode] = useState('thue-do');
  const [carouselIndex, setCarouselIndex] = useState(0);

  // Real backend products state
  const [apiProducts, setApiProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [userLoc, setUserLoc] = useState(getUserLocation);

  useEffect(() => {
    const handleLocUpdate = () => setUserLoc(getUserLocation());
    window.addEventListener('userLocationChanged', handleLocUpdate);
    return () => window.removeEventListener('userLocationChanged', handleLocUpdate);
  }, []);

  // Sync favorites with localStorage
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('vestora_favorites') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const syncFav = () => {
      try {
        setFavoriteIds(JSON.parse(localStorage.getItem('vestora_favorites') || '[]'));
      } catch { }
    };
    window.addEventListener('favoritesUpdated', syncFav);
    return () => window.removeEventListener('favoritesUpdated', syncFav);
  }, []);

  const toggleFavorite = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setFavoriteIds((prev) => {
      const isFav = prev.includes(id);
      const next = isFav ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('vestora_favorites', JSON.stringify(next));
        window.dispatchEvent(new Event('favoritesUpdated'));
      } catch { }
      return next;
    });
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('vi-VN').format(val) + 'đ';
  };

  // 1. Fetch real products from backend API (/api/products)
  useEffect(() => {
    let isMounted = true;
    async function loadBackendProducts() {
      try {
        setLoadingProducts(true);
        const res = await productService.getProducts({
          limit: 20,
          sort: 'newest',
        });
        if (isMounted && res?.data && Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map((p) => {
            const isRental =
              p.tag === 'rental' ||
              (p.rentalPricePer3Days && p.rentalPricePer3Days > 0) ||
              (p.rentalPricePerDay && p.rentalPricePerDay > 0);
            const isSale =
              p.tag === 'sale' ||
              (p.salePrice && p.salePrice > 0);
            const isBoth = p.tag === 'both' || (isRental && isSale);

            let type = 'Cho thuê';
            let typeBadge = 'rental';
            if (isBoth) {
              type = 'Thuê & Mua';
              typeBadge = 'both';
            } else if (p.tag === 'sale' || (isSale && !isRental)) {
              type = 'Mua sản phẩm';
              typeBadge = 'sale';
            }

            const price = isSale && !isBoth
              ? (p.salePrice || 0)
              : (p.rentalPricePer3Days || (p.rentalPricePerDay ? p.rentalPricePerDay * 3 : (p.salePrice || 0)));

            const mainImage = (p.images && p.images.length > 0 && p.images[0]) || p.image || '/assets/purple_gown.jpg';

            return {
              id: p._id || p.productCode || p.sku,
              type: type,
              typeBadge: typeBadge,
              title: p.name,
              rating: typeof p.rating === 'number' ? Number(p.rating).toFixed(1) : '4.9',
              reviews: typeof p.reviewsCount === 'number' ? p.reviewsCount : 95,
              inStock: p.inStock !== false && (p.quantity == null || p.quantity > 0),
              quantity: p.quantity,
              quantityOnHand: p.quantityOnHand,
              branchAddress: p.branchAddress,
              branchName: p.branchName,
              price: price,
              priceUnit: isRental && price > 0 ? '/ 3 ngày' : '',
              image: mainImage,
              isRental: isRental,
              isSale: isSale,
              raw: p,
            };
          });
          setApiProducts(mapped);
        }
      } catch (err) {
        console.warn('Không thể kết nối API /api/products, sử dụng dữ liệu mặc định:', err);
      } finally {
        if (isMounted) setLoadingProducts(false);
      }
    }
    loadBackendProducts();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter products by mode (Tất cả / Cho thuê / Mua sản phẩm)
  const allFilteredProducts = useMemo(() => {
    const source = apiProducts.length > 0 ? apiProducts : FEATURED_PRODUCTS;
    return source.filter((item) => {
      if (productFilter === 'RENTAL') return item.isRental || item.typeBadge === 'rental' || item.typeBadge === 'both';
      if (productFilter === 'SALE' || productFilter === 'RESALE') return item.isSale || item.typeBadge === 'sale' || item.typeBadge === 'both';
      return true;
    });
  }, [apiProducts, productFilter]);

  // Carousel pagination for featured products (5 items per page)
  const pageSize = 5;
  const maxPages = Math.ceil(allFilteredProducts.length / pageSize) || 1;
  const visibleProducts = useMemo(() => {
    const start = (carouselIndex % maxPages) * pageSize;
    return allFilteredProducts.slice(start, start + pageSize);
  }, [allFilteredProducts, carouselIndex, maxPages]);

  const handleNextCarousel = () => {
    if (carouselIndex + 1 < maxPages) {
      setCarouselIndex((prev) => prev + 1);
    } else {
      navigate('/catalog');
    }
  };

  return (
    <div className="vestora-home-wrapper">
      <Navbar />

      <main className="vestora-main-content">
        {/* ====================================================
            1. HERO SECTION (Full organic lavender curve background)
            ==================================================== */}
        <section className="hero-banner-section">
          <div className="hero-organic-curve-bg"></div>

          <div className="hero-layout-grid">
            {/* Left Content */}
            <div className="hero-left-content">
              <span className="hero-badge-tagline">
                NỀN TẢNG CHO THUÊ & SANG NHƯỢNG THỜI TRANG
              </span>

              <h1 className="hero-main-title">
                Thuê đồ thời trang —<br />
                Thử trước bằng AI
              </h1>

              <p className="hero-subtext">
                Khám phá hàng ngàn trang phục từ các gian hàng uy tín.<br />
                Thuê, mua đồ cũ hoặc trải nghiệm thử đồ bằng AI, camera ngay tại nhà.
              </p>

              {/* 4 Feature Badges */}
              <div className="hero-features-strip">
                <div className="hero-pill-item">
                  <div className="hero-pill-icon-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shirt size={18} color="#C5A880" />
                  </div>
                  <div className="hero-pill-text-col">
                    <span>Đa dạng</span>
                    <span>phong cách</span>
                  </div>
                </div>

                <div className="hero-pill-item">
                  <div className="hero-pill-icon-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={18} color="#C5A880" />
                  </div>
                  <div className="hero-pill-text-col">
                    <span>Thử đồ AI</span>
                    <span>& webcam</span>
                  </div>
                </div>

                <div className="hero-pill-item">
                  <div className="hero-pill-icon-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Store size={18} color="#C5A880" />
                  </div>
                  <div className="hero-pill-text-col">
                    <span>Showroom</span>
                    <span>gần bạn</span>
                  </div>
                </div>

                <div className="hero-pill-item">
                  <div className="hero-pill-icon-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={18} color="#C5A880" />
                  </div>
                  <div className="hero-pill-text-col">
                    <span>Mua đồ cũ</span>
                    <span>chính hãng</span>
                  </div>
                </div>
              </div>

              {/* Call to Action Buttons */}
              <div className="hero-cta-group">
                <button
                  className="btn-hero-primary"
                  onClick={() => navigate('/catalog')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <Shirt size={16} className="btn-hanger-icon" />
                  Khám phá ngay <ArrowRight size={16} className="btn-arrow-icon" />
                </button>
                <button
                  className="btn-hero-outline"
                  onClick={() => navigate('/try-on/photo')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                >
                  <PlayCircle size={16} className="btn-play-icon" />
                  Xem hướng dẫn
                </button>
              </div>
            </div>

            {/* Right Visual Stage (Video thử đồ AI & Script overlay) */}
            <div className="hero-right-stage">
              <div className="hero-video-card-container">
                <video
                  className="hero-tryon-video"
                  src="/assets/tryon_video.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
                {/* <div className="hero-video-live-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span className="live-pulse-dot"></span>
                  <Sparkles size={14} color="#C5A880" /> AI Try-On Live
                </div> */}
                <div className="hero-script-overlay">
                  Fashion<br />
                  <span>for your</span><br />
                  <span className="script-life">life</span>
                </div>
                <Sparkles size={20} className="sparkle-star sparkle-1" color="#C5A880" />
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================
            2. QUICK MODE TABS BAR
            ==================================================== */}
        <section className="quick-modes-section">
          <div className="quick-modes-container">
            <div className="quick-tabs-list">
              <button
                className={`quick-tab-btn ${quickMode === 'thue-do' ? 'active' : ''}`}
                onClick={() => {
                  setQuickMode('thue-do');
                  setProductFilter('RENTAL');
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Shirt size={16} className="tab-icon" />
                <span>Thuê đồ</span>
              </button>

              <button
                className={`quick-tab-btn ${quickMode === 'mua-do-cu' ? 'active' : ''}`}
                onClick={() => {
                  setQuickMode('mua-do-cu');
                  setProductFilter('RESALE');
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Tag size={16} className="tab-icon" />
                <span>Mua đồ cũ</span>
              </button>

              <button
                className={`quick-tab-btn ${quickMode === 'thu-do-ai' ? 'active' : ''}`}
                onClick={() => navigate('/try-on/photo')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Camera size={16} className="tab-icon" />
                <span>Thử đồ AI</span>
              </button>

              <button
                className={`quick-tab-btn ${quickMode === 'thu-do-camera' ? 'active' : ''}`}
                onClick={() => navigate('/try-on/webcam')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Video size={16} className="tab-icon" />
                <span>Thử đồ Camera</span>
              </button>
            </div>

            <Link to="/catalog" className="view-all-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Xem tất cả <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* ====================================================
            3. SẢN PHẨM NỔI BẬT (FEATURED PRODUCTS)
            ==================================================== */}
        <section className="featured-products-section">
          <div className="section-header-row">
            <div className="header-left-group">
              <h2 className="section-title-with-star" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={20} color="#C5A880" className="sparkle-heading-icon" /> Sản phẩm nổi bật
              </h2>
              <div className="filter-pill-switch">
                <button
                  className={`filter-chip ${productFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => {
                    setProductFilter('ALL');
                    setCarouselIndex(0);
                  }}
                >
                  Tất cả
                </button>
                <button
                  className={`filter-chip ${productFilter === 'RENTAL' ? 'active' : ''}`}
                  onClick={() => {
                    setProductFilter('RENTAL');
                    setCarouselIndex(0);
                  }}
                >
                  Cho thuê
                </button>
                <button
                  className={`filter-chip ${productFilter === 'SALE' ? 'active' : ''}`}
                  onClick={() => {
                    setProductFilter('SALE');
                    setCarouselIndex(0);
                  }}
                >
                  Mua sản phẩm
                </button>
              </div>
            </div>

            <button
              className="carousel-nav-btn"
              onClick={handleNextCarousel}
              title={carouselIndex + 1 < maxPages ? "Xem các sản phẩm tiếp theo" : "Xem tất cả trong bộ sưu tập"}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Product Cards Row */}
          <div className="products-carousel-grid">
            {visibleProducts.map((product) => {
              const isFav = favoriteIds.includes(String(product.id));
              return (
                <div key={product.id} className="modern-product-card">
                  <div className="card-media-box">
                    <span className={`product-type-badge badge-${product.typeBadge}`}>
                      {product.type}
                    </span>
                    <button
                      className={`card-heart-btn ${isFav ? 'favorited' : ''}`}
                      onClick={(e) => toggleFavorite(e, String(product.id))}
                      aria-label="Thêm vào yêu thích"
                      title={isFav ? "Bỏ yêu thích" : "Lưu vào yêu thích"}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Heart
                        size={15}
                        fill={isFav ? '#C5A880' : 'none'}
                        color={isFav ? '#C5A880' : '#171717'}
                      />
                    </button>
                    <img
                      src={product.image}
                      alt={product.title}
                      className="product-card-img"
                      onError={(e) => {
                        e.target.src = '/assets/purple_gown.jpg';
                      }}
                    />
                  </div>

                  <div className="card-info-box">
                    <h3 className="card-product-name" title={product.title}>{product.title}</h3>
                    <div className="card-meta-line" style={{ display: 'flex', alignItems: 'center' }}>
                      <Star size={13} fill="#C5A880" color="#C5A880" className="rating-star" />
                      <span className="rating-score">{product.rating}</span>
                      <span className="rating-count">({product.reviews})</span>
                      <span className="meta-separator">•</span>
                      <span className="stock-indicator">
                        <span className={`stock-dot ${product.inStock === false ? 'out-of-stock' : ''}`}></span> {product.inStock !== false ? `Còn hàng${product.quantity != null ? ` (${product.quantity})` : ''}` : 'Hết hàng'}
                      </span>
                    </div>

                    <div className="card-pricing-line">
                      <span className="price-main">{formatCurrency(product.price)}</span>
                      {product.priceUnit && (
                        <span className="price-unit">{product.priceUnit}</span>
                      )}
                    </div>

                    {(product.quantity != null || product.branchAddress) && (
                      <div className="card-attributes-list" style={{ marginBottom: '8px', gap: '3px' }}>
                        {product.quantity != null && (
                          <div className="card-attr-row card-quantity-row" style={{ display: 'flex', alignItems: 'center' }}>
                            <Package size={13} color="#C5A880" className="card-attr-icon" style={{ marginRight: '5px' }} />
                            <span>Số lượng: <strong>{product.quantity}</strong></span>
                          </div>
                        )}
                        {product.branchAddress && (
                          <div className="card-attr-row card-branch-row" title={product.branchAddress} style={{ display: 'flex', alignItems: 'center' }}>
                            <MapPin size={13} color="#C5A880" className="card-attr-icon" style={{ marginRight: '5px' }} />
                            <span className="card-branch-text">{product.branchAddress}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <Link to={`/product/${product.id}`} className="card-action-btn">
                      Xem chi tiết
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ====================================================
            4. TWO-COLUMN: TÌM SHOWROOM & THỬ ĐỒ THEO CÁCH BẠN
            ==================================================== */}
        <section className="dual-split-section">
          {/* Left Column: Tìm Showroom Gần Bạn */}
          <div className="dual-column-box showroom-column">
            <div
              className="column-head"
              onClick={() => navigate('/map')}
              style={{ cursor: 'pointer' }}
              title="Khám phá bản đồ showroom VESTORA"
            >
              <h3 className="column-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={18} color="#C5A880" className="column-icon" /> Tìm showroom gần bạn
              </h3>
              <p className="column-desc">
                Khám phá các showroom đối tác của VESTORA quanh khu vực của bạn.
              </p>
            </div>

            <div className="showroom-content-grid">
              {/* Illustrated Map Box */}
              <div
                className="interactive-map-card"
                onClick={() => navigate('/map')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate('/map');
                  }
                }}
                title="Bấm để mở bản đồ showroom chi tiết"
              >
                <div className="map-artistic-canvas">
                  <div className="map-river"></div>
                  <div className="map-road road-1"></div>
                  <div className="map-road road-2"></div>
                  <div className="map-city-label">{userLoc?.shortCity || userLoc?.city || 'Hà Nội'}</div>

                  {/* Location Pins */}
                  <div className="map-pin pin-1" title="Showroom Vestora">
                    <MapPin size={18} color="#EA580C" className="map-pin-icon" />
                  </div>
                  <div className="map-pin pin-2" title="Showroom Vestora">
                    <MapPin size={18} color="#EA580C" className="map-pin-icon" />
                  </div>
                  <div className="map-pin pin-3" title="Showroom Vestora">
                    <MapPin size={18} color="#EA580C" className="map-pin-icon" />
                  </div>
                  <div className="map-pin pin-4" title="Showroom Vestora">
                    <MapPin size={18} color="#EA580C" className="map-pin-icon" />
                  </div>
                  <div className="map-pin pin-5" title="Showroom Vestora">
                    <MapPin size={18} color="#EA580C" className="map-pin-icon" />
                  </div>

                  {/* User Location Pulse on Map */}
                  <div className="map-user-pin" title="Vị trí của bạn">
                    <span className="map-user-pulse"></span>
                    <span className="map-user-core"></span>
                  </div>
                </div>

                <div className="map-overlay-controls">
                  <button
                    type="button"
                    className="btn-map-expand"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/map');
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  >
                    <Map size={14} className="map-btn-icon" /> Mở bản đồ radar showroom
                  </button>
                  <button
                    type="button"
                    className="btn-map-locate"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate('/map');
                    }}
                    title="Vị trí hiện tại"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Crosshair size={14} color="#2563EB" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Thử Đồ Theo Cách Của Bạn */}
          <div className="dual-column-box tryon-column">
            <div className="column-head">
              <h3 className="column-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <SlidersHorizontal size={18} color="#C5A880" className="column-icon" /> Thử đồ theo cách của bạn
              </h3>
              <p className="column-desc">
                Công nghệ AI giúp bạn thử trang phục ngay tại nhà, chỉ với vài thao tác.
              </p>
            </div>

            <div className="tryon-options-list">
              {/* Option 1: Upload Photo */}
              <div
                className="tryon-feature-card"
                onClick={() => navigate('/try-on/photo')}
              >
                <div className="feature-avatar-preview photo-preview">
                  <div className="mock-phone-frame">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=180&q=80"
                      alt="Thử đồ AI bằng ảnh"
                      className="mock-avatar-img"
                    />
                  </div>
                </div>

                <div className="feature-content">
                  <h4 className="feature-title">Tải ảnh lên để thử đồ</h4>
                  <p className="feature-text">
                    Chọn ảnh toàn thân hoặc ảnh selfie. AI sẽ tạo hình ảnh bạn trong trang phục.
                  </p>
                </div>

                <div className="feature-arrow-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowRight size={16} />
                </div>
              </div>

              {/* Option 2: Live Webcam */}
              <div
                className="tryon-feature-card"
                onClick={() => navigate('/try-on/webcam')}
              >
                <div className="feature-avatar-preview camera-preview">
                  <div className="mock-webcam-box">
                    <img
                      src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=180&q=80"
                      alt="Thử đồ AI trực tiếp qua webcam"
                      className="mock-avatar-img"
                    />
                    <div className="mock-cam-indicator"></div>
                  </div>
                </div>

                <div className="feature-content">
                  <h4 className="feature-title">Thử trực tiếp bằng webcam</h4>
                  <p className="feature-text">
                    Tương tác trực tiếp với camera để xem trước trang phục.
                  </p>
                </div>

                <div className="feature-arrow-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowRight size={16} />
                </div>
              </div>

              {/* Security note */}
              <div className="camera-security-note" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={14} color="#C5A880" className="shield-icon" />
                <span>Camera chỉ được khởi động khi bạn cho phép.</span>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================
            5. GỢI Ý PHONG CÁCH THEO NHU CẦU
            ==================================================== */}
        <section className="style-suggestions-section">
          <div className="section-header-row">
            <h2 className="section-title-with-star" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={20} color="#C5A880" className="sparkle-heading-icon" /> Gợi ý phong cách theo nhu cầu
            </h2>
            <Link to="/catalog?category=suggest" className="view-all-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Xem tất cả <ArrowRight size={14} />
            </Link>
          </div>

          <div className="style-cards-grid">
            {STYLE_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className="style-visual-card"
                onClick={() => navigate(`/catalog?category=${cat.id}`)}
              >
                <img src={cat.image} alt={cat.title} className="style-card-bg" />
                <div className="style-card-overlay">
                  <div className="style-text-group">
                    <h3 className="style-title">{cat.title}</h3>
                    <p className="style-subtitle">{cat.desc}</p>
                  </div>
                  <ChevronRight size={16} className="style-arrow-icon" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ====================================================
            6. BANNER: MUA ĐỒ CŨ - THỜI TRANG BỀN VỮNG
            ==================================================== */}
        <section className="sustainability-banner-section">
          <div className="sustainability-card-container">
            {/* Left Image Collage */}
            <div className="sustain-media-col">
              <img
                src="/assets/sustainability_flatlay.jpg"
                alt="Thời trang bền vững sang nhượng"
                className="sustain-cover-img"
              />
            </div>

            {/* Middle Content */}
            <div className="sustain-content-col">
              <div className="sustain-badge-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Leaf size={18} color="#C5A880" className="leaf-icon" />
                <h3>Mua đồ cũ – Thời trang bền vững</h3>
              </div>
              <p className="sustain-description">
                Những món đồ chất lượng, đã qua sử dụng, được kiểm duyệt kỹ càng.
                Vừa tiết kiệm chi phí, vừa góp phần bảo vệ môi trường.
              </p>
              <button
                className="btn-sustain-cta"
                onClick={() => navigate('/catalog?type=sale')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                Khám phá đồ cũ <ArrowRight size={14} />
              </button>
            </div>

            {/* Right 3 Highlight Badges */}
            <div className="sustain-benefits-col">
              <div className="benefit-card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={18} color="#C5A880" className="benefit-icon" />
                <span className="benefit-label">Sản phẩm chất lượng được kiểm duyệt</span>
              </div>
              <div className="benefit-card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={18} color="#C5A880" className="benefit-icon" />
                <span className="benefit-label">Giá tốt hơn thị trường</span>
              </div>
              <div className="benefit-card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="#C5A880" className="benefit-icon" />
                <span className="benefit-label">Cộng đồng thời trang văn minh, bền vững</span>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================
            7. QUY TRÌNH ĐƠN GIẢN, TRẢI NGHIỆM TỐI ƯU
            ==================================================== */}
        <section className="how-it-works-section">
          <h2 className="how-it-works-title">
            Quy trình đơn giản, trải nghiệm tối ưu
          </h2>

          <div className="steps-flow-container">
            {/* Step 1 */}
            <div className="step-item-card">
              <div className="step-icon-bubble" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shirt size={22} color="#C5A880" />
              </div>
              <h4 className="step-name">1. Chọn trang phục</h4>
              <p className="step-detail">
                Duyệt sản phẩm thuê, mua cũ hoặc sang nhượng
              </p>
            </div>

            <ArrowRight size={18} color="#C5A880" className="step-flow-arrow" />

            {/* Step 2 */}
            <div className="step-item-card">
              <div className="step-icon-bubble" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={22} color="#C5A880" />
              </div>
              <h4 className="step-name">2. Thử đồ AI / Camera</h4>
              <p className="step-detail">
                Xem trước bằng ảnh hoặc webcam
              </p>
            </div>

            <ArrowRight size={18} color="#C5A880" className="step-flow-arrow" />

            {/* Step 3 */}
            <div className="step-item-card">
              <div className="step-icon-bubble" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={22} color="#C5A880" />
              </div>
              <h4 className="step-name">3. Đặt thuê / mua và thanh toán an toàn</h4>
              <p className="step-detail">
                An toàn, minh bạch, bảo vệ quyền lợi
              </p>
            </div>

            <ArrowRight size={18} color="#C5A880" className="step-flow-arrow" />

            {/* Step 4 */}
            <div className="step-item-card">
              <div className="step-icon-bubble" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={22} color="#C5A880" />
              </div>
              <h4 className="step-name">
                4. Trả đồ / Nhận hoàn cọc
              </h4>
              <p className="step-note">(Đối với thuê đồ)</p>
              <p className="step-detail">
                Nhanh chóng, dễ dàng
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
