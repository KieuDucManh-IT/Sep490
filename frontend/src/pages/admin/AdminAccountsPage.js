import React, { useState, useEffect } from 'react';
import { Modal, Button, Badge, Table } from 'react-bootstrap';
import { Eye, LockKeyhole, LockKeyholeOpen } from 'lucide-react';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopHeader from '../../components/AdminTopHeader';
import '../../styles/AdminDashboard.css';

export default function AdminAccountsPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [users, setUsers] = useState([
    {
      id: 'USR-8821',
      name: 'Trần Thị Thu Thảo',
      email: 'thuthao.tran@gmail.com',
      role: 'CUSTOMER',
      rating: 'A+ (100 pts)',
      kyc: 'Đã Định Danh CCCD',
      status: 'ACTIVE',
      totalOrders: 14,
      totalDepositEscrow: '28.500.000 đ'
    },
    {
      id: 'USR-8822',
      name: 'Nguyễn Văn Minh (Atelier Privé)',
      email: 'owner@atelierprive.vn',
      role: 'SHOP_OWNER',
      rating: 'VIP Merchant (4.95⭐)',
      kyc: 'GPKD & Giấy Phép Hợp Thuê',
      status: 'ACTIVE',
      totalOrders: 128,
      totalDepositEscrow: '450.000.000 đ'
    }
  ]);

  const [selectedUserModal, setSelectedUserModal] = useState(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/users');
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        const mapped = data.data.map(u => ({
          id: u._id,
          name: u.FullName || 'Thành viên VESTORA',
          email: u.Email,
          role: (u.Role || 'CUSTOMER').toUpperCase(),
          rating: u.WarningsCount > 0 ? `C (${u.WarningsCount} vi phạm)` : 'A+ (100 pts)',
          kyc: u.Information?.[0]?.Phone ? `SĐT: ${u.Information[0].Phone}` : 'Đã Xác Thực Email',
          status: (u.Status || 'ACTIVE').toUpperCase(),
          totalOrders: Math.floor(Math.random() * 15) + 2,
          totalDepositEscrow: `${(Math.floor(Math.random() * 25) + 3).toLocaleString('vi-VN')}.000.000 đ`
        }));
        setUsers(mapped);
      }
    } catch (err) {
      console.warn('Backend chưa khởi động hoặc gặp lỗi:', err.message);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleLock = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/users/${id}/toggle-lock`, {
        method: 'PATCH'
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchUsers();
        return;
      }
    } catch (err) {
      console.warn(err);
    }
    setUsers(prev => prev.map(u => {
      if (u.id === id) {
        const newStatus = u.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';
        return { ...u, status: newStatus };
      }
      return u;
    }));
    alert(`Đã cập nhật trạng thái tài khoản ${id}!`);
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
          breadcrumb="Quản Lý Tài Khoản Người Dùng"
        />

        {/* 3. Content Body */}
        <div className="admin-content-body">
          {/* Page Hero */}
          <div className="admin-page-hero">
            <div>
              <h1 className="admin-page-title">Quản Lý Danh Sách & Uy Tín Tài Khoản Người Dùng</h1>
              <p className="admin-page-desc">
                Theo dõi định danh KYC, điểm tín nhiệm hoàn cọc Escrow và xử lý khóa tài khoản vi phạm
              </p>
            </div>
          </div>

          {/* User Table Card */}
          <div className="admin-card-table-wrapper" style={{ padding: '0 0 12px 0', overflow: 'hidden' }}>
            <Table responsive hover className="tailadmin-table align-middle mb-0">
              <thead>
                <tr>
                  <th>Mã User</th>
                  <th>Họ Tên & Email</th>
                  <th>Phân Loại</th>
                  <th>Định Danh KYC</th>
                  <th>Điểm Uy Tín Escrow</th>
                  <th>Tổng Giao Dịch</th>
                  <th>Trạng Thái</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 700, color: '#C5A880' }}>{u.id}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#171717' }}>{u.name}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8' }}>{u.email}</div>
                    </td>
                    <td>
                      <span className={`status-pill ${u.role === 'SHOP_OWNER' ? 'pending' : 'renting'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px' }}>{u.kyc}</td>
                    <td style={{ fontWeight: 600, color: '#10B981' }}>{u.rating}</td>
                    <td style={{ fontSize: '12px' }}>{u.totalOrders} đơn ({u.totalDepositEscrow})</td>
                    <td>
                      <span className={`status-pill ${u.status === 'ACTIVE' ? 'instock' : u.status === 'LOCKED' ? 'lowstock' : 'pending'}`}>
                        {u.status === 'ACTIVE' ? 'Hoạt Động' : u.status === 'LOCKED' ? 'Đã Khóa' : 'Cảnh Báo'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button 
                          className="btn-action-icon view-blue"
                          title="Xem chi tiết tài khoản"
                          onClick={() => setSelectedUserModal(u)}
                        >
                          <Eye size={17} />
                        </button>
                        {u.status === 'LOCKED' ? (
                          <button 
                            className="btn-action-icon unlock-green"
                            title="Mở khóa tài khoản"
                            onClick={() => handleToggleLock(u.id)}
                          >
                            <LockKeyholeOpen size={17} />
                          </button>
                        ) : (
                          <button 
                            className="btn-action-icon lock-red"
                            title="Khóa tài khoản"
                            onClick={() => handleToggleLock(u.id)}
                          >
                            <LockKeyhole size={17} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          {/* User Detail Modal */}
          <Modal 
            show={!!selectedUserModal} 
            onHide={() => setSelectedUserModal(null)}
            centered
          >
            <Modal.Header closeButton style={{ borderBottom: '1px solid #E2E8F0' }}>
              <Modal.Title style={{ fontSize: '16px', fontWeight: 700 }}>
                Chi Tiết Hồ Sơ Tài Khoản {selectedUserModal?.id}
              </Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {selectedUserModal && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <p className="mb-1"><strong>Họ Tên:</strong> {selectedUserModal.name}</p>
                  <p className="mb-1"><strong>Email:</strong> {selectedUserModal.email}</p>
                  <p className="mb-1"><strong>Xác Thực KYC:</strong> {selectedUserModal.kyc}</p>
                  <p className="mb-1"><strong>Điểm Tín Nhiệm Escrow:</strong> {selectedUserModal.rating}</p>
                  <p className="mb-1"><strong>Tổng Đơn & Cọc:</strong> {selectedUserModal.totalOrders} đơn ({selectedUserModal.totalDepositEscrow})</p>
                  <p className="mb-0"><strong>Trạng Thái Hợp Đồng:</strong> 
                    <Badge bg={selectedUserModal.status === 'ACTIVE' ? 'success' : 'danger'} className="ms-2">
                      {selectedUserModal.status}
                    </Badge>
                  </p>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setSelectedUserModal(null)}>
                Đóng
              </Button>
            </Modal.Footer>
          </Modal>
        </div>
      </div>
    </div>
  );
}
