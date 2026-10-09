import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../../styles/AuthLayout.css';

export default function RegisterShopPage() {
  const [formData, setFormData] = useState({
    shopName: 'Thanh Lịch Boutique',
    shopDesc: 'Chuyên cho thuê đầm dạ hội, áo dài truyền thống và vest sự kiện thanh lịch. Cam kết đồ giặt ủi sạch sẽ, chuẩn phom dáng.',
    ownerName: 'Lê Bảo Trâm',
    ownerPhone: '0908 123 456',
    shopAddress: '124 Nguyễn Trãi, Phường Bến Thành',
    city: 'TP. Hồ Chí Minh',
    district: 'Quận 1',
    agreeTerms: true,
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.agreeTerms) {
      alert('Vui lòng đồng ý với điều khoản mở gian hàng!');
      return;
    }
    setIsSubmitted(true);
  };

  return (
    <div className="auth-layout" style={{ background: '#FBF9F5' }}>
      {/* Left Dark Brand Panel */}
      <aside className="auth-brand" style={{ background: '#171717', color: '#FFF' }}>
        <a href="/" className="auth-brand__logo" style={{ textDecoration: 'none', color: '#FFF' }}>
          <span className="auth-brand__logo-name">VESTORA</span>
        </a>

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-gold)', fontWeight: 600, letterSpacing: '1.5px' }}>
            • CỔNG ĐỐI TÁC GIAN HÀNG VESTORA
          </div>

          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '36px', lineHeight: 1.2, margin: 0 }}>
            Mở gian hàng trên VESTORA — miễn phí, bắt đầu kinh doanh ngay.
          </h1>

          <p style={{ fontSize: '14px', color: '#A3A3A3', lineHeight: 1.6, margin: 0 }}>
            Tiếp cận hàng nghìn khách hàng có nhu cầu thuê trang phục sự kiện, đầm dạ hội, áo dài và vest cao cấp một cách an toàn, minh bạch.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>✓ Bảo chứng cọc tự động qua PayOS</div>
              <div style={{ fontSize: '12px', color: '#A3A3A3' }}>Khấu trừ và phong tỏa tiền cọc tức thì, đảm bảo an toàn tuyệt đối cho trang phục.</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>📅 Quản lý kho đa chi nhánh & lịch thuê tự động</div>
              <div style={{ fontSize: '12px', color: '#A3A3A3' }}>Tránh trùng lịch giao nhận, chủ động điều phối trang phục giữa các cơ sở.</div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>📢 Miễn phí khởi tạo, tiếp sức truyền thông</div>
              <div style={{ fontSize: '12px', color: '#A3A3A3' }}>Đưa bộ sưu tập của bạn tiếp cận người dùng yêu thời trang trên toàn quốc.</div>
            </div>
          </div>

          <div style={{ marginTop: '24px', fontStyle: 'italic', fontSize: '13px', color: 'var(--color-gold)', borderLeft: '2px solid var(--color-gold)', paddingLeft: '14px' }}>
            "Tỷ lệ lấp đầy lịch thuê tăng 40% trong tháng đầu vận hành trên VESTORA."<br />
            <strong style={{ fontStyle: 'normal', color: '#FFF', fontSize: '11px' }}>ATELIER MAISON — ĐỐI TÁC TIÊU BIỂU</strong>
          </div>
        </div>
      </aside>

      {/* Right Form Panel */}
      <main className="auth-form-panel">
        <div className="auth-form-container" style={{ maxWidth: '640px' }}>
          <div style={{ fontSize: '11px', color: '#666', fontWeight: 600, letterSpacing: '1px', marginBottom: '4px' }}>
            QUY TRÌNH ĐỐI TÁC • GIAI ĐOẠN 1
          </div>
          <h1 className="auth-form-title">Đăng Ký Hồ Sơ Gian Hàng</h1>
          <p className="auth-form-subtitle" style={{ marginBottom: '24px' }}>
            Hoàn tất 3 bước đơn giản để kích hoạt quyền đăng bán và cho thuê trang phục trên VESTORA.
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Section I */}
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '20px', marginBottom: '20px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '13px', fontWeight: 700 }}>
                <span>I. Thông Tin Gian Hàng</span>
                <span style={{ color: '#DC2626', fontSize: '11px' }}>BẮT BUỘC</span>
              </div>

              <div className="form-group">
                <label>TÊN GIAN HÀNG *</label>
                <input
                  type="text"
                  value={formData.shopName}
                  onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>MÔ TẢ GIỚI THIỆU *</label>
                <textarea
                  rows={3}
                  value={formData.shopDesc}
                  onChange={(e) => setFormData({ ...formData, shopDesc: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--color-border)', outline: 'none', fontFamily: 'inherit', fontSize: '13px' }}
                  required
                />
                <span style={{ fontSize: '10px', color: '#666', textAlign: 'right', display: 'block', marginTop: '4px' }}>
                  {formData.shopDesc.length} / 300 ký tự
                </span>
              </div>
            </div>

            {/* Section II */}
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '20px', marginBottom: '20px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '13px', fontWeight: 700 }}>
                <span>II. Thông Tin Chủ Shop</span>
                <span style={{ color: '#666', fontSize: '11px' }}>ĐẠI DIỆN PHÁP LÝ</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label>HỌ VÀ TÊN CHỦ SHOP *</label>
                  <input
                    type="text"
                    value={formData.ownerName}
                    onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>SỐ ĐIỆN THOẠI LIÊN HỆ *</label>
                  <input
                    type="text"
                    value={formData.ownerPhone}
                    onChange={(e) => setFormData({ ...formData, ownerPhone: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>ĐỊA CHỈ GIAN HÀNG *</label>
                <input
                  type="text"
                  value={formData.shopAddress}
                  onChange={(e) => setFormData({ ...formData, shopAddress: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Section III */}
            <div style={{ background: '#FFFFFF', padding: '24px', borderRadius: '20px', marginBottom: '20px', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '13px', fontWeight: 700 }}>
                <span>III. Giấy Tờ Xác Minh</span>
                <span style={{ color: '#059669', fontSize: '11px' }}>🔒 MÃ HÓA AES-256</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                <div style={{ background: '#F5F3EF', padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📄 Giấy đăng ký kinh doanh (ĐKKD): GPKD_ThanhLich_2024.pdf</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>✓ ĐÃ TẢI LÊN</span>
                </div>
                <div style={{ background: '#F5F3EF', padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🪪 CCCD mặt trước: CCCD_LeBaoTram_Front.jpg</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>✓ ĐÃ TẢI LÊN</span>
                </div>
                <div style={{ background: '#F5F3EF', padding: '12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>🪪 CCCD mặt sau: CCCD_LeBaoTram_Back.jpg</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>✓ ĐÃ TẢI LÊN</span>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={formData.agreeTerms}
                    onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                  />
                  <span className="checkmark" />
                  <span>Tôi xác nhận các thông tin khai báo trên là chính xác và đồng ý với Điều Khoản Dịch Vụ Shop Owner của VESTORA.</span>
                </label>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '16px' }}>
              GỬI ĐĂNG KÝ HỒ SƠ ➔
            </button>
          </form>

          {isSubmitted && (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '20px', padding: '20px', marginTop: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>✅</div>
              <h3 style={{ color: '#065F46', margin: '0 0 4px 0' }}>Đăng ký thành công!</h3>
              <p style={{ fontSize: '13px', color: '#047857', margin: 0 }}>
                Hồ sơ của bạn đang được xem xét. Thời gian duyệt: 24-48 giờ.<br />
                MÃ HỒ SƠ: <strong>#VST-94821</strong> • <span style={{ color: '#D97706', fontWeight: 700 }}>TRẠNG THÁI: ĐANG THẨM ĐỊNH</span>
              </p>
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '13px', color: '#666' }}>
            Đã có tài khoản gian hàng đối tác?{' '}
            <Link to="/shop/dashboard" style={{ color: 'var(--color-gold-deep)', fontWeight: 600, textDecoration: 'none' }}>
              Đăng nhập cổng quản trị
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

