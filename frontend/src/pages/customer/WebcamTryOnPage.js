import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/WebcamTryOn.css';

export default function WebcamTryOnPage() {
  const [selectedColor, setSelectedColor] = useState('#171717');
  const [selectedSize, setSelectedSize] = useState('M');
  const [isRecording, setIsRecording] = useState(false);
  const [arLighting, setArLighting] = useState(true);
  const [cameraResolution, setCameraResolution] = useState('1080p 60fps');

  const handleRecord = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      alert('Đã lưu clip video thử đồ 5 giây vào bộ sưu tập!');
    }, 5000);
  };

  return (
    <div className="webcam-page-container">
      {/* Top Header */}
      <div className="webcam-header">
        <div className="webcam-title-group">
          <h1>
            VESTORA Live AR Try-On Studio
            <span className="webcam-live-indicator">
              <span className="webcam-live-dot"></span>
              LIVE 30FPS
            </span>
          </h1>
          <p className="webcam-subtitle">
            Trải nghiệm ướm thử trang phục Haute Couture thời gian thực qua Webcam AI Pose Estimation
          </p>
        </div>

        <div className="webcam-specs-bar">
          <div className="spec-badge gold">
            <span>⚡ Đồ Họa Render: 30 FPS</span>
          </div>
          <div className="spec-badge">
            <span>⏱️ Độ Trễ AR: 14ms</span>
          </div>
          <div className="spec-badge">
            <span>🎯 3D Body Mesh: ACTIVE</span>
          </div>
          <Link to="/try-on-photo" className="btn-ar-action">
            🖼️ Chuyển Thử Bằng Ảnh
          </Link>
        </div>
      </div>

      {/* Main Grid */}
      <div className="webcam-layout">
        {/* Main AR Viewport */}
        <div className="webcam-viewport-card">
          <div className="webcam-canvas-area">
            <img 
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80" 
              alt="Live AR Stream" 
              className="webcam-feed-mock"
            />
            
            {/* AR Overlay Grid & Keypoints */}
            <div className="ar-overlay-layer">
              <div className="ar-mesh-grid"></div>

              {/* Landmark overlay dots */}
              <div className="ar-keypoint" style={{ top: '35%', left: '42%' }}></div>
              <div className="ar-keypoint" style={{ top: '35%', left: '58%' }}></div>
              <div className="ar-keypoint" style={{ top: '52%', left: '40%' }}></div>
              <div className="ar-keypoint" style={{ top: '52%', left: '60%' }}></div>
              <div className="ar-keypoint" style={{ top: '65%', left: '44%' }}></div>
              <div className="ar-keypoint" style={{ top: '65%', left: '56%' }}></div>
              <div className="ar-keypoint" style={{ top: '80%', left: '45%' }}></div>
              <div className="ar-keypoint" style={{ top: '80%', left: '55%' }}></div>

              {/* Status Tags */}
              <div className="ar-status-tag">
                <span>📹 Cam: Integrated HD Camera ({cameraResolution})</span>
              </div>

              <div className="ar-fit-badge">
                <span>✨ 98% Độ Tương Thích Vóc Dáng (Fit Index: S)</span>
              </div>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="webcam-controls-bar">
            <div className="webcam-actions-group">
              <button 
                className="btn-ar-action"
                onClick={() => setCameraResolution(cameraResolution === '1080p 60fps' ? '720p 30fps' : '1080p 60fps')}
              >
                ⚙️ {cameraResolution}
              </button>
              <button 
                className="btn-ar-action"
                onClick={() => setArLighting(!arLighting)}
              >
                💡 Ánh Sáng Studio: {arLighting ? 'BẬT' : 'TẮT'}
              </button>
              <button 
                className="btn-ar-action"
                onClick={() => alert('Đã hiệu chỉnh lại hệ tọa độ cơ thể 3D!')}
              >
                🔄 Calibrate Lại Pose
              </button>
            </div>

            <div className="webcam-actions-group">
              <button className="btn-ar-action" onClick={() => alert('Đã chụp ảnh khoảnh khắc và lưu vào bộ sưu tập!')}>
                📸 Chụp Ảnh
              </button>
              <button 
                className="btn-ar-action" 
                onClick={handleRecord}
                style={{ borderColor: isRecording ? '#dc2626' : '', color: isRecording ? '#f87171' : '' }}
              >
                {isRecording ? '⏺️ Đang Quay (5s)...' : '🎥 Quay 5s Video'}
              </button>
              <Link to="/cart" className="btn-ar-primary">
                🛍️ Thêm Vào Giỏ Thuê
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar Panel */}
        <div className="webcam-sidebar">
          <div className="sidebar-card">
            <h2 className="sidebar-card-title">Trang Phục Đang Thử</h2>

            <div className="garment-preview-item">
              <img 
                src="https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=400&q=80" 
                alt="Selected Tailored Garment" 
                className="garment-thumb"
              />
              <div className="garment-info">
                <div className="garment-brand">VESTORA ATELIER</div>
                <h3>Áo Vest Dạ Hội Bespoke Tailored</h3>
                <div className="garment-price">850.000 đ / 3 ngày</div>
                <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '4px' }}>
                  Cọc Escrow PayOS: 1.500.000 đ
                </div>
              </div>
            </div>

            <div className="ar-option-group">
              <label className="ar-option-label">MÀU SẮC THỂ HIỆN TRÊN MÔ HÌNH 3D</label>
              <div className="color-dots">
                <button 
                  className={`color-dot-btn ${selectedColor === '#171717' ? 'active' : ''}`}
                  style={{ background: '#171717' }}
                  onClick={() => setSelectedColor('#171717')}
                />
                <button 
                  className={`color-dot-btn ${selectedColor === '#d4af37' ? 'active' : ''}`}
                  style={{ background: '#d4af37' }}
                  onClick={() => setSelectedColor('#d4af37')}
                />
                <button 
                  className={`color-dot-btn ${selectedColor === '#725b38' ? 'active' : ''}`}
                  style={{ background: '#725b38' }}
                  onClick={() => setSelectedColor('#725b38')}
                />
                <button 
                  className={`color-dot-btn ${selectedColor === '#ffffff' ? 'active' : ''}`}
                  style={{ background: '#ffffff' }}
                  onClick={() => setSelectedColor('#ffffff')}
                />
              </div>
            </div>

            <div className="ar-option-group">
              <label className="ar-option-label">KÍCH THƯỚC CHỌN VỐC DÁNG</label>
              <div className="size-pills">
                {['S', 'M', 'L', 'XL'].map((size) => (
                  <button 
                    key={size}
                    className={`size-pill-btn ${selectedSize === size ? 'active' : ''}`}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AI Fit Analysis Card */}
          <div className="sidebar-card">
            <h2 className="sidebar-card-title">Chỉ Số Khớp Dáng AI</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                  <span>Vòng Vai:</span>
                  <span style={{ color: '#34d399', fontWeight: '600' }}>Khớp 99%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '99%', height: '100%', background: '#34d399' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                  <span>Chiều Dài Áo:</span>
                  <span style={{ color: '#d4af37', fontWeight: '600' }}>Vừa Chuẩn</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '95%', height: '100%', background: '#d4af37' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                  <span>Vòng Ngực / Eo:</span>
                  <span style={{ color: '#34d399', fontWeight: '600' }}>Khớp 97%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '97%', height: '100%', background: '#34d399' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

