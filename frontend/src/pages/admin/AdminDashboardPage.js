import React from 'react';
import { useNavigate } from 'react-router-dom';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/AdminDashboard.css';

export default function AdminDashboardPage() {
  const navigate = useNavigate();

  const recentOrders = [
    { id: '#VES-9082', customer: 'Trần Minh Anh', product: 'Đầm Dạ Hội Lụa', price: '1.450.000 đ', status: 'Hoàn tất', type: 'success' },
    { id: '#VES-9081', customer: 'Nguyễn Thu Thảo', product: 'Áo Dài Cách Tân', price: '850.000 đ', status: 'Đang thuê', type: 'warning' },
    { id: '#VES-9080', customer: 'Lê Hoàng Quân', product: 'Suit Tuxedo Đen', price: '2.100.000 đ', status: 'Đang thuê', type: 'warning' },
    { id: '#VES-9079', customer: 'Phạm Thị Mai', product: 'Váy Cưới Ren', price: '4.500.000 đ', status: 'Chờ duyệt', type: 'info' },
    { id: '#VES-9078', customer: 'Vũ Hải Yến', product: 'Blazer Linen', price: '620.000 đ', status: 'Hoàn tất', type: 'success' },
  ];

  return (
    <div className="admin-layout">
      {/* Sidebar Navigation */}
      <AdminSidebar />

      {/* Main Viewport */}
      <div className="admin-main-viewport">
        {/* Top Header */}
        <header className="admin-top-header">
          <div style={{ fontSize: '13px', fontWeight: 600 }}>
            VESTORA | <span style={{ color: '#8B5CF6' }}>Admin Console System</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ fontSize: '11px', background: '#ECFDF5', color: '#059669', padding: '4px 12px', borderRadius: '9999px', fontWeight: 600 }}>
              ● HOẠT ĐỘNG
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=120&q=80"
                alt="Admin Avatar"
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>System Administrator</div>
                <div style={{ fontSize: '10px', color: '#6B7280' }}>Quản Trị Cấp Cao</div>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <div style={{ padding: '36px 48px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '32px', margin: '0 0 4px 0' }}>
                Tổng Quan Hệ Thống VESTORA
              </h1>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                Cập nhật giao dịch toàn sàn, trạng thái PayOS Escrow & xếp hạng các Showroom đối tác.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-primary" style={{ fontSize: '11px', padding: '8px 16px' }} onClick={() => navigate('/admin/analytics')}>
                XEM BÁO CÁO CHI TIẾT
              </button>
              <button className="btn-secondary" style={{ fontSize: '11px', padding: '8px 16px' }} onClick={() => navigate('/admin/moderation')}>
                KIỂM DUYỆT SẢN PHẨM (1)
              </button>
            </div>
          </div>

          {/* Top 4 Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
            <div className="stat-card-white" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/analytics')}>
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>TỔNG GMV LUÂN CHUYỂN</div>
              <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0', color: '#171717' }}>4.850.000.000 đ</div>
              <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>↑ +28.4% so với tháng trước</div>
            </div>

            <div className="stat-card-white" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/disputes')}>
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>TIỀN CỌC ĐANG GIỮ (ESCROW)</div>
              <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0', color: 'var(--color-gold-deep)' }}>1.240.000.000 đ</div>
              <div style={{ fontSize: '11px', color: '#6B7280' }}>100% An toàn theo PayOS</div>
            </div>

            <div className="stat-card-white" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/shops')}>
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>GIAN HÀNG ĐANG HOẠT ĐỘNG</div>
              <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0', color: '#171717' }}>48 Showroom</div>
              <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>↑ +5 shop tháng này</div>
            </div>

            <div className="stat-card-white" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/accounts')}>
              <div style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600 }}>TỔNG TÀI KHOẢN ĐỊNH DANH</div>
              <div style={{ fontSize: '24px', fontWeight: 700, margin: '8px 0', color: '#171717' }}>12.450 Users</div>
              <div style={{ fontSize: '11px', color: '#6B7280' }}>98.5% Đã định danh KYC</div>
            </div>
          </div>

          {/* Middle 2 Grid Layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '32px' }}>
            {/* Revenue Trend Chart Card */}
            <div style={{ background: '#FFF', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  Tăng Trưởng Doanh Thu Toàn Sàn (12 Tháng)
                </h3>
                <span style={{ fontSize: '12px', color: '#6B7280' }}>Đơn vị: Triệu VNĐ</span>
              </div>

              {/* Chart Bars */}
              <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '16px', padding: '0 8px' }}>
                {[
                  { month: 'T1', val: 320 },
                  { month: 'T2', val: 380 },
                  { month: 'T3', val: 420 },
                  { month: 'T4', val: 490 },
                  { month: 'T5', val: 510 },
                  { month: 'T6', val: 680 },
                  { month: 'T7', val: 590 },
                  { month: 'T8', val: 720 },
                  { month: 'T9', val: 850 },
                  { month: 'T10', val: 980 },
                ].map((item, idx) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '100%',
                        height: `${item.val / 5}px`,
                        background: idx === 9 ? 'var(--color-gold-deep)' : '#E5E7EB',
                        borderRadius: '4px 4px 0 0',
                        transition: 'all 0.3s',
                      }}
                      title={`${item.month}: ${item.val} Triệu`}
                    />
                    <span style={{ fontSize: '10px', color: '#6B7280', fontWeight: 600 }}>{item.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 5 Showrooms List */}
            <div style={{ background: '#FFF', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0' }}>
                Top Showroom Tối Ưu Nhất
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { rank: '1', name: 'Mây Fashion Atelier', revenue: '650M đ', rating: '5.0' },
                  { rank: '2', name: 'Lumière Boutique Privée', revenue: '480M đ', rating: '4.9' },
                  { rank: '3', name: 'Atelier Hoa Haute', revenue: '390M đ', rating: '4.9' },
                  { rank: '4', name: 'Văn Thành Tuxedo', revenue: '280M đ', rating: '4.8' },
                  { rank: '5', name: 'Thanh Lịch Boutique', revenue: '210M đ', rating: '4.8' },
                ].map((shop, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 4 ? '1px solid #F3F4F6' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, width: '20px', color: i === 0 ? 'var(--color-gold-deep)' : '#6B7280' }}>
                        #{shop.rank}
                      </span>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{shop.name}</div>
                        <div style={{ fontSize: '10px', color: '#6B7280' }}>Đánh giá: {shop.rating}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#171717' }}>{shop.revenue}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div style={{ background: '#FFF', borderRadius: '16px', padding: '24px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Giao Dịch Thuê & Mua Mới Nhất Trên Sàn
              </h3>
              <button className="btn-secondary" style={{ fontSize: '11px', padding: '6px 12px' }} onClick={() => navigate('/admin/analytics')}>
                XEM TOÀN BỘ
              </button>
            </div>

            <table className="admin-table">
              <thead>
                <tr>
                  <th>MÃ ĐƠN</th>
                  <th>KHÁCH HÀNG</th>
                  <th>SẢN PHẨM THUÊ/MUA</th>
                  <th>GIÁ TRỊ ĐƠN HÀNG</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((ord, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700, color: 'var(--color-gold-deep)' }}>{ord.id}</td>
                    <td>{ord.customer}</td>
                    <td>{ord.product}</td>
                    <td style={{ fontWeight: 700 }}>{ord.price}</td>
                    <td>
                      <span className={`status-badge ${ord.type}`}>
                        {ord.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn-secondary" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => navigate('/admin/disputes')}>
                        CHI TIẾT
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
