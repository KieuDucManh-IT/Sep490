/**
 * User validation utilities for VESTORA frontend
 * File tái sử dụng cho các form: Chỉnh sửa tài khoản, Thêm tài khoản, Profile cá nhân, Đăng ký...
 */

export const NAME_REGEX = /^[A-Za-zÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝĂĐĨŨƠƯàáâãèéêìíòóôõùúýăđĩũơưẠ-ỹ\s.'-]+$/u;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const VN_PHONE_REGEX = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;

export const ALLOWED_ROLES = [
  'customer',
  'shopOwner',
  'brandmanager',
  'warehouseManager',
  'warehousestaff',
  'admin'
];

export const STAFF_ROLES = [
  'shopOwner',
  'brandmanager',
  'warehouseManager',
  'warehousestaff'
];

export const validateStaffRole = (role) => {
  if (!role || typeof role !== 'string' || !role.trim()) {
    return { isValid: false, message: 'Vui lòng chọn vai trò nhân viên' };
  }
  const clean = role.trim().toLowerCase().replace(/[_\s-]/g, '');
  if (clean === 'admin') {
    return { isValid: false, message: 'Không thể phân quyền Quản trị viên (Admin) cho nhân viên' };
  }
  if (clean === 'customer') {
    return { isValid: false, message: 'Không thể chuyển vai trò nhân viên thành Khách hàng (Customer)' };
  }
  const valid = STAFF_ROLES.some(r => r.toLowerCase().replace(/[_\s-]/g, '') === clean);
  if (!valid) {
    return { isValid: false, message: 'Vai trò nhân viên không hợp lệ' };
  }
  return { isValid: true };
};

export const ALLOWED_GENDERS = ['Nam', 'Nữ', 'Khác'];

/**
 * Kiểm tra Họ và tên
 * @param {string} name
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateFullName = (name) => {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { isValid: false, message: 'Họ và tên không được để trống' };
  }
  const trimmed = name.trim();
  if ([...trimmed].length > 25) {
    return { isValid: false, message: 'Họ và tên không được vượt quá 25 ký tự' };
  }
  if ([...trimmed].length < 2) {
    return { isValid: false, message: 'Họ và tên phải có ít nhất 2 ký tự' };
  }
  if (!NAME_REGEX.test(trimmed)) {
    return { isValid: false, message: 'Họ và tên chứa ký tự đặc biệt hoặc số không hợp lệ' };
  }
  return { isValid: true };
};

/**
 * Kiểm tra Email
 * @param {string} email
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.trim()) {
    return { isValid: false, message: 'Email không được để trống' };
  }
  const trimmed = email.trim();
  if (trimmed.length > 254) {
    return { isValid: false, message: 'Email quá dài (tối đa 254 ký tự)' };
  }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { isValid: false, message: 'Email không đúng định dạng (ví dụ: user@example.com)' };
  }
  return { isValid: true };
};

/**
 * Kiểm tra Số điện thoại (Việt Nam)
 * @param {string} phone
 * @returns {{ isValid: boolean, message?: string, cleanPhone?: string }}
 */
export const validatePhone = (phone) => {
  if (!phone || !phone.toString().trim()) {
    return { isValid: true }; // Không bắt buộc
  }
  const cleanPhone = phone.toString().trim().replace(/[\s.-]/g, '');
  if (!VN_PHONE_REGEX.test(cleanPhone)) {
    return { isValid: false, message: 'Số điện thoại không hợp lệ (10 số, bắt đầu 03, 05, 07, 08, 09)' };
  }
  return { isValid: true, cleanPhone };
};

/**
 * Kiểm tra Ngày sinh
 * @param {string} dob
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateDateOfBirth = (dob) => {
  if (!dob || !dob.toString().trim()) {
    return { isValid: true }; // Không bắt buộc
  }
  const trimmed = dob.toString().trim();
  let dateObj = null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    dateObj = new Date(trimmed);
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    dateObj = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
  } else {
    dateObj = new Date(trimmed);
  }

  if (isNaN(dateObj.getTime())) {
    return { isValid: false, message: 'Ngày sinh không hợp lệ' };
  }

  const now = new Date();
  if (dateObj > now) {
    return { isValid: false, message: 'Ngày sinh không thể là ngày tương lai' };
  }

  const age = now.getFullYear() - dateObj.getFullYear();
  if (age > 120) {
    return { isValid: false, message: 'Ngày sinh không hợp lệ (tuổi lớn hơn 120)' };
  }

  return { isValid: true };
};

/**
 * Kiểm tra Giới tính
 * @param {string} gender
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateGender = (gender) => {
  if (!gender || !gender.toString().trim()) {
    return { isValid: true };
  }
  const clean = gender.toString().trim();
  const valid = ALLOWED_GENDERS.some(g => g.toLowerCase() === clean.toLowerCase());
  if (!valid) {
    return { isValid: false, message: 'Giới tính phải là Nam, Nữ hoặc Khác' };
  }
  return { isValid: true };
};

/**
 * Kiểm tra Địa chỉ
 * @param {string} address
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateAddress = (address) => {
  if (!address || !address.toString().trim()) {
    return { isValid: true };
  }
  if (address.toString().trim().length > 200) {
    return { isValid: false, message: 'Địa chỉ không được vượt quá 200 ký tự' };
  }
  return { isValid: true };
};

/**
 * Kiểm tra Avatar
 * @param {string} avatar
 * @returns {{ isValid: boolean, message?: string }}
 */
export const validateAvatar = (avatar) => {
  if (!avatar || !avatar.toString().trim()) {
    return { isValid: true };
  }
  const clean = avatar.toString().trim();
  const isUrl = /^https?:\/\/.+/i.test(clean);
  const isDataUri = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(clean);
  if (!isUrl && !isDataUri) {
    return { isValid: false, message: 'Ảnh đại diện phải là link URL hợp lệ hoặc dữ liệu ảnh' };
  }
  return { isValid: true };
};

/**
 * Chuyển ngày sang định dạng hiển thị DD/MM/YYYY
 */
export const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Chuyển ngày sang định dạng input type="date" YYYY-MM-DD
 */
export const formatDateForInput = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

/**
 * Kiểm tra toàn bộ form chỉnh sửa tài khoản
 * @param {object} form
 * @returns {{ isValid: boolean, errors: object }}
 */
export const validateEditForm = (form = {}) => {
  const errors = {};

  const nameRes = validateFullName(form.name);
  if (!nameRes.isValid) errors.name = nameRes.message;

  if (form.phone) {
    const phoneRes = validatePhone(form.phone);
    if (!phoneRes.isValid) errors.phone = phoneRes.message;
  }

  if (form.dob) {
    const dobRes = validateDateOfBirth(form.dob);
    if (!dobRes.isValid) errors.dob = dobRes.message;
  }

  if (form.gender) {
    const genderRes = validateGender(form.gender);
    if (!genderRes.isValid) errors.gender = genderRes.message;
  }

  if (form.address) {
    const addressRes = validateAddress(form.address);
    if (!addressRes.isValid) errors.address = addressRes.message;
  }

  if (form.avatar) {
    const avatarRes = validateAvatar(form.avatar);
    if (!avatarRes.isValid) errors.avatar = avatarRes.message;
  }

  if (form.role !== undefined && form.role !== null && form.role !== '') {
    const roleRes = validateStaffRole(form.role);
    if (!roleRes.isValid) errors.role = roleRes.message;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
