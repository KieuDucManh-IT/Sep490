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
import CheckoutPage from './pages/customer/CheckoutPage';
import SaleCheckoutPage from './pages/customer/SaleCheckoutPage';
import ShopMapPage from './pages/customer/ShopMapPage';
import UserProfilePage from './pages/customer/UserProfilePage';
import PhotoTryOnPage from './pages/customer/PhotoTryOnPage';
import WebcamTryOnPage from './pages/customer/WebcamTryOnPage';
import AboutPage from './pages/customer/AboutPage';
import ContactPage from './pages/customer/ContactPage';
import PolicyPage from './pages/customer/PolicyPage';
import WardrobePage from './pages/customer/WardrobePage';
import StylistPage from './pages/customer/StylistPage';
import AiStylistWidget from './components/AiStylistWidget';
import WalletPage from './pages/customer/WalletPage';
import ChatPage from './pages/customer/ChatPage';
import BranchChatPage from './pages/branch/BranchChatPage';
import CustomerOrderTrackingPage from './pages/customer/CustomerOrderTrackingPage';
import SharedLookbookPage from './pages/customer/SharedLookbookPage';
import RentalOrdersHistoryPage from './pages/customer/RentalOrdersHistoryPage';

// 3. Role Branch Manager (UC-43..UC-52)
import BranchDashboardPage from './pages/branch/BranchDashboardPage';
import BranchRentalOrdersPage from './pages/branch/BranchRentalOrdersPage';
import BranchSaleOrdersPage from './pages/branch/BranchSaleOrdersPage';
import BranchReturnsPage from './pages/branch/BranchReturnsPage';
import BranchReviewsPage from './pages/branch/BranchReviewsPage';
import BranchAnalyticsPage from './pages/branch/BranchAnalyticsPage';
import BranchSettingsPage from './pages/branch/BranchSettingsPage';
import BranchInventoryPage from './pages/branch/BranchInventoryPage.js';

// 4. Role Warehouse Manager (UC-15..UC-28)
import WarehouseModerationPage from './pages/warehouse/WarehouseModerationPage';
import WarehouseManagerPage from './pages/warehouse/WarehouseManagerPage';
import WarehousePlaceholderPage from './pages/warehouse/WarehousePlaceholderPage';
import ForceChangePasswordModal from './components/ForceChangePasswordModal';
import CartDrawer from './components/customer/cart/CartDrawer';
import InboundReceiptsPage from './pages/warehouse/InboundReceiptsPage';
import InventoryReportPage from './pages/warehouse/InventoryReportPage';
import WarehouseStocktakePage from './pages/warehouse/WarehouseStocktakePage';
import WarehouseAdjustmentPage from './pages/warehouse/WarehouseAdjustmentPage';
import WarehouseTransfersPage from './pages/warehouse/WarehouseTransfersPage';
import CategoryManagementPage from './pages/warehouse/CategoryManagementPage';
import ProductManagementPage from './pages/warehouse/ProductManagementPage';
import SupplierManagementPage from './pages/warehouse/SupplierManagementPage';
import InventoryLocationManagementPage from './pages/warehouse/InventoryLocationManagementPage';

// 5. Role Shop Owner / CEO (UC-12, UC-13, UC-14, UC-56..UC-64)
import OwnerDashboardPage from './pages/owner/OwnerDashboardPage';
import OwnerBranchesPage from './pages/owner/OwnerBranchesPage';
import OwnerPricingPage from './pages/owner/OwnerPricingPage';
import OwnerAnalyticsPage from './pages/owner/OwnerAnalyticsPage';
import OwnerDisputesPage from './pages/owner/OwnerDisputesPage';
import OwnerSettingsPage from './pages/owner/OwnerSettingsPage';
import OwnerBranchesListPage from './pages/owner/OwnerBranchesListPage';
import OwnerPoliciesPage from './pages/owner/OwnerPoliciesPage';
import OwnerRentalOrdersPage from './pages/owner/OwnerRentalOrdersPage';
import OwnerSaleOrdersPage from './pages/owner/OwnerSaleOrdersPage';

// 6. Role System Admin (UC-09, UC-10, UC-11)
import AdminAccountsPage from './pages/admin/AdminAccountsPage';

