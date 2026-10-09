import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShopSidebar from '../../components/ShopSidebar';
import '../../styles/ShopDashboard.css';

export default function ShopDashboardPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('TẤT CẢ (08)');

  const orders = [
    {
      id: '#THUE-8892',
      product: 'Đầm Dạ Hội Satin Midnight',
      detail: 'Size S • Kèm túi voan',
      image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=120&q=80',
      customer: 'Nguyễn Lan Hương (0908***412 - VIP 2)',
      duration: '3 ngày (24/10 - 27/10)',
      amount: '700.000 đ',
      escrow: 'Cọc PayOS Escrow',
      status: 'CHỜ XÁC NHẬN',
      statusType: 'pending',
      action: 'DUYỆT ĐƠN',
    },
    {
      id: '#THUE-8889',
      product: 'Áo Khoác Tweed Thủ Công',
      detail: 'Size M • Kèm bé ngọc trai',
      image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=120&q=80',
      customer: 'Trần Mai Chi (0971***890)',
      duration: '2 ngày (25/10 - 27/10)',
      amount: '500.000 đ',
      escrow: 'Cọc PayOS Escrow',
      status: 'ĐANG ĐÓNG GÓI',
      statusType: 'shipping',
      action: 'IN PHIẾU GỬI',
    },
    {
      id: '#THUE-8879',
      product: 'Đầm Dạ Hội Satin Midnight',
      detail: 'Khách hoàn trả • Vết ố nhẹ',
      image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=120&q=80',
      customer: 'Đặng Hoàng Yến (0934***221)',
      duration: 'Đã nhận hoàn trả (Chờ đối soát)',
      amount: '700.000 đ',
      escrow: 'Đang giữ tiền cọc',
      status: 'CHỜ KIỂM ĐỊNH CỌC',
      statusType: 'return',
      action: 'XỬ LÝ CỌC',
    },
    {
      id: '#MUA-1045',
      product: 'Bộ Suit Tuxedo Slim Fit',
      detail: 'Thanh Lý Like New 98%',
      image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80',
      customer: 'Phạm Thu Trang (0912***556)',
      duration: 'Đơn Mua Sở Hữu (Đã nhận thanh toán)',
      amount: '4.200.000 đ',
      escrow: 'Đã nhận thanh toán',
      status: 'CHỜ GIAO SHIPPER',
      statusType: 'completed',
      action: 'GIAO SHIPPER',
    },
  ];

  return (
    <div className="shop-dashboard-layout">
      {/* Reusable Shop Sidebar */}
      <ShopSidebar />

      {/* Main Content Area */}
      <div className="shop-main-area">
        {/* Top Bar */}
        <header className="shop-top-navbar">
          <div style={{ fontSize: '12px', color: '#6B7280' }}>
            Trang Chủ Shop &gt; <strong>Tổng Quan</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ fontSize: '11px', background: '#ECFDF5', color: '#059669', padding: '4px 12px', borderRadius: '9999px', fontWeight: 600 }}>
              ● ĐANG HOẠT ĐỘNG
            </span>
            <span style={{ fontSize: '18px', cursor: 'pointer' }}>🔔</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80"
                alt="Avatar"
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Lê Bảo Trâm</div>
                <div style={{ fontSize: '10px', color: '#6B7280' }}>Chủ Gian Hàng</div>
              </div>
            </div>
          </div>
        </header>

        {/* Scroll Content */}
        <div className="shop-content-scroll">
          {/* Header Title & Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '32px', margin: '0 0 4px 0' }}>
                Tổng Quan Gian Hàng
              </h1>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                Hiệu suất kinh doanh, tình trạng đơn thuê & mua, cảnh báo vận hành thời gian thực.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" onClick={() => navigate('/shop/products/new')}>
                ➕ THÊM SẢN PHẨM MỚI
              </button>
              <button className="btn-secondary" onClick={() => navigate('/shop/analytics')}>
                📈 BÁO CÁO DOANH THU
              </button>
            </div>
          </div>

          {/* 4 Stat Cards */}
          <div className="stats-grid-4">
            <div className="stat-card-white" style={{ cursor: 'pointer' }} onClick={() => navigate('/shop/analytics')}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="stat-card-title">DOANH THU THUÊ & MUA</span>
                  <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>↗ +18.2%</span>
                </div>
                <div className="stat-card-value">295.000.000 đ</div>
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '12px' }}>
                Thuê: <strong>210.000.000đ</strong> | Mua: <strong>85.000.000đ</strong>
              </div>
            </div>

            <div className="stat-card-white" style={{ cursor: 'pointer' }} onClick={() => navigate('/shop/rental-orders')}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="stat-card-title">ĐƠN THUÊ ĐANG XỬ LÝ</span>
                  <span style={{ fontSize: '10px', background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px' }}>+12 đơn mới</span>
                </div>
                <div className="stat-card-value">48 đơn</div>
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '12px' }}>
                Chờ duyệt: <strong style={{ color: '#D97706' }}>5</strong> | Đang giao: <strong>14</strong>
              </div>
            </div>

            <div className="stat-card-white" style={{ cursor: 'pointer' }} onClick={() => navigate('/shop/returns')}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="stat-card-title">TIỀN CỌC PAYOS ESCROW</span>
                  <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#D97706', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>AN TOÀN</span>
                </div>
                <div className="stat-card-value" style={{ color: 'var(--color-gold-deep)' }}>142.500.000 đ</div>
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '12px' }}>
                Đang giữ escrow cho 34 đơn thuê
              </div>
            </div>

            <div className="stat-card-white" style={{ cursor: 'pointer' }} onClick={() => navigate('/shop/inventory')}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="stat-card-title">CẢNH BÁO TỒN KHO</span>
                  <span style={{ fontSize: '10px', background: '#FEE2E2', color: '#DC2626', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>CẦN BỔ SUNG</span>
                </div>
                <div className="stat-card-value" style={{ color: '#DC2626' }}>3 Sản Phẩm</div>
              </div>
              <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '12px' }}>
                Size S hết hàng ở 2 mẫu đầm hót
              </div>
            </div>
          </div>

          {/* Table Section Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              ⚡ CẦN XỬ LÝ GẤP TRONG NGÀY
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['TẤT CẢ (08)', 'CHỜ DUYỆT (03)', 'ĐANG GIAO (02)', 'TRẢ HÀNG (02)', 'ĐƠN MUA (01)'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    border: 'none',
                    background: activeTab === tab ? '#171717' : '#F3F4F6',
                    color: activeTab === tab ? '#FFF' : '#4B5563',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Table */}
          <div style={{ background: '#FFF', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginTop: '16px', overflow: 'hidden' }}>
            <table className="shop-table">
              <thead>
                <tr>
                  <th>MÃ ĐƠN & TRANG PHỤC</th>
                  <th>KHÁCH HÀNG THUÊ</th>
                  <th>THỜI GIAN THUÊ</th>
                  <th>GIÁ THUÊ / CỌC</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC XỬ LÝ</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((ord, i) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <img src={ord.image} alt="product" style={{ width: '40px', height: '52px', borderRadius: '6px', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--color-gold-deep)', fontWeight: 700 }}>{ord.id}</div>
                          <div style={{ fontSize: '13px', fontWeight: 700 }}>{ord.product}</div>
                          <div style={{ fontSize: '11px', color: '#6B7280' }}>{ord.detail}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', color: '#171717', fontWeight: 600 }}>{ord.customer}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', color: '#4B5563' }}>{ord.duration}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{ord.amount}</div>
                      <div style={{ fontSize: '10px', color: '#059669', fontWeight: 600 }}>✔ {ord.escrow}</div>
                    </td>
                    <td>
                      <span className={`status-tag status-${ord.statusType}`}>
                        {ord.status}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn-primary" 
                        style={{ fontSize: '11px', padding: '6px 14px' }}
                        onClick={() => {
                          if (ord.statusType === 'return') navigate('/shop/returns');
                          else if (ord.statusType === 'pending') navigate('/shop/rental-orders');
                          else navigate('/shop/rental-orders');
                        }}
                      >
                        {ord.action}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
