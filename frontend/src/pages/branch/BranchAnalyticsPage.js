import React, { useState } from 'react';
import { Row, Col, Card, Badge, Button, Form } from 'react-bootstrap';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import '../../styles/ShopDashboard.css';

export default function BranchAnalyticsPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [timeRange, setTimeRange] = useState('MONTH');

  return (
    <div className="shop-dashboard-layout">
      {/* Sidebar Navigation */}
      <BranchSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Viewport */}
      <div className="admin-main-viewport">
        {/* Top Header */}
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb="Doanh Thu Chi Nhánh"
        />

        {/* Main Area */}
        <main className="shop-main-content">
          <div className="admin-page-hero d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4 border-bottom">
            <div>
              <h1 className="admin-page-title" style={{ fontSize: '26px', margin: 0 }}>
                Báo Cáo Doanh Thu & Hiệu Suất Chi Nhánh
              </h1>
              <p className="admin-page-desc" style={{ color: '#64748B', fontSize: '13px', marginTop: '4px', margin: 0 }}>
                Phân tích chi tiết dòng tiền cho thuê, doanh thu bán đứt và hiệu suất xoay vòng trang phục
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <Form.Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                style={{ width: '160px', fontSize: '0.88rem' }}
              >
                <option value="WEEK">Tháng Này (T10)</option>
                <option value="MONTH">Quý 3 (T7 - T9)</option>
                <option value="YEAR">Cả Năm 2026</option>
              </Form.Select>
              <Button variant="outline-dark" onClick={() => alert('Đã xuất báo cáo thống kê shop file PDF!')}>
                📥 Xuất File PDF
              </Button>
            </div>
          </div>

        {/* Big Metrics Grid */}
        <Row className="g-3 mt-3">
          <Col md={3}>
            <Card className="dashboard-card border-0 shadow-sm p-3">
              <span className="text-muted small">Tổng Doanh Thu Hàng Tháng</span>
              <h3 className="fw-bold my-1" style={{ color: '#171717' }}>485.000.000 đ</h3>
              <span className="text-success small fw-bold">↑ +18.5% so với tháng trước</span>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="dashboard-card border-0 shadow-sm p-3">
              <span className="text-muted small">Doanh Thu Thuê (Rental)</span>
              <h3 className="fw-bold my-1" style={{ color: '#d4af37' }}>320.000.000 đ</h3>
              <span className="text-muted small">66% Tổng doanh thu</span>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="dashboard-card border-0 shadow-sm p-3">
              <span className="text-muted small">Doanh Thu Bán Đứt (Sale)</span>
              <h3 className="fw-bold my-1" style={{ color: '#059669' }}>165.000.000 đ</h3>
              <span className="text-muted small">34% Tổng doanh thu</span>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="dashboard-card border-0 shadow-sm p-3">
              <span className="text-muted small">Tỷ Lệ Xoay Vòng Trang Phục</span>
              <h3 className="fw-bold my-1 text-primary">8.4 lượt/tháng</h3>
              <span className="text-success small fw-bold">Tối ưu hiệu suất kho</span>
            </Card>
          </Col>
        </Row>

        {/* Detailed Chart & Performance Table */}
        <Row className="g-4 mt-2">
          <Col md={8}>
            <Card className="dashboard-card p-4">
              <h5 className="fw-bold mb-3" style={{ fontSize: '15px' }}>
                Biểu Đồ Doanh Thu Theo Tuần (Tháng 10/2026)
              </h5>
              <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', gap: '24px', padding: '20px 10px', background: '#f9fafb', borderRadius: '8px' }}>
                {[
                  { week: 'Tuần 1', rental: 75, sale: 35 },
                  { week: 'Tuần 2', rental: 90, sale: 45 },
                  { week: 'Tuần 3', rental: 85, sale: 40 },
                  { week: 'Tuần 4', rental: 110, sale: 55 }
                ].map((item, idx) => (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column-reverse', gap: '3px', height: '160px' }}>
                      <div style={{ height: `${item.rental}px`, background: 'linear-gradient(180deg, #d4af37, #725b38)', borderRadius: '4px' }} title={`Thuê: ${item.rental}M`}></div>
                      <div style={{ height: `${item.sale}px`, background: '#171717', borderRadius: '4px' }} title={`Bán: ${item.sale}M`}></div>
                    </div>
                    <span style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: '600' }}>{item.week}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Col>

          <Col md={4}>
            <Card className="dashboard-card p-4">
              <h5 className="fw-bold mb-3" style={{ fontSize: '15px' }}>
                Top Mẫu Trang Phục Sinh Lời Nhất
              </h5>
              <div className="d-flex flex-column gap-3">
                <div>
                  <div className="d-flex justify-content-between small mb-1">
                    <strong>1. Đầm Dạ Hội Rose Gold</strong>
                    <span style={{ color: '#d4af37', fontWeight: '700' }}>85M đ</span>
                  </div>
                  <Badge bg="warning" text="dark">18 Lượt Thuê</Badge>
                </div>
                <div>
                  <div className="d-flex justify-content-between small mb-1">
                    <strong>2. Tuxedo Smoking Tailored</strong>
                    <span style={{ color: '#d4af37', fontWeight: '700' }}>62M đ</span>
                  </div>
                  <Badge bg="secondary">14 Lượt Thuê</Badge>
                </div>
                <div>
                  <div className="d-flex justify-content-between small mb-1">
                    <strong>3. Áo Khoác Wool Privé</strong>
                    <span style={{ color: '#d4af37', fontWeight: '700' }}>48M đ</span>
                  </div>
                  <Badge bg="secondary">10 Lượt Thuê</Badge>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </main>
      </div>
    </div>
  );
}
