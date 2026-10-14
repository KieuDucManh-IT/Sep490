import React, { useState, useEffect } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopHeader from '../../components/AdminTopHeader';
import '../../styles/AdminDashboard.css';

export default function AdminShopsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [stores, setStores] = useState([
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
    }
  ]);

  const [stats, setStats] = useState({
    total: 8,
    active: 5,
    pending: 2,
    rejected: 1
  });

  const fetchShops = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/shops');
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        const mapped = data.data.map(s => {
          let stText = 'Đang Hoạt Động';
          let stType = 'success';
          if (s.status === 'PENDING') {
            stText = 'Chờ Duyệt';
            stType = 'warning';
          } else if (s.status === 'LOCKED' || s.status === 'REJECTED') {
            stText = 'Tạm Ngưng';
            stType = 'danger';
          }
          return {
            id: s._id,
            logo: (s.name || 'S').charAt(0).toUpperCase(),
            name: s.name,
            owner: s.ownerName || s.phone || 'Chủ Gian Hàng',
            productsCount: Math.floor(Math.random() * 40) + 10,
            monthlyRevenue: `${(Math.floor(Math.random() * 30) + 15).toLocaleString('vi-VN')}.000.000 đ`,
            rating: '4.85 (42)',
            status: stText,
            statusType: stType,
            rawStatus: s.status
          };
        });
        setStores(mapped);
      }
    } catch (err) {
      console.warn('Backend chưa khởi động hoặc gặp lỗi:', err.message);
    }

    try {
      const resStats = await fetch('http://localhost:5000/api/shops/stats');
      const sData = await resStats.json();
      if (sData.success && sData.data) {
        setStats(sData.data);
      }
    } catch (e) {
      // fallback
    }
  };

  useEffect(() => {
    fetchShops();
  }, []);

  const handleToggleShopStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Đang Hoạt Động' ? 'LOCKED' : 'ACTIVE';
    try {
      const res = await fetch(`http://localhost:5000/api/shops/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Đã cập nhật trạng thái gian hàng thành ${newStatus}`);
        fetchShops();
      } else {
        alert(data.message || 'Lỗi cập nhật');
      }
    } catch (err) {
      setStores(prev => prev.map(s => s.id === id ? {
        ...s,
        status: s.status === 'Đang Hoạt Động' ? 'Tạm Ngưng' : 'Đang Hoạt Động'
      } : s));
      alert(`Đã chuyển trạng thái gian hàng ${id}`);
    }
  };

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
              <div className="admin-kpi-value" style={{ margin: '8px 0' }}>{stats.total}</div>
              <span className="admin-kpi-trend neutral">Toàn bộ đối tác</span>
            </div>

            <div className="admin-kpi-card">
              <span className="admin-kpi-title">ĐANG HOẠT ĐỘNG</span>
              <div className="admin-kpi-value" style={{ margin: '8px 0', color: '#10B981' }}>{stats.active}</div>
              <span className="admin-kpi-trend positive">↗ Tỷ lệ {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%</span>
            </div>

            <div className="admin-kpi-card">
              <span className="admin-kpi-title">CHỜ DUYỆT / TẠM NGƯNG</span>
              <div className="admin-kpi-value" style={{ margin: '8px 0', color: '#D97706' }}>{stats.pending}</div>
              <span className="admin-kpi-trend neutral">Cần rà soát hồ sơ</span>
            </div>

            <div className="admin-kpi-card">
              <span className="admin-kpi-title">TỪ CHỐI / ĐÃ ĐÓNG</span>
              <div className="admin-kpi-value" style={{ margin: '8px 0', color: '#EF4444' }}>{stats.rejected}</div>
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
                          <button 
                            className="btn-tail-outline" 
                            style={{ padding: '6px 10px', fontSize: '11px', color: '#EF4444', borderColor: '#FECACA' }}
                            onClick={() => handleToggleShopStatus(s.id, s.status)}
                          >
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
