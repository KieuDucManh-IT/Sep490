import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import '../../styles/Catalog.css';

const CATALOG_ITEMS = [
  {
    id: 'VESTORA-DR-089',
    shop: 'Thanh Lịch Boutique • Quận 1, TP.HCM',
    rating: '4.9 (48)',
    title: 'Đầm Dạ Hội Lụa Satin Midnight',
    price: 2800000,
    deposit: 600000,
    duration: '3 NGÀY',
    tag: 'PAYOS ESCROW',
    image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80',
    category: 'Đầm & Váy Dạ Hội',
  },
  {
    id: 'VESTORA-SUIT-012',
    shop: 'Maison De Luxe • Hoàn Kiếm, HN',
    rating: '5.0 (32)',
    title: 'Bộ Suit Nữ Tuxedo Cắt May Định Hình',
    price: 3500000,
    deposit: 800000,
    duration: '4 NGÀY',
    tag: 'PAYOS ESCROW',
    image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80',
    category: 'Vest & Suit May Đo',
  },
  {
    id: 'VESTORA-COAT-003',
    shop: 'Atelier Privé • Quận 3, TP.HCM',
    rating: '4.8 (19)',
    title: 'Áo Măng Tô Dạ Bện Thuần Túy',
    price: 4200000,
    deposit: 1000000,
    duration: '3 NGÀY',
    tag: 'PAYOS ESCROW',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=800&q=80',
    category: 'Áo Blazer & Coat',
  },
  {
    id: 'VESTORA-AO-DAI-01',
    shop: 'Áo Dài Di Sản • Quận 1, TP.HCM',
    rating: '4.9 (64)',
    title: 'Áo Dài Tơ Tầm Thêu Tay Họa Tiết',
    price: 2200000,
    deposit: 500000,
    duration: '2 NGÀY',
    tag: 'PAYOS ESCROW',
    image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80',
    category: 'Đầm & Váy Dạ Hội',
  },
  {
    id: 'VESTORA-DRESS-077',
    shop: 'Soleil Couture • Quận 7, TP.HCM',
    rating: '4.7 (27)',
    title: 'Đầm Xếp Nếp Bất Đối Xứng Tơ Tằm',
    price: 3100000,
    deposit: 700000,
    duration: '3 NGÀY',
    tag: 'PAYOS ESCROW',
    image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80',
    category: 'Đầm & Váy Dạ Hội',
  },
  {
    id: 'VESTORA-JACKET-099',
    shop: 'Archive Studio • Đống Đa, HN',
    rating: '4.9 (53)',
    title: 'Áo Khoác Tweed Dệt Thủ Công Cúc Ngọc Trai',
    price: 1900000,
    deposit: 450000,
    duration: '3 NGÀY',
    tag: 'PAYOS ESCROW',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
    category: 'Áo Blazer & Coat',
  },
];

