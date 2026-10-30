import React, { useState } from 'react';
import { Row, Col, Form, Spinner } from 'react-bootstrap';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import BranchSidebar from '../../components/BranchSidebar';
import ImageLightboxModal from '../../components/ImageLightboxModal';
import { useAuth } from '../../context/AuthContext';
import { useShopSettingsForm } from './settings/hooks/useShopSettingsForm';
import ShopIdentityCard from './settings/components/ShopIdentityCard';
import ShopLocationCard from './settings/components/ShopLocationCard';
import ShopSettingsActionBar from './settings/components/ShopSettingsActionBar';
import '../../styles/ShopDashboard.css';
import '../../styles/ShopBranches.css';

export default function OwnerSettingsPage() {
  const { user } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const {
    shop,
    loading,
    saving,
    isLocating,
    isSyncingAddress,
    toast,
    formErrors,
    formData,
    provinces,
    wards,
    loadingProvinces,
    loadingWards,
    avatarFileRef,
    bannerFileRef,
    uploadingAvatar,
    uploadingBanner,
    lightboxImage,
    setLightboxImage,
    isDirty,
    formRef,
    handleFieldChange,
    handleProvinceChange,
    handleWardChange,
    handleMapLocationChange,
    handleSyncAddressFromPin,
    handleGetDeviceLocation,
    handleUploadImageFile,
    handleReset,
    handleSubmit,
  } = useShopSettingsForm();

  const isActive = Boolean(formData.isOpen);
  const isBranchManager = /branch_manager/i.test(
    user?.roleName || user?.Role || user?.role || ''
  );

  return (
    <div className="shop-dashboard-layout">
      {/* 1. Sidebar điều hướng theo quyền hạn */}
      {isBranchManager ? (
        <BranchSidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      ) : (
        <OwnerSidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      )}

      {/* 2. Khung nhìn chính của trang */}
      <div className="admin-main-viewport owner-branches-viewport">
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb="Hồ Sơ Cửa Hàng & Ghim Map"
        />

        <main className="shop-main-content owner-branches-main-content">
          <div className="store-mgmt-container">
            {/* Tiêu đề & Trạng thái hoạt động */}
            <div className="admin-page-hero d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4 border-bottom">
              <div>
                <h1 className="admin-page-title">
                  {isBranchManager
                    ? 'Hồ Sơ Showroom Chi Nhánh & Ghim Map'
                    : 'Quản Lý Thông Tin Cửa Hàng'}
                </h1>
                <p className="admin-page-desc">
                  {isBranchManager
                    ? 'Cập nhật hotline, giờ mở cửa, giới thiệu và định vị tọa độ GPS showroom phục vụ khách thử đồ và giao hàng.'
                    : 'Cập nhật thông tin thương hiệu, hotline liên hệ, địa chỉ và định vị showroom trên bản đồ trực quan.'}
                </p>
              </div>

              <div className="d-flex align-items-center gap-3">
                <span className={`store-pill-active ${!isActive ? 'inactive' : ''}`}>
                  ● {isActive ? 'ĐANG HOẠT ĐỘNG' : 'TẠM NGHỈ'}
                </span>
              </div>
            </div>

            {/* Trạng thái tải dữ liệu */}
            {loading ? (
              <div className="text-center py-5 my-5">
                <Spinner animation="border" variant="dark" role="status" className="mb-2" />
                <div className="text-muted small">Đang tải hồ sơ cửa hàng từ hệ thống...</div>
              </div>
            ) : (
              <Form onSubmit={handleSubmit} ref={formRef}>
                <Row className="g-4">
                  {/* Cột trái: Thông tin nhận diện thương hiệu, Hotline & Giờ mở cửa */}
                  <Col lg={6}>
                    <ShopIdentityCard
                      formData={formData}
                      formErrors={formErrors}
                      shop={shop}
                      isActive={isActive}
                      uploadingAvatar={uploadingAvatar}
                      uploadingBanner={uploadingBanner}
                      avatarFileRef={avatarFileRef}
                      bannerFileRef={bannerFileRef}
                      onFieldChange={handleFieldChange}
                      onUploadImageFile={handleUploadImageFile}
                      onOpenLightbox={(img) => setLightboxImage(img)}
                    />
                  </Col>

                  {/* Cột phải: Địa chỉ hành chính & Bản đồ định vị GPS */}
                  <Col lg={6}>
                    <ShopLocationCard
                      formData={formData}
                      formErrors={formErrors}
                      provinces={provinces}
                      wards={wards}
                      loadingProvinces={loadingProvinces}
                      loadingWards={loadingWards}
                      isLocating={isLocating}
                      isSyncingAddress={isSyncingAddress}
                      onFieldChange={handleFieldChange}
                      onProvinceChange={handleProvinceChange}
                      onWardChange={handleWardChange}
                      onMapLocationChange={handleMapLocationChange}
                      onSyncAddressFromPin={handleSyncAddressFromPin}
                      onGetDeviceLocation={handleGetDeviceLocation}
                    />
                  </Col>
                </Row>

                {/* Thanh tác vụ nổi (Floating Action Bar) */}
                <ShopSettingsActionBar
                  isDirty={isDirty}
                  saving={saving}
                  onReset={handleReset}
                />
              </Form>
            )}
          </div>
        </main>
      </div>

      {/* Thông báo dạng Toast nổi */}
      {toast && (
        <div className={`store-floating-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Modal xem ảnh kích thước đầy đủ (Lightbox) */}
      <ImageLightboxModal
        show={Boolean(lightboxImage)}
        onHide={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url}
        title={lightboxImage?.title}
      />
    </div>
  );
}
