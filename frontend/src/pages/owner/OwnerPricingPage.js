import { useState } from 'react';
import {
  RotateCcw,
  Sparkles,
  Calendar,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import PricingTable from './pricing/components/PricingTable';
import PricingEditModal from './pricing/components/PricingEditModal';
import PricingFilterBar from './pricing/components/PricingFilterBar';
import { usePricingData } from './pricing/hooks/usePricingData';
import { fmtCurrency } from './pricing/utils/pricingHelpers';

import '../../styles/OpsShops.css';
import '../../styles/ShopDashboard.css';
import '../../styles/ShopBranches.css';
import '../../styles/AdminDashboard.css';
import '../../styles/OwnerPricing.css';

// Re-export để đảm bảo tính tương thích ngược với các modules khác
export {
  calculateAmountByPercent,
  calculateDeposit,
  calculateRentalPrice,
  fmtCurrency,
  formatDate,
} from './pricing/utils/pricingHelpers';

/**
 * Controller View: Quản lý Biểu Phí, Giá Thuê & Tiền Cọc Chuỗi (Role: Shop Owner)
 * Cấu trúc giao diện đồng bộ hoàn toàn với hệ sinh thái Shop Owner (OwnerBranchesPage, OwnerPoliciesPage):
 * - Layout container: shop-dashboard-layout -> admin-main-viewport -> shop-main-content -> store-mgmt-container
 * - Bảng số liệu: clean-kpi-grid, clean-kpi-card
 * - Không thay đổi bất kỳ trường dữ liệu hoặc logic tính toán nào (salePrice, rentalPricePerDay, deposit)
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
    <div className="shop-dashboard-layout">
      {/* 1. Sidebar điều hướng Shop Owner */}
      <OwnerSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* 2. Khung nhìn chính của trang */}
      <div className="admin-main-viewport owner-branches-viewport">
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb="Cấu Hình Bảng Giá & Tiền Cọc Chuỗi"
        />

        <main className="shop-main-content owner-branches-main-content">
          <div className="store-mgmt-container owner-pricing-container">
            {/* Header & Tiêu đề trang chuẩn Shop Owner */}
            <div className="admin-page-hero d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4 border-bottom">
              <div>
                <h1 className="admin-page-title">
                  Cấu Hình Biểu Phí & Tiền Cọc Chuỗi
                </h1>
                <p className="admin-page-desc">
                  Toàn quyền cài đặt giá trị trang phục, tỷ lệ giá thuê theo ngày và mức tiền cọc bảo đảm áp dụng thống nhất cho toàn chuỗi showroom VESTORA.
                </p>
              </div>

              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-light text-dark border px-3 py-2">
                  Hiển thị <strong>{filteredItems.length}</strong> / {items.length} mẫu trang phục
                </span>

                <button
                  type="button"
                  className="btn-tail-outline owner-pricing-refresh-btn"
                  onClick={fetchProducts}
                  disabled={loading}
                  title="Tải lại danh sách từ hệ thống"
                  aria-label="Làm mới bảng giá"
                >
                  <RotateCcw size={14} className={loading ? 'spin-anim' : ''} />
                  <span>{loading ? 'Đang cập nhật...' : 'Làm mới'}</span>
                </button>
              </div>
            </div>

            {/* Thẻ Thống Kê KPI Chuẩn Hệ Thống */}
            <section aria-label="Thống kê tổng quan bảng giá" className="clean-kpi-grid mb-4">
              {/* KPI 1: Tổng mẫu */}
              <div className="clean-kpi-card">
                <div className="clean-kpi-icon">
                  <Sparkles size={18} />
                </div>
                <div className="clean-kpi-info">
                  <span className="clean-kpi-label">Tổng Mẫu Trang Phục</span>
                  <span className="clean-kpi-value">
                    {kpiStats.total} <span className="clean-kpi-unit">Mẫu</span>
                  </span>
                  <span className="clean-kpi-desc">Trang phục đang kinh doanh</span>
                </div>
              </div>

              {/* KPI 2: Giá thuê trung bình */}
              <div className="clean-kpi-card">
                <div className="clean-kpi-icon warning">
                  <Calendar size={18} />
                </div>
                <div className="clean-kpi-info">
                  <span className="clean-kpi-label">Giá Thuê Trung Bình</span>
                  <span className="clean-kpi-value text-amber">
                    {fmtCurrency(kpiStats.avgRental)}{' '}
                    <span className="clean-kpi-unit">/ ngày</span>
                  </span>
                  <span className="clean-kpi-desc">Tính theo ngày thuê thực tế</span>
                </div>
              </div>

              {/* KPI 3: Tiền cọc trung bình */}
              <div className="clean-kpi-card">
                <div className="clean-kpi-icon success">
                  <ShieldCheck size={18} />
                </div>
                <div className="clean-kpi-info">
                  <span className="clean-kpi-label">Tiền Cọc Trung Bình</span>
                  <span className="clean-kpi-value text-emerald">
                    {fmtCurrency(kpiStats.avgDeposit)}
                  </span>
                  <span className="clean-kpi-desc">Bảo đảm an toàn tài sản</span>
                </div>
              </div>
            </section>

            {/* Error Banner nếu có lỗi API */}
            {errorMsg ? (
              <div role="alert" className="pricing-alert-banner mb-4">
                <AlertCircle size={18} className="pricing-alert-icon" />
                <span>{errorMsg}</span>
              </div>
            ) : null}

            {/* Thanh Công Cụ Tìm Kiếm & Lọc Danh Mục */}
            <PricingFilterBar
              search={search}
              onSearchChange={setSearch}
              onClearSearch={() => setSearch('')}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              categoryOptions={categoryOptions}
              totalCount={items.length}
              filteredCount={filteredItems.length}
            />

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
          </div>
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