export default function CatalogPage() {
  const [selectedCategory, setSelectedCategory] = useState('Đầm & Váy Dạ Hội');
  const [aiFilterOnly, setAiFilterOnly] = useState(true);
  const [selectedSizes, setSelectedSizes] = useState(['S', 'M']);
  const [searchQuery, setSearchQuery] = useState('');

  const formatVND = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const toggleSize = (size) => {
    if (selectedSizes.includes(size)) {
      setSelectedSizes(selectedSizes.filter((s) => s !== size));
    } else {
      setSelectedSizes([...selectedSizes, size]);
    }
  };

  return (
    <div className="catalog-page-container">
      <Navbar />

      {/* Header Hero Banner */}
      <div className="catalog-header-hero">
        <div className="catalog-breadcrumb-bar">
          TRANG CHỦ • BỘ SỰ TẬP CHO THUÊ
        </div>
        <div className="escrow-inline-badge">
          🛡️ BẢO CHỨNG BỞI HỆ THỐNG KÝ QUỸ PAYOS ESCROW
        </div>
        <h1 className="catalog-title">Tuyển Tập Dạ Hội & Đồ Hiệu Độc Bản</h1>
        <div className="catalog-subtitle-row">
          <div>
            Khám phá hàng ngàn thiết kế cao cấp chính hãng từ các gian hàng đối tác hàng đầu, thử đồ AI tức thì và thanh toán ký quỹ an toàn.
          </div>
          <div>Hiển thị 128 thiết kế độc bản</div>
        </div>
      </div>

      {/* Control Search & Filter Mode Bar */}
      <div className="control-filter-bar">
        <div className="mode-toggle-group">
          <button className="mode-toggle-btn active">• CHO THUÊ</button>
          <button className="mode-toggle-btn">🏷️ THANH LÝ SANG NHƯỢNG</button>
        </div>

        <div className="search-input-box">
          <span style={{ marginRight: '8px' }}>🔍</span>
          <input
            type="text"
            placeholder="Tìm kiếm trang phục dạ hội, blazer, phụ kiện..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <select
          style={{
            padding: '10px 16px',
            borderRadius: '9999px',
            border: '1px solid var(--color-border)',
            background: '#FFF',
            fontSize: '12px',
            fontWeight: 600,
            outline: 'none',
          }}
        >
          <option>Sắp xếp: Mới Nhất</option>
          <option>Giá: Thấp đến Cao</option>
          <option>Giá: Cao đến Thấp</option>
          <option>Được yêu thích nhất</option>
        </select>
      </div>

      {/* Active Filter Tags */}
      <div className="active-filter-tags-bar">
        <span style={{ color: 'var(--color-text-secondary)', fontSize: '11px', fontWeight: 600 }}>
          ĐANG CHỌN:
        </span>
        <span className="filter-tag-pill">
          {selectedCategory} ✕
        </span>
        <span className="filter-tag-pill">
          Size: {selectedSizes.join(', ')} ✕
        </span>
        <span className="filter-tag-pill">
          Màu Den Midnight ✕
        </span>
        {aiFilterOnly && (
          <span className="filter-tag-pill" style={{ background: '#ECFDF5', color: '#059669' }}>
            ✨ Thử Đồ AI 3D Bật ✕
          </span>
        )}
      </div>

      {/* Main Catalog Grid */}
      <div className="catalog-main-grid">
        {/* Left Sidebar Filter Panel */}
        <aside className="sidebar-filter-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.8px' }}>
              ≡ BỘ LỌC TÌM KIẾM
            </span>
            <button
              onClick={() => {
                setSelectedCategory('Tất cả');
                setSelectedSizes([]);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--color-gold-deep)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
            >
              XÓA TẤT CẢ
            </button>
          </div>

          {/* AI Try-On Toggle */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>✨ THỬ ĐỒ AI 3D</div>
              <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>Lọc đồ hỗ trợ buồng thử</div>
            </div>
            <input
              type="checkbox"
              checked={aiFilterOnly}
              onChange={(e) => setAiFilterOnly(e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>

          {/* Category List */}
          <div>
            <div className="filter-section-title">DANH MỤC TRANG PHỤC</div>
            <div className="category-filter-list">
              {[
                { name: 'Đầm & Váy Dạ Hội', count: 86 },
                { name: 'Áo Blazer & Coat', count: 42 },
                { name: 'Vest & Suit May Đo', count: 29 },
                { name: 'Túi Xách Xa Xỉ', count: 34 },
                { name: 'Phụ Kiện & Giày', count: 18 },
              ].map((cat) => (
                <div
                  key={cat.name}
                  className={`category-filter-item ${selectedCategory === cat.name ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat.name)}
                >
                  <span>{cat.name}</span>
                  <span className="category-count">{cat.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Size Filter */}
          <div>
            <div className="filter-section-title">KÍCH THƯỚC (SIZE)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((sz) => (
                <button
                  key={sz}
                  className={`size-btn ${selectedSizes.includes(sz) ? 'active' : ''}`}
                  style={{ height: '36px', fontSize: '11px' }}
                  onClick={() => toggleSize(sz)}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Condition Filter */}
          <div>
            <div className="filter-section-title">TÌNH TRẠNG TRANG PHỤC</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="condition" defaultChecked /> Tất cả
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="condition" /> Như mới 99% (Archival Grade)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input type="radio" name="condition" /> Brand New 100% (Nguyên Tag)
              </label>
            </div>
          </div>
        </aside>

        {/* Right Product Grid */}
        <div>
          <div className="products-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {CATALOG_ITEMS.map((item) => (
              <Link key={item.id} to={`/product/${item.id}`} className="product-card">
                <div className="card-image-box">
                  <img src={item.image} alt={item.title} />
                  <span className="card-tag-badge">THUÊ | {item.duration}</span>
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '12px',
                      background: 'rgba(255, 255, 255, 0.9)',
                      backdropFilter: 'blur(4px)',
                      padding: '4px 10px',
                      borderRadius: '9999px',
                      fontSize: '10px',
                      fontWeight: 600,
                    }}
                  >
                    ✨ THỬ ĐỒ AI
                  </span>
                </div>

                <div className="card-content-body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                    <span>{item.shop}</span>
                    <span style={{ color: 'var(--color-gold-deep)', fontWeight: 600 }}>★ {item.rating}</span>
                  </div>

                  <h3 className="card-product-title" style={{ fontSize: '15px' }}>
                    {item.title}
                  </h3>

                  <div className="card-price-row">
                    <div>
                      <span className="card-price-main">{formatVND(item.price)}</span>
                      <small style={{ fontSize: '10px', color: '#666', marginLeft: '4px' }}>/ ngày</small>
                    </div>
                    <span className="card-deposit-sub">{item.tag}</span>
                  </div>

                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                    Cọc bảo đảm: {formatVND(item.deposit)} (PayOS Escrow)
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          <div className="pagination-bar">
            <button className="page-num-btn">←</button>
            <button className="page-num-btn active">1</button>
            <button className="page-num-btn">2</button>
            <button className="page-num-btn">3</button>
            <span>...</span>
            <button className="page-num-btn">12</button>
            <button className="page-num-btn">→</button>
          </div>
        </div>
      </div>

      {/* Escrow Guarantee Footer Banner */}
      <div style={{ maxWidth: '1280px', margin: '0 48px 60px 48px', background: '#F5F3EF', borderRadius: '24px', padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#ECFDF5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
            🛡️
          </div>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>
              Quy Trình Kiểm Định & Bảo Vệ Tuyệt Đối
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
              Cam kết 100% trang phục chính hãng kiểm định IFAB, giặt hấp diệt khuẩn tiêu chuẩn bảo tàng và hoàn cọc tự động qua PayOS.
            </p>
          </div>
        </div>
        <button className="btn-primary">TÌM HIỂU VỀ ESCROW</button>
      </div>

      <Footer />
    </div>
  );
}

