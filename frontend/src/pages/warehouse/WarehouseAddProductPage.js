import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Form, Button } from 'react-bootstrap';
import BranchSidebar from '../../components/BranchSidebar';
import '../../styles/ShopDashboard.css';

export default function WarehouseAddProductPage() {
  const navigate = useNavigate();
  const [product, setProduct] = useState({
    name: 'Đầm Dạ Hội Haute Couture Kim Tuyến Rose',
    category: 'Đầm Dạ Hội & Event',
    retailValue: '28000000',
    rental3DaysPrice: '950000',
    resalePrice: '14500000',
    escrowDeposit: '2500000',
    description: 'Đầm dạ hội may đo thiết kế độc bản, đính kết đá swarovski thủ công. Chất liệu lụa satin cao cấp tôn dáng.',
    stockS: 2,
    stockM: 3,
    stockL: 1,
    stockXL: 0
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    alert('Đã nộp hồ sơ sản phẩm mới lên Trung Tâm Kiểm Duyệt VESTORA Platform thành công!');
    navigate('/shop/products');
  };

  return (
    <div className="shop-dashboard-layout">
      {/* Sidebar Navigation */}
      <BranchSidebar />

      {/* Main Area */}
      <main className="shop-main-content">
        <header className="shop-header">
          <div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.8rem', margin: 0 }}>
              Đăng Niêm Yết Mẫu Trang Phục Thuê Mới
            </h1>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '4px' }}>
              Điền thông tin định giá gói thuê, khoản cọc PayOS Escrow và tải ảnh 360 độ phục vụ thử đồ AI
            </p>
          </div>

          <Button variant="outline-secondary" onClick={() => navigate('/shop/products')}>
            ← Quay Lại Danh Sách
          </Button>
        </header>

        <Form onSubmit={handleSubmit} className="mt-4">
          <Row className="g-4">
            <Col md={8}>
              <Card className="dashboard-card p-4">
                <h5 className="fw-bold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Thông Tin Trang Phục & Phân Loại
                </h5>

                <Form.Group className="mb-3">
                  <Form.Label>Tên Trang Phục Niêm Yết</Form.Label>
                  <Form.Control 
                    type="text" 
                    value={product.name}
                    onChange={(e) => setProduct({ ...product, name: e.target.value })}
                    required
                  />
                </Form.Group>

                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Label>Danh Mục Thời Trang</Form.Label>
                    <Form.Select 
                      value={product.category}
                      onChange={(e) => setProduct({ ...product, category: e.target.value })}
                    >
                      <option value="Đầm Dạ Hội & Event">Đầm Dạ Hội & Event</option>
                      <option value="Vest & Tuxedo Nam">Vest & Tuxedo Nam</option>
                      <option value="Áo Khoác Privé Wool">Áo Khoác Privé Wool</option>
                      <option value="Phụ Kiện Luxury">Phụ Kiện Luxury</option>
                    </Form.Select>
                  </Col>
                  <Col md={6}>
                    <Form.Label>Giá Trị Niêm Yết Gốc (Retail Value)</Form.Label>
                    <Form.Control 
                      type="number" 
                      value={product.retailValue}
                      onChange={(e) => setProduct({ ...product, retailValue: e.target.value })}
                      required
                    />
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Mô Tả Sản Phẩm & Chất Liệu</Form.Label>
                  <Form.Control 
                    as="textarea" 
                    rows={4} 
                    value={product.description}
                    onChange={(e) => setProduct({ ...product, description: e.target.value })}
                  />
                </Form.Group>
              </Card>

              {/* Pricing & Escrow Card */}
              <Card className="dashboard-card p-4 mt-4">
                <h5 className="fw-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: '#d4af37' }}>
                  💵 Định Giá Gói Thuê & Khoản Cọc PayOS Escrow
                </h5>

                <Row className="g-3">
                  <Col md={4}>
                    <Form.Label>Giá Thuê Gói 3 Ngày</Form.Label>
                    <Form.Control 
                      type="number" 
                      value={product.rental3DaysPrice}
                      onChange={(e) => setProduct({ ...product, rental3DaysPrice: e.target.value })}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Label>Khoản Cọc Giữ PayOS Escrow</Form.Label>
                    <Form.Control 
                      type="number" 
                      value={product.escrowDeposit}
                      onChange={(e) => setProduct({ ...product, escrowDeposit: e.target.value })}
                    />
                  </Col>
                  <Col md={4}>
                    <Form.Label>Giá Bán Bán Đứt (Thanh Lý)</Form.Label>
                    <Form.Control 
                      type="number" 
                      value={product.resalePrice}
                      onChange={(e) => setProduct({ ...product, resalePrice: e.target.value })}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>

            <Col md={4}>
              <Card className="dashboard-card p-4">
                <h5 className="fw-bold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Tồn Kho Theo Size (S / M / L / XL)
                </h5>

                <div className="d-flex flex-column gap-3">
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Size S:</span>
                    <Form.Control 
                      type="number" 
                      style={{ width: '80px' }} 
                      value={product.stockS}
                      onChange={(e) => setProduct({ ...product, stockS: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Size M:</span>
                    <Form.Control 
                      type="number" 
                      style={{ width: '80px' }} 
                      value={product.stockM}
                      onChange={(e) => setProduct({ ...product, stockM: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Size L:</span>
                    <Form.Control 
                      type="number" 
                      style={{ width: '80px' }} 
                      value={product.stockL}
                      onChange={(e) => setProduct({ ...product, stockL: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span>Size XL:</span>
                    <Form.Control 
                      type="number" 
                      style={{ width: '80px' }} 
                      value={product.stockXL}
                      onChange={(e) => setProduct({ ...product, stockXL: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-top">
                  <Button variant="dark" type="submit" className="w-100 py-2 fw-bold">
                    🚀 Nộp Hồ Sơ Duyệt Niêm Yết
                  </Button>
                </div>
              </Card>
            </Col>
          </Row>
        </Form>
      </main>
    </div>
  );
}
