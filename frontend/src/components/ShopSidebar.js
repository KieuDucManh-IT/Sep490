import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/ShopDashboard.css';

export default function ShopSidebar() {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <aside className="shop-sidebar">
      <div className="shop-brand-badge">
        <h2>VESTORA PRIVÉ</h2>
        <span>Gian Hàng Đối Tác Premium</span>
      </div>

      <nav className="shop-nav-menu">
        <div className="sidebar-section-label">GIAN HÀNG</div>
        <Link to="/shop/dashboard" className={`sidebar-nav-item ${isActive('/shop/dashboard')}`}>
          Tổng Quan Gian Hàng
        </Link>
        <Link to="/shop/analytics" className={`sidebar-nav-item ${isActive('/shop/analytics')}`}>
          Báo Cáo Doanh Thu
        </Link>
        <Link to="/shop/settings" className={`sidebar-nav-item ${isActive('/shop/settings')}`}>
          Thông Tin Gian Hàng
        </Link>
        <Link to="/shop/branches" className={`sidebar-nav-item ${isActive('/shop/branches')}`}>
          Địa Chỉ Chi Nhánh Showroom
        </Link>

        <div className="sidebar-section-label" style={{ marginTop: '12px' }}>
          SẢN PHẨM & TỒN KHO
        </div>
        <Link to="/shop/products" className={`sidebar-nav-item ${isActive('/shop/products')}`}>
          Danh Sách Sản Phẩm
        </Link>
        <Link to="/shop/products/new" className={`sidebar-nav-item ${isActive('/shop/products/new')}`}>
          Đăng Trang Phục Mới
        </Link>
        <Link to="/shop/inventory" className={`sidebar-nav-item ${isActive('/shop/inventory')}`}>
          Quản Lý Tồn Kho & Giặt Spa
        </Link>
        <Link to="/shop/pricing" className={`sidebar-nav-item ${isActive('/shop/pricing')}`}>
          Bảng Giá Thuê & Cọc Escrow
        </Link>

        <div className="sidebar-section-label" style={{ marginTop: '12px' }}>
          ĐƠN HÀNG & ĐỐI SOÁT
        </div>
        <Link to="/shop/rental-orders" className={`sidebar-nav-item ${isActive('/shop/rental-orders')}`}>
          Quản Lý Đơn Thuê
        </Link>
        <Link to="/shop/sale-orders" className={`sidebar-nav-item ${isActive('/shop/sale-orders')}`}>
          Đơn Mua Bán Đứt
        </Link>
        <Link to="/shop/returns" className={`sidebar-nav-item ${isActive('/shop/returns')}`}>
          Trả Hàng & Khấu Trừ Cọc
        </Link>

        <div className="sidebar-section-label" style={{ marginTop: '12px' }}>
          KHÁCH HÀNG & ĐÁNH GIÁ
        </div>
        <Link to="/shop/reviews" className={`sidebar-nav-item ${isActive('/shop/reviews')}`}>
          Đánh Giá Từ Khách Hàng
        </Link>

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <Link to="/" className="sidebar-nav-item" style={{ color: '#9ca3af' }}>
            Trở Về Sàn VESTORA ➔
          </Link>
        </div>
      </nav>
    </aside>
  );
}
