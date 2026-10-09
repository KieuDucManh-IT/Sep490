import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ShopSidebar from '../../components/ShopSidebar';
import '../../styles/ShopDashboard.css';

export default function ShopProductsPage() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('Tất cả (42)');

  const products = [
    {
      id: 'SKU-TL-101',
      title: 'Đầm Dạ Hội Lụa Satin Midnight Xếp Nếp',
      brand: 'Christian Dior Paris Archive',
      category: 'ĐẦM DẠ HỘI',
      price: '250.000 đ / ngày',
      deposit: 'Cọc Escrow: 700.000 đ',
      resale: 'Bán: 12.000.000 đ',
      variants: 'S (2), M (3), L (1) • Tổng: 6 chiếc khả dụng',
      status: 'Đang Hoạt Động',
      statusType: 'completed',
      image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=120&q=80',
    },
    {
      id: 'SKU-TL-105',
      title: 'Áo Khoác Tweed Dệt Thủ Công Nút Ngọc Trai',
      brand: 'Chanel Archive',
      category: 'ÁO KHOÁC TWEED',
      price: '220.000 đ / ngày',
      deposit: 'Cọc Escrow: 500.000 đ',
      resale: 'Bán: 6.200.000 đ',
      variants: 'S (1), M (2) • Tổng: 3 chiếc khả dụng',
      status: 'Đang Hoạt Động',
      statusType: 'completed',
      image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=120&q=80',
    },
    {
      id: 'SKU-TL-103',
      title: 'Bộ Suit Nữ Tuxedo Slim Fit Cắt May Định Hình',
      brand: 'Yves Saint Laurent',
      category: 'VEST & SUIT NỮ',
      price: '180.000 đ / ngày',
      deposit: 'Cọc Escrow: 800.000 đ',
      resale: 'Bán: 8.500.000 đ',
      variants: 'M (2), L (2) • Tổng: 4 bộ khả dụng',
      status: 'Đang Hoạt Động',
      statusType: 'completed',
      image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80',
    },
    {
      id: 'SKU-TL-108',
      title: 'Đầm Xếp Nếp Bất Đối Xứng Tơ Tằm Thượng Hạng',
      brand: 'Jacquemus',
      category: 'ĐẦM DẠ HỘI',
      price: '280.000 đ / ngày',
      deposit: 'Cọc Escrow: 600.000 đ',
      resale: 'Bán: 7.900.000 đ',
      variants: 'S (0), M (1) • Chi còn 1 chiếc',
      status: 'Tạm Hết Hàng',
      statusType: 'return',
      image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=120&q=80',
    },
    {
      id: 'SKU-TL-112',
      title: 'Túi Xách Mini Kelly Da Epsom Cổ Điển',
      brand: 'Hermès Archive',
      category: 'PHỤ KIỆN CAO CẤP',
      price: '350.000 đ / ngày',
      deposit: 'Cọc Escrow: 1.500.000 đ',
      resale: 'Không mở bán',
      variants: 'Gold Brown: 1 • Kho an toàn: 1 túi',
      status: 'Đang Hoạt Động',
      statusType: 'completed',
      image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=120&q=80',
    },
  ];

  return (
    <div className="shop-dashboard-layout">
      {/* Reusable Shop Sidebar */}
      <ShopSidebar />

      {/* Main Content Area */}
      <div className="shop-main-area">
        {/* Top Header */}
        <header className="shop-top-navbar">
          <div style={{ fontSize: '12px', color: '#6B7280' }}>
            Trang Chủ Shop &gt; <strong>Quản Lý Sản Phẩm</strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ fontSize: '11px', background: '#ECFDF5', color: '#059669', padding: '4px 12px', borderRadius: '9999px', fontWeight: 600 }}>
              ● ĐANG HOẠT ĐỘNG
            </span>
            <span style={{ fontSize: '18px', cursor: 'pointer' }}>🔔</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80"
                alt="Avatar"
                style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>Lê Bảo Trâm</div>
                <div style={{ fontSize: '10px', color: '#6B7280' }}>Chủ Gian Hàng</div>
              </div>
            </div>
          </div>
        </header>

        {/* Scroll Content */}
        <div className="shop-content-scroll">
          {/* Action Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '32px', margin: '0 0 4px 0' }}>
                Danh Sách Trang Phục Cho Thuê & Thanh Lý
              </h1>
              <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                Quản lý kho trang phục cho thuê, cấu hình cọc Escrow, cập nhật giá thanh lý và phân loại size.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" style={{ fontSize: '11px', padding: '8px 16px' }} onClick={() => navigate('/shop/pricing')}>
                🏷️ CẤU HÌNH BẢNG GIÁ THUÊ
              </button>
              <button className="btn-primary" style={{ fontSize: '11px', padding: '8px 16px' }} onClick={() => navigate('/shop/products/new')}>
                ➕ THÊM SẢN PHẨM MỚI
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['Tất cả (42)', 'Đầm dạ hội (18)', 'Vest & Suit (12)', 'Áo khoác (8)', 'Phụ kiện (4)'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    border: 'none',
                    background: activeCategory === cat ? '#171717' : '#F3F4F6',
                    color: activeCategory === cat ? '#FFF' : '#4B5563',
                    padding: '6px 14px',
                    borderRadius: '9999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="🔍 Tìm kiếm theo SKU, Tên sản phẩm, Thương hiệu..."
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px', width: '280px' }}
            />
          </div>

          {/* Table Products List */}
          <div style={{ background: '#FFF', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginTop: '16px', overflow: 'hidden' }}>
            <table className="shop-table">
              <thead>
                <tr>
                  <th>SẢN PHẨM & THƯƠNG HIỆU</th>
                  <th>PHÂN LOẠI</th>
                  <th>GIÁ THUÊ NICK / NGÀY</th>
                  <th>TIỀN CỌC ESCROW & BÁN</th>
                  <th>TỒN KHO THEO SIZE</th>
                  <th>TRẠNG THÁI</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, idx) => (
                  <tr key={idx}>
                    <td>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <img src={p.image} alt="product" style={{ width: '44px', height: '56px', borderRadius: '6px', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontSize: '10px', color: 'var(--color-gold-deep)', fontWeight: 700 }}>{p.id}</div>
                          <div style={{ fontSize: '13px', fontWeight: 700 }}>{p.title}</div>
                          <div style={{ fontSize: '11px', color: '#6B7280' }}>{p.brand}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', background: '#F3F4F6', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        {p.category}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#171717' }}>{p.price}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>✔ {p.deposit}</div>
                      <div style={{ fontSize: '11px', color: '#6B7280' }}>{p.resale}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', color: '#4B5563' }}>{p.variants}</div>
                    </td>
                    <td>
                      <span className={`status-tag status-${p.statusType}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button className="btn-secondary" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => navigate('/shop/inventory')}>
                          KHO
                        </button>
                        <button className="btn-primary" style={{ fontSize: '10px', padding: '4px 8px' }} onClick={() => navigate('/shop/pricing')}>
                          SỬA GIÁ
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
  );
}
