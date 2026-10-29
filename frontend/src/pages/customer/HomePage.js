import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import '../../styles/HomePage.css';

// 5 Featured Products exactly matching the reference mockup
const FEATURED_PRODUCTS = [
  {
    id: 'VESTORA-DR-089',
    type: 'Thuê đồ',
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
    type: 'Mua đồ cũ',
    typeBadge: 'resale',
    title: 'Blazer thanh lịch',
    rating: '4.8',
    reviews: '96',
    inStock: true,
    price: 180000,
    priceUnit: '',
    image: '/assets/beige_blazer.jpg',
    isRental: false,
  },
  {
    id: 'VESTORA-AD-007',
    type: 'Thuê đồ',
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
    type: 'Mua đồ cũ',
    typeBadge: 'resale',
    title: 'Túi dây tiệc mini',
    rating: '4.7',
    reviews: '52',
    inStock: true,
    price: 120000,
    priceUnit: '',
    image: '/assets/mini_bag.jpg',
    isRental: false,
  },
  {
    id: 'VESTORA-BD-022',
    type: 'Thuê đồ',
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

// Showrooms near user
const NEARBY_SHOWROOMS = [
  {
    id: 1,
    name: 'The Velvet Store',
    address: '123 Hoàng Hoa Thám, Ba Đình',
    rating: '4.8',
    reviews: '124',
    distance: '1.2 km',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 2,
    name: 'Lumière Fashion',
    address: '45 Lý Thường Kiệt, Hoàn Kiếm',
    rating: '4.7',
    reviews: '98',
    distance: '2.8 km',
    image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 3,
    name: 'Maison de Style',
    address: '88 Cầu Giấy, Cầu Giấy',
    rating: '4.6',
    reviews: '76',
    distance: '4.5 km',
    image: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=300&q=80',
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
  const [favorites, setFavorites] = useState({});
  const [quickMode, setQuickMode] = useState('thue-do');

  const toggleFavorite = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('vi-VN').format(val) + 'đ';
  };

  const filteredProducts = FEATURED_PRODUCTS.filter((item) => {
    if (productFilter === 'RENTAL') return item.isRental;
    if (productFilter === 'RESALE') return !item.isRental;
    return true;
  });

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
                Thuê, mua đồ cũ hoặc trải nghiệm thử đồ bằng AI, camera ngay tại nhà. <span className="inline-sparkle">✦</span>
              </p>

              {/* 4 Feature Badges */}
              <div className="hero-features-strip">
                <div className="hero-pill-item">
                  <div className="hero-pill-icon-box">
                    <i className="fa-solid fa-shirt"></i>
                  </div>
                  <div className="hero-pill-text-col">
                    <span>Đa dạng</span>
                    <span>phong cách</span>
                  </div>
                </div>

                <div className="hero-pill-item">
                  <div className="hero-pill-icon-box">
                    <i className="fa-solid fa-wand-magic-sparkles"></i>
                  </div>
                  <div className="hero-pill-text-col">
                    <span>Thử đồ AI</span>
                    <span>& webcam</span>
                  </div>
                </div>

                <div className="hero-pill-item">
                  <div className="hero-pill-icon-box">
                    <i className="fa-solid fa-store"></i>
                  </div>
                  <div className="hero-pill-text-col">
                    <span>Showroom</span>
                    <span>gần bạn</span>
                  </div>
                </div>

                <div className="hero-pill-item">
                  <div className="hero-pill-icon-box">
                    <i className="fa-solid fa-shield-halved"></i>
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
                >
                  <i className="fa-solid fa-shirt btn-hanger-icon"></i>
                  Khám phá ngay <i className="fa-solid fa-arrow-right btn-arrow-icon"></i>
                </button>
                <button
                  className="btn-hero-outline"
                  onClick={() => navigate('/try-on/photo')}
                >
                  <i className="fa-regular fa-circle-play btn-play-icon"></i>
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
                <div className="hero-video-live-badge">
                  <span className="live-pulse-dot"></span>
                  <i className="fa-solid fa-wand-magic-sparkles"></i> AI Try-On Live
                </div>
                <div className="hero-script-overlay">
                  Fashion<br />
                  <span>for your</span><br />
                  <span className="script-life">life ♡</span>
                </div>
                <i className="fa-solid fa-star sparkle-star sparkle-1"></i>
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
              >
                <i className="fa-solid fa-shirt tab-icon"></i>
                <span>Thuê đồ</span>
              </button>

              <button
                className={`quick-tab-btn ${quickMode === 'mua-do-cu' ? 'active' : ''}`}
                onClick={() => {
                  setQuickMode('mua-do-cu');
                  setProductFilter('RESALE');
                }}
              >
                <i className="fa-solid fa-tags tab-icon"></i>
                <span>Mua đồ cũ</span>
              </button>

              <button
                className={`quick-tab-btn ${quickMode === 'thu-do-ai' ? 'active' : ''}`}
                onClick={() => navigate('/try-on/photo')}
              >
                <i className="fa-solid fa-camera tab-icon"></i>
                <span>Thử đồ AI</span>
              </button>

              <button
                className={`quick-tab-btn ${quickMode === 'thu-do-camera' ? 'active' : ''}`}
                onClick={() => navigate('/try-on/webcam')}
              >
                <i className="fa-solid fa-video tab-icon"></i>
                <span>Thử đồ Camera</span>
              </button>
            </div>

            <Link to="/catalog" className="view-all-link">
              Xem tất cả <i className="fa-solid fa-arrow-right"></i>
            </Link>
          </div>
        </section>

        {/* ====================================================
            3. SẢN PHẨM NỔI BẬT (FEATURED PRODUCTS)
            ==================================================== */}
        <section className="featured-products-section">
          <div className="section-header-row">
            <div className="header-left-group">
              <h2 className="section-title-with-star">
                <i className="fa-solid fa-star sparkle-heading-icon"></i> Sản phẩm nổi bật
              </h2>
              <div className="filter-pill-switch">
                <button
                  className={`filter-chip ${productFilter === 'ALL' || productFilter === 'RENTAL' ? 'active' : ''}`}
                  onClick={() => setProductFilter('ALL')}
                >
                  Cho thuê
                </button>
                <button
                  className={`filter-chip ${productFilter === 'RESALE' ? 'active' : ''}`}
                  onClick={() => setProductFilter('RESALE')}
                >
                  Đồ cũ
                </button>
              </div>
            </div>

            <button
              className="carousel-nav-btn"
              onClick={() => navigate('/catalog')}
              title="Xem thêm sản phẩm"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>

          {/* Product Cards Row */}
          <div className="products-carousel-grid">
            {filteredProducts.map((product) => (
              <div key={product.id} className="modern-product-card">
                <div className="card-media-box">
                  <span className={`product-type-badge badge-${product.typeBadge}`}>
                    {product.type}
                  </span>
                  <button
                    className={`card-heart-btn ${favorites[product.id] ? 'favorited' : ''}`}
                    onClick={(e) => toggleFavorite(e, product.id)}
                    aria-label="Thêm vào yêu thích"
                  >
                    <i className={favorites[product.id] ? 'fa-solid fa-heart' : 'fa-regular fa-heart'}></i>
                  </button>
                  <img
                    src={product.image}
                    alt={product.title}
                    className="product-card-img"
                  />
                </div>

                <div className="card-info-box">
                  <h3 className="card-product-name">{product.title}</h3>
                  <div className="card-meta-line">
                    <i className="fa-solid fa-star rating-star"></i>
                    <span className="rating-score">{product.rating}</span>
                    <span className="rating-count">({product.reviews})</span>
                    <span className="meta-separator">•</span>
                    <span className="stock-indicator">
                      <span className="stock-dot"></span> Còn hàng
                    </span>
                  </div>

                  <div className="card-pricing-line">
                    <span className="price-main">{formatCurrency(product.price)}</span>
                    {product.priceUnit && (
                      <span className="price-unit">{product.priceUnit}</span>
                    )}
                  </div>

                  <Link to={`/product/${product.id}`} className="card-action-btn">
                    Xem chi tiết
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ====================================================
            4. TWO-COLUMN: TÌM SHOWROOM & THỬ ĐỒ THEO CÁCH BẠN
            ==================================================== */}
        <section className="dual-split-section">
          {/* Left Column: Tìm Showroom Gần Bạn */}
          <div className="dual-column-box showroom-column">
            <div className="column-head">
              <h3 className="column-title">
                <i className="fa-solid fa-location-dot column-icon"></i> Tìm showroom gần bạn
              </h3>
              <p className="column-desc">
                Khám phá các showroom đối tác của VESTORA quanh khu vực của bạn.
              </p>
            </div>

            <div className="showroom-content-grid">
              {/* Illustrated Map Box */}
              <div className="interactive-map-card">
                <div className="map-artistic-canvas">
                  <div className="map-river"></div>
                  <div className="map-road road-1"></div>
                  <div className="map-road road-2"></div>
                  <div className="map-city-label">Hà Nội</div>

                  {/* Location Pins */}
                  <div className="map-pin pin-1" title="Showroom 1">
                    <i className="fa-solid fa-location-dot map-pin-icon"></i>
                  </div>
                  <div className="map-pin pin-2" title="Showroom 2">
                    <i className="fa-solid fa-location-dot map-pin-icon"></i>
                  </div>
                  <div className="map-pin pin-3" title="Showroom 3">
                    <i className="fa-solid fa-location-dot map-pin-icon"></i>
                  </div>
                  <div className="map-pin pin-4" title="Showroom 4">
                    <i className="fa-solid fa-location-dot map-pin-icon"></i>
                  </div>
                </div>

                <div className="map-overlay-controls">
                  <button
                    className="btn-map-expand"
                    onClick={() => navigate('/map')}
                  >
                    <i className="fa-regular fa-map map-btn-icon"></i> Xem bản đồ lớn
                  </button>
                  <button
                    className="btn-map-locate"
                    onClick={() => navigate('/map')}
                    title="Vị trí hiện tại"
                  >
                    <i className="fa-solid fa-crosshairs"></i>
                  </button>
                </div>
              </div>

              {/* Showroom List */}
              <div className="showrooms-vertical-list">
                {NEARBY_SHOWROOMS.map((store) => (
                  <div
                    key={store.id}
                    className="showroom-item-card"
                    onClick={() => navigate('/map')}
                  >
                    <img
                      src={store.image}
                      alt={store.name}
                      className="showroom-thumb"
                    />
                    <div className="showroom-details">
                      <h4 className="showroom-name">{store.name}</h4>
                      <p className="showroom-address">{store.address}</p>
                      <div className="showroom-meta">
                        <i className="fa-solid fa-star star-icon"></i> {store.rating} ({store.reviews})
                      </div>
                    </div>
                    <div className="showroom-dist-col">
                      <span className="showroom-distance">{store.distance}</span>
                      <i className="fa-solid fa-chevron-right chevron-right"></i>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Thử Đồ Theo Cách Của Bạn */}
          <div className="dual-column-box tryon-column">
            <div className="column-head">
              <h3 className="column-title">
                <i className="fa-solid fa-sliders column-icon"></i> Thử đồ theo cách của bạn
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

                <div className="feature-arrow-btn">
                  <i className="fa-solid fa-arrow-right"></i>
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

                <div className="feature-arrow-btn">
                  <i className="fa-solid fa-arrow-right"></i>
                </div>
              </div>

              {/* Security note */}
              <div className="camera-security-note">
                <i className="fa-solid fa-shield-halved shield-icon"></i>
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
            <h2 className="section-title-with-star">
              <i className="fa-solid fa-star sparkle-heading-icon"></i> Gợi ý phong cách theo nhu cầu
            </h2>
            <Link to="/catalog?category=suggest" className="view-all-link">
              Xem tất cả <i className="fa-solid fa-arrow-right"></i>
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
                  <i className="fa-solid fa-chevron-right style-arrow-icon"></i>
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
              <div className="sustain-badge-title">
                <i className="fa-solid fa-leaf leaf-icon"></i>
                <h3>Mua đồ cũ – Thời trang bền vững</h3>
              </div>
              <p className="sustain-description">
                Những món đồ chất lượng, đã qua sử dụng, được kiểm duyệt kỹ càng.
                Vừa tiết kiệm chi phí, vừa góp phần bảo vệ môi trường.
              </p>
              <button
                className="btn-sustain-cta"
                onClick={() => navigate('/catalog?type=sale')}
              >
                Khám phá đồ cũ <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>

            {/* Right 3 Highlight Badges */}
            <div className="sustain-benefits-col">
              <div className="benefit-card">
                <i className="fa-solid fa-shield-halved benefit-icon"></i>
                <span className="benefit-label">Sản phẩm chất lượng được kiểm duyệt</span>
              </div>
              <div className="benefit-card">
                <i className="fa-solid fa-tags benefit-icon"></i>
                <span className="benefit-label">Giá tốt hơn thị trường</span>
              </div>
              <div className="benefit-card">
                <i className="fa-solid fa-users benefit-icon"></i>
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
              <div className="step-icon-bubble">
                <i className="fa-solid fa-shirt"></i>
              </div>
              <h4 className="step-name">1. Chọn trang phục</h4>
              <p className="step-detail">
                Duyệt sản phẩm thuê, mua cũ hoặc sang nhượng
              </p>
            </div>

            <i className="fa-solid fa-arrow-right step-flow-arrow"></i>

            {/* Step 2 */}
            <div className="step-item-card">
              <div className="step-icon-bubble">
                <i className="fa-solid fa-camera"></i>
              </div>
              <h4 className="step-name">2. Thử đồ AI / Camera</h4>
              <p className="step-detail">
                Xem trước bằng ảnh hoặc webcam
              </p>
            </div>

            <i className="fa-solid fa-arrow-right step-flow-arrow"></i>

            {/* Step 3 */}
            <div className="step-item-card">
              <div className="step-icon-bubble">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <h4 className="step-name">3. Đặt thuê / mua và thanh toán Escrow</h4>
              <p className="step-detail">
                An toàn, minh bạch, bảo vệ quyền lợi
              </p>
            </div>

            <i className="fa-solid fa-arrow-right step-flow-arrow"></i>

            {/* Step 4 */}
            <div className="step-item-card">
              <div className="step-icon-bubble">
                <i className="fa-solid fa-box-open"></i>
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
