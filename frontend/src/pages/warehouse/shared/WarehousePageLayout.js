import React from 'react';
import WarehouseSidebar from '../../../components/WarehouseSidebar';
import '../../../styles/ShopDashboard.css';
import '../../../styles/WarehouseManager.css';
import '../../../styles/WarehouseUx.css';
import '../../../styles/WarehouseShared.css';

/**
 * Khung chung của mọi trang kho: sidebar kho bên trái, nội dung bên phải.
 * Dùng cùng class layout với trang chi nhánh (`shop-dashboard-layout` / `shop-main-content`)
 * để hai phân hệ trông giống nhau.
 * @param {object} props
 * @param {'manager'|'staff'} [props.mode] menu sidebar theo vai trò
 * @param {string} [props.className] class thêm cho vùng nội dung (ví dụ 'wm-stock-control-page')
 * @param {React.ReactNode} props.children nội dung trang
 */
export default function WarehousePageLayout({ mode, className = '', children }) {
  return (
    <div className="shop-dashboard-layout wh-layout">
      <WarehouseSidebar mode={mode} />
      <main className={`shop-main-content wh-main ${className}`.trim()}>{children}</main>
    </div>
  );
}
