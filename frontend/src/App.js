import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from "./components/ProtectedRoute";

// 1. Role Auth / Common
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

// 2. Role Customer (UC-29..UC-42, UC-65..UC-74)
import HomePage from './pages/customer/HomePage';
import CatalogPage from './pages/customer/CatalogPage';
import ProductDetailPage from './pages/customer/ProductDetailPage';
import CartPage from './pages/customer/CartPage';
import FavoritesPage from './pages/customer/FavoritesPage';
import ShopMapPage from './pages/customer/ShopMapPage';
import UserProfilePage from './pages/customer/UserProfilePage';
import PhotoTryOnPage from './pages/customer/PhotoTryOnPage';
import WebcamTryOnPage from './pages/customer/WebcamTryOnPage';
import AboutPage from './pages/customer/AboutPage';
import BlogPage from './pages/customer/BlogPage';
import ContactPage from './pages/customer/ContactPage';
import PolicyPage from './pages/customer/PolicyPage';
import WardrobePage from './pages/customer/WardrobePage';

// 3. Role Branch Manager (UC-43..UC-52)
import BranchDashboardPage from './pages/branch/BranchDashboardPage';
import BranchRentalOrdersPage from './pages/branch/BranchRentalOrdersPage';
import BranchSaleOrdersPage from './pages/branch/BranchSaleOrdersPage';
import BranchReturnsPage from './pages/branch/BranchReturnsPage';
import BranchReviewsPage from './pages/branch/BranchReviewsPage';
import BranchAnalyticsPage from './pages/branch/BranchAnalyticsPage';
import BranchSettingsPage from './pages/branch/BranchSettingsPage';

// 4. Role Warehouse Manager (UC-15..UC-28)
import WarehouseModerationPage from './pages/warehouse/WarehouseModerationPage';
import WarehouseManagerPage from './pages/warehouse/WarehouseManagerPage';
import WarehousePlaceholderPage from './pages/warehouse/WarehousePlaceholderPage';
import ForceChangePasswordModal from './components/ForceChangePasswordModal';
import InboundReceiptsPage from './pages/warehouse/InboundReceiptsPage';
import InventoryReportPage from './pages/warehouse/InventoryReportPage';

// 5. Role Shop Owner / CEO (UC-12, UC-13, UC-14, UC-56..UC-64)
import OwnerDashboardPage from './pages/owner/OwnerDashboardPage';
import OwnerBranchesPage from './pages/owner/OwnerBranchesPage';
import OwnerPricingPage from './pages/owner/OwnerPricingPage';
import OwnerAnalyticsPage from './pages/owner/OwnerAnalyticsPage';
import OwnerDisputesPage from './pages/owner/OwnerDisputesPage';
import OwnerSettingsPage from './pages/owner/OwnerSettingsPage';
import OwnerBranchesListPage from './pages/owner/OwnerBranchesListPage';

// 6. Role System Admin (UC-09, UC-10, UC-11)
import AdminAccountsPage from './pages/admin/AdminAccountsPage';

