import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Boxes, ClipboardList, FileBarChart2, Layers3, LogOut, MapPin, Package, Tags } from 'lucide-react';
import '../styles/WarehouseManager.css';

export default function WarehouseSidebar({ mode = 'manager' }) {
  const { pathname } = useLocation();
  const nav = (to, icon, label) => <Link key={to} className={`wm-nav-item ${pathname === to ? 'active' : ''}`} to={to}>{icon}{label}</Link>;
  return <aside className="wm-sidebar">
    <div className="wm-brand"><Boxes size={25} /><div><strong>WAREHOUSE</strong><small>{mode === 'manager' ? 'MANAGER' : 'STAFF'}</small></div></div>
    <nav>
      {mode === 'manager' ? <><p>Danh mục dùng chung</p>
      {nav('/warehousemanager/inventory-locations', <MapPin size={17} />, 'Kho / cửa hàng')}
      {nav('/warehousemanager/storage-locations', <MapPin size={17} />, 'Vị trí lưu trữ')}
      {nav('/warehousemanager/categories', <Tags size={17} />, 'Loại sản phẩm')}
      {nav('/warehousemanager/products', <Package size={17} />, 'Sản phẩm')}
      {nav('/warehousemanager/variants', <Layers3 size={17} />, 'Biến thể')}
      {nav('/warehousemanager/suppliers', <Package size={17} />, 'Nhà cung cấp')}
      <p>Quản lý phiếu</p>
      {nav('/warehousemanager/inbound-receipts', <ClipboardList size={17} />, 'Nhập kho')}
      {['Xuất kho', 'Kiểm kho', 'Chuyển kho', 'Điều chỉnh'].map((label) => nav(`/warehousemanager/slips/${encodeURIComponent(label)}`, <ClipboardList size={17} />, label))}
      <p>Báo cáo</p>
      {nav('/warehousemanager/reports/inventory', <FileBarChart2 size={17} />, 'Tồn kho')}
      {nav(`/warehousemanager/reports/${encodeURIComponent('Lịch sử giao dịch')}`, <FileBarChart2 size={17} />, 'Lịch sử giao dịch')}
      </> : <><p>Nghiệp vụ kho</p>{nav('/warehousestaff/inbound-receipts', <ClipboardList size={17} />, 'Công việc được giao')}</>}
    </nav>
    <Link className="wm-exit" to={mode === 'manager' ? '/shop/dashboard' : '/'}><LogOut size={16} /> {mode === 'manager' ? 'Thoát Warehouse Manager' : 'Về trang chính'}</Link>
  </aside>;
}
