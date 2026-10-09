import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../../styles/PhotoTryOn.css';

export default function PhotoTryOnPage() {
  const navigate = useNavigate();
  const [modelImage] = useState(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80'
  );
  const [selectedSize, setSelectedSize] = useState('S');
  const [selectedColor, setSelectedColor] = useState('#0B1C3E');
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);

  const colors = [
    { name: 'Midnight Navy', hex: '#0B1C3E' },
    { name: 'Crimson Red', hex: '#8B0000' },
    { name: 'Gold Champagne', hex: '#D4AF37' },
    { name: 'Onyx Black', hex: '#171717' },
  ];

  return (
    <div className="tryon-room-container">
      {/* Top Header Bar */}
      <header className="tryon-header-bar">
        <Link
          to="/"
          style={{ color: '#A3A3A3', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          ← RỜI PHÒNG THỬ AI (1)
        </Link>
        <Link to="/" style={{ fontFamily: 'var(--font-title)', fontSize: '24px', letterSpacing: '4px', color: '#FFF', textDecoration: 'none', fontWeight: 700 }}>
          VESTORA
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#34C759' }}>
          <span>🔒 BẢO MẬT SINH TRẮC ÁO</span>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer', fontSize: '18px' }}
          >
            ✕
          </button>
        </div>
      </header>

      {/* Top Status Bar */}
      <div className="tryon-top-status">
        <button
          onClick={() => navigate('/product/VESTORA-DR-089')}
          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#FFF', padding: '6px 14px', borderRadius: '99px', fontSize: '11px', cursor: 'pointer' }}
        >
          ← QUAY LẠI SẢN PHẨM
        </button>

        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-gold)', letterSpacing: '1px' }}>
          PHÒNG THỬ ĐỒ ẢO AI — CÔNG NGHỆ SINH TRẮC HỌC 3D
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ background: 'rgba(52, 199, 89, 0.15)', color: '#34C759', padding: '4px 10px', borderRadius: '99px', fontWeight: 600 }}>
            ● ĐỘ CHUẨN XÁC 99.4%
          </span>
          <span style={{ color: '#A3A3A3', cursor: 'pointer' }}>? HƯỚNG DẪN TẢI ẢNH</span>
        </div>
      </div>

      {/* Main Grid: 3 Panels */}
      <div className="tryon-grid-main">
        {/* LEFT PANEL: Step 1 Upload Model */}
        <div className="panel-dark-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: 'var(--color-gold)' }}>
              BƯỚC 1
            </span>
            <span style={{ fontSize: '10px', background: 'rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px' }}>
              Cá nhân hoá AI
            </span>
          </div>

          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', margin: 0 }}>
            1. Ảnh Người Mẫu / Cá Nhân
          </h2>

          <div className="dropzone-box" onClick={() => alert('Chọn ảnh toàn thân từ máy tính...')}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>☁️</div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
              Kéo và thả ảnh toàn thân vào đây
            </div>
            <div style={{ fontSize: '11px', color: '#A3A3A3', marginBottom: '12px' }}>
              Hỗ trợ JPG, PNG chất lượng cao tối đa 25MB
            </div>
            <button className="btn-secondary" style={{ fontSize: '11px', padding: '6px 16px' }}>
              TẢI ẢNH TOÀN THÂN
            </button>
          </div>

          {/* Active model card */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '14px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <img src={modelImage} alt="Model" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>Lê Hoàng Linh Nga</div>
              <div style={{ fontSize: '10px', color: '#A3A3A3' }}>Dáng người: Đồng hồ cát (1m68 • 51kg)</div>
            </div>
            <button style={{ background: 'none', border: 'none', color: '#FFF', cursor: 'pointer' }}>🔄</button>
          </div>

          {/* Quy chuẩn */}
          <div style={{ fontSize: '11px', color: '#A3A3A3', lineHeight: 1.6 }}>
            <strong style={{ color: '#FFF', display: 'block', marginBottom: '4px' }}>🛡️ Quy chuẩn ảnh chuẩn xác:</strong>
            • Đứng thẳng người tự nhiên, hai tay thả lòng nhẹ bên hông.<br />
            • Nền trơn, sáng màu, không có vật cản phía sau.<br />
            • Ánh sáng tự nhiên đồng đều.
          </div>

          {/* Standard Mannequin presets */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', marginBottom: '8px', color: '#A3A3A3' }}>
              HOẶC CHỌN NHANH MANNEQUIN TIÊU CHUẨN
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {['Size S', 'Size M', 'Size L'].map((size) => (
                <button
                  key={size}
                  className="btn-secondary"
                  style={{ fontSize: '11px', padding: '8px' }}
                  onClick={() => alert(`Đã tải mannequin chuẩn ${size}`)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER PANEL: Real-time 3D AR Stage */}
        <div className="stage-viewport-card">
          <img
            src="https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80"
            alt="3D AR Virtual Try-On Stage"
            className="stage-bg-image"
          />

          {/* AR Keypoint dots */}
          <div className="ar-keypoint-dot" style={{ top: '32%', left: '48%' }} title="Bờ vai" />
          <div className="ar-keypoint-dot" style={{ top: '48%', left: '50%' }} title="Vòng eo" />
          <div className="ar-keypoint-dot" style={{ top: '65%', left: '51%' }} title="Vòng hông" />

          {/* Bottom Measurements bar overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '16px',
              right: '16px',
              background: 'rgba(26, 27, 30, 0.9)',
              backdropFilter: 'blur(10px)',
              borderRadius: '9999px',
              padding: '10px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
            }}
          >
            <div>
              <span>📏 Vòng ngực: <strong>84cm</strong></span> •{' '}
              <span>Eo: <strong>64cm</strong></span> •{' '}
              <span>Hông: <strong>92cm</strong></span>
            </div>
            <button
              className="btn-secondary"
              style={{ fontSize: '11px', padding: '4px 12px' }}
              onClick={() => setShowBeforeAfter(!showBeforeAfter)}
            >
              🔄 SO SÁNH TRƯỚC / SAU
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Step 2 Item Selection & Adjustments */}
        <div className="panel-dark-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '1px', color: 'var(--color-gold)' }}>
              BƯỚC 2
            </span>
            <span style={{ fontSize: '10px', background: '#ECFDF5', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
              ✓ VAULT VERIFIED
            </span>
          </div>

          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', margin: 0 }}>
            2. Trang Phục Đang Thử
          </h2>

          {/* Item Card */}
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '16px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '12px' }}>
            <img src="https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=200&q=80" alt="Dress" style={{ width: '60px', height: '80px', borderRadius: '10px', objectFit: 'cover' }} />
            <div>
              <div style={{ fontSize: '10px', color: 'var(--color-gold)', fontWeight: 600 }}>Thanh Lịch Boutique ✓</div>
              <div style={{ fontSize: '13px', fontWeight: 600, margin: '2px 0 4px 0' }}>Đầm Dạ Hội Lụa Satin Midnight...</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#FFF' }}>350.000 đ <small style={{ fontWeight: 400, fontSize: '10px', color: '#A3A3A3' }}>/ ngày</small></div>
            </div>
          </div>

          {/* Size picker */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '8px' }}>
              <span>CHỌN KÍCH CỠ CHUẨN</span>
              <span style={{ color: '#34C759', fontWeight: 600 }}>✓ Độ vừa vặn: Hoàn hảo (98%)</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
              {['XS', 'S', 'M', 'L', 'XL'].map((s) => (
                <button
                  key={s}
                  className={`size-btn ${selectedSize === s ? 'active' : ''}`}
                  style={{ height: '36px', fontSize: '11px', background: selectedSize === s ? 'var(--color-gold)' : 'rgba(255,255,255,0.05)', color: selectedSize === s ? '#000' : '#FFF', border: 'none' }}
                  onClick={() => setSelectedSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', marginBottom: '8px' }}>
              MÀU SẮC DẠ TIỆC: <span style={{ color: 'var(--color-gold)' }}>Midnight Navy</span>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              {colors.map((c) => (
                <div
                  key={c.name}
                  className={`color-swatch-circle ${selectedColor === c.hex ? 'active' : ''}`}
                  style={{ background: c.hex }}
                  onClick={() => setSelectedColor(c.hex)}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* Accessories Suggestion */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', marginBottom: '8px' }}>
              PHỤ KIỆN GỢI Ý ĐI KÈM
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', padding: '8px', borderRadius: '10px', fontSize: '10px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                👜 Túi Mini Kelly (+120k/ngày)
              </div>
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', padding: '8px', borderRadius: '10px', fontSize: '10px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                👠 Giày Gót Nhọn (+90k/ngày)
              </div>
            </div>
          </div>

          {/* Security note */}
          <div style={{ fontSize: '10px', color: '#A3A3A3', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
            🔒 Bảo mật sinh trắc học cá nhân theo chuẩn mã hoá 256-bit atelier.
          </div>
        </div>
      </div>

      {/* Bottom Fixed Action Bar */}
      <footer className="bottom-action-bar">
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '11px', color: '#A3A3A3' }}>Thời gian thuê: </span>
            <strong style={{ fontSize: '14px', color: '#FFF' }}>3 Ngày</strong>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '24px' }}>
            <span style={{ fontSize: '11px', color: '#34C759' }}>Tổng cọc & thuê: </span>
            <strong style={{ fontSize: '18px', color: 'var(--color-gold)' }}>1.750.000 đ</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={() => alert('Đã lưu outfit vào Tủ Đồ Ảo!')}>
            🔖 LƯU VÀO TỦ ĐỒ
          </button>
          <button
            className="btn-primary"
            style={{ padding: '12px 28px' }}
            onClick={() => {
              alert('Đã thêm sản phẩm đã thử vào giỏ hàng!');
              navigate('/cart');
            }}
          >
            🛒 THÊM VÀO GIỎ & ĐẶT THUÊ
          </button>
        </div>
      </footer>
    </div>
  );
}

