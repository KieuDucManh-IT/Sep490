import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/ProductDetail.css';

// Sample High-Fashion Product Data extracted from Figma design
const PRODUCT = {
  id: 'VESTORA-DR-089',
  title: 'Đầm Dạ Hội Lụa Satin Midnight Xếp Nếp',
  sku: 'VESTORA-HAUTE-2026-NIGHT',
  category: 'Đầm Dạ Hội Haute Couture',
  rentalPricePerDay: 2500000,
  depositPrice: 8000000,
  retailPrice: 28000000,
  atelier: {
    name: 'Vestora Master Atelier',
    rating: '4.9 ★ (128 Đánh giá)',
    responseRate: 'Phản hồi trong 15 phút',
    badge: 'CHÍNH HÃNG HAUTE COUTURE',
  },
  images: [
    {
      url: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80',
      label: 'Mặt trước - High Fashion',
    },
    {
      url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=1200&q=80',
      label: 'Chi tiết xếp nếp Lụa Satin',
    },
    {
      url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80',
      label: 'Dáng lưng khoét sâu Elegance',
    },
    {
      url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=80',
      label: 'Góc nghiêng Haute Couture',
    },
  ],
  sizes: [
    { name: 'XS', available: false, specs: 'Ngực 80 | Eo 60 | Mông 86' },
    { name: 'S', available: true, specs: 'Ngực 84 | Eo 64 | Mông 90' },
    { name: 'M', available: true, specs: 'Ngực 88 | Eo 68 | Mông 94' },
    { name: 'L', available: true, specs: 'Ngực 92 | Eo 72 | Mông 98' },
  ],
};

