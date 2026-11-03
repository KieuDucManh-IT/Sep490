import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import CategoryManagementPage from './CategoryManagementPage';
import ProductManagementPage from './ProductManagementPage';
import SupplierManagementPage from './SupplierManagementPage';
import InventoryLocationManagementPage from './InventoryLocationManagementPage';
import StorageLocationManagementPage from './StorageLocationManagementPage';

const screens = {
  categories: CategoryManagementPage,
  products: ProductManagementPage,
  suppliers: SupplierManagementPage,
  'inventory-locations': InventoryLocationManagementPage,
  'storage-locations': StorageLocationManagementPage,
};

export default function WarehouseManagerPage() {
  const { resource = 'inventory-locations' } = useParams();
  const Screen = screens[resource];
  return Screen ? <Screen /> : <Navigate to="/warehousemanager/inventory-locations" replace />;
}
