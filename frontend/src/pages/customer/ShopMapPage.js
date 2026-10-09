import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import '../../styles/ShopMap.css';

const NEARBY_ATELIERS = [
  {
    id: 1,
    name: 'Mây Fashion Haute Atelier',
    address: '86 Đồng Khởi, Bến Nghé, Quận 1, TP.HCM',
    distance: '0.8 km',
    travelTime: '~3 phút di chuyển',
    rating: '4.9 (1.2k đánh giá)',
    itemCount: '520+ mẫu váy đầm cao cấp',
    sizeStatus: 'Sẵn 18 mẫu size S, M của bạn',
    openHours: '09:00 - 21:30 (Đang mở cửa)',
    tags: ['TOP 1 ĐỀ XUẤT', 'SẴN SÀNG PHỤC VỤ', 'THỬ ĐỒ WEBCAM 30FPS'],
    images: [
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1518049362265-d5b2a6467637?auto=format&fit=crop&w=400&q=80',
    ],
  },
  {
    id: 2,
    name: 'Lumière Boutique Privée',
    address: '42 Nguyễn Thị Minh Khai, Đa Kao, Quận 1, TP.HCM',
    distance: '1.5 km',
    travelTime: '~7 phút di chuyển',
    rating: '4.9 (870 đánh giá)',
    itemCount: '280+ sản phẩm độc bản',
    sizeStatus: 'Sẵn 12 mẫu size của bạn',
    openHours: '09:30 - 21:00 (Đang mở cửa)',
    tags: ['GIAO 2H', 'PHÒNG SCAN 3D SINH TRẮC HỌC'],
    images: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=400&q=80',
    ],
  },
  {
    id: 3,
    name: 'Atelier Hoa Haute Couture',
    address: '15 Thảo Điền, Thành Phố Thủ Đức, TP.HCM',
    distance: '2.4 km',
    travelTime: '~12 phút di chuyển',
    rating: '5.0 (450 đánh giá)',
    itemCount: '190+ thiết kế thảm đỏ',
    sizeStatus: 'Sẵn 8 mẫu size của bạn',
    openHours: '10:00 - 20:30 (Đang mở cửa)',
    tags: ['COUTURE VIP', 'GIAO NỘI THÀNH HỎA TỐC'],
    images: [
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=400&q=80',
      'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=400&q=80',
    ],
  },
];

