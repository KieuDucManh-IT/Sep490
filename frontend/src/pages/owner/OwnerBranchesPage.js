import React, { useState } from 'react';
import { Row, Col, Spinner, Button } from 'react-bootstrap';
import { Store, CheckCircle2, Navigation, Users, Plus } from 'lucide-react';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import ImageLightboxModal from '../../components/ImageLightboxModal';

import { useProvincesWards } from './branches/hooks/useProvincesWards';
import { useBranchesData } from './branches/hooks/useBranchesData';
import { useBranchForm } from './branches/hooks/useBranchForm';

import BranchTaskbar from './branches/components/BranchTaskbar';
import BranchCard from './branches/components/BranchCard';
import BranchFormModal from './branches/components/BranchFormModal';
import DeleteBranchModal from './branches/components/DeleteBranchModal';
import BranchMapModal from './branches/components/BranchMapModal';

import '../../styles/OpsShops.css';
import '../../styles/ShopDashboard.css';
import '../../styles/ShopBranches.css';

/**
 * Controller View: Quản lý chi nhánh & bổ nhiệm Branch Manager (Role: Shop Owner)
 * Kết nối dữ liệu từ 3 custom hooks và điều phối hiển thị qua các sub-components độc lập.
 */
export default function OwnerBranchesPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formModalMode, setFormModalMode] = useState('create');
  const [activeBranch, setActiveBranch] = useState(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState(null);
  const [deletingBranch, setDeletingBranch] = useState(false);

  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [branchToViewMap, setBranchToViewMap] = useState(null);

  const {
    provinces,
    wards,
    setWards,
    loadingWards,
    fetchWardsByProvince,
  } = useProvincesWards();

  const {
    branches,
    filteredBranches,
    managers,
    loading,
    toast,
    showToast,
    searchTerm,
    setSearchTerm,
    selectedCity,
    setSelectedCity,
    selectedStatus,
    setSelectedStatus,
    showroomStats,
    loadData,
    handleToggleSuspend,
    handleDeleteBranch,
  } = useBranchesData();

  const {
    formData,
    formErrors,
    submitting,
    isLocating,
    isSyncingAddress,
    uploadingAvatar,
    uploadingBanner,
    isDraggingBanner,
    setIsDraggingBanner,
    resetForm,
    handleFieldChange,
    handleProvinceChange,
    handleMapLocationChange,
    handleSyncAddressFromPin,
    handleGetDeviceLocation,
    handleProcessUploadFile,
    handleSubmitForm,
  } = useBranchForm({
    provinces,
    fetchWardsByProvince,
    setWards,
    showToast,
    onSuccess: loadData,
  });

  const handleOpenCreateModal = () => {
    setActiveBranch(null);
    setFormModalMode('create');
    resetForm(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (branch) => {
    setActiveBranch(branch);
    setFormModalMode('edit');
    resetForm(branch);
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const isEdit = formModalMode === 'edit';
    const success = await handleSubmitForm(activeBranch?._id, isEdit);
    if (success) {
      setIsFormModalOpen(false);
    }
  };

  const handleOpenDeleteModal = (branch) => {
    setBranchToDelete(branch);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!branchToDelete) return;
    setDeletingBranch(true);
    const success = await handleDeleteBranch(branchToDelete);
    setDeletingBranch(false);
    if (success) {
      setIsDeleteModalOpen(false);
      setBranchToDelete(null);
    }
  };

  const handleOpenMapModal = (branch) => {
    setBranchToViewMap(branch);
    setIsMapModalOpen(true);
  };

  return (
    <div className="shop-dashboard-layout">
      <OwnerSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className="owner-branches-viewport">
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb="Quản Lý Chi Nhánh & Trụ Sở"
        />

        <main className="owner-branches-main-content">
          <div className="store-mgmt-container">
            <div className="admin-page-hero d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
              <div>
                <h1 className="admin-page-title">
                  Quản Lý Chi Nhánh & Trụ Sở
                </h1>
                <p className="admin-page-desc">
                  Quản lý hồ sơ thương hiệu, mạng lưới cửa hàng, định vị vị trí trên bản đồ và bổ nhiệm Quản lý chi nhánh phụ trách.
                </p>
              </div>
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-light text-dark border px-3 py-2">
                  Hiển thị <strong>{filteredBranches.length}</strong> / {branches.length} chi nhánh
                </span>
              </div>
            </div>

            <div className="clean-kpi-grid mb-3">
              <div className="clean-kpi-card">
                <div className="clean-kpi-icon">
                  <Store size={18} />
                </div>
                <div className="clean-kpi-info">
                  <span className="clean-kpi-label">Tổng Cơ Sở Showroom</span>
                  <span className="clean-kpi-value">{showroomStats.total}</span>
                  <span className="clean-kpi-desc">Mạng lưới toàn quốc</span>
                </div>
              </div>

              <div className="clean-kpi-card">
                <div className="clean-kpi-icon success">
                  <CheckCircle2 size={18} />
                </div>
                <div className="clean-kpi-info">
                  <span className="clean-kpi-label">Đang Hoạt Động</span>
                  <span className="clean-kpi-value">{showroomStats.active}</span>
                  <span className="clean-kpi-desc">
                    {showroomStats.total > 0
                      ? `${Math.round((showroomStats.active / showroomStats.total) * 100)}% sẵn sàng đón khách`
                      : 'Chưa có cơ sở'}
                  </span>
                </div>
              </div>

              <div className="clean-kpi-card">
                <div className="clean-kpi-icon primary">
                  <Navigation size={18} />
                </div>
                <div className="clean-kpi-info">
                  <span className="clean-kpi-label">Đã Có Vị Trí Bản Đồ</span>
                  <span className="clean-kpi-value">
                    {showroomStats.mapped} <span className="kpi-subtext">/ {showroomStats.total}</span>
                  </span>
                  <span className="clean-kpi-desc">Hiển thị trên bản đồ số</span>
                </div>
              </div>

              <div className="clean-kpi-card">
                <div className="clean-kpi-icon warning">
                  <Users size={18} />
                </div>
                <div className="clean-kpi-info">
                  <span className="clean-kpi-label">Bổ Nhiệm Quản Lý</span>
                  <span className="clean-kpi-value">
                    {showroomStats.staffed} <span className="kpi-subtext">/ {showroomStats.total}</span>
                  </span>
                  <span className="clean-kpi-desc">
                    {showroomStats.total - showroomStats.staffed > 0
                      ? `${showroomStats.total - showroomStats.staffed} cơ sở chưa có nhân sự`
                      : '100% đã có nhân sự phụ trách'}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-3">
              <BranchTaskbar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                selectedCity={selectedCity}
                onCityChange={setSelectedCity}
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
                onRefresh={loadData}
                onOpenCreateModal={handleOpenCreateModal}
                provinces={provinces}
              />
            </div>

            {loading ? (
              <div className="text-center py-5 my-5">
                <Spinner animation="border" variant="dark" role="status" className="mb-2" />
                <div className="text-muted small">Đang đồng bộ mạng lưới chi nhánh từ cơ sở dữ liệu...</div>
              </div>
            ) : filteredBranches.length === 0 ? (
              <div className="branch-empty-box">
                <div className="branch-empty-icon-wrap">
                  <Store size={24} />
                </div>
                <h5 className="branch-empty-title">Không Tìm Thấy Chi Nhánh Phù Hợp</h5>
                <p className="branch-empty-desc">
                  Không có chi nhánh nào khớp với bộ lọc tìm kiếm hiện tại. Hãy thử chọn điều kiện lọc khác hoặc khởi tạo thêm chi nhánh mới.
                </p>
                <Button variant="dark" size="sm" onClick={handleOpenCreateModal} className="btn-modal-primary">
                  <Plus size={14} className="me-1" />
                  <span>Khởi Tạo Chi Nhánh Ngay</span>
                </Button>
              </div>
            ) : (
              <Row className="g-4">
                {filteredBranches.map((branch) => (
                  <Col key={branch._id} md={6} lg={6} xl={6}>
                    <BranchCard
                      branch={branch}
                      onEdit={handleOpenEditModal}
                      onToggleSuspend={handleToggleSuspend}
                      onViewMap={handleOpenMapModal}
                      onDelete={handleOpenDeleteModal}
                      onOpenLightbox={setLightboxImage}
                    />
                  </Col>
                ))}
              </Row>
            )}
          </div>
        </main>
      </div>

      <BranchFormModal
        show={isFormModalOpen}
        onHide={() => setIsFormModalOpen(false)}
        mode={formModalMode}
        formData={formData}
        formErrors={formErrors}
        onFieldChange={handleFieldChange}
        onProvinceChange={handleProvinceChange}
        onMapLocationChange={handleMapLocationChange}
        onSyncAddressFromPin={handleSyncAddressFromPin}
        onGetDeviceLocation={handleGetDeviceLocation}
        onUploadImage={handleProcessUploadFile}
        onSubmit={handleFormSubmit}
        submitting={submitting}
        isLocating={isLocating}
        isSyncingAddress={isSyncingAddress}
        uploadingAvatar={uploadingAvatar}
        uploadingBanner={uploadingBanner}
        isDraggingBanner={isDraggingBanner}
        setIsDraggingBanner={setIsDraggingBanner}
        provinces={provinces}
        wards={wards}
        loadingWards={loadingWards}
        managers={managers}
        activeBranch={activeBranch}
      />

      <DeleteBranchModal
        show={isDeleteModalOpen}
        onHide={() => setIsDeleteModalOpen(false)}
        branch={branchToDelete}
        onConfirm={handleConfirmDelete}
        deleting={deletingBranch}
      />

      <BranchMapModal
        show={isMapModalOpen}
        onHide={() => setIsMapModalOpen(false)}
        branch={branchToViewMap}
      />

      <ImageLightboxModal
        show={Boolean(lightboxImage)}
        onHide={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url}
        title={lightboxImage?.title}
      />

      {toast && (
        <div className={`store-floating-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
