import React, { useState } from 'react';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import '../../styles/ShopDashboard.css';

export default function BranchSaleOrdersPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const saleOrders = [
    {
      id: 'ORD-SALE-9941',
      customer: 'Trần Thị Thu Thảo',
      phone: '0912 345 678',
      product: 'Đầm Dạ Hội Haute Couture Rose Gold',
      productCode: 'PROD-001',
      price: '4.800.000 đ',
      paymentMethod: 'PayOS Chuyển Khoản (Đã Thanh Toán)',
      status: 'SHIPPED',
      statusText: 'Đã Giao Vận Chuyển',
      date: '08/10/2026 14:30',
      address: '72 Lê Thánh Tôn, Quận 1, TP.HCM'
    },
    {
      id: 'ORD-SALE-9942',
      customer: 'Lê Hoàng Nam',
      phone: '0988 765 432',
      product: 'Bộ Vest Nam Tailored Smoking Tuxedo',
      productCode: 'PROD-004',
      price: '3.500.000 đ',
      paymentMethod: 'PayOS Ví QR',
      status: 'PROCESSING',
      statusText: 'Đang Đóng Gói',
      date: '09/10/2026 09:15',
      address: '88 Nguyễn Huệ, Quận 1, TP.HCM'
    },
    {
      id: 'ORD-SALE-9943',
      customer: 'Phạm Minh Tuyết',
      phone: '0903 112 233',
      product: 'Áo Khoác Dạ Dáng Dài Privé Wool',
      productCode: 'PROD-008',
      price: '2.900.000 đ',
      paymentMethod: 'Thẻ Quốc Tế (Visa/Mastercard)',
      status: 'DELIVERED',
      statusText: 'Giao Hàng Thành Công',
      date: '05/10/2026 16:45',
      address: '15 Thảo Điền, Thành phố Thủ Đức, TP.HCM'
    }
  ];

  const filteredOrders = saleOrders.filter(order => {
    if (activeTab !== 'ALL' && order.status !== activeTab) return false;
    if (searchQuery && !order.id.toLowerCase().includes(searchQuery.toLowerCase()) && !order.customer.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

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
          breadcrumb="Đơn Bán Đứt"
        />

        {/* Main Content Area */}
        <main className="shop-main-content">
          <div className="admin-page-hero d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4 border-bottom">
            <div>
              <h1 className="admin-page-title" style={{ fontSize: '26px', margin: 0 }}>
                Quản Lý Đơn Mua Thanh Lý & Bán Thẳng
              </h1>
              <p className="admin-page-desc" style={{ color: '#64748B', fontSize: '13px', marginTop: '4px', margin: 0 }}>
                Theo dõi và xác nhận các đơn hàng bán đứt sản phẩm Haute Couture từ khách hàng
              </p>
            </div>
            <button
              onClick={() => alert('Xuất danh sách đơn bán file Excel!')}
              className="btn-vestora btn-vestora-outline"
              style={{ fontSize: '0.85rem' }}
            >
              📥 Xuất Báo Cáo Excel
            </button>
          </div>

        {/* Filter Tabs & Search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0 16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { key: 'ALL', label: 'Tất Cả Đơn Bán' },
              { key: 'PROCESSING', label: 'Cần Đóng Gói (1)' },
              { key: 'SHIPPED', label: 'Đang Giao Vận (1)' },
              { key: 'DELIVERED', label: 'Đã Giao Thành Công (1)' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`btn-vestora ${activeTab === tab.key ? 'btn-vestora-primary' : 'btn-vestora-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input 
            type="text"
            placeholder="Tìm theo Mã đơn, Tên khách..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #d1d5db', width: '260px' }}
          />
        </div>

        {/* Orders Table Card */}
        <div className="dashboard-card" style={{ padding: 0 }}>
          <table className="urgent-orders-table">
            <thead>
              <tr>
                <th>Mã Đơn Bán</th>
                <th>Sản Phẩm Thanh Lý</th>
                <th>Khách Hàng & Địa Chỉ</th>
                <th>Giá Bán Đứt</th>
                <th>Hình Thức Thanh Toán</th>
                <th>Trạng Thái</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => (
                <tr key={order.id}>
                  <td style={{ fontWeight: '700', color: '#171717' }}>
                    {order.id}
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '400' }}>{order.date}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{order.product}</div>
                    <div style={{ fontSize: '0.78rem', color: '#725b38' }}>{order.productCode}</div>
                  </td>
                  <td>
                    <div>{order.customer} ({order.phone})</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{order.address}</div>
                  </td>
                  <td style={{ fontWeight: '700', color: '#059669' }}>{order.price}</td>
                  <td style={{ fontSize: '0.85rem' }}>{order.paymentMethod}</td>
                  <td>
                    <span className={`status-badge ${order.status.toLowerCase()}`}>
                      {order.statusText}
                    </span>
                  </td>
                  <td>
                    <button 
                      className="btn-vestora btn-vestora-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      onClick={() => alert(`Chi tiết đơn hàng ${order.id}`)}
                    >
                      Chi Tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      </div>
    </div>
  );
}

