import React, { useState } from 'react';
import { Row, Col, Card, Badge, Button, Form, Table, Modal } from 'react-bootstrap';
import ShopSidebar from '../../components/ShopSidebar';
import '../../styles/ShopDashboard.css';

export default function ShopBranchesPage() {
  const [branches, setBranches] = useState([
    {
      id: 'BR-01',
      name: 'VESTORA PRIVÉ Showroom Lê Thánh Tôn',
      address: '72 Lê Thánh Tôn, Bến Nghé, Quận 1, TP.HCM',
      gpsCoords: '10.7769° N, 106.7009° E',
      phone: '028 3822 9999',
      manager: 'Lê Bảo Trâm',
      status: 'ACTIVE',
      isRadarEnabled: true,
      openHours: '09:00 - 21:30'
    },
    {
      id: 'BR-02',
      name: 'VESTORA Atelier Thảo Điền (Khu Vực Scan 3D)',
      address: '15 Thảo Điền, Thành Phố Thủ Đức, TP.HCM',
      gpsCoords: '10.8031° N, 106.7348° E',
      phone: '028 3822 8888',
      manager: 'Nguyễn Bích Ngọc',
      status: 'ACTIVE',
      isRadarEnabled: true,
      openHours: '10:00 - 20:30'
    }
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newBranch, setNewBranch] = useState({
    name: '',
    address: '',
    phone: '',
    manager: '',
    openHours: '09:00 - 21:00'
  });

  const handleAddBranch = () => {
    if (!newBranch.name || !newBranch.address) return;
    setBranches(prev => [
      ...prev,
      {
        id: `BR-0${prev.length + 1}`,
        ...newBranch,
        gpsCoords: '10.7700° N, 106.6900° E',
        status: 'ACTIVE',
        isRadarEnabled: true
      }
    ]);
    setShowAddModal(false);
    alert('Đã thêm chi nhánh Showroom mới vào mạng lưới định vị VESTORA Radar Maps!');
  };

  return (
    <div className="shop-dashboard-layout">
      {/* Sidebar Navigation */}
      <ShopSidebar />

      {/* Main Area */}
      <main className="shop-main-content">
        <header className="shop-header">
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', margin: 0 }}>
              Quản Lý Hệ Thống Chi Nhánh & Tọa Độ GPS Radar
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>
              Cấu hình các điểm Showroom để khách hàng định vị gian hàng gần nhất và nhận đồ giao hỏa tốc 2 giờ
            </p>
          </div>

          <Button 
            className="btn-vestora btn-vestora-primary"
            onClick={() => setShowAddModal(true)}
          >
            ➕ Thêm Chi Nhánh Mới
          </Button>
        </header>

        {/* Branches Table */}
        <Card className="dashboard-card border-0 shadow-sm mt-4 p-0">
          <Table responsive hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>Mã Chi Nhánh</th>
                <th>Tên Showroom Hiển Thị</th>
                <th>Địa Chỉ & Định Vị GPS Radar</th>
                <th>Quản Lý Showroom</th>
                <th>Giờ Phục Vụ</th>
                <th>Trạng Thái Radar</th>
                <th>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {branches.map(b => (
                <tr key={b.id}>
                  <td className="fw-bold">{b.id}</td>
                  <td>
                    <div className="fw-bold">{b.name}</div>
                    <div className="small text-muted">Hotline: {b.phone}</div>
                  </td>
                  <td>
                    <div>{b.address}</div>
                    <div className="small text-primary fw-bold">📍 GPS: {b.gpsCoords}</div>
                  </td>
                  <td>{b.manager}</td>
                  <td className="small">{b.openHours}</td>
                  <td>
                    <Badge bg="success">📡 Radar Active (Bán kính 3km)</Badge>
                  </td>
                  <td>
                    <Button variant="outline-dark" size="sm" onClick={() => alert(`Cấu hình tọa độ GPS cho ${b.name}`)}>
                      Sửa Tọa Độ
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        {/* Modal Add Branch */}
        <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title style={{ fontFamily: "'Playfair Display', serif" }}>
              Thêm Chi Nhánh Showroom Mới
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Tên Showroom Chi Nhánh</Form.Label>
                <Form.Control 
                  type="text" 
                  placeholder="Ví dụ: VESTORA Privé Nam Kỳ Khởi Nghĩa"
                  value={newBranch.name}
                  onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Địa Chỉ Chi Tiết</Form.Label>
                <Form.Control 
                  as="textarea" 
                  rows={2} 
                  placeholder="Nhập chính xác địa chỉ để hiển thị trên bản đồ VESTORA Radar..."
                  value={newBranch.address}
                  onChange={(e) => setNewBranch({ ...newBranch, address: e.target.value })}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Hotline & Người Quản Lý</Form.Label>
                <Row>
                  <Col md={6}>
                    <Form.Control 
                      type="text" 
                      placeholder="Số điện thoại"
                      value={newBranch.phone}
                      onChange={(e) => setNewBranch({ ...newBranch, phone: e.target.value })}
                    />
                  </Col>
                  <Col md={6}>
                    <Form.Control 
                      type="text" 
                      placeholder="Họ tên quản lý"
                      value={newBranch.manager}
                      onChange={(e) => setNewBranch({ ...newBranch, manager: e.target.value })}
                    />
                  </Col>
                </Row>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>Hủy</Button>
            <Button variant="dark" onClick={handleAddBranch}>Lưu & Đăng Ký Radar</Button>
          </Modal.Footer>
        </Modal>
      </main>
    </div>
  );
}
