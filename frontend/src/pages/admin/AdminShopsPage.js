import React, { useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/AdminDashboard.css';

export default function AdminShopsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const stores = [
    {
      id: 'SHP-1042',
      logo: 'M',
      name: 'Mây Fashion Studio',
      owner: 'Đỗ Gia Khiêm',
      productsCount: 65,
      monthlyRevenue: '45.000.000 đ',
      rating: '4.62 (88)',
      status: 'Đang Hoạt Động',
      statusType: 'success',
    },
    {
      id: 'SHP-0892',
      logo: 'T',
      name: 'Thanh Lịch Boutique',
      owner: 'Lê Bảo Trâm',
      productsCount: 89,
      monthlyRevenue: '38.000.000 đ',
      rating: '4.88 (194)',
      status: 'Đang Hoạt Động',
      statusType: 'success',
    },
    {
      id: 'SHP-1120',
      logo: 'H',
      name: 'Hương Bridal & Evening',
      owner: 'Hoàng Thảo Vy',
      productsCount: 34,
      monthlyRevenue: '22.000.000 đ',
      rating: '4.51 (62)',
      status: 'Đang Hoạt Động',
      statusType: 'success',
    },
    {
      id: 'SHP-0744',
      logo: 'E',
      name: 'Elegant Closet Sài Gòn',
      owner: 'Trần Vũ Hoàng',
      productsCount: 110,
      monthlyRevenue: '62.000.000 đ',
      rating: '4.91 (210)',
      status: 'Đang Hoạt Động',
      statusType: 'success',
    },
    {
      id: 'SHP-0931',
      logo: 'S',
      name: 'Sài Gòn Vintage',
      owner: 'Phạm Minh Tú',
      productsCount: 42,
      monthlyRevenue: '15.000.000 đ',
      rating: '3.95 (35)',
      status: 'Tạm Ngưng',
      statusType: 'warning',
    },
  ];

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Area */}
      <div className="admin-main-viewport">
        {/* Top Header */}
        <header className="admin-top-header">
          <div style={{ fontSize: '13px', fontWeight: 600 }}>
            VESTORA | <span style={{ color: '#8B5CF6' }}>Admin Console</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ fontSize: '11px', background: '#ECFDF5', color: '#059669', padding: '4px 12px', borderRadius: '9999px', fontWeight: 600 }}>
              ● HOẠT ĐỘNG
            </span>
            <span style={{ fontSize: '18px', cursor: 'pointer' }}>🔔</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
                alt="Admin Avatar"
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Lê Hoàng Long</div>
                <div style={{ fontSize: '10px', color: '#6B7280' }}>Quản Trị Viên</div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="admin-scroll-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>Trang Chủ Admin &gt; Quản Lý Gian Hàng</div>
              <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '32px', margin: '4px 0 4px 0' }}>
                Quản Lý Gian Hàng
              </h1>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                Giám sát hoạt động kinh doanh và trạng thái các đối tác mở gian hàng trên VESTORA.
              </p>
            </div>

            <button className="btn-secondary" style={{ fontSize: '11px' }}>KỲ BÁO CÁO: THÁNG 05/2024</button>
          </div>

          {/* 4 Metrics Grid */}
          <div className="admin-metrics-grid">
            <div className="admin-card-metric">
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>TỔNG GIAN HÀNG</div>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: '32px', fontWeight: 700, margin: '8px 0 4px 0' }}>148</div>
              <div style={{ fontSize: '11px', color: '#6B7280' }}>Toàn bộ đối tác</div>
            </div>

            <div className="admin-card-metric">
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>ĐANG HOẠT ĐỘNG</div>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: '32px', fontWeight: 700, color: '#059669', margin: '8px 0 4px 0' }}>139</div>
              <div style={{ fontSize: '11px', color: '#059669' }}>↗ Tỷ lệ 93.9%</div>
            </div>

            <div className="admin-card-metric">
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>TẠM NGƯNG</div>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: '32px', fontWeight: 700, color: '#D97706', margin: '8px 0 4px 0' }}>6</div>
              <div style={{ fontSize: '11px', color: '#D97706' }}>Cần rà soát</div>
            </div>

            <div className="admin-card-metric">
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>ĐÃ ĐÓNG</div>
              <div style={{ fontFamily: 'var(--font-title)', fontSize: '32px', fontWeight: 700, color: '#DC2626', margin: '8px 0 4px 0' }}>3</div>
              <div style={{ fontSize: '11px', color: '#DC2626' }}>Hủy tư cách</div>
            </div>
          </div>

          {/* Table Card */}
          <div className="admin-panel-card">
            {/* Search & Action Bar */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                <div className="search-input-box" style={{ width: '280px' }}>
                  <span>🔍</span>
                  <input
                    type="text"
                    placeholder="Tìm theo tên shop..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <select style={{ padding: '8px 16px', borderRadius: '9999px', border: '1px solid #E5E7EB', fontSize: '12px' }}>
                  <option>Trạng thái: Tất cả</option>
                </select>
                <select style={{ padding: '8px 16px', borderRadius: '9999px', border: '1px solid #E5E7EB', fontSize: '12px' }}>
                  <option>Phân loại: Tất cả</option>
                </select>
              </div>

              <button className="btn-secondary" style={{ fontSize: '12px' }}>📤 Xuất Báo Cáo Gian Hàng</button>
            </div>

            {/* Stores Table */}
            <table className="custom-table">
              <thead>
                <tr>
                  <th>LOGO & TÊN SHOP</th>
                  <th>CHỦ SHOP</th>
                  <th>SỐ SP</th>
                  <th>DOANH THU THÁNG</th>
                  <th>ĐÁNH GIÁ TB</th>
                  <th>TRẠNG THÁI</th>
                  <th>HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#F3F4F6', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                          {s.logo}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px' }}>{s.name}</div>
                          <div style={{ fontSize: '10px', color: '#9CA3AF' }}>Mã: {s.id}</div>
                        </div>
                      </div>
                    </td>
                    <td><strong>{s.owner}</strong></td>
                    <td>{s.productsCount}</td>
                    <td><strong style={{ color: 'var(--color-black)' }}>{s.monthlyRevenue}</strong></td>
                    <td>★ {s.rating}</td>
                    <td>
                      <span className={`status-chip status-${s.statusType}`}>
                        ● {s.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-secondary" style={{ fontSize: '11px', padding: '4px 10px', marginRight: '6px' }}>
                        Xem Chi Tiết
                      </button>
                      <button style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: '11px', cursor: 'pointer', fontWeight: 600 }}>
                        {s.status === 'Tạm Ngưng' ? 'Kích Hoạt' : 'Tạm Ngưng'}
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

