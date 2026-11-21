import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Row, Col, Spinner } from 'react-bootstrap';
import { RefreshCw, Sparkles, Plus } from 'lucide-react';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import PolicyNavList from './policies/components/PolicyNavList';
import PolicyEditorCard from './policies/components/PolicyEditorCard';
import CreatePolicyModal from './policies/components/CreatePolicyModal';
import ShopSettingsActionBar from './settings/components/ShopSettingsActionBar';
import {
  getMyPolicies,
  updateMyPolicies,
  createPolicy,
  deletePolicy,
} from '../../services/businessPolicyService';
import '../../styles/ShopDashboard.css';
import '../../styles/ShopBranches.css';
import '../../styles/AdminDashboard.css';
import '../../styles/OwnerPolicies.css';

/**
 * Chuẩn hóa danh sách chính sách thành mảng các đối tượng chính sách
 */
const normalizePoliciesArray = (raw) => {
  if (Array.isArray(raw)) {
    return raw.map((item, idx) => ({
      _id: item._id || item.id || `policy-${idx}`,
      title: item.title || '',
      summary: item.summary || '',
      content: item.content || '',
      isActive: item.isActive !== false,
    }));
  }
  if (raw && typeof raw === 'object') {
    return Object.entries(raw).map(([key, val], idx) => ({
      _id: val?._id || val?.id || key || `policy-${idx}`,
      title: val?.title || '',
      summary: val?.summary || '',
      content: val?.content || '',
      isActive: val?.isActive !== false,
    }));
  }
  return [];
};

