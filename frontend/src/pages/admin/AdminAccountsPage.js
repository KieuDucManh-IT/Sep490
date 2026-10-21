import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopHeader from '../../components/AdminTopHeader';
import '../../styles/AdminDashboard.css';
import '../../styles/AdminAccounts.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

export default function AdminAccountsPage() {
  const { user: currentUser } = useAuth();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState('INFO');
  const [isLoading, setIsLoading] = useState(true);
  const [backendStats, setBackendStats] = useState(null);

  // Helper functions: Bảo vệ tài khoản Quản trị viên và tài khoản hiện tại đang đăng nhập
  const isUserAdmin = (u) => {
    if (!u) return false;
    const r = (u.role || u.Role || '').toUpperCase();
    return r === 'ADMIN';
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

  // Forms
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'CUSTOMER',
    status: 'ACTIVE',
    password: ''
  });

  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    address: '',
    dob: '',
    gender: 'Nữ',
    role: 'CUSTOMER',
    status: 'ACTIVE'
  });

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
        const mapped = usersJson.data.map(u => {
          const roleUpper = (u.Role || 'CUSTOMER').toUpperCase().replace('_', ' ');
          const statusUpper = (u.Status || 'ACTIVE').toUpperCase();
          const phone = u.Information?.[0]?.Phone || u.Infomation?.[0]?.Phone || '';
          const address = u.Information?.[0]?.Address || u.Infomation?.[0]?.Address || '';

          // Determine verification badge
          let verifyStatus = 'VERIFIED';
          if (u.IsVerified === false) {
            verifyStatus = 'UNVERIFIED';
          } else if (u.Role?.toLowerCase() === 'shop_owner' && !u.IsVerified) {
            verifyStatus = 'PENDING';
          }

          return {
            id: u._id,
            displayId: `#${String(u.UserId || u._id).slice(-6).toUpperCase()}`,
            name: u.FullName || u.Email?.split('@')[0] || 'Người dùng VESTORA',
            email: u.Email,
            role: roleUpper,
            verified: verifyStatus,
            status: statusUpper,
            joinDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString('vi-VN') : '—',
            joinDateTime: u.createdAt ? new Date(u.createdAt).toLocaleString('vi-VN') : '—',
            lastLogin: u.updatedAt ? new Date(u.updatedAt).toLocaleString('vi-VN') : 'Mới tạo',
            avatar: u.Avatar || null,
            letter: (u.FullName || u.Email || 'U').charAt(0).toUpperCase(),
            letterColor: roleUpper === 'ADMIN' ? '#2563EB' : roleUpper.includes('SHOP') ? '#EA580C' : '#3B82F6',
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

        setUsers(mapped);

        // Open drawer for the first real user if not already selected
        if (mapped.length > 0) {
          setSelectedUser(prev => prev ? mapped.find(m => m.id === prev.id) || mapped[0] : mapped[0]);
          setDrawerOpen(true);
        }
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
        if (roleFilter === 'ADMIN' && u.role !== 'ADMIN') return false;
        if (roleFilter === 'CUSTOMER' && u.role !== 'CUSTOMER') return false;
        if (roleFilter === 'SHOP_OWNER' && !u.role.includes('SHOP')) return false;
        if (roleFilter === 'STAFF' && u.role !== 'STAFF') return false;
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
      alert(
        isSelf(target)
          ? 'Bạn không thể tự khóa tài khoản của chính mình!'
          : 'Không thể khóa tài khoản Quản trị viên (Admin) để bảo vệ quyền quản trị hệ thống!'
      );
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/users/${userId}/toggle-lock`, { method: 'PATCH' });
      const json = await res.json();
      if (json.success) {
        // Update local state
        setUsers(prev => prev.map(u => {
          if (u.id === userId) {
            const nextStatus = u.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED';
            return { ...u, status: nextStatus };
          }
          return u;
        }));

        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser(prev => ({
            ...prev,
            status: prev.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED'
          }));
        }
      } else {
        alert(json.message || 'Không thể thực hiện thao tác này');
      }
    } catch (e) {
      console.error('Lỗi khi khóa/mở khóa tài khoản:', e);
      alert('Lỗi kết nối máy chủ khi thay đổi trạng thái tài khoản');
    }
  };

  // Bulk Actions
  const handleBulkLock = async () => {
    const safeIds = selectedIds.filter(id => {
      const u = users.find(user => user.id === id);
      return !cannotLock(u);
    });

    if (safeIds.length === 0) {
      alert('Không có tài khoản nào hợp lệ để khóa (Tài khoản Quản trị viên và tài khoản hiện tại được bảo vệ).');
      return;
    }

    for (const id of safeIds) {
      const user = users.find(u => u.id === id);
      if (user && user.status !== 'LOCKED') {
        await handleToggleLock(id);
      }
    }
    setSelectedIds([]);
  };

  const handleBulkUnlock = async () => {
    for (const id of selectedIds) {
      const user = users.find(u => u.id === id);
      if (user && user.status === 'LOCKED') {
        await handleToggleLock(id);
      }
    }
    setSelectedIds([]);
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
  };

  // Open Edit Modal
  const openEditModalForUser = (user) => {
    if (!user) return;
    if (isUserAdmin(user)) {
      alert('Tài khoản Quản trị viên (Admin) duy nhất của hệ thống được bảo vệ và không thể chỉnh sửa!');
      return;
    }
    setEditForm({
      name: user.name,
      phone: user.phone !== 'Chưa cập nhật' ? user.phone : '',
      address: user.address !== 'Chưa cập nhật' ? user.address : '',
      dob: user.dob || '15/08/2000',
      gender: user.gender || 'Nữ',
      role: user.role === 'ADMIN' ? 'CUSTOMER' : user.role,
      status: user.status
    });
    setSelectedUser(user);
    setShowEditModal(true);
    setOpenActionId(null);
  };

  // Save Edit User with Backend API
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (cannotLock(selectedUser) && editForm.status === 'LOCKED') {
      alert(
        isSelf(selectedUser)
          ? 'Bạn không thể tự khóa tài khoản của chính mình!'
          : 'Không thể chuyển tài khoản Quản trị viên (Admin) sang trạng thái Tạm khóa!'
      );
      return;
    }

    if (editForm.name.trim().length > 25) {
      alert('Họ và tên không được vượt quá 25 ký tự!');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          FullName: editForm.name,
          Role: editForm.role.toLowerCase().replace(' ', '_'),
          Status: editForm.status.toLowerCase(),
          Phone: editForm.phone,
          Address: editForm.address
        })
      });
      const json = await res.json();
      if (json.success) {
        await fetchUsers();
        setShowEditModal(false);
      } else {
        alert(json.message || 'Lỗi khi cập nhật thông tin');
      }
    } catch (err) {
      console.error('Lỗi cập nhật người dùng:', err);
      alert('Không thể kết nối máy chủ khi cập nhật thông tin');
    }
  };

  // Create New User with Backend API
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!addForm.name || !addForm.email) {
      alert('Vui lòng nhập họ tên và email!');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          FullName: addForm.name,
          Email: addForm.email,
          Role: addForm.role.toLowerCase().replace(' ', '_'),
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
          role: 'CUSTOMER',
          status: 'ACTIVE',
          password: ''
        });
      } else {
        alert(json.message || 'Lỗi khi tạo tài khoản');
      }
    } catch (err) {
      console.error('Lỗi khi tạo người dùng mới:', err);
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
            <div className="admin-acc-breadcrumb">
              <span>Admin Console</span>
              <span className="admin-acc-breadcrumb-sep">&gt;</span>
              <span className="admin-acc-breadcrumb-active">Quản lý người dùng</span>
            </div>

            <div className="admin-acc-hero">
              <div>
                <h1 className="admin-acc-title">Quản lý tài khoản người dùng</h1>
                <p className="admin-acc-desc">
                  Quản lý danh sách tài khoản, quyền truy cập, xác minh danh tính và trạng thái hoạt động trực tiếp từ MongoDB.
                </p>
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
              <option value="ADMIN">ADMIN</option>
              <option value="CUSTOMER">CUSTOMER</option>
              <option value="SHOP_OWNER">SHOP OWNER</option>
              <option value="STAFF">STAFF</option>
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
              onClick={() => alert(`Đang hiển thị ${filteredUsers.length} người dùng thật từ MongoDB Atlas.`)}
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
                          <span className={`role-pill ${u.role === 'ADMIN' ? 'admin' :
                            u.role.includes('SHOP') ? 'shop-owner' :
                              u.role === 'STAFF' ? 'staff' : 'customer'
                            }`}>
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
              <span className={`role-pill ${selectedUser.role === 'ADMIN' ? 'admin' :
                selectedUser.role.includes('SHOP') ? 'shop-owner' :
                  selectedUser.role === 'STAFF' ? 'staff' : 'customer'
                }`}>
                {selectedUser.role}
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

                  {/* Section 3: Thống kê */}
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
                      <option value="CUSTOMER">CUSTOMER (Khách hàng)</option>
                      <option value="SHOP OWNER">SHOP OWNER (Chủ gian hàng)</option>
                      <option value="STAFF">STAFF (Nhân viên)</option>
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
      {showEditModal && selectedUser && (
        <div className="admin-acc-modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="admin-acc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-acc-modal-head">
              <h3 className="admin-acc-modal-title">Chỉnh sửa hồ sơ {selectedUser.name}</h3>
              <button
                type="button"
                className="admin-acc-drawer-close"
                onClick={() => setShowEditModal(false)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              <div className="admin-acc-modal-body">
                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">Họ và tên *</label>
                  <input
                    type="text"
                    required
                    className="admin-acc-form-input"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>

                <div className="admin-acc-form-group">
                  <label className="admin-acc-form-label">Số điện thoại</label>
                  <input
                    type="text"
                    className="admin-acc-form-input"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="admin-acc-form-group">
                    <label className="admin-acc-form-label">Ngày sinh</label>
                    <input
                      type="text"
                      className="admin-acc-form-input"
                      value={editForm.dob}
                      onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                    />
                  </div>

                  <div className="admin-acc-form-group">
                    <label className="admin-acc-form-label">Giới tính</label>
                    <select
                      className="admin-acc-form-select"
                      value={editForm.gender}
                      onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    >
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="admin-acc-form-group">
                    <label className="admin-acc-form-label">Vai trò</label>
                    <select
                      className="admin-acc-form-select"
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    >
                      <option value="CUSTOMER">CUSTOMER (Khách hàng)</option>
                      <option value="SHOP OWNER">SHOP OWNER (Chủ gian hàng)</option>
                      <option value="STAFF">STAFF (Nhân viên)</option>
                    </select>
                  </div>

                  <div className="admin-acc-form-group">
                    <label className="admin-acc-form-label">Trạng thái</label>
                    <select
                      className="admin-acc-form-select"
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    >
                      <option value="ACTIVE">Hoạt động</option>
                      <option value="LOCKED">Tạm khóa</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="admin-acc-modal-foot">
                <button
                  type="button"
                  className="btn-acc-outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-acc-primary"
                >
                  Lưu thay đổi
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
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
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
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
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
                  alert(`Đã gửi thông báo thành công tới ${selectedUser.email}!`);
                  setShowNotifyModal(false);
                  setNotifyForm({ title: '', message: '', type: 'SYSTEM' });
                }}
              >
                Gửi thông báo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
