import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import '../../styles/UserProfile.css';

export default function UserProfilePage() {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [userInfo, setUserInfo] = useState({
    fullName: 'Nguyễn Minh Anh',
    email: 'minhanh@email.com',
    phone: '0912 345 678',
    address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
  });

  const handleSave = (e) => {
    e.preventDefault();
    setIsEditing(false);
    alert('Cập nhật thông tin hồ sơ cá nhân thành công!');
  };

  return (
    <div className="profile-page-container">
      <Navbar />

      {/* Header Banner */}
      <div className="profile-header-hero">
        <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '1px', color: '#666', marginBottom: '8px' }}>
          TRANG CHỦ &gt; TÀI KHOẢN &gt; THÔNG TIN CÁ NHÂN
        </div>
        <div style={{ fontSize: '10px', color: 'var(--color-gold-deep)', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '4px' }}>
          🏛️ HỒ SƠ DANH GIÁ
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '40px', margin: '0 0 6px 0' }}>
              Thông Tin Cá Nhân
            </h1>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
              Quản lý danh tính hồ sơ, chuẩn mực đo lường trang phục và đặc quyền bảo chứng lưu trữ VESTORA Privé.
            </p>
          </div>

          <button
            className="btn-primary"
            style={{ fontSize: '12px' }}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? '✕ HỦY CHỈNH SỬA' : '✎ CHỈNH SỬA THÔNG TIN'}
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="profile-main-grid">
        {/* Left Sidebar User Card */}
        <aside className="user-sidebar-card">
          <div className="user-avatar-wrapper">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
              alt="Avatar"
              className="user-avatar-img"
            />
            <button className="camera-edit-btn" title="Đổi ảnh đại diện">📷</button>
          </div>

          <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '22px', margin: '0 0 4px 0' }}>
            {userInfo.fullName}
          </h2>
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
            Hội viên VIP Privé <strong>#VST-8899</strong>
          </div>
          <span style={{ background: '#ECFDF5', color: '#059669', fontSize: '10px', fontWeight: 700, padding: '4px 12px', borderRadius: '9999px' }}>
            🛡️ KHÁCH HÀNG TINH HOA
          </span>

          <div className="profile-nav-menu">
            <button className="profile-nav-btn active">
              <span>👤 Thông Tin Cá Nhân</span>
              <span>›</span>
            </button>
            <button className="profile-nav-btn" onClick={() => alert('Chuyển hướng Đổi Mật Khẩu')}>
              <span>🔒 Đổi Mật Khẩu & Bảo Mật</span>
              <span>›</span>
            </button>
            <button className="profile-nav-btn" onClick={() => navigate('/cart')}>
              <span>🛍️ Đơn Thuê Của Tôi</span>
              <span style={{ background: '#F3F4F6', padding: '2px 8px', borderRadius: '9999px', fontSize: '10px' }}>3</span>
            </button>
            <button className="profile-nav-btn" onClick={() => navigate('/favorites')}>
              <span>♡ Sản Phẩm Yêu Thích</span>
              <span style={{ background: '#F3F4F6', padding: '2px 8px', borderRadius: '9999px', fontSize: '10px' }}>12</span>
            </button>
            <button className="profile-nav-btn" onClick={() => navigate('/try-on-photo')}>
              <span>👗 Tủ Đồ Lưu Trữ AI</span>
              <span>›</span>
            </button>
            <button className="profile-nav-btn" onClick={() => alert('Cơ chế ký quỹ Escrow PayOS chuẩn A+')}>
              <span>🛡️ Bảo Chứng Ký Quỹ</span>
              <span>›</span>
            </button>
            <button
              className="profile-nav-btn"
              style={{ color: '#DC2626', marginTop: '16px', borderTop: '1px solid #F3F4F6', paddingTop: '12px' }}
              onClick={() => navigate('/login')}
            >
              <span>🚪 Đăng Xuất Tài Khoản</span>
            </button>
          </div>
        </aside>

        {/* Right Details Panel */}
        <div className="profile-details-panel">
          <div className="info-card-white">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #F3F4F6', paddingBottom: '16px' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', margin: 0 }}>Hồ Sơ Thành Viên</h3>
                <div style={{ fontSize: '12px', color: '#666' }}>Thông tin chính thức được lưu trữ bảo mật dưới giao thức mã hóa dữ liệu cao cấp</div>
              </div>
              <span style={{ background: '#ECFDF5', color: '#059669', fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '9999px' }}>
                🛡️ ĐÃ XÁC THỰC ESCROW 100%
              </span>
            </div>

            {!isEditing ? (
              <div>
                <div className="profile-table-row">
                  <span style={{ color: '#666' }}>Họ và tên</span>
                  <strong>{userInfo.fullName}</strong>
                  <span style={{ fontSize: '10px', color: '#9CA3AF', textAlign: 'right' }}>ĐỊNH DANH CHÍNH CHỦ</span>
                </div>

                <div className="profile-table-row">
                  <span style={{ color: '#666' }}>Địa chỉ Email</span>
                  <div>
                    <strong>{userInfo.email}</strong>{' '}
                    <span style={{ background: '#ECFDF5', color: '#059669', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>✓ Đã xác thực</span>
                  </div>
                  <span />
                </div>

                <div className="profile-table-row">
                  <span style={{ color: '#666' }}>Số điện thoại liên lạc</span>
                  <strong>{userInfo.phone}</strong>
                  <span style={{ fontSize: '10px', color: '#9CA3AF', textAlign: 'right' }}>🔒 ĐƯỜNG DÂY MÃ HÓA</span>
                </div>

                <div className="profile-table-row">
                  <span style={{ color: '#666' }}>Địa chỉ nhận trang phục mặc định</span>
                  <div>
                    <strong>{userInfo.address}</strong>
                    <span style={{ fontSize: '10px', background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>MẶC ĐỊNH</span>
                  </div>
                  <span />
                </div>

                <div className="profile-table-row">
                  <span style={{ color: '#666' }}>Phân hạng tài khoản</span>
                  <span style={{ background: '#FEF3C7', color: '#78350F', fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '9999px', display: 'inline-block' }}>
                    💎 Khách Hàng Thượng Lưu (Privé Member)
                  </span>
                  <span />
                </div>

                <div className="profile-table-row">
                  <span style={{ color: '#666' }}>Thời gian đồng hành</span>
                  <strong>15/03/2025</strong>
                  <span style={{ fontSize: '11px', color: '#666', textAlign: 'right' }}>Hội viên năm thứ nhất</span>
                </div>

                <div className="profile-table-row">
                  <span style={{ color: '#666' }}>Điểm tích lũy VESTORA</span>
                  <div>
                    <strong style={{ fontSize: '18px', color: 'var(--color-gold-deep)' }}>2.450 điểm</strong>{' '}
                    <span style={{ background: '#FEF3C7', color: '#B45309', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px' }}>Hạng Hoàng Kim</span>
                  </div>
                  <button className="btn-secondary" style={{ fontSize: '10px', padding: '4px 10px', textAlign: 'right' }}>ĐỔI ĐẶC QUYỀN</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="auth-form">
                <div className="form-group">
                  <label>HỌ VÀ TÊN</label>
                  <input
                    type="text"
                    value={userInfo.fullName}
                    onChange={(e) => setUserInfo({ ...userInfo, fullName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>ĐỊA CHỈ EMAIL</label>
                  <input
                    type="email"
                    value={userInfo.email}
                    onChange={(e) => setUserInfo({ ...userInfo, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>SỐ ĐIỆN THOẠI</label>
                  <input
                    type="text"
                    value={userInfo.phone}
                    onChange={(e) => setUserInfo({ ...userInfo, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>ĐỊA CHỈ NHẬN TRANG PHỤC MẶC ĐỊNH</label>
                  <input
                    type="text"
                    value={userInfo.address}
                    onChange={(e) => setUserInfo({ ...userInfo, address: e.target.value })}
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '12px' }}>
                  LƯU THAY ĐỔI HỒ SƠ
                </button>
              </form>
            )}

            {/* Stylist Concierge info banner */}
            <div style={{ background: '#F5F3EF', borderRadius: '16px', padding: '16px 20px', marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>ℹ️</span>
                <span>Để thay đổi số đo cơ thể chuyên sâu cho trang phục may đo Haute Couture, vui lòng liên hệ trực tiếp Stylist Concierge.</span>
              </div>
              <button className="btn-primary" style={{ fontSize: '11px', padding: '6px 14px' }} onClick={() => alert('Liên hệ Stylist Privé Concierge: 1800 8899')}>
                HẸN STYLIST 📞
              </button>
            </div>
          </div>

          {/* Activity Summary & Credit Rating */}
          <div className="info-card-white">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', margin: 0 }}>Tóm Tắt Hoạt Động & Độ Tin Cậy</h3>
              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>● TÍN NHIỆM TUYỆT ĐỐI 100/100</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div style={{ background: '#F5F3EF', borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Đơn đang thuê</div>
                  <div style={{ fontSize: '24px', fontWeight: 700 }}>03</div>
                  <div style={{ fontSize: '10px', color: '#9CA3AF' }}>2 DẠ TIỆC • 1 THẢM ĐỎ</div>
                </div>
                <span style={{ fontSize: '24px' }}>🛍️</span>
              </div>

              <div style={{ background: '#F5F3EF', borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Món trong tủ đồ</div>
                  <div style={{ fontSize: '24px', fontWeight: 700 }}>12</div>
                  <div style={{ fontSize: '10px', color: '#9CA3AF' }}>KIỆT TÁC LƯU TRỮ CÁ NHÂN</div>
                </div>
                <span style={{ fontSize: '24px' }}>👗</span>
              </div>

              <div style={{ background: '#F5F3EF', borderRadius: '16px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#666' }}>Sự cố giao dịch</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#059669' }}>00</div>
                  <div style={{ fontSize: '10px', color: '#9CA3AF' }}>CHUẨN MỰC HOÀN HẢO</div>
                </div>
                <span style={{ fontSize: '24px' }}>🛡️</span>
              </div>
            </div>

            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: '#666' }}>Chỉ số tin cậy ký quỹ bảo vệ hiện vật (Escrow Security Rating):</span>
              <strong style={{ color: '#059669' }}>Cấp A+ (Ưu tiên bàn giao không cọc phụ)</strong>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

