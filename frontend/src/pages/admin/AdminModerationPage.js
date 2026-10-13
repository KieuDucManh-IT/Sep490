import React, { useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopHeader from '../../components/AdminTopHeader';
import '../../styles/AdminDashboard.css';

export default function AdminModerationPage() {
  const [activeTab, setActiveTab] = useState('SHOPS');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const pendingShops = [
    {
      id: 'REQ-SHOP-991',
      name: 'Showroom Maison de Silk Hanoi',
      owner: 'Nguyễn Bích Ngọc',
      taxCode: '0109887766',
      address: '24 Tràng Tiền, Hoàn Kiếm, Hà Nội',
      submittedDate: '08/10/2026',
      documents: 'GPKD_MaisonSilk.pdf, CCCD_Owner.pdf',
      status: 'PENDING'
    }
  ];

  const pendingProducts = [
    {
      id: 'REQ-PROD-402',
      shopName: 'VESTORA PRIVÉ LE THANH TON',
      productName: 'Đầm Dạ Hội Kim Tuyến Silk Gold Limited',
      category: 'Đầm Dạ Hội',
      rentalPrice: '1.200.000 đ / 3 ngày',
      retailValue: '35.000.000 đ',
      submittedDate: '09/10/2026',
      status: 'PENDING'
    }
  ];

  const handleApproveShop = (id) => {
    alert(`Đã phê duyệt đơn đăng ký gian hàng ${id}! Shop có thể bắt đầu niêm yết trang phục trên VESTORA Platform.`);
  };

  const handleApproveProduct = (id) => {
    alert(`Đã duyệt sản phẩm ${id} lên Sàn VESTORA Catalog!`);
  };

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
          breadcrumb="Kiểm Duyệt Sản Phẩm & Gian Hàng"
        />

        {/* 3. Content Body */}
        <div className="admin-content-body">
          {/* Page Hero */}
          <div className="admin-page-hero">
            <div>
              <h1 className="admin-page-title">Trung Tâm Kiểm Duyệt Gian Hàng & Trang Phục Mới</h1>
              <p className="admin-page-desc">
                Đảm bảo các gian hàng và sản phẩm Haute Couture tuân thủ đúng chuẩn mực chất lượng IFAB & VESTORA
              </p>
            </div>
          </div>

          {/* Tab Selection */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button 
              className={activeTab === 'SHOPS' ? 'btn-tail-gold' : 'btn-tail-outline'}
              onClick={() => setActiveTab('SHOPS')}
            >
              🏪 Duyệt Gian Hàng Mới Đăng Ký (1)
            </button>
            <button 
              className={activeTab === 'PRODUCTS' ? 'btn-tail-gold' : 'btn-tail-outline'}
              onClick={() => setActiveTab('PRODUCTS')}
            >
              👗 Duyệt Mẫu Trang Phục Thuê Mới (1)
            </button>
          </div>

          {activeTab === 'SHOPS' ? (
            <div className="admin-card-table-wrapper">
              <div className="tailadmin-table-container">
                <table className="tailadmin-table">
                  <thead>
                    <tr>
                      <th>Mã Đơn Đăng Ký</th>
                      <th>Tên Showroom Đăng Ký</th>
                      <th>Chủ Gian Hàng & MST</th>
                      <th>Địa Chỉ Showroom</th>
                      <th>Hồ Sơ Pháp Lý</th>
                      <th>Ngày Nộp</th>
                      <th>Hành Động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingShops.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 700, color: '#C5A880' }}>{s.id}</td>
                        <td style={{ fontWeight: 600, color: '#171717' }}>{s.name}</td>
                        <td>
                          <div>{s.owner}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>MST: {s.taxCode}</div>
                        </td>
                        <td style={{ fontSize: '12px' }}>{s.address}</td>
                        <td style={{ fontSize: '12px', color: '#2563EB', fontWeight: 500 }}>{s.documents}</td>
                        <td style={{ fontSize: '12px', color: '#64748B' }}>{s.submittedDate}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn-tail-gold"
                              style={{ padding: '6px 12px', fontSize: '11px' }}
                              onClick={() => handleApproveShop(s.id)}
                            >
                              Phê Duyệt
                            </button>
                            <button 
                              className="btn-tail-outline"
                              style={{ padding: '6px 12px', fontSize: '11px', color: '#EF4444', borderColor: '#FECACA' }}
                              onClick={() => alert(`Từ chối đơn ${s.id}`)}
                            >
                              Từ Chối
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="admin-card-table-wrapper">
              <div className="tailadmin-table-container">
                <table className="tailadmin-table">
                  <thead>
                    <tr>
                      <th>Mã Yêu Cầu</th>
                      <th>Gian Hàng Đăng</th>
                      <th>Tên Trang Phục</th>
                      <th>Phân Loại</th>
                      <th>Giá Niêm Yết & Thuê</th>
                      <th>Ngày Nộp</th>
                      <th>Hành Động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingProducts.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700, color: '#C5A880' }}>{p.id}</td>
                        <td style={{ fontWeight: 600, color: '#171717' }}>{p.shopName}</td>
                        <td style={{ fontWeight: 500 }}>{p.productName}</td>
                        <td>
                          <span className="status-pill renting">{p.category}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#171717' }}>{p.rentalPrice}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>Gốc: {p.retailValue}</div>
                        </td>
                        <td style={{ fontSize: '12px', color: '#64748B' }}>{p.submittedDate}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                              className="btn-tail-gold"
                              style={{ padding: '6px 12px', fontSize: '11px' }}
                              onClick={() => handleApproveProduct(p.id)}
                            >
                              Duyệt Đăng Sàn
                            </button>
                            <button 
                              className="btn-tail-outline"
                              style={{ padding: '6px 12px', fontSize: '11px', color: '#EF4444', borderColor: '#FECACA' }}
                              onClick={() => alert(`Yêu cầu sửa đổi mẫu ${p.id}`)}
                            >
                              Yêu Cầu Sửa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
