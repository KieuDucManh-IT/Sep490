import React, { useState } from 'react';
import { Row, Col, Form, Spinner } from 'react-bootstrap';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import ImageLightboxModal from '../../components/ImageLightboxModal';

import { useBranchSettingsForm } from './settings/hooks/useBranchSettingsForm';
import BranchHeroCard from './settings/components/BranchHeroCard';
import BranchEmptyState from './settings/components/BranchEmptyState';
import BranchIdentityCard from './settings/components/BranchIdentityCard';
import BranchOperatingHoursCard from './settings/components/BranchOperatingHoursCard';
import BranchLocationCard from './settings/components/BranchLocationCard';
import BranchSettingsActionBar from './settings/components/BranchSettingsActionBar';

import '../../styles/ShopDashboard.css';
import '../../styles/ShopBranches.css';
import '../../styles/BranchSettings.css';

/**
 * Trang Cài Đặt Chi Nhánh Dành Cho Quản Lý Chi Nhánh (Branch Manager)
 */
export default function BranchSettingsPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const {
    shop,
    loading,
    saving,
    isLocating,
    isSyncingAddress,
    toast,
    setToast,
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
    fetchAssignedBranch,
  } = useBranchSettingsForm();

  return (
    <div className="shop-dashboard-layout">
      {/* Branch Manager Sidebar */}
      <BranchSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className="admin-main-viewport">
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb="Cửa Hàng & Ghim Map"
        />

        <main className="shop-main-content">
          <div className="store-mgmt-container pb-5">
            {/* Toast Notification */}
            {toast && (
              <div
                className={`alert alert-dismissible fade show d-flex align-items-center justify-content-between branch-toast ${
                  toast.type === 'error'
                    ? 'branch-toast-error'
                    : toast.type === 'warning'
                    ? 'branch-toast-warning'
                    : 'branch-toast-success'
                }`}
                role="alert"
              >
                <div className="d-flex align-items-center gap-2">
                  {toast.type === 'error' ? (
                    <AlertCircle size={18} className="flex-shrink-0" />
                  ) : toast.type === 'warning' ? (
                    <AlertTriangle size={18} className="flex-shrink-0" />
                  ) : (
                    <CheckCircle2 size={18} className="flex-shrink-0" />
                  )}
                  <div>{toast.message}</div>
                </div>
                <button
                  type="button"
                  className="btn-close branch-toast-close"
                  onClick={() => setToast(null)}
                  aria-label="Đóng thông báo"
                />
              </div>
            )}

            {/* Loading Indicator */}
            {loading ? (
              <div className="text-center py-5 my-5">
                <Spinner
                  animation="border"
                  variant="dark"
                  role="status"
                  className="mb-3"
                />
                <div className="text-muted small fw-medium">
                  Đang xác thực và tải thông tin cửa hàng của bạn...
                </div>
              </div>
            ) : !shop ? (
              /* Empty State: Unassigned Manager */
              <BranchEmptyState onRetry={() => fetchAssignedBranch()} />
            ) : (
              /* Main Form Content */
              <div>
                {/* Hero Showcase Card */}
                <BranchHeroCard
                  shop={shop}
                  formData={formData}
                  onOpenLightbox={setLightboxImage}
                />

                <Form onSubmit={handleSubmit} ref={formRef} noValidate>
                  <Row className="g-4 g-xl-5">
                    {/* Left Column: Branding, Contact & Hours */}
                    <Col lg={6}>
                      <BranchIdentityCard
                        formData={formData}
                        formErrors={formErrors}
                        shop={shop}
                        avatarFileRef={avatarFileRef}
                        bannerFileRef={bannerFileRef}
                        uploadingAvatar={uploadingAvatar}
                        uploadingBanner={uploadingBanner}
                        onFieldChange={handleFieldChange}
                        onUploadImageFile={handleUploadImageFile}
                        onOpenLightbox={setLightboxImage}
                      />

                      <BranchOperatingHoursCard
                        formData={formData}
                        formErrors={formErrors}
                        onFieldChange={handleFieldChange}
                      />
                    </Col>

                    {/* Right Column: Address, GPS, Interactive Map */}
                    <Col lg={6}>
                      <BranchLocationCard
                        formData={formData}
                        formErrors={formErrors}
                        provinces={provinces}
                        wards={wards}
                        loadingProvinces={loadingProvinces}
                        loadingWards={loadingWards}
                        isLocating={isLocating}
                        isSyncingAddress={isSyncingAddress}
                        onProvinceChange={handleProvinceChange}
                        onWardChange={handleWardChange}
                        onFieldChange={handleFieldChange}
                        onGetDeviceLocation={handleGetDeviceLocation}
                        onSyncAddressFromPin={handleSyncAddressFromPin}
                        onMapLocationChange={handleMapLocationChange}
                      />
                    </Col>
                  </Row>

                  {/* Sticky Floating Actions Bar */}
                  <BranchSettingsActionBar
                    isDirty={isDirty}
                    saving={saving}
                    onReset={handleReset}
                  />
                </Form>
              </div>
            )}
          </div>

          {/* Lightbox Modal for Image Preview */}
          <ImageLightboxModal
            show={Boolean(lightboxImage)}
            onHide={() => setLightboxImage(null)}
            imageUrl={
              lightboxImage?.url ||
              (typeof lightboxImage === 'string' ? lightboxImage : '')
            }
            title={lightboxImage?.title || 'Xem Ảnh Kích Thước Thật'}
          />
        </main>
      </div>
    </div>
  );
}
