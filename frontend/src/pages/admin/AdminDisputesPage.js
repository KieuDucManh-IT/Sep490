import React, { useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/AdminDashboard.css';

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState([
    {
      id: 'DISP-7701',
      orderId: 'ORD-9825',
      reporter: 'Phạm Minh Tuyết (Khách Hàng)',
      respondent: 'VESTORA PRIVÉ Showroom Quận 1',
      reason: 'Tranh chấp khoản khấu trừ cọc PayOS Escrow 300.000 đ',
      details: 'Khách hàng cho rằng vết bẩn có sẵn từ trước khi nhận đồ. Shop có ảnh chụp kho trước khi đóng gói.',
      escrowAmount: '1.500.000 đ',
      status: 'UNDER_INVESTIGATION',
      submittedDate: '09/10/2026 13:20'
    },
    {
      id: 'DISP-7702',
      orderId: 'ORD-9810',
      reporter: 'Atelier Tailored Homme (Gian Hàng)',
      respondent: 'Lê Tuấn Kiệt (Khách Hàng)',
      reason: 'Khách hàng trả trang phục trễ 3 ngày không báo trước',
      details: 'Áp dụng phí quá hạn 200%/ngày theo hợp đồng điện tử VESTORA Privé.',
      escrowAmount: '2.500.000 đ',
      status: 'RESOLVED',
      submittedDate: '07/10/2026 09:10'
    }
  ]);

  const handleResolveDispute = (id, winner) => {
    setDisputes(prev => prev.map(d => {
      if (d.id === id) {
        return {
          ...d,
          status: 'RESOLVED',
          resolutionText: `Phán quyết Admin VESTORA: Nghiêng về ${winner}. Đã hoàn tất xử lý dòng tiền PayOS Escrow.`
        };
      }
      return d;
    }));
    alert(`Đã đưa ra phán quyết trọng tài VESTORA cho hồ sơ ${id}!`);
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
              Hội Đồng Trọng Tài Phán Quyết Khiếu Nại & Tiền Cọc Escrow
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>
              Giải quyết độc lập và công bằng các tranh chấp liên quan đến hư hỏng trang phục hoặc hoàn cọc
            </p>
          </div>
        </header>

        {/* Disputes List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
          {disputes.map(d => (
            <div key={d.id} className="admin-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '12px', marginBottom: '12px' }}>
                <div>
                  <strong style={{ fontSize: '1.1rem', color: '#171717' }}>Mã Tranh Chấp: {d.id}</strong>
                  <span style={{ marginLeft: '12px', fontSize: '0.85rem', color: '#725b38' }}>Link Đơn: {d.orderId}</span>
                </div>
                <span 
                  style={{ 
                    padding: '4px 12px', 
                    borderRadius: '12px', 
                    fontSize: '0.8rem', 
                    fontWeight: '700',
                    background: d.status === 'RESOLVED' ? '#dcfce7' : '#fef3c7',
                    color: d.status === 'RESOLVED' ? '#166534' : '#92400e'
                  }}
                >
                  {d.status === 'RESOLVED' ? 'Đã Giải Quyết' : 'Đang Điều Trợ / Thẩm Định'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '0.9rem', marginBottom: '14px' }}>
                <div>
                  <p><strong>Nguồn Báo Cáo:</strong> {d.reporter}</p>
                  <p><strong>Bên Liên Quan:</strong> {d.respondent}</p>
                  <p><strong>Giá Trị Tiền Cọc Giữ Escrow:</strong> <span style={{ color: '#d4af37', fontWeight: '700' }}>{d.escrowAmount}</span></p>
                </div>
                <div>
                  <p><strong>Lý Do Khiếu Nại:</strong> {d.reason}</p>
                  <p><strong>Ngày Khởi Tạo:</strong> {d.submittedDate}</p>
                </div>
              </div>

              <div style={{ background: '#f9fafb', padding: '14px', borderRadius: '6px', fontSize: '0.88rem', color: '#374151', marginBottom: '16px' }}>
                <strong>Tóm Tắt Bằng Chứng:</strong> {d.details}
              </div>

              {d.status !== 'RESOLVED' ? (
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn-vestora btn-vestora-primary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    onClick={() => handleResolveDispute(d.id, 'Khách Hàng (Hoàn Cọc 100%)')}
                  >
                    ⚖️ Xử Thắng Cho Khách Hàng
                  </button>
                  <button 
                    className="btn-vestora btn-vestora-secondary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    onClick={() => handleResolveDispute(d.id, 'Gian Hàng (Trừ Cọc Đã Duyệt)')}
                  >
                    ⚖️ Xử Thắng Cho Gian Hàng
                  </button>
                </div>
              ) : (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '6px', fontSize: '0.88rem', color: '#166534' }}>
                  {d.resolutionText}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

