/**
 * User validation utilities for VESTORA backend
 * Có thể tái sử dụng cho Auth, User Controller, Profile Controller, Admin Management...
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

export const ALLOWED_GENDERS = ['Nam', 'Nữ', 'Khác', 'male', 'female', 'other'];

/**
 * Kiểm tra Họ và tên
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
 */
export const validatePhone = (phone) => {
  if (!phone || !phone.toString().trim()) {
    return { isValid: true }; // Cho phép để trống
  }
  const cleanPhone = phone.toString().trim().replace(/[\s.-]/g, '');
  if (!VN_PHONE_REGEX.test(cleanPhone)) {
    return { isValid: false, message: 'Số điện thoại không hợp lệ (cần 10 chữ số, ví dụ: 0912345678)' };
  }
  return { isValid: true, cleanPhone };
};

/**
 * Kiểm tra Ngày sinh
 */
export const validateDateOfBirth = (dob) => {
  if (!dob || !dob.toString().trim()) {
    return { isValid: true }; // Cho phép để trống
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
    return { isValid: false, message: 'Ngày sinh không đúng định dạng hợp lệ' };
  }

  const now = new Date();
  if (dateObj > now) {
    return { isValid: false, message: 'Ngày sinh không thể là ngày trong tương lai' };
  }

  const age = now.getFullYear() - dateObj.getFullYear();
  if (age > 120) {
    return { isValid: false, message: 'Ngày sinh không hợp lệ (tuổi vượt quá 120)' };
  }

  return { isValid: true };
};

/**
 * Kiểm tra Giới tính
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
 * Kiểm tra Avatar (URL hoặc Base64 data URI)
 */
export const validateAvatar = (avatar) => {
  if (!avatar || !avatar.toString().trim()) {
    return { isValid: true };
  }
  const clean = avatar.toString().trim();
  const isUrl = /^https?:\/\/.+/i.test(clean);
  const isDataUri = /^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,/i.test(clean);
  if (!isUrl && !isDataUri) {
    return { isValid: false, message: 'Ảnh đại diện phải là đường dẫn URL hợp lệ hoặc dữ liệu ảnh base64' };
  }
  return { isValid: true };
};

/**
 * Kiểm tra Vai trò (Role)
 */
export const validateRole = (role) => {
  if (!role) return { isValid: true };
  const clean = role.toString().trim().toLowerCase().replace(/[_\s-]/g, '');
  const matched = ALLOWED_ROLES.some(r => r.toLowerCase().replace(/[_\s-]/g, '') === clean);
  if (!matched) {
    return { isValid: false, message: `Vai trò không hợp lệ. Cho phép: ${ALLOWED_ROLES.join(', ')}` };
  }
  return { isValid: true };
};

/**
 * Xác thực toàn diện cho cập nhật người dùng (Update User)
 */
export const validateUserUpdate = (data = {}) => {
  const errors = {};

  if (data.FullName !== undefined) {
    const res = validateFullName(data.FullName);
    if (!res.isValid) errors.FullName = res.message;
  }

  if (data.Phone !== undefined) {
    const res = validatePhone(data.Phone);
    if (!res.isValid) errors.Phone = res.message;
  }

  if (data.DateOfBirth !== undefined) {
    const res = validateDateOfBirth(data.DateOfBirth);
    if (!res.isValid) errors.DateOfBirth = res.message;
  }

  if (data.Gender !== undefined) {
    const res = validateGender(data.Gender);
    if (!res.isValid) errors.Gender = res.message;
  }

  if (data.Address !== undefined) {
    const res = validateAddress(data.Address);
    if (!res.isValid) errors.Address = res.message;
  }

  if (data.Avatar !== undefined) {
    const res = validateAvatar(data.Avatar);
    if (!res.isValid) errors.Avatar = res.message;
  }

  if (data.Role !== undefined) {
    const res = validateRole(data.Role);
    if (!res.isValid) errors.Role = res.message;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * Xác thực toàn diện khi tạo mới người dùng (Create User)
 */
export const validateUserCreate = (data = {}) => {
  const errors = {};

  const nameRes = validateFullName(data.FullName);
  if (!nameRes.isValid) errors.FullName = nameRes.message;

  const emailRes = validateEmail(data.Email);
  if (!emailRes.isValid) errors.Email = emailRes.message;

  if (data.Phone) {
    const phoneRes = validatePhone(data.Phone);
    if (!phoneRes.isValid) errors.Phone = phoneRes.message;
  }

  if (data.Role) {
    const roleRes = validateRole(data.Role);
    if (!roleRes.isValid) errors.Role = roleRes.message;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
