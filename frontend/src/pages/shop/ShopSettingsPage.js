import React, { useState } from 'react';
import ShopSidebar from '../../components/ShopSidebar';
import '../../styles/ShopDashboard.css';

export default function ShopSettingsPage() {
  const [shopInfo, setShopInfo] = useState({
    name: 'VESTORA PRIVÉ ATELIER LE THANH TON',
    brand: 'VESTORA PRIVÉ',
    taxCode: '0318998877',
    phone: '028 3822 9999',
    email: 'atelier.lethanhton@vestora.vn',
    address: '72 Lê Thánh Tôn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh',
    openingHours: '09:00 - 21:00 (Thứ 2 - Chủ Nhật)',
    bankAccount: 'PayOS Escrow Merchant Account (MB Bank: 9999-VESTORA-01)'
  });

  return (
    <div className="shop-dashboard-layout">
      {/* Sidebar */}
      <ShopSidebar />

      {/* Main Area */}
      <main className="shop-main-content">
        <header className="shop-header">
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', margin: 0 }}>
              Cấu Hình Thông Tin Gian Hàng & Địa Chỉ Chi Nhánh
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>
              Cập nhật định vị GPS Showroom, thông tin thanh toán cọc PayOS Escrow & Giấy phép kinh doanh
            </p>
          </div>
          <button 
            className="btn-vestora btn-vestora-primary"
            onClick={() => alert('Đã cập nhật thông tin gian hàng thành công!')}
          >
            💾 Lưu Thay Đổi
          </button>
        </header>

        {/* Form Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
          <div className="dashboard-card">
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', marginBottom: '16px', color: '#171717' }}>
              Thông Tin Thương Hiệu & Pháp Lý
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '4px' }}>Tên Showroom Hiển Thị</label>
                <input 
                  type="text" 
                  value={shopInfo.name}
                  onChange={(e) => setShopInfo({ ...shopInfo, name: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '4px' }}>Mã Số Thuế Doanh Nghiệp</label>
                <input 
                  type="text" 
                  value={shopInfo.taxCode}
                  onChange={(e) => setShopInfo({ ...shopInfo, taxCode: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '4px' }}>Số Điện Thoại Hotline Chi Nhánh</label>
                <input 
                  type="text" 
                  value={shopInfo.phone}
                  onChange={(e) => setShopInfo({ ...shopInfo, phone: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '4px' }}>Email Liên Hệ Đối Tác</label>
                <input 
                  type="email" 
                  value={shopInfo.email}
                  onChange={(e) => setShopInfo({ ...shopInfo, email: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>
            </div>
          </div>

          <div className="dashboard-card">
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', marginBottom: '16px', color: '#171717' }}>
              Địa Chỉ Định Vị GPS Radar & Giờ Mở Cửa
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '4px' }}>Địa Chỉ Chi Tiết (Tọa Độ Radar Maps)</label>
                <textarea 
                  rows="3"
                  value={shopInfo.address}
                  onChange={(e) => setShopInfo({ ...shopInfo, address: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontFamily: 'inherit' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '4px' }}>Giờ Phục Vụ Thử Đồ Tại Showroom</label>
                <input 
                  type="text" 
                  value={shopInfo.openingHours}
                  onChange={(e) => setShopInfo({ ...shopInfo, openingHours: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#4b5563', marginBottom: '4px' }}>Tài Khoản Thụ Hưởng Doanh Thu PayOS Escrow</label>
                <input 
                  type="text" 
                  value={shopInfo.bankAccount}
                  readOnly
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#059669', fontWeight: '600' }}
                />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

