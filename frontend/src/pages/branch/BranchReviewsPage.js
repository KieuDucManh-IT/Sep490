import React, { useState } from 'react';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import '../../styles/ShopDashboard.css';

export default function BranchReviewsPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [reviews, setReviews] = useState([
    {
      id: 'REV-101',
      customer: 'Trần Thị Thu Thảo',
      rating: 5,
      date: '08/10/2026',
      product: 'Đầm Dạ Hội Haute Couture Rose Gold',
      content: 'Váy rất đẹp, chất vải lụa tơ tằm mềm mại đúng mô tả. Gian hàng hỗ trợ giao nhanh và tư vấn chuẩn size S qua AR Try-On!',
      reply: 'VESTORA PRIVÉ cảm ơn chị Thu Thảo đã tin tưởng dịch vụ thuê đầm Haute Couture của shop ạ!'
    },
    {
      id: 'REV-102',
      customer: 'Lê Hoàng Nam',
      rating: 5,
      date: '05/10/2026',
      product: 'Bộ Vest Nam Tailored Smoking Tuxedo',
      content: 'Vest lên form cực chuẩn, mới 99% thơm tho sạch sẽ. Khoản tiền cọc Escrow hoàn lại rất nhanh sau khi trả đồ!',
      reply: ''
    }
  ]);

  const [replyText, setReplyText] = useState({});

  const handleSendReply = (id) => {
    if (!replyText[id]) return;
    setReviews(prev => prev.map(r => r.id === id ? { ...r, reply: replyText[id] } : r));
    setReplyText(prev => ({ ...prev, [id]: '' }));
    alert('Đã gửi phản hồi đến khách hàng!');
  };

  return (
    <div className="shop-dashboard-layout">
      {/* Sidebar */}
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
          breadcrumb="Đánh Giá Khách Hàng"
        />

        {/* Main Area */}
        <main className="shop-main-content">
          <div className="admin-page-hero d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4 border-bottom">
            <div>
              <h1 className="admin-page-title" style={{ fontSize: '26px', margin: 0 }}>
                Đánh Giá Khách Hàng & Uy Tín Chi Nhánh
              </h1>
              <p className="admin-page-desc" style={{ color: '#64748B', fontSize: '13px', marginTop: '4px', margin: 0 }}>
                Điểm Đánh Giá Trung Bình: <strong style={{ color: '#d4af37' }}>4.95 / 5.0 ⭐ (128 Nhận Xét)</strong>
              </p>
            </div>
          </div>

        {/* Reviews List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
          {reviews.map(rev => (
            <div key={rev.id} className="dashboard-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <strong style={{ fontSize: '1rem' }}>{rev.customer}</strong>
                  <span style={{ color: '#d4af37', marginLeft: '12px' }}>
                    {'⭐'.repeat(rev.rating)} ({rev.rating}/5)
                  </span>
                </div>
                <span style={{ color: '#6b7280', fontSize: '0.82rem' }}>{rev.date}</span>
              </div>

              <div style={{ fontSize: '0.85rem', color: '#725b38', fontWeight: '600', marginBottom: '10px' }}>
                Trang Phục Thuê: {rev.product}
              </div>

              <p style={{ color: '#374151', fontSize: '0.92rem', background: '#f9fafb', padding: '12px', borderRadius: '6px', margin: 0 }}>
                "{rev.content}"
              </p>

              {rev.reply ? (
                <div style={{ marginTop: '12px', background: '#fef3c7', borderLeft: '4px solid #d4af37', padding: '10px 14px', borderRadius: '4px' }}>
                  <strong style={{ fontSize: '0.82rem', color: '#78350f' }}>Phản Hồi Từ Shop:</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: '#92400e' }}>{rev.reply}</p>
                </div>
              ) : (
                <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                  <input 
                    type="text"
                    placeholder="Viết phản hồi trân trọng từ gian hàng..."
                    value={replyText[rev.id] || ''}
                    onChange={(e) => setReplyText({ ...replyText, [rev.id]: e.target.value })}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db' }}
                  />
                  <button 
                    className="btn-vestora btn-vestora-primary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    onClick={() => handleSendReply(rev.id)}
                  >
                    Gửi Phản Hồi
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
      </div>
    </div>
  );
}

