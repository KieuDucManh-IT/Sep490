import React, { useState } from 'react';
import {
  RotateCcw,
  Sparkles,
  TrendingUp,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Search,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import PricingTable from './pricing/components/PricingTable';
import PricingEditModal from './pricing/components/PricingEditModal';
import { usePricingData } from './pricing/hooks/usePricingData';
import { fmtCurrency } from './pricing/utils/pricingHelpers';

import '../../styles/AdminDashboard.css';
import '../../styles/OpsShops.css';
import '../../styles/OwnerPricing.css';

// Re-export để đảm bảo tính tương thích ngược với các unit test / modules khác
export {
  calculateAmountByPercent,
  calculateDeposit,
  calculateRentalPrice,
  fmtCurrency,
  formatDate,
} from './pricing/utils/pricingHelpers';

/**
 * Controller View: Quản lý Biểu Phí, Giá Thuê & Tiền Cọc Chuỗi (Role: Shop Owner)
 * Cấu trúc module chuẩn hóa tương tự OwnerBranchesPage và OwnerPoliciesPage:
 * - Điều phối dữ liệu từ custom hook usePricingData
 * - Render giao diện chính, KPI, Bộ lọc và kết nối các sub-components độc lập (PricingTable, PricingEditModal)
 */
export default function OwnerPricingPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const {
    items,
    loading,
    errorMsg,
    search,
    setSearch,
    selectedCategory,
    setSelectedCategory,
    categoryOptions,
    filteredItems,
    kpiStats,
    fetchProducts,
    editingItem,
    editForm,
    submitting,
    saveSuccess,
    modalError,
    handleOpenEdit,
    closeEditModal,
    handleSalePriceChange,
    handleRentalPercentChange,
    handleQuickRentalPercent,
    handleDepositPercentChange,
    handleQuickDepositPercent,
    handleSavePrice,
  } = usePricingData();

  return (
    <div className="admin-layout">
      {/* 1. Sidebar điều hướng Shop Owner */}
      <OwnerSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* 2. Khung nhìn chính của trang */}
      <div className="admin-main-viewport">
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb="Bảng Giá & Tiền Cọc Toàn Chuỗi"
        />

        <main className="admin-content-body pricing-content-body">
          {/* Header & Nút Làm Mới */}
          <div className="pricing-header-wrapper">
            <div>
              <h1 className="pricing-header-title">Bảng Giá & Tiền Cọc</h1>
              <p className="pricing-header-subtitle">
                Cài đặt giá thuê theo ngày, giá bán và mức tiền cọc cho từng mẫu trang phục
              </p>
            </div>

            <button
              type="button"
              className="btn-tail-outline pricing-refresh-btn"
              onClick={fetchProducts}
              disabled={loading}
              aria-label="Làm mới danh sách trang phục"
            >
              <RotateCcw size={14} className={loading ? 'spin-anim' : ''} />
              <span>{loading ? 'Đang cập nhật...' : 'Làm mới'}</span>
            </button>
          </div>

          {/* Thẻ Thống Kê KPI */}
          <section aria-label="Thống kê tổng quan bảng giá" className="pricing-kpi-section">
            <div className="pricing-kpi-grid">
              {/* KPI 1: Tổng mẫu */}
              <div className="pricing-kpi-card">
                <div className="pricing-kpi-header">
                  <span className="pricing-kpi-label">TỔNG MẪU TRANG PHỤC</span>
                  <div className="pricing-kpi-icon-wrap icon-gold">
                    <Sparkles size={17} />
                  </div>
                </div>
                <div className="pricing-kpi-value val-slate">
                  {kpiStats.total} <span className="pricing-kpi-unit unit-slate">Mẫu</span>
                </div>
                <div className="pricing-kpi-footer footer-emerald">
                  <TrendingUp size={13} />
                  <span>Trang phục đang kinh doanh</span>
                </div>
              </div>

              {/* KPI 2: Giá thuê trung bình */}
              <div className="pricing-kpi-card">
                <div className="pricing-kpi-header">
                  <span className="pricing-kpi-label">GIÁ THUÊ TRUNG BÌNH</span>
                  <div className="pricing-kpi-icon-wrap icon-amber">
                    <Calendar size={17} />
                  </div>
                </div>
                <div className="pricing-kpi-value val-amber">
                  {fmtCurrency(kpiStats.avgRental)}{' '}
                  <span className="pricing-kpi-unit unit-amber">/ ngày</span>
                </div>
                <div className="pricing-kpi-footer footer-slate">
                  <span>Tính theo ngày thuê thực tế</span>
                </div>
              </div>

              {/* KPI 3: Tiền cọc trung bình */}
              <div className="pricing-kpi-card">
                <div className="pricing-kpi-header">
                  <span className="pricing-kpi-label">TIỀN CỌC TRUNG BÌNH</span>
                  <div className="pricing-kpi-icon-wrap icon-emerald">
                    <ShieldCheck size={17} />
                  </div>
                </div>
                <div className="pricing-kpi-value val-emerald">
                  {fmtCurrency(kpiStats.avgDeposit)}
                </div>
                <div className="pricing-kpi-footer footer-emerald">
                  <CheckCircle2 size={13} />
                  <span>Đảm bảo an toàn khi cho thuê</span>
                </div>
              </div>
            </div>
          </section>

          {/* Error Banner nếu có lỗi API */}
          {errorMsg && (
            <div role="alert" className="pricing-alert-banner">
              <AlertCircle size={18} className="pricing-alert-icon" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Thanh Công Cụ Tìm Kiếm & Lọc Danh Mục */}
          <section className="pricing-filter-wrapper">
            <div className="pricing-filter-top">
              {/* Ô tìm kiếm */}
              <div className="pricing-search-container">
                <Search size={16} className="pricing-search-icon" />
                <input
                  type="text"
                  placeholder="Tìm theo mã trang phục, tên, thương hiệu..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Tìm kiếm trang phục"
                  className="pricing-search-input"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Xóa từ khóa tìm kiếm"
                    className="pricing-search-clear"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Bộ đếm kết quả */}
              <div className="pricing-filter-counter">
                <SlidersHorizontal size={14} />
                <span>
                  Hiển thị <strong>{filteredItems.length}</strong> / {items.length} mẫu trang phục
                </span>
              </div>
            </div>

            {/* Các nút bấm chọn nhanh danh mục */}
            <div className="pricing-categories-row">
              <span className="pricing-categories-title">Danh mục:</span>
              {categoryOptions.map((cat) => {
                const isActive = selectedCategory === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`pricing-category-pill ${isActive ? 'active' : ''}`}
                  >
                    <span>{cat.label}</span>
                    <span className="pricing-category-badge">{cat.count}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Bảng Danh Sách Trang Phục & Bảng Giá */}
          <PricingTable
            items={filteredItems}
            loading={loading}
            onOpenEdit={handleOpenEdit}
            onResetFilters={() => {
              setSearch('');
              setSelectedCategory('ALL');
            }}
            hasActiveFilters={Boolean(search || selectedCategory !== 'ALL')}
          />
        </main>
      </div>

      {/* Modal Cấu Hình Biểu Phí & Tiền Cọc Tự Động */}
      <PricingEditModal
        editingItem={editingItem}
        editForm={editForm}
        submitting={submitting}
        saveSuccess={saveSuccess}
        modalError={modalError}
        onClose={closeEditModal}
        onSave={handleSavePrice}
        onSalePriceChange={handleSalePriceChange}
        onRentalPercentChange={handleRentalPercentChange}
        onQuickRentalPercent={handleQuickRentalPercent}
        onDepositPercentChange={handleDepositPercentChange}
        onQuickDepositPercent={handleQuickDepositPercent}
      />
    </div>
  );
}
