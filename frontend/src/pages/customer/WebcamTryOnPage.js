import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  Clock,
  Target,
  Image,
  Video,
  Sparkles,
  Settings,
  Sun,
  RefreshCw,
  Camera,
  Circle,
  ShoppingBag,
  CheckCircle2,
} from 'lucide-react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import '../../styles/WebcamTryOn.css';

export default function WebcamTryOnPage() {
  const [selectedColor, setSelectedColor] = useState('#171717');
  const [selectedSize, setSelectedSize] = useState('M');
  const [isRecording, setIsRecording] = useState(false);
  const [arLighting, setArLighting] = useState(true);
  const [cameraResolution, setCameraResolution] = useState('1080p 60fps');
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleRecord = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      showToast('Đã lưu clip video thử đồ 5 giây vào bộ sưu tập cá nhân.');
    }, 5000);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#0F0F11' }}>
      <Navbar />

      {/* Floating Toast Notification */}
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            top: 80,
            right: 24,
            zIndex: 99999,
            background: '#171717',
            color: '#F8F7F4',
            border: '1px solid #C5A880',
            borderRadius: 10,
            padding: '12px 20px',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          }}
        >
          <CheckCircle2 size={16} color="#C5A880" />
          <span>{toastMsg}</span>
        </div>
      )}

      <div className="webcam-page-container" style={{ flex: 1 }}>
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
            <div className="spec-badge gold" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Zap size={14} color="#C5A880" />
              <span>Đồ Họa Render: 30 FPS</span>
            </div>
            <div className="spec-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Clock size={14} />
              <span>Độ Trễ AR: 14ms</span>
            </div>
            <div className="spec-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Target size={14} />
              <span>3D Body Mesh: ACTIVE</span>
            </div>
            <Link to="/try-on-photo" className="btn-ar-action" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Image size={14} />
              <span>Chuyển Thử Bằng Ảnh</span>
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
                <div className="ar-status-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Video size={13} />
                  <span>Cam: Integrated HD Camera ({cameraResolution})</span>
                </div>

                <div className="ar-fit-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={13} color="#C5A880" />
                  <span>98% Độ Tương Thích Vóc Dáng (Fit Index: S)</span>
                </div>
              </div>
            </div>

            {/* Controls Bar */}
            <div className="webcam-controls-bar">
              <div className="webcam-actions-group">
                <button
                  type="button"
                  className="btn-ar-action"
                  onClick={() => setCameraResolution(cameraResolution === '1080p 60fps' ? '720p 30fps' : '1080p 60fps')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Settings size={14} />
                  <span>{cameraResolution}</span>
                </button>
                <button
                  type="button"
                  className="btn-ar-action"
                  onClick={() => {
                    setArLighting(!arLighting);
                    showToast(arLighting ? 'Đã tắt ánh sáng studio AR' : 'Đã bật ánh sáng studio AR');
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Sun size={14} />
                  <span>Ánh Sáng Studio: {arLighting ? 'BẬT' : 'TẮT'}</span>
                </button>
                <button
                  type="button"
                  className="btn-ar-action"
                  onClick={() => showToast('Đã hiệu chỉnh lại hệ tọa độ cơ thể 3D thành công!')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <RefreshCw size={14} />
                  <span>Calibrate Lại Pose</span>
                </button>
              </div>

              <div className="webcam-actions-group">
                <button
                  type="button"
                  className="btn-ar-action"
                  onClick={() => showToast('Đã chụp ảnh khoảnh khắc và lưu vào bộ sưu tập!')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Camera size={14} />
                  <span>Chụp Ảnh</span>
                </button>
                <button
                  type="button"
                  className="btn-ar-action"
                  onClick={handleRecord}
                  style={{
                    borderColor: isRecording ? '#dc2626' : '',
                    color: isRecording ? '#f87171' : '',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Circle size={14} style={{ fill: isRecording ? '#dc2626' : 'none' }} />
                  <span>{isRecording ? 'Đang Quay (5s)...' : 'Quay 5s Video'}</span>
                </button>
                <Link
                  to="/cart"
                  className="btn-ar-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <ShoppingBag size={14} />
                  <span>Thêm Vào Giỏ Thuê</span>
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
                    Tiền đặt cọc: 1.500.000 đ
                  </div>
                </div>
              </div>

              <div className="ar-option-group">
                <label className="ar-option-label">MÀU SẮC THỂ HIỆN TRÊN MÔ HÌNH 3D</label>
                <div className="color-dots">
                  {['#171717', '#d4af37', '#725b38', '#ffffff'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-dot-btn ${selectedColor === color ? 'active' : ''}`}
                      style={{ background: color }}
                      onClick={() => setSelectedColor(color)}
                      aria-label={`Chọn màu ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div className="ar-option-group">
                <label className="ar-option-label">KÍCH THƯỚC CHỌN VỐC DÁNG</label>
                <div className="size-pills">
                  {['S', 'M', 'L', 'XL'].map((size) => (
                    <button
                      key={size}
                      type="button"
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

      <Footer />
    </div>
  );
}
