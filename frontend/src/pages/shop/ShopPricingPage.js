import React, { useState } from 'react';
import ShopSidebar from '../../components/ShopSidebar';
import '../../styles/ShopDashboard.css';

export default function ShopPricingPage() {
  const [pricingRules] = useState([
    {
      id: 'PR-01',
      category: 'Đầm Dạ Hội Haute Couture',
      retailValue: '25.000.000 đ',
      rental3Days: '850.000 đ',
      rental5Days: '1.250.000 đ',
      rental7Days: '1.600.000 đ',
      resalePrice: '12.500.000 đ',
      escrowDeposit: '2.000.000 đ'
    },
    {
      id: 'PR-02',
      category: 'Vest Nam Bespoke Tuxedo',
      retailValue: '18.000.000 đ',
      rental3Days: '650.000 đ',
      rental5Days: '950.000 đ',
      rental7Days: '1.200.000 đ',
      resalePrice: '8.800.000 đ',
      escrowDeposit: '1.500.000 đ'
    },
    {
      id: 'PR-03',
      category: 'Áo Khoác Privé Măng Tô Wool',
      retailValue: '15.000.000 đ',
      rental3Days: '550.000 đ',
      rental5Days: '800.000 đ',
      rental7Days: '1.050.000 đ',
      resalePrice: '6.900.000 đ',
      escrowDeposit: '1.200.000 đ'
    }
  ]);

  return (
    <div className="shop-dashboard-layout">
      {/* Sidebar */}
      <ShopSidebar />

      {/* Main Area */}
      <main className="shop-main-content">
        <header className="shop-header">
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', margin: 0 }}>
              Cấu Hình Bảng Giá Thuê Nhanh & Giá Thanh Lý
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>
              Tự động hóa công thức tính giá thuê theo gói 3 ngày / 5 ngày / 7 ngày và mức cọc PayOS Escrow
            </p>
          </div>
          <button 
            className="btn-vestora btn-vestora-primary"
            onClick={() => alert('Cập nhật bảng giá toàn gian hàng thành công!')}
          >
            💾 Cập Nhật Bảng Giá
          </button>
        </header>

        {/* Pricing Table Card */}
        <div className="dashboard-card" style={{ padding: 0, marginTop: '24px' }}>
          <table className="urgent-orders-table">
            <thead>
              <tr>
                <th>Mã Quy Tắc</th>
                <th>Phân Loại Sản Phẩm</th>
                <th>Giá Trị Niêm Yết</th>
                <th>Thuê 3 Ngày</th>
                <th>Thuê 5 Ngày (-15%)</th>
                <th>Thuê 7 Ngày (-25%)</th>
                <th>Mức Cọc PayOS Escrow</th>
                <th>Giá Bán Thanh Lý</th>
              </tr>
            </thead>
            <tbody>
              {pricingRules.map(rule => (
                <tr key={rule.id}>
                  <td style={{ fontWeight: '700' }}>{rule.id}</td>
                  <td style={{ fontWeight: '600' }}>{rule.category}</td>
                  <td style={{ textDecoration: 'line-through', color: '#6b7280' }}>{rule.retailValue}</td>
                  <td style={{ fontWeight: '700', color: '#171717' }}>{rule.rental3Days}</td>
                  <td style={{ fontWeight: '600', color: '#725b38' }}>{rule.rental5Days}</td>
                  <td style={{ fontWeight: '600', color: '#725b38' }}>{rule.rental7Days}</td>
                  <td style={{ fontWeight: '700', color: '#d4af37' }}>{rule.escrowDeposit}</td>
                  <td style={{ fontWeight: '700', color: '#059669' }}>{rule.resalePrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

