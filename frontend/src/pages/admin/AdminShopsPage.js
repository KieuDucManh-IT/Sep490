import React, { useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopHeader from '../../components/AdminTopHeader';
import '../../styles/AdminDashboard.css';

export default function AdminShopsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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

  const filteredStores = stores.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.owner.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="admin-layout">
      {/* 1. Sidebar */}
      <AdminSidebar 
        isCollapsed={isSidebarCollapsed} 
        onToggle={() => setIsSidebarCollapsed(prev => !prev)} 
      />

      {/* 2. Main Viewport with Top Header */}
      <div className="admin-main-viewport">
        <AdminTopHeader 
          onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)} 
          breadcrumb="Quản Lý Gian Hàng Đối Tác"
        />

        {/* 3. Content Body */}
        <div className="admin-content-body">
          {/* Page Hero */}
          <div className="admin-page-hero">
            <div>
              <h1 className="admin-page-title">Quản Lý Gian Hàng Đối Tác VESTORA</h1>
              <p className="admin-page-desc">
                Giám sát hoạt động kinh doanh và trạng thái các đối tác mở gian hàng trên VESTORA.
              </p>
            </div>
            <button className="btn-tail-outline">
              Kỳ báo cáo: Tháng 10/2026
            </button>
          </div>

          {/* 4 Metrics Grid */}
          <div className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <span className="admin-kpi-title">TỔNG GIAN HÀNG</span>
              <div className="admin-kpi-value" style={{ margin: '8px 0' }}>148</div>
              <span className="admin-kpi-trend neutral">Toàn bộ đối tác</span>
            </div>

            <div className="admin-kpi-card">
              <span className="admin-kpi-title">ĐANG HOẠT ĐỘNG</span>
              <div className="admin-kpi-value" style={{ margin: '8px 0', color: '#10B981' }}>139</div>
              <span className="admin-kpi-trend positive">↗ Tỷ lệ 93.9%</span>
            </div>

            <div className="admin-kpi-card">
              <span className="admin-kpi-title">TẠM NGƯNG</span>
              <div className="admin-kpi-value" style={{ margin: '8px 0', color: '#D97706' }}>6</div>
              <span className="admin-kpi-trend neutral">Cần rà soát hợp đồng</span>
            </div>

            <div className="admin-kpi-card">
              <span className="admin-kpi-title">ĐÃ ĐÓNG</span>
              <div className="admin-kpi-value" style={{ margin: '8px 0', color: '#EF4444' }}>3</div>
              <span className="admin-kpi-trend neutral">Hủy tư cách</span>
            </div>
          </div>

          {/* Table Card */}
          <div className="admin-card-table-wrapper">
            <div className="admin-card-table-header">
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div className="admin-search-wrapper" style={{ width: '260px' }}>
                  <span className="admin-search-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </span>
                  <input
                    type="text"
                    className="admin-search-input"
                    placeholder="Tìm theo tên shop..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <button className="btn-tail-gold">
                📤 Xuất Báo Cáo Gian Hàng
              </button>
            </div>

            <div className="tailadmin-table-container">
              <table className="tailadmin-table">
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
                  {filteredStores.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#F1F5F9', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#C5A880', border: '1px solid #E2E8F0' }}>
                            {s.logo}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '13px', color: '#171717' }}>{s.name}</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8' }}>Mã: {s.id}</div>
                          </div>
                        </div>
                      </td>
                      <td><strong>{s.owner}</strong></td>
                      <td>{s.productsCount}</td>
                      <td><strong style={{ color: '#171717' }}>{s.monthlyRevenue}</strong></td>
                      <td><span style={{ color: '#F59E0B' }}>★</span> {s.rating}</td>
                      <td>
                        <span className={`status-pill ${s.status === 'Đang Hoạt Động' ? 'instock' : 'pending'}`}>
                          ● {s.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button className="btn-tail-outline" style={{ padding: '6px 10px', fontSize: '11px' }}>
                            Xem Chi Tiết
                          </button>
                          <button className="btn-tail-outline" style={{ padding: '6px 10px', fontSize: '11px', color: '#EF4444', borderColor: '#FECACA' }}>
                            {s.status === 'Tạm Ngưng' ? 'Kích Hoạt' : 'Tạm Ngưng'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
