import React from 'react';
import { useAuth } from '../../context/AuthContext';
import WarehouseResourcePage from './WarehouseResourcePage';
import CentralWarehouseSettingsPage from './CentralWarehouseSettingsPage';

const roleOf = (user) => String(user?.roleName || user?.Role || user?.role || '');

/**
 * Quản lý kho / nhân viên kho: màn "Thiết lập kho tổng" (TASK-014 A1).
 * Vai trò khác (admin...) giữ danh sách kho cũ — chưa có màn riêng cho kho chi nhánh, chờ chốt vai trò.
 */
export default function InventoryLocationManagementPage() {
  const { user } = useAuth();
  const role = roleOf(user);
  if (/warehouse[\s_-]?manager/i.test(role)) return <CentralWarehouseSettingsPage />;
  if (/warehouse[\s_-]?staff/i.test(role)) return <CentralWarehouseSettingsPage readOnly />;
  return <WarehouseResourcePage resourceOverride="inventory-locations" />;
}
