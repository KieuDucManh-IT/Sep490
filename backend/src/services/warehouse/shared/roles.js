// Chuẩn hóa vai trò người dùng một lần cho mọi service kho.
// Tài khoản có thể ghi role là "Warehouse Staff", "warehouse_staff" hay "warehouse-staff":
// tất cả đều được coi là cùng một vai trò. File này không import DB để unit test chạy độc lập.
import { appError } from './errors.js';

export const ROLES = {
  ADMIN: 'admin',
  WAREHOUSE_MANAGER: 'warehousemanager',
  WAREHOUSE_STAFF: 'warehousestaff',
  BRANCH_MANAGER: 'branchmanager',
};

/** Regex tìm tài khoản nhân viên kho trong DB, chấp nhận mọi cách viết role ở trên. */
export const WAREHOUSE_STAFF_ROLE_PATTERN = /^warehouse[\s_-]?staff$/i;

/**
 * Đưa role về dạng so sánh được: bỏ khoảng trắng, `_`, `-`, chữ thường.
 * Nhận user (đọc `Role` hoặc `role`) hoặc chuỗi role. "brandmanager" là lỗi gõ cũ trong dữ liệu → "branchmanager".
 */
export const normalizeRole = (userOrRole) => {
  const raw = typeof userOrRole === 'string' ? userOrRole : (userOrRole?.Role || userOrRole?.role);
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '')
    .replace('brandmanager', 'branchmanager');
};

/** true nếu role của user nằm trong danh sách (danh sách cũng được chuẩn hóa). */
export const hasRole = (user, roles) => roles.map(normalizeRole).includes(normalizeRole(user));

export const isAdmin = (user) => normalizeRole(user) === ROLES.ADMIN;
export const isWarehouseManager = (user) => normalizeRole(user) === ROLES.WAREHOUSE_MANAGER;
export const isWarehouseStaff = (user) => normalizeRole(user) === ROLES.WAREHOUSE_STAFF;
export const isBranchManager = (user) => normalizeRole(user) === ROLES.BRANCH_MANAGER;

/** Quản lý kho hoặc admin: nhóm được duyệt/hủy phiếu kho ở hầu hết nghiệp vụ. */
export const isWarehouseManagerOrAdmin = (user) => isWarehouseManager(user) || isAdmin(user);

/** Ném 403 với message cho trước nếu user không thuộc các role được phép. */
export const requireRole = (user, roles, message) => {
  if (!hasRole(user, roles)) throw appError(message, 403);
};

/** So sánh id người dùng với một field có thể đã populate (object có _id) hoặc chỉ là ObjectId. */
export const isSameUser = (value, user) => String(value?._id || value || '') === String(user?._id || '');
