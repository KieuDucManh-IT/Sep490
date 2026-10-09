import React, { useState } from 'react';
import ShopSidebar from '../../components/ShopSidebar';
import '../../styles/ShopDashboard.css';

export default function ShopReturnsPage() {
  const [returns, setReturns] = useState([
    {
      id: 'RET-881',
      orderId: 'ORD-9823',
      customer: 'Trần Thị Thu Thảo',
      product: 'Đầm Dạ Hội Haute Couture Rose Gold',
      returnDate: '09/10/2026 10:00',
      escrowDeposit: '2.000.000 đ',
      conditionStatus: 'INTACT',
      conditionText: 'Hoàn Hảo (Không Trầy Xước / Ố Vàng)',
      deductionAmount: 0,
      notes: 'Khách trả hàng đúng hẹn, đầy đủ phụ kiện túi bụi & móc treo',
      refundStatus: 'PENDING_REFUND'
    },
    {
      id: 'RET-882',
      orderId: 'ORD-9825',
      customer: 'Phạm Minh Tuyết',
      product: 'Áo Khoác Dạ Dáng Dài Privé Wool',
      returnDate: '09/10/2026 11:30',
      escrowDeposit: '1.500.000 đ',
      conditionStatus: 'MINOR_DAMAGED',
      conditionText: 'Hư Hỏng Nhẹ (Vết Ố Nước Trái Cây Đuôi Váy)',
      deductionAmount: 300000,
      notes: 'Phí giặt tẩy vết bẩn cao cấp: 300.000 đ. Trừ từ khoản cọc PayOS Escrow',
      refundStatus: 'PARTIAL_REFUND_APPROVED'
    }
  ]);

  const handleApproveReturn = (id) => {
    setReturns(prev => prev.map(ret => {
      if (ret.id === id) {
        return {
          ...ret,
          refundStatus: 'ESCROW_RELEASED'
        };
      }
      return ret;
    }));
    alert(`Đã xác nhận trả hàng và giải ngân cọc PayOS Escrow cho đơn ${id}!`);
  };

  return (
    <div className="shop-dashboard-layout">
      {/* Sidebar */}
      <ShopSidebar />

      {/* Main Area */}
      <main className="shop-main-content">
        <header className="shop-header">
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', margin: 0 }}>
              Xác Nhận Trả Hàng & Đồng Bộ Hoàn Cọc PayOS Escrow
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>
              Kiểm tra tình trạng trang phục sau thuê và quyết định giải ngân/khấu trừ tiền cọc an toàn
            </p>
          </div>
        </header>

        {/* Returns Table Card */}
        <div className="dashboard-card" style={{ padding: 0, marginTop: '24px' }}>
          <table className="urgent-orders-table">
            <thead>
              <tr>
                <th>Mã Yêu Cầu</th>
                <th>Mã Đơn / Khách Hàng</th>
                <th>Sản Phẩm Trả Về</th>
                <th>Tiền Cọc Giữ PayOS</th>
                <th>Tình Trạng Thực Tế</th>
                <th>Phí Phạt / Khấu Trừ</th>
                <th>Trạng Thái Giải Ngân</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {returns.map(ret => (
                <tr key={ret.id}>
                  <td style={{ fontWeight: '700' }}>{ret.id}</td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{ret.customer}</div>
                    <div style={{ fontSize: '0.78rem', color: '#725b38' }}>{ret.orderId}</div>
                  </td>
                  <td>{ret.product}</td>
                  <td style={{ fontWeight: '700', color: '#d4af37' }}>{ret.escrowDeposit}</td>
                  <td>
                    <span 
                      style={{ 
                        display: 'inline-block',
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        background: ret.conditionStatus === 'INTACT' ? 'rgba(5,150,105,0.1)' : 'rgba(217,119,6,0.1)',
                        color: ret.conditionStatus === 'INTACT' ? '#059669' : '#d97706'
                      }}
                    >
                      {ret.conditionText}
                    </span>
                  </td>
                  <td style={{ color: ret.deductionAmount > 0 ? '#dc2626' : '#6b7280', fontWeight: '700' }}>
                    {ret.deductionAmount > 0 ? `-${ret.deductionAmount.toLocaleString('vi-VN')} đ` : '0 đ'}
                  </td>
                  <td>
                    {ret.refundStatus === 'ESCROW_RELEASED' ? (
                      <span className="status-badge completed">Đã Giải Ngân</span>
                    ) : (
                      <span className="status-badge deposited">Đang Giữ Escrow</span>
                    )}
                  </td>
                  <td>
                    {ret.refundStatus !== 'ESCROW_RELEASED' ? (
                      <button 
                        className="btn-vestora btn-vestora-primary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => handleApproveReturn(ret.id)}
                      >
                        ✅ Duyệt Giải Ngân Cọc
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: '600' }}>Hoàn Tất</span>
                    )}
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

