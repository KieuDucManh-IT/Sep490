import React, { useState } from 'react';
import BranchSidebar from '../../components/BranchSidebar';
import '../../styles/ShopDashboard.css';

export default function WarehouseInventoryPage() {
  const [stockItems, setStockItems] = useState([
    {
      id: 'SKU-VEST-001',
      name: 'Đầm Dạ Hội Haute Couture Rose Gold',
      category: 'Đầm Dạ Hội',
      totalQty: 10,
      rentedQty: 4,
      availableQty: 5,
      cleaningQty: 1,
      sizeStock: { S: 2, M: 4, L: 3, XL: 1 },
      status: 'AVAILABLE'
    },
    {
      id: 'SKU-VEST-002',
      name: 'Bộ Vest Nam Tailored Smoking Tuxedo',
      category: 'Vest Nam',
      totalQty: 6,
      rentedQty: 3,
      availableQty: 2,
      cleaningQty: 1,
      sizeStock: { S: 1, M: 2, L: 2, XL: 1 },
      status: 'LOW_STOCK'
    },
    {
      id: 'SKU-VEST-003',
      name: 'Áo Khoác Wool Privé Dáng Dài',
      category: 'Áo Khoác Luxury',
      totalQty: 4,
      rentedQty: 4,
      availableQty: 0,
      cleaningQty: 0,
      sizeStock: { S: 0, M: 2, L: 1, XL: 1 },
      status: 'OUT_OF_STOCK'
    }
  ]);

  const handleStockUpdate = (sku, size, delta) => {
    setStockItems(prev => prev.map(item => {
      if (item.id === sku) {
        const newSizeQty = Math.max(0, item.sizeStock[size] + delta);
        const newTotal = Object.values({ ...item.sizeStock, [size]: newSizeQty }).reduce((a, b) => a + b, 0);
        return {
          ...item,
          sizeStock: { ...item.sizeStock, [size]: newSizeQty },
          totalQty: newTotal,
          availableQty: Math.max(0, newTotal - item.rentedQty - item.cleaningQty)
        };
      }
      return item;
    }));
  };

  return (
    <div className="shop-dashboard-layout">
      {/* Sidebar */}
      <BranchSidebar />

      {/* Main Area */}
      <main className="shop-main-content">
        <header className="shop-header">
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', margin: 0 }}>
              Quản Lý Tồn Kho Theo Size & Trạng Thái Vệ Sinh
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>
              Kiểm soát chính xác số lượng đang cho thuê, kho sẵn sàng và quy trình hấp ủi giặt sấy
            </p>
          </div>
          <button 
            className="btn-vestora btn-vestora-primary"
            onClick={() => alert('Cập nhật kho nhanh thành công!')}
          >
            💾 Lưu Cập Nhật Kho
          </button>
        </header>

        {/* Metrics Grid */}
        <div className="shop-metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', margin: '20px 0' }}>
          <div className="metric-card">
            <span className="metric-title">Tổng Sản Phẩm Trong Kho</span>
            <span className="metric-value">20 Bộ</span>
          </div>
          <div className="metric-card">
            <span className="metric-title">Đang Cho Thuê (On Rent)</span>
            <span className="metric-value" style={{ color: '#d4af37' }}>11 Bộ</span>
          </div>
          <div className="metric-card">
            <span className="metric-title">Sẵn Sàng Cho Thuê (Available)</span>
            <span className="metric-value" style={{ color: '#059669' }}>7 Bộ</span>
          </div>
          <div className="metric-card">
            <span className="metric-title">Đang Giặt Sấy Spa (Cleaning)</span>
            <span className="metric-value" style={{ color: '#3b82f6' }}>2 Bộ</span>
          </div>
        </div>

        {/* Inventory List */}
        <div className="dashboard-card" style={{ padding: 0 }}>
          <table className="urgent-orders-table">
            <thead>
              <tr>
                <th>SKU / Sản Phẩm</th>
                <th>Phân Loại</th>
                <th>Size Breakdown (S / M / L / XL)</th>
                <th>Đang Cho Thuê</th>
                <th>Sẵn Sàng Giặt Sấy</th>
                <th>Sẵn Sàng Giao Khách</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {stockItems.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: '600' }}>
                    {item.name}
                    <div style={{ fontSize: '0.78rem', color: '#725b38' }}>{item.id}</div>
                  </td>
                  <td>{item.category}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {Object.entries(item.sizeStock).map(([size, count]) => (
                        <div 
                          key={size} 
                          style={{ 
                            background: '#f3f4f6', 
                            padding: '4px 8px', 
                            borderRadius: '4px', 
                            fontSize: '0.8rem',
                            display: 'flex',
                            gap: '4px'
                          }}
                        >
                          <span style={{ fontWeight: '700' }}>{size}:</span>
                          <span>{count}</span>
                          <button 
                            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#059669', fontWeight: 'bold' }}
                            onClick={() => handleStockUpdate(item.id, size, 1)}
                          >
                            +
                          </button>
                        </div>
                      ))}
                    </div>
                  </td>
                  <td style={{ fontWeight: '600', color: '#d4af37' }}>{item.rentedQty} bộ</td>
                  <td style={{ color: '#3b82f6' }}>{item.cleaningQty} bộ</td>
                  <td style={{ fontWeight: '700', color: '#059669' }}>{item.availableQty} bộ</td>
                  <td>
                    <button 
                      className="btn-vestora btn-vestora-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                      onClick={() => alert(`Cập nhật trạng thái kiểm kê cho ${item.name}`)}
                    >
                      Kiểm Kê Kho
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

