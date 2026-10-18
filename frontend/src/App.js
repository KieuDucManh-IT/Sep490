import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from "./context/AuthContext";
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

import ShopDashboardPage from './pages/shop/ShopDashboardPage';
import ShopAnalyticsPage from './pages/shop/ShopAnalyticsPage';
import ShopProductsPage from './pages/shop/ShopProductsPage';
import ShopAddProductPage from './pages/shop/ShopAddProductPage';
import ShopRentalOrdersPage from './pages/shop/ShopRentalOrdersPage';
import ShopSaleOrdersPage from './pages/shop/ShopSaleOrdersPage';
import ShopInventoryPage from './pages/shop/ShopInventoryPage';
import ShopReturnsPage from './pages/shop/ShopReturnsPage';
import ShopPricingPage from './pages/shop/ShopPricingPage';
import ShopReviewsPage from './pages/shop/ShopReviewsPage';
import ShopSettingsPage from './pages/shop/ShopSettingsPage';

import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminShopsPage from './pages/admin/AdminShopsPage';
import AdminAccountsPage from './pages/admin/AdminAccountsPage';
import AdminModerationPage from './pages/admin/AdminModerationPage';
import AdminDisputesPage from './pages/admin/AdminDisputesPage';
import AdminAnalyticsPage from './pages/admin/AdminAnalyticsPage';

function App() {
  return (
    <AuthProvider>
      <Router>
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

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/shop/dashboard" element={<ShopDashboardPage />} />
          <Route path="/shop/analytics" element={<ShopAnalyticsPage />} />
          <Route path="/shop/products" element={<ShopProductsPage />} />
          <Route path="/shop/products/new" element={<ShopAddProductPage />} />
          <Route path="/shop/rental-orders" element={<ShopRentalOrdersPage />} />
          <Route path="/shop/sale-orders" element={<ShopSaleOrdersPage />} />
          <Route path="/shop/inventory" element={<ShopInventoryPage />} />
          <Route path="/shop/returns" element={<ShopReturnsPage />} />
          <Route path="/shop/pricing" element={<ShopPricingPage />} />
          <Route path="/shop/reviews" element={<ShopReviewsPage />} />
          <Route path="/shop/settings" element={<ShopSettingsPage />} />
          <Route path="/shop/branches" element={<ShopSettingsPage />} />
          <Route path="/shop/address" element={<ShopSettingsPage />} />
          <Route path="/shop/store-info" element={<ShopSettingsPage />} />

          {/* Operations Staff (OPS) Routes */}
          <Route path="/ops/shops" element={<AdminShopsPage />} />
          <Route path="/ops/manage-shops" element={<AdminShopsPage />} />
          <Route path="/ops/shop-applications" element={<AdminShopsPage />} />
          <Route path="/ops/shops/approvals" element={<AdminShopsPage />} />
          <Route path="/ops/moderation" element={<AdminModerationPage />} />
          <Route path="/ops/disputes" element={<AdminDisputesPage />} />

          {/* Administrator Routes */}
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/shops" element={<AdminShopsPage />} />
          <Route path="/admin/manage-shops" element={<AdminShopsPage />} />
          <Route path="/admin/shop-applications" element={<AdminShopsPage />} />
          <Route path="/admin/shops/approvals" element={<AdminShopsPage />} />
          <Route path="/admin/accounts" element={<AdminAccountsPage />} />
          <Route path="/admin/moderation" element={<AdminModerationPage />} />
          <Route path="/admin/disputes" element={<AdminDisputesPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