function App() {
  return (
    <Router>
      <ForceChangePasswordModal />
      <CartDrawer />
      <Routes>
        {/* ========================================================
            CUSTOMER PORTAL (Khách Hàng)
            ======================================================== */}
        <Route path="/" element={<HomePage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/product" element={<ProductDetailPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
        <Route path="/checkout/sale" element={<ProtectedRoute><SaleCheckoutPage /></ProtectedRoute>} />
        <Route path="/favorites" element={<Navigate to="/wardrobe" replace />} />
        <Route path="/map" element={<ShopMapPage />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <UserProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/try-on" element={<PhotoTryOnPage />} />
        <Route path="/try-on/photo" element={<PhotoTryOnPage />} />
        <Route path="/try-on-photo" element={<PhotoTryOnPage />} />
        <Route path="/try-on/webcam" element={<WebcamTryOnPage />} />
        <Route path="/try-on-webcam" element={<WebcamTryOnPage />} />

        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/policy" element={<PolicyPage />} />
        <Route path="/policy/:tab" element={<PolicyPage />} />
        <Route path="/wardrobe" element={<WardrobePage />} />
        <Route path="/my-wardrobe" element={<WardrobePage />} />
        <Route path="/stylist" element={<StylistPage />} />
        <Route path="/lookbook/:shareCode" element={<SharedLookbookPage />} />

        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/chat/:conversationId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
        <Route path="/tracking" element={<Navigate to="/rental-orders" replace />} />
        <Route path="/tracking/:trackingCode" element={<CustomerOrderTrackingPage />} />
        <Route path="/rental-orders" element={<ProtectedRoute><RentalOrdersHistoryPage /></ProtectedRoute>} />
        <Route path="/customer/rental-orders" element={<ProtectedRoute><RentalOrdersHistoryPage /></ProtectedRoute>} />

        {/* ========================================================
            ROLE: BRANCH MANAGER (Quáº£n LÃ½ Chi NhÃ¡nh Cá»­a HÃ ng)
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
          path="/branch/chat"
          element={
            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SHOP_OWNER', 'OWNER']}>
              <BranchChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branch/chat/:conversationId"
          element={
            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SHOP_OWNER', 'OWNER']}>
              <BranchChatPage />
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
            <ProtectedRoute allowedRoles={['BRANCH_MANAGER']}>
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
        <Route path="/branch/stock-requests" element={<ProtectedRoute allowedRoles={['BRANCH_MANAGER']}><WarehouseTransfersPage mode="branch" /></ProtectedRoute>} />
        <Route path="/branch/inventory" element={<ProtectedRoute allowedRoles={['BRANCH_MANAGER']}><BranchInventoryPage /></ProtectedRoute>} />
        <Route
          path="/branch/showroom"
          element={
            <ProtectedRoute allowedRoles={['BRANCH_MANAGER', 'SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <BranchSettingsPage />
            </ProtectedRoute>
          }
        />

        {/* ========================================================
            ROLE: WAREHOUSE MANAGER & STAFF (Quáº£n LÃ½ Kho & Sáº£n Pháº©m)
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
        <Route path="/warehousemanager/stocktakes" element={<ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'ADMIN']}><WarehouseStocktakePage /></ProtectedRoute>} />
        <Route path="/warehousemanager/adjustments" element={<ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'ADMIN']}><WarehouseAdjustmentPage /></ProtectedRoute>} />
        <Route path="/warehousemanager/outbound" element={<ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'ADMIN']}><WarehouseTransfersPage mode="warehouse" /></ProtectedRoute>} />
        <Route path="/warehousemanager/transfers" element={<ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'ADMIN']}><WarehouseTransfersPage mode="warehouse" /></ProtectedRoute>} />
        <Route path="/warehousemanager/categories" element={<ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'ADMIN', 'BRANCH_MANAGER', 'SHOP_OWNER']}><CategoryManagementPage /></ProtectedRoute>} />
        <Route path="/warehousemanager/products" element={<ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'ADMIN', 'BRANCH_MANAGER', 'SHOP_OWNER']}><ProductManagementPage /></ProtectedRoute>} />
        <Route path="/warehousemanager/suppliers" element={<ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'ADMIN']}><SupplierManagementPage /></ProtectedRoute>} />
        <Route path="/warehousemanager/inventory-locations" element={<ProtectedRoute allowedRoles={['WAREHOUSE_MANAGER', 'WAREHOUSE_STAFF', 'ADMIN', 'BRANCH_MANAGER', 'SHOP_OWNER']}><InventoryLocationManagementPage /></ProtectedRoute>} />
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
        <Route path="/warehousestaff/stocktakes" element={<ProtectedRoute allowedRoles={['WAREHOUSE_STAFF', 'WAREHOUSE_MANAGER', 'ADMIN']}><WarehouseStocktakePage /></ProtectedRoute>} />
        <Route path="/warehousestaff/reports/inventory" element={<ProtectedRoute allowedRoles={['WAREHOUSE_STAFF', 'WAREHOUSE_MANAGER', 'ADMIN']}><InventoryReportPage mode="staff" /></ProtectedRoute>} />
        <Route path="/warehousestaff/outbound" element={<ProtectedRoute allowedRoles={['WAREHOUSE_STAFF', 'WAREHOUSE_MANAGER', 'ADMIN']}><WarehouseTransfersPage mode="staff" /></ProtectedRoute>} />
        <Route path="/warehouse/products" element={<Navigate to="/warehousemanager/products" replace />} />
        <Route path="/warehouse/products/new" element={<Navigate to="/warehousemanager/products" replace />} />
        <Route path="/warehouse/inventory" element={<Navigate to="/branch/inventory" replace />} />
        <Route path="/warehouse" element={<Navigate to="/warehousemanager/inventory-locations" replace />} />

        {/* ========================================================
            ROLE: SHOP OWNER / CEO (Chá»§ Chuá»—i & Quáº£n LÃ½ Chi NhÃ¡nh)
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
        <Route
          path="/owner/policies"
          element={
            <ProtectedRoute allowedRoles={['SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <OwnerPoliciesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/rental-orders"
          element={
            <ProtectedRoute allowedRoles={['SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <OwnerRentalOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/owner/sale-orders"
          element={
            <ProtectedRoute allowedRoles={['SHOP_OWNER', 'OWNER', 'ADMIN']}>
              <OwnerSaleOrdersPage />
            </ProtectedRoute>
          }
        />

        {/* ========================================================
            ROLE: SYSTEM ADMIN (Quáº£n Trá»‹ Há»‡ Thá»‘ng & TÃ i Khoáº£n)
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
          element={<Navigate to="/admin/accounts" replace />}
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
            BACKWARD COMPATIBILITY REDIRECTS (TÆ°Æ¡ng ThÃ­ch Tuyá»‡t Äá»‘i)
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
      <AiStylistWidget />
    </Router>
  );
}

export default App;
