import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Row, Col, Spinner, Button, Modal, Form } from 'react-bootstrap';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import LeafletMapPicker from '../../components/LeafletMapPicker';
import { useAuth } from '../../context/AuthContext';
import {
  getBranchesListApi,
  createBranchApi,
  updateBranchInfoApi,
  deleteBranchApi,
  getBranchManagersApi,
  getMyShopApi,
} from '../../services/shopApi';
import '../../styles/OpsShops.css';
import '../../styles/ShopDashboard.css';
import '../../styles/ShopBranches.css';

const VIETNAM_CITIES = [
  'Thành phố Hà Nội',
  'Thành phố Hồ Chí Minh',
  'Thành phố Đà Nẵng',
  'Thành phố Hải Phòng',
  'Thành phố Cần Thơ',
  'Thành phố Huế',
  'Tỉnh Quảng Ninh',
  'Tỉnh Khánh Hòa',
  'Tỉnh Lâm Đồng',
  'Thành phố Đồng Nai',
  'Tỉnh Bắc Ninh',
];

export default function OwnerBranchesPage() {
  const { user } = useAuth();

  // Active Tab: 'BRANCHES' (Mạng lưới chi nhánh) | 'PROFILE' (Hồ sơ cửa hàng & Trụ sở HQ)
  const [activeTab, setActiveTab] = useState('BRANCHES');

  const [branches, setBranches] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Tab 1: Shop Profile & HQ state
  const [hqShop, setHqShop] = useState(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    description: '',
    address: '',
    city: 'Thành phố Hà Nội',
    ward: '',
    district: '',
    latitude: '',
    longitude: '',
    openingHours: '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
    status: 'ACTIVE',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Tab 2: Branches Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  const [activeBranch, setActiveBranch] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state for Create / Edit Branch
  const initialBranchFormData = {
    name: '',
    phone: '',
    openingHours: '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
    description: '',
    address: '',
    city: 'Thành phố Hà Nội',
    ward: '',
    latitude: '',
    longitude: '',
    managerId: '',
    isHQ: false,
    status: 'ACTIVE',
  };
  const [formData, setFormData] = useState(initialBranchFormData);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getOwnerId = useCallback(() => {
    if (user?._id || user?.id || user?.UserId) {
      return String(user._id || user.id || user.UserId);
    }
    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u._id || u.UserId || u.id) return String(u._id || u.UserId || u.id);
      }
    } catch (_) {}
    return null;
  }, [user]);

  // Load Branches, Managers & HQ Profile
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const ownerId = getOwnerId();
      const [branchesRes, managersRes, myShopRes] = await Promise.all([
        getBranchesListApi({ limit: 100 }),
        getBranchManagersApi().catch(() => ({ success: true, data: [] })),
        getMyShopApi(ownerId).catch(() => null),
      ]);

      const branchesList = (branchesRes?.success && Array.isArray(branchesRes.data)) ? branchesRes.data : [];
      setBranches(branchesList);

      if (managersRes?.success && Array.isArray(managersRes.data)) {
        setManagers(managersRes.data);
      }

      // Determine HQ shop for Tab 1
      const foundHQ = branchesList.find((b) => b.isHQ) || myShopRes?.data || branchesList[0] || null;
      setHqShop(foundHQ);

      if (foundHQ) {
        setProfileForm({
          name: foundHQ.name || '',
          phone: foundHQ.phone || '',
          description: foundHQ.description || '',
          address: foundHQ.address || '',
          city: foundHQ.city || 'Thành phố Hà Nội',
          ward: foundHQ.ward || '',
          district: foundHQ.district || '',
          latitude: foundHQ.latitude != null ? String(foundHQ.latitude) : '',
          longitude: foundHQ.longitude != null ? String(foundHQ.longitude) : '',
          openingHours: foundHQ.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
          status: foundHQ.status || 'ACTIVE',
        });
      }
    } catch (err) {
      showToast(err.message || 'Không thể tải dữ liệu chi nhánh.', 'warning');
    } finally {
      setLoading(false);
    }
  }, [getOwnerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered branches for Tab 2
  const filteredBranches = useMemo(() => {
    return branches.filter((b) => {
      if (selectedStatus !== 'ALL' && b.status !== selectedStatus) return false;
      if (selectedCity !== 'ALL') {
        const cityMatch = (b.city || '').toLowerCase().includes(selectedCity.toLowerCase()) ||
          selectedCity.toLowerCase().includes((b.city || '').toLowerCase());
        if (!cityMatch) return false;
      }
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const nameMatch = (b.name || '').toLowerCase().includes(term);
        const addressMatch = (b.address || '').toLowerCase().includes(term);
        const phoneMatch = (b.phone || '').toLowerCase().includes(term);
        const managerMatch = b.managerId?.FullName?.toLowerCase().includes(term) ||
          b.managerId?.Email?.toLowerCase().includes(term);
        if (!nameMatch && !addressMatch && !phoneMatch && !managerMatch) return false;
      }
      return true;
    });
  }, [branches, selectedStatus, selectedCity, searchTerm]);

  // KPIs
  const stats = useMemo(() => {
    const total = branches.length;
    const active = branches.filter((b) => b.status === 'ACTIVE').length;
    const suspended = branches.filter((b) => b.status === 'SUSPENDED').length;
    const withManager = branches.filter((b) => Boolean(b.managerId)).length;
    const citiesCount = new Set(branches.map((b) => b.city).filter(Boolean)).size;
    return { total, active, suspended, withManager, citiesCount };
  }, [branches]);

  // Handle Tab 1 Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!hqShop?._id) {
      showToast('Chưa xác định được hồ sơ Trụ sở chính.', 'warning');
      return;
    }
    if (!profileForm.name?.trim()) {
      showToast('Tên thương hiệu cửa hàng là bắt buộc.', 'warning');
      return;
    }
    if (!profileForm.phone?.trim()) {
      showToast('Hotline liên hệ là bắt buộc.', 'warning');
      return;
    }

    setSavingProfile(true);
    try {
      const payload = {
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        description: profileForm.description.trim(),
        address: profileForm.address.trim(),
        city: profileForm.city.trim(),
        ward: profileForm.ward.trim(),
        latitude: profileForm.latitude ? parseFloat(profileForm.latitude) : null,
        longitude: profileForm.longitude ? parseFloat(profileForm.longitude) : null,
        openingHours: profileForm.openingHours.trim(),
        status: profileForm.status,
      };

      const res = await updateBranchInfoApi(hqShop._id, payload);
      if (res?.success) {
        showToast('Cập nhật hồ sơ thương hiệu và trụ sở chính thành công!', 'success');
        loadData();
      } else {
        throw new Error(res?.message || 'Không thể lưu hồ sơ cửa hàng.');
      }
    } catch (err) {
      showToast(err.message || 'Lỗi khi lưu thông tin cửa hàng.', 'warning');
    } finally {
      setSavingProfile(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setFormData({
      ...initialBranchFormData,
      ownerId: getOwnerId(),
    });
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (branch) => {
    setActiveBranch(branch);
    setFormData({
      name: branch.name || '',
      phone: branch.phone || '',
      openingHours: branch.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
      description: branch.description || '',
      address: branch.address || '',
      city: branch.city || 'Thành phố Hà Nội',
      ward: branch.ward || '',
      latitude: branch.latitude != null ? String(branch.latitude) : '',
      longitude: branch.longitude != null ? String(branch.longitude) : '',
      managerId: branch.managerId?._id ? String(branch.managerId._id) : '',
      isHQ: Boolean(branch.isHQ),
      status: branch.status || 'ACTIVE',
    });
    setShowEditModal(true);
  };

  // Open Delete Modal
  const handleOpenDeleteModal = (branch) => {
    setActiveBranch(branch);
    setShowDeleteModal(true);
  };

  // Open Map Preview Modal
  const handleOpenMapModal = (branch) => {
    setActiveBranch(branch);
    setShowMapModal(true);
  };

  // Submit Create Branch
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      showToast('Tên chi nhánh là bắt buộc.', 'warning');
      return;
    }
    if (!formData.phone?.trim()) {
      showToast('Hotline liên hệ là bắt buộc.', 'warning');
      return;
    }
    if (!formData.city?.trim()) {
      showToast('Tỉnh / Thành phố là bắt buộc.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        openingHours: formData.openingHours.trim(),
        description: formData.description.trim() || 'Showroom thời trang dạ tiệc và thiết kế cao cấp Vestora.',
        address: formData.address.trim(),
        city: formData.city.trim(),
        ward: formData.ward.trim(),
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        managerId: formData.managerId ? formData.managerId : null,
        isHQ: Boolean(formData.isHQ),
        ownerId: getOwnerId(),
      };

      const res = await createBranchApi(payload);
      if (res?.success) {
        showToast(res.message || 'Khởi tạo chi nhánh mới thành công!', 'success');
        setShowCreateModal(false);
        loadData();
      } else {
        throw new Error(res?.message || 'Không thể tạo chi nhánh.');
      }
    } catch (err) {
      showToast(err.message || 'Lỗi khi tạo chi nhánh.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Branch
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!activeBranch?._id) return;

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        openingHours: formData.openingHours.trim(),
        description: formData.description.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        ward: formData.ward.trim(),
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        managerId: formData.managerId ? formData.managerId : null,
        isHQ: Boolean(formData.isHQ),
        status: formData.status,
      };

      const res = await updateBranchInfoApi(activeBranch._id, payload);
      if (res?.success) {
        showToast(res.message || 'Cập nhật thông tin chi nhánh thành công!', 'success');
        setShowEditModal(false);
        loadData();
      } else {
        throw new Error(res?.message || 'Không thể cập nhật chi nhánh.');
      }
    } catch (err) {
      showToast(err.message || 'Lỗi khi cập nhật chi nhánh.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Branch Operating Status
  const handleToggleStatus = async (branch) => {
    const nextStatus = branch.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const res = await updateBranchInfoApi(branch._id, { status: nextStatus });
      if (res?.success) {
        showToast(
          nextStatus === 'ACTIVE'
            ? `Đã mở cửa chi nhánh "${branch.name}".`
            : `Đã tạm ngưng chi nhánh "${branch.name}".`,
          'success'
        );
        loadData();
      }
    } catch (err) {
      showToast(err.message || 'Không thể thay đổi trạng thái chi nhánh.', 'warning');
    }
  };

  // Confirm Delete Branch
  const handleDeleteSubmit = async () => {
    if (!activeBranch?._id) return;
    if (activeBranch.isHQ) {
      showToast('Không thể xóa Trụ sở chính (HQ). Hãy chỉ định chi nhánh khác làm HQ trước.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await deleteBranchApi(activeBranch._id);
      if (res?.success) {
        showToast(res.message || 'Đã xóa chi nhánh thành công.', 'success');
        setShowDeleteModal(false);
        loadData();
      } else {
        throw new Error(res?.message || 'Không thể xóa chi nhánh.');
      }
    } catch (err) {
      showToast(err.message || 'Lỗi khi xóa chi nhánh.', 'warning');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shop-dashboard-layout">
      {/* Sidebar for Shop Manager */}
      <OwnerSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Content Area */}
      <main className="shop-main-content">
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        <div className="store-mgmt-container" style={{ padding: '28px 36px', maxWidth: '1440px', margin: '0 auto' }}>
          {/* Breadcrumb Navigation */}
          <div className="store-mgmt-breadcrumb mb-3">
            <Link to="/owner/dashboard">Tổng Quan Chuỗi</Link>
            <span>›</span>
            <span>Mô-đun Quản Trị Chuỗi (Chain Management)</span>
            <span>›</span>
            <span style={{ color: '#171717', fontWeight: 600 }}>Shop & Branch Management</span>
          </div>

          {/* Top Header Bar */}
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4 border-bottom">
            <div>
              <div className="d-flex align-items-center gap-2 mb-1">
                <span className="badge" style={{ background: '#D97706', color: '#FFF', fontWeight: 700, fontSize: '11px', letterSpacing: '0.8px' }}>
                  SHOP MANAGER / TỔNG QUẢN LÝ CHUỖI
                </span>
                <span className="text-muted small">• Toàn quyền Quản trị Hồ sơ & Mạng lưới Chi nhánh</span>
              </div>
              <h1 className="store-mgmt-title" style={{ fontSize: '26px', fontWeight: 700, margin: 0, color: '#111827', letterSpacing: '-0.3px' }}>
                Shop & Branch Management
              </h1>
              <p className="store-mgmt-desc text-muted mb-0" style={{ fontSize: '13.5px', marginTop: '4px' }}>
                Quản lý hồ sơ thương hiệu, địa chỉ, tọa độ GPS, giờ mở cửa, bổ nhiệm Branch Manager và trạng thái vận hành của từng cơ sở.
              </p>
            </div>

            {/* Quick Action in Header */}
            {activeTab === 'BRANCHES' && (
              <Button
                variant="dark"
                size="sm"
                onClick={handleOpenCreateModal}
                className="d-inline-flex align-items-center gap-2"
                style={{ fontSize: '12.5px', fontWeight: 600, borderRadius: '8px', padding: '8px 18px', background: '#18181B', border: '1px solid #27272A', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>+ Thêm Chi Nhánh Mới</span>
              </Button>
            )}
          </div>

          {/* 2-TAB SWITCHER NAVIGATION BAR */}
          <div className="store-tabs-nav">
            <button
              type="button"
              className={`store-tab-button ${activeTab === 'PROFILE' ? 'active' : ''}`}
              onClick={() => setActiveTab('PROFILE')}
            >
              <span>🏛️</span>
              <span>Tab 1: Hồ Sơ Cửa Hàng & Trụ Sở Chính (Shop Profile & HQ)</span>
            </button>

            <button
              type="button"
              className={`store-tab-button ${activeTab === 'BRANCHES' ? 'active' : ''}`}
              onClick={() => setActiveTab('BRANCHES')}
            >
              <span>🏬</span>
              <span>Tab 2: Mạng Lưới Chi Nhánh & Quản Lý ({branches.length} Chi Nhánh)</span>
            </button>
          </div>

          {/* ========================================================
              TAB 1: SHOP PROFILE & HEADQUARTERS
              ======================================================== */}
          {activeTab === 'PROFILE' && (
            <div>
              {loading ? (
                <div className="text-center py-5 my-5">
                  <Spinner animation="border" variant="dark" role="status" className="mb-2" />
                  <div className="text-muted small">Đang tải hồ sơ thương hiệu và trụ sở chính...</div>
                </div>
              ) : (
                <Form onSubmit={handleSaveProfile}>
                  <Row className="g-4">
                    {/* Left Column: Brand Info */}
                    <Col lg={6}>
                      <div className="p-4 bg-white rounded-3 h-100" style={{ border: '1px solid #ECE7DD', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                        <div className="d-flex align-items-center justify-content-between pb-3 border-bottom mb-3">
                          <h5 className="fw-bold mb-0" style={{ fontSize: '17px', color: '#111827' }}>
                            Thông Tin Thương Hiệu Chung
                          </h5>
                          <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', fontSize: '11px', fontWeight: 700 }}>
                            ★ TRỤ SỞ ĐẦU NÃO
                          </span>
                        </div>

                        <Form.Group className="mb-3">
                          <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                            Tên Thương Hiệu / Cửa Hàng <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="text"
                            required
                            value={profileForm.name}
                            onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                            style={{ fontSize: '13px' }}
                          />
                        </Form.Group>

                        <Row className="g-3 mb-3">
                          <Col sm={6}>
                            <Form.Group>
                              <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                                Hotline Chính <span className="text-danger">*</span>
                              </Form.Label>
                              <Form.Control
                                type="text"
                                required
                                value={profileForm.phone}
                                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                                style={{ fontSize: '13px' }}
                              />
                            </Form.Group>
                          </Col>

                          <Col sm={6}>
                            <Form.Group>
                              <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                                Trạng Thái Thương Hiệu
                              </Form.Label>
                              <Form.Select
                                value={profileForm.status}
                                onChange={(e) => setProfileForm({ ...profileForm, status: e.target.value })}
                                style={{ fontSize: '13px' }}
                              >
                                <option value="ACTIVE">Đang Hoạt Động (Mở Cửa)</option>
                                <option value="SUSPENDED">Tạm Dừng Hoạt Động</option>
                              </Form.Select>
                            </Form.Group>
                          </Col>
                        </Row>

                        <Form.Group className="mb-3">
                          <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                            Khung Giờ Mở Cửa Tiêu Chuẩn
                          </Form.Label>
                          <Form.Control
                            type="text"
                            value={profileForm.openingHours}
                            onChange={(e) => setProfileForm({ ...profileForm, openingHours: e.target.value })}
                            style={{ fontSize: '13px' }}
                          />
                        </Form.Group>

                        <Form.Group className="mb-3">
                          <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                            Mô Tả / Giới Thiệu Chuỗi Thời Trang
                          </Form.Label>
                          <Form.Control
                            as="textarea"
                            rows={4}
                            value={profileForm.description}
                            onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
                            placeholder="Giới thiệu về dịch vụ cho thuê & may đo thời trang dạ tiệc Vestora..."
                            style={{ fontSize: '13px', lineHeight: '1.6' }}
                          />
                        </Form.Group>

                        <div className="pt-2">
                          <Button
                            type="submit"
                            variant="dark"
                            disabled={savingProfile}
                            style={{ padding: '9px 24px', fontWeight: 600, fontSize: '13px', borderRadius: '8px', background: '#18181B' }}
                          >
                            {savingProfile ? <Spinner size="sm" animation="border" className="me-2" /> : null}
                            Lưu Cập Nhật Hồ Sơ Cửa Hàng
                          </Button>
                        </div>
                      </div>
                    </Col>

                    {/* Right Column: HQ Address & GPS Map */}
                    <Col lg={6}>
                      <div className="p-4 bg-white rounded-3 h-100" style={{ border: '1px solid #ECE7DD', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                        <div className="d-flex align-items-center justify-content-between pb-3 border-bottom mb-3">
                          <h5 className="fw-bold mb-0" style={{ fontSize: '17px', color: '#111827' }}>
                            Địa Chỉ & Định Vị Trụ Sở Chính (HQ)
                          </h5>
                          <span className="badge bg-light text-muted border" style={{ fontSize: '11px' }}>
                            GPS LEAFLET MAP
                          </span>
                        </div>

                        <Row className="g-3 mb-3">
                          <Col sm={6}>
                            <Form.Group>
                              <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                                Tỉnh / Thành Phố <span className="text-danger">*</span>
                              </Form.Label>
                              <Form.Select
                                required
                                value={profileForm.city}
                                onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                                style={{ fontSize: '13px' }}
                              >
                                {VIETNAM_CITIES.map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </Form.Select>
                            </Form.Group>
                          </Col>

                          <Col sm={6}>
                            <Form.Group>
                              <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                                Phường / Xã / Quận
                              </Form.Label>
                              <Form.Control
                                type="text"
                                value={profileForm.ward}
                                onChange={(e) => setProfileForm({ ...profileForm, ward: e.target.value })}
                                style={{ fontSize: '13px' }}
                              />
                            </Form.Group>
                          </Col>
                        </Row>

                        <Form.Group className="mb-3">
                          <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                            Địa Chỉ Chi Tiết Số Nhà, Phố
                          </Form.Label>
                          <Form.Control
                            type="text"
                            value={profileForm.address}
                            onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                            style={{ fontSize: '13px' }}
                          />
                        </Form.Group>

                        {/* Interactive Leaflet Map for HQ */}
                        <div className="mb-3">
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <Form.Label style={{ fontSize: '12.5px', fontWeight: 600, margin: 0 }}>
                              Ghim Vị Trí Trụ Sở Trên Bản Đồ
                            </Form.Label>
                            <span className="text-muted small" style={{ fontSize: '11px' }}>
                              Click trên map để di chuyển ghim
                            </span>
                          </div>

                          <LeafletMapPicker
                            latitude={profileForm.latitude}
                            longitude={profileForm.longitude}
                            height="260px"
                            onChange={({ latitude, longitude }) => {
                              setProfileForm((prev) => ({
                                ...prev,
                                latitude: String(latitude),
                                longitude: String(longitude),
                              }));
                            }}
                          />

                          <Row className="g-2 mt-2">
                            <Col sm={6}>
                              <Form.Control
                                size="sm"
                                placeholder="Vĩ độ (Latitude)"
                                value={profileForm.latitude}
                                onChange={(e) => setProfileForm({ ...profileForm, latitude: e.target.value })}
                                style={{ fontSize: '12px', fontFamily: 'monospace' }}
                              />
                            </Col>
                            <Col sm={6}>
                              <Form.Control
                                size="sm"
                                placeholder="Kinh độ (Longitude)"
                                value={profileForm.longitude}
                                onChange={(e) => setProfileForm({ ...profileForm, longitude: e.target.value })}
                                style={{ fontSize: '12px', fontFamily: 'monospace' }}
                              />
                            </Col>
                          </Row>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Form>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 2: BRANCHES & BRANCH MANAGERS MANAGEMENT
              ======================================================== */}
          {activeTab === 'BRANCHES' && (
            <div>
              {/* KPI Summary Cards */}
              <div className="address-kpi-grid mb-4">
                <div className="address-kpi-card">
                  <div className="address-kpi-icon gold">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </div>
                  <div className="address-kpi-info">
                    <span className="address-kpi-title">TỔNG SỐ CHI NHÁNH</span>
                    <span className="address-kpi-value">{stats.total} Showroom</span>
                    <span className="address-kpi-subtitle">Phủ sóng {stats.citiesCount} Tỉnh / TP</span>
                  </div>
                </div>

                <div className="address-kpi-card">
                  <div className="address-kpi-icon emerald">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <div className="address-kpi-info">
                    <span className="address-kpi-title">ĐANG HOẠT ĐỘNG</span>
                    <span className="address-kpi-value text-success">{stats.active} Chi Nhánh</span>
                    <span className="address-kpi-subtitle">Đang mở cửa đón khách</span>
                  </div>
                </div>

                <div className="address-kpi-card">
                  <div className="address-kpi-icon amber">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div className="address-kpi-info">
                    <span className="address-kpi-title">TẠM NGƯNG HOẠT ĐỘNG</span>
                    <span className="address-kpi-value text-warning">{stats.suspended} Chi Nhánh</span>
                    <span className="address-kpi-subtitle">Đang sửa chữa / bảo trì</span>
                  </div>
                </div>

                <div className="address-kpi-card">
                  <div className="address-kpi-icon blue">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                  <div className="address-kpi-info">
                    <span className="address-kpi-title">ĐÃ GÁN QUẢN LÝ (BM)</span>
                    <span className="address-kpi-value text-primary">{stats.withManager} / {stats.total}</span>
                    <span className="address-kpi-subtitle">Đã bổ nhiệm Branch Manager</span>
                  </div>
                </div>
              </div>

              {/* Filter & Search Toolbar */}
              <div className="p-3 mb-4 rounded-3" style={{ background: '#FFFFFF', border: '1px solid #ECE7DD', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                <Row className="g-3 align-items-center">
                  <Col lg={5} md={6}>
                    <div className="position-relative">
                      <span className="position-absolute" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
                        🔍
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Tìm theo tên chi nhánh, địa chỉ, hotline, quản lý..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ paddingLeft: '36px', fontSize: '13px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                      />
                    </div>
                  </Col>

                  <Col lg={3} md={3}>
                    <select
                      className="form-select"
                      value={selectedCity}
                      onChange={(e) => setSelectedCity(e.target.value)}
                      style={{ fontSize: '13px', borderRadius: '8px', border: '1px solid #D1D5DB' }}
                    >
                      <option value="ALL">Tất cả Tỉnh / Thành phố</option>
                      {VIETNAM_CITIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </Col>

                  <Col lg={4} md={3}>
                    <div className="d-flex align-items-center gap-1">
                      {['ALL', 'ACTIVE', 'SUSPENDED'].map((st) => (
                        <button
                          key={st}
                          type="button"
                          className="btn btn-sm"
                          onClick={() => setSelectedStatus(st)}
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '6px',
                            padding: '6px 12px',
                            border: '1px solid',
                            borderColor: selectedStatus === st ? '#18181B' : '#E5E7EB',
                            background: selectedStatus === st ? '#18181B' : '#FFFFFF',
                            color: selectedStatus === st ? '#FFFFFF' : '#4B5563',
                          }}
                        >
                          {st === 'ALL' ? 'Tất cả' : (st === 'ACTIVE' ? 'Đang mở' : 'Tạm dừng')}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary ms-auto"
                        onClick={loadData}
                        title="Làm mới dữ liệu"
                        style={{ borderRadius: '6px' }}
                      >
                        🔄
                      </button>
                    </div>
                  </Col>
                </Row>
              </div>

              {/* Branch Cards Grid */}
              {loading ? (
                <div className="text-center py-5 my-5">
                  <Spinner animation="border" variant="dark" role="status" className="mb-2" />
                  <div className="text-muted small">Đang đồng bộ mạng lưới chi nhánh từ cơ sở dữ liệu...</div>
                </div>
              ) : filteredBranches.length === 0 ? (
                <div className="text-center py-5 my-4 p-5 rounded-3 bg-white" style={{ border: '1px solid #ECE7DD' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏬</div>
                  <h5 className="fw-bold mb-2">Không Tìm Thấy Chi Nhánh Phù Hợp</h5>
                  <p className="text-muted small mb-4" style={{ maxWidth: '420px', margin: '0 auto' }}>
                    Không có chi nhánh nào khớp với bộ lọc tìm kiếm hiện tại. Hãy thử chọn điều kiện lọc khác hoặc khởi tạo thêm chi nhánh mới.
                  </p>
                  <Button variant="dark" size="sm" onClick={handleOpenCreateModal} style={{ borderRadius: '8px', fontWeight: 600 }}>
                    + Khởi Tạo Chi Nhánh Ngay
                  </Button>
                </div>
              ) : (
                <Row className="g-4">
                  {filteredBranches.map((b) => {
                    const isActive = b.status === 'ACTIVE';
                    const hasGps = b.latitude != null && b.longitude != null;
                    const fullAddr = [b.address, b.ward, b.district, b.city].filter(Boolean).join(', ');
                    const manager = b.managerId;

                    return (
                      <Col key={b._id} lg={6} xl={6}>
                        <div
                          className="store-showroom-card h-100 p-4"
                          style={{
                            background: '#FFFFFF',
                            borderRadius: '16px',
                            border: b.isHQ ? '2px solid #D97706' : '1px solid #ECE7DD',
                            boxShadow: b.isHQ ? '0 6px 20px rgba(217, 119, 6, 0.08)' : '0 4px 18px rgba(0,0,0,0.03)',
                            display: 'flex',
                            flexDirection: 'column',
                            position: 'relative',
                          }}
                        >
                          {/* Identity Row */}
                          <div className="d-flex align-items-start justify-content-between pb-3 border-bottom mb-3 gap-2 flex-wrap">
                            <div className="d-flex align-items-center gap-3">
                              <div style={{ position: 'relative' }}>
                                <img
                                  src={b.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(b.name || 'Branch')}&background=18181B&color=F59E0B&size=100`}
                                  alt={b.name}
                                  style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', border: b.isHQ ? '2px solid #D97706' : '1px solid #E5E7EB' }}
                                />
                                <span
                                  style={{
                                    position: 'absolute',
                                    bottom: '-3px',
                                    right: '-3px',
                                    background: isActive ? '#10B981' : '#F59E0B',
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    border: '2px solid #FFF',
                                  }}
                                />
                              </div>

                              <div>
                                <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                                  <h4 className="fw-bold mb-0" style={{ fontSize: '18px', color: '#111827' }}>
                                    {b.name}
                                  </h4>
                                  {b.isHQ && (
                                    <span className="badge" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D', fontSize: '11px', fontWeight: 700 }}>
                                      ★ TRỤ SỞ CHÍNH (HQ)
                                    </span>
                                  )}
                                </div>
                                <span className="badge bg-light text-muted border" style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                                  ID: BR-{String(b._id).slice(-6).toUpperCase()}
                                </span>
                              </div>
                            </div>

                            {/* Status Badge & 1-Click Toggle */}
                            <div className="d-flex align-items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(b)}
                                className="btn btn-sm"
                                title={isActive ? 'Click để tạm dừng hoạt động' : 'Click để kích hoạt lại chi nhánh'}
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  borderRadius: '20px',
                                  padding: '3px 10px',
                                  background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                  color: isActive ? '#059669' : '#D97706',
                                  border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                }}
                              >
                                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: isActive ? '#10B981' : '#F59E0B', marginRight: '6px' }} />
                                {isActive ? 'ĐANG MỞ CỬA' : 'TẠM DỪNG'}
                              </button>
                            </div>
                          </div>

                          {/* Address & GPS Row */}
                          <div className="p-3 rounded-3 mb-3" style={{ background: '#FAF9F6', border: '1px solid #F1ECE1' }}>
                            <div className="d-flex align-items-start gap-2 mb-1">
                              <span style={{ color: '#D97706', fontSize: '15px' }}>📍</span>
                              <div className="flex-grow-1">
                                <div className="fw-semibold text-dark" style={{ fontSize: '13px', lineHeight: '1.4' }}>
                                  {fullAddr || 'Chưa cập nhật địa chỉ'}
                                </div>
                                <div className="text-muted small mt-1 d-flex align-items-center gap-2 flex-wrap">
                                  <span style={{ fontSize: '11.5px' }}>Tọa độ:</span>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 600, color: hasGps ? '#B45309' : '#9CA3AF', background: '#FFF', padding: '1px 6px', borderRadius: '4px', border: '1px solid #E5E7EB', fontSize: '11px' }}>
                                    {hasGps ? `${Number(b.latitude).toFixed(5)}, ${Number(b.longitude).toFixed(5)}` : 'Chưa ghim GPS'}
                                  </span>
                                  {hasGps && (
                                    <a
                                      href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-decoration-none"
                                      style={{ fontSize: '11px', color: '#2563EB', fontWeight: 600 }}
                                    >
                                      Google Maps ↗
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Operation Meta: Hotline & Opening Hours */}
                          <Row className="g-2 mb-3">
                            <Col sm={6}>
                              <div className="p-2 px-3 rounded-2 border h-100 bg-white">
                                <div className="text-muted" style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.4px' }}>
                                  HOTLINE CHI NHÁNH
                                </div>
                                <div className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                                  📞 {b.phone || 'Chưa cập nhật'}
                                </div>
                              </div>
                            </Col>
                            <Col sm={6}>
                              <div className="p-2 px-3 rounded-2 border h-100 bg-white">
                                <div className="text-muted" style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.4px' }}>
                                  GIỜ MỞ CỬA
                                </div>
                                <div className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                                  🕒 {b.openingHours || '09:00 - 21:30'}
                                </div>
                              </div>
                            </Col>
                          </Row>

                          {/* Assigned Branch Manager Card */}
                          <div className="p-3 rounded-3 mb-3 border" style={{ background: manager ? '#F8FAFC' : '#FFFBEB', borderColor: manager ? '#E2E8F0' : '#FDE68A' }}>
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <span className="text-muted" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                                QUẢN LÝ CHI NHÁNH (BRANCH MANAGER)
                              </span>
                              {manager ? (
                                <span className="badge bg-primary" style={{ fontSize: '10px' }}>ĐÃ BỔ NHIỆM</span>
                              ) : (
                                <span className="badge bg-warning text-dark" style={{ fontSize: '10px' }}>CHƯA BỔ NHIỆM</span>
                              )}
                            </div>

                            {manager ? (
                              <div className="d-flex align-items-center gap-3">
                                <div
                                  style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '50%',
                                    background: '#1E293B',
                                    color: '#FFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '14px',
                                    flexShrink: 0,
                                  }}
                                >
                                  {manager.FullName ? manager.FullName.charAt(0).toUpperCase() : 'M'}
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div className="fw-bold text-dark" style={{ fontSize: '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {manager.FullName || manager.fullName || 'Quản lý chi nhánh'}
                                  </div>
                                  <div className="text-muted small" style={{ fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    ✉️ {manager.Email || manager.email || '—'} {manager.phone ? `• 📱 ${manager.phone}` : ''}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="d-flex align-items-center justify-content-between">
                                <span className="text-muted small" style={{ fontSize: '12px' }}>
                                  Chưa có Branch Manager trực tiếp quản lý cơ sở này.
                                </span>
                                <Button
                                  variant="outline-warning"
                                  size="sm"
                                  onClick={() => handleOpenEditModal(b)}
                                  style={{ fontSize: '11.5px', fontWeight: 600, padding: '3px 10px', borderRadius: '6px' }}
                                >
                                  + Bổ Nhiệm
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* Footer Actions */}
                          <div className="d-flex align-items-center justify-content-between pt-3 border-top mt-auto flex-wrap gap-2">
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => handleOpenMapModal(b)}
                              className="d-inline-flex align-items-center gap-1"
                              style={{ fontSize: '12px', fontWeight: 600, borderRadius: '6px', padding: '6px 12px' }}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                                <line x1="8" y1="2" x2="8" y2="18" />
                                <line x1="16" y1="6" x2="16" y2="22" />
                              </svg>
                              <span>Xem Bản Đồ</span>
                            </Button>

                            <div className="d-flex align-items-center gap-2">
                              <Button
                                variant="dark"
                                size="sm"
                                onClick={() => handleOpenEditModal(b)}
                                className="d-inline-flex align-items-center gap-1"
                                style={{ fontSize: '12px', fontWeight: 600, borderRadius: '6px', padding: '6px 14px', background: '#18181B' }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                <span>Chỉnh Sửa</span>
                              </Button>

                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleOpenDeleteModal(b)}
                                disabled={b.isHQ}
                                title={b.isHQ ? 'Không thể xóa Trụ sở chính (HQ)' : 'Xóa chi nhánh này'}
                                className="d-inline-flex align-items-center gap-1"
                                style={{ fontSize: '12px', fontWeight: 600, borderRadius: '6px', padding: '6px 12px' }}
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                <span>Xóa</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ========================================================
          MODAL 1: THÊM CHI NHÁNH MỚI (CREATE BRANCH)
          ======================================================== */}
      <Modal
        show={showCreateModal}
        onHide={() => !submitting && setShowCreateModal(false)}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton={!submitting} style={{ borderBottom: '1px solid #ECE7DD', background: '#FAF9F6' }}>
          <div>
            <div className="badge bg-dark mb-1" style={{ fontSize: '10.5px', letterSpacing: '0.8px' }}>
              SHOP MANAGER (CHỦ CHUỖI)
            </div>
            <Modal.Title style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              Khởi Tạo Chi Nhánh Showroom Mới
            </Modal.Title>
          </div>
        </Modal.Header>
        <Form onSubmit={handleCreateSubmit}>
          <Modal.Body style={{ maxHeight: 'calc(80vh - 120px)', overflowY: 'auto', padding: '24px' }}>
            <Row className="g-3 mb-3">
              <Col md={8}>
                <Form.Group>
                  <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    Tên Chi Nhánh <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    required
                    placeholder="VD: Vestora Showroom Cầu Giấy"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ fontSize: '13px' }}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    Hotline Liên Hệ <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    required
                    placeholder="VD: 0912345678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ fontSize: '13px' }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    Giờ Hoạt Động Showroom
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.openingHours}
                    onChange={(e) => setFormData({ ...formData, openingHours: e.target.value })}
                    style={{ fontSize: '13px' }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    Bổ Nhiệm Quản Lý Chi Nhánh (Branch Manager)
                  </Form.Label>
                  <Form.Select
                    value={formData.managerId}
                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                    style={{ fontSize: '13px' }}
                  >
                    <option value="">-- Chưa bổ nhiệm (để trống) --</option>
                    {managers.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.FullName} ({m.Email}) [{m.Role}]
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                id="is-hq-switch-create"
                label="Đặt chi nhánh này làm Trụ Sở Chính (HQ) của toàn chuỗi"
                checked={formData.isHQ}
                onChange={(e) => setFormData({ ...formData, isHQ: e.target.checked })}
                style={{ fontSize: '13px', fontWeight: 600, color: formData.isHQ ? '#D97706' : '#374151' }}
              />
              <Form.Text className="text-muted" style={{ fontSize: '11.5px' }}>
                Lưu ý: Nếu bật, chi nhánh này sẽ đại diện cho trụ sở chính của chuỗi thương hiệu Vestora.
              </Form.Text>
            </Form.Group>

            <hr style={{ margin: '18px 0', borderColor: '#ECE7DD' }} />

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    Tỉnh / Thành Phố <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    style={{ fontSize: '13px' }}
                  >
                    {VIETNAM_CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    Phường / Xã / Quận
                  </Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="VD: Phường Tràng Tiền, Quận Hoàn Kiếm"
                    value={formData.ward}
                    onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                    style={{ fontSize: '13px' }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                Địa Chỉ Chi Tiết Số Nhà, Đường Phố
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="VD: Số 45 Phố Tràng Tiền"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                style={{ fontSize: '13px' }}
              />
            </Form.Group>

            {/* Interactive Leaflet Map Picker */}
            <div className="mb-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <Form.Label style={{ fontSize: '12.5px', fontWeight: 600, margin: 0 }}>
                  Ghim Tọa Độ Vị Trí Showroom Trên Bản Đồ (Leaflet Maps)
                </Form.Label>
                <span className="text-muted small" style={{ fontSize: '11.5px' }}>
                  Click hoặc kéo thả ghim vàng để định vị chính xác
                </span>
              </div>
              <LeafletMapPicker
                latitude={formData.latitude}
                longitude={formData.longitude}
                height="280px"
                onChange={({ latitude, longitude }) => {
                  setFormData((prev) => ({
                    ...prev,
                    latitude: String(latitude),
                    longitude: String(longitude),
                  }));
                }}
              />
              <Row className="g-2 mt-2">
                <Col sm={6}>
                  <Form.Control
                    size="sm"
                    placeholder="Vĩ độ (Latitude)"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    style={{ fontSize: '12px', fontFamily: 'monospace' }}
                  />
                </Col>
                <Col sm={6}>
                  <Form.Control
                    size="sm"
                    placeholder="Kinh độ (Longitude)"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    style={{ fontSize: '12px', fontFamily: 'monospace' }}
                  />
                </Col>
              </Row>
            </div>

            <Form.Group className="mb-2">
              <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                Mô Tả / Giới Thiệu Showroom
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Giới thiệu về không gian phòng thử đồ, dịch vụ fitting cao cấp..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{ fontSize: '13px' }}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer style={{ borderTop: '1px solid #ECE7DD', background: '#FAF9F6' }}>
            <Button variant="outline-secondary" size="sm" onClick={() => setShowCreateModal(false)} disabled={submitting}>
              Hủy Bỏ
            </Button>
            <Button variant="dark" size="sm" type="submit" disabled={submitting} style={{ background: '#18181B', fontWeight: 600 }}>
              {submitting ? <Spinner size="sm" animation="border" className="me-1" /> : null}
              + Khởi Tạo Chi Nhánh
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ========================================================
          MODAL 2: CHỈNH SỬA CHI NHÁNH (EDIT BRANCH)
          ======================================================== */}
      <Modal
        show={showEditModal}
        onHide={() => !submitting && setShowEditModal(false)}
        size="lg"
        centered
        backdrop="static"
      >
        <Modal.Header closeButton={!submitting} style={{ borderBottom: '1px solid #ECE7DD', background: '#FAF9F6' }}>
          <div>
            <div className="badge bg-dark mb-1" style={{ fontSize: '10.5px' }}>
              CẬP NHẬT CHI NHÁNH
            </div>
            <Modal.Title style={{ fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              Chỉnh Sửa: {activeBranch?.name}
            </Modal.Title>
          </div>
        </Modal.Header>
        <Form onSubmit={handleEditSubmit}>
          <Modal.Body style={{ maxHeight: 'calc(80vh - 120px)', overflowY: 'auto', padding: '24px' }}>
            <Row className="g-3 mb-3">
              <Col md={8}>
                <Form.Group>
                  <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    Tên Chi Nhánh <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ fontSize: '13px' }}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    Hotline Liên Hệ <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    style={{ fontSize: '13px' }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    Trạng Thái Hoạt Động
                  </Form.Label>
                  <Form.Select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    style={{ fontSize: '13px' }}
                  >
                    <option value="ACTIVE">Đang Hoạt Động (Mở Cửa)</option>
                    <option value="SUSPENDED">Tạm Ngưng Hoạt Động (Đóng Cửa)</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    Chỉ Định Quản Lý Chi Nhánh (Branch Manager)
                  </Form.Label>
                  <Form.Select
                    value={formData.managerId}
                    onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                    style={{ fontSize: '13px' }}
                  >
                    <option value="">-- Chưa bổ nhiệm (để trống) --</option>
                    {managers.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.FullName} ({m.Email}) [{m.Role}]
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Check
                type="switch"
                id="is-hq-switch-edit"
                label="Đặt chi nhánh này làm Trụ Sở Chính (HQ)"
                checked={formData.isHQ}
                onChange={(e) => setFormData({ ...formData, isHQ: e.target.checked })}
                style={{ fontSize: '13px', fontWeight: 600, color: formData.isHQ ? '#D97706' : '#374151' }}
              />
            </Form.Group>

            <hr style={{ margin: '18px 0', borderColor: '#ECE7DD' }} />

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    Tỉnh / Thành Phố <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    style={{ fontSize: '13px' }}
                  >
                    {VIETNAM_CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    Phường / Xã / Quận
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={formData.ward}
                    onChange={(e) => setFormData({ ...formData, ward: e.target.value })}
                    style={{ fontSize: '13px' }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                Địa Chỉ Chi Tiết
              </Form.Label>
              <Form.Control
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                style={{ fontSize: '13px' }}
              />
            </Form.Group>

            {/* Interactive Leaflet Map Picker */}
            <div className="mb-3">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <Form.Label style={{ fontSize: '12.5px', fontWeight: 600, margin: 0 }}>
                  Ghim Tọa Độ Vị Trí Showroom Trên Bản Đồ
                </Form.Label>
                <span className="text-muted small" style={{ fontSize: '11.5px' }}>
                  Click trên bản đồ để di chuyển ghim
                </span>
              </div>
              <LeafletMapPicker
                latitude={formData.latitude}
                longitude={formData.longitude}
                height="280px"
                onChange={({ latitude, longitude }) => {
                  setFormData((prev) => ({
                    ...prev,
                    latitude: String(latitude),
                    longitude: String(longitude),
                  }));
                }}
              />
              <Row className="g-2 mt-2">
                <Col sm={6}>
                  <Form.Control
                    size="sm"
                    placeholder="Vĩ độ (Latitude)"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    style={{ fontSize: '12px', fontFamily: 'monospace' }}
                  />
                </Col>
                <Col sm={6}>
                  <Form.Control
                    size="sm"
                    placeholder="Kinh độ (Longitude)"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    style={{ fontSize: '12px', fontFamily: 'monospace' }}
                  />
                </Col>
              </Row>
            </div>

            <Form.Group className="mb-2">
              <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                Giờ Mở Cửa & Hoạt Động
              </Form.Label>
              <Form.Control
                type="text"
                value={formData.openingHours}
                onChange={(e) => setFormData({ ...formData, openingHours: e.target.value })}
                style={{ fontSize: '13px' }}
              />
            </Form.Group>

            <Form.Group className="mb-2">
              <Form.Label style={{ fontSize: '12.5px', fontWeight: 600 }}>
                Mô Tả / Giới Thiệu
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                style={{ fontSize: '13px' }}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer style={{ borderTop: '1px solid #ECE7DD', background: '#FAF9F6' }}>
            <Button variant="outline-secondary" size="sm" onClick={() => setShowEditModal(false)} disabled={submitting}>
              Hủy Bỏ
            </Button>
            <Button variant="dark" size="sm" type="submit" disabled={submitting} style={{ background: '#18181B', fontWeight: 600 }}>
              {submitting ? <Spinner size="sm" animation="border" className="me-1" /> : null}
              Lưu Cập Nhật
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* ========================================================
          MODAL 3: XÁC NHẬN XÓA CHI NHÁNH (DELETE CONFIRM)
          ======================================================== */}
      <Modal
        show={showDeleteModal}
        onHide={() => !submitting && setShowDeleteModal(false)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton={!submitting} style={{ borderBottom: '1px solid #FEE2E2', background: '#FEF2F2' }}>
          <div className="d-flex align-items-center gap-2">
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <Modal.Title style={{ fontSize: '17px', fontWeight: 700, color: '#991B1B' }}>
              Xác Nhận Xóa Chi Nhánh
            </Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body style={{ padding: '24px' }}>
          <p style={{ fontSize: '14px', color: '#1F2937', marginBottom: '12px' }}>
            Bạn có chắc chắn muốn xóa chi nhánh <strong>"{activeBranch?.name}"</strong> khỏi hệ thống chuỗi Vestora không?
          </p>
          <div className="p-3 rounded-2" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', fontSize: '12.5px', color: '#4B5563' }}>
            <div><strong>Địa chỉ:</strong> {[activeBranch?.address, activeBranch?.ward, activeBranch?.city].filter(Boolean).join(', ')}</div>
            <div><strong>Hotline:</strong> {activeBranch?.phone || '—'}</div>
            {activeBranch?.managerId && (
              <div><strong>Quản lý phụ trách:</strong> {activeBranch.managerId.FullName}</div>
            )}
          </div>
          <div className="text-danger small mt-3" style={{ fontSize: '12px' }}>
            * Lưu ý: Thao tác này sẽ xóa vĩnh viễn hồ sơ showroom chi nhánh và không thể hoàn tác.
          </div>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid #E5E7EB', background: '#FAF9F6' }}>
          <Button variant="outline-secondary" size="sm" onClick={() => setShowDeleteModal(false)} disabled={submitting}>
            Hủy Bỏ
          </Button>
          <Button variant="danger" size="sm" onClick={handleDeleteSubmit} disabled={submitting} style={{ fontWeight: 600 }}>
            {submitting ? <Spinner size="sm" animation="border" className="me-1" /> : null}
            Xác Nhận Xóa Chi Nhánh
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ========================================================
          MODAL 4: XEM BẢN ĐỒ VỊ TRÍ SHOWROOM (MAP VIEW MODAL)
          ======================================================== */}
      <Modal
        show={showMapModal}
        onHide={() => setShowMapModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton style={{ borderBottom: '1px solid #ECE7DD', background: '#FAF9F6' }}>
          <div>
            <div className="text-muted small" style={{ fontSize: '11px', fontWeight: 700 }}>
              ĐỊNH VỊ SHOWROOM THỜI GIAN THỰC
            </div>
            <Modal.Title style={{ fontSize: '17px', fontWeight: 700, color: '#111827' }}>
              📍 {activeBranch?.name}
            </Modal.Title>
          </div>
        </Modal.Header>
        <Modal.Body style={{ padding: '20px' }}>
          <div className="mb-3 p-2 px-3 rounded-2" style={{ background: '#FAF9F6', border: '1px solid #E5E7EB', fontSize: '13px' }}>
            <div><strong>Địa chỉ:</strong> {[activeBranch?.address, activeBranch?.ward, activeBranch?.district, activeBranch?.city].filter(Boolean).join(', ')}</div>
            <div>
              <strong>Tọa độ GPS:</strong>{' '}
              {activeBranch?.latitude && activeBranch?.longitude ? (
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#D97706' }}>
                  {Number(activeBranch.latitude).toFixed(6)}° N, {Number(activeBranch.longitude).toFixed(6)}° E
                </span>
              ) : (
                <span className="text-muted">Chưa ghim tọa độ GPS</span>
              )}
            </div>
          </div>

          <LeafletMapPicker
            latitude={activeBranch?.latitude}
            longitude={activeBranch?.longitude}
            readOnly={true}
            height="400px"
            label={activeBranch?.name || 'Vị trí Showroom'}
          />
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid #ECE7DD', background: '#FAF9F6' }}>
          {activeBranch?.latitude && activeBranch?.longitude && (
            <a
              href={`https://www.google.com/maps?q=${activeBranch.latitude},${activeBranch.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline-dark btn-sm me-auto"
              style={{ fontSize: '12.5px', fontWeight: 600 }}
            >
              Mở Trên Google Maps ↗
            </a>
          )}
          <Button variant="secondary" size="sm" onClick={() => setShowMapModal(false)}>
            Đóng
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`store-floating-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