export default function OwnerPoliciesPage() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeId, setActiveId] = useState('');

  const [policies, setPolicies] = useState([]);
  const [initialPolicies, setInitialPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState(null);

  // Tải dữ liệu chính sách từ Backend
  const fetchPoliciesData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyPolicies();
      const rawList = res?.data || res;
      const normalized = normalizePoliciesArray(rawList);

      setPolicies(normalized);
      setInitialPolicies(JSON.parse(JSON.stringify(normalized)));

      if (normalized.length > 0) {
        setActiveId((prev) => {
          const exists = normalized.some((p) => p._id === prev);
          return exists ? prev : normalized[0]._id;
        });
      } else {
        setActiveId('');
      }
    } catch (error) {
      setToast({
        type: 'danger',
        message: error.message || 'Không thể tải chính sách kinh doanh của chuỗi.',
      });
      setPolicies([]);
      setInitialPolicies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPoliciesData();
  }, [fetchPoliciesData]);

  // Kiểm tra trạng thái có thay đổi dữ liệu chưa lưu (isDirty)
  const isDirty = useMemo(() => {
    if (!policies || !initialPolicies) return false;
    return JSON.stringify(policies) !== JSON.stringify(initialPolicies);
  }, [policies, initialPolicies]);

  // Cảnh báo người dùng khi cố đóng tab / rời trang khi còn thay đổi chưa lưu
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  // Cập nhật từng trường của chính sách đang chọn
  const handleFieldChange = useCallback((id, field, value) => {
    setPolicies((prev) =>
      prev.map((item) => (item._id === id ? { ...item, [field]: value } : item))
    );
  }, []);

  // Khôi phục về dữ liệu ban đầu
  const handleReset = useCallback(() => {
    if (initialPolicies) {
      setPolicies(JSON.parse(JSON.stringify(initialPolicies)));
      setToast({
        type: 'info',
        message: 'Đã hoàn tác các thay đổi chưa lưu.',
      });
      setTimeout(() => setToast(null), 3000);
    }
  }, [initialPolicies]);

  // Lưu các chỉnh sửa chính sách lên máy chủ
  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!isDirty || saving) return;

    // Validate tên chính sách không được để trống
    const emptyIndex = policies.findIndex((p) => !p.title || !String(p.title).trim());
    if (emptyIndex !== -1) {
      const invalidPolicy = policies[emptyIndex];
      setToast({
        type: 'danger',
        message: `Tên chính sách (mục số ${emptyIndex + 1}) không được để trống. Vui lòng nhập tên chính sách trước khi lưu.`,
      });
      setActiveId(invalidPolicy._id);
      return;
    }

    // Validate tên chính sách không được trùng lặp
    const seenTitles = new Map();
    for (let i = 0; i < policies.length; i++) {
      const p = policies[i];
      const clean = String(p.title || '').trim().toLowerCase();
      if (seenTitles.has(clean)) {
        setToast({
          type: 'danger',
          message: `Tên chính sách "${p.title.trim()}" bị trùng lặp. Vui lòng đặt tên phân biệt trước khi lưu.`,
        });
        setActiveId(p._id);
        return;
      }
      seenTitles.set(clean, i);
    }

    setSaving(true);
    try {
      const res = await updateMyPolicies(policies);
      const rawList = res?.data || policies;
      const normalized = normalizePoliciesArray(rawList);

      setPolicies(normalized);
      setInitialPolicies(JSON.parse(JSON.stringify(normalized)));

      setToast({
        type: 'success',
        message: 'Lưu cấu hình chính sách kinh doanh toàn chuỗi thành công!',
      });
      setTimeout(() => setToast(null), 4000);
    } catch (error) {
      setToast({
        type: 'danger',
        message: error.message || 'Không thể lưu chính sách, vui lòng thử lại.',
      });
    } finally {
      setSaving(false);
    }
  };

  // Tạo mới chính sách (Create Policy)
  const handleCreatePolicy = async (newPolicyData) => {
    setCreating(true);
    try {
      const res = await createPolicy(newPolicyData);
      const createdItem = res?.data || newPolicyData;
      const normalizedCreated = {
        _id: createdItem._id || `policy-${Date.now()}`,
        title: createdItem.title || '',
        summary: createdItem.summary || '',
        content: createdItem.content || '',
        isActive: createdItem.isActive !== false,
      };

      setPolicies((prev) => {
        const updated = [...prev, normalizedCreated];
        setInitialPolicies(JSON.parse(JSON.stringify(updated)));
        return updated;
      });

      setActiveId(normalizedCreated._id);
      setShowCreateModal(false);

      setToast({
        type: 'success',
        message: `Đã tạo chính sách "${normalizedCreated.title}" thành công!`,
      });
      setTimeout(() => setToast(null), 4000);
    } catch (error) {
      setToast({
        type: 'danger',
        message: error.message || 'Không thể tạo chính sách mới.',
      });
    } finally {
      setCreating(false);
    }
  };

  // Xóa chính sách (Delete Policy)
  const handleDeletePolicy = async (idToDelete) => {
    if (!idToDelete || deleting) return;

    setDeleting(true);
    try {
      const res = await deletePolicy(idToDelete);
      const rawList = res?.data;
      let remainingList;
      if (Array.isArray(rawList)) {
        remainingList = normalizePoliciesArray(rawList);
      } else {
        remainingList = policies.filter((p) => String(p._id) !== String(idToDelete));
      }

      setPolicies(remainingList);
      setInitialPolicies(JSON.parse(JSON.stringify(remainingList)));

      if (String(activeId) === String(idToDelete) || !remainingList.some((p) => String(p._id) === String(activeId))) {
        setActiveId(remainingList.length > 0 ? remainingList[0]._id : '');
      }

      setToast({
        type: 'success',
        message: 'Đã xóa chính sách thành công khỏi chuỗi.',
      });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      setToast({
        type: 'danger',
        message: error.message || 'Không thể xóa chính sách.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const activePolicyData = useMemo(() => {
    return policies.find((p) => p._id === activeId) || policies[0] || null;
  }, [policies, activeId]);

  return (
    <div className="shop-dashboard-layout">
      {/* 1. Sidebar Quản Trị Shop Owner */}
      <OwnerSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* 2. Khung nhìn chính của trang */}
      <div className="admin-main-viewport owner-branches-viewport">
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb="Chính Sách Vận Hành Chuỗi"
        />

        <main className="shop-main-content owner-branches-main-content">
          <div className="store-mgmt-container owner-policies-container">
            {/* Tiêu đề trang & Tác vụ nhanh */}
            <div className="admin-page-hero d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4 border-bottom">
              <div>
                <h1 className="admin-page-title">
                  Cấu Hình Chính Sách Kinh Doanh Chuỗi
                </h1>
                <p className="admin-page-desc">
                  Toàn quyền tạo mới, chỉnh sửa, xem và xóa các chính sách hoạt động áp dụng thống nhất cho toàn chuỗi showroom VESTORA.
                </p>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="taskbar-add-btn"
                  onClick={() => setShowCreateModal(true)}
                  disabled={loading}
                  title="Tạo thêm chính sách mới cho chuỗi"
                >
                  <Plus size={15} />
                  <span>Tạo Chính Sách Mới</span>
                </button>

                <button
                  type="button"
                  className="taskbar-refresh-btn"
                  onClick={fetchPoliciesData}
                  disabled={loading}
                  title="Tải lại dữ liệu từ máy chủ"
                >
                  <RefreshCw size={14} className={loading ? 'fa-spin' : ''} />
                </button>
              </div>
            </div>

            {/* Trạng thái tải dữ liệu */}
            {loading ? (
              <div className="text-center py-5 my-5">
                <Spinner animation="border" variant="dark" role="status" className="mb-2" />
                <div className="text-muted small">Đang tải chính sách hoạt động của chuỗi...</div>
              </div>
            ) : policies.length === 0 ? (
              /* Trạng thái chưa có chính sách nào */
              <div className="owner-policies-empty-card">
                <div className="owner-policies-empty-icon-wrapper" aria-hidden="true">
                  <Sparkles size={36} />
                </div>
                <h2 className="owner-policies-empty-title">
                  Chưa Có Chính Sách Kinh Doanh Nào
                </h2>
                <p className="owner-policies-empty-desc">
                  Chuỗi hiện chưa thiết lập chính sách hoạt động nào. Hãy tạo chính sách đầu tiên (ví dụ: Chính sách thuê đồ, đặt cọc, đổi trả) để hiển thị tới khách hàng.
                </p>
                <div className="owner-policies-empty-actions">
                  <button
                    type="button"
                    className="taskbar-add-btn"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Plus size={15} />
                    <span>Tạo Chính Sách Đầu Tiên</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Danh sách và Trình soạn thảo chính sách */
              <form onSubmit={handleSave}>
                <Row className="g-4">
                  {/* Cột trái: Danh mục các chính sách */}
                  <Col lg={4} md={5}>
                    <PolicyNavList
                      policies={policies}
                      activeId={activeId}
                      onSelectId={setActiveId}
                      onOpenCreateModal={() => setShowCreateModal(true)}
                    />
                  </Col>

                  {/* Cột phải: Form biên tập nội dung chính sách đang chọn */}
                  <Col lg={8} md={7}>
                    {activePolicyData ? (
                      <PolicyEditorCard
                        activeId={activePolicyData._id}
                        policyData={activePolicyData}
                        policies={policies}
                        onChangeField={handleFieldChange}
                        onDeletePolicy={handleDeletePolicy}
                        isDeleting={deleting}
                      />
                    ) : null}
                  </Col>
                </Row>

                {/* Thanh tác vụ nổi (Sticky Bottom Action Bar) */}
                <ShopSettingsActionBar
                  isDirty={isDirty}
                  saving={saving}
                  onReset={handleReset}
                />
              </form>
            )}
          </div>
        </main>
      </div>

      {/* Modal Tạo Chính Sách Mới */}
      <CreatePolicyModal
        show={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        onCreate={handleCreatePolicy}
        isCreating={creating}
        existingPolicies={policies}
      />

      {/* Thông báo dạng Toast nổi */}
      {toast ? (
        <div className={`store-floating-toast ${toast.type}`} role="status" aria-live="polite">
          <span>{toast.type === 'success' ? '✓' : toast.type === 'danger' ? '⚠️' : 'ℹ️'}</span>
          <span>{toast.message}</span>
        </div>
      ) : null}
    </div>
  );
}
