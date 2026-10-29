import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Row, Col, Spinner, Button, Modal, Form } from 'react-bootstrap';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import LeafletMapPicker from '../../components/LeafletMapPicker';
import SearchableSelect from '../../components/SearchableSelect';
import GeoLocateButton from '../../components/GeoLocateButton';
import OpeningHoursInput, { parseOpeningHours, DAY_OPTIONS } from '../../components/OpeningHoursInput';
import ImageLightboxModal from '../../components/ImageLightboxModal';
import { useAuth } from '../../context/AuthContext';
import {
  getBranchesListApi,
  createBranchApi,
  updateBranchInfoApi,
  deleteBranchApi,
  getBranchManagersApi,
  uploadShopImageApi,
} from '../../services/shopApi';
import '../../styles/OpsShops.css';
import '../../styles/ShopDashboard.css';
import '../../styles/ShopBranches.css';

const FALLBACK_PROVINCES = [
  { code: 1, name: 'Thành phố Hà Nội' },
  { code: 79, name: 'Thành phố Hồ Chí Minh' },
  { code: 48, name: 'Thành phố Đà Nẵng' },
  { code: 31, name: 'Thành phố Hải Phòng' },
  { code: 92, name: 'Thành phố Cần Thơ' },
  { code: 46, name: 'Thành phố Huế' },
  { code: 22, name: 'Thành phố Quảng Ninh' },
  { code: 56, name: 'Tỉnh Khánh Hòa' },
  { code: 68, name: 'Tỉnh Lâm Đồng' },
  { code: 75, name: 'Thành phố Đồng Nai' },
  { code: 24, name: 'Thành phố Bắc Ninh' },
];

