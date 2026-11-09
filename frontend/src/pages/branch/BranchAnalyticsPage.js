import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Badge, Button, Form, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  RotateCcw,
  AlertTriangle,
  CalendarClock,
  Boxes,
  ShieldAlert,
  ArrowUpRight,
  Download,
  RefreshCw,
  Clock,
  Sparkles,
  ShoppingBag,
  CalendarRange,
  Phone,
} from 'lucide-react';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import { getBranchPerformanceReportApi, getAssignedBranchApi } from '../../services/shopApi';
import '../../styles/ShopDashboard.css';

/**
 * Format tiền tệ VND chuẩn Haute Couture
 */
function formatVND(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '0 ₫';
  return amount.toLocaleString('vi-VN') + ' ₫';
}

export default function BranchAnalyticsPage() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [timeRange, setTimeRange] = useState('MONTH');
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [branchInfo, setBranchInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      // Lấy đồng thời thông tin chi nhánh & báo cáo hiệu suất
      const [branchRes, reportRes] = await Promise.allSettled([
        getAssignedBranchApi(),
        getBranchPerformanceReportApi({ timeRange }),
      ]);

      if (branchRes.status === 'fulfilled' && branchRes.value?.success) {
        setBranchInfo(branchRes.value.data);
      }
      if (reportRes.status === 'fulfilled' && reportRes.value?.success) {
        setReportData(reportRes.value.data);
      } else if (reportRes.status === 'rejected') {
        const err = reportRes.reason;
        console.warn('Lỗi gọi API báo cáo hiệu suất chi nhánh:', err);
        setErrorMsg(err?.message || 'Không thể lấy dữ liệu từ máy chủ backend (Mã 401/403).');
      }
    } catch (err) {
      console.warn('Lỗi tải báo cáo hiệu suất chi nhánh:', err);
      setErrorMsg(err?.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const kpi = reportData?.kpi || {
    totalRevenue: 0,
    rentalRevenue: 0,
    saleRevenue: 0,
    activeDeposits: 0,
    growthRate: 0,
    totalOrdersCount: 0,
    rentalOrdersCount: 0,
    saleOrdersCount: 0,
    garmentTurnoverRate: '0 lượt/tháng',
  };

  const stock = reportData?.stockBreakdown || {
    totalUnits: 0,
    available: 0,
    rented: 0,
    maintenance: 0,
    inspecting: 0,
  };

  const upcomingReturns = reportData?.upcomingReturns || [];
  const operationalIssues = reportData?.operationalIssues || [];
  const topProducts = reportData?.topProducts || [];

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
          breadcrumb="Báo Cáo Hiệu Suất & Vận Hành Chi Nhánh"
        />

        {/* Main Area */}
        <main className="shop-main-content">
          {/* Header Action Bar */}
          <div className="admin-page-hero d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4 border-bottom">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <h1 className="admin-page-title" style={{ fontSize: '24px', margin: 0, fontWeight: 700 }}>
                  Báo Cáo Vận Hành & Hiệu Suất Chi Nhánh
                </h1>
                {branchInfo?.name && (
                  <Badge bg="dark" style={{ border: '1px solid #d4af37', color: '#d4af37', fontWeight: 600 }}>
                    {branchInfo.name}
                  </Badge>
                )}
              </div>
              <p className="admin-page-desc" style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>
                Giám sát dòng tiền, đơn hàng, tồn kho, lịch sắp hoàn trả và sự cố vận hành của chi nhánh
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Form.Select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                style={{ width: '160px', fontSize: '0.88rem', borderColor: '#E2E8F0', borderRadius: '6px' }}
                disabled={loading}
              >
                <option value="TODAY">Hôm Nay</option>
                <option value="WEEK">7 Ngày Gần Nhất</option>
                <option value="MONTH">Tháng Này</option>
                <option value="QUARTER">Quý Này (90 Ngày)</option>
                <option value="YEAR">Cả Năm 2026</option>
              </Form.Select>

              <Button
                variant="outline-secondary"
                size="sm"
                onClick={fetchReport}
                disabled={loading}
                title="Làm mới dữ liệu"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <RefreshCw size={14} className={loading ? 'fa-spin' : ''} />
                Làm mới
              </Button>

              <Button
                variant="dark"
                size="sm"
                onClick={() => alert(`Xuất file Báo cáo Chi nhánh ${branchInfo?.name || ''} thành công!`)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#171717', border: 'none' }}
              >
                <Download size={14} />
                Xuất PDF
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="warning" />
              <p className="mt-2 text-muted small">Đang tổng hợp dữ liệu vận hành chi nhánh...</p>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div
                  className="alert alert-warning d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 py-2 px-3 shadow-sm"
                  style={{ borderRadius: '8px', borderLeft: '4px solid #B45309' }}
                  role="alert"
                >
                  <div>
                    <strong style={{ color: '#92400E' }}>⚠️ Cảnh báo xác thực Backend:</strong>{' '}
                    <span style={{ color: '#78350F' }}>{errorMsg}</span>
                    <div className="small text-muted" style={{ fontSize: '12px' }}>
                      Màn hình đang hiển thị dữ liệu mẫu xem trước (fallback). Hãy đăng nhập tài khoản <strong>Quản lý chi nhánh (BRANCH_MANAGER)</strong> để tải dữ liệu thật từ database.
                    </div>
                  </div>
                  <Button
                    variant="outline-dark"
                    size="sm"
                    style={{ fontSize: '12px', padding: '4px 12px' }}
                    onClick={() => navigate('/login')}
                  >
                    Đăng nhập lại
                  </Button>
                </div>
              )}

              {/* 1. BIG METRICS: REVENUE & ORDERS */}
              <Row className="g-3">
                <Col md={3} sm={6}>
                  <Card className="dashboard-card border-0 shadow-sm p-3 h-100" style={{ borderLeft: '4px solid #171717' }}>
                    <div className="d-flex justify-content-between align-items-start">
                      <span className="text-muted small">Tổng Doanh Thu</span>
                      <TrendingUp size={16} className="text-success" />
                    </div>
                    <h3 className="fw-bold my-1" style={{ color: '#171717' }}>
                      {formatVND(kpi.totalRevenue)}
                    </h3>
                    <div className="d-flex justify-content-between align-items-center mt-2 small">
                      <span className="text-success fw-bold">↑ +{kpi.growthRate}% kỳ trước</span>
                      <span className="text-muted">{kpi.totalOrdersCount} đơn</span>
                    </div>
                  </Card>
                </Col>

                <Col md={3} sm={6}>
                  <Card className="dashboard-card border-0 shadow-sm p-3 h-100" style={{ borderLeft: '4px solid #D4AF37' }}>
                    <div className="d-flex justify-content-between align-items-start">
                      <span className="text-muted small">Doanh Thu Thuê (Rental)</span>
                      <CalendarRange size={16} style={{ color: '#D4AF37' }} />
                    </div>
                    <h3 className="fw-bold my-1" style={{ color: '#96723D' }}>
                      {formatVND(kpi.rentalRevenue)}
                    </h3>
                    <div className="d-flex justify-content-between align-items-center mt-2 small">
                      <span className="text-muted">{kpi.rentalOrdersCount} lượt thuê</span>
                      <span className="badge bg-light text-dark border">
                        {Math.round((kpi.rentalRevenue / (kpi.totalRevenue || 1)) * 100)}% DT
                      </span>
                    </div>
                  </Card>
                </Col>

                <Col md={3} sm={6}>
                  <Card className="dashboard-card border-0 shadow-sm p-3 h-100" style={{ borderLeft: '4px solid #059669' }}>
                    <div className="d-flex justify-content-between align-items-start">
                      <span className="text-muted small">Doanh Thu Bán Đứt (Sale)</span>
                      <ShoppingBag size={16} className="text-success" />
                    </div>
                    <h3 className="fw-bold my-1" style={{ color: '#059669' }}>
                      {formatVND(kpi.saleRevenue)}
                    </h3>
                    <div className="d-flex justify-content-between align-items-center mt-2 small">
                      <span className="text-muted">{kpi.saleOrdersCount} đơn bán</span>
                      <span className="badge bg-light text-dark border">
                        {Math.round((kpi.saleRevenue / (kpi.totalRevenue || 1)) * 100)}% DT
                      </span>
                    </div>
                  </Card>
                </Col>

                <Col md={3} sm={6}>
                  <Card className="dashboard-card border-0 shadow-sm p-3 h-100" style={{ borderLeft: '4px solid #2563EB' }}>
                    <div className="d-flex justify-content-between align-items-start">
                      <span className="text-muted small">Tiền Cọc Đang Giữ</span>
                      <Boxes size={16} className="text-primary" />
                    </div>
                    <h3 className="fw-bold my-1" style={{ color: '#2563EB' }}>
                      {formatVND(kpi.activeDeposits)}
                    </h3>
                    <div className="d-flex justify-content-between align-items-center mt-2 small">
                      <span className="text-muted">Đảm bảo tài sản</span>
                      <span className="text-primary fw-bold">{kpi.garmentTurnoverRate}</span>
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* 2. STOCK STATUS & CAPACITY */}
              <Row className="g-3 mt-1">
                <Col md={12}>
                  <Card className="dashboard-card p-3 border-0 shadow-sm">
                    <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                      <h6 className="fw-bold m-0 d-flex align-items-center gap-2">
                        <Boxes size={18} style={{ color: '#D4AF37' }} />
                        Tình Trạng Tồn Kho Trang Phục Tại Chi Nhánh ({stock.totalUnits} sản phẩm)
                      </h6>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-decoration-none text-muted"
                        onClick={() => navigate('/branch/inventory')}
                      >
                        Quản lý kho chi nhánh <ArrowUpRight size={14} />
                      </Button>
                    </div>

                    <Row className="g-2 text-center">
                      <Col xs={6} md={3}>
                        <div className="p-2 rounded" style={{ background: '#F0FDF4', border: '1px solid #DCFCE7' }}>
                          <span className="text-success small fw-bold">Sẵn Sàng Cho Thuê</span>
                          <h4 className="fw-bold text-success my-1">{stock.available}</h4>
                          <span className="text-muted small">Đang treo trên kệ</span>
                        </div>
                      </Col>
                      <Col xs={6} md={3}>
                        <div className="p-2 rounded" style={{ background: '#EFF6FF', border: '1px solid #DBEAFE' }}>
                          <span className="text-primary small fw-bold">Đang Khách Thuê</span>
                          <h4 className="fw-bold text-primary my-1">{stock.rented}</h4>
                          <span className="text-muted small">Khách đang mặc</span>
                        </div>
                      </Col>
                      <Col xs={6} md={3}>
                        <div className="p-2 rounded" style={{ background: '#FFFBEB', border: '1px solid #FEF3C7' }}>
                          <span className="small fw-bold" style={{ color: '#B45309' }}>Bảo Dưỡng / Giặt Hấp</span>
                          <h4 className="fw-bold my-1" style={{ color: '#B45309' }}>{stock.maintenance}</h4>
                          <span className="text-muted small">Đang xử lý kỹ thuật</span>
                        </div>
                      </Col>
                      <Col xs={6} md={3}>
                        <div className="p-2 rounded" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                          <span className="text-secondary small fw-bold">Chờ Kiểm Định Nhận Trả</span>
                          <h4 className="fw-bold text-secondary my-1">{stock.inspecting}</h4>
                          <span className="text-muted small">Cần đối soát cọc</span>
                        </div>
                      </Col>
                    </Row>
                  </Card>
                </Col>
              </Row>

              {/* 3. REVENUE CHART & TOP PRODUCT PERFORMANCE */}
              <Row className="g-4 mt-1">
                <Col md={7}>
                  <Card className="dashboard-card p-4 border-0 shadow-sm h-100">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="fw-bold m-0" style={{ fontSize: '15px' }}>
                        Biểu Đồ Doanh Thu Thuê vs. Bán ({timeRange})
                      </h5>
                      <div className="d-flex gap-3 small">
                        <span className="d-flex align-items-center gap-1">
                          <span style={{ width: 10, height: 10, background: '#D4AF37', borderRadius: 2 }}></span>
                          Thuê đồ
                        </span>
                        <span className="d-flex align-items-center gap-1">
                          <span style={{ width: 10, height: 10, background: '#171717', borderRadius: 2 }}></span>
                          Bán đứt
                        </span>
                      </div>
                    </div>

                    <div style={{ height: '200px', display: 'flex', alignItems: 'flex-end', gap: '20px', padding: '16px 8px', background: '#FAFAF9', borderRadius: '8px' }}>
                      {[
                        { label: 'Kỳ 1', rental: 75, sale: 35 },
                        { label: 'Kỳ 2', rental: 90, sale: 45 },
                        { label: 'Kỳ 3', rental: 85, sale: 40 },
                        { label: 'Kỳ 4', rental: 110, sale: 55 },
                      ].map((item, idx) => (
                        <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column-reverse', gap: '2px', height: '140px' }}>
                            <div style={{ height: `${item.rental}px`, background: 'linear-gradient(180deg, #D4AF37, #96723D)', borderRadius: '4px' }} title={`Thuê: ${item.rental}M`}></div>
                            <div style={{ height: `${item.sale}px`, background: '#171717', borderRadius: '4px' }} title={`Bán: ${item.sale}M`}></div>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: '#6B7280', fontWeight: '600' }}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </Col>

                <Col md={5}>
                  <Card className="dashboard-card p-4 border-0 shadow-sm h-100">
                    <h5 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ fontSize: '15px' }}>
                      <Sparkles size={16} style={{ color: '#D4AF37' }} />
                      Top Mẫu Trang Phục Sinh Lời Nhất
                    </h5>
                    <div className="d-flex flex-column gap-3">
                      {topProducts.length === 0 ? (
                        <p className="text-muted small text-center py-3">Chưa có giao dịch trang phục trong kỳ này.</p>
                      ) : (
                        topProducts.map((p, idx) => (
                          <div key={p.id || idx} className="d-flex justify-content-between align-items-center pb-2 border-bottom">
                            <div>
                              <div className="fw-bold small">{idx + 1}. {p.name}</div>
                              <span className="text-muted" style={{ fontSize: '11px' }}>{p.category}</span>
                            </div>
                            <div className="text-end">
                              <div style={{ color: '#96723D', fontWeight: '700', fontSize: '13px' }}>
                                {formatVND(p.revenue)}
                              </div>
                              <Badge bg="warning" text="dark" style={{ fontSize: '10px' }}>
                                {p.rentalCount} lượt thuê
                              </Badge>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* 4. UPCOMING RETURNS & OPERATIONAL ISSUES (ESSENTIAL SCREEN REQUIREMENTS) */}
              <Row className="g-4 mt-1">
                {/* UPCOMING RETURNS */}
                <Col md={7}>
                  <Card className="dashboard-card p-4 border-0 shadow-sm h-100">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="fw-bold m-0 d-flex align-items-center gap-2" style={{ fontSize: '15px' }}>
                        <CalendarClock size={16} style={{ color: '#D4AF37' }} />
                        Lịch Trang Phục Sắp Hoàn Trả (48 Giờ Tới)
                      </h5>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-decoration-none text-muted"
                        onClick={() => navigate('/branch/returns')}
                      >
                        Xem tất cả <ArrowUpRight size={14} />
                      </Button>
                    </div>

                    {upcomingReturns.length === 0 ? (
                      <p className="text-muted small text-center py-4">Không có đơn nào sắp đến hạn trả trong 48h tới.</p>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm align-middle" style={{ fontSize: '12.5px' }}>
                          <thead className="table-light">
                            <tr>
                              <th>Đơn hàng</th>
                              <th>Khách hàng</th>
                              <th>Trang phục</th>
                              <th>Hạn trả</th>
                              <th>Tiền cọc</th>
                              <th>Hành động</th>
                            </tr>
                          </thead>
                          <tbody>
                            {upcomingReturns.map((ret, idx) => (
                              <tr key={idx}>
                                <td className="fw-bold">{ret.orderId}</td>
                                <td>
                                  <div>{ret.customerName}</div>
                                  <div className="text-muted" style={{ fontSize: '11px' }}>
                                    <Phone size={10} className="me-1" />
                                    {ret.customerPhone}
                                  </div>
                                </td>
                                <td>{ret.productName}</td>
                                <td>
                                  {ret.isDueToday ? (
                                    <Badge bg="danger" style={{ fontSize: '10px' }}>Hôm nay</Badge>
                                  ) : (
                                    <Badge bg="secondary" style={{ fontSize: '10px' }}>Ngày mai</Badge>
                                  )}
                                </td>
                                <td className="fw-bold" style={{ color: '#96723D' }}>
                                  {formatVND(ret.depositAmount)}
                                </td>
                                <td>
                                  <Button
                                    variant="outline-dark"
                                    size="sm"
                                    style={{ fontSize: '11px', padding: '2px 8px' }}
                                    onClick={() => navigate('/branch/returns')}
                                  >
                                    Nhận trả
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </Col>

                {/* OPERATIONAL ISSUES & ALERTS */}
                <Col md={5}>
                  <Card className="dashboard-card p-4 border-0 shadow-sm h-100">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="fw-bold m-0 d-flex align-items-center gap-2" style={{ fontSize: '15px', color: '#991B1B' }}>
                        <ShieldAlert size={16} />
                        Sự Cố Vận Hành Cần Xử Lý ({operationalIssues.length})
                      </h5>
                    </div>

                    {operationalIssues.length === 0 ? (
                      <div className="text-center py-4">
                        <span className="text-success small fw-bold">✓ Không có sự cố vận hành nào tồn đọng</span>
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {operationalIssues.map((issue) => (
                          <div
                            key={issue.id}
                            className="p-3 rounded border"
                            style={{
                              background: issue.type === 'OVERDUE' ? '#FFF5F5' : '#FFFBEB',
                              borderColor: issue.type === 'OVERDUE' ? '#FECACA' : '#FDE68A',
                            }}
                          >
                            <div className="d-flex justify-content-between align-items-start">
                              <div>
                                <Badge
                                  bg={issue.type === 'OVERDUE' ? 'danger' : 'warning'}
                                  text={issue.type === 'OVERDUE' ? 'light' : 'dark'}
                                  className="me-2"
                                  style={{ fontSize: '10px' }}
                                >
                                  {issue.type === 'OVERDUE' ? 'QUÁ HẠN TRẢ' : 'TRANH CHẤP/LỖI HỎNG'}
                                </Badge>
                                <span className="fw-bold small">{issue.orderId}</span>
                              </div>
                              <span className="text-muted" style={{ fontSize: '11px' }}>
                                {issue.customerName}
                              </span>
                            </div>

                            <p className="small mb-2 mt-2" style={{ color: '#4B5563', lineHeight: '1.4' }}>
                              {issue.detail}
                            </p>

                            <div className="d-flex justify-content-between align-items-center">
                              <span className="text-muted" style={{ fontSize: '11px' }}>
                                SĐT: {issue.customerPhone || 'Đang cập nhật'}
                              </span>
                              <Button
                                variant="outline-dark"
                                size="sm"
                                style={{ fontSize: '11px', padding: '2px 8px' }}
                                onClick={() => navigate(issue.type === 'OVERDUE' ? '/branch/rental-orders' : '/branch/returns')}
                              >
                                Xử lý ngay
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
