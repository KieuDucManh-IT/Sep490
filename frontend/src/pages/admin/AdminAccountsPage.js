import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopHeader from '../../components/AdminTopHeader';
import '../../styles/AdminDashboard.css';
import '../../styles/AdminAccounts.css';
import { validateEditForm } from '../../utils/userValidation';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const ROLE_LABELS = {
  customer: 'customer',
  shopOwner: 'shopOwner',
  brandmanager: 'brandmanager',
  warehouseManager: 'warehouseManager',
  warehousestaff: 'warehousestaff',
  admin: 'admin'
};

export default function AdminAccountsPage() {
  const { user: currentUser } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // ── Toast system ──────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState('INFO');
  const [isLoading, setIsLoading] = useState(true);
  const [backendStats, setBackendStats] = useState(null);

  // Helper functions: Bảo vệ tài khoản Quản trị viên và tài khoản hiện tại đang đăng nhập
  const isUserAdmin = (u) => {
    if (!u) return false;
    const r = (u.role || u.Role || '').toLowerCase().replace(/[_\s-]/g, '');
    return r === 'admin';
  };

  const isSelf = (u) => {
    if (!u || !currentUser) return false;
    const currentId = currentUser.id || currentUser._id;
    const currentEmail = (currentUser.email || currentUser.Email || '').toLowerCase();
    return (
      (currentId && (u.id === currentId || u._id === currentId)) ||
      (currentEmail && u.email && u.email.toLowerCase() === currentEmail)
    );
  };

  const cannotLock = (u) => isUserAdmin(u) || isSelf(u);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [verifyFilter, setVerifyFilter] = useState('ALL');

  // Checkbox multi-selection
  const [selectedIds, setSelectedIds] = useState([]);

  // Active Dropdown Menu on Row (⋮)
  const [openActionId, setOpenActionId] = useState(null);
  const actionMenuRef = useRef(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPwdModal, setShowResetPwdModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);

  // Modal lý do khóa tài khoản
  const [showLockReasonModal, setShowLockReasonModal] = useState(false);
  const [lockReasonTarget, setLockReasonTarget] = useState(null); // userId
  const [lockReasonText, setLockReasonText] = useState('');
  const [isLocking, setIsLocking] = useState(false);

  // Forms
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'customer',
    status: 'ACTIVE',
    password: ''
  });

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

  const [resetPwdValue, setResetPwdValue] = useState('');
  const [notifyForm, setNotifyForm] = useState({
    title: '',
    message: '',
    type: 'SYSTEM'
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Close row action dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setOpenActionId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Fetch real users and stats from MongoDB Atlas via Backend API
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
        // Chuẩn hóa role từ DB sang đúng danh sách 6 vai trò người dùng yêu cầu:
        // shopOwner, brandmanager, admin, customer, warehousestaff, warehouseManager
        const normalizeRole = (raw) => {
          const r = (raw || 'customer').toString().trim().toLowerCase().replace(/[_\s-]/g, '');
          if (r === 'admin') return 'admin';
          if (r === 'shopowner') return 'shopOwner';
          if (r === 'brandmanager') return 'brandmanager';
          if (r === 'warehousemanager') return 'warehouseManager';
          if (r === 'warehousestaff') return 'warehousestaff';
          return 'customer';
        };

        const roleColor = (role) => {
          if (role === 'admin') return '#4338CA';
          if (role === 'shopOwner') return '#C2410C';
          if (role === 'brandmanager') return '#7E22CE';
          if (role === 'warehouseManager') return '#0E7490';
          if (role === 'warehousestaff') return '#047857';
          return '#0369A1'; // customer
        };

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
            violations: u.WarningsCount || 0
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

  useEffect(() => {
    fetchUsers();
  }, []);

  // Compute stats dynamically from real users data
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

  // Filtered Users based on Search & Selects
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      // Search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = u.name.toLowerCase().includes(query);
        const matchesEmail = u.email.toLowerCase().includes(query);
        const matchesPhone = u.phone && u.phone.includes(query);
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }

      // Role filter
      if (roleFilter !== 'ALL') {
        const filterKey = roleFilter.toLowerCase().replace(/[_\s-]/g, '');
        const userRoleKey = (u.role || '').toLowerCase().replace(/[_\s-]/g, '');
        if (userRoleKey !== filterKey) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ACTIVE' && u.status !== 'ACTIVE') return false;
        if (statusFilter === 'LOCKED' && u.status !== 'LOCKED') return false;
      }

      // Verification filter
      if (verifyFilter !== 'ALL') {
        if (verifyFilter === 'VERIFIED' && u.verified !== 'VERIFIED') return false;
        if (verifyFilter === 'UNVERIFIED' && u.verified !== 'UNVERIFIED') return false;
        if (verifyFilter === 'PENDING' && u.verified !== 'PENDING') return false;
      }

      return true;
    });
  }, [users, searchQuery, roleFilter, statusFilter, verifyFilter]);

  // Total pages
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));

  // Paginated Users
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Select all handler
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

  // Toggle Lock/Unlock User with Backend API
  const handleToggleLock = async (userId) => {
    const target = users.find(u => u.id === userId);
    if (cannotLock(target)) {
      showToast(
        isSelf(target)
          ? 'Bạn không thể tự khóa tài khoản của chính mình!'
          : 'Không thể khóa tài khoản Quản trị viên!',
        'error'
      );
      return;
    }

    const isCurrentlyLocked = target?.status === 'LOCKED';

    // Nếu đang MỞ KHÓA — không cần lý do, thực hiện ngay
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

    // Nếu đang KHÓA — mở modal nhập lý do
    setLockReasonTarget(userId);
    setLockReasonText('');
    setShowLockReasonModal(true);
  };

  // Xác nhận khóa sau khi đã nhập lý do
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

  // Bulk Actions
  const handleBulkLock = async () => {
    const safeIds = selectedIds.filter(id => {
      const u = users.find(user => user.id === id);
      return !cannotLock(u);
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

  // Export list to CSV
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

  // Open Edit Modal
  const openEditModalForUser = (user) => {
    if (!user) return;
    if (isUserAdmin(user)) {
      showToast('Tài khoản Quản trị viên (Admin) duy nhất của hệ thống được bảo vệ và không thể chỉnh sửa!', 'warning');
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
      role: user.role === 'admin' ? 'customer' : user.role,
      status: user.status || 'ACTIVE'
    });
    setEditFormErrors({});
    setSelectedUser(user);
    setShowEditModal(true);
    setOpenActionId(null);
  };

  // Avatar upload file handler
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

  // Gỡ avatar quay về chữ cái đại diện
  const handleRemoveAvatar = () => {
    setEditForm(prev => ({ ...prev, avatar: '' }));
    showToast('Đã gỡ ảnh đại diện (sử dụng chữ cái mặc định)', 'info');
  };

  // Save Edit User with Backend API & Validation
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (cannotLock(selectedUser) && editForm.status === 'LOCKED') {
      showToast(
        isSelf(selectedUser)
          ? 'Bạn không thể tự khóa tài khoản của chính mình!'
          : 'Không thể chuyển tài khoản Quản trị viên (Admin) sang trạng thái Tạm khóa!',
        'warning'
      );
      return;
    }

    // Validate using reusable frontend validation module
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
          Avatar: editForm.avatar
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

  // Create New User with Backend API
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email) {
      showToast('Vui lòng nhập đầy đủ họ tên và email!', 'warning');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          FullName: addForm.name,
          Email: addForm.email,
          Role: addForm.role,
          Status: addForm.status.toLowerCase(),
          Password: addForm.password || 'Vestora@2026',
          Phone: addForm.phone
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
          role: 'customer',
          status: 'ACTIVE',
          password: ''
        });
        showToast('Đã tạo tài khoản mới thành công!', 'success');
      } else {
        showToast(json.message || 'Lỗi khi tạo tài khoản', 'error');
      }
    } catch (err) {
      console.error('Lỗi khi tạo người dùng mới:', err);
      showToast('Không thể kết nối máy chủ khi tạo tài khoản', 'error');
    }
  };

  // Open Reset Password Modal
  const openResetPasswordModal = (user) => {
    setSelectedUser(user);
    setResetPwdValue('Vestora@' + Math.floor(1000 + Math.random() * 9000));
    setShowResetPwdModal(true);
    setOpenActionId(null);
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setVerifyFilter('ALL');
  };

  return (
    <div className="admin-layout" style={{ backgroundColor: '#FBF9F5' }}>
      {/* 1. TailAdmin Left Sidebar */}
      <AdminSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(prev => !prev)}
      />

      {/* 2. Main Viewport */}
      <div className="admin-main-viewport" style={{ backgroundColor: '#FBF9F5' }}>
        {/* Top Navbar */}
        <AdminTopHeader
          onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
          breadcrumb="Quản lý người dùng"
        />

        {/* 3. Accounts Management Body */}
        <div className="admin-acc-page" style={{ backgroundColor: '#FBF9F5' }}>
          {/* Breadcrumb & Hero */}
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

          {/* 4 Core Stat Cards (Calculated from Real MongoDB Data) */}
          <div className="admin-acc-kpis">
            {/* Card 1: Tổng tài khoản */}
            <div className="admin-acc-kpi-card">
              <div className="admin-acc-kpi-icon blue">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="admin-acc-kpi-content">
                <div className="admin-acc-kpi-label">Tổng tài khoản</div>
                <div className="admin-acc-kpi-row">
                  <span className="admin-acc-kpi-value">{stats.total}</span>
                  <span className="admin-acc-kpi-trend up">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                    100%
                  </span>
                </div>
                <div className="admin-acc-kpi-sub">Dữ liệu MongoDB Atlas</div>
              </div>
            </div>

            {/* Card 2: Đang hoạt động */}
            <div className="admin-acc-kpi-card">
              <div className="admin-acc-kpi-icon green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
              </div>
              <div className="admin-acc-kpi-content">
                <div className="admin-acc-kpi-label">Đang hoạt động</div>
                <div className="admin-acc-kpi-row">
                  <span className="admin-acc-kpi-value">{stats.active}</span>
                  <span className="admin-acc-kpi-trend up">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </svg>
                    {stats.activePercent}%
                  </span>
                </div>
                <div className="admin-acc-kpi-sub">{stats.activePercent}% tổng tài khoản</div>
              </div>
            </div>

            {/* Card 3: Chờ xác minh */}
            <div className="admin-acc-kpi-card">
              <div className="admin-acc-kpi-icon orange">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div className="admin-acc-kpi-content">
                <div className="admin-acc-kpi-label">Chờ xác minh</div>
                <div className="admin-acc-kpi-row">
                  <span className="admin-acc-kpi-value">{stats.pending}</span>
                  <span className="admin-acc-kpi-trend down">
                    {stats.pendingPercent}%
                  </span>
                </div>
                <div className="admin-acc-kpi-sub">{stats.pendingPercent}% tổng tài khoản</div>
              </div>
            </div>

            {/* Card 4: Tạm khóa */}
            <div className="admin-acc-kpi-card">
              <div className="admin-acc-kpi-icon red">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <div className="admin-acc-kpi-content">
                <div className="admin-acc-kpi-label">Tạm khóa</div>
                <div className="admin-acc-kpi-row">
                  <span className="admin-acc-kpi-value">{stats.locked}</span>
                  <span className="admin-acc-kpi-trend down">
                    {stats.lockedPercent}%
                  </span>
                </div>
                <div className="admin-acc-kpi-sub">{stats.lockedPercent}% tổng tài khoản</div>
              </div>
            </div>
          </div>

          {/* Search & Filter Row */}
          <div className="admin-acc-filter-card">
            {/* Search Input */}
            <div className="admin-acc-search-box">
              <span className="admin-acc-search-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                className="admin-acc-search-input"
                placeholder="Tìm theo tên, email hoặc số điện thoại..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="admin-acc-search-clear"
                  onClick={() => setSearchQuery('')}
                  title="Xóa tìm kiếm"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>

            {/* Role Select */}
            <select
              className="admin-acc-select"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="customer">customer</option>
              <option value="shopOwner">shopOwner</option>
              <option value="brandmanager">brandmanager</option>
              <option value="warehouseManager">warehouseManager</option>
              <option value="warehousestaff">warehousestaff</option>
              <option value="admin">admin</option>
            </select>

            {/* Status Select */}
            <select
              className="admin-acc-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="LOCKED">Tạm khóa</option>
            </select>

            {/* Verify Select */}
            <select
              className="admin-acc-select"
              value={verifyFilter}
              onChange={(e) => {
                setVerifyFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">Tất cả xác minh</option>
              <option value="VERIFIED">Đã xác minh</option>
              <option value="UNVERIFIED">Chưa xác minh</option>
              <option value="PENDING">Chờ duyệt</option>
            </select>

            {/* Extra Filter & Reset */}
            <button
              type="button"
              className="btn-acc-filter-extra"
              onClick={() => showToast(`Đang hiển thị ${filteredUsers.length} người dùng thật từ MongoDB Atlas.`, 'info')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              <span>Bộ lọc khác</span>
            </button>

            <button
              type="button"
              className="btn-acc-reset"
              onClick={handleResetFilters}
              title="Đặt lại tất cả bộ lọc"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span>Đặt lại</span>
            </button>
          </div>

          {/* Bulk Action Sticky Bar */}
          {selectedIds.length > 0 && (
            <div className="admin-acc-bulk-bar">
              <div className="admin-acc-bulk-left">
                <span className="admin-acc-bulk-count">{selectedIds.length}</span>
                <span>tài khoản đã được chọn</span>
              </div>
              <div className="admin-acc-bulk-actions">
                <button
                  type="button"
                  className="btn-bulk-action"
                  onClick={handleBulkUnlock}
                >
                  Mở khóa đã chọn
                </button>
                <button
                  type="button"
                  className="btn-bulk-action danger"
                  onClick={handleBulkLock}
                >
                  Tạm khóa đã chọn
                </button>
                <button
                  type="button"
                  className="btn-bulk-action"
                  onClick={handleExportCSV}
                >
                  Xuất đã chọn
                </button>
                <button
                  type="button"
                  className="btn-bulk-action"
                  style={{ background: 'none', border: 'none', color: '#94A3B8' }}
                  onClick={() => setSelectedIds([])}
                >
                  Bỏ chọn
                </button>
              </div>
            </div>
          )}

          {/* Main Users Table Card */}
          <div className="admin-acc-table-card">
            <div className="admin-acc-table-responsive">
              <table className="admin-acc-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedIds.includes(u.id))}
                        onChange={handleSelectAll}
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                    <th>NGƯỜI DÙNG</th>
                    <th style={{ minWidth: '135px', whiteSpace: 'nowrap' }}>VAI TRÒ</th>
                    <th>XÁC MINH</th>
                    <th>TRẠNG THÁI</th>
                    <th>NGÀY THAM GIA</th>
                    <th>ĐĂNG NHẬP CUỐI</th>
                    <th style={{ textAlign: 'center' }}>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                        Đang đồng bộ danh sách tài khoản từ máy chủ MongoDB Atlas...
                      </td>
                    </tr>
                  ) : paginatedUsers.map((u) => {
                    const isRowSelected = selectedUser && selectedUser.id === u.id;
                    const isChecked = selectedIds.includes(u.id);

                    return (
                      <tr
                        key={u.id}
                        className={isRowSelected ? 'selected' : ''}
                        onClick={() => {
                          setSelectedUser(u);
                          setActiveDrawerTab('INFO');
                          setDrawerOpen(true);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Checkbox */}
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleSelectRow(u.id, e)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>

                        {/* User Profile Cell */}
                        <td>
                          <div className="admin-acc-user-cell">
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name} className="admin-acc-avatar" />
                            ) : (
                              <div
                                className="admin-acc-avatar-letter"
                                style={{ background: u.letterColor || '#3B82F6' }}
                              >
                                {u.letter || u.name.charAt(0)}
                              </div>
                            )}
                            <div className="admin-acc-user-meta">
                              <span className="admin-acc-user-name">{u.name}</span>
                              <span className="admin-acc-user-email">{u.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span className={`role-pill ${u.role}`}>
                            {u.role}
                          </span>
                        </td>

                        {/* Verification */}
                        <td>
                          {u.verified === 'VERIFIED' && (
                            <span className="verify-pill verified">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Đã xác minh
                            </span>
                          )}
                          {u.verified === 'UNVERIFIED' && (
                            <span className="verify-pill unverified">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              Chưa xác minh
                            </span>
                          )}
                          {u.verified === 'PENDING' && (
                            <span className="verify-pill pending">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                              </svg>
                              Chờ duyệt
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          <span className={`status-dot-pill ${u.status === 'ACTIVE' ? 'active' : 'locked'}`}>
                            <span className="dot" />
                            {u.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}
                          </span>
                        </td>

                        {/* Join Date */}
                        <td style={{ color: '#475569' }}>{u.joinDate}</td>

                        {/* Last Login */}
                        <td style={{ color: '#64748B' }}>{u.lastLogin}</td>

                        {/* Action Buttons */}
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="admin-acc-action-cell" style={{ justifyContent: 'center', position: 'relative' }}>
                            {/* Eye button */}
                            <button
                              type="button"
                              className="btn-acc-action"
                              title="Xem chi tiết tài khoản"
                              onClick={() => {
                                setSelectedUser(u);
                                setActiveDrawerTab('INFO');
                                setDrawerOpen(true);
                              }}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>

                            {/* Three dots button */}
                            <button
                              type="button"
                              className="btn-acc-action"
                              title="Thao tác khác"
                              onClick={() => setOpenActionId(openActionId === u.id ? null : u.id)}
                            >
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="12" cy="5" r="1" />
                                <circle cx="12" cy="19" r="1" />
                              </svg>
                            </button>

                            {/* Dropdown Menu for Row */}
                            {openActionId === u.id && (
                              <div
                                ref={actionMenuRef}
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: '110%',
                                  background: '#FFFFFF',
                                  border: '1px solid #E2E8F0',
                                  borderRadius: '8px',
                                  boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                                  padding: '6px',
                                  zIndex: 50,
                                  width: '190px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  textAlign: 'left'
                                }}
                              >
                                <button
                                  type="button"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    fontSize: '12px',
                                    background: 'none',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    color: '#334155'
                                  }}
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setDrawerOpen(true);
                                    setOpenActionId(null);
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  <span>Xem chi tiết</span>
                                </button>

                                {!isUserAdmin(u) && (
                                  <button
                                    type="button"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '8px 10px',
                                      fontSize: '12px',
                                      background: 'none',
                                      border: 'none',
                                      borderRadius: '5px',
                                      cursor: 'pointer',
                                      color: '#334155'
                                    }}
                                    onClick={() => openEditModalForUser(u)}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                    <span>Chỉnh sửa thông tin</span>
                                  </button>
                                )}

                                {!isUserAdmin(u) && (
                                  <button
                                    type="button"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '8px 10px',
                                      fontSize: '12px',
                                      background: 'none',
                                      border: 'none',
                                      borderRadius: '5px',
                                      cursor: 'pointer',
                                      color: u.status === 'LOCKED' ? '#059669' : '#DC2626'
                                    }}
                                    onClick={() => {
                                      handleToggleLock(u.id);
                                      setOpenActionId(null);
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                    <span>{u.status === 'LOCKED' ? 'Mở khóa tài khoản' : 'Tạm khóa tài khoản'}</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 10px',
                                    fontSize: '12px',
                                    background: 'none',
                                    border: 'none',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    color: '#334155'
                                  }}
                                  onClick={() => openResetPasswordModal(u)}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="16" r="1" />
                                    <rect x="3" y="10" width="18" height="12" rx="2" />
                                    <path d="M7 10V7a5 5 0 0 1 10 0v3" />
                                  </svg>
                                  <span>Đặt lại mật khẩu</span>
                                </button>

                                {!isUserAdmin(u) && (
                                  <button
                                    type="button"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '8px 10px',
                                      fontSize: '12px',
                                      background: 'none',
                                      border: 'none',
                                      borderRadius: '5px',
                                      cursor: 'pointer',
                                      color: '#334155'
                                    }}
                                    onClick={() => {
                                      setSelectedUser(u);
                                      setShowNotifyModal(true);
                                      setOpenActionId(null);
                                    }}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <line x1="22" y1="2" x2="11" y2="13" />
                                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                    </svg>
                                    <span>Gửi thông báo</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!isLoading && filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
                        Không tìm thấy tài khoản người dùng phù hợp trong cơ sở dữ liệu.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="admin-acc-pagination-bar">
              <div>
                Hiển thị {filteredUsers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} -{' '}
                {Math.min(currentPage * pageSize, filteredUsers.length)} trong{' '}
                <strong>{filteredUsers.length}</strong> tài khoản thực tế
              </div>

              <div className="admin-acc-pagination-pages">
                <button
                  type="button"
                  className="btn-page-num"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                >
                  &lt;
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    type="button"
                    className={`btn-page-num ${currentPage === p ? 'active' : ''}`}
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </button>
                ))}

                <button
                  type="button"
                  className="btn-page-num"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  &gt;
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Hiển thị</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    height: '32px',
                    padding: '0 8px',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    fontSize: '12px'
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span>/ trang</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================================
          DRAWER: CHI TIẾT TÀI KHOẢN (Right Slide-over Panel)
          ========================================================== */}
      {drawerOpen && selectedUser && (
        <>
          <div
            className="admin-acc-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
          />

          <div className="admin-acc-drawer">
            {/* Drawer Header */}
            <div className="admin-acc-drawer-header">
              <h3 className="admin-acc-drawer-title">Chi tiết tài khoản</h3>
              <button
                type="button"
                className="admin-acc-drawer-close"
                onClick={() => setDrawerOpen(false)}
                title="Đóng chi tiết"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* User Identity Hero */}
            <div className="admin-acc-drawer-hero">
              {selectedUser.avatar ? (
                <img
                  src={selectedUser.avatar}
                  alt={selectedUser.name}
                  className="admin-acc-drawer-avatar"
                />
              ) : (
                <div
                  className="admin-acc-drawer-avatar-letter"
                  style={{ background: selectedUser.letterColor || '#3B82F6' }}
                >
                  {selectedUser.letter || selectedUser.name.charAt(0)}
                </div>
              )}

              <div className="admin-acc-drawer-name">{selectedUser.name}</div>
              <div className="admin-acc-drawer-email">{selectedUser.email}</div>
              <span className={`role-pill ${selectedUser.role}`}>
                {ROLE_LABELS[selectedUser.role] || selectedUser.role}
              </span>
            </div>

            {/* Drawer Tabs */}
            <div className="admin-acc-drawer-tabs">
              <button
                type="button"
                className={`admin-acc-tab-btn ${activeDrawerTab === 'INFO' ? 'active' : ''}`}
                onClick={() => setActiveDrawerTab('INFO')}
              >
                Thông tin
              </button>
              <button
                type="button"
                className={`admin-acc-tab-btn ${activeDrawerTab === 'ACTIVITY' ? 'active' : ''}`}
                onClick={() => setActiveDrawerTab('ACTIVITY')}
              >
                Hoạt động
              </button>
              {!isUserAdmin(selectedUser) && (
                <>
                  <button
                    type="button"
                    className={`admin-acc-tab-btn ${activeDrawerTab === 'TRANSACTIONS' ? 'active' : ''}`}
                    onClick={() => setActiveDrawerTab('TRANSACTIONS')}
                  >
                    Giao dịch
                  </button>
                  <button
                    type="button"
                    className={`admin-acc-tab-btn ${activeDrawerTab === 'VIOLATIONS' ? 'active' : ''}`}
                    onClick={() => setActiveDrawerTab('VIOLATIONS')}
                  >
                    Vi phạm
                  </button>
                </>
              )}
            </div>

            {/* Drawer Body Content */}
            <div className="admin-acc-drawer-body">
              {activeDrawerTab === 'INFO' && (
                <>
                  {/* Section 1: Thông tin cơ bản */}
                  <div>
                    <div className="admin-acc-sec-header">
                      <h4 className="admin-acc-sec-title">Thông tin cơ bản</h4>
                      {!isUserAdmin(selectedUser) && (
                        <button
                          type="button"
                          className="btn-acc-sec-edit"
                          onClick={() => openEditModalForUser(selectedUser)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          <span>Chỉnh sửa</span>
                        </button>
                      )}
                    </div>

                    <div className="admin-acc-kv-list">
                      <div className="admin-acc-kv-row">
                        <span className="admin-acc-kv-key">Mã User (ID)</span>
                        <span className="admin-acc-kv-val" style={{ fontFamily: 'monospace', fontSize: '11.5px' }}>
                          {selectedUser.id}
                        </span>
                      </div>
                      <div className="admin-acc-kv-row">
                        <span className="admin-acc-kv-key">Họ và tên</span>
                        <span className="admin-acc-kv-val">{selectedUser.name}</span>
                      </div>
                      <div className="admin-acc-kv-row">
                        <span className="admin-acc-kv-key">Email</span>
                        <span className="admin-acc-kv-val">
                          {selectedUser.email}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </span>
                      </div>
                      <div className="admin-acc-kv-row">
                        <span className="admin-acc-kv-key">Số điện thoại</span>
                        <span className="admin-acc-kv-val">{selectedUser.phone}</span>
                      </div>
                      <div className="admin-acc-kv-row">
                        <span className="admin-acc-kv-key">Ngày sinh</span>
                        <span className="admin-acc-kv-val">{selectedUser.dob || '15/08/2000'}</span>
                      </div>
                      <div className="admin-acc-kv-row">
                        <span className="admin-acc-kv-key">Giới tính</span>
                        <span className="admin-acc-kv-val">{selectedUser.gender || 'Nữ'}</span>
                      </div>
                      <div className="admin-acc-kv-row">
                        <span className="admin-acc-kv-key">Địa chỉ</span>
                        <span className="admin-acc-kv-val">{selectedUser.address}</span>
                      </div>
                      <div className="admin-acc-kv-row">
                        <span className="admin-acc-kv-key">Ngày tham gia</span>
                        <span className="admin-acc-kv-val">{selectedUser.joinDateTime || selectedUser.joinDate}</span>
                      </div>
                      <div className="admin-acc-kv-row">
                        <span className="admin-acc-kv-key">Cập nhật cuối</span>
                        <span className="admin-acc-kv-val">{selectedUser.lastLogin}</span>
                      </div>
                      <div className="admin-acc-kv-row">
                        <span className="admin-acc-kv-key">Vai trò</span>
                        <span className="admin-acc-kv-val" style={{ color: '#2563EB', fontWeight: 600 }}>
                          {selectedUser.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Trạng thái & Xác minh */}
                  <div>
                    <h4 className="admin-acc-sec-title" style={{ marginBottom: '12px' }}>
                      Trạng thái &amp; Xác minh
                    </h4>

                    <div className="admin-acc-status-box">
                      <div className="admin-acc-status-row">
                        <span style={{ fontSize: '13px', color: '#475569' }}>Trạng thái tài khoản</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className={`status-dot-pill ${selectedUser.status === 'ACTIVE' ? 'active' : 'locked'}`}>
                            <span className="dot" />
                            {selectedUser.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm khóa'}
                          </span>
                          {!isUserAdmin(selectedUser) && (
                            <button
                              type="button"
                              className={`btn-acc-lock-toggle ${selectedUser.status === 'LOCKED' ? 'unlock' : 'lock'}`}
                              onClick={() => handleToggleLock(selectedUser.id)}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                              {selectedUser.status === 'LOCKED' ? 'Mở khóa' : 'Tạm khóa'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="admin-acc-status-row">
                        <span style={{ fontSize: '13px', color: '#475569' }}>Xác minh Email</span>
                        <span className="verify-pill verified">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Đã xác minh
                        </span>
                      </div>

                      <div className="admin-acc-status-row">
                        <span style={{ fontSize: '13px', color: '#475569' }}>KYC Định danh</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="verify-pill verified">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Đã định danh
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Thống kê (Chỉ hiển thị cho người dùng thông thường, ẩn hoàn toàn đối với Admin) */}
                  {!isUserAdmin(selectedUser) && (
                    <div>
                      <h4 className="admin-acc-sec-title" style={{ marginBottom: '12px' }}>
                        Thống kê hệ thống
                      </h4>

                      <div className="admin-acc-stats-grid">
                        {/* Box 1 */}
                        <div className="admin-acc-stat-box">
                          <div className="admin-acc-stat-box-icon blue">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                              <line x1="3" y1="6" x2="21" y2="6" />
                              <path d="M16 10a4 4 0 0 1-8 0" />
                            </svg>
                          </div>
                          <div className="admin-acc-stat-box-label">Giao dịch thuê</div>
                          <div className="admin-acc-stat-box-val">{selectedUser.totalOrders} đơn</div>
                          <div className="admin-acc-stat-box-sub">{selectedUser.totalDeposit}</div>
                        </div>

                        {/* Box 2 */}
                        <div className="admin-acc-stat-box">
                          <div className="admin-acc-stat-box-icon green">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                              <polyline points="9 12 11 14 15 10" />
                            </svg>
                          </div>
                          <div className="admin-acc-stat-box-label">Điểm uy tín Escrow</div>
                          <div className="admin-acc-stat-box-val" style={{ color: '#059669' }}>
                            {selectedUser.rating}
                          </div>
                          <div className="admin-acc-stat-box-sub">PayOS Bảo đảm</div>
                        </div>

                        {/* Box 3 */}
                        <div className="admin-acc-stat-box">
                          <div className="admin-acc-stat-box-icon red">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              <line x1="12" y1="9" x2="12" y2="13" />
                              <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                          </div>
                          <div className="admin-acc-stat-box-label">Vi phạm</div>
                          <div className="admin-acc-stat-box-val" style={{ color: selectedUser.violations > 0 ? '#EF4444' : '#10B981' }}>
                            {selectedUser.violations} lần
                          </div>
                          <div className="admin-acc-stat-box-sub">An toàn hợp đồng</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section 4: Thao tác nhanh */}
                  <div>
                    <h4 className="admin-acc-sec-title" style={{ marginBottom: '12px' }}>
                      Thao tác nhanh
                    </h4>

                    <div className="admin-acc-quick-actions">
                      <div className="admin-acc-btn-row">
                        {!isUserAdmin(selectedUser) && (
                          <button
                            type="button"
                            className="btn-acc-action-primary"
                            onClick={() => openEditModalForUser(selectedUser)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            <span>Chỉnh sửa</span>
                          </button>
                        )}

                        {!isUserAdmin(selectedUser) && (
                          <button
                            type="button"
                            className={selectedUser.status === 'LOCKED' ? 'btn-acc-action-primary' : 'btn-acc-action-danger'}
                            onClick={() => handleToggleLock(selectedUser.id)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <span>{selectedUser.status === 'LOCKED' ? 'Mở khóa' : 'Tạm khóa'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn-acc-action-secondary"
                          onClick={() => openResetPasswordModal(selectedUser)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="16" r="1" />
                            <rect x="3" y="10" width="18" height="12" rx="2" />
                            <path d="M7 10V7a5 5 0 0 1 10 0v3" />
                          </svg>
                          <span>Đặt lại mật khẩu</span>
                        </button>
                      </div>

                      <div className="admin-acc-btn-row-2">
                        <button
                          type="button"
                          className="btn-acc-action-secondary"
                          onClick={() => setActiveDrawerTab('ACTIVITY')}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          <span>Xem lịch sử hoạt động</span>
                        </button>

                        {!isUserAdmin(selectedUser) && (
                          <button
                            type="button"
                            className="btn-acc-action-secondary"
                            onClick={() => setShowNotifyModal(true)}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="22" y1="2" x2="11" y2="13" />
                              <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                            <span>Gửi thông báo</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Tab 2: Hoạt động */}
              {activeDrawerTab === 'ACTIVITY' && (
                <div>
                  <h4 className="admin-acc-sec-title" style={{ marginBottom: '14px' }}>
                    Nhật ký hoạt động tài khoản
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                    <div style={{ borderLeft: '2px solid #2563EB', paddingLeft: '12px' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>Cập nhật thông tin gần nhất</div>
                      <div style={{ color: '#64748B', fontSize: '11.5px' }}>{selectedUser.lastLogin} • Hệ thống MongoDB</div>
                    </div>

                    <div style={{ borderLeft: '2px solid #10B981', paddingLeft: '12px' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>Khởi tạo tài khoản thành công</div>
                      <div style={{ color: '#64748B', fontSize: '11.5px' }}>{selectedUser.joinDateTime} • VESTORA Server</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Giao dịch */}
              {activeDrawerTab === 'TRANSACTIONS' && (
                <div>
                  <h4 className="admin-acc-sec-title" style={{ marginBottom: '14px' }}>
                    Lịch sử thuê đồ &amp; Cọc Escrow PayOS
                  </h4>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px', color: '#0F172A' }}>Giao dịch gần đây</span>
                        <span style={{ color: '#059669', fontWeight: 600, fontSize: '13px' }}>{selectedUser.totalDeposit}</span>
                      </div>
                      <div style={{ fontSize: '11.5px', color: '#64748B', display: 'flex', justifyContent: 'space-between' }}>
                        <span>Tổng số đơn thuê: {selectedUser.totalOrders} đơn</span>
                        <span style={{ color: '#0284C7' }}>Hợp đồng bảo đảm PayOS</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4: Vi phạm */}
              {activeDrawerTab === 'VIOLATIONS' && (
                <div>
                  <h4 className="admin-acc-sec-title" style={{ marginBottom: '14px' }}>
                    Báo cáo &amp; Biên bản vi phạm
                  </h4>

                  {selectedUser.violations === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 10px', color: '#059669' }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: '8px' }}>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <polyline points="9 12 11 14 15 10" />
                      </svg>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>Tài khoản chuẩn mực</div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        Chưa ghi nhận bất kỳ vi phạm hợp đồng hoặc báo cáo khiếu nại nào.
                      </div>
                    </div>
                  ) : (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', fontSize: '12.5px', color: '#B91C1C' }}>
                      <strong>Cảnh báo vi phạm:</strong> Tài khoản này có {selectedUser.violations} lần cảnh báo vi phạm được ghi nhận trong cơ sở dữ liệu.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==========================================================
          MODAL: THÊM NGƯỜI DÙNG MỚI
          ========================================================== */}
      {showAddModal && (
        <div className="admin-acc-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="admin-acc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-acc-modal-head">
              <h3 className="admin-acc-modal-title">Thêm người dùng mới vào hệ thống</h3>
              <button
                type="button"
                className="admin-acc-drawer-close"
                onClick={() => setShowAddModal(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="admin-acc-modal-body">
                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    className="admin-acc-form-input"
                    placeholder="VD: Nguyễn Văn Anh"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  />
                </div>

                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">Email tài khoản *</label>
                  <input
                    type="email"
                    required
                    className="admin-acc-form-input"
                    placeholder="VD: user@vestora.vn"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  />
                </div>

                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">Số điện thoại</label>
                  <input
                    type="text"
                    className="admin-acc-form-input"
                    placeholder="VD: 0987 654 321"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="admin-acc-form-group">
                    <label className="admin-acc-form-label">Vai trò</label>
                    <select
                      className="admin-acc-form-select"
                      value={addForm.role}
                      onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                    >
                      <option value="customer">customer — Khách hàng</option>
                      <option value="shopOwner">shopOwner — Chủ gian hàng</option>
                      <option value="brandmanager">brandmanager — Quản lý thương hiệu</option>
                      <option value="warehouseManager">warehouseManager — Quản lý kho</option>
                      <option value="warehousestaff">warehousestaff — Nhân viên kho</option>
                      <option value="admin">admin — Quản trị viên</option>
                    </select>
                  </div>

                  <div className="admin-acc-form-group">
                    <label className="admin-acc-form-label">Trạng thái ban đầu</label>
                    <select
                      className="admin-acc-form-select"
                      value={addForm.status}
                      onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                    >
                      <option value="ACTIVE">Hoạt động</option>
                      <option value="LOCKED">Tạm khóa</option>
                    </select>
                  </div>
                </div>

                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">Mật khẩu khởi tạo</label>
                  <input
                    type="password"
                    className="admin-acc-form-input"
                    placeholder="Mặc định: Vestora@2026"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                  />
                </div>
              </div>

              <div className="admin-acc-modal-foot">
                <button
                  type="button"
                  className="btn-acc-outline"
                  onClick={() => setShowAddModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-acc-primary"
                >
                  Xác nhận thêm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================
          MODAL: CHỈNH SỬA TÀI KHOẢN
          ========================================================== */}
      {/* ==========================================================
          MODAL: CHỈNH SỬA HỒ SƠ TÀI KHOẢN (TailAdmin Rich Edit Modal)
          ========================================================== */}
      {showEditModal && selectedUser && (
        <div className="admin-acc-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="admin-acc-modal-card admin-acc-edit-card" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="admin-acc-modal-head-rich">
              <div className="admin-acc-modal-head-left">
                <div className="admin-acc-modal-head-icon blue">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <h3 className="admin-acc-modal-title-rich">
                    Chỉnh sửa hồ sơ {selectedUser.role === 'customer' ? 'khách hàng' : (ROLE_LABELS[selectedUser.role] || 'người dùng')}
                  </h3>
                  <p className="admin-acc-modal-sub-rich">
                    Cập nhật thông tin cá nhân của {selectedUser.role === 'customer' ? 'khách hàng' : (ROLE_LABELS[selectedUser.role]?.toLowerCase() || 'người dùng')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="admin-acc-drawer-close"
                onClick={() => setShowEditModal(false)}
                title="Đóng modal"
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: '15px' }} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="admin-acc-edit-form">
              <div className="admin-acc-modal-body admin-acc-edit-modal-body">
                {/* 1. Phần Chỉnh Sửa Avatar */}
                <div className="admin-acc-edit-avatar-box">
                  <div className="admin-acc-edit-avatar-preview-wrap">
                    {editForm.avatar ? (
                      <img
                        src={editForm.avatar}
                        alt="Preview Avatar"
                        className="admin-acc-edit-avatar-img"
                      />
                    ) : (
                      <div
                        className="admin-acc-edit-avatar-letter"
                        style={{ background: selectedUser.letterColor || '#3B82F6' }}
                      >
                        {editForm.name ? editForm.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                    )}
                    <div className="admin-acc-edit-avatar-badge" title="Đổi ảnh đại diện">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                      </svg>
                    </div>
                  </div>

                  <div className="admin-acc-edit-avatar-actions">
                    <div className="admin-acc-edit-avatar-title">
                      <span>Ảnh đại diện người dùng</span>
                    </div>
                    <p className="admin-acc-edit-avatar-desc">
                      Tải lên hình ảnh đại diện (PNG, JPG, WEBP tối đa 5MB)
                    </p>
                    <div className="admin-acc-edit-avatar-btns">
                      <input
                        type="file"
                        ref={avatarFileInputRef}
                        onChange={handleAvatarFileChange}
                        accept="image/png, image/jpeg, image/jpg, image/webp"
                        style={{ display: 'none' }}
                      />
                      <button
                        type="button"
                        className="btn-upload-avatar"
                        onClick={() => avatarFileInputRef.current?.click()}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span>Tải ảnh mới</span>
                      </button>
                      {editForm.avatar && (
                        <button
                          type="button"
                          className="btn-remove-avatar"
                          onClick={handleRemoveAvatar}
                        >
                          Gỡ ảnh (dùng chữ cái)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {editFormErrors.avatar && (
                  <span className="admin-acc-field-error">{editFormErrors.avatar}</span>
                )}

                {/* 2. Họ và tên * */}
                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">
                    Họ và tên <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <div className="admin-acc-input-wrap">
                    <span className="admin-acc-input-icon">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      required
                      className="admin-acc-form-input"
                      placeholder="Nhập họ và tên đầy đủ"
                      value={editForm.name}
                      onChange={(e) => {
                        setEditForm({ ...editForm, name: e.target.value });
                        if (editFormErrors.name) setEditFormErrors(prev => ({ ...prev, name: null }));
                      }}
                    />
                  </div>
                  {editFormErrors.name && (
                    <span className="admin-acc-field-error">{editFormErrors.name}</span>
                  )}
                </div>

                {/* 3. Row: Email * | Số điện thoại */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px' }}>
                  <div className="admin-acc-form-group">
                    <label className="admin-acc-form-label">
                      Email <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <div className="admin-acc-input-wrap">
                      <span className="admin-acc-input-icon">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                      </span>
                      <input
                        type="email"
                        disabled
                        className="admin-acc-form-input"
                        value={editForm.email || selectedUser.email}
                      />
                    </div>
                    <span className="admin-acc-field-hint">Email không thể chỉnh sửa</span>
                  </div>

                  <div className="admin-acc-form-group">
                    <label className="admin-acc-form-label">Số điện thoại</label>
                    <div className="admin-acc-input-wrap">
                      <span className="admin-acc-input-icon">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        className="admin-acc-form-input"
                        placeholder="0912345678"
                        value={editForm.phone}
                        onChange={(e) => {
                          setEditForm({ ...editForm, phone: e.target.value });
                          if (editFormErrors.phone) setEditFormErrors(prev => ({ ...prev, phone: null }));
                        }}
                      />
                    </div>
                    {editFormErrors.phone && (
                      <span className="admin-acc-field-error">{editFormErrors.phone}</span>
                    )}
                  </div>
                </div>

                {/* 4. Row: Ngày sinh | Giới tính */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="admin-acc-form-group">
                    <label className="admin-acc-form-label">Ngày sinh</label>
                    <div className="admin-acc-input-wrap">
                      <span className="admin-acc-input-icon">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        className="admin-acc-form-input"
                        placeholder="15/08/2000"
                        value={editForm.dob}
                        onChange={(e) => {
                          setEditForm({ ...editForm, dob: e.target.value });
                          if (editFormErrors.dob) setEditFormErrors(prev => ({ ...prev, dob: null }));
                        }}
                      />
                    </div>
                    {editFormErrors.dob && (
                      <span className="admin-acc-field-error">{editFormErrors.dob}</span>
                    )}
                  </div>

                  <div className="admin-acc-form-group">
                    <label className="admin-acc-form-label">Giới tính</label>
                    <div className="admin-acc-input-wrap">
                      <span className="admin-acc-input-icon">
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="9" r="5" />
                          <line x1="12" y1="14" x2="12" y2="21" />
                          <line x1="9" y1="18" x2="15" y2="18" />
                        </svg>
                      </span>
                      <select
                        className="admin-acc-form-select"
                        value={editForm.gender}
                        onChange={(e) => {
                          setEditForm({ ...editForm, gender: e.target.value });
                          if (editFormErrors.gender) setEditFormErrors(prev => ({ ...prev, gender: null }));
                        }}
                      >
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </div>
                    {editFormErrors.gender && (
                      <span className="admin-acc-field-error">{editFormErrors.gender}</span>
                    )}
                  </div>
                </div>

                {/* 5. Địa chỉ */}
                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">Địa chỉ</label>
                  <div className="admin-acc-input-wrap has-textarea">
                    <span className="admin-acc-input-icon">
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </span>
                    <textarea
                      rows={2}
                      className="admin-acc-form-textarea"
                      placeholder="123 Nguyễn Văn Cừ, Quận Long Biên, Hà Nội"
                      value={editForm.address}
                      onChange={(e) => {
                        setEditForm({ ...editForm, address: e.target.value });
                        if (editFormErrors.address) setEditFormErrors(prev => ({ ...prev, address: null }));
                      }}
                    />
                  </div>
                  {editFormErrors.address && (
                    <span className="admin-acc-field-error">{editFormErrors.address}</span>
                  )}
                </div>

                {/* 6. Info Banner Alert */}
                <div className="admin-acc-edit-info-alert">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span>Các trường có dấu <strong style={{ color: '#EF4444' }}>*</strong> là bắt buộc. Email không thể thay đổi.</span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="admin-acc-modal-foot-rich">
                <button
                  type="button"
                  className="btn-acc-modal-cancel"
                  onClick={() => setShowEditModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-acc-modal-save"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span>Lưu thay đổi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================
          MODAL: ĐẶT LẠI MẬT KHẨU
          ========================================================== */}
      {showResetPwdModal && selectedUser && (
        <div className="admin-acc-modal-overlay" onClick={() => setShowResetPwdModal(false)}>
          <div className="admin-acc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-acc-modal-head">
              <h3 className="admin-acc-modal-title">Đặt lại mật khẩu cho {selectedUser.name}</h3>
              <button
                type="button"
                className="admin-acc-drawer-close"
                onClick={() => setShowResetPwdModal(false)}
                title="Đóng"
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: '15px' }} />
              </button>
            </div>

            <div className="admin-acc-modal-body">
              <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>
                Hệ thống sẽ tạo mật khẩu ngẫu nhiên hoặc bạn có thể nhập mật khẩu tùy chỉnh. Người dùng sẽ nhận được email thông báo đổi mật khẩu mới.
              </p>

              <div className="admin-acc-form-group">
                <label className="admin-acc-form-label">Mật khẩu mới</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="admin-acc-form-input"
                    value={resetPwdValue}
                    onChange={(e) => setResetPwdValue(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-acc-outline"
                    onClick={() => setResetPwdValue('Vestora@' + Math.floor(1000 + Math.random() * 9000))}
                  >
                    Tạo lại
                  </button>
                </div>
              </div>
            </div>

            <div className="admin-acc-modal-foot">
              <button
                type="button"
                className="btn-acc-outline"
                onClick={() => setShowResetPwdModal(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn-acc-primary"
                onClick={() => {
                  alert(`Đã đặt lại mật khẩu mới cho ${selectedUser.email}: ${resetPwdValue}`);
                  setShowResetPwdModal(false);
                }}
              >
                <i className="fa-solid fa-key" style={{ marginRight: '6px' }} />
                Cập nhật mật khẩu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          MODAL: GỬI THÔNG BÁO TỚI USER
          ========================================================== */}
      {showNotifyModal && selectedUser && (
        <div className="admin-acc-modal-overlay" onClick={() => setShowNotifyModal(false)}>
          <div className="admin-acc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-acc-modal-head">
              <h3 className="admin-acc-modal-title">Gửi thông báo tới {selectedUser.name}</h3>
              <button
                type="button"
                className="admin-acc-drawer-close"
                onClick={() => setShowNotifyModal(false)}
                title="Đóng"
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: '15px' }} />
              </button>
            </div>

            <div className="admin-acc-modal-body">
              <div className="admin-acc-form-group">
                <label className="admin-acc-form-label">Tiêu đề thông báo *</label>
                <input
                  type="text"
                  className="admin-acc-form-input"
                  placeholder="VD: Cập nhật thông tin định danh CCCD"
                  value={notifyForm.title}
                  onChange={(e) => setNotifyForm({ ...notifyForm, title: e.target.value })}
                />
              </div>

              <div className="admin-acc-form-group">
                <label className="admin-acc-form-label">Loại thông báo</label>
                <select
                  className="admin-acc-form-select"
                  value={notifyForm.type}
                  onChange={(e) => setNotifyForm({ ...notifyForm, type: e.target.value })}
                >
                  <option value="SYSTEM">Hệ thống</option>
                  <option value="WARNING">Cảnh báo vi phạm</option>
                  <option value="PROMO">Khuyến mãi / Tri ân</option>
                </select>
              </div>

              <div className="admin-acc-form-group">
                <label className="admin-acc-form-label">Nội dung chi tiết</label>
                <textarea
                  rows="4"
                  className="admin-acc-form-textarea"
                  placeholder="Nhập nội dung thông báo gửi đến người dùng..."
                  value={notifyForm.message}
                  onChange={(e) => setNotifyForm({ ...notifyForm, message: e.target.value })}
                />
              </div>
            </div>

            <div className="admin-acc-modal-foot">
              <button
                type="button"
                className="btn-acc-outline"
                onClick={() => setShowNotifyModal(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn-acc-primary"
                onClick={() => {
                  showToast(`Đã gửi thông báo thành công tới ${selectedUser.email}!`, 'success');
                  setShowNotifyModal(false);
                  setNotifyForm({ title: '', message: '', type: 'SYSTEM' });
                }}
              >
                <i className="fa-solid fa-paper-plane" style={{ marginRight: '6px' }} />
                Gửi thông báo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: Lý Do Khóa Tài Khoản (Theme Sáng + Font Awesome) ========== */}
      {showLockReasonModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLocking) setShowLockReasonModal(false);
          }}
        >
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E2E8F0',
              width: '100%',
              maxWidth: '490px',
              boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.16)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '20px 24px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                background: '#FFFFFF'
              }}
            >
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: '#FEE2E2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <i className="fa-solid fa-lock" style={{ color: '#DC2626', fontSize: '18px' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#0F172A', fontWeight: 700, fontSize: '16px', lineHeight: 1.3 }}>
                  Khóa Tài Khoản
                </div>
                <div style={{ color: '#64748B', fontSize: '12.5px', marginTop: '3px' }}>
                  Hệ thống sẽ gửi email thông báo lý do tới người dùng
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isLocking && setShowLockReasonModal(false)}
                disabled={isLocking}
                style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  cursor: isLocking ? 'not-allowed' : 'pointer',
                  color: '#64748B',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  transition: 'all 0.15s ease'
                }}
                title="Đóng"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              <div
                style={{
                  background: '#FFF7ED',
                  border: '1px solid #FFEDD5',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  marginBottom: '20px'
                }}
              >
                <div
                  style={{
                    color: '#C2410C',
                    fontSize: '12px',
                    fontWeight: 700,
                    marginBottom: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    letterSpacing: '0.3px'
                  }}
                >
                  <i className="fa-solid fa-triangle-exclamation" style={{ color: '#EA580C', fontSize: '13px' }} />
                  <span>LƯU Ý</span>
                </div>
                <div style={{ color: '#9A3412', fontSize: '13px', lineHeight: 1.6 }}>
                  Người dùng sẽ nhận được email thông báo kèm lý do khóa ngay sau khi bạn xác nhận.
                  Tài khoản bị khóa sẽ không thể đăng nhập cho đến khi được mở khóa.
                </div>
              </div>

              <label
                style={{
                  display: 'block',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 700,
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Lý do khóa tài khoản <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <textarea
                rows={4}
                value={lockReasonText}
                onChange={(e) => setLockReasonText(e.target.value)}
                placeholder="Vd: Vi phạm điều khoản sử dụng dịch vụ, giao dịch gian lận, phản ánh từ người dùng khác..."
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  background: '#FFFFFF',
                  border: `1px solid ${
                    lockReasonText.trim().length > 0 && lockReasonText.trim().length < 5 ? '#DC2626' : '#CBD5E1'
                  }`,
                  borderRadius: '10px',
                  color: '#0F172A',
                  fontSize: '13.5px',
                  padding: '12px 14px',
                  resize: 'vertical',
                  lineHeight: 1.6,
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
                }}
              />
              {lockReasonText.trim().length > 0 && lockReasonText.trim().length < 5 && (
                <div
                  style={{
                    color: '#DC2626',
                    fontSize: '12px',
                    marginTop: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '12px' }} />
                  <span>Lý do phải có ít nhất 5 ký tự.</span>
                </div>
              )}
              <div style={{ color: '#94A3B8', fontSize: '11.5px', marginTop: '6px', textAlign: 'right' }}>
                {lockReasonText.length} ký tự
              </div>
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid #F1F5F9',
                background: '#F8FAFC',
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
                alignItems: 'center'
              }}
            >
              <button
                type="button"
                onClick={() => setShowLockReasonModal(false)}
                disabled={isLocking}
                style={{
                  padding: '10px 18px',
                  borderRadius: '8px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#475569',
                  fontSize: '13px',
                  cursor: isLocking ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmLockWithReason}
                disabled={isLocking || lockReasonText.trim().length < 5}
                style={{
                  padding: '10px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  background: lockReasonText.trim().length >= 5 && !isLocking ? '#DC2626' : '#94A3B8',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: lockReasonText.trim().length >= 5 && !isLocking ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow:
                    lockReasonText.trim().length >= 5 && !isLocking
                      ? '0 2px 8px rgba(220, 38, 38, 0.25)'
                      : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                {isLocking ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-lock" />
                    <span>Xác nhận khóa & Gửi email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      {toasts.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            pointerEvents: 'none'
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                pointerEvents: 'auto',
                minWidth: '320px',
                maxWidth: '440px',
                padding: '14px 18px',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '13.5px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.25), 0 4px 10px rgba(0, 0, 0, 0.1)',
                background:
                  t.type === 'success'
                    ? 'linear-gradient(135deg, #065F46, #059669)'
                    : t.type === 'error'
                      ? 'linear-gradient(135deg, #991B1B, #DC2626)'
                      : t.type === 'warning'
                        ? 'linear-gradient(135deg, #92400E, #D97706)'
                        : 'linear-gradient(135deg, #1E293B, #334155)',
                borderLeft: `5px solid ${t.type === 'success'
                  ? '#34D399'
                  : t.type === 'error'
                    ? '#F87171'
                    : t.type === 'warning'
                      ? '#FBBF24'
                      : '#60A5FA'
                  }`,
                backdropFilter: 'blur(8px)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {t.type === 'success' && <i className="fa-solid fa-circle-check" style={{ color: '#34D399' }} />}
                  {t.type === 'error' && <i className="fa-solid fa-circle-xmark" style={{ color: '#F87171' }} />}
                  {t.type === 'warning' && <i className="fa-solid fa-triangle-exclamation" style={{ color: '#FBBF24' }} />}
                  {(t.type === 'info' || (!['success', 'error', 'warning'].includes(t.type))) && (
                    <i className="fa-solid fa-circle-info" style={{ color: '#60A5FA' }} />
                  )}
                </span>
                <span style={{ lineHeight: 1.45 }}>{t.message}</span>
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.75)',
                  cursor: 'pointer',
                  padding: '4px',
                  fontSize: '14px',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Đóng thông báo"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

