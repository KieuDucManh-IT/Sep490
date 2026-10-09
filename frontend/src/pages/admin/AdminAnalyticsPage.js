import React from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/AdminDashboard.css';

export default function AdminAnalyticsPage() {
  return (
    <div className="admin-layout-container">
      {/* Reusable Admin Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', margin: 0 }}>
              Báo Cáo Thống Kê Chuyên Sâu Toàn Sàn VESTORA
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>
              Phân tích chỉ số tăng trưởng doanh thu thuê, tỷ lệ mua bán đứt thanh lý và hiệu suất AR Try-On
            </p>
          </div>
          <button 
            className="btn-vestora btn-vestora-primary"
            onClick={() => alert('Đã xuất file báo cáo phân tích PDF hệ thống!')}
          >
            📥 Xuất Báo Cáo PDF
          </button>
        </header>

        {/* Big Metrics Grid */}
        <div className="admin-metrics-grid" style={{ marginTop: '24px' }}>
          <div className="admin-card-metric">
            <span className="metric-title">Tổng GMV Luân Chuyển Hàng Tháng</span>
            <div style={{ fontSize: '1.6rem', fontWeight: '700', margin: '8px 0', color: '#171717' }}>4.850.000.000 đ</div>
            <span className="metric-change positive">↑ +28.4% so với tháng trước</span>
          </div>

          <div className="admin-card-metric">
            <span className="metric-title">Tổng Tiền Cọc Đang Giữ (PayOS Escrow)</span>
            <div style={{ fontSize: '1.6rem', fontWeight: '700', margin: '8px 0', color: '#d4af37' }}>1.240.000.000 đ</div>
            <span className="metric-change positive">100% An Toàn Theo Hợp Đồng</span>
          </div>

          <div className="admin-card-metric">
            <span className="metric-title">Tỷ Lệ Chuyển Đổi AR Virtual Try-On</span>
            <div style={{ fontSize: '1.6rem', fontWeight: '700', margin: '8px 0', color: '#059669' }}>42.6%</div>
            <span className="metric-change positive">↑ +14.2% từ tính năng 3D Pose</span>
          </div>

          <div className="admin-card-metric">
            <span className="metric-title">Số Lần Ướm Thử 3D / Ngày</span>
            <div style={{ fontSize: '1.6rem', fontWeight: '700', margin: '8px 0', color: '#171717' }}>8.950 lượt</div>
            <span className="metric-change positive">Mẫu đầm dạ hội được thử nhiều nhất</span>
          </div>
        </div>

        {/* Visual Analytics Sections */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginTop: '24px' }}>
          <div className="admin-card">
            <h2 className="card-title">Biểu Đồ Doanh Thu Phân Theo Loại Hình Dịch Vụ (12 Tháng)</h2>
            <div style={{ height: '240px', display: 'flex', alignItems: 'flex-end', gap: '20px', padding: '20px 10px', background: '#f9fafb', borderRadius: '8px' }}>
              {[
                { month: 'T1', rental: 40, sale: 20 },
                { month: 'T2', rental: 55, sale: 30 },
                { month: 'T3', rental: 60, sale: 25 },
                { month: 'T4', rental: 75, sale: 35 },
                { month: 'T5', rental: 80, sale: 40 },
                { month: 'T6', rental: 95, sale: 50 },
                { month: 'T7', rental: 85, sale: 45 },
                { month: 'T8', rental: 110, sale: 60 },
                { month: 'T9', rental: 130, sale: 70 },
                { month: 'T10', rental: 160, sale: 85 }
              ].map(item => (
                <div key={item.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column-reverse', gap: '2px', height: '180px' }}>
                    <div style={{ height: `${item.rental}px`, background: 'linear-gradient(180deg, #d4af37, #725b38)', borderRadius: '4px' }} title={`Thuê: ${item.rental}M`}></div>
                    <div style={{ height: `${item.sale}px`, background: '#171717', borderRadius: '4px' }} title={`Bán: ${item.sale}M`}></div>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: '600' }}>{item.month}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-card">
            <h2 className="card-title">Tỷ Lệ Danh Mục Cho Thuê</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '10px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '6px' }}>
                  <span>Đầm Dạ Hội & Gown</span>
                  <strong>48%</strong>
                </div>
                <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '48%', height: '100%', background: '#d4af37' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '6px' }}>
                  <span>Vest Nam & Smoking Tuxedo</span>
                  <strong>28%</strong>
                </div>
                <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '28%', height: '100%', background: '#171717' }}></div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: '6px' }}>
                  <span>Áo Khoác Măng Tô Wool Privé</span>
                  <strong>16%</strong>
                </div>
                <div style={{ height: '8px', background: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '16%', height: '100%', background: '#725b38' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
