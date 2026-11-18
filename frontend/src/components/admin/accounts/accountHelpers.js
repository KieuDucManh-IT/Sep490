export const ROLE_LABELS = {
  customer: 'Khách hàng',
  shopOwner: 'Chủ cửa hàng',
  branch_manager: 'Quản lý chi nhánh',
  brandmanager: 'Quản lý chi nhánh',
  warehouse_manager: 'Quản lý kho',
  warehouse_staff: 'Nhân viên kho',
  admin: 'Quản trị viên'
};

export const normalizeRole = (raw) => {
  const r = (raw || 'customer').toString().trim().toLowerCase().replace(/[_\s-]/g, '');
  if (r === 'admin') return 'admin';
  if (r === 'shopowner' || r === 'owner') return 'shopOwner';
  if (r === 'branchmanager' || r === 'brandmanager') return 'branch_manager';
  if (r === 'warehousemanager') return 'warehouse_manager';
  if (r === 'warehousestaff') return 'warehouse_staff';
  return 'customer';
};

export const roleColor = (role) => {
  if (role === 'admin') return '#4338CA';
  if (role === 'shopOwner') return '#C2410C';
  if (role === 'branch_manager' || role === 'brandmanager') return '#7E22CE';
  if (role === 'warehouse_manager' || role === 'warehouseManager') return '#0E7490';
  if (role === 'warehouse_staff' || role === 'warehousestaff') return '#047857';
  return '#0369A1';
};

export const isUserAdmin = (u) => {
  if (!u) return false;
  const r = (u.role || u.Role || '').toLowerCase().replace(/[_\s-]/g, '');
  return r === 'admin';
};

export const isCustomer = (u) => {
  if (!u) return false;
  const r = (u.role || u.Role || '').toLowerCase().replace(/[_\s-]/g, '');
  return r === 'customer';
};

export const isSelf = (u, currentUser) => {
  if (!u || !currentUser) return false;
  const currentId = currentUser.id || currentUser._id;
  const currentEmail = (currentUser.email || currentUser.Email || '').toLowerCase();
  return (
    (currentId && (u.id === currentId || u._id === currentId)) ||
    (currentEmail && u.email && u.email.toLowerCase() === currentEmail)
  );
};

export const cannotLock = (u, currentUser) => isUserAdmin(u) || isSelf(u, currentUser);

export const isGoogleUser = (u) => {
  if (!u) return false;
  const provider = (u.authProvider || u.AuthProvider || '').toLowerCase();
  return provider === 'google' || Boolean(u.googleId || u.GoogleId);
};
