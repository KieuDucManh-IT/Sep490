import React, { useState } from 'react';
import { Modal, Button, Badge, Table } from 'react-bootstrap';
import AdminSidebar from '../../components/AdminSidebar';
import '../../styles/AdminDashboard.css';

export default function AdminAccountsPage() {
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
    },
    {
      id: 'USR-8823',
      name: 'Lê Tuấn Kiệt',
      email: 'kiet.letuan@gmail.com',
      role: 'CUSTOMER',
      rating: 'C- (35 pts - Báo cáo trả trễ)',
      kyc: 'Đang Chờ Xác Thực',
      status: 'WARNING',
      totalOrders: 2,
      totalDepositEscrow: '3.000.000 đ'
    }
  ]);

  const [selectedUserModal, setSelectedUserModal] = useState(null);

  const handleToggleLock = (id) => {
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
    <div className="admin-layout-container">
      {/* Reusable Admin Sidebar */}
      <AdminSidebar />

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', margin: 0 }}>
              Quản Lý Danh Sách & Uy Tín Tài Khoản Nguời Dùng
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>
              Theo dõi định danh KYC, điểm tín nhiệm hoàn cọc Escrow và xử lý khóa tài khoản vi phạm
            </p>
          </div>
        </header>

        {/* User Table Card */}
        <div className="admin-card" style={{ padding: 0, marginTop: '24px' }}>
          <Table responsive hover className="admin-table align-middle mb-0">
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
                  <td style={{ fontWeight: '700' }}>{u.id}</td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{u.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{u.email}</div>
                  </td>
                  <td>
                    <Badge bg={u.role === 'SHOP_OWNER' ? 'warning' : 'primary'} text={u.role === 'SHOP_OWNER' ? 'dark' : 'white'}>
                      {u.role}
                    </Badge>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{u.kyc}</td>
                  <td style={{ fontWeight: '600', color: '#059669' }}>{u.rating}</td>
                  <td>{u.totalOrders} đơn ({u.totalDepositEscrow})</td>
                  <td>
                    <Badge bg={u.status === 'ACTIVE' ? 'success' : u.status === 'LOCKED' ? 'danger' : 'warning'}>
                      {u.status === 'ACTIVE' ? 'Hoạt Động' : u.status === 'LOCKED' ? 'Đã Khóa' : 'Cảnh Báo'}
                    </Badge>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Button 
                        variant="outline-dark"
                        size="sm"
                        onClick={() => setSelectedUserModal(u)}
                      >
                        Chi Tiết
                      </Button>
                      <Button 
                        variant={u.status === 'LOCKED' ? 'success' : 'danger'}
                        size="sm"
                        onClick={() => handleToggleLock(u.id)}
                      >
                        {u.status === 'LOCKED' ? 'Mở Khóa' : 'Khóa'}
                      </Button>
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
          <Modal.Header closeButton style={{ borderBottom: '1px solid rgba(212,175,55,0.3)' }}>
            <Modal.Title style={{ fontFamily: "'Playfair Display', serif" }}>
              Chi Tiết Hồ Sơ Tài Khoản {selectedUserModal?.id}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {selectedUserModal && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
      </main>
    </div>
  );
}
