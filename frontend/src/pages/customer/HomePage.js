import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import '../../styles/HomePage.css';

// Featured Products Mock Data based on Figma design
const FEATURED_PRODUCTS = [
  {
    id: 'VESTORA-DR-089',
    shop: 'MÂY FASHION',
    title: 'Đầm Dạ Hội Lụa Satin Midnight Xếp Nếp',
    price: 2500000,
    deposit: 500000,
    tag: 'THUÊ • THỬ AI',
    image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80',
    category: 'Đầm & Váy',
  },
  {
    id: 'VESTORA-SUIT-012',
    shop: 'ELEGANT STUDIO',
    title: 'Bộ Suit Nữ Tuxedo Cắt May Định Hình',
    price: 1800000,
    deposit: 400000,
    tag: 'THUÊ • THỬ AI',
    image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80',
    category: 'Vest & Suit',
  },
  {
    id: 'VESTORA-BAG-045',
    shop: 'VINTAGE VAULT',
    title: 'Túi Xách Mini Nữ Quai Đeo Cổ Điển',
    price: 1200000,
    deposit: 300000,
    tag: 'THUÊ • THỬ AI',
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    category: 'Túi Xách',
  },
  {
    id: 'VESTORA-JACKET-099',
    shop: 'ATELIER HOA',
    title: 'Áo Khoác Tweed Dệt Thủ Công Nữ Tính',
    price: 2200000,
    deposit: 450000,
    tag: 'THUÊ • THỬ AI',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
    category: 'Áo & Blazer',
  },
  {
    id: 'VESTORA-COAT-003',
    shop: 'SOLIS CLOSET',
    title: 'Áo Măng Tô Dạ Dáng Dài Phom Rủ',
    price: 2000000,
    deposit: 500000,
    tag: 'THUÊ • THỬ AI',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
    category: 'Áo & Blazer',
  },
  {
    id: 'VESTORA-DRESS-022',
    shop: 'MƠ STUDIO',
    title: 'Đầm Lụa Crepe Dáng Suông Kèm Khăn Choàng',
    price: 1900000,
    deposit: 400000,
    tag: 'THUÊ • THỬ AI',
    image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80',
    category: 'Đầm & Váy',
  },
  {
    id: 'VESTORA-DRESS-077',
    shop: 'LUMIÈRE BOUTIQUE',
    title: 'Đầm Xếp Nếp Bất Đối Xứng Tơ Tằm',
    price: 2800000,
    deposit: 600000,
    tag: 'THUÊ • THỬ AI',
    image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80',
    category: 'Trang Phục Dạ Hội',
  },
  {
    id: 'VESTORA-CORSET-011',
    shop: 'SÀI GÒN VINTAGE',
    title: 'Đầm Corset Cổ Điển Dạ Tiệc Taffeta',
    price: 3200000,
    deposit: 700000,
    tag: 'THUÊ • THỬ AI',
    image: 'https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=800&q=80',
    category: 'Trang Phục Dạ Hội',
  },
];

