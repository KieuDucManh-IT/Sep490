import React, { useState, useEffect } from 'react';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import '../../styles/AdminDashboard.css';

export default function OwnerAnalyticsPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [metrics, setMetrics] = useState({
    users: { total: 11, customers: 9, staff: 2 },
    branches: { total: 8, active: 7, suspended: 1 },
    platformRevenue: 125000000,
    escrowHolding: 45000000
  });

  useEffect(() => {
    fetch('http://localhost:5000/api/admin/metrics')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setMetrics(data.data);
        }
      })
      .catch(err => console.warn('Metrics API fallback:', err.message));
  }, []);

  return (
    <div className="admin-layout">
      {/* 1. Sidebar */}
      <OwnerSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(prev => !prev)}
      />

      {/* 2. Main Viewport with Top Header */}
      <div className="admin-main-viewport">
        <OwnerTopHeader
          onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
          isSidebarCollapsed={isSidebarCollapsed}
          breadcrumb="Báo Cáo Tài Chính Chuỗi"
        />

        {/* 3. Content Body */}
        <div className="admin-content-body">
          {/* Page Hero */}
          <div className="admin-page-hero">
            <div>
              <h1 className="admin-page-title">Báo Cáo Thống Kê Chuyên Sâu Toàn Sàn VESTORA</h1>
              <p className="admin-page-desc">
                Phân tích chỉ số tăng trưởng doanh thu thuê, tỷ lệ mua bán đứt thanh lý và hiệu suất AR Try-On
              </p>
            </div>
            <button
              className="btn-tail-gold"
              onClick={() => alert('Đã xuất file báo cáo phân tích PDF hệ thống!')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Xuất Báo Cáo PDF</span>
            </button>
          </div>

          {/* Big Metrics Grid */}
          <div className="admin-kpi-grid">
            <div className="admin-kpi-card">
              <span className="admin-kpi-title">TỔNG GMV LUÂN CHUYỂN HÀNG THÁNG</span>
              <div className="admin-kpi-value" style={{ margin: '8px 0' }}>4.850.000.000 đ</div>
              <span className="admin-kpi-trend positive">↑ +28.4% so với tháng trước</span>
            </div>

            <div className="admin-kpi-card">
              <span className="admin-kpi-title">TỔNG TIỀN CỌC ĐANG GIỮ (PAYOS ESCROW)</span>
              <div className="admin-kpi-value" style={{ margin: '8px 0', color: '#C5A880' }}>1.240.000.000 đ</div>
              <span className="admin-kpi-trend positive">100% An Toàn Theo Hợp Đồng</span>
            </div>

            <div className="admin-kpi-card">
              <span className="admin-kpi-title">TỶ LỆ CHUYỂN ĐỔI AR VIRTUAL TRY-ON</span>
              <div className="admin-kpi-value" style={{ margin: '8px 0', color: '#10B981' }}>42.6%</div>
              <span className="admin-kpi-trend positive">↑ +14.2% từ tính năng 3D Pose</span>
            </div>

            <div className="admin-kpi-card">
              <span className="admin-kpi-title">SỐ LẦN ƯỚM THỬ 3D / NGÀY</span>
              <div className="admin-kpi-value" style={{ margin: '8px 0' }}>8.950 lượt</div>
              <span className="admin-kpi-trend neutral">Mẫu đầm dạ hội được thử nhiều nhất</span>
            </div>
          </div>

          {/* Real MongoDB Analytics Stats Banner */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '20px 0' }}>
            <div className="admin-card" style={{ borderLeft: '4px solid #C5A880' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>TÀI KHOẢN HỆ THỐNG THỰC TẾ</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#171717', margin: '4px 0' }}>{metrics.users?.total ?? 0} Người dùng</div>
                  <div style={{ fontSize: '12px', color: '#10B981' }}>{metrics.users?.customers ?? 0} Khách hàng • {metrics.users?.staff ?? 0} Nhân sự vận hành</div>
                </div>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563EB' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="admin-card" style={{ borderLeft: '4px solid #10B981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>HỆ THỐNG CHI NHÁNH & KHO VESTORA (UC-12)</div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#171717', margin: '4px 0' }}>{metrics.branches?.total ?? 0} Điểm Cửa Hàng & Kho</div>
                  <div style={{ fontSize: '12px', color: '#10B981' }}>{metrics.branches?.active ?? 0} Đang hoạt động • {metrics.branches?.suspended ?? 0} Tạm ngưng</div>
                </div>
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l2-5h14l2 5" />
                    <path d="M21 9v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9" />
                    <path d="M10 13a2 2 0 0 0 4 0" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Visual Analytics Sections */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginTop: '20px' }}>
            <div className="admin-card">
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: '#171717' }}>
                Biểu Đồ Doanh Thu Phân Theo Loại Hình Dịch Vụ (12 Tháng)
              </h3>
              <div style={{ height: '240px', display: 'flex', alignItems: 'flex-end', gap: '16px', padding: '20px 10px', background: '#F8FAFC', borderRadius: '12px' }}>
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
                      <div style={{ height: `${item.rental}px`, background: '#C5A880', borderRadius: '4px' }} title={`Thuê: ${item.rental}M`}></div>
                      <div style={{ height: `${item.sale}px`, background: '#171717', borderRadius: '4px' }} title={`Bán: ${item.sale}M`}></div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>{item.month}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-card">
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: '#171717' }}>
                Tỷ Lệ Danh Mục Cho Thuê
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '10px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                    <span style={{ color: '#334155', fontWeight: 500 }}>Đầm Dạ Hội & Gown</span>
                    <strong style={{ color: '#171717' }}>48%</strong>
                  </div>
                  <div style={{ height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '48%', height: '100%', background: '#C5A880' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                    <span style={{ color: '#334155', fontWeight: 500 }}>Vest Nam & Smoking Tuxedo</span>
                    <strong style={{ color: '#171717' }}>28%</strong>
                  </div>
                  <div style={{ height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '28%', height: '100%', background: '#171717' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                    <span style={{ color: '#334155', fontWeight: 500 }}>Áo Khoác Măng Tô Wool Privé</span>
                    <strong style={{ color: '#171717' }}>16%</strong>
                  </div>
                  <div style={{ height: '8px', background: '#F1F5F9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '16%', height: '100%', background: '#A6865A' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