export default function ShopMapPage() {
  const navigate = useNavigate();
  const [selectedRadius, setSelectedRadius] = useState('1km');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [selectedStore, setSelectedStore] = useState(NEARBY_ATELIERS[0]);

  return (
    <div style={{ background: '#FBF9F5', minHeight: '100vh' }}>
      <Navbar />

      {/* Header Bar */}
      <div style={{ background: '#171717', color: '#FFF', padding: '48px 48px 36px 48px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-gold)', letterSpacing: '2px', fontWeight: 600, marginBottom: '8px' }}>
            📡 VESTORA RADAR MAPS • ĐỊNH VỊ SHOWROOM ĐỒ THUÊ GẦN BẠN
          </div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '36px', fontWeight: 400, margin: '0 0 12px 0' }}>
            Tìm Cửa Hàng Cho Thuê Gần Nhất (Thử Trực Tiếp Hoặc Giao Hỏa Tốc)
          </h1>
          <p style={{ color: '#A3A3A3', fontSize: '14px', maxWidth: '720px', margin: 0 }}>
            Khám phá các gian hàng đối tát VESTORA Privé trong bán kính 1km - 10km. Đã đồng bộ sẵn vóc dáng 3D của bạn để gợi ý sản phẩm vừa vặn tức thì.
          </p>

          {/* Filter Toolbar */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginTop: '28px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#262626', borderRadius: '12px', padding: '4px' }}>
              <span style={{ fontSize: '11px', color: '#888', padding: '0 12px', fontWeight: 600 }}>BÁN KÍNH:</span>
              {['1km', '3km', '5km', 'Tất cả'].map((radius) => (
                <button
                  key={radius}
                  onClick={() => setSelectedRadius(radius)}
                  style={{
                    border: 'none',
                    background: selectedRadius === radius ? 'var(--color-gold-deep)' : 'transparent',
                    color: selectedRadius === radius ? '#FFF' : '#CCC',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {radius}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'ALL', label: 'Tất cả cửa hàng' },
                { id: 'DRESS', label: 'Đầm dạ hội & Event' },
                { id: 'SUIT', label: 'Vest & Tuxedo' },
                { id: 'FAST', label: '⚡ Giao hỏa tốc < 2h' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    border: '1px solid #333',
                    background: activeCategory === cat.id ? '#FFF' : '#1F1F1F',
                    color: activeCategory === cat.id ? '#171717' : '#BBB',
                    padding: '8px 16px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Viewport */}
      <div className="map-view-container">
        {/* Left Store Cards List */}
        <div className="shop-list-sidebar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#171717' }}>📍 3 CỬA HÀNG GẦN BẠN NHẤT</span>
            <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>GPS ĐÃ ĐỊNH VỊ</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {NEARBY_ATELIERS.map((store) => {
              const isSelected = selectedStore.id === store.id;
              return (
                <div
                  key={store.id}
                  onClick={() => setSelectedStore(store)}
                  className={`shop-card ${isSelected ? 'selected' : ''}`}
                >
                  {/* Tag Header */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    {store.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          background: idx === 0 ? 'var(--color-gold-deep)' : '#F3F4F6',
                          color: idx === 0 ? '#FFF' : '#4B5563',
                          fontSize: '9px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          letterSpacing: '0.5px',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px 0', color: '#171717' }}>
                    {store.name}
                  </h3>

                  <p style={{ fontSize: '12px', color: '#666', margin: '0 0 12px 0' }}>
                    {store.address}
                  </p>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#444', marginBottom: '12px' }}>
                    <div>🚀 <strong>{store.distance}</strong> ({store.travelTime})</div>
                    <div>⭐ <strong>{store.rating}</strong></div>
                  </div>

                  {/* Stock Match Badge */}
                  <div style={{ background: 'rgba(5, 150, 105, 0.08)', border: '1px solid rgba(5, 150, 105, 0.2)', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', color: '#059669', fontWeight: 600, marginBottom: '12px' }}>
                    ✔ {store.sizeStatus}
                  </div>

                  {/* Image Reel Preview */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                    {store.images.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt="Store sample"
                        style={{ width: '100%', height: '80px', borderRadius: '8px', objectFit: 'cover' }}
                      />
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1, fontSize: '11px', padding: '8px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/catalog?shop=${store.id}`);
                      }}
                    >
                      XEM SẢN PHẨM KHU VỰC
                    </button>
                    <button
                      className="btn-primary"
                      style={{ fontSize: '11px', padding: '8px 14px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/try-on-webcam');
                      }}
                    >
                      THỬ ĐỒ WEBCAM
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Interactive Map Viewport Canvas */}
        <div className="map-canvas-wrapper">
          <img
            src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=80"
            alt="Interactive Map Preview"
            className="map-mock-bg"
          />

          {/* Map Pins Overlay */}
          <div className="map-marker-pin" style={{ top: '40%', left: '48%', background: 'var(--color-gold-deep)' }}>
            📍 Mây Fashion • 0.8 km
          </div>

          <div className="map-marker-pin" style={{ top: '25%', left: '35%' }}>
            🏪 Lumière • 1.5 km
          </div>

          <div className="map-marker-pin" style={{ top: '65%', left: '60%' }}>
            🏛️ Atelier Hoa • 2.4 km
          </div>

          <div
            style={{
              position: 'absolute',
              top: '55%',
              left: '42%',
              background: '#059669',
              color: '#FFF',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            👤 BẠN ĐANG Ở ĐÂY (124 LÊ LỢI)
          </div>

          {/* Floating Selected Store Card overlay */}
          {selectedStore && (
            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <img src={selectedStore.images[0]} alt="Store" style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover' }} />
                <div>
                  <div style={{ fontSize: '10px', color: 'var(--color-gold-deep)', fontWeight: 700 }}>ĐANG CHỌN</div>
                  <div style={{ fontSize: '14px', fontWeight: 700 }}>{selectedStore.name}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>★ {selectedStore.rating} • {selectedStore.distance}</div>
                </div>
              </div>

              <button className="btn-primary" style={{ fontSize: '11px', padding: '8px 16px' }} onClick={() => navigate('/catalog')}>
                KHÁM PHÁ KHO ĐỒ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Banner */}
      <div style={{ maxWidth: '1280px', margin: '0 48px 60px 48px', background: '#171717', color: '#FFF', borderRadius: '24px', padding: '40px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '11px', color: 'var(--color-gold)', fontWeight: 600, letterSpacing: '1px', marginBottom: '8px' }}>
            ⚡ DỊCH VỤ CỨU CÁNH SỰ KIỆN TỐI NAY
          </div>
          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '28px', margin: '0 0 8px 0' }}>
            Cần trang phục gấp trong 2 giờ cho sự kiện tối nay?
          </h2>
          <p style={{ fontSize: '13px', color: '#A3A3A3', margin: 0, maxWidth: '600px' }}>
            Đặt thuê ngay từ các cửa hàng trong bán kính 3km để nhận giao hỏa tốc Grab/Ahamove nội thành.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-primary" onClick={() => navigate('/catalog')}>
            ⚡ KHÁM PHÁ ĐỒ GIAO HỎA TỐC
          </button>
          <button className="btn-secondary" onClick={() => navigate('/try-on-photo')}>
            THỬ ĐỒ AI 30FPS TRƯỚC
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}

