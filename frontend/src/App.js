import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import ProtectedRoute from "./components/ProtectedRoute";

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';

import HomePage from './pages/customer/HomePage';
import CatalogPage from './pages/customer/CatalogPage';
import ProductDetailPage from './pages/customer/ProductDetailPage';
import CartPage from './pages/customer/CartPage';
import FavoritesPage from './pages/customer/FavoritesPage';
import ShopMapPage from './pages/customer/ShopMapPage';
import UserProfilePage from './pages/customer/UserProfilePage';
import RegisterShopPage from './pages/customer/RegisterShopPage';
import PhotoTryOnPage from './pages/customer/PhotoTryOnPage';
import WebcamTryOnPage from './pages/customer/WebcamTryOnPage';
import AboutPage from './pages/customer/AboutPage';
import BlogPage from './pages/customer/BlogPage';
import ContactPage from './pages/customer/ContactPage';
import PolicyPage from './pages/customer/PolicyPage';
import WardrobePage from './pages/customer/WardrobePage';

import ShopDashboardPage from './pages/shop/ShopDashboardPage';
import ShopAnalyticsPage from './pages/shop/ShopAnalyticsPage';
import ShopRentalOrdersPage from './pages/shop/ShopRentalOrdersPage';
import ShopSaleOrdersPage from './pages/shop/ShopSaleOrdersPage';
import ShopReturnsPage from './pages/shop/ShopReturnsPage';
import ShopReviewsPage from './pages/shop/ShopReviewsPage';
import ShopSettingsPage from './pages/shop/ShopSettingsPage';
import ShopBranchesPage from './pages/shop/ShopBranchesPage';

import AdminAccountsPage from './pages/admin/AdminAccountsPage';
import WarehouseManagerPage from './pages/warehouse/WarehouseManagerPage';
import WarehousePlaceholderPage from './pages/warehouse/WarehousePlaceholderPage';
import ForceChangePasswordModal from './components/ForceChangePasswordModal';

function App() {
  return (
    
      <Router>
        <ForceChangePasswordModal />
        <Routes>
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
          <Route path="/register-shop" element={<RegisterShopPage />} />
          <Route path="/customer/register-shop" element={<RegisterShopPage />} />
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

          <Route path="/shop/dashboard" element={<ShopDashboardPage />} />
          <Route path="/shop/analytics" element={<ShopAnalyticsPage />} />
          <Route path="/shop/rental-orders" element={<ShopRentalOrdersPage />} />
          <Route path="/shop/sale-orders" element={<ShopSaleOrdersPage />} />
          <Route path="/shop/returns" element={<ShopReturnsPage />} />
          <Route path="/shop/reviews" element={<ShopReviewsPage />} />
          <Route path="/shop/settings" element={<ShopSettingsPage />} />
          <Route path="/shop/branches" element={<ShopBranchesPage />} />

          <Route path="/warehousemanager" element={<Navigate to="/warehousemanager/inventory-locations" replace />} />
          <Route path="/warehousemanager/:resource" element={<WarehouseManagerPage />} />
          <Route path="/warehousemanager/slips/:kind" element={<WarehousePlaceholderPage />} />
          <Route path="/warehousemanager/reports/:kind" element={<WarehousePlaceholderPage />} />

          {/* <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/shops" element={<AdminShopsPage />} /> */}
          <Route path="/admin/accounts" element={<AdminAccountsPage />} />
          <Route path="/admin/accounts" element={<ProtectedRoute allowedRoles={["ADMIN"]}><AdminAccountsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<Navigate to="/admin/accounts" replace />} />
          <Route path="/admin/*" element={<Navigate to="/admin/accounts" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
  );
}

export default App;
