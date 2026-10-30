import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import {
  Building2,
  RefreshCw,
  ExternalLink,
  Settings,
  TrendingUp,
  MapPin,
  Phone,
  Clock,
  Star,
  Sparkles,
  Store,
} from 'lucide-react';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import ImageLightboxModal from '../../components/ImageLightboxModal';
import { getAssignedBranchApi } from '../../services/shopApi';
import '../../styles/ShopDashboard.css';

export default function BranchDashboardPage() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('TẤT CẢ (08)');
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    let isMounted = true;
    getAssignedBranchApi()
      .then((res) => {
        if (isMounted && res?.success && res.data) {
          setShop(res.data);
        } else if (isMounted) {
          setShop(null);
        }
      })
      .catch(() => {
        if (isMounted) setShop(null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const orders = [
    {
      id: '#THUE-8892',
      product: 'Đầm Dạ Hội Satin Midnight',
      detail: 'Size S • Kèm túi voan',
      image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=120&q=80',
      customer: 'Nguyễn Lan Hương (0908***412 - VIP 2)',
      duration: '3 ngày (24/10 - 27/10)',
      amount: '700.000 đ',
      escrow: 'Cọc PayOS Escrow',
      status: 'CHỜ XÁC NHẬN',
      statusType: 'pending',
      action: 'DUYỆT ĐƠN',
    },
    {
      id: '#THUE-8889',
      product: 'Áo Khoác Tweed Thủ Công',
      detail: 'Size M • Kèm bé ngọc trai',
      image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=120&q=80',
      customer: 'Trần Mai Chi (0971***890)',
      duration: '2 ngày (25/10 - 27/10)',
      amount: '500.000 đ',
      escrow: 'Cọc PayOS Escrow',
      status: 'ĐANG ĐÓNG GÓI',
      statusType: 'shipping',
      action: 'IN PHIẾU GỬI',
    },
    {
      id: '#THUE-8879',
      product: 'Đầm Dạ Hội Satin Midnight',
      detail: 'Khách hoàn trả • Vết ố nhẹ',
      image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=120&q=80',
      customer: 'Đặng Hoàng Yến (0934***221)',
      duration: 'Đã nhận hoàn trả (Chờ đối soát)',
      amount: '700.000 đ',
      escrow: 'Đang giữ tiền cọc',
      status: 'CHỜ KIỂM ĐỊNH CỌC',
      statusType: 'return',
      action: 'XỬ LÝ CỌC',
    },
    {
      id: '#MUA-1045',
      product: 'Bộ Suit Tuxedo Slim Fit',
      detail: 'Thanh Lý Like New 98%',
      image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80',
      customer: 'Phạm Thu Trang (0912***556)',
      duration: 'Đơn Mua Sở Hữu (Đã nhận thanh toán)',
      amount: '4.200.000 đ',
      escrow: 'Đã nhận thanh toán',
      status: 'CHỜ GIAO SHIPPER',
      statusType: 'completed',
      action: 'GIAO SHIPPER',
    },
  ];

  return (
    <div className="shop-dashboard-layout">
      {/* Reusable Branch Sidebar */}
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
          breadcrumb="Tổng Quan Chi Nhánh"
        />

        {/* Scroll Content */}
        <div className="shop-content-scroll">
          {loading ? (
            <div className="text-center py-5 my-5">
              <Spinner animation="border" variant="dark" role="status" className="mb-2" />
              <div className="text-muted small">Đang tải dữ liệu tổng quan cửa hàng...</div>
            </div>
          ) : !shop ? (
            /* ========================================================
               EMPTY STATE: NOT ASSIGNED A BRANCH
               ======================================================== */
            <div className="text-center py-5">
              <div
                style={{
                  maxWidth: '560px',
                  margin: '40px auto',
                  padding: '48px 36px',
                  background: '#FFFFFF',
                  borderRadius: '20px',
                  boxShadow: '0 4px 25px rgba(0,0,0,0.06)',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '20px',
                    background: '#FEF3C7',
                    color: '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px auto',
                    boxShadow: '0 8px 16px -4px rgba(245, 158, 11, 0.25)',
                  }}
                >
                  <Building2 size={36} strokeWidth={1.8} />
                </div>
                <h3
                  style={{
                    fontFamily: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    fontSize: '22px',
                    fontWeight: 700,
                    color: '#0F172A',
                    marginBottom: '12px',
                  }}
                >
                  Chưa Được Phân Công Chi Nhánh
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#64748B',
                    lineHeight: 1.6,
                    marginBottom: '28px',
                  }}
                >
                  Tài khoản của bạn hiện chưa được Chủ sở hữu chuỗi (Shop Owner) bổ nhiệm quản lý cửa hàng nào trong hệ thống VESTORA. Vui lòng liên hệ quản lý để được chỉ định chi nhánh vận hành.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-4 py-2 d-inline-flex align-items-center gap-2"
                    style={{ fontSize: '13px', borderRadius: '8px', fontWeight: 600 }}
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw size={14} />
                    <span>Tải Lại Trang</span>
                  </button>
                  <Link
                    to="/"
                    className="btn btn-dark px-4 py-2 d-inline-flex align-items-center gap-2"
                    style={{ fontSize: '13px', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', background: '#0F172A' }}
                  >
                    <span>Về Cổng Khách Hàng</span>
                    <ExternalLink size={14} />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================
               ACTIVE STORE DASHBOARD
               ======================================================== */
            <>
              {/* Header Title & Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        background: '#EEF2FF',
                        color: '#4F46E5',
                        padding: '3px 10px',
                        borderRadius: '9999px',
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Sparkles size={11} />
                      CỬA HÀNG ĐƯỢC CHỈ ĐỊNH
                    </span>
                    {shop.isHQ && (
                      <span
                        style={{
                          fontSize: '11px',
                          background: '#FEF3C7',
                          color: '#B45309',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Star size={11} fill="#B45309" />
                        TRỤ SỞ CHÍNH (HQ)
                      </span>
                    )}
                  </div>
                  <h1 className="admin-page-title" style={{ fontSize: '26px', margin: '0 0 6px 0', color: '#0F172A' }}>
                    Tổng Quan: {shop.name}
                  </h1>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: 0, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <MapPin size={14} className="text-slate-400 flex-shrink-0" />
                    <span>{shop.address ? `${shop.address}, ` : ''}{shop.city || ''}</span>
                    {shop.phone && (
                      <>
                        <span className="text-muted">•</span>
                        <Phone size={14} className="text-slate-400 flex-shrink-0" />
                        <span>Hotline: {shop.phone}</span>
                      </>
                    )}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button className="btn-secondary d-inline-flex align-items-center gap-2" onClick={() => navigate('/branch/settings')}>
                    <Settings size={15} />
                    <span>Cài Đặt Cửa Hàng</span>
                  </button>
                  <button className="btn-primary d-inline-flex align-items-center gap-2" onClick={() => navigate('/branch/analytics')}>
                    <TrendingUp size={15} />
                    <span>Báo Cáo Doanh Thu</span>
                  </button>
                </div>
              </div>

              {/* Store Information Quick Card */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0',
                  padding: '20px 24px',
                  marginTop: '20px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <img
                    src={shop.imageUrl || shop.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(shop.name)}&background=0F172A&color=D97706&size=100`}
                    alt={shop.name}
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '12px',
                      objectFit: 'cover',
                      border: '1px solid #E2E8F0',
                      cursor: (shop.imageUrl || shop.avatarUrl) ? 'pointer' : 'default',
                    }}
                    onClick={() => {
                      const logoSrc = shop.imageUrl || shop.avatarUrl;
                      if (logoSrc) {
                        setLightboxImage({
                          url: logoSrc,
                          title: `${shop.name} — Logo Cửa Hàng (Kích Thước Thật)`,
                        });
                      }
                    }}
                    title={(shop.imageUrl || shop.avatarUrl) ? 'Bấm để xem ảnh logo chi tiết' : shop.name}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>{shop.name}</span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          background: shop.status === 'ACTIVE' ? '#ECFDF5' : '#FEF3C7',
                          color: shop.status === 'ACTIVE' ? '#059669' : '#D97706',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: shop.status === 'ACTIVE' ? '#10B981' : '#F59E0B' }} />
                        {shop.status === 'ACTIVE' ? 'Mở cửa đón khách' : 'Tạm ngưng hoạt động'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#475569', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <span className="d-inline-flex align-items-center gap-1">
                        <MapPin size={13} className="text-slate-400" />
                        {[shop.address, shop.ward, shop.city].filter(Boolean).join(', ') || 'Chưa cập nhật địa chỉ'}
                      </span>
                      <span className="d-inline-flex align-items-center gap-1">
                        <Phone size={13} className="text-slate-400" />
                        {shop.phone || 'Chưa có hotline'}
                      </span>
                      <span className="d-inline-flex align-items-center gap-1">
                        <Clock size={13} className="text-slate-400" />
                        {shop.openingHours || '09:00 - 21:30'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  className="btn-primary d-inline-flex align-items-center gap-2"
                  onClick={() => navigate('/branch/settings')}
                  style={{ fontSize: '12.5px', padding: '8px 18px', borderRadius: '8px', fontWeight: 600 }}
                >
                  <Store size={14} />
                  <span>Quản Lý Cửa Hàng Này</span>
                  <ExternalLink size={13} />
                </button>
              </div>

              {/* 4 Stat Cards */}
              <div className="stats-grid-4">
                <div className="stat-card-white" style={{ cursor: 'pointer' }} onClick={() => navigate('/branch/analytics')}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="stat-card-title">DOANH THU THUÊ & MUA</span>
                      <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>↗ +18.2%</span>
                    </div>
                    <div className="stat-card-value">295.000.000 đ</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '12px' }}>
                    Thuê: <strong>210.000.000đ</strong> | Mua: <strong>85.000.000đ</strong>
                  </div>
                </div>

                <div className="stat-card-white" style={{ cursor: 'pointer' }} onClick={() => navigate('/branch/rental-orders')}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="stat-card-title">ĐƠN THUÊ ĐANG XỬ LÝ</span>
                      <span style={{ fontSize: '10px', background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px' }}>+12 đơn mới</span>
                    </div>
                    <div className="stat-card-value">48 đơn</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '12px' }}>
                    Chờ duyệt: <strong style={{ color: '#D97706' }}>5</strong> | Đang giao: <strong>14</strong>
                  </div>
                </div>

                <div className="stat-card-white" style={{ cursor: 'pointer' }} onClick={() => navigate('/branch/returns')}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="stat-card-title">TIỀN CỌC PAYOS ESCROW</span>
                      <span style={{ fontSize: '10px', background: '#FEF3C7', color: '#D97706', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>AN TOÀN</span>
                    </div>
                    <div className="stat-card-value" style={{ color: 'var(--color-gold-deep)' }}>142.500.000 đ</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '12px' }}>
                    Đang giữ escrow cho 34 đơn thuê
                  </div>
                </div>

                <div className="stat-card-white">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="stat-card-title">CẢNH BÁO TỒN KHO</span>
                      <span style={{ fontSize: '10px', background: '#FEE2E2', color: '#DC2626', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>CẦN BỔ SUNG</span>
                    </div>
                    <div className="stat-card-value" style={{ color: '#DC2626' }}>3 Sản Phẩm</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '12px' }}>
                    Size S hết hàng ở 2 mẫu đầm hot
                  </div>
                </div>
              </div>

              {/* Table Section Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                  ⚡ CẦN XỬ LÝ GẤP TRONG NGÀY
                </h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['TẤT CẢ (08)', 'CHỜ DUYỆT (03)', 'ĐANG GIAO (02)', 'TRẢ HÀNG (02)', 'ĐƠN MUA (01)'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      style={{
                        border: 'none',
                        background: activeTab === tab ? '#171717' : '#F3F4F6',
                        color: activeTab === tab ? '#FFF' : '#4B5563',
                        padding: '6px 14px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orders Table */}
              <div style={{ background: '#FFF', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginTop: '16px', overflow: 'hidden' }}>
                <table className="shop-table">
                  <thead>
                    <tr>
                      <th>MÃ ĐƠN & TRANG PHỤC</th>
                      <th>KHÁCH HÀNG THUÊ</th>
                      <th>THỜI GIAN THUÊ</th>
                      <th>GIÁ THUÊ / CỌC</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC XỬ LÝ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((ord, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <img src={ord.image} alt="product" style={{ width: '40px', height: '52px', borderRadius: '6px', objectFit: 'cover' }} />
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--color-gold-deep)', fontWeight: 700 }}>{ord.id}</div>
                              <div style={{ fontSize: '13px', fontWeight: 700 }}>{ord.product}</div>
                              <div style={{ fontSize: '11px', color: '#6B7280' }}>{ord.detail}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px', color: '#171717', fontWeight: 600 }}>{ord.customer}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px', color: '#4B5563' }}>{ord.duration}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '13px', fontWeight: 700 }}>{ord.amount}</div>
                          <div style={{ fontSize: '10px', color: '#059669', fontWeight: 600 }}>✔ {ord.escrow}</div>
                        </td>
                        <td>
                          <span className={`status-tag status-${ord.statusType}`}>
                            {ord.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn-primary"
                            style={{ fontSize: '11px', padding: '6px 14px' }}
                            onClick={() => {
                              if (ord.statusType === 'return') navigate('/branch/returns');
                              else if (ord.statusType === 'pending') navigate('/branch/rental-orders');
                              else navigate('/branch/rental-orders');
                            }}
                          >
                            {ord.action}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Image Lightbox Modal */}
      <ImageLightboxModal
        show={Boolean(lightboxImage)}
        onHide={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url || (typeof lightboxImage === 'string' ? lightboxImage : '')}
        title={lightboxImage?.title || 'Xem Ảnh Kích Thước Thật'}
      />
    </div>
  );
}
