import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import '../../styles/AdminDashboard.css';
import '../../styles/OpsShops.css';

export default function OwnerDashboardPage() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // All project orders preserved with rich visual metadata (matching TailAdmin "Top Products" table)
  const recentOrders = [
    {
      id: '#VES-9080',
      product: 'Suit Tuxedo Tux Lux May Đo',
      variant: 'Black Edition • Size 48/50',
      category: 'Tuxedo & Suit',
      customer: 'Lê Hoàng Quân',
      sales: 500,
      price: '2.100.000 đ',
      escrow: '5.000.000 đ',
      status: 'Đang thuê',
      statusType: 'renting',
      image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: '#VES-9082',
      product: 'Đầm Dạ Hội Lụa Satin Cao Cấp',
      variant: 'Emerald Silk • 3 Sizes',
      category: 'Đầm Dạ Hội',
      customer: 'Trần Minh Anh',
      sales: 500,
      price: '1.450.000 đ',
      escrow: '3.500.000 đ',
      status: 'Hoàn tất',
      statusType: 'instock',
      image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: '#VES-9081',
      product: 'Áo Dài Cách Tân Gấm Hoàng Cung',
      variant: 'Gấm Thêu Tay • 4 Colors',
      category: 'Áo Dài',
      customer: 'Nguyễn Thu Thảo',
      sales: 220,
      price: '850.000 đ',
      escrow: '2.000.000 đ',
      status: 'Đang thuê',
      statusType: 'renting',
      image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: '#VES-9079',
      product: 'Váy Cưới Ren Pháp Haute Couture',
      variant: 'Pure White • Custom Fit',
      category: 'Váy Cưới',
      customer: 'Phạm Thị Mai',
      sales: 875,
      price: '4.500.000 đ',
      escrow: '12.000.000 đ',
      status: 'Chờ duyệt',
      statusType: 'lowstock',
      image: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=160&q=80'
    },
    {
      id: '#VES-9078',
      product: 'Blazer Linen Tối Giản Hàn Quốc',
      variant: 'Sand Beige • 3 Sizes',
      category: 'Blazer & Vest',
      customer: 'Vũ Hải Yến',
      sales: 500,
      price: '620.000 đ',
      escrow: '1.500.000 đ',
      status: 'Hoàn tất',
      statusType: 'instock',
      image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=160&q=80'
    }
  ];

  // 12 Months revenue data matching TailAdmin chart visual (1..12)
  const monthlyRevenue = [
    { m: '1', val: 320, label: 'T1' },
    { m: '2', val: 380, label: 'T2' },
    { m: '3', val: 420, label: 'T3' },
    { m: '4', val: 490, label: 'T4' },
    { m: '5', val: 510, label: 'T5' },
    { m: '6', val: 680, label: 'T6' },
    { m: '7', val: 590, label: 'T7' },
    { m: '8', val: 720, label: 'T8' },
    { m: '9', val: 850, label: 'T9' },
    { m: '10', val: 980, label: 'T10' },
    { m: '11', val: 1120, label: 'T11' },
    { m: '12', val: 1350, label: 'T12', highlight: true }
  ];

  // Filtered orders based on search & tab
  const filteredOrders = recentOrders.filter(ord => {
    const matchesSearch =
      ord.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'IN_STOCK' && ord.statusType === 'instock') return true;
    if (statusFilter === 'RENTING' && ord.statusType === 'renting') return true;
    if (statusFilter === 'LOW_STOCK' && ord.statusType === 'lowstock') return true;
    return true;
  });

  return (
    <div className="admin-layout">
      {/* 1. TailAdmin Left Sidebar */}
      <OwnerSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(prev => !prev)}
      />

      {/* 2. Main Viewport */}
      <div className="admin-main-viewport">
        {/* Owner Top Header */}
        <OwnerTopHeader
          onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
          breadcrumb="Tổng Quan Chuỗi"
        />

        {/* 3. Scrollable Dashboard Body */}
        <div className="admin-content-body">
          {/* Greeting Hero Bar */}
          <div className="admin-page-hero">
            <div>
              <h1 className="admin-page-title">Tổng Quan Chuỗi Showroom VESTORA</h1>
              <p className="admin-page-desc">
                Theo dõi tình hình kinh doanh, doanh thu các chi nhánh và trạng thái đơn thuê toàn chuỗi.
              </p>
            </div>

            <div className="admin-hero-actions">
              <button className="btn-tail-outline" onClick={() => navigate('/owner/branches')}>
                Quản lý chi nhánh
              </button>
              <button className="btn-tail-gold" onClick={() => navigate('/owner/analytics')}>
                Báo cáo tài chính
              </button>
            </div>
          </div>

          {/* 4. Top 4 Core KPI Stat Cards */}
          <div className="admin-kpi-grid">
            <div className="admin-kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/owner/analytics')}>
              <div className="admin-kpi-header">
                <span className="admin-kpi-title">TỔNG GMV LUÂN CHUYỂN</span>
                <span className="admin-kpi-icon-pill">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </span>
              </div>
              <div className="admin-kpi-value">4.850.000.000 đ</div>
              <div className="admin-kpi-trend positive">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="19" x2="12" y2="5"></line>
                  <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
                +28.4% so với tháng trước
              </div>
            </div>

            <div className="admin-kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/owner/disputes')}>
              <div className="admin-kpi-header">
                <span className="admin-kpi-title">TIỀN CỌC ESCROW ĐANG GIỮ</span>
                <span className="admin-kpi-icon-pill gold">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                </span>
              </div>
              <div className="admin-kpi-value" style={{ color: '#A6865A' }}>1.240.000.000 đ</div>
              <div className="admin-kpi-trend positive">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                100% An toàn theo PayOS
              </div>
            </div>

            <div className="admin-kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/owner/branches')}>
              <div className="admin-kpi-header">
                <span className="admin-kpi-title">CHI NHÁNH HOẠT ĐỘNG</span>
                <span className="admin-kpi-icon-pill">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                </span>
              </div>
              <div className="admin-kpi-value">48 Showroom</div>
              <div className="admin-kpi-trend positive">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="19" x2="12" y2="5"></line>
                  <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
                +5 showroom tháng này
              </div>
            </div>

            <div className="admin-kpi-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/owner/pricing')}>
              <div className="admin-kpi-header">
                <span className="admin-kpi-title">BẢNG GIÁ & CỌC NIÊM YẾT</span>
                <span className="admin-kpi-icon-pill">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                  </svg>
                </span>
              </div>
              <div className="admin-kpi-value">Thiết Lập Chuẩn</div>
              <div className="admin-kpi-trend positive">
                Áp dụng toàn bộ hệ thống
              </div>
            </div>
          </div>

          {/* 5. Middle 3-Widget Row (Mirrors Top Row in TailAdmin Screenshot) */}
          <div className="admin-widgets-row">
            {/* Widget 1: Revenue Trend Chart (12 Bars) */}
            <div className="admin-widget-card">
              <div className="admin-widget-header">
                <div>
                  <h3 className="admin-widget-title">Doanh Thu 12 Tháng</h3>
                  <span className="admin-widget-subtitle">Đơn vị: Triệu VNĐ</span>
                </div>
                {/* Visual bar icon matching screenshot top-left */}
                <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '16px' }}>
                  <div style={{ width: '4px', height: '10px', background: '#3B82F6', borderRadius: '1px' }}></div>
                  <div style={{ width: '4px', height: '16px', background: '#3B82F6', borderRadius: '1px' }}></div>
                  <div style={{ width: '4px', height: '13px', background: '#C5A880', borderRadius: '1px' }}></div>
                </div>
              </div>

              <div className="chart-bars-container">
                {monthlyRevenue.map((item, idx) => (
                  <div key={idx} className="chart-bar-column">
                    <div
                      className={`chart-bar-fill ${item.highlight ? 'highlight' : ''}`}
                      style={{ height: `${(item.val / 1400) * 100}%` }}
                      title={`Tháng ${item.m}: ${item.val} Triệu VNĐ`}
                    />
                    <span className="chart-bar-label">{item.m}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Widget 2: Performance Breakdown (Like Email / Social Media in screenshot) */}
            <div className="admin-widget-card">
              <div className="admin-widget-header">
                <div>
                  <h3 className="admin-widget-title">Kênh & Vận Hành</h3>
                  <span className="admin-widget-subtitle">Tỷ lệ tăng trưởng tuần</span>
                </div>
              </div>

              <div className="performance-list">
                <div className="performance-item">
                  <span className="performance-label">Đơn Thuê Hoàn Tất</span>
                  <div className="performance-stat">
                    <span className="performance-count">852</span>
                    <span className="performance-change up">↑ 14.8%</span>
                  </div>
                </div>

                <div className="performance-item">
                  <span className="performance-label">Giải Ngân Cọc PayOS</span>
                  <div className="performance-stat">
                    <span className="performance-count">142</span>
                    <span className="performance-change down">↓ 3.2%</span>
                  </div>
                </div>

                <div className="performance-item">
                  <span className="performance-label">Khách Thử Đồ AR 3D</span>
                  <div className="performance-stat">
                    <span className="performance-count">1.420</span>
                    <span className="performance-change up">↑ 22.4%</span>
                  </div>
                </div>

                <div className="performance-item">
                  <span className="performance-label">Tỷ Lệ Trả Chuẩn Hạn</span>
                  <div className="performance-stat">
                    <span className="performance-count">99.1%</span>
                    <span className="performance-change up">↑ 1.5%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Widget 3: Regional / Top Showrooms (Like Japan / Germany in screenshot) */}
            <div className="admin-widget-card">
              <div className="admin-widget-header">
                <div>
                  <h3 className="admin-widget-title">Top Showroom Đối Tác</h3>
                  <span className="admin-widget-subtitle">Theo doanh thu luân chuyển</span>
                </div>
              </div>

              <div className="showroom-list">
                {[
                  { name: 'Mây Fashion Atelier', city: 'Hà Nội', revenue: '650M đ', share: '68%', color: '#EF4444' },
                  { name: 'Lumière Boutique Privée', city: 'TP.HCM', revenue: '480M đ', share: '72%', color: '#F59E0B' },
                  { name: 'Atelier Hoa Haute', city: 'Đà Nẵng', revenue: '390M đ', share: '64%', color: '#10B981' },
                  { name: 'Văn Thành Tuxedo', city: 'Hà Nội', revenue: '280M đ', share: '58%', color: '#3B82F6' },
                  { name: 'Thanh Lịch Boutique', city: 'Cần Thơ', revenue: '210M đ', share: '45%', color: '#8B5CF6' },
                ].map((shop, i) => (
                  <div key={i} className="showroom-item">
                    <div className="showroom-info">
                      <span className="showroom-dot" style={{ background: shop.color }}></span>
                      <div>
                        <div className="showroom-name">{shop.name}</div>
                        <div style={{ fontSize: '10px', color: '#94A3B8' }}>{shop.city}</div>
                      </div>
                    </div>
                    <div className="showroom-meta">
                      <span className="showroom-revenue">{shop.revenue}</span>
                      <span className="showroom-share">{shop.share}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 6. Main Big Card: Top Products & Recent Transactions Table (TailAdmin Form) */}
          <div className="admin-card-table-wrapper">
            <div className="admin-card-table-header">
              <div>
                <h2 className="admin-card-table-title">Top Products & Giao Dịch Thuê Mới Nhất</h2>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  Hiển thị {filteredOrders.length} sản phẩm và giao dịch gần đây trên toàn sàn
                </span>
              </div>

              <div className="admin-card-table-actions">
                {/* Search Input */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm sản phẩm, khách hàng..."
                    style={{
                      height: '36px',
                      padding: '0 12px 0 32px',
                      borderRadius: '8px',
                      border: '1px solid #CBD5E1',
                      fontSize: '13px',
                      outline: 'none',
                      width: '220px',
                      background: '#FFFFFF'
                    }}
                  />
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth="2"
                    style={{ position: 'absolute', left: '10px', pointerEvents: 'none' }}
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>

                {/* Filter Button */}
                <div style={{ position: 'relative' }}>
                  <button
                    className="btn-tail-outline"
                    onClick={() => setShowFilterMenu(prev => !prev)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="4" y1="21" x2="4" y2="14"></line>
                      <line x1="4" y1="10" x2="4" y2="3"></line>
                      <line x1="12" y1="21" x2="12" y2="12"></line>
                      <line x1="12" y1="8" x2="12" y2="3"></line>
                      <line x1="20" y1="21" x2="20" y2="16"></line>
                      <line x1="20" y1="12" x2="20" y2="3"></line>
                      <line x1="1" y1="14" x2="7" y2="14"></line>
                      <line x1="9" y1="8" x2="15" y2="8"></line>
                      <line x1="17" y1="16" x2="23" y2="16"></line>
                    </svg>
                    Filter
                  </button>

                  {/* Filter Dropdown Popover */}
                  {showFilterMenu && (
                    <div style={{
                      position: 'absolute',
                      right: 0,
                      top: '110%',
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      padding: '8px',
                      zIndex: 50,
                      width: '180px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      {[
                        { label: 'Tất cả trạng thái', val: 'ALL' },
                        { label: 'Hoàn tất (In Stock)', val: 'IN_STOCK' },
                        { label: 'Đang thuê (In Rent)', val: 'RENTING' },
                        { label: 'Chờ duyệt (Low Stock)', val: 'LOW_STOCK' }
                      ].map(tab => (
                        <button
                          key={tab.val}
                          style={{
                            textAlign: 'left',
                            padding: '8px 12px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            background: statusFilter === tab.val ? 'rgba(197, 168, 128, 0.15)' : 'transparent',
                            color: statusFilter === tab.val ? '#A6865A' : '#334155',
                            fontWeight: statusFilter === tab.val ? 600 : 400,
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setStatusFilter(tab.val);
                            setShowFilterMenu(false);
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* See All Button */}
                <button
                  className="btn-tail-outline"
                  onClick={() => navigate('/owner/analytics')}
                >
                  See all
                </button>
              </div>
            </div>

            {/* Table Container */}
            <div className="tailadmin-table-container">
              <table className="tailadmin-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Sales</th>
                    <th>Earnings</th>
                    <th>Stocks / Escrow</th>
                    <th>Status</th>
                    <th>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((ord, idx) => (
                    <tr key={idx}>
                      {/* Product Name Column (Thumbnail + Title + Subtitle) */}
                      <td>
                        <div className="product-cell">
                          <img
                            src={ord.image}
                            alt={ord.product}
                            className="product-thumb"
                          />
                          <div className="product-details">
                            <span className="product-title">{ord.product}</span>
                            <span className="product-sub">
                              {ord.id} • {ord.variant} • {ord.customer}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td>
                        <span style={{ fontWeight: 500, color: '#475569' }}>
                          {ord.category}
                        </span>
                      </td>

                      {/* Sales */}
                      <td>
                        <span style={{ fontWeight: 600, color: '#1E293B' }}>
                          {ord.sales}
                        </span>
                      </td>

                      {/* Earnings */}
                      <td>
                        <span style={{ fontWeight: 700, color: '#171717' }}>
                          {ord.price}
                        </span>
                      </td>

                      {/* Stocks / Escrow */}
                      <td>
                        <span style={{ fontWeight: 600, color: '#64748B' }}>
                          {ord.escrow}
                        </span>
                      </td>

                      {/* Status Soft Pill */}
                      <td>
                        <span className={`status-pill ${ord.statusType}`}>
                          {ord.statusType === 'instock' && 'In Stock'}
                          {ord.statusType === 'renting' && 'Đang thuê'}
                          {ord.statusType === 'lowstock' && 'Low Stock'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td>
                        <button
                          className="btn-tail-outline"
                          style={{ padding: '6px 12px', fontSize: '11px' }}
                          onClick={() => navigate('/owner/disputes')}
                        >
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredOrders.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                        Không tìm thấy giao dịch hoặc sản phẩm phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