const STORES_NEARBY = [
  {
    index: 1,
    name: 'Mây Fashion',
    address: 'Đồng Khởi, Quận 1 • 0.8 km',
    desc: '86 mẫu đầm dạ tiệc & tweed có sẵn size S–M',
    badge: 'SẴN ĐỒ',
  },
  {
    index: 2,
    name: 'Lumière Boutique',
    address: 'Nguyễn Thị Minh Khai, Q.3 • 1.9 km',
    desc: '120 mẫu đầm tơ tằm & phụ kiện cao cấp',
    badge: 'GIAO 2H',
  },
  {
    index: 3,
    name: 'Atelier Hoa',
    address: 'Tràng Tiền, Hoàn Kiếm • HN',
    desc: 'Chuyên phục vụ sự kiện thảm đỏ & dạ hội',
    badge: 'VIP ATELIER',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Tất cả');
  const [activeMode, setActiveMode] = useState('CHO THUÊ');

  const filteredProducts = FEATURED_PRODUCTS.filter((item) => {
    if (activeTab === 'Tất cả') return true;
    return item.category === activeTab;
  });

  const formatVND = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  return (
    <div className="homepage-container">
      {/* Top Header Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="hero-section">
        <div>
          <div className="hero-subtag">NỀN TẢNG CHO THUÊ & SANG NHƯỢNG THỜI TRANG</div>
          <h1 className="hero-title">
            Thuê Đồ Thời Trang —<br />Thử Trước Bằng AI
          </h1>
          <p className="hero-description">
            Khám phá hàng nghìn trang phục từ các gian hàng uy tín. Thử đồ ảo AI 3D trước khi thuê, đặt cọc an toàn qua Escrow — hoàn tiền tự động sau 3 ngày trả đồ.
          </p>

          <div className="hero-actions">
            <button className="btn-primary" onClick={() => navigate('/try-on-photo')}>
              THỬ ĐỒ AI ➔
            </button>
            <button className="btn-secondary" onClick={() => navigate('/catalog')}>
              KHÁM PHÁ NGAY
            </button>
          </div>

          <div className="hero-stats-row">
            <div>
              <div className="stat-number">500+</div>
              <div className="stat-label">GIAN HÀNG</div>
            </div>
            <div>
              <div className="stat-number">30fps</div>
              <div className="stat-label">THỬ ĐỒ AI</div>
            </div>
            <div>
              <div className="stat-number">100%</div>
              <div className="stat-label">HOÀN CỌC</div>
            </div>
          </div>
        </div>

        {/* Hero Gallery Card */}
        <div className="hero-image-stage">
          <img
            src="https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1000&q=80"
            alt="Lookbook Atelier Privé"
          />
          <div className="hero-caption-badge">
            <span>LOOKBOOK ATELIER PRIVÉ — ĐẦM DẠ HỘI LỤA XẾP NẾP</span>
            <span>↗</span>
          </div>
        </div>
      </section>

      {/* Escrow Guarantee Ticker */}
      <div className="escrow-ticker-bar">
        <div className="escrow-ticker-content">
          <span>• ĐẶT CỌC ESCROW AN TOÀN</span>
          <span>• THỬ ĐỒ AI TRƯỚC KHI THUÊ</span>
          <span>• HOÀN CỌC TỰ ĐỘNG 3 NGÀY</span>
          <span>• GIAO HÀNG NỘI THÀNH 2H</span>
        </div>
      </div>

      {/* Featured Products Section */}
      <section className="section-container">
        <div className="section-header">
          <div className="section-subtitle">BỘ SỰ TẬP CAO CẤP</div>
          <h2 className="section-title">SẢN PHẨM CHO THUÊ NỔI BẬT</h2>
        </div>

        {/* Category Tabs & Mode Toggle */}
        <div className="filter-bar-row">
          <div className="category-tabs">
            {['Tất cả', 'Đầm & Váy', 'Áo & Blazer', 'Vest & Suit', 'Túi Xách', 'Trang Phục Dạ Hội'].map((tab) => (
              <button
                key={tab}
                className={`category-tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="mode-toggle-group">
            <button
              className={`mode-toggle-btn ${activeMode === 'CHO THUÊ' ? 'active' : ''}`}
              onClick={() => setActiveMode('CHO THUÊ')}
            >
              • CHO THUÊ
            </button>
            <button
              className={`mode-toggle-btn ${activeMode === 'THANH LÝ' ? 'active' : ''}`}
              onClick={() => setActiveMode('THANH LÝ')}
            >
              THANH LÝ
            </button>
          </div>
        </div>

        {/* Products Grid */}
        <div className="products-grid">
          {filteredProducts.map((product) => (
            <Link key={product.id} to={`/product/${product.id}`} className="product-card">
              <div className="card-image-box">
                <img src={product.image} alt={product.title} />
                <span className="card-tag-badge">{product.tag}</span>
                <button className="card-fav-btn" onClick={(e) => e.preventDefault()}>
                  ♡
                </button>
              </div>

              <div className="card-content-body">
                <div className="card-shop-name">GIAN HÀNG: {product.shop}</div>
                <div className="card-product-title">{product.title}</div>
                <div className="card-price-row">
                  <span className="card-price-main">{formatVND(product.price)} <small style={{ fontWeight: 400, fontSize: '11px', color: '#666' }}>/ ngày</small></span>
                  <span className="card-deposit-sub">Cọc: {formatVND(product.deposit)}</span>
                </div>
                <button className="card-btn-tryon">✨ THỬ ĐỒ AI</button>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Near Me Shops Section */}
      <section className="section-container" style={{ paddingTop: 0 }}>
        <div className="near-me-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="section-subtitle">VỊ TRÍ & GIAN HÀNG SẴN CÓ</div>
              <h2 className="section-title" style={{ fontSize: '28px' }}>TÌM SHOP GẦN BẠN</h2>
            </div>
            <button className="btn-primary" onClick={() => navigate('/map')}>
              📍 MỞ BẢN ĐỒ ➔
            </button>
          </div>

          <div className="shops-grid-3">
            {STORES_NEARBY.map((store) => (
              <div key={store.name} className="shop-location-card">
                <div>
                  <div className="shop-card-index">{store.index}</div>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
                    {store.name}
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--color-gold-deep)', fontWeight: 600, marginBottom: '8px' }}>
                    {store.address}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
                    {store.desc}
                  </p>
                </div>
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', fontWeight: 600 }}>
                  <span style={{ background: '#ECFDF5', color: '#059669', padding: '4px 8px', borderRadius: '4px' }}>
                    {store.badge}
                  </span>
                  <Link to="/catalog" style={{ color: 'var(--color-black)', textDecoration: 'none' }}>
                    Xem kho đồ ➔
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Try-On Section */}
      <section className="section-container">
        <div className="section-header">
          <div className="section-subtitle">CÔNG NGHỆ THỬ ĐỒ ÁO</div>
          <h2 className="section-title">TRẢI NGHIỆM THỬ ĐỒ AI</h2>
        </div>

        <div className="ai-features-grid">
          <div className="ai-feature-card">
            <div>
              <div className="ai-feature-icon">📹</div>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', marginBottom: '8px' }}>
                Thử Đồ Qua Webcam
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                Bật camera. AI nhận diện dáng người 30fps và ướm trang phục real-time mượt mà, giúp bạn xem trước phom áo khi di chuyển.
              </p>
            </div>
            <button className="btn-secondary" onClick={() => navigate('/try-on-webcam')}>
              WEBCAM 30FPS ➔
            </button>
          </div>

          <div className="ai-feature-card">
            <div>
              <div className="ai-feature-icon">📷</div>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', marginBottom: '8px' }}>
                Thử Đồ Bằng Ảnh
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                Tải ảnh toàn thân. AI tự động tách nền và ướm đồ lên dáng bạn với tỷ lệ chuẩn xác, mô phỏng chân thực độ ôm sát và nếp nhăn vải.
              </p>
            </div>
            <button className="btn-secondary" onClick={() => navigate('/try-on-photo')}>
              AI TÁCH NÊN & FIT PHOM ➔
            </button>
          </div>

          <div className="ai-feature-card">
            <div>
              <div className="ai-feature-icon">✨</div>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', marginBottom: '8px' }}>
                Gợi Ý Phong Cách AI
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                Phân tích sắc tố da và dáng người để đề xuất outfit phù hợp cho từng sự kiện — từ tiệc cưới sang trọng đến dạ tiệc công ty.
              </p>
            </div>
            <button className="btn-secondary" onClick={() => navigate('/catalog')}>
              PERSONAL STYLIST AI ➔
            </button>
          </div>
        </div>
      </section>

      {/* Showroom & Collection CTA Banner */}
      <section className="section-container" style={{ paddingTop: 0 }}>
        <div className="merchant-cta-banner">
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '2px', color: 'var(--color-gold)', marginBottom: '8px' }}>
              TRẢI NGHIỆM ĐẲNG CẤP VESTORA
            </div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '32px', marginBottom: '12px', color: '#FFF' }}>
              Trải Nghiệm Trang Phục Cao Cấp<br />Tại Hệ Thống Cửa Hàng
            </h2>
            <p style={{ fontSize: '14px', color: '#A3A3A3', maxWidth: '480px' }}>
              Khám phá bộ sưu tập trang phục thiết kế độc quyền, đặt lịch thuê online hoặc ghé ngay các chi nhánh VESTORA gần bạn để thử đồ trực tiếp.
            </p>
          </div>

          <button className="btn-primary" onClick={() => navigate('/map')}>
            TÌM CỬA HÀNG GẦN BẠN ➔
          </button>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}

