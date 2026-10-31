import React, { useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopHeader from '../../components/AdminTopHeader';
import '../../styles/AdminDashboard.css';

// UC-17: Review Internal Product Listings (Kiểm Duyệt Mẫu Trang Phục & Niêm Yết Nội Bộ)
export default function WarehouseModerationPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [pendingProducts, setPendingProducts] = useState([
    {
      id: 'REQ-PROD-402',
      branchName: 'VESTORA Showroom Lê Thánh Tôn (HCMC)',
      productName: 'Đầm Dạ Hội Kim Tuyến Silk Gold Limited',
      category: 'Đầm Dạ Hội',
      rentalPrice: '1.200.000 đ / 3 ngày',
      retailValue: '35.000.000 đ',
      depositRate: '70%',
      submittedDate: '09/10/2026',
      status: 'PENDING',
    },
    {
      id: 'REQ-PROD-405',
      branchName: 'VESTORA Flagship Tràng Tiền (Hà Nội)',
      productName: 'Bộ Tuxedo Nhung Midnight Velvet Tailored',
      category: 'Tuxedo & Suit',
      rentalPrice: '1.500.000 đ / 3 ngày',
      retailValue: '28.000.000 đ',
      depositRate: '70%',
      submittedDate: '12/10/2026',
      status: 'PENDING',
    },
    {
      id: 'REQ-PROD-398',
      branchName: 'VESTORA Tổng Kho Miền Nam',
      productName: 'Áo Dài Cách Tân Thêu Tay Hoàng Cung',
      category: 'Áo Dài',
      rentalPrice: '850.000 đ / 3 ngày',
      retailValue: '15.000.000 đ',
      depositRate: '60%',
      submittedDate: '05/10/2026',
      status: 'APPROVED',
    },
  ]);

  const handleApproveProduct = (id) => {
    setPendingProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, status: 'APPROVED' } : p))
    );
    alert(`Đã phê duyệt niêm yết mẫu trang phục ${id} lên VESTORA Catalog (UC-17)!`);
  };

  const handleRejectProduct = (id) => {
    const reason = prompt('Nhập lý do yêu cầu điều chỉnh mẫu trang phục:', 'Hình ảnh chưa đạt chuẩn chất lượng / Cần bổ sung thông số bảo quản');
    if (reason === null) return;
    setPendingProducts(prev =>
      prev.map(p => (p.id === id ? { ...p, status: 'REJECTED' } : p))
    );
    alert(`Đã gửi yêu cầu hiệu chỉnh mẫu ${id} tới bộ phận chuẩn bị sản phẩm.`);
  };

  const displayedProducts = pendingProducts.filter(p => {
    if (filterStatus === 'ALL') return true;
    return p.status === filterStatus;
  });

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
          breadcrumb="Kiểm Duyệt Sản Phẩm Nội Bộ (UC-17)"
        />

        {/* 3. Content Body */}
        <div className="admin-content-body">
          {/* Page Hero */}
          <div className="admin-page-hero">
            <div>
              <h1 className="admin-page-title">Kiểm Duyệt Mẫu Trang Phục & Niêm Yết Nội Bộ (UC-17)</h1>
              <p className="admin-page-desc">
                Thẩm định chất lượng hình ảnh, định mức giá cọc và quy chuẩn bảo quản trước khi kích hoạt hiển thị trên Catalog chuỗi VESTORA
              </p>
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button
              className={filterStatus === 'ALL' ? 'btn-tail-gold' : 'btn-tail-outline'}
              onClick={() => setFilterStatus('ALL')}
            >
              👗 Tất Cả ({pendingProducts.length})
            </button>
            <button
              className={filterStatus === 'PENDING' ? 'btn-tail-gold' : 'btn-tail-outline'}
              onClick={() => setFilterStatus('PENDING')}
            >
              ⏳ Chờ Duyệt ({pendingProducts.filter(p => p.status === 'PENDING').length})
            </button>
            <button
              className={filterStatus === 'APPROVED' ? 'btn-tail-gold' : 'btn-tail-outline'}
              onClick={() => setFilterStatus('APPROVED')}
            >
              ✓ Đã Phê Duyệt ({pendingProducts.filter(p => p.status === 'APPROVED').length})
            </button>
          </div>

          {/* Table Container */}
          <div className="admin-card-table-wrapper">
            <div className="tailadmin-table-container">
              <table className="tailadmin-table">
                <thead>
                  <tr>
                    <th>Mã Đề Xuất</th>
                    <th>Chi Nhánh / Kho Đề Xuất</th>
                    <th>Tên Trang Phục</th>
                    <th>Phân Loại</th>
                    <th>Giá Thuê & Giá Trị Gốc</th>
                    <th>Định Mức Cọc</th>
                    <th>Ngày Nộp</th>
                    <th>Trạng Thái</th>
                    <th style={{ textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedProducts.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                        Hiện không có mẫu trang phục nào trong danh mục này.
                      </td>
                    </tr>
                  ) : (
                    displayedProducts.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 700, color: '#C5A880' }}>{p.id}</td>
                        <td style={{ fontWeight: 600, color: '#171717' }}>{p.branchName}</td>
                        <td style={{ fontWeight: 500 }}>{p.productName}</td>
                        <td>
                          <span className="status-pill renting">{p.category}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#171717' }}>{p.rentalPrice}</div>
                          <div style={{ fontSize: '11px', color: '#94A3B8' }}>Gốc: {p.retailValue}</div>
                        </td>
                        <td style={{ fontWeight: 600, color: '#D97706' }}>{p.depositRate}</td>
                        <td style={{ fontSize: '12px', color: '#64748B' }}>{p.submittedDate}</td>
                        <td>
                          <span
                            className={`status-pill ${
                              p.status === 'APPROVED'
                                ? 'instock'
                                : p.status === 'REJECTED'
                                ? 'lowstock'
                                : 'pending'
                            }`}
                          >
                            {p.status === 'APPROVED'
                              ? 'ĐÃ DUYỆT'
                              : p.status === 'REJECTED'
                              ? 'TỪ CHỐI'
                              : 'CHỜ DUYỆT'}
                          </span>
                        </td>
                        <td>
                          {p.status === 'PENDING' ? (
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button
                                className="btn-tail-gold"
                                style={{ padding: '6px 12px', fontSize: '11px' }}
                                onClick={() => handleApproveProduct(p.id)}
                              >
                                Duyệt Niêm Yết
                              </button>
                              <button
                                className="btn-tail-outline"
                                style={{
                                  padding: '6px 12px',
                                  fontSize: '11px',
                                  color: '#EF4444',
                                  borderColor: '#FECACA',
                                }}
                                onClick={() => handleRejectProduct(p.id)}
                              >
                                Yêu Cầu Sửa
                              </button>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'right', fontSize: '12px', color: '#94A3B8' }}>
                              Hoàn tất thẩm định
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
