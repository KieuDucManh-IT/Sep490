import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopHeader from '../../components/AdminTopHeader';
import '../../styles/AdminDashboard.css';
import '../../styles/AdminAccounts.css';
import { validateEditForm } from '../../utils/userValidation';

import {
  normalizeRole,
  roleColor,
  isUserAdmin,
  isCustomer,
  isSelf,
  cannotLock,
  isGoogleUser
} from '../../components/admin/accounts/accountHelpers';
import AdminAccountStats from '../../components/admin/accounts/AdminAccountStats';
import AdminAccountFilters from '../../components/admin/accounts/AdminAccountFilters';
import AdminAccountTable from '../../components/admin/accounts/AdminAccountTable';
import AdminAccountDrawer from '../../components/admin/accounts/AdminAccountDrawer';
import AdminAddAccountModal from '../../components/admin/accounts/AdminAddAccountModal';
import AdminEditAccountModal from '../../components/admin/accounts/AdminEditAccountModal';
import AdminResetPasswordModal from '../../components/admin/accounts/AdminResetPasswordModal';
import AdminSendNotifyModal from '../../components/admin/accounts/AdminSendNotifyModal';
import AdminLockAccountModal from '../../components/admin/accounts/AdminLockAccountModal';
import AdminToastContainer from '../../components/admin/accounts/AdminToastContainer';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export default function AdminAccountsPage() {
  const { user: currentUser } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // --- Toast Notifications ---
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  // --- Core State ---
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState('INFO');
  const [isLoading, setIsLoading] = useState(true);
  const [backendStats, setBackendStats] = useState(null);

  // --- Filters & Pagination ---
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [verifyFilter, setVerifyFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // --- Selection & Row Actions Popover ---
  const [selectedIds, setSelectedIds] = useState([]);
  const [openActionId, setOpenActionId] = useState(null);
  const actionMenuRef = useRef(null);

  // --- Modals State ---
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPwdModal, setShowResetPwdModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [showLockReasonModal, setShowLockReasonModal] = useState(false);

  // --- Lock Reason State ---
  const [lockReasonTarget, setLockReasonTarget] = useState(null);
  const [lockReasonText, setLockReasonText] = useState('');
  const [isLocking, setIsLocking] = useState(false);

  // --- Add Form State ---
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    status: 'ACTIVE',
    shopId: '',
    password: '',
    confirmPassword: '',
    permissionGroup: '',
    note: ''
  });
  const [addFormErrors, setAddFormErrors] = useState({});
  const [showAddPwd, setShowAddPwd] = useState(false);
  const [showAddConfirmPwd, setShowAddConfirmPwd] = useState(false);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // --- Edit Form State ---
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    dob: '',
    gender: 'Nữ',
    avatar: '',
    role: 'customer',
    status: 'ACTIVE'
  });
  const [editFormErrors, setEditFormErrors] = useState({});
  const avatarFileInputRef = useRef(null);

  // --- Shops State from DB ---
  const [shops, setShops] = useState([]);
  const [loadingShops, setLoadingShops] = useState(false);

  // --- Reset Password State ---
  const [resetPwdValue, setResetPwdValue] = useState('');
  const [isResettingPwd, setIsResettingPwd] = useState(false);

  // --- Notify Form State ---
  const [notifyForm, setNotifyForm] = useState({
    title: '',
    message: '',
    type: 'SYSTEM'
  });

  // Close row action dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setOpenActionId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // --- Fetch Users API ---
  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`),
        fetch(`${API_BASE_URL}/users/stats`)
      ]);

      const usersJson = await usersRes.json();
      const statsJson = await statsRes.json();

      if (statsJson.success && statsJson.data) {
        setBackendStats(statsJson.data);
      }

      if (usersJson.success && Array.isArray(usersJson.data)) {
        const mapped = usersJson.data.map(u => {
          const role = normalizeRole(u.Role);
          const statusUpper = (u.Status || 'ACTIVE').toUpperCase();
          const phone = u.Information?.[0]?.Phone || u.Infomation?.[0]?.Phone || '';
          const address = u.Information?.[0]?.Address || u.Infomation?.[0]?.Address || '';

          let verifyStatus = 'VERIFIED';
          if (u.IsVerified === false) {
            verifyStatus = 'UNVERIFIED';
          } else if (role === 'shopOwner' && !u.IsVerified) {
            verifyStatus = 'PENDING';
          }

          return {
            id: u._id,
            displayId: `#${String(u.UserId || u._id).slice(-6).toUpperCase()}`,
            name: u.FullName || u.Email?.split('@')[0] || 'Người dùng VESTORA',
            email: u.Email,
            role,
            verified: verifyStatus,
            status: statusUpper,
            joinDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—',
            joinDateTime: u.createdAt ? new Date(u.createdAt).toLocaleString('vi-VN') : '—',
            lastLogin: u.updatedAt ? new Date(u.updatedAt).toLocaleString('vi-VN') : 'Mới tạo',
            avatar: u.Avatar || null,
            letter: (u.FullName || u.Email || 'U').charAt(0).toUpperCase(),
            letterColor: roleColor(role),
            phone: phone || 'Chưa cập nhật',
            address: address || 'Chưa cập nhật',
            dob: '15/08/2000',
            gender: 'Nữ',
            totalOrders: Math.floor(Math.random() * 8) + 1,
            totalDeposit: `${(Math.floor(Math.random() * 10) + 1) * 2}.000.000 đ`,
            rating: u.WarningsCount > 0 ? `C (${u.WarningsCount} vi phạm)` : 'A+ (100 pts)',
            violations: u.WarningsCount || 0,
            authProvider: (u.AuthProvider || (u.GoogleId ? 'google' : 'local')).toLowerCase(),
            googleId: u.GoogleId || '',
            shopId: u.shopId || (typeof u.ShopId === 'object' ? u.ShopId?._id : u.ShopId) || '',
            shopName: u.shopName || (typeof u.ShopId === 'object' ? u.ShopId?.name : '') || '',
            shopCity: u.shopCity || (typeof u.ShopId === 'object' ? u.ShopId?.city : '') || ''
          };
        });

        setUsers(mapped.sort((a, b) => Number(b.role === 'admin') - Number(a.role === 'admin')));
      }
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu người dùng từ backend:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShops = async () => {
    try {
      setLoadingShops(true);
      const res = await fetch(`${API_BASE_URL}/shops?limit=100`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setShops(json.data);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách chi nhánh:', err);
    } finally {
      setLoadingShops(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchShops();
  }, []);

  // --- Statistics Calculation ---
  const stats = useMemo(() => {
    const total = backendStats?.total ?? users.length;
    const active = backendStats?.active ?? users.filter(u => u.status === 'ACTIVE').length;
    const locked = backendStats?.locked ?? users.filter(u => u.status === 'LOCKED').length;
    const pending = users.filter(u => u.verified === 'PENDING' || u.verified === 'UNVERIFIED').length;

    const activePercent = total > 0 ? Math.round((active / total) * 100) : 0;
    const pendingPercent = total > 0 ? Math.round((pending / total) * 100) : 0;
    const lockedPercent = total > 0 ? Math.round((locked / total) * 100) : 0;

    return {
      total,
      active,
      pending,
      locked,
      activePercent,
      pendingPercent,
      lockedPercent
    };
  }, [users, backendStats]);

  // --- Filtered Users ---
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = u.name.toLowerCase().includes(query);
        const matchesEmail = u.email.toLowerCase().includes(query);
        const matchesPhone = u.phone && u.phone.includes(query);
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }

      if (roleFilter !== 'ALL') {
        const filterKey = roleFilter.toLowerCase().replace(/[_\s-]/g, '');
        const userRoleKey = (u.role || '').toLowerCase().replace(/[_\s-]/g, '');
        if (userRoleKey !== filterKey) return false;
      }

      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ACTIVE' && u.status !== 'ACTIVE') return false;
        if (statusFilter === 'LOCKED' && u.status !== 'LOCKED') return false;
      }

      if (verifyFilter !== 'ALL') {
        if (verifyFilter === 'VERIFIED' && u.verified !== 'VERIFIED') return false;
        if (verifyFilter === 'UNVERIFIED' && u.verified !== 'UNVERIFIED') return false;
        if (verifyFilter === 'PENDING' && u.verified !== 'PENDING') return false;
      }

      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter, verifyFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // --- Row Selection ---
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(paginatedUsers.map(u => u.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // --- Lock / Unlock Handlers ---
  const handleToggleLock = async (userId) => {
    const target = users.find(u => u.id === userId);
    if (cannotLock(target, currentUser)) {
      showToast(
        isSelf(target, currentUser)
          ? 'Bạn không thể tự khóa tài khoản của chính mình!'
          : 'Không thể khóa tài khoản Quản trị viên!',
        'error'
      );
      return;
    }

    const isCurrentlyLocked = target?.status === 'LOCKED';

    if (isCurrentlyLocked) {
      try {
        const res = await fetch(`${API_BASE_URL}/users/${userId}/toggle-lock`, { method: 'PATCH' });
        const json = await res.json();
        if (json.success) {
          setUsers(prev => prev.map(u =>
            u.id === userId ? { ...u, status: 'ACTIVE' } : u
          ));
          if (selectedUser?.id === userId) setSelectedUser(prev => ({ ...prev, status: 'ACTIVE' }));
          showToast('Đã mở khóa tài khoản thành công', 'success');
        } else {
          showToast(json.message || 'Không thể mở khóa tài khoản', 'error');
        }
      } catch (e) {
        console.error('Lỗi mở khóa:', e);
        showToast('Lỗi kết nối máy chủ', 'error');
      }
      return;
    }

    setLockReasonTarget(userId);
    setLockReasonText('');
    setShowLockReasonModal(true);
  };

  const confirmLockWithReason = async () => {
    const reason = lockReasonText.trim();
    if (!reason || reason.length < 5) {
      showToast('Vui lòng nhập lý do khóa (tối thiểu 5 ký tự).', 'warning');
      return;
    }
    setIsLocking(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/${lockReasonTarget}/toggle-lock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      const json = await res.json();
      if (json.success) {
        setUsers(prev => prev.map(u =>
          u.id === lockReasonTarget ? { ...u, status: 'LOCKED' } : u
        ));
        if (selectedUser?.id === lockReasonTarget) setSelectedUser(prev => ({ ...prev, status: 'LOCKED' }));
        setShowLockReasonModal(false);
        setLockReasonTarget(null);
        setLockReasonText('');
        showToast('Đã khóa tài khoản và gửi email thông báo', 'success');
      } else {
        showToast(json.message || 'Không thể khóa tài khoản', 'error');
      }
    } catch (e) {
      console.error('Lỗi khóa tài khoản:', e);
      showToast('Lỗi kết nối máy chủ', 'error');
    } finally {
      setIsLocking(false);
    }
  };

  const handleBulkLock = async () => {
    const safeIds = selectedIds.filter(id => {
      const u = users.find(user => user.id === id);
      return !cannotLock(u, currentUser);
    });

    if (safeIds.length === 0) {
      showToast('Không có tài khoản nào hợp lệ để khóa (Tài khoản Quản trị viên và tài khoản hiện tại được bảo vệ).', 'warning');
      return;
    }

    for (const id of safeIds) {
      const user = users.find(u => u.id === id);
      if (user && user.status !== 'LOCKED') {
        await handleToggleLock(id);
      }
    }
    setSelectedIds([]);
    showToast('Đã thực hiện khóa các tài khoản được chọn.', 'success');
  };

  const handleBulkUnlock = async () => {
    for (const id of selectedIds) {
      const user = users.find(u => u.id === id);
      if (user && user.status === 'LOCKED') {
        await handleToggleLock(id);
      }
    }
    setSelectedIds([]);
    showToast('Đã thực hiện mở khóa các tài khoản được chọn.', 'success');
  };

  // --- Export CSV Handler ---
  const handleExportCSV = () => {
    const listToExport = selectedIds.length > 0
      ? users.filter(u => selectedIds.includes(u.id))
      : filteredUsers;

    const headers = ['Mã người dùng', 'Họ và tên', 'Email', 'Số điện thoại', 'Vai trò', 'Trạng thái', 'Xác minh', 'Ngày tham gia'];
    const rows = listToExport.map(u => [
      u.id,
      `"${u.name}"`,
      u.email,
      u.phone || '',
      u.role,
      u.status,
      u.verified,
      u.joinDate
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Danh_Sach_Nguoi_Dung_VESTORA_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Đã xuất ${listToExport.length} tài khoản ra file CSV!`, 'success');
  };

  // --- Edit User Handlers ---
  const openEditModalForUser = (user) => {
    if (!user) return;
    if (isUserAdmin(user)) {
      showToast('Tài khoản Quản trị viên (Admin) duy nhất của hệ thống được bảo vệ và không thể chỉnh sửa!', 'warning');
      return;
    }
    if (isCustomer(user)) {
      showToast('Tài khoản khách hàng (Customer) không hỗ trợ chỉnh sửa!', 'warning');
      return;
    }
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone && user.phone !== 'Chưa cập nhật' ? user.phone : '',
      address: user.address && user.address !== 'Chưa cập nhật' ? user.address : '',
      dob: user.dob && user.dob !== '—' ? user.dob : '15/08/2000',
      gender: user.gender || 'Nữ',
      avatar: user.avatar || '',
      role: ['shopOwner', 'brandmanager', 'warehouse_manager', 'warehouseManager', 'warehouse_staff', 'warehousestaff'].includes(user.role)
        ? (user.role === 'warehouseManager' ? 'warehouse_manager' : (user.role === 'warehousestaff' ? 'warehouse_staff' : user.role))
        : 'warehouse_staff',
      shopId: user.shopId || '',
      status: user.status || 'ACTIVE'
    });
    setEditFormErrors({});
    setSelectedUser(user);
    setShowEditModal(true);
    setOpenActionId(null);
  };

  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WEBP)!', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Kích thước ảnh không được vượt quá 5MB!', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setEditForm(prev => ({ ...prev, avatar: reader.result }));
      if (editFormErrors.avatar) setEditFormErrors(prev => ({ ...prev, avatar: null }));
      showToast('Đã tải ảnh đại diện lên!', 'success');
    };
    reader.onerror = () => {
      showToast('Không thể đọc file ảnh đã chọn', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setEditForm(prev => ({ ...prev, avatar: '' }));
    showToast('Đã gỡ ảnh đại diện (sử dụng chữ cái mặc định)', 'info');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (cannotLock(selectedUser, currentUser) && editForm.status === 'LOCKED') {
      showToast(
        isSelf(selectedUser, currentUser)
          ? 'Bạn không thể tự khóa tài khoản của chính mình!'
          : 'Không thể chuyển tài khoản Quản trị viên (Admin) sang trạng thái Tạm khóa!',
        'warning'
      );
      return;
    }

    if (editForm.role === 'admin' || editForm.role === 'customer') {
      showToast('Không thể cập nhật nhân viên sang vai trò Quản trị viên (Admin) hoặc Khách hàng (Customer)!', 'error');
      return;
    }

    const validation = validateEditForm(editForm);
    if (!validation.isValid) {
      setEditFormErrors(validation.errors);
      const firstError = Object.values(validation.errors)[0];
      showToast(firstError, 'error');
      return;
    }
    setEditFormErrors({});

    try {
      const res = await fetch(`${API_BASE_URL}/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          FullName: editForm.name,
          Role: editForm.role,
          Status: editForm.status.toLowerCase(),
          Phone: editForm.phone,
          Address: editForm.address,
          DateOfBirth: editForm.dob,
          Gender: editForm.gender,
          Avatar: editForm.avatar,
          shopId: editForm.shopId || null
        })
      });
      const json = await res.json();
      if (json.success) {
        await fetchUsers();
        setSelectedUser(prev => prev ? {
          ...prev,
          name: editForm.name,
          phone: editForm.phone || 'Chưa cập nhật',
          address: editForm.address || 'Chưa cập nhật',
          dob: editForm.dob,
          gender: editForm.gender,
          avatar: editForm.avatar || null,
          role: editForm.role,
          shopId: editForm.shopId || '',
          shopName: shops.find(s => String(s._id) === String(editForm.shopId))?.name || (editForm.shopId ? prev.shopName : ''),
          shopCity: shops.find(s => String(s._id) === String(editForm.shopId))?.city || (editForm.shopId ? prev.shopCity : ''),
          status: editForm.status
        } : null);
        setShowEditModal(false);
        showToast('Đã cập nhật thông tin hồ sơ thành công!', 'success');
      } else {
        showToast(json.message || 'Lỗi khi cập nhật thông tin', 'error');
      }
    } catch (err) {
      console.error('Lỗi cập nhật người dùng:', err);
      showToast('Không thể kết nối máy chủ khi cập nhật thông tin', 'error');
    }
  };

  // --- Create User Handler ---
  const handleCreateUser = async (e) => {
    e.preventDefault();

    const errors = {};
    if (!addForm.name || !addForm.name.trim()) {
      errors.name = 'Họ và tên không được để trống';
    } else if (addForm.name.trim().length < 2) {
      errors.name = 'Họ và tên phải có ít nhất 2 ký tự';
    } else if (addForm.name.trim().length > 25) {
      errors.name = 'Họ và tên không được vượt quá 25 ký tự';
    }

    if (!addForm.email || !addForm.email.trim()) {
      errors.email = 'Email tài khoản không được để trống';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addForm.email.trim())) {
      errors.email = 'Email không đúng định dạng';
    }

    if (!addForm.phone || !addForm.phone.trim()) {
      errors.phone = 'Vui lòng nhập số điện thoại';
    } else {
      const cleanPhone = addForm.phone.replace(/[\s.-]/g, '');
      if (!/^(0|\+84)[0-9]{9}$/.test(cleanPhone)) {
        errors.phone = 'Số điện thoại không hợp lệ (cần 10 chữ số)';
      }
    }

    if (!addForm.role) {
      errors.role = 'Vui lòng chọn vai trò';
    }

    if (!addForm.password) {
      errors.password = 'Vui lòng nhập mật khẩu';
    } else if (addForm.password.length < 8) {
      errors.password = 'Mật khẩu phải có tối thiểu 8 ký tự';
    }

    if (!addForm.confirmPassword) {
      errors.confirmPassword = 'Vui lòng xác nhận lại mật khẩu';
    } else if (addForm.confirmPassword !== addForm.password) {
      errors.confirmPassword = 'Mật khẩu xác nhận không trùng khớp';
    }

    if (Object.keys(errors).length > 0) {
      setAddFormErrors(errors);
      showToast('Vui lòng kiểm tra lại các trường thông tin!', 'warning');
      return;
    }

    setIsSubmittingAdd(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          FullName: addForm.name.trim(),
          Email: addForm.email.trim(),
          Role: addForm.role,
          Status: addForm.status.toLowerCase(),
          Password: addForm.password,
          Phone: addForm.phone.trim(),
          shopId: addForm.shopId || null
        })
      });
      const json = await res.json();
      if (json.success) {
        await fetchUsers();
        setShowAddModal(false);
        setAddForm({
          name: '',
          email: '',
          phone: '',
          role: '',
          status: 'ACTIVE',
          shopId: '',
          password: '',
          confirmPassword: '',
          permissionGroup: '',
          note: ''
        });
        setAddFormErrors({});
        showToast('Đã tạo tài khoản người dùng mới thành công!', 'success');
      } else {
        if (json.message && json.message.toLowerCase().includes('email')) {
          setAddFormErrors(prev => ({ ...prev, email: 'Email đã tồn tại trong hệ thống' }));
        }
        showToast(json.message || 'Lỗi khi tạo tài khoản', 'error');
      }
    } catch (err) {
      console.error('Lỗi khi tạo người dùng mới:', err);
      showToast('Không thể kết nối máy chủ khi tạo tài khoản', 'error');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // --- Reset Password Handlers ---
  const openResetPasswordModal = (user) => {
    if (!user) return;
    if (isUserAdmin(user)) {
      showToast('Không thể đặt lại mật khẩu cho tài khoản Quản trị viên (Admin)!', 'warning');
      return;
    }
    if (isCustomer(user)) {
      showToast('Tài khoản khách hàng (Customer) không hỗ trợ đặt lại mật khẩu từ Quản trị viên!', 'warning');
      return;
    }
    if (isGoogleUser(user)) {
      showToast('Tài khoản đăng nhập bằng Google không hỗ trợ đặt lại mật khẩu!', 'warning');
      return;
    }
    setSelectedUser(user);
    setResetPwdValue('Vestora@' + Math.floor(1000 + Math.random() * 9000));
    setShowResetPwdModal(true);
    setOpenActionId(null);
  };

  const handleConfirmResetPassword = async () => {
    if (!selectedUser) return;
    if (isCustomer(selectedUser)) {
      showToast('Tài khoản khách hàng (Customer) không hỗ trợ đặt lại mật khẩu từ Quản trị viên!', 'warning');
      return;
    }
    if (isGoogleUser(selectedUser)) {
      showToast('Tài khoản đăng nhập bằng Google không hỗ trợ đặt lại mật khẩu!', 'warning');
      return;
    }
    const cleanPwd = (resetPwdValue || '').trim();
    if (!cleanPwd || cleanPwd.length < 6) {
      showToast('Mật khẩu mới phải có ít nhất 6 ký tự!', 'error');
      return;
    }

    setIsResettingPwd(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/${selectedUser.id}/reset-password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: cleanPwd })
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message || `Đã đặt lại mật khẩu và gửi email thành công tới ${selectedUser.email}!`, 'success');
        setShowResetPwdModal(false);
        await fetchUsers();
      } else {
        showToast(json.message || 'Lỗi khi đặt lại mật khẩu', 'error');
      }
    } catch (err) {
      console.error('Lỗi khi đặt lại mật khẩu:', err);
      showToast('Không thể kết nối máy chủ khi đặt lại mật khẩu', 'error');
    } finally {
      setIsResettingPwd(false);
    }
  };

  // --- Send Notification Handler ---
  const handleSendNotify = () => {
    showToast(`Đã gửi thông báo thành công tới ${selectedUser.email}!`, 'success');
    setShowNotifyModal(false);
    setNotifyForm({ title: '', message: '', type: 'SYSTEM' });
  };

  // --- Reset Filters Handler ---
  const handleResetFilters = () => {
    setSearchQuery('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setVerifyFilter('ALL');
  };

  const handleSelectUserForDrawer = (u) => {
    setSelectedUser(u);
    setActiveDrawerTab('INFO');
    setDrawerOpen(true);
  };

  return (
    <div className="admin-layout" style={{ backgroundColor: '#FBF9F5' }}>
      <AdminSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(prev => !prev)}
      />

      <div className="admin-main-viewport" style={{ backgroundColor: '#FBF9F5' }}>
        <AdminTopHeader
          onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
          breadcrumb="Quản lý người dùng"
        />

        <div className="admin-acc-page" style={{ backgroundColor: '#FBF9F5' }}>
          <div className="admin-acc-header">
            <div className="admin-acc-hero">
              <div>
                <h1 className="admin-acc-title">Quản lý tài khoản người dùng</h1>
              </div>

              <div className="admin-acc-hero-actions">
                <button
                  type="button"
                  className="btn-acc-primary"
                  onClick={() => setShowAddModal(true)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Thêm người dùng</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 2 }}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                <button
                  type="button"
                  className="btn-acc-outline"
                  onClick={handleExportCSV}
                  title="Xuất danh sách sang file CSV"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Xuất danh sách</span>
                </button>
              </div>
            </div>
          </div>

          {/* KPI Statistics */}
          <AdminAccountStats stats={stats} />

          {/* Search, Filter & Bulk Actions */}
          <AdminAccountFilters
            searchQuery={searchQuery}
            onSearchChange={(val) => {
              setSearchQuery(val);
              setCurrentPage(1);
            }}
            roleFilter={roleFilter}
            onRoleFilterChange={(val) => {
              setRoleFilter(val);
              setCurrentPage(1);
            }}
            statusFilter={statusFilter}
            onStatusFilterChange={(val) => {
              setStatusFilter(val);
              setCurrentPage(1);
            }}
            verifyFilter={verifyFilter}
            onVerifyFilterChange={(val) => {
              setVerifyFilter(val);
              setCurrentPage(1);
            }}
            onResetFilters={handleResetFilters}
            selectedCount={selectedIds.length}
            onBulkUnlock={handleBulkUnlock}
            onBulkLock={handleBulkLock}
            onExportCSV={handleExportCSV}
            onClearSelection={() => setSelectedIds([])}
          />

          {/* Account Table & Pagination */}
          <AdminAccountTable
            isLoading={isLoading}
            paginatedUsers={paginatedUsers}
            filteredTotal={filteredUsers.length}
            selectedIds={selectedIds}
            onSelectAll={handleSelectAll}
            onSelectRow={handleSelectRow}
            selectedUser={selectedUser}
            onSelectUser={handleSelectUserForDrawer}
            openActionId={openActionId}
            setOpenActionId={setOpenActionId}
            actionMenuRef={actionMenuRef}
            onOpenEdit={openEditModalForUser}
            onToggleLock={handleToggleLock}
            onOpenResetPassword={openResetPasswordModal}
            onOpenNotify={(u) => {
              setSelectedUser(u);
              setShowNotifyModal(true);
            }}
            isUserAdmin={(u) => isUserAdmin(u)}
            isCustomer={(u) => isCustomer(u)}
            isGoogleUser={(u) => isGoogleUser(u)}
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Drawer: Chi tiết người dùng */}
      <AdminAccountDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={selectedUser}
        activeTab={activeDrawerTab}
        onTabChange={setActiveDrawerTab}
        onOpenEdit={openEditModalForUser}
        onToggleLock={handleToggleLock}
        onOpenResetPassword={openResetPasswordModal}
        onOpenNotify={(u) => {
          setSelectedUser(u);
          setShowNotifyModal(true);
        }}
        isUserAdmin={(u) => isUserAdmin(u)}
        isCustomer={(u) => isCustomer(u)}
        isGoogleUser={(u) => isGoogleUser(u)}
      />

      {/* Modal: Thêm người dùng */}
      <AdminAddAccountModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        addForm={addForm}
        setAddForm={setAddForm}
        addFormErrors={addFormErrors}
        setAddFormErrors={setAddFormErrors}
        showAddPwd={showAddPwd}
        setShowAddPwd={setShowAddPwd}
        showAddConfirmPwd={showAddConfirmPwd}
        setShowAddConfirmPwd={setShowAddConfirmPwd}
        isSubmittingAdd={isSubmittingAdd}
        onSubmit={handleCreateUser}
        shops={shops}
        loadingShops={loadingShops}
      />

      {/* Modal: Chỉnh sửa thông tin nhân viên */}
      <AdminEditAccountModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        user={selectedUser}
        editForm={editForm}
        setEditForm={setEditForm}
        editFormErrors={editFormErrors}
        setEditFormErrors={setEditFormErrors}
        avatarFileInputRef={avatarFileInputRef}
        onAvatarChange={handleAvatarFileChange}
        onRemoveAvatar={handleRemoveAvatar}
        onSubmit={handleSaveEdit}
        shops={shops}
        loadingShops={loadingShops}
      />

      {/* Modal: Đặt lại mật khẩu */}
      <AdminResetPasswordModal
        isOpen={showResetPwdModal}
        onClose={() => setShowResetPwdModal(false)}
        user={selectedUser}
        resetPwdValue={resetPwdValue}
        setResetPwdValue={setResetPwdValue}
        isResettingPwd={isResettingPwd}
        onConfirm={handleConfirmResetPassword}
      />

      {/* Modal: Gửi thông báo */}
      <AdminSendNotifyModal
        isOpen={showNotifyModal}
        onClose={() => setShowNotifyModal(false)}
        user={selectedUser}
        notifyForm={notifyForm}
        setNotifyForm={setNotifyForm}
        onSend={handleSendNotify}
      />

      {/* Modal: Khóa tài khoản kèm lý do */}
      <AdminLockAccountModal
        isOpen={showLockReasonModal}
        onClose={() => setShowLockReasonModal(false)}
        isLocking={isLocking}
        reasonText={lockReasonText}
        setReasonText={setLockReasonText}
        onConfirm={confirmLockWithReason}
      />

      {/* Toast Notification Container */}
      <AdminToastContainer
        toasts={toasts}
        onRemoveToast={removeToast}
      />
    </div>
  );
}
