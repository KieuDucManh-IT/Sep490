import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopHeader from '../../components/AdminTopHeader';
import AccountDetailDrawer from '../../components/admin/accounts/AccountDetailDrawer';
import AddUserModal from '../../components/admin/accounts/AddUserModal';
import EditUserModal from '../../components/admin/accounts/EditUserModal';
import ResetPasswordModal from '../../components/admin/accounts/ResetPasswordModal';
import NotifyUserModal from '../../components/admin/accounts/NotifyUserModal';
import LockReasonModal from '../../components/admin/accounts/LockReasonModal';
import AccountToastContainer from '../../components/admin/accounts/AccountToastContainer';
import '../../styles/AdminDashboard.css';
import '../../styles/AdminAccounts.css';
import { validateEditForm } from '../../utils/userValidation';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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

  const isCustomer = (u) => {
    if (!u) return false;
    const r = (u.role || u.Role || '').toLowerCase().replace(/[_\s-]/g, '');
    return r === 'customer';
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

  const isGoogleUser = (u) => {
    if (!u) return false;
    const provider = (u.authProvider || u.AuthProvider || '').toLowerCase();
    return provider === 'google' || Boolean(u.googleId || u.GoogleId);
  };

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
  const [isResettingPwd, setIsResettingPwd] = useState(false);
  const [notifyForm, setNotifyForm] = useState({
    title: '',
    message: '',
    type: 'SYSTEM'
  });

  // Pagination (mặc định hiển thị 5 tài khoản / trang)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

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
            violations: u.WarningsCount || 0,
            authProvider: (u.AuthProvider || (u.GoogleId ? 'google' : 'local')).toLowerCase(),
            googleId: u.GoogleId || ''
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
      role: ['shopOwner', 'brandmanager', 'warehouseManager', 'warehousestaff'].includes(user.role)
        ? user.role
        : 'warehousestaff',
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

    if (editForm.role === 'admin' || editForm.role === 'customer') {
      showToast('Không thể cập nhật nhân viên sang vai trò Quản trị viên (Admin) hoặc Khách hàng (Customer)!', 'error');
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

    // Xác thực toàn diện theo form thiết kế
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
          Phone: addForm.phone.trim()
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

  // Open Reset Password Modal
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

  // Handle Confirm Reset Password via Backend API (saves DB, sends email & requires change)
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

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setRoleFilter('ALL');
    setStatusFilter('ALL');
    setVerifyFilter('ALL');
  };

  return (
    <div className="admin-layout admin-acc-bg-page">
      {/* 1. TailAdmin Left Sidebar */}
      <AdminSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(prev => !prev)}
      />

      {/* 2. Main Viewport */}
      <div className="admin-main-viewport admin-acc-bg-page">
        {/* Top Navbar */}
        <AdminTopHeader
          onToggleSidebar={() => setIsSidebarCollapsed(prev => !prev)}
          breadcrumb="Quản lý người dùng"
        />

        {/* 3. Accounts Management Body */}
        <div className="admin-acc-page admin-acc-bg-page">
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="admin-acc-svg-arrow">
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
                  className="btn-bulk-action btn-bulk-action-clear"
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
                    <th className="admin-acc-th-w40">
                      <input
                        type="checkbox"
                        checked={paginatedUsers.length > 0 && paginatedUsers.every(u => selectedIds.includes(u.id))}
                        onChange={handleSelectAll}
                        className="admin-acc-checkbox"
                      />
                    </th>
                    <th>NGƯỜI DÙNG</th>
                    <th className="admin-acc-th-nowrap">VAI TRÒ</th>
                    <th>XÁC MINH</th>
                    <th>TRẠNG THÁI</th>
                    <th>NGÀY THAM GIA</th>
                    <th>ĐĂNG NHẬP CUỐI</th>
                    <th className="admin-acc-th-center">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="8" className="admin-acc-td-center-empty">
                        Đang đồng bộ danh sách tài khoản từ máy chủ MongoDB Atlas...
                      </td>
                    </tr>
                  ) : paginatedUsers.map((u, index) => {
                    const isRowSelected = selectedUser && selectedUser.id === u.id;
                    const isChecked = selectedIds.includes(u.id);
                    // Khi danh sách ngắn (như 5 dòng), các dòng từ giữa trở xuống sẽ bung menu lên trên (drop-up)
                    const isNearBottom = index >= Math.max(1, paginatedUsers.length - 3);

                    return (
                      <tr
                        key={u.id}
                        className={`admin-acc-tr-row ${isRowSelected ? 'selected' : ''} ${openActionId === u.id ? 'is-action-open' : ''}`}
                        onClick={() => {
                          setSelectedUser(u);
                          setActiveDrawerTab('INFO');
                          setDrawerOpen(true);
                        }}
                      >
                        {/* Checkbox */}
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handleSelectRow(u.id, e)}
                            className="admin-acc-checkbox"
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
                                style={{ '--letter-bg': u.letterColor || '#3B82F6' }}
                              >
                                {u.letter || u.name.charAt(0)}
                              </div>
                            )}
                            <div className="admin-acc-user-meta">
                              <span className="admin-acc-user-name" title={u.name}>{u.name}</span>
                              <span className="admin-acc-user-email" title={u.email}>{u.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="admin-acc-td-nowrap">
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
                        <td className="admin-acc-text-slate">{u.joinDate}</td>

                        {/* Last Login */}
                        <td className="admin-acc-text-slate-light">{u.lastLogin}</td>

                        {/* Action Buttons */}
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="admin-acc-action-cell admin-acc-action-cell-center">
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
                                className={`admin-acc-action-dropdown ${isNearBottom ? 'drop-up' : 'drop-down'}`}
                              >
                                <button
                                  type="button"
                                  className="admin-acc-action-dropdown-item"
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

                                {!isUserAdmin(u) && !isCustomer(u) && (
                                  <button
                                    type="button"
                                    className="admin-acc-action-dropdown-item"
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
                                    className={`admin-acc-action-dropdown-item ${u.status === 'LOCKED' ? 'success' : 'danger'}`}
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

                                {!isUserAdmin(u) && !isCustomer(u) && (
                                  !isGoogleUser(u) ? (
                                    <button
                                      type="button"
                                      className="admin-acc-action-dropdown-item"
                                      onClick={() => openResetPasswordModal(u)}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="16" r="1" />
                                        <rect x="3" y="10" width="18" height="12" rx="2" />
                                        <path d="M7 10V7a5 5 0 0 1 10 0v3" />
                                      </svg>
                                      <span>Đặt lại mật khẩu</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="admin-acc-action-dropdown-item is-disabled"
                                      disabled
                                      title="Tài khoản đăng nhập bằng Google không hỗ trợ đặt lại mật khẩu"
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="16" r="1" />
                                        <rect x="3" y="10" width="18" height="12" rx="2" />
                                        <path d="M7 10V7a5 5 0 0 1 10 0v3" />
                                      </svg>
                                      <span>Đăng nhập Google (Không đổi MK)</span>
                                    </button>
                                  )
                                )}

                                {!isUserAdmin(u) && !isCustomer(u) && (
                                  <button
                                    type="button"
                                    className="admin-acc-action-dropdown-item"
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
                      <td colSpan="8" className="admin-acc-td-center-empty">
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

              <div className="admin-acc-page-size-wrap">
                <span>Hiển thị</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="admin-acc-page-size-select"
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

      {/* 4. Drawer: Chi tiết tài khoản */}
      <AccountDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selectedUser={selectedUser}
        activeDrawerTab={activeDrawerTab}
        setActiveDrawerTab={setActiveDrawerTab}
        ROLE_LABELS={ROLE_LABELS}
        isUserAdmin={isUserAdmin}
        isCustomer={isCustomer}
        isGoogleUser={isGoogleUser}
        openEditModalForUser={openEditModalForUser}
        handleToggleLock={handleToggleLock}
        openResetPasswordModal={openResetPasswordModal}
        setShowNotifyModal={setShowNotifyModal}
      />

      {/* 5. Modal: Thêm người dùng mới */}
      <AddUserModal
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
        handleCreateUser={handleCreateUser}
      />

      {/* 6. Modal: Chỉnh sửa tài khoản */}
      <EditUserModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        selectedUser={selectedUser}
        editForm={editForm}
        setEditForm={setEditForm}
        editFormErrors={editFormErrors}
        setEditFormErrors={setEditFormErrors}
        avatarFileInputRef={avatarFileInputRef}
        handleAvatarFileChange={handleAvatarFileChange}
        handleRemoveAvatar={handleRemoveAvatar}
        handleSaveEdit={handleSaveEdit}
      />

      {/* 7. Modal: Đặt lại mật khẩu */}
      <ResetPasswordModal
        isOpen={showResetPwdModal}
        onClose={() => setShowResetPwdModal(false)}
        selectedUser={selectedUser}
        resetPwdValue={resetPwdValue}
        setResetPwdValue={setResetPwdValue}
        isResettingPwd={isResettingPwd}
        handleConfirmResetPassword={handleConfirmResetPassword}
      />

      {/* 8. Modal: Gửi thông báo tới User */}
      <NotifyUserModal
        isOpen={showNotifyModal}
        onClose={() => setShowNotifyModal(false)}
        selectedUser={selectedUser}
        notifyForm={notifyForm}
        setNotifyForm={setNotifyForm}
        showToast={showToast}
      />

      {/* 9. Modal: Lý do khóa tài khoản & gửi email */}
      <LockReasonModal
        isOpen={showLockReasonModal}
        onClose={() => setShowLockReasonModal(false)}
        isLocking={isLocking}
        lockReasonText={lockReasonText}
        setLockReasonText={setLockReasonText}
        confirmLockWithReason={confirmLockWithReason}
      />

      {/* 10. Toast Notification Container */}
      <AccountToastContainer
        toasts={toasts}
        removeToast={removeToast}
      />
    </div>
  );
}