function App() {
  return (
    <Router>
      <ForceChangePasswordModal />
      <Routes>
        {/* ========================================================
            CUSTOMER PORTAL (Khách Hàng)
            ======================================================== */}
        <Route path="/" element={<HomePage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/product" element={<ProductDetailPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/map" element={<ShopMapPage />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/try-on/photo" element={<PhotoTryOnPage />} />
        <Route path="/try-on-photo" element={<PhotoTryOnPage />} />
        <Route path="/try-on/webcam" element={<WebcamTryOnPage />} />
        <Route path="/try-on-webcam" element={<WebcamTryOnPage />} />

          <Route path="/about" element={<AboutPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:id" element={<BlogPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/policy" element={<PolicyPage />} />
          <Route path="/policy/:tab" element={<PolicyPage />} />
          <Route path="/wardrobe" element={<WardrobePage />} />
          <Route path="/my-wardrobe" element={<WardrobePage />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* ========================================================
            ROLE: BRANCH MANAGER (Quản Lý Chi Nhánh Cửa Hàng)
            ======================================================== */}
        <Route
          path="/branch/dashboard"
          element={
            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <BranchDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branch/rental-orders"
          element={
            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <BranchRentalOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branch/sale-orders"
          element={
            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <BranchSaleOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branch/returns"
          element={
            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <BranchReturnsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branch/reviews"
          element={
            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <BranchReviewsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branch/analytics"
          element={
            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <BranchAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branch/settings"
          element={
            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <BranchSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branch/showroom"
          element={
            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <BranchSettingsPage />
            </ProtectedRoute>
          }
        />

        {/* ========================================================
            ROLE: WAREHOUSE MANAGER & STAFF (Quản Lý Kho & Sản Phẩm)
            ======================================================== */}
        <Route
          path="/warehousemanager"
          element={<Navigate to="/warehousemanager/inventory-locations" replace />}
        />
        <Route
          path="/warehousemanager/inbound-receipts"
          element={
            <ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'ADMIN']}>
              <InboundReceiptsPage mode="manager" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehousemanager/reports/inventory"
          element={
            <ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'ADMIN']}>
              <InventoryReportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehousemanager/:resource"
          element={
            <ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'ADMIN', 'BRANCH_MANAGER', 'SHOP_OWNER']}>
              <WarehouseManagerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehousemanager/slips/:kind"
          element={
            <ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'ADMIN']}>
              <WarehousePlaceholderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehousemanager/reports/:kind"
          element={
            <ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'ADMIN']}>
              <WarehousePlaceholderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehouse/moderation"
          element={
            <ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'ADMIN']}>
              <WarehouseModerationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehousestaff"
          element={<Navigate to="/warehousestaff/inbound-receipts" replace />}
        />
        <Route
          path="/warehousestaff/inbound-receipts"
          element={
            <ProtectedRoute allowedRoles={['WAREHOUSE_STAFF', 'WAREHOUSE_MANAGER', 'ADMIN']}>
              <InboundReceiptsPage mode="staff" />
            </ProtectedRoute>
          }
        />
        <Route path="/warehouse/products" element={<Navigate to="/warehousemanager/products" replace />} />
        <Route path="/warehouse/products/new" element={<Navigate to="/warehousemanager/products" replace />} />
        <Route path="/warehouse/inventory" element={<Navigate to="/warehousemanager/inventory-locations" replace />} />
        <Route path="/warehouse" element={<Navigate to="/warehousemanager/inventory-locations" replace />} />

        {/* ========================================================
            ROLE: SHOP OWNER / CEO (Chủ Chuỗi & Quản Lý Chi Nhánh)
            ======================================================== */}
        <Route
          path="/owner/dashboard"
          element={
            <ProtectedRoute allowedRoles={['SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <OwnerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/branches"
          element={
            <ProtectedRoute allowedRoles={['SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <OwnerBranchesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/manage-shops"
          element={
            <ProtectedRoute allowedRoles={['SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <OwnerBranchesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/shops"
          element={
            <ProtectedRoute allowedRoles={['SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <OwnerBranchesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/pricing"
          element={
            <ProtectedRoute allowedRoles={['SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <OwnerPricingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/analytics"
          element={
            <ProtectedRoute allowedRoles={['SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <OwnerAnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/disputes"
          element={
            <ProtectedRoute allowedRoles={['SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <OwnerDisputesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/settings"
          element={
            <ProtectedRoute allowedRoles={['SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <OwnerSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/branches-list"
          element={
            <ProtectedRoute allowedRoles={['SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <OwnerBranchesListPage />
            </ProtectedRoute>
          }
        />

        {/* ========================================================
            ROLE: SYSTEM ADMIN (Quản Trị Hệ Thống & Tài Khoản)
            ======================================================== */}
        <Route
          path="/admin/accounts"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminAccountsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <OwnerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="/admin/shops" element={<Navigate to="/owner/branches" replace />} />
        <Route
          path="/admin/moderation"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'WAREHOUSE_MANAGER']}>
              <WarehouseModerationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/disputes"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <OwnerDisputesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <OwnerAnalyticsPage />
            </ProtectedRoute>
          }
        />

        {/* ========================================================
            BACKWARD COMPATIBILITY REDIRECTS (Tương Thích Tuyệt Đối)
            ======================================================== */}
        <Route path="/owner" element={<Navigate to="/owner/branches" replace />} />
        <Route path="/branch" element={<Navigate to="/branch/dashboard" replace />} />
        <Route path="/branches" element={<Navigate to="/owner/branches" replace />} />
        <Route path="/manage-shops" element={<Navigate to="/owner/branches" replace />} />
        <Route path="/shop-owner" element={<Navigate to="/owner/branches" replace />} />
        <Route path="/shop-owner/branches" element={<Navigate to="/owner/branches" replace />} />
        <Route path="/branch-manager" element={<Navigate to="/branch/dashboard" replace />} />
        <Route path="/branch/manage-shops" element={<Navigate to="/branch/settings" replace />} />
        <Route path="/branch/branches" element={<Navigate to="/branch/settings" replace />} />

        <Route path="/shop" element={<Navigate to="/owner/branches" replace />} />
        <Route path="/shop/dashboard" element={<Navigate to="/owner/branches" replace />} />
        <Route path="/shop/rental-orders" element={<Navigate to="/branch/rental-orders" replace />} />
        <Route path="/shop/sale-orders" element={<Navigate to="/branch/sale-orders" replace />} />
        <Route path="/shop/returns" element={<Navigate to="/branch/returns" replace />} />
        <Route path="/shop/reviews" element={<Navigate to="/branch/reviews" replace />} />
        <Route path="/shop/analytics" element={<Navigate to="/branch/analytics" replace />} />
        <Route path="/shop/products" element={<Navigate to="/owner/pricing" replace />} />
        <Route path="/shop/products/new" element={<Navigate to="/owner/pricing" replace />} />
        <Route path="/shop/inventory" element={<Navigate to="/owner/pricing" replace />} />
        <Route path="/shop/pricing" element={<Navigate to="/owner/pricing" replace />} />
        <Route path="/shop/settings" element={<Navigate to="/owner/settings" replace />} />
        <Route path="/shop/branches" element={<Navigate to="/owner/branches" replace />} />
        <Route path="/shop/address" element={<Navigate to="/owner/settings" replace />} />
        <Route path="/shop/store-info" element={<Navigate to="/owner/settings" replace />} />

        <Route path="/ops/shops" element={<Navigate to="/owner/branches" replace />} />
        <Route path="/ops/manage-shops" element={<Navigate to="/owner/branches" replace />} />
        <Route path="/ops/moderation" element={<Navigate to="/warehouse/moderation" replace />} />
        <Route path="/ops/disputes" element={<Navigate to="/owner/disputes" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
