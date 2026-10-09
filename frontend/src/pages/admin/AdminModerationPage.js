import React, { useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/AdminDashboard.css';

export default function AdminModerationPage() {
  const [activeTab, setActiveTab] = useState('SHOPS');

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
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', margin: 0 }}>
              Trung Tâm Kiểm Duyệt Gian Hàng & Trang Phục Mới
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>
              Đảm bảo các gian hàng và sản phẩm Haute Couture tuân thủ đúng chuẩn mực chất lượng IFAB & VESTORA
            </p>
          </div>
        </header>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '12px', margin: '24px 0 16px' }}>
          <button 
            className={`btn-vestora ${activeTab === 'SHOPS' ? 'btn-vestora-primary' : 'btn-vestora-secondary'}`}
            onClick={() => setActiveTab('SHOPS')}
          >
            🏪 Duyệt Gian Hàng Mới Đăng Ký (1)
          </button>
          <button 
            className={`btn-vestora ${activeTab === 'PRODUCTS' ? 'btn-vestora-primary' : 'btn-vestora-secondary'}`}
            onClick={() => setActiveTab('PRODUCTS')}
          >
            👗 Duyệt Mẫu Trang Phục Thuê Mới (1)
          </button>
        </div>

        {activeTab === 'SHOPS' ? (
          <div className="admin-card" style={{ padding: 0 }}>
            <table className="admin-table">
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
                    <td style={{ fontWeight: '700' }}>{s.id}</td>
                    <td style={{ fontWeight: '600' }}>{s.name}</td>
                    <td>
                      <div>{s.owner}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>MST: {s.taxCode}</div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{s.address}</td>
                    <td style={{ fontSize: '0.8rem', color: '#2563eb' }}>{s.documents}</td>
                    <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>{s.submittedDate}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn-vestora btn-vestora-primary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => handleApproveShop(s.id)}
                        >
                          ✅ Phê Duyệt Mở Shop
                        </button>
                        <button 
                          className="btn-vestora"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#dc2626', color: '#fff' }}
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
        ) : (
          <div className="admin-card" style={{ padding: 0 }}>
            <table className="admin-table">
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
                    <td style={{ fontWeight: '700' }}>{p.id}</td>
                    <td style={{ fontWeight: '600' }}>{p.shopName}</td>
                    <td>{p.productName}</td>
                    <td>{p.category}</td>
                    <td>
                      <div style={{ fontWeight: '700', color: '#d4af37' }}>{p.rentalPrice}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Gốc: {p.retailValue}</div>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>{p.submittedDate}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn-vestora btn-vestora-primary"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                          onClick={() => handleApproveProduct(p.id)}
                        >
                          ✅ Duyệt Đăng Sàn
                        </button>
                        <button 
                          className="btn-vestora"
                          style={{ padding: '6px 12px', fontSize: '0.8rem', background: '#dc2626', color: '#fff' }}
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
        )}
      </main>
    </div>
  );
}

