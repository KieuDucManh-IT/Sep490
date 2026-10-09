import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import '../../styles/Favorites.css';

const FAVORITE_ITEMS = [
  {
    id: 'VESTORA-DR-089',
    shop: 'MÂY FASHION',
    title: 'Đầm Dạ Hội Lụa Satin Midnight Xếp Nếp',
    price: 250000,
    deposit: 500000,
    type: 'THUÊ',
    image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'VESTORA-DR-090',
    shop: 'MÂY FASHION',
    title: 'Đầm Dạ Hội Lụa Satin Midnight Xếp Nếp (Biến Thể Lưng Khoét)',
    price: 250000,
    deposit: 500000,
    type: 'THUÊ',
    image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'VESTORA-SUIT-012',
    shop: 'ELEGANT STUDIO',
    title: 'Bộ Suit Nữ Tuxedo Cắt May Định Hình',
    price: 1800000,
    deposit: 400000,
    type: 'THUÊ',
    image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'VESTORA-JACKET-099',
    shop: 'ATELIER HOA',
    title: 'Áo Khoác Tweed Dệt Thủ Công Nữ Tính',
    price: 2200000,
    deposit: 450000,
    type: 'THANH LÝ',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
  },
];

export default function FavoritesPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('TẤT CẢ (4)');

  const formatVND = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  return (
    <div className="favorites-page-container">
      <Navbar />

      {/* Header Banner */}
      <div className="fav-header-hero">
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1px', color: '#666', marginBottom: '8px' }}>
          TRANG CHỦ &gt; DANH SÁCH YÊU THÍCH
        </div>
        <div style={{ fontSize: '10px', color: 'var(--color-gold-deep)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
          SALON PRIVÉ ARCHIVE
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '40px', margin: '0 0 6px 0' }}>
              Sản Phẩm Yêu Thích
            </h1>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
              Bạn có <strong>4 sản phẩm</strong> đã lưu trong bộ sưu tập cá nhân
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn-primary"
              style={{ fontSize: '12px' }}
              onClick={() => alert('Đã chuyển tất cả sản phẩm vào giỏ hàng!')}
            >
              🛍️ CHUYỂN TẤT CẢ VÀO GIỎ
            </button>
            <button className="btn-secondary" style={{ fontSize: '12px' }}>
              XÓA HẾT
            </button>
          </div>
        </div>

        {/* Filter Tabs Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '28px', borderTop: '1px solid #E5E7EB', paddingTop: '20px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            {['TẤT CẢ (4)', 'ĐỒ CHO THUÊ (3)', 'THANH LÝ (1)'].map((tab) => (
              <button
                key={tab}
                className={`category-tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
            🛡️ BẢO CHỨNG ESCROW 100% KIỂM ĐỊNH
          </span>
        </div>
      </div>

      {/* Favorites Grid */}
      <div className="fav-grid-container">
        {FAVORITE_ITEMS.map((item) => (
          <div key={item.id} className="product-card">
            <div className="card-image-box">
              <img src={item.image} alt={item.title} />
              <span className="card-tag-badge">{item.type} • ✨ Thử</span>
              <button
                className="card-fav-btn"
                style={{ color: '#DC2626' }}
                onClick={() => alert('Đã xóa khỏi danh sách yêu thích')}
              >
                ♥
              </button>
            </div>

            <div className="card-content-body">
              <div className="card-shop-name">GIAN HÀNG: {item.shop}</div>
              <h3 className="card-product-title" style={{ fontSize: '15px' }}>
                {item.title}
              </h3>
              <div className="card-price-row">
                <span className="card-price-main">{formatVND(item.price)} <small style={{ fontSize: '10px', color: '#666', fontWeight: 400 }}>/ ngày</small></span>
                <span className="card-deposit-sub">Cọc: {formatVND(item.deposit)}</span>
              </div>
              <button className="card-btn-tryon" onClick={() => navigate('/try-on-photo')}>
                ✨ THỬ ĐỒ AI
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Privé Member Sync Banner */}
      <div style={{ maxWidth: '1280px', margin: '0 48px 60px 48px', background: '#F5F3EF', borderRadius: '24px', padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--color-gold-deep)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '6px' }}>
            ĐẶC QUYỀN HỘI VIÊN VESTORA
          </div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '24px', margin: '0 0 6px 0' }}>
            Đồng Bộ Tủ Đồ Ảo Với Chuyên Gia Phong Cách
          </h2>
          <p style={{ fontSize: '13px', color: '#666', margin: 0, maxWidth: '640px' }}>
            Các sản phẩm lưu trong Danh Sách Yêu Thích sẽ được đồng bộ trực tiếp khi bạn đặt lịch thử đồ riêng tư tại Salon Privé hoặc tham vấn trực tuyến với Stylist.
          </p>
        </div>

        <button className="btn-primary" onClick={() => navigate('/try-on-photo')}>
          THỬ ĐỒ AI NGAY
        </button>
      </div>

      <Footer />
    </div>
  );
}

