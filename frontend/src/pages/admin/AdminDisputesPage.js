import React, { useState } from 'react';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopHeader from '../../components/AdminTopHeader';
import '../../styles/AdminDashboard.css';

export default function AdminDisputesPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [disputes, setDisputes] = useState([
    {
      id: 'DISP-2026-089',
      orderId: '#VES-8891',
      reporter: 'Nguyễn Văn Minh (Khách thuê)',
      respondent: 'Atelier Privé Le Thanh Ton (Showroom)',
      escrowAmount: '3.500.000 đ',
      reason: 'Showroom trừ cọc do rách gấu váy lụa, khách khiếu nại lỗi có từ trước',
      submittedDate: '07/10/2026',
      status: 'INVESTIGATING',
      details: 'Khách hàng đã tải lên video unbox khi nhận đồ có vết xước ren gấu váy. Showroom phản bác váy khi xuất kho kiểm định đạt điểm 10/10.',
    },
    {
      id: 'DISP-2026-088',
      orderId: '#VES-8842',
      reporter: 'Mây Fashion Atelier (Showroom)',
      respondent: 'Trần Thuỳ Dung (Khách thuê)',
      escrowAmount: '12.000.000 đ',
      reason: 'Khách hàng làm mất áo khoác lông đính kèm đầm Haute Couture',
      submittedDate: '05/10/2026',
      status: 'RESOLVED',
      resolutionText: 'Đã xử phạt trừ 100% tiền cọc 12.000.000 đ chuyển cho Showroom theo điều khoản bồi thường hợp đồng PayOS Escrow.',
    }
  ]);

  const handleResolveDispute = (id, winnerText) => {
    setDisputes(prev => prev.map(d => {
      if (d.id === id) {
        return {
          ...d,
          status: 'RESOLVED',
          resolutionText: `Hội đồng Admin VESTORA đã phán quyết thắng cho ${winnerText}. Lệnh chuyển tiền PayOS Escrow đã thực thi tự động.`
        };
      }
      return d;
    }));
    alert(`Đã đưa ra phán quyết trọng tài VESTORA cho hồ sơ ${id}!`);
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
          breadcrumb="Trọng Tài PayOS Escrow"
        />

        {/* 3. Content Body */}
        <div className="admin-content-body">
          {/* Page Hero */}
          <div className="admin-page-hero">
            <div>
              <h1 className="admin-page-title">Hội Đồng Trọng Tài Phán Quyết Khiếu Nại & Tiền Cọc Escrow</h1>
              <p className="admin-page-desc">
                Giải quyết độc lập và công bằng các tranh chấp liên quan đến hư hỏng trang phục hoặc hoàn cọc
              </p>
            </div>
          </div>

          {/* Disputes List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {disputes.map(d => (
              <div key={d.id} className="admin-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E2E8F0', paddingBottom: '14px', marginBottom: '14px' }}>
                  <div>
                    <strong style={{ fontSize: '15px', color: '#171717' }}>Mã Tranh Chấp: {d.id}</strong>
                    <span style={{ marginLeft: '12px', fontSize: '12px', color: '#C5A880', fontWeight: 600 }}>Link Đơn: {d.orderId}</span>
                  </div>
                  <span className={`status-pill ${d.status === 'RESOLVED' ? 'instock' : 'pending'}`}>
                    {d.status === 'RESOLVED' ? 'Đã Giải Quyết' : 'Đang Thẩm Định'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', fontSize: '13px', marginBottom: '14px' }}>
                  <div>
                    <p style={{ margin: '0 0 6px 0' }}><strong>Nguồn Báo Cáo:</strong> {d.reporter}</p>
                    <p style={{ margin: '0 0 6px 0' }}><strong>Bên Liên Quan:</strong> {d.respondent}</p>
                    <p style={{ margin: '0' }}><strong>Giá Trị Tiền Cọc Giữ Escrow:</strong> <span style={{ color: '#C5A880', fontWeight: 700 }}>{d.escrowAmount}</span></p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 6px 0' }}><strong>Lý Do Khiếu Nại:</strong> {d.reason}</p>
                    <p style={{ margin: '0' }}><strong>Ngày Khởi Tạo:</strong> {d.submittedDate}</p>
                  </div>
                </div>

                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 16px', borderRadius: '8px', fontSize: '12px', color: '#475569', marginBottom: '16px' }}>
                  <strong>Tóm Tắt Bằng Chứng:</strong> {d.details}
                </div>

                {d.status !== 'RESOLVED' ? (
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn-tail-gold"
                      style={{ padding: '8px 16px', fontSize: '12px' }}
                      onClick={() => handleResolveDispute(d.id, 'Khách Hàng (Hoàn Cọc 100%)')}
                    >
                      Xử Thắng Cho Khách Hàng
                    </button>
                    <button 
                      className="btn-tail-outline"
                      style={{ padding: '8px 16px', fontSize: '12px' }}
                      onClick={() => handleResolveDispute(d.id, 'Gian Hàng (Trừ Cọc Đã Duyệt)')}
                    >
                      Xử Thắng Cho Gian Hàng
                    </button>
                  </div>
                ) : (
                  <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: '#065F46' }}>
                    {d.resolutionText}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
