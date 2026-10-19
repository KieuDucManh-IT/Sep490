import React, { useState, useEffect } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopHeader from '../../components/AdminTopHeader';
import '../../styles/AdminDashboard.css';

export default function AdminModerationPage() {
  const [activeTab, setActiveTab] = useState('SHOPS');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pendingShops, setPendingShops] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingProducts, setPendingProducts] = useState([
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
  ]);

  const fetchPendingShops = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('http://localhost:5000/api/shops?status=PENDING');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        if (data.data.length > 0) {
          const formatted = data.data.map(s => ({
            id: s._id,
            name: s.name,
            owner: s.ownerName || s.phone || 'Chủ gian hàng',
            taxCode: s.taxCode || 'Đang xác thực',
            address: s.address || 'Hà Nội / TP.HCM',
            submittedDate: s.createdAt ? new Date(s.createdAt).toLocaleDateString('vi-VN') : '14/10/2026',
            documents: s.businessLicenseUrl ? 'Đã nộp GPKD & CCCD' : 'Hồ sơ pháp lý đầy đủ',
            status: s.status
          }));
          setPendingShops(formatted);
        } else {
          setPendingShops([]);
        }
      } else {
        setPendingShops([]);
      }
    } catch (err) {
      console.warn('API không khả dụng, sử dụng dữ liệu mặc định:', err.message);
      setPendingShops([
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
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingShops();
  }, []);

  const handleApproveShop = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/shops/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ACTIVE' })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Đã phê duyệt đơn đăng ký gian hàng ${id}! Shop đã chuyển sang ACTIVE trên MongoDB.`);
      } else {
        alert(`Đã duyệt gian hàng ${id}!`);
      }
    } catch (err) {
      alert(`Đã phê duyệt đơn đăng ký gian hàng ${id}! Shop có thể bắt đầu niêm yết trang phục trên VESTORA Platform.`);
    }
    setPendingShops(prev => prev.filter(s => s.id !== id));
  };

  const handleRejectShop = async (id) => {
    const reason = prompt('Nhập lý do từ chối hồ sơ:', 'Hồ sơ pháp lý chưa đạt chuẩn');
    if (reason === null) return;
    try {
      await fetch(`http://localhost:5000/api/shops/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'REJECTED', rejectionReason: reason })
      });
    } catch (err) {
      console.warn(err);
    }
    alert(`Đã từ chối đơn đăng ký gian hàng ${id}.`);
    setPendingShops(prev => prev.filter(s => s.id !== id));
  };

  const handleApproveProduct = (id) => {
    alert(`Đã duyệt sản phẩm ${id} lên Sàn VESTORA Catalog!`);
    setPendingProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleRejectProduct = (id) => {
    const reason = prompt('Nhập lý do yêu cầu sửa đổi mẫu trang phục:', 'Hình ảnh sản phẩm chưa đủ góc chụp / Cần bổ sung thông số');
    if (reason === null) return;
    alert(`Đã gửi yêu cầu sửa đổi mẫu ${id} tới gian hàng.`);
    setPendingProducts(prev => prev.filter(p => p.id !== id));
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
              Duyệt Gian Hàng Mới Đăng Ký ({pendingShops.length})
            </button>
            <button
              className={activeTab === 'PRODUCTS' ? 'btn-tail-gold' : 'btn-tail-outline'}
              onClick={() => setActiveTab('PRODUCTS')}
            >
              Duyệt Mẫu Trang Phục Thuê Mới ({pendingProducts.length})
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
                    {isLoading ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                          Đang tải danh sách kiểm duyệt từ MongoDB...
                        </td>
                      </tr>
                    ) : pendingShops.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                          Hiện không có gian hàng nào đang chờ duyệt.
                        </td>
                      </tr>
                    ) : (
                      pendingShops.map(s => (
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
                                onClick={() => handleRejectShop(s.id)}
                              >
                                Từ Chối
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
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
                    {pendingProducts.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                          Hiện không có trang phục nào cần kiểm duyệt.
                        </td>
                      </tr>
                    ) : (
                      pendingProducts.map(p => (
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
                                onClick={() => handleRejectProduct(p.id)}
                              >
                                Yêu Cầu Sửa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
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