export default function OwnerBranchesPage() {
  const { user } = useAuth();

  const [branches, setBranches] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [provinces, setProvinces] = useState([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [wards, setWards] = useState([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const wardCache = useRef({});

  const [formErrors, setFormErrors] = useState({});

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);

  const [activeBranch, setActiveBranch] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const initialBranchFormData = {
    name: '',
    imageUrl: '',
    bannerUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80',
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

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);
  const createAvatarFileRef = useRef(null);
  const createBannerFileRef = useRef(null);
  const editAvatarFileRef = useRef(null);
  const editBannerFileRef = useRef(null);

  const [lightboxImage, setLightboxImage] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  /**
   * Upload logo or showroom cover image and update form state
   */
  const handleProcessUploadFile = async (file, imageType) => {
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('Kích thước ảnh không được vượt quá 10MB.', 'warning');
      return;
    }

    const setUploading = imageType === 'banner' ? setUploadingBanner : setUploadingAvatar;
    setUploading(true);
    try {
      const tempUrl = URL.createObjectURL(file);
      if (imageType === 'banner') {
        setFormData((prev) => ({ ...prev, bannerUrl: tempUrl }));
      } else {
        setFormData((prev) => ({ ...prev, imageUrl: tempUrl }));
      }

      const res = await uploadShopImageApi(file, imageType);
      if (res?.success && res.url) {
        if (imageType === 'banner') {
          setFormData((prev) => ({ ...prev, bannerUrl: res.url }));
        } else {
          setFormData((prev) => ({ ...prev, imageUrl: res.url }));
        }
        showToast(imageType === 'banner' ? 'Tải ảnh bìa showroom từ thiết bị thành công!' : 'Tải logo chi nhánh từ thiết bị thành công!', 'success');
      } else {
        throw new Error(res?.message || 'Không nhận được đường dẫn ảnh');
      }
    } catch (err) {
      showToast('Lỗi khi tải ảnh từ thiết bị: ' + (err.message || 'Lỗi mạng'), 'warning');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadImageFile = (e, imageType) => {
    const file = e.target.files?.[0];
    if (file) handleProcessUploadFile(file, imageType);
    e.target.value = '';
  };

  const handleDropBanner = (e) => {
    e.preventDefault();
    setIsDraggingBanner(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleProcessUploadFile(file, 'banner');
    } else if (file) {
      showToast('Vui lòng kéo thả file ảnh hợp lệ (JPG, PNG, WEBP).', 'warning');
    }
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
    } catch (_) { }
    return null;
  }, [user]);

  /**
   * Fetch branches network and eligible managers from API
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [branchesRes, managersRes] = await Promise.all([
        getBranchesListApi({ limit: 100 }),
        getBranchManagersApi().catch(() => ({ success: true, data: [] })),
      ]);

      const branchesList = (branchesRes?.success && Array.isArray(branchesRes.data)) ? branchesRes.data : [];
      setBranches(branchesList);

      if (managersRes?.success && Array.isArray(managersRes.data)) {
        setManagers(managersRes.data);
      }
    } catch (err) {
      showToast(err.message || 'Không thể tải dữ liệu chi nhánh.', 'warning');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    let isMounted = true;
    setLoadingProvinces(true);
    fetch('https://provinces.open-api.vn/api/v2/p/')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setProvinces(data);
        }
      })
      .catch(() => {
        if (isMounted) setProvinces(FALLBACK_PROVINCES);
      })
      .finally(() => {
        if (isMounted) setLoadingProvinces(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredBranches = useMemo(() => {
    const matched = branches.filter((b) => {
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

    return matched.sort((a, b) => {
      if (a.isHQ && !b.isHQ) return -1;
      if (!a.isHQ && b.isHQ) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [branches, selectedStatus, selectedCity, searchTerm]);

  const showroomStats = useMemo(() => {
    const total = branches.length;
    const active = branches.filter((b) => b.status === 'ACTIVE').length;
    const mapped = branches.filter((b) => b.latitude != null && b.longitude != null).length;
    const staffed = branches.filter((b) => Boolean(b.managerId)).length;
    return { total, active, mapped, staffed };
  }, [branches]);

  /**
   * Update selected province and fetch corresponding wards
   */
  const handleProvinceChange = async (provName, provOption) => {
    setFormData((prev) => ({ ...prev, city: provName, ward: '' }));
    if (formErrors.city) setFormErrors((prev) => ({ ...prev, city: '' }));

    const provList = provinces.length > 0 ? provinces : FALLBACK_PROVINCES;
    const code = provOption?.code || provList.find((p) => p.name === provName)?.code;
    if (!code) {
      setWards([]);
      return;
    }

    if (wardCache.current[code]) {
      setWards(wardCache.current[code]);
      return;
    }

    setLoadingWards(true);
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/v2/p/${code}?depth=2`);
      const data = await res.json();
      const wardList = data?.wards || [];
      wardCache.current[code] = wardList;
      setWards(wardList);
    } catch (_) {
      setWards([]);
    } finally {
      setLoadingWards(false);
    }
  };

  /**
   * Handle detected GPS coordinates and autofill location fields
   */
  const handleGpsLocationFound = async ({ latitude, longitude, city, ward, street }) => {
    setFormData((prev) => ({
      ...prev,
      latitude: String(latitude),
      longitude: String(longitude),
      ...(street && !prev.address ? { address: street } : {}),
    }));
    if (formErrors.coordinates) setFormErrors((prev) => ({ ...prev, coordinates: '' }));

    const provList = provinces.length > 0 ? provinces : FALLBACK_PROVINCES;
    if (city && provList.length > 0) {
      const cleanTarget = city.toLowerCase();
      const matchedProv = provList.find((p) => {
        const pClean = p.name.toLowerCase();
        return pClean === cleanTarget || cleanTarget.includes(pClean) || pClean.includes(cleanTarget);
      });
      if (matchedProv) {
        await handleProvinceChange(matchedProv.name, matchedProv);
        if (ward) {
          setTimeout(() => {
            setFormData((prev) => ({ ...prev, ward }));
          }, 300);
        }
      }
    }
  };

  /**
   * Validate branch form fields before submitting
   */
  const validateBranchForm = (data) => {
    const errs = {};
    const trimmedName = (data.name || '').trim();
    if (!trimmedName) {
      errs.name = 'Tên chi nhánh là bắt buộc.';
    } else if (trimmedName.length < 3 || trimmedName.length > 100) {
      errs.name = 'Tên chi nhánh phải từ 3 đến 100 ký tự.';
    }

    const cleanPhone = (data.phone || '').trim().replace(/\s+/g, '').replace(/^\+84/, '0');
    const phoneRegex = /^(0[35789])[0-9]{8}$/;
    if (!cleanPhone) {
      errs.phone = 'Hotline liên hệ là bắt buộc.';
    } else if (!phoneRegex.test(cleanPhone)) {
      errs.phone = 'Số điện thoại không hợp lệ (10 số, đầu 03, 05, 07, 08, 09).';
    }

    if (!data.city?.trim() || data.city === 'ALL') {
      errs.city = 'Vui lòng chọn Tỉnh / Thành phố.';
    }

    const trimmedAddress = (data.address || '').trim();
    if (trimmedAddress && trimmedAddress.length > 255) {
      errs.address = 'Địa chỉ chi tiết không được vượt quá 255 ký tự.';
    }

    if (!data.latitude || !data.longitude) {
      errs.coordinates = 'Vui lòng xác định vị trí GPS (bằng nút định vị hoặc click ghim trên bản đồ).';
    } else {
      const lat = Number(data.latitude);
      const lng = Number(data.longitude);
      if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
        errs.coordinates = 'Tọa độ GPS không hợp lệ (Vĩ độ: -90 đến 90, Kinh độ: -180 đến 180).';
      }
    }

    if (data.openingHours) {
      const parsedHours = parseOpeningHours(data.openingHours);
      if (parsedHours.fromTime && parsedHours.toTime && parsedHours.toTime <= parsedHours.fromTime) {
        errs.openingHours = 'Giờ đóng cửa phải sau giờ mở cửa.';
      } else {
        const fromIdx = DAY_OPTIONS.indexOf(parsedHours.fromDay);
        const toIdx = DAY_OPTIONS.indexOf(parsedHours.toDay);
        if (fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx) {
          errs.openingHours = `Thứ kết thúc (${parsedHours.toDay}) phải sau hoặc cùng Thứ bắt đầu (${parsedHours.fromDay}) trong tuần.`;
        }
      }
    }

    const trimmedDesc = (data.description || '').trim();
    if (trimmedDesc && (trimmedDesc.length < 10 || trimmedDesc.length > 1000)) {
      errs.description = 'Mô tả chi nhánh phải từ 10 đến 1000 ký tự (hoặc để trống để dùng mô tả mặc định).';
    }

    return errs;
  };

  const handleOpenCreateModal = () => {
    setFormErrors({});
    const defaultCity = provinces[0]?.name || 'Thành phố Hà Nội';
    const prefillAvatar = (user?.Avatar && typeof user.Avatar === 'string' && user.Avatar.trim()) ? user.Avatar.trim() : '';
    setFormData({
      ...initialBranchFormData,
      city: defaultCity,
      imageUrl: prefillAvatar,
      bannerUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80',
      ownerId: getOwnerId(),
    });
    const defaultProv = provinces[0] || FALLBACK_PROVINCES[0];
    if (defaultProv) {
      handleProvinceChange(defaultProv.name, defaultProv);
    }
    setShowCreateModal(true);
  };

  const handleOpenEditModal = (branch) => {
    setFormErrors({});
    setActiveBranch(branch);
    const branchCity = branch.city || 'Thành phố Hà Nội';
    setFormData({
      name: branch.name || '',
      imageUrl: branch.imageUrl || branch.avatarUrl || '',
      bannerUrl: branch.bannerUrl || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80',
      phone: branch.phone || '',
      openingHours: branch.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
      description: branch.description || '',
      address: branch.address || '',
      city: branchCity,
      ward: branch.ward || '',
      latitude: branch.latitude != null ? String(branch.latitude) : '',
      longitude: branch.longitude != null ? String(branch.longitude) : '',
      managerId: branch.managerId?._id ? String(branch.managerId._id) : '',
      isHQ: Boolean(branch.isHQ),
      status: branch.status || 'ACTIVE',
    });

    const provList = provinces.length > 0 ? provinces : FALLBACK_PROVINCES;
    const matched = provList.find((p) => p.name === branchCity);
    if (matched) {
      handleProvinceChange(matched.name, matched);
    }
    setShowEditModal(true);
  };

  const handleOpenDeleteModal = (branch) => {
    setActiveBranch(branch);
    setShowDeleteModal(true);
  };

  const handleOpenMapModal = (branch) => {
    setActiveBranch(branch);
    setShowMapModal(true);
  };

  /**
   * Submit new branch creation to API
   */
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (uploadingAvatar || uploadingBanner) {
      showToast('Đang tải ảnh lên hệ thống, vui lòng chờ trong giây lát...', 'warning');
      return;
    }
    if (formData.imageUrl?.startsWith('blob:') || formData.bannerUrl?.startsWith('blob:')) {
      showToast('Ảnh đang trong quá trình tải lên máy chủ, vui lòng đợi hoàn tất.', 'warning');
      return;
    }

    const errs = validateBranchForm(formData);
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast('Vui lòng kiểm tra lại các trường thông tin bị lỗi.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        imageUrl: formData.imageUrl?.trim() || '',
        bannerUrl: formData.bannerUrl?.trim() || '',
        phone: formData.phone.trim().replace(/\s+/g, '').replace(/^\+84/, '0'),
        openingHours: formData.openingHours.trim() || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
        description: formData.description.trim() || 'Showroom thời trang dạ tiệc và thiết kế cao cấp Vestora.',
        address: formData.address.trim(),
        city: formData.city.trim(),
        ward: formData.ward.trim(),
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
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

  /**
   * Submit branch profile updates to API
   */
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!activeBranch?._id) return;

    if (uploadingAvatar || uploadingBanner) {
      showToast('Đang tải ảnh lên hệ thống, vui lòng chờ trong giây lát...', 'warning');
      return;
    }
    if (formData.imageUrl?.startsWith('blob:') || formData.bannerUrl?.startsWith('blob:')) {
      showToast('Ảnh đang trong quá trình tải lên máy chủ, vui lòng đợi hoàn tất.', 'warning');
      return;
    }

    const errs = validateBranchForm(formData);
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast('Vui lòng kiểm tra lại các trường thông tin bị lỗi.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        imageUrl: formData.imageUrl?.trim() || activeBranch.imageUrl || activeBranch.avatarUrl || '',
        bannerUrl: formData.bannerUrl?.trim() || activeBranch.bannerUrl || '',
        phone: formData.phone.trim().replace(/\s+/g, '').replace(/^\+84/, '0'),
        openingHours: formData.openingHours.trim() || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
        description: formData.description.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        ward: formData.ward.trim(),
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
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

  /**
   * Toggle branch operating status between ACTIVE and SUSPENDED
   */
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

  /**
   * Soft-delete selected branch from network
   */
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
      <OwnerSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <main className="shop-main-content">
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
        />

        <div className="store-mgmt-container">
          <div className="store-mgmt-breadcrumb mb-2">
            <Link to="/owner/dashboard">Tổng Quan Chuỗi</Link>
            <span>›</span>
            <span style={{ color: '#0F172A', fontWeight: 600 }}>Quản Lý Chi Nhánh & Trụ Sở</span>
          </div>

          <div className="pb-2 mb-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h1 className="store-mgmt-title" style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#0F172A', letterSpacing: '-0.3px' }}>
                Quản Lý Chi Nhánh & Trụ Sở
              </h1>
              <p className="text-muted mb-0" style={{ fontSize: '13px', marginTop: '3px', color: '#64748B' }}>
                Quản lý hồ sơ thương hiệu, mạng lưới showroom, định vị GPS và nhân sự quản lý chi nhánh.
              </p>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#475569',
                  background: '#F1F5F9',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: '1px solid #E2E8F0',
                }}
              >
                Hiển thị <strong>{filteredBranches.length}</strong> / {branches.length} chi nhánh
              </span>
            </div>
          </div>

          <div className="clean-kpi-grid mb-3">
            <div className="clean-kpi-card">
              <div className="clean-kpi-icon" style={{ background: '#F1F5F9', color: '#0F172A' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div className="clean-kpi-info">
                <span className="clean-kpi-label">Tổng Cơ Sở Showroom</span>
                <span className="clean-kpi-value">{showroomStats.total}</span>
                <span className="clean-kpi-desc">Mạng lưới toàn quốc</span>
              </div>
            </div>

            <div className="clean-kpi-card">
              <div className="clean-kpi-icon success">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <div className="clean-kpi-info">
                <span className="clean-kpi-label">Đã Định Vị GPS</span>
                <span className="clean-kpi-value">
                  {showroomStats.mapped} <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 500 }}>/ {showroomStats.total}</span>
                </span>
                <span className="clean-kpi-desc">Hiển thị trên bản đồ số</span>
              </div>
            </div>

            <div className="clean-kpi-card">
              <div className="clean-kpi-icon warning">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="clean-kpi-info">
                <span className="clean-kpi-label">Bổ Nhiệm Quản Lý</span>
                <span className="clean-kpi-value">
                  {showroomStats.staffed} <span style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 500 }}>/ {showroomStats.total}</span>
                </span>
                <span className="clean-kpi-desc">
                  {showroomStats.total - showroomStats.staffed > 0
                    ? `${showroomStats.total - showroomStats.staffed} cơ sở cần bổ nhiệm`
                    : '100% đã có nhân sự'}
                </span>
              </div>
            </div>
          </div>

          <div className="unified-branches-taskbar mb-3">
            <div className="d-flex align-items-center flex-wrap gap-2 flex-grow-1">
              <div className="taskbar-search-wrapper">
                <svg className="taskbar-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="taskbar-search-input"
                  placeholder="Tìm chi nhánh, địa chỉ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="taskbar-clear-search"
                    onClick={() => setSearchTerm('')}
                    title="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                className="taskbar-select-filter"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                title="Lọc theo Tỉnh / Thành phố"
              >
                <option value="ALL">Tất cả Tỉnh / Thành phố</option>
                {(provinces.length > 0 ? provinces : FALLBACK_PROVINCES).map((p) => (
                  <option key={p.code || p.name} value={p.name}>{p.name}</option>
                ))}
              </select>

              <div className="taskbar-status-segmented">
                {[
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'ACTIVE', label: 'Đang mở' },
                  { id: 'SUSPENDED', label: 'Tạm dừng' },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className={`taskbar-status-btn ${selectedStatus === st.id ? 'active' : ''}`}
                    onClick={() => setSelectedStatus(st.id)}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className="taskbar-refresh-btn"
                onClick={loadData}
                title="Làm mới dữ liệu"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 4v6h-6" />
                  <path d="M1 20v-6h6" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>

              <button
                type="button"
                className="taskbar-add-btn"
                onClick={handleOpenCreateModal}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Thêm Chi Nhánh</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5 my-5">
              <Spinner animation="border" variant="dark" role="status" className="mb-2" />
              <div className="text-muted small">Đang đồng bộ mạng lưới chi nhánh từ cơ sở dữ liệu...</div>
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="text-center py-5 my-4 p-5 rounded-3 bg-white" style={{ border: '1px solid #E2E8F0' }}>
              <div className="d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <h5 className="fw-bold mb-2 text-dark">Không Tìm Thấy Chi Nhánh Phù Hợp</h5>
              <p className="text-muted small mb-4" style={{ maxWidth: '420px', margin: '0 auto' }}>
                Không có chi nhánh nào khớp với bộ lọc tìm kiếm hiện tại. Hãy thử chọn điều kiện lọc khác hoặc khởi tạo thêm chi nhánh mới.
              </p>
              <Button variant="dark" size="sm" onClick={handleOpenCreateModal} style={{ borderRadius: '8px', fontWeight: 600, background: '#0F172A' }}>
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
                  <Col key={b._id} md={6} lg={6} xl={6}>
                    <div
                      className="store-showroom-card h-100"
                      style={{
                        background: '#FFFFFF',
                        borderRadius: '16px',
                        border: b.isHQ ? '1.5px solid #0F172A' : '1px solid #E2E8F0',
                        boxShadow: '0 4px 18px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        onClick={() => {
                          const bannerSrc = b.bannerUrl || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80';
                          setLightboxImage({
                            url: bannerSrc,
                            title: `${b.name} — Ảnh Bìa Showroom (Kích Thước Gốc)`,
                          });
                        }}
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '170px',
                          background: '#0F172A',
                          flexShrink: 0,
                          overflow: 'hidden',
                          cursor: 'pointer',
                        }}
                        title="Click vào ảnh bìa để xem 100% kích thước ảnh thật"
                      >
                        <img
                          src={b.bannerUrl || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'}
                          alt={`${b.name} Showroom Banner`}
                          onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'; }}
                          style={{
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center',
                            filter: 'brightness(0.96)',
                            transition: 'transform 0.3s ease',
                          }}
                        />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.65) 0%, rgba(15,23,42,0.1) 45%, transparent 70%)', pointerEvents: 'none' }} />

                        <div
                          style={{
                            position: 'absolute',
                            top: '12px',
                            left: '12px',
                            zIndex: 2,
                            fontSize: '11px',
                            fontWeight: 600,
                            background: 'rgba(15, 23, 42, 0.78)',
                            backdropFilter: 'blur(6px)',
                            color: '#FFF',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            borderRadius: '16px',
                            padding: '3px 9px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            pointerEvents: 'none',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                          }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            <line x1="11" y1="8" x2="11" y2="14" />
                            <line x1="8" y1="11" x2="14" y2="11" />
                          </svg>
                          <span>Xem ảnh thật</span>
                        </div>

                        {b.isHQ && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '12px',
                              right: '12px',
                              zIndex: 2,
                              fontSize: '10px',
                              fontWeight: 700,
                              letterSpacing: '0.5px',
                              background: 'rgba(15, 23, 42, 0.9)',
                              backdropFilter: 'blur(8px)',
                              color: '#F59E0B',
                              padding: '3px 10px',
                              borderRadius: '16px',
                              border: '1px solid rgba(245, 158, 11, 0.5)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                            <span>TRỤ SỞ CHÍNH</span>
                          </div>
                        )}
                      </div>

                      <div className="d-flex flex-column flex-grow-1" style={{ padding: '24px 26px 22px 26px' }}>
                        <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap" style={{ marginBottom: '20px' }}>
                          <div className="d-flex align-items-center gap-3">
                            <div style={{ position: 'relative', marginTop: '-36px' }}>
                              <img
                                src={b.imageUrl || b.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(b.name || 'Branch')}&background=0F172A&color=D97706&size=100`}
                                alt={b.name}
                                onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(b.name || 'Branch')}&background=0F172A&color=D97706&size=100`; }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (b.imageUrl || b.avatarUrl) {
                                    setLightboxImage({
                                      url: b.imageUrl || b.avatarUrl,
                                      title: `${b.name} — Logo Đại Diện (Kích Thước Gốc)`,
                                    });
                                  }
                                }}
                                title="Click để phóng to xem logo đại diện"
                                style={{
                                  width: '56px',
                                  height: '56px',
                                  borderRadius: '14px',
                                  objectFit: 'cover',
                                  background: '#FFFFFF',
                                  border: '3.5px solid #FFFFFF',
                                  boxShadow: '0 4px 14px rgba(0,0,0,0.14)',
                                  cursor: (b.imageUrl || b.avatarUrl) ? 'pointer' : 'default',
                                  transition: 'transform 0.2s ease',
                                }}
                              />
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: '1px',
                                  right: '1px',
                                  background: isActive ? '#10B981' : '#F59E0B',
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  border: '2.5px solid #FFF',
                                  boxShadow: isActive ? '0 0 6px rgba(16, 185, 129, 0.7)' : 'none',
                                }}
                              />
                            </div>

                            <div>
                              <h3 className="fw-bold mb-0" style={{ fontSize: '17px', color: '#0F172A', letterSpacing: '-0.3px', lineHeight: '1.3' }}>
                                {b.name}
                              </h3>
                            </div>
                          </div>

                          <div className="d-flex align-items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(b)}
                              className="btn btn-sm"
                              title={isActive ? 'Click để tạm dừng hoạt động chi nhánh' : 'Click để kích hoạt lại chi nhánh'}
                              aria-label={isActive ? `Tạm dừng chi nhánh ${b.name}` : `Mở cửa chi nhánh ${b.name}`}
                              style={{
                                fontSize: '11.5px',
                                fontWeight: 600,
                                borderRadius: '20px',
                                padding: '4px 12px',
                                background: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                color: isActive ? '#059669' : '#D97706',
                                border: `1px solid ${isActive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <span
                                style={{
                                  display: 'inline-block',
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: isActive ? '#10B981' : '#F59E0B',
                                  boxShadow: isActive ? '0 0 6px rgba(16, 185, 129, 0.6)' : 'none',
                                }}
                              />
                              <span>{isActive ? 'Đang mở cửa' : 'Tạm dừng'}</span>
                            </button>
                          </div>
                        </div>

                        <div style={{ background: '#F8FAFC', border: '1px solid #EDF2F7', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
                          <div className="d-flex align-items-start gap-2.5">
                            <div
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '7px',
                                background: '#EFF6FF',
                                color: '#2563EB',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                marginTop: '1px',
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                <circle cx="12" cy="10" r="3" />
                              </svg>
                            </div>
                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                              <div className="fw-semibold text-dark text-truncate" style={{ fontSize: '13.5px', lineHeight: '1.45', color: '#1E293B' }}>
                                {fullAddr || 'Chưa cập nhật địa chỉ'}
                              </div>
                              <div className="text-muted small d-flex align-items-center gap-2 flex-wrap" style={{ marginTop: '6px' }}>
                                <span style={{ fontSize: '11px', color: '#64748B' }}>Tọa độ:</span>
                                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: hasGps ? '#0F172A' : '#94A3B8', background: '#FFF', padding: '1px 6px', borderRadius: '4px', border: '1px solid #E2E8F0', fontSize: '11px' }}>
                                  {hasGps ? `${Number(b.latitude).toFixed(4)}, ${Number(b.longitude).toFixed(4)}` : 'Chưa ghim'}
                                </span>
                                {hasGps && (
                                  <a
                                    href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-decoration-none"
                                    style={{ fontSize: '11.5px', color: '#2563EB', fontWeight: 600 }}
                                  >
                                    Google Maps ↗
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <Row className="g-3" style={{ marginBottom: '16px' }}>
                          <Col sm={6}>
                            <div className="h-100" style={{ background: '#F8FAFC', border: '1px solid #EDF2F7', borderRadius: '12px', padding: '12px 16px' }}>
                              <div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#64748B' }}>
                                Hotline
                              </div>
                              <div className="d-flex align-items-center gap-2 fw-semibold text-dark mt-1" style={{ fontSize: '13px' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                                </svg>
                                <span>{b.phone || 'Chưa cập nhật'}</span>
                              </div>
                            </div>
                          </Col>
                          <Col sm={6}>
                            <div className="h-100" style={{ background: '#F8FAFC', border: '1px solid #EDF2F7', borderRadius: '12px', padding: '12px 16px' }}>
                              <div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#64748B' }}>
                                Giờ Mở Cửa
                              </div>
                              <div className="d-flex align-items-center gap-2 fw-semibold text-dark mt-1" style={{ fontSize: '13px' }}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                                  <circle cx="12" cy="12" r="10" />
                                  <polyline points="12 6 12 12 16 14" />
                                </svg>
                                <span>{b.openingHours || '09:00 - 21:30'}</span>
                              </div>
                            </div>
                          </Col>
                        </Row>

                        <div style={{ background: '#F8FAFC', border: '1px solid #EDF2F7', borderRadius: '12px', padding: '14px 16px', marginBottom: '22px' }}>
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <span style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#64748B' }}>
                              Quản Lý Phụ Trách
                            </span>
                            <span
                              className="badge"
                              style={{
                                fontSize: '10px',
                                fontWeight: 600,
                                background: manager ? '#E2E8F0' : '#FEF3C7',
                                color: manager ? '#334155' : '#92400E',
                                padding: '4px 8px',
                                borderRadius: '6px',
                              }}
                            >
                              {manager ? 'Đã bổ nhiệm' : 'Chưa bổ nhiệm'}
                            </span>
                          </div>

                          {manager ? (
                            <div className="d-flex align-items-center gap-2.5">
                              <div
                                style={{
                                  width: '34px',
                                  height: '34px',
                                  borderRadius: '50%',
                                  background: '#0F172A',
                                  color: '#FFF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 600,
                                  fontSize: '13px',
                                  flexShrink: 0,
                                }}
                              >
                                {manager.FullName ? manager.FullName.charAt(0).toUpperCase() : 'M'}
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div className="fw-semibold text-dark" style={{ fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {manager.FullName || manager.fullName || 'Quản lý chi nhánh'}
                                </div>
                                <div className="text-muted small" style={{ fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {manager.Email || manager.email || '—'} {manager.phone ? `• ${manager.phone}` : ''}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                              <span className="text-muted small" style={{ fontSize: '12px' }}>
                                Chưa bổ nhiệm quản lý cơ sở này.
                              </span>
                              <Button
                                variant="outline-dark"
                                size="sm"
                                onClick={() => handleOpenEditModal(b)}
                                style={{ fontSize: '11.5px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px' }}
                              >
                                + Bổ Nhiệm
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="d-flex align-items-center justify-content-between pt-3 border-top mt-auto flex-wrap gap-2" style={{ borderColor: '#F1F5F9' }}>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => handleOpenMapModal(b)}
                            className="d-inline-flex align-items-center gap-1.5"
                            style={{ fontSize: '12.5px', fontWeight: 600, borderRadius: '8px', padding: '8px 16px', background: '#F8FAFC', borderColor: '#E2E8F0', color: '#334155' }}
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
                              className="d-inline-flex align-items-center gap-1.5"
                              style={{ fontSize: '12.5px', fontWeight: 600, borderRadius: '8px', padding: '8px 18px', background: '#0F172A', borderColor: '#0F172A' }}
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
                              className="d-inline-flex align-items-center gap-1.5"
                              style={{ fontSize: '12.5px', fontWeight: 600, borderRadius: '8px', padding: '8px 14px' }}
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
                    </div>
                  </Col>
                );
              })}
            </Row>
          )}
        </div>
      </main>

      <Modal
        show={showCreateModal}
        onHide={() => !submitting && setShowCreateModal(false)}
        size="lg"
        centered
        backdrop="static"
        dialogClassName="vestora-modal-dialog"
      >
        <div className="vestora-modal-header">
          <div className="modal-header-brand-wrap">
            <div className="modal-header-icon-badge create">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <h5 className="modal-title-main">Khởi Tạo Chi Nhánh Showroom Mới</h5>
              <p className="modal-subtitle-text">Thiết lập hồ sơ showroom, địa chỉ GPS và ảnh nhận diện thương hiệu</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Đóng"
            disabled={submitting}
            onClick={() => setShowCreateModal(false)}
          />
        </div>

        <Form onSubmit={handleCreateSubmit}>
          <div className="vestora-modal-body">
            <div className="modal-section-card">
              <div className="modal-section-header">
                <div className="modal-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  <span>1. Thông Tin Cơ Bản & Hotline Liên Hệ</span>
                </div>
                <span className="modal-section-badge">Bắt buộc</span>
              </div>

              <Row className="g-4 mb-4">
                <Col md={8}>
                  <Form.Group>
                    <label className="modal-field-label">
                      Tên Chi Nhánh Showroom <span className="req">*</span>
                    </label>
                    <Form.Control
                      type="text"
                      required
                      placeholder="VD: Vestora Showroom Tràng Tiền"
                      value={formData.name}
                      isInvalid={Boolean(formErrors.name)}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: '' }));
                      }}
                      style={{ fontSize: '13px' }}
                    />
                    {formErrors.name && (
                      <div className="vestora-invalid-feedback d-block">{formErrors.name}</div>
                    )}
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <label className="modal-field-label">
                      Hotline Showroom <span className="req">*</span>
                    </label>
                    <Form.Control
                      type="text"
                      required
                      placeholder="VD: 0912345678"
                      value={formData.phone}
                      isInvalid={Boolean(formErrors.phone)}
                      onChange={(e) => {
                        setFormData({ ...formData, phone: e.target.value });
                        if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: '' }));
                      }}
                      style={{ fontSize: '13px' }}
                    />
                    {formErrors.phone && (
                      <div className="vestora-invalid-feedback d-block">{formErrors.phone}</div>
                    )}
                  </Form.Group>
                </Col>
              </Row>

              <div className="mb-4">
                <OpeningHoursInput
                  value={formData.openingHours}
                  onChange={(val) => {
                    setFormData((prev) => ({ ...prev, openingHours: val }));
                    if (formErrors.openingHours) setFormErrors((prev) => ({ ...prev, openingHours: '' }));
                  }}
                  isInvalid={Boolean(formErrors.openingHours)}
                  errorMessage={formErrors.openingHours}
                />
              </div>

              <div className="p-2 px-3 rounded-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <Form.Check
                  type="switch"
                  id="is-hq-switch-create"
                  label={
                    <span style={{ fontSize: '13px', fontWeight: 600, color: formData.isHQ ? '#D97706' : '#1E293B' }}>
                      Thiết lập chi nhánh này làm Trụ Sở Chính (Headquarter - HQ)
                    </span>
                  }
                  checked={formData.isHQ}
                  onChange={(e) => setFormData({ ...formData, isHQ: e.target.checked })}
                />
                <div className="text-muted small mt-1" style={{ fontSize: '11.5px', paddingLeft: '2.4em' }}>
                  Showroom Trụ Sở Chính sẽ được gắn huy hiệu Gold Seal và hiển thị ưu tiên hàng đầu trên toàn chuỗi Vestora.
                </div>
              </div>
            </div>

            <div className="modal-section-card">
              <div className="modal-section-header">
                <div className="modal-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>2. Bổ Nhiệm Quản Lý Chi Nhánh (Branch Manager)</span>
                </div>
                <span className="modal-section-badge">Tùy chọn</span>
              </div>
              <Form.Group>
                <label className="modal-field-label">
                  Nhân Sự Phụ Trách Vận Hành Showroom
                </label>
                <SearchableSelect
                  options={managers.map((m) => ({
                    value: m._id,
                    label: m.FullName || m.fullName || 'Quản lý',
                    email: m.Email || m.email,
                    phone: m.phone,
                    badge: m.Role || m.role,
                    avatar: m.Avatar || m.avatar,
                  }))}
                  value={formData.managerId}
                  onChange={(val) => setFormData((prev) => ({ ...prev, managerId: val }))}
                  placeholder="-- Chọn hoặc tìm kiếm Branch Manager --"
                  searchPlaceholder="Tìm theo tên, email, hotline..."
                  allowClear
                  clearLabel="-- Chưa bổ nhiệm (để trống) --"
                />
                <div className="text-muted small mt-1" style={{ fontSize: '11.5px' }}>
                  Branch Manager chịu trách nhiệm quản lý nhân viên, lịch fitting và xuất nhập kho của chi nhánh này.
                </div>
              </Form.Group>
            </div>

            <div className="modal-section-card">
              <div className="modal-section-header">
                <div className="modal-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>3. Địa Giới Hành Chính & Định Vị Bản Đồ GPS</span>
                </div>
                <span className="modal-section-badge">Bắt buộc</span>
              </div>

              <Row className="g-4 mb-4">
                <Col md={6}>
                  <Form.Group>
                    <label className="modal-field-label">
                      Tỉnh / Thành Phố <span className="req">*</span>
                    </label>
                    <SearchableSelect
                      options={(provinces.length > 0 ? provinces : FALLBACK_PROVINCES).map((p) => ({
                        value: p.name,
                        label: p.name,
                        code: p.code,
                      }))}
                      value={formData.city}
                      onChange={(val, opt) => handleProvinceChange(val, opt)}
                      placeholder="-- Chọn hoặc tìm Tỉnh / Thành phố --"
                      searchPlaceholder="Gõ tìm Tỉnh / Thành phố..."
                      isInvalid={Boolean(formErrors.city)}
                      loading={loadingProvinces}
                    />
                    {formErrors.city && (
                      <div className="vestora-invalid-feedback d-block">{formErrors.city}</div>
                    )}
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <label className="modal-field-label">
                      Phường / Xã / Thị Trấn
                    </label>
                    <SearchableSelect
                      options={wards.map((w) => ({
                        value: w.name,
                        label: w.name,
                      }))}
                      value={formData.ward}
                      onChange={(val) => setFormData((prev) => ({ ...prev, ward: val }))}
                      placeholder={loadingWards ? 'Đang tải danh sách Phường / Xã...' : (wards.length > 0 ? '-- Chọn Phường / Xã --' : '-- Chọn hoặc nhập Phường / Xã --')}
                      searchPlaceholder="Gõ tìm Phường / Xã..."
                      disabled={!formData.city || loadingWards}
                      allowClear
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-4">
                <label className="modal-field-label">
                  Địa Chỉ Chi Tiết Số Nhà, Đường Phố
                </label>
                <Form.Control
                  type="text"
                  placeholder="VD: Số 45 Phố Tràng Tiền"
                  value={formData.address}
                  isInvalid={Boolean(formErrors.address)}
                  onChange={(e) => {
                    setFormData({ ...formData, address: e.target.value });
                    if (formErrors.address) setFormErrors((prev) => ({ ...prev, address: '' }));
                  }}
                  style={{ fontSize: '13px' }}
                />
                {formErrors.address && (
                  <div className="vestora-invalid-feedback d-block">{formErrors.address}</div>
                )}
              </Form.Group>

              <div className="p-4 rounded-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <div>
                    <label className="modal-field-label mb-0">
                      Ghim Tọa Độ Vị Trí Showroom (Leaflet Maps) <span className="req">*</span>
                    </label>
                    <div className="text-muted small" style={{ fontSize: '11px' }}>
                      Click trực tiếp trên bản đồ hoặc dùng nút GPS để tự động định vị
                    </div>
                  </div>
                  <GeoLocateButton
                    onLocationFound={handleGpsLocationFound}
                    variant="luxury"
                    currentCity={formData.city}
                  />
                </div>
                <LeafletMapPicker
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  height="260px"
                  onChange={({ latitude, longitude }) => {
                    setFormData((prev) => ({
                      ...prev,
                      latitude: String(latitude),
                      longitude: String(longitude),
                    }));
                    if (formErrors.coordinates) setFormErrors((prev) => ({ ...prev, coordinates: '' }));
                  }}
                />
                <Row className="g-3 mt-3">
                  <Col sm={6}>
                    <Form.Control
                      size="sm"
                      placeholder="Vĩ độ (Latitude) VD: 21.028511"
                      value={formData.latitude}
                      isInvalid={Boolean(formErrors.coordinates)}
                      onChange={(e) => {
                        setFormData({ ...formData, latitude: e.target.value });
                        if (formErrors.coordinates) setFormErrors((prev) => ({ ...prev, coordinates: '' }));
                      }}
                      style={{ fontSize: '12px' }}
                    />
                  </Col>
                  <Col sm={6}>
                    <Form.Control
                      size="sm"
                      placeholder="Kinh độ (Longitude) VD: 105.854444"
                      value={formData.longitude}
                      isInvalid={Boolean(formErrors.coordinates)}
                      onChange={(e) => {
                        setFormData({ ...formData, longitude: e.target.value });
                        if (formErrors.coordinates) setFormErrors((prev) => ({ ...prev, coordinates: '' }));
                      }}
                      style={{ fontSize: '12px' }}
                    />
                  </Col>
                </Row>
                {formErrors.coordinates && (
                  <div className="vestora-invalid-feedback d-block mt-1">{formErrors.coordinates}</div>
                )}
              </div>
            </div>

            <div className="modal-section-card">
              <div className="modal-section-header">
                <div className="modal-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span>4. Hình Ảnh Showroom & Nhận Diện Chi Nhánh</span>
                </div>
                <span className="modal-section-badge">Hỗ trợ 16:9 & 9:16</span>
              </div>

              <input
                type="file"
                ref={createBannerFileRef}
                accept="image/png,image/jpeg,image/webp,image/jpg"
                style={{ display: 'none' }}
                onChange={(e) => handleUploadImageFile(e, 'banner')}
              />
              <input
                type="file"
                ref={createAvatarFileRef}
                accept="image/png,image/jpeg,image/webp,image/jpg"
                style={{ display: 'none' }}
                onChange={(e) => handleUploadImageFile(e, 'avatar')}
              />

              <div
                onClick={() => {
                  if (uploadingAvatar || uploadingBanner) return;
                  if (formData.bannerUrl && !formData.bannerUrl.startsWith('blob:')) {
                    setLightboxImage({
                      url: formData.bannerUrl,
                      title: `${formData.name || 'Chi Nhánh'} — Ảnh Bìa Showroom (Kích Thước Gốc)`,
                    });
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingBanner(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDraggingBanner(false);
                }}
                onDrop={handleDropBanner}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '190px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#0F172A',
                  marginBottom: '14px',
                  border: isDraggingBanner ? '2px dashed #D97706' : '1px solid #CBD5E1',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  cursor: formData.bannerUrl ? 'pointer' : 'default',
                  transition: 'border 0.2s ease',
                }}
                title={formData.bannerUrl ? 'Click vào ảnh để xem 100% kích thước ảnh thật' : ''}
              >
                {isDraggingBanner && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(15, 23, 42, 0.88)',
                      backdropFilter: 'blur(4px)',
                      zIndex: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#F59E0B',
                      gap: '8px',
                      pointerEvents: 'none',
                    }}
                  >
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span style={{ fontSize: '13.5px', fontWeight: 700 }}>Thả file ảnh vào đây để tải lên ngay</span>
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    inset: '-15px',
                    backgroundImage: `url(${formData.bannerUrl || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(16px) brightness(0.65)',
                    transform: 'scale(1.1)',
                  }}
                />
                <img
                  src={formData.bannerUrl || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'}
                  alt="Showroom Banner Preview"
                  onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'; }}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center 20%',
                    filter: 'brightness(0.95)',
                  }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.7) 0%, transparent 60%)', pointerEvents: 'none' }} />

                {formData.bannerUrl && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      zIndex: 2,
                      fontSize: '11px',
                      fontWeight: 600,
                      background: 'rgba(15, 23, 42, 0.75)',
                      backdropFilter: 'blur(6px)',
                      color: '#FFF',
                      borderRadius: '6px',
                      padding: '4px 9px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      pointerEvents: 'none',
                    }}
                  >
                    <span>🔍 Click xem ảnh thật</span>
                  </div>
                )}

                <div style={{ position: 'absolute', bottom: '12px', left: '14px', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 3 }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={formData.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'Branch')}&background=0F172A&color=D97706&size=120`}
                      alt="Avatar Preview"
                      onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'Branch')}&background=0F172A&color=D97706&size=120`; }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (uploadingAvatar || uploadingBanner) return;
                        if (formData.imageUrl && !formData.imageUrl.startsWith('blob:')) {
                          setLightboxImage({
                            url: formData.imageUrl,
                            title: `${formData.name || 'Chi Nhánh'} — Logo Đại Diện (Kích Thước Gốc)`,
                          });
                        }
                      }}
                      title="Click để xem ảnh đại diện"
                      style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '12px',
                        objectFit: 'cover',
                        border: '2.5px solid #FFFFFF',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
                        background: '#0F172A',
                        cursor: formData.imageUrl ? 'pointer' : 'default',
                      }}
                    />
                    {uploadingAvatar && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Spinner size="sm" animation="border" variant="light" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ color: '#FFF', fontWeight: 700, fontSize: '13px', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                      {formData.name || 'Chi Nhánh Showroom'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 pt-3 border-top" style={{ borderColor: '#E2E8F0' }}>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <Button
                    type="button"
                    variant="outline-dark"
                    size="sm"
                    disabled={uploadingBanner}
                    onClick={(e) => {
                      e.stopPropagation();
                      createBannerFileRef.current?.click();
                    }}
                    style={{ fontSize: '12px', fontWeight: 600, borderRadius: '8px', padding: '5px 14px' }}
                  >
                    {uploadingBanner ? <Spinner size="sm" animation="border" className="me-1" /> : '📷 Đổi Ảnh Bìa'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-dark"
                    size="sm"
                    disabled={uploadingAvatar}
                    onClick={(e) => {
                      e.stopPropagation();
                      createAvatarFileRef.current?.click();
                    }}
                    style={{ fontSize: '12px', fontWeight: 600, borderRadius: '8px', padding: '5px 14px' }}
                  >
                    {uploadingAvatar ? <Spinner size="sm" animation="border" className="me-1" /> : '📁 Đổi Logo Showroom'}
                  </Button>
                </div>

                <div className="text-muted small d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                  <span>💡 Kéo thả file ảnh trực tiếp hoặc click ảnh để xem kích thước thật 100%</span>
                </div>
              </div>
            </div>

            <div className="modal-section-card">
              <div className="modal-section-header">
                <div className="modal-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
                    <line x1="21" y1="10" x2="3" y2="10" />
                    <line x1="21" y1="6" x2="3" y2="6" />
                    <line x1="21" y1="14" x2="3" y2="14" />
                    <line x1="21" y1="18" x2="7" y2="18" />
                  </svg>
                  <span>5. Giới Thiệu & Dịch Vụ Showroom</span>
                </div>
                <span className="modal-section-badge">Tùy chọn</span>
              </div>
              <Form.Group>
                <label className="modal-field-label">
                  Mô Tả Không Gian & Tiện Ích Showroom
                </label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="Giới thiệu về không gian phòng thử đồ riêng tư, tư vấn viên cao cấp, đỗ xe thuận tiện..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ fontSize: '13px' }}
                />
              </Form.Group>
            </div>
          </div>

          <div className="vestora-modal-footer">
            <button
              type="button"
              className="btn-modal-secondary"
              onClick={() => setShowCreateModal(false)}
              disabled={submitting}
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              className="btn-modal-primary"
              disabled={submitting || uploadingAvatar || uploadingBanner}
            >
              {submitting ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  <span>Đang Khởi Tạo...</span>
                </>
              ) : (uploadingAvatar || uploadingBanner) ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  <span>Đang Tải Ảnh Lên...</span>
                </>
              ) : (
                <>
                  <span>+</span>
                  <span>Khởi Tạo Chi Nhánh</span>
                </>
              )}
            </button>
          </div>
        </Form>
      </Modal>

      <Modal
        show={showEditModal}
        onHide={() => !submitting && setShowEditModal(false)}
        size="lg"
        centered
        backdrop="static"
        dialogClassName="vestora-modal-dialog"
      >
        <div className="vestora-modal-header">
          <div className="modal-header-brand-wrap">
            <div className="modal-header-icon-badge edit">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <div>
              <h5 className="modal-title-main">Chỉnh Sửa Chi Nhánh: {activeBranch?.name}</h5>
              <p className="modal-subtitle-text">Cập nhật thông tin vận hành, quản lý phụ trách, vị trí tọa độ GPS và hình ảnh</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Đóng"
            disabled={submitting}
            onClick={() => setShowEditModal(false)}
          />
        </div>

        <Form onSubmit={handleEditSubmit}>
          <div className="vestora-modal-body">
            <div className="modal-section-card">
              <div className="modal-section-header">
                <div className="modal-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  <span>1. Thông Tin Showroom & Trạng Thái Hoạt Động</span>
                </div>
                <span className="modal-section-badge">Bắt buộc</span>
              </div>

              <Row className="g-4 mb-4">
                <Col md={8}>
                  <Form.Group>
                    <label className="modal-field-label">
                      Tên Chi Nhánh Showroom <span className="req">*</span>
                    </label>
                    <Form.Control
                      type="text"
                      required
                      value={formData.name}
                      isInvalid={Boolean(formErrors.name)}
                      onChange={(e) => {
                        setFormData({ ...formData, name: e.target.value });
                        if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: '' }));
                      }}
                      style={{ fontSize: '13px' }}
                    />
                    {formErrors.name && (
                      <div className="vestora-invalid-feedback d-block">{formErrors.name}</div>
                    )}
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <label className="modal-field-label">
                      Hotline Showroom <span className="req">*</span>
                    </label>
                    <Form.Control
                      type="text"
                      required
                      value={formData.phone}
                      isInvalid={Boolean(formErrors.phone)}
                      onChange={(e) => {
                        setFormData({ ...formData, phone: e.target.value });
                        if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: '' }));
                      }}
                      style={{ fontSize: '13px' }}
                    />
                    {formErrors.phone && (
                      <div className="vestora-invalid-feedback d-block">{formErrors.phone}</div>
                    )}
                  </Form.Group>
                </Col>
              </Row>

              <Row className="g-4 mb-4">
                <Col md={6}>
                  <Form.Group>
                    <label className="modal-field-label">
                      Trạng Thái Vận Hành Showroom
                    </label>
                    <Form.Select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      style={{ fontSize: '13px', fontWeight: 600 }}
                    >
                      <option value="ACTIVE">🟢 Đang Hoạt Động (Mở Cửa Đón Khách)</option>
                      <option value="SUSPENDED">🔴 Tạm Ngưng Hoạt Động (Đóng Cửa / Nâng Cấp)</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <label className="modal-field-label">
                      Thiết Lập Trụ Sở Chính (Headquarter)
                    </label>
                    <div className="p-2 px-3 rounded-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', height: '38px', display: 'flex', alignItems: 'center' }}>
                      <Form.Check
                        type="switch"
                        id="is-hq-switch-edit"
                        label={
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: formData.isHQ ? '#D97706' : '#1E293B' }}>
                            Đặt làm Trụ Sở Chính (HQ)
                          </span>
                        }
                        checked={formData.isHQ}
                        onChange={(e) => setFormData({ ...formData, isHQ: e.target.checked })}
                      />
                    </div>
                  </Form.Group>
                </Col>
              </Row>

              <div className="mb-3">
                <OpeningHoursInput
                  value={formData.openingHours}
                  onChange={(val) => {
                    setFormData((prev) => ({ ...prev, openingHours: val }));
                    if (formErrors.openingHours) setFormErrors((prev) => ({ ...prev, openingHours: '' }));
                  }}
                  isInvalid={Boolean(formErrors.openingHours)}
                  errorMessage={formErrors.openingHours}
                />
              </div>
            </div>

            <div className="modal-section-card">
              <div className="modal-section-header">
                <div className="modal-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>2. Bổ Nhiệm Quản Lý Chi Nhánh (Branch Manager)</span>
                </div>
                <span className="modal-section-badge">Tùy chọn</span>
              </div>
              <Form.Group>
                <label className="modal-field-label">
                  Nhân Sự Phụ Trách Vận Hành Showroom
                </label>
                <SearchableSelect
                  options={managers.map((m) => ({
                    value: m._id,
                    label: m.FullName || m.fullName || 'Quản lý',
                    email: m.Email || m.email,
                    phone: m.phone,
                    badge: m.Role || m.role,
                    avatar: m.Avatar || m.avatar,
                  }))}
                  value={formData.managerId}
                  onChange={(val) => setFormData((prev) => ({ ...prev, managerId: val }))}
                  placeholder="-- Chọn hoặc tìm kiếm Branch Manager --"
                  searchPlaceholder="Tìm theo tên, email, hotline..."
                  allowClear
                  clearLabel="-- Chưa bổ nhiệm (để trống) --"
                />
                <div className="text-muted small mt-1" style={{ fontSize: '11.5px' }}>
                  Branch Manager chịu trách nhiệm quản lý nhân viên, lịch fitting và xuất nhập kho của chi nhánh này.
                </div>
              </Form.Group>
            </div>

            <div className="modal-section-card">
              <div className="modal-section-header">
                <div className="modal-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>3. Địa Giới Hành Chính & Định Vị Bản Đồ GPS</span>
                </div>
                <span className="modal-section-badge">Bắt buộc</span>
              </div>

              <Row className="g-4 mb-4">
                <Col md={6}>
                  <Form.Group>
                    <label className="modal-field-label">
                      Tỉnh / Thành Phố <span className="req">*</span>
                    </label>
                    <SearchableSelect
                      options={(provinces.length > 0 ? provinces : FALLBACK_PROVINCES).map((p) => ({
                        value: p.name,
                        label: p.name,
                        code: p.code,
                      }))}
                      value={formData.city}
                      onChange={(val, opt) => handleProvinceChange(val, opt)}
                      placeholder="-- Chọn hoặc tìm Tỉnh / Thành phố --"
                      searchPlaceholder="Gõ tìm Tỉnh / Thành phố..."
                      isInvalid={Boolean(formErrors.city)}
                      loading={loadingProvinces}
                    />
                    {formErrors.city && (
                      <div className="vestora-invalid-feedback d-block">{formErrors.city}</div>
                    )}
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <label className="modal-field-label">
                      Phường / Xã / Thị Trấn
                    </label>
                    <SearchableSelect
                      options={wards.map((w) => ({
                        value: w.name,
                        label: w.name,
                      }))}
                      value={formData.ward}
                      onChange={(val) => setFormData((prev) => ({ ...prev, ward: val }))}
                      placeholder={loadingWards ? 'Đang tải danh sách Phường / Xã...' : (wards.length > 0 ? '-- Chọn Phường / Xã --' : '-- Chọn hoặc nhập Phường / Xã --')}
                      searchPlaceholder="Gõ tìm Phường / Xã..."
                      disabled={!formData.city || loadingWards}
                      allowClear
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-4">
                <label className="modal-field-label">
                  Địa Chỉ Chi Tiết Số Nhà, Đường Phố
                </label>
                <Form.Control
                  type="text"
                  value={formData.address}
                  isInvalid={Boolean(formErrors.address)}
                  onChange={(e) => {
                    setFormData({ ...formData, address: e.target.value });
                    if (formErrors.address) setFormErrors((prev) => ({ ...prev, address: '' }));
                  }}
                  style={{ fontSize: '13px' }}
                />
                {formErrors.address && (
                  <div className="vestora-invalid-feedback d-block">{formErrors.address}</div>
                )}
              </Form.Group>

              <div className="p-4 rounded-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                  <div>
                    <label className="modal-field-label mb-0">
                      Ghim Tọa Độ Vị Trí Showroom (Leaflet Maps) <span className="req">*</span>
                    </label>
                    <div className="text-muted small" style={{ fontSize: '11px' }}>
                      Click trực tiếp trên bản đồ hoặc dùng nút GPS để tự động định vị
                    </div>
                  </div>
                  <GeoLocateButton
                    onLocationFound={handleGpsLocationFound}
                    variant="luxury"
                    currentCity={formData.city}
                  />
                </div>
                <LeafletMapPicker
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  height="260px"
                  onChange={({ latitude, longitude }) => {
                    setFormData((prev) => ({
                      ...prev,
                      latitude: String(latitude),
                      longitude: String(longitude),
                    }));
                    if (formErrors.coordinates) setFormErrors((prev) => ({ ...prev, coordinates: '' }));
                  }}
                />
                <Row className="g-3 mt-3">
                  <Col sm={6}>
                    <Form.Control
                      size="sm"
                      placeholder="Vĩ độ (Latitude) VD: 21.028511"
                      value={formData.latitude}
                      isInvalid={Boolean(formErrors.coordinates)}
                      onChange={(e) => {
                        setFormData({ ...formData, latitude: e.target.value });
                        if (formErrors.coordinates) setFormErrors((prev) => ({ ...prev, coordinates: '' }));
                      }}
                      style={{ fontSize: '12px' }}
                    />
                  </Col>
                  <Col sm={6}>
                    <Form.Control
                      size="sm"
                      placeholder="Kinh độ (Longitude) VD: 105.854444"
                      value={formData.longitude}
                      isInvalid={Boolean(formErrors.coordinates)}
                      onChange={(e) => {
                        setFormData({ ...formData, longitude: e.target.value });
                        if (formErrors.coordinates) setFormErrors((prev) => ({ ...prev, coordinates: '' }));
                      }}
                      style={{ fontSize: '12px' }}
                    />
                  </Col>
                </Row>
                {formErrors.coordinates && (
                  <div className="vestora-invalid-feedback d-block mt-1">{formErrors.coordinates}</div>
                )}
              </div>
            </div>

            <div className="modal-section-card">
              <div className="modal-section-header">
                <div className="modal-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  <span>4. Hình Ảnh Showroom & Nhận Diện Chi Nhánh</span>
                </div>
                <span className="modal-section-badge">Hỗ trợ 16:9 & 9:16</span>
              </div>

              <input
                type="file"
                ref={editBannerFileRef}
                accept="image/png,image/jpeg,image/webp,image/jpg"
                style={{ display: 'none' }}
                onChange={(e) => handleUploadImageFile(e, 'banner')}
              />
              <input
                type="file"
                ref={editAvatarFileRef}
                accept="image/png,image/jpeg,image/webp,image/jpg"
                style={{ display: 'none' }}
                onChange={(e) => handleUploadImageFile(e, 'avatar')}
              />

              <div
                onClick={() => {
                  if (uploadingAvatar || uploadingBanner) return;
                  if (formData.bannerUrl && !formData.bannerUrl.startsWith('blob:')) {
                    setLightboxImage({
                      url: formData.bannerUrl,
                      title: `${formData.name || 'Chi Nhánh'} — Ảnh Bìa Showroom (Kích Thước Gốc)`,
                    });
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingBanner(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDraggingBanner(false);
                }}
                onDrop={handleDropBanner}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '190px',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#0F172A',
                  marginBottom: '14px',
                  border: isDraggingBanner ? '2px dashed #D97706' : '1px solid #CBD5E1',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  cursor: formData.bannerUrl ? 'pointer' : 'default',
                  transition: 'border 0.2s ease',
                }}
                title={formData.bannerUrl ? 'Click vào ảnh để xem 100% kích thước ảnh thật' : ''}
              >
                {isDraggingBanner && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(15, 23, 42, 0.88)',
                      backdropFilter: 'blur(4px)',
                      zIndex: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#F59E0B',
                      gap: '8px',
                      pointerEvents: 'none',
                    }}
                  >
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <span style={{ fontSize: '13.5px', fontWeight: 700 }}>Thả file ảnh vào đây để tải lên ngay</span>
                  </div>
                )}

                <div
                  style={{
                    position: 'absolute',
                    inset: '-15px',
                    backgroundImage: `url(${formData.bannerUrl || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    filter: 'blur(16px) brightness(0.65)',
                    transform: 'scale(1.1)',
                  }}
                />
                <img
                  src={formData.bannerUrl || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'}
                  alt="Showroom Banner Preview"
                  onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'; }}
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center 20%',
                    filter: 'brightness(0.95)',
                  }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.7) 0%, transparent 60%)', pointerEvents: 'none' }} />

                {formData.bannerUrl && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      zIndex: 2,
                      fontSize: '11px',
                      fontWeight: 600,
                      background: 'rgba(15, 23, 42, 0.75)',
                      backdropFilter: 'blur(6px)',
                      color: '#FFF',
                      borderRadius: '6px',
                      padding: '4px 9px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      pointerEvents: 'none',
                    }}
                  >
                    <span>🔍 Click xem ảnh thật</span>
                  </div>
                )}

                <div style={{ position: 'absolute', bottom: '12px', left: '14px', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 3 }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={formData.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'Branch')}&background=0F172A&color=D97706&size=120`}
                      alt="Avatar Preview"
                      onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'Branch')}&background=0F172A&color=D97706&size=120`; }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (uploadingAvatar || uploadingBanner) return;
                        if (formData.imageUrl && !formData.imageUrl.startsWith('blob:')) {
                          setLightboxImage({
                            url: formData.imageUrl,
                            title: `${formData.name || 'Chi Nhánh'} — Logo Đại Diện (Kích Thước Gốc)`,
                          });
                        }
                      }}
                      title="Click để phóng to xem logo"
                      style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '12px',
                        objectFit: 'cover',
                        border: '2.5px solid #FFFFFF',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
                        background: '#0F172A',
                        cursor: formData.imageUrl ? 'pointer' : 'default',
                      }}
                    />
                    {uploadingAvatar && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Spinner size="sm" animation="border" variant="light" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ color: '#FFF', fontWeight: 700, fontSize: '13px', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                      {formData.name || 'Chi Nhánh Showroom'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 pt-3 border-top" style={{ borderColor: '#E2E8F0' }}>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <Button
                    type="button"
                    variant="outline-dark"
                    size="sm"
                    disabled={uploadingBanner}
                    onClick={(e) => {
                      e.stopPropagation();
                      editBannerFileRef.current?.click();
                    }}
                    style={{ fontSize: '12px', fontWeight: 600, borderRadius: '8px', padding: '5px 14px' }}
                  >
                    {uploadingBanner ? <Spinner size="sm" animation="border" className="me-1" /> : '📷 Đổi Ảnh Bìa'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-dark"
                    size="sm"
                    disabled={uploadingAvatar}
                    onClick={(e) => {
                      e.stopPropagation();
                      editAvatarFileRef.current?.click();
                    }}
                    style={{ fontSize: '12px', fontWeight: 600, borderRadius: '8px', padding: '5px 14px' }}
                  >
                    {uploadingAvatar ? <Spinner size="sm" animation="border" className="me-1" /> : '📁 Đổi Logo Showroom'}
                  </Button>
                </div>

                <div className="text-muted small d-flex align-items-center gap-1" style={{ fontSize: '11px' }}>
                  <span>💡 Kéo thả file ảnh trực tiếp hoặc click ảnh để xem kích thước thật 100%</span>
                </div>
              </div>
            </div>

            <div className="modal-section-card">
              <div className="modal-section-header">
                <div className="modal-section-title">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2">
                    <line x1="21" y1="10" x2="3" y2="10" />
                    <line x1="21" y1="6" x2="3" y2="6" />
                    <line x1="21" y1="14" x2="3" y2="14" />
                    <line x1="21" y1="18" x2="7" y2="18" />
                  </svg>
                  <span>5. Giới Thiệu & Dịch Vụ Showroom</span>
                </div>
                <span className="modal-section-badge">Tùy chọn</span>
              </div>
              <Form.Group>
                <label className="modal-field-label">
                  Mô Tả / Giới Thiệu Showroom
                </label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  value={formData.description}
                  isInvalid={Boolean(formErrors.description)}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    if (formErrors.description) setFormErrors((prev) => ({ ...prev, description: '' }));
                  }}
                  style={{ fontSize: '13px' }}
                />
                {formErrors.description && (
                  <div className="vestora-invalid-feedback d-block">{formErrors.description}</div>
                )}
              </Form.Group>
            </div>
          </div>

          <div className="vestora-modal-footer">
            <button
              type="button"
              className="btn-modal-secondary"
              onClick={() => setShowEditModal(false)}
              disabled={submitting}
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              className="btn-modal-primary"
              disabled={submitting || uploadingAvatar || uploadingBanner}
            >
              {submitting ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  <span>Đang Lưu...</span>
                </>
              ) : (uploadingAvatar || uploadingBanner) ? (
                <>
                  <Spinner size="sm" animation="border" className="me-1" />
                  <span>Đang Tải Ảnh Lên...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Lưu Cập Nhật Showroom</span>
                </>
              )}
            </button>
          </div>
        </Form>
      </Modal>

      <Modal
        show={showDeleteModal}
        onHide={() => !submitting && setShowDeleteModal(false)}
        centered
        backdrop="static"
        dialogClassName="vestora-modal-dialog modal-danger"
      >
        <div className="vestora-modal-header" style={{ borderBottom: '1px solid #FEE2E2', background: '#FEF2F2' }}>
          <div className="modal-header-brand-wrap">
            <div className="modal-header-icon-badge delete">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <h5 className="modal-title-main" style={{ color: '#991B1B' }}>Xác Nhận Xóa Chi Nhánh</h5>
              <p className="modal-subtitle-text" style={{ color: '#B91C1C' }}>Thao tác này sẽ gỡ bỏ showroom khỏi mạng lưới chuỗi Vestora</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Đóng"
            disabled={submitting}
            onClick={() => setShowDeleteModal(false)}
          />
        </div>

        <div className="p-4 bg-white">
          {activeBranch?.isHQ && (
            <div className="p-3 rounded-2 mb-3 d-flex align-items-start gap-2" style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', fontSize: '13px' }}>
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <div>
                <strong>Lưu ý quan trọng:</strong> Đây hiện đang là <strong>Trụ Sở Chính (HQ)</strong> của toàn chuỗi. Nếu xóa, bạn nên chỉ định một showroom khác làm HQ để đảm bảo quy trình vận hành chuỗi không bị gián đoạn.
              </div>
            </div>
          )}

          <p style={{ fontSize: '14px', color: '#1F2937', marginBottom: '14px' }}>
            Bạn có chắc chắn muốn xóa chi nhánh <strong style={{ color: '#0F172A' }}>"{activeBranch?.name}"</strong> không?
          </p>

          <div className="p-3 rounded-3" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '12.5px', color: '#475569', lineHeight: 1.6 }}>
            <div><strong style={{ color: '#0F172A' }}>Địa chỉ:</strong> {[activeBranch?.address, activeBranch?.ward, activeBranch?.city].filter(Boolean).join(', ') || 'Chưa cập nhật'}</div>
            <div><strong style={{ color: '#0F172A' }}>Hotline liên hệ:</strong> {activeBranch?.phone || '—'}</div>
            {activeBranch?.managerId && (
              <div><strong style={{ color: '#0F172A' }}>Quản lý phụ trách:</strong> {activeBranch.managerId.FullName || activeBranch.managerId.fullName} ({activeBranch.managerId.Email || activeBranch.managerId.email})</div>
            )}
          </div>

          <div className="text-danger small mt-3 d-flex align-items-center gap-1" style={{ fontSize: '12px', fontWeight: 500 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Thao tác xóa là vĩnh viễn và không thể khôi phục lại hồ sơ này.</span>
          </div>
        </div>

        <div className="vestora-modal-footer">
          <button
            type="button"
            className="btn-modal-secondary"
            onClick={() => setShowDeleteModal(false)}
            disabled={submitting}
          >
            Hủy Bỏ
          </button>
          <button
            type="button"
            className="btn-modal-danger"
            onClick={handleDeleteSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Spinner size="sm" animation="border" className="me-1" />
                <span>Đang Xóa...</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Xác Nhận Xóa Chi Nhánh</span>
              </>
            )}
          </button>
        </div>
      </Modal>

      <Modal
        show={showMapModal}
        onHide={() => setShowMapModal(false)}
        size="lg"
        centered
        dialogClassName="vestora-modal-dialog"
      >
        <div className="vestora-modal-header">
          <div className="modal-header-brand-wrap">
            <div className="modal-header-icon-badge map">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            </div>
            <div>
              <h5 className="modal-title-main">Bản Đồ Vị Trí Showroom: {activeBranch?.name}</h5>
              <p className="modal-subtitle-text">Tọa độ GPS chuẩn xác & điều hướng bản đồ trực quan</p>
            </div>
          </div>
          <button
            type="button"
            className="btn-close"
            aria-label="Đóng"
            onClick={() => setShowMapModal(false)}
          />
        </div>

        <div className="p-3 bg-white">
          <div className="mb-3 p-3 rounded-2" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '13px' }}>
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <strong style={{ color: '#0F172A' }}>Địa chỉ thực tế:</strong>{' '}
                <span style={{ color: '#475569' }}>
                  {[activeBranch?.address, activeBranch?.ward, activeBranch?.district, activeBranch?.city].filter(Boolean).join(', ') || 'Chưa cập nhật địa chỉ'}
                </span>
              </div>
              <div>
                <span className="badge" style={{ background: '#0F172A', color: '#F59E0B', fontWeight: 600, padding: '5px 10px', fontSize: '11.5px', fontFamily: 'monospace' }}>
                  {activeBranch?.latitude && activeBranch?.longitude
                    ? `GPS: ${Number(activeBranch.latitude).toFixed(5)}°N, ${Number(activeBranch.longitude).toFixed(5)}°E`
                    : 'Chưa có tọa độ GPS'}
                </span>
              </div>
            </div>
          </div>

          <LeafletMapPicker
            latitude={activeBranch?.latitude}
            longitude={activeBranch?.longitude}
            readOnly={true}
            height="400px"
            label={activeBranch?.name || 'Vị trí Showroom'}
          />
        </div>

        <div className="vestora-modal-footer">
          {activeBranch?.latitude && activeBranch?.longitude && (
            <a
              href={`https://www.google.com/maps?q=${activeBranch.latitude},${activeBranch.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm me-auto d-inline-flex align-items-center gap-1"
              style={{
                fontSize: '12.5px',
                fontWeight: 600,
                color: '#0F172A',
                background: '#F1F5F9',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '6px 14px',
              }}
            >
              <span>Mở Trên Google Maps</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          )}
          <button
            type="button"
            className="btn-modal-secondary"
            onClick={() => setShowMapModal(false)}
          >
            Đóng
          </button>
        </div>
      </Modal>

      {toast && (
        <div className={`store-floating-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}
      <ImageLightboxModal
        show={Boolean(lightboxImage)}
        onHide={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url}
        title={lightboxImage?.title}
      />
    </div>
  );
}