export default function ProductDetailPage() {
  const [selectedImgIndex, setSelectedImgIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState('S');
  const [rentalDuration, setRentalDuration] = useState(3); // 3, 5, 7 days
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [showAiModal, setShowAiModal] = useState(false);

  // Calculate End Date
  const getEndDate = () => {
    if (!startDate) return '';
    const date = new Date(startDate);
    date.setDate(date.getDate() + rentalDuration);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Format currency
  const formatVND = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const activeSizeInfo = PRODUCT.sizes.find((s) => s.name === selectedSize);

  return (
    <div className="product-detail-page">
      {/* Top Navbar Header */}
      <header style={{ background: '#171717', color: '#FFF', padding: '16px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/" style={{ fontFamily: 'var(--font-title)', fontSize: '24px', letterSpacing: '4px', color: '#FFFFFF', textDecoration: 'none', fontWeight: 700 }}>
          VESTORA
        </Link>
        <div style={{ display: 'flex', gap: '24px', fontSize: '13px', letterSpacing: '1px' }}>
          <Link to="/register" style={{ color: '#EAE8E4', textDecoration: 'none' }}>TÀI KHOẢN</Link>
          <Link to="/login" style={{ color: 'var(--color-gold)', textDecoration: 'none' }}>ĐĂNG NHẬP</Link>
        </div>
      </header>

      {/* Breadcrumb Bar */}
      <div className="breadcrumb-bar">
        <div className="breadcrumb-container">
          <nav className="breadcrumb-nav" aria-label="Breadcrumb">
            <Link to="/">Trang chủ</Link>
            <span className="breadcrumb-separator">/</span>
            <a href="#category">Đầm Dạ Hội</a>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">{PRODUCT.title}</span>
          </nav>

          <div className="product-availability-badge">
            <span className="status-dot" />
            <span>SẴN SÀNG MAY ĐO & GIAO NGAY TRONG 24H</span>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="product-main-container">
        {/* LEFT COLUMN: Gallery & Atelier Specs */}
        <div className="gallery-column">
          {/* Master Stage Gallery */}
          <div className="master-stage-gallery">
            <img
              src={PRODUCT.images[selectedImgIndex].url}
              alt={PRODUCT.images[selectedImgIndex].label}
              className="master-stage-image"
            />

            {/* Top Left Badge */}
            <div className="stage-badge-top-left">
              <span>✦</span> MẪU ĐỘC BẢN HAUTE COUTURE
            </div>

            {/* Floating AI 3D Fitting Button */}
            <button
              className="ai-fitting-btn"
              onClick={() => setShowAiModal(true)}
            >
              <span>✨</span> THỬ ĐỒ 3D BẰNG AI
            </button>

            {/* Bottom Caption Overlay */}
            <div className="stage-caption-overlay">
              <span className="stage-caption-title">
                {PRODUCT.images[selectedImgIndex].label}
              </span>
              <span style={{ fontSize: '11px', opacity: 0.8 }}>
                {selectedImgIndex + 1} / {PRODUCT.images.length}
              </span>
            </div>
          </div>

          {/* Thumbnail Reel */}
          <div className="thumbnail-reel">
            {PRODUCT.images.map((img, idx) => (
              <div
                key={idx}
                className={`thumb-item ${selectedImgIndex === idx ? 'active' : ''}`}
                onClick={() => setSelectedImgIndex(idx)}
              >
                <img src={img.url} alt={img.label} />
                <div className="thumb-overlay-tag">Góc {idx + 1}</div>
              </div>
            ))}
          </div>

          {/* Haute Trust Bar */}
          <div className="trust-bar">
            <div className="trust-item">
              <div className="trust-icon-box">🏛️</div>
              <div>
                <div className="trust-text-title">Giặt Hấp Chuẩn Bảo Tàng</div>
                <div className="trust-text-desc">Khử trùng UV & Chăm sóc sợi lụa cao cấp</div>
              </div>
            </div>

            <div className="trust-item">
              <div className="trust-icon-box">🛡️</div>
              <div>
                <div className="trust-text-title">Bảo Hiểm Trang Phục</div>
                <div className="trust-text-desc">An tâm tuyệt đối trước sự cố nhỏ</div>
              </div>
            </div>

            <div className="trust-item">
              <div className="trust-icon-box">🚗</div>
              <div>
                <div className="trust-text-title">Giao Tận Nơi 24/7</div>
                <div className="trust-text-desc">Phục vụ bởi chuyên viên Vestora</div>
              </div>
            </div>
          </div>

          {/* Atelier Notes Banner */}
          <div className="atelier-notes-card">
            <div>
              <div className="atelier-notes-title">Ghi Chú Từ Nhà Thiết Kế</div>
              <div className="atelier-notes-desc">
                "Thiết kế xếp nếp tôn vinh đường cong Á Đông với chất liệu Lụa Satin Midnight độc quyền."
              </div>
            </div>
            <button className="btn-atelier-consult">TƯ VẤN THỬ ĐỒ</button>
          </div>
        </div>

        {/* RIGHT COLUMN: Sticky Booking Module */}
        <div className="booking-column">
          <div className="sticky-booking-card">
            {/* Shop Identity Header Card */}
            <div className="atelier-brand-header">
              <div className="atelier-logo-avatar">V</div>
              <div className="atelier-name-info">
                <div className="atelier-name">
                  {PRODUCT.atelier.name}
                  <span className="verified-icon">✓</span>
                </div>
                <div className="atelier-meta">
                  <span>{PRODUCT.atelier.rating}</span>
                  <span>•</span>
                  <span>{PRODUCT.atelier.responseRate}</span>
                </div>
              </div>
              <button className="btn-follow-shop">THEO DÕI</button>
            </div>

            {/* Product Title & Origin SKU */}
            <div className="product-title-group">
              <div className="product-tag-sku">
                <span className="tag-haute-couture">HAUTE COUTURE</span>
                <span className="sku-text">SKU: {PRODUCT.sku}</span>
              </div>
              <h1 className="product-main-title">{PRODUCT.title}</h1>
            </div>

            {/* Price & Deposit Card */}
            <div className="pricing-card">
              <div className="rental-price-row">
                <div>
                  <span className="rental-price-main">
                    {formatVND(PRODUCT.rentalPricePerDay)}
                  </span>
                  <span className="rental-duration-label">/ {rentalDuration} ngày thuê</span>
                </div>
                <span className="deposit-badge">
                  CỌC: {formatVND(PRODUCT.depositPrice)}
                </span>
              </div>

              <div className="deposit-note">
                <span>🛡️</span>
                <span>
                  Tiền cọc được hoàn trả 100% ngay sau khi quý khách hoàn tất trả trang phục.
                </span>
              </div>
            </div>

            {/* Interactive Size Selector */}
            <div className="size-selection-group">
              <div className="size-header-row">
                <span className="size-label">CHỌN KÍCH THƯỚC (SIZE)</span>
                <button className="size-guide-btn" onClick={() => setShowAiModal(true)}>
                  📏 TƯ VẤN SIZE THEO SỐ ĐO AI
                </button>
              </div>

              <div className="size-options-grid">
                {PRODUCT.sizes.map((size) => (
                  <button
                    key={size.name}
                    disabled={!size.available}
                    className={`size-btn ${!size.available ? 'disabled' : ''} ${
                      selectedSize === size.name ? 'active' : ''
                    }`}
                    onClick={() => setSelectedSize(size.name)}
                  >
                    SIZE {size.name}
                  </button>
                ))}
              </div>

              {/* Active Size Specs Strip */}
              {activeSizeInfo && (
                <div className="size-specs-bar">
                  <span>Thông số Size {activeSizeInfo.name}:</span>
                  <strong>{activeSizeInfo.specs}</strong>
                </div>
              )}
            </div>

            {/* Rental Duration & Calendar Module */}
            <div className="rental-date-picker">
              <div className="date-picker-title">THỜI GIAN THUÊ SẢN PHẨM</div>

              <div className="duration-pills">
                {[3, 5, 7].map((days) => (
                  <div
                    key={days}
                    className={`duration-pill ${rentalDuration === days ? 'active' : ''}`}
                    onClick={() => setRentalDuration(days)}
                  >
                    {days} NGÀY
                  </div>
                ))}
              </div>

              <div className="date-inputs-row">
                <div className="date-input-field">
                  <label>NGÀY NHẬN TRANG PHỤC</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="date-input-field">
                  <label>NGÀY TRẢ TRANG PHỤC (DỰ KIẾN)</label>
                  <input type="text" readOnly value={getEndDate()} />
                </div>
              </div>
            </div>

            {/* CTA Action Buttons */}
            <div className="action-buttons-group">
              <button
                className="btn-book-now"
                onClick={() =>
                  alert(
                    `Đã đăng ký thuê thành công đầm "${PRODUCT.title}" - Size ${selectedSize} trong ${rentalDuration} ngày!`
                  )
                }
              >
                ĐẶT THUÊ NGAY ({formatVND(PRODUCT.rentalPricePerDay)})
              </button>
              <button
                className="btn-add-cart"
                onClick={() => alert('Đã thêm sản phẩm vào Giỏ Hàng!')}
              >
                THÊM VÀO GIỎ HÀNG
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AI 3D Fitting Modal Mock */}
      {showAiModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setShowAiModal(false)}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '24px',
              padding: '32px',
              maxWidth: '500px',
              width: '90%',
              textAlign: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>✨</div>
            <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '24px', marginBottom: '12px' }}>
              Trải Nghiệm Thử Đồ AI 3D
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginBottom: '24px', lineHeight: 1.6 }}>
              Công nghệ Vestora AI Fit sẽ mô phỏng vóc dáng của bạn dựa trên 3 chỉ số (Ngực, Eo, Mông) để dự đoán độ vừa vặn chính xác 99%.
            </p>
            <button
              className="btn-primary"
              style={{ width: '100%', marginBottom: '12px' }}
              onClick={() => {
                alert('Tải mô hình 3D thành công! Size gợi ý hoàn hảo cho bạn là Size S.');
                setShowAiModal(false);
              }}
            >
              BẮT ĐẦU QUÉT THÔNG SỐ VÓC DÁNG
            </button>
            <button
              className="btn-secondary"
              style={{ width: '100%' }}
              onClick={() => setShowAiModal(false)}
            >
              ĐÓNG
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

