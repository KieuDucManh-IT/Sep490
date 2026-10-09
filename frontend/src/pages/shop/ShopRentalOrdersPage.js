import React, { useState } from 'react';
import ShopSidebar from '../../components/ShopSidebar';
import '../../styles/ShopDashboard.css';

export default function ShopRentalOrdersPage() {
  const [activeTab, setActiveTab] = useState('Tất Cả (72)');

  const rentalOrders = [
    {
      id: '#THUE-8891',
      date: '26/03/2025 • 09:15',
      customer: 'Nguyễn Thị Mai Phương',
      phone: '0912***456',
      product: 'Đầm Dạ Hội Lụa Satin Navy',
      sizeColor: 'Size M • Xanh Navy',
      image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=120&q=80',
      period: '26/03 → 29/03/2025 (Thời hạn: 3 ngày)',
      price: '840.000 đ',
      escrow: '600.000 đ (PayOS Escrow)',
      status: 'CHỜ DUYỆT',
      statusType: 'pending',
      action: 'Xác Nhận Ngay',
    },
    {
      id: '#THUE-8885',
      date: '25/03/2025 • 14:20',
      customer: 'Trần Thu Thảo',
      phone: '0983***112',
      product: 'Áo Dài Tơ Tằm Thêu Sen',
      sizeColor: 'Size S • Hồng Pastel',
      image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=120&q=80',
      period: '25/03 → 28/03/2025 (Thời hạn: 3 ngày)',
      price: '660.000 đ',
      escrow: '500.000 đ (Đã Giữ Khóa)',
      status: 'ĐANG THUÊ',
      statusType: 'completed',
      action: 'Xem Chi Tiết',
    },
    {
      id: '#THUE-8879',
      date: '24/03/2025 • 10:45',
      customer: 'Đặng Hoàng Yến',
      phone: '0904***889',
      product: 'Bộ Suit Nữ Tuxedo Slim Fit',
      sizeColor: 'Size L • Đen Tuyền',
      image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80',
      period: '24/03 → 27/03/2025 (● Hạn trả hôm nay)',
      price: '1.050.000 đ',
      escrow: '800.000 đ (Chờ hoàn cọc)',
      status: 'CHỜ TRẢ ĐỒ',
      statusType: 'return',
      action: 'Nghiệm Thu Đồ',
    },
    {
      id: '#THUE-8870',
      date: '22/03/2025 • 16:05',
      customer: 'Lê Quỳnh Anh',
      phone: '0977***334',
      product: 'Áo Khoác Blazer Kem',
      sizeColor: 'Freesize • Be Sữa',
      image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=120&q=80',
      period: '22/03 → 25/03/2025 (Đã kết thúc)',
      price: '450.000 đ',
      escrow: '350.000 đ (Đã trả khách)',
      status: 'HOÀN TẤT',
      statusType: 'completed',
      action: 'Đã Hoàn Cọc',
    },
  ];

  return (
    <div className="shop-dashboard-layout">
      {/* Left Sidebar */}
      <ShopSidebar />

      {/* Main Area */}

      {/* Main Area */}
      <div className="shop-main-area">
        {/* Top Navbar */}
        <header className="shop-top-navbar">
          <div style={{ fontSize: '12px', color: '#6B7280' }}>
            Trang Chủ Shop &gt; Đơn Hàng &gt; <strong>Quản Lý Đơn Thuê</strong>
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

        {/* Content */}
        <div className="shop-content-scroll">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '32px', margin: '0 0 4px 0' }}>
                Quản Lý Đơn Thuê
              </h1>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                Theo dõi chu kỳ thuê trang phục, trạng thái cọc PayOS Escrow và lịch hoàn trả đồ của khách hàng.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn-secondary" style={{ fontSize: '12px' }}>📥 XUẤT EXCEL</button>
              <button className="btn-primary" style={{ fontSize: '12px' }} onClick={() => alert('Tạo đơn thuê thủ công...')}>
                ⊕ TẠO ĐƠN THUÊ
              </button>
            </div>
          </div>

          {/* 4 Stat Cards */}
          <div className="stats-grid-4">
            <div className="stat-card-white" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
              <div className="stat-card-title" style={{ color: '#D97706' }}>CHỜ XÁC NHẬN</div>
              <div className="stat-card-value">05 <small style={{ fontSize: '13px', fontWeight: 400, color: '#6B7280' }}>đơn mới</small></div>
              <div style={{ fontSize: '11px', color: '#D97706', marginTop: '6px' }}>Cần duyệt trong 2h để giữ slot</div>
            </div>

            <div className="stat-card-white" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
              <div className="stat-card-title" style={{ color: '#2563EB' }}>ĐANG CHO THUÊ</div>
              <div className="stat-card-value">18 <small style={{ fontSize: '13px', fontWeight: 400, color: '#6B7280' }}>trang phục</small></div>
              <div style={{ fontSize: '11px', color: '#2563EB', marginTop: '6px' }}>Khách đang trải nghiệm thực tế</div>
            </div>

            <div className="stat-card-white" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
              <div className="stat-card-title" style={{ color: '#DC2626' }}>CHỜ TRẢ ĐỒ</div>
              <div className="stat-card-value">07 <small style={{ fontSize: '13px', fontWeight: 400, color: '#6B7280' }}>kiện hàng</small></div>
              <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '6px' }}>Hạn trả hôm nay & ngày mai</div>
            </div>

            <div className="stat-card-white" style={{ background: '#ECFDF5', borderColor: '#A7F3D0' }}>
              <div className="stat-card-title" style={{ color: '#059669' }}>HOÀN TẤT THÁNG NÀY</div>
              <div className="stat-card-value">42 <small style={{ fontSize: '13px', fontWeight: 400, color: '#6B7280' }}>chu kỳ</small></div>
              <div style={{ fontSize: '11px', color: '#059669', marginTop: '6px' }}>Đã giải ngân & hoàn cọc 100%</div>
            </div>
          </div>

          {/* Table Card */}
          <div className="dashboard-table-card">
            {/* Filter Tabs */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['Tất Cả (72)', 'Chờ Xác Nhận (5)', 'Đã Cọc (12)', 'Đang Giao (6)', 'Đang Thuê (18)', 'Chờ Trả (7)', 'Hoàn Tất (24)'].map((tab) => (
                  <button
                    key={tab}
                    className={`category-tab-btn ${activeTab === tab ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                    style={{ fontSize: '11px', padding: '6px 14px' }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="search-input-box" style={{ width: '240px' }}>
                  <span>🔍</span>
                  <input type="text" placeholder="Tìm mã đơn, tên khách..." />
                </div>
              </div>
            </div>

            {/* Orders Table */}
            <table className="custom-table">
              <thead>
                <tr>
                  <th>MÃ ĐƠN HÀNG</th>
                  <th>KHÁCH HÀNG</th>
                  <th>TRANG PHỤC THUÊ</th>
                  <th>THỜI GIAN THUÊ</th>
                  <th>TIỀN THUÊ</th>
                  <th>CỌC ESCROW</th>
                  <th>TRẠNG THÁI</th>
                  <th>HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody>
                {rentalOrders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{o.id}</div>
                      <div style={{ fontSize: '10px', color: '#9CA3AF' }}>{o.date}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{o.customer}</div>
                      <div style={{ fontSize: '11px', color: '#6B7280' }}>{o.phone}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <img src={o.image} alt={o.product} style={{ width: '40px', height: '50px', borderRadius: '8px', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{o.product}</div>
                          <div style={{ fontSize: '11px', color: '#6B7280' }}>{o.sizeColor}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px' }}>{o.period}</div>
                    </td>
                    <td>
                      <strong style={{ fontSize: '14px', color: 'var(--color-black)' }}>{o.price}</strong>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>✓ {o.escrow}</div>
                    </td>
                    <td>
                      <span className={`status-chip status-${o.statusType}`}>
                        ● {o.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-primary" style={{ fontSize: '11px', padding: '6px 14px' }}>
                        {o.action}
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

