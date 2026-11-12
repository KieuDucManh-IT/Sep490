import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Boxes, ClipboardList, FileBarChart2, Layers3, LogOut, MapPin, Package, RotateCcw, Tags } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import '../styles/WarehouseManager.css';

export default function WarehouseSidebar({ mode = 'manager' }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const nav = (to, icon, label) => <Link key={to} className={`wm-nav-item ${pathname === to ? 'active' : ''}`} to={to}>{icon}{label}</Link>;
  const handleLogout = async () => {
    try { await logout(); } finally { navigate('/login', { replace: true }); }
  };
  return <aside className="wm-sidebar">
    <div className="wm-brand"><Boxes size={25} /><div><strong>WAREHOUSE</strong><small>{mode === 'manager' ? 'MANAGER' : 'STAFF'}</small></div></div>
    <nav>
      {mode === 'manager' ? <><p>Danh mục dùng chung</p>
      {nav('/warehousemanager/inventory-locations', <MapPin size={17} />, 'Kho / cửa hàng')}
      {nav('/warehousemanager/storage-locations', <MapPin size={17} />, 'Vị trí lưu trữ')}
      {nav('/warehousemanager/categories', <Tags size={17} />, 'Loại sản phẩm')}
      {nav('/warehousemanager/products', <Package size={17} />, 'Sản phẩm')}
      {nav('/warehousemanager/suppliers', <Package size={17} />, 'Nhà cung cấp')}
      <p>Quản lý phiếu</p>
      {nav('/warehousemanager/inbound-receipts', <ClipboardList size={17} />, 'Nhập kho')}
      {nav('/warehousemanager/outbound', <ClipboardList size={17} />, '\u0058\u0075\u1ea5\u0074 \u006b\u0068\u006f')}
      {nav('/warehousemanager/branch-returns', <RotateCcw size={17} />, 'Hàng trả từ chi nhánh')}
      {nav('/warehousemanager/stocktakes', <ClipboardList size={17} />, '\u004b\u0069\u1ec3\u006d \u006b\u0068\u006f')}
      {nav('/warehousemanager/adjustments', <ClipboardList size={17} />, '\u0110\u0069\u1ec1\u0075 \u0063\u0068\u1ec9\u006e\u0068')}
      <p>Báo cáo</p>
      {nav('/warehousemanager/reports/inventory', <FileBarChart2 size={17} />, 'Tồn kho')}
      {nav(`/warehousemanager/reports/${encodeURIComponent('Lịch sử giao dịch')}`, <FileBarChart2 size={17} />, 'Lịch sử giao dịch')}
      </> : <><p>Nghiệp vụ kho</p>{nav('/warehousestaff/inbound-receipts', <ClipboardList size={17} />, 'Kiểm tra hàng nhập')}{nav('/warehousestaff/outbound', <ClipboardList size={17} />, 'Soạn hàng xuất kho')}{nav('/warehousestaff/branch-returns', <RotateCcw size={17} />, 'Nhận hàng trả từ chi nhánh')}{nav('/warehousestaff/stocktakes', <ClipboardList size={17} />, 'Kiểm kê được giao')}<p>Báo cáo</p>{nav('/warehousestaff/reports/inventory', <FileBarChart2 size={17} />, 'Tồn kho')}</>}
    </nav>
    <button className="wm-exit wm-logout-button" type="button" onClick={handleLogout}><LogOut size={16} /> Đăng xuất</button>
  </aside>;
}
