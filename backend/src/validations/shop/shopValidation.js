import mongoose from 'mongoose';

/**
 * Helper to construct an Error object augmented with an HTTP status code
 */
export const validationError = (message, statusCode = 400) => {
  return Object.assign(new Error(message), { statusCode });
};

/**
 * Validate MongoDB ObjectId
 */
export const validateObjectId = (value, fieldName = 'id') => {
  if (!value || !mongoose.isValidObjectId(value)) {
    throw validationError(`Mã ${fieldName} không hợp lệ.`, 400);
  }
};

/**
 * Validate and normalize Vietnamese telephone numbers
 */
export const validatePhone = (phone, required = true) => {
  if (!phone) {
    if (required) {
      throw validationError('Số điện thoại không được để trống.', 400);
    }
    return '';
  }

  const cleanPhone = String(phone).trim().replace(/\s+/g, '').replace(/^\+84/, '0');
  const phoneRegex = /^(0[35789])[0-9]{8}$/;

  if (!phoneRegex.test(cleanPhone)) {
    throw validationError('Số điện thoại không hợp lệ (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09).', 400);
  }

  return cleanPhone;
};

/**
 * Validate latitude and longitude geographic coordinates
 */
export const validateCoordinates = (latitude, longitude, required = false) => {
  let validLat = null;
  let validLng = null;

  const hasLat = latitude !== undefined && latitude !== null && latitude !== '';
  const hasLng = longitude !== undefined && longitude !== null && longitude !== '';

  if (required && (!hasLat || !hasLng)) {
    throw validationError('Tọa độ GPS (Vĩ độ và Kinh độ) là bắt buộc.', 400);
  }

  if (hasLat) {
    const pLat = Number(latitude);
    if (isNaN(pLat) || pLat < -90 || pLat > 90) {
      throw validationError('Vĩ độ (Latitude) không hợp lệ (phải từ -90 đến 90).', 400);
    }
    validLat = pLat;
  }

  if (hasLng) {
    const pLng = Number(longitude);
    if (isNaN(pLng) || pLng < -180 || pLng > 180) {
      throw validationError('Kinh độ (Longitude) không hợp lệ (phải từ -180 đến 180).', 400);
    }
    validLng = pLng;
  }

  return { latitude: validLat, longitude: validLng };
};

/**
 * Validate payload for creating a new branch
 */
export const validateCreateBranchInput = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('Dữ liệu yêu cầu phải là một object.', 400);
  }

  const {
    name,
    description,
    phone,
    address,
    city,
    ward,
    latitude,
    longitude,
    imageUrl,
    bannerUrl,
    openingHours,
    managerId,
    isHQ = false,
    ownerId,
  } = body;

  const trimmedName = name?.trim();
  if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 100) {
    throw validationError('Tên chi nhánh là bắt buộc và phải từ 3 đến 100 ký tự.', 400);
  }

  const cleanPhone = validatePhone(phone, true);

  if (!city || !city.trim()) {
    throw validationError('Tỉnh/Thành phố của chi nhánh là bắt buộc.', 400);
  }

  const coords = validateCoordinates(latitude, longitude, false);

  const trimmedAddress = address ? address.trim() : '';
  if (trimmedAddress.length > 255) {
    throw validationError('Địa chỉ gian hàng không được vượt quá 255 ký tự.', 400);
  }

  if (managerId && managerId !== 'null' && managerId !== 'none') {
    validateObjectId(managerId, 'người quản lý (managerId)');
  }

  if (ownerId) {
    validateObjectId(ownerId, 'chủ sở hữu (ownerId)');
  }

  return {
    name: trimmedName,
    description: description?.trim() || 'Cửa hàng thời trang dạ tiệc và thiết kế cao cấp Vestora.',
    phone: cleanPhone,
    address: trimmedAddress,
    city: city.trim(),
    ward: ward ? ward.trim() : '',
    latitude: coords.latitude,
    longitude: coords.longitude,
    imageUrl: imageUrl?.trim() || '',
    bannerUrl: bannerUrl?.trim() || '',
    openingHours: openingHours?.trim() || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
    isHQ: Boolean(isHQ),
    managerId: (managerId && managerId !== 'null' && managerId !== 'none') ? managerId : null,
    ownerId: ownerId || null,
  };
};

/**
 * Validate payload for updating branch store address and GPS
 */
export const validateUpdateShopAddressInput = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('Dữ liệu yêu cầu phải là một object.', 400);
  }

  const { address, city, ward, latitude, longitude, phone } = body;

  if (!city || !city.trim()) {
    throw validationError('Tỉnh/Thành phố là bắt buộc.', 400);
  }

  const trimmedAddress = address ? address.trim() : '';
  if (trimmedAddress.length > 255) {
    throw validationError('Địa chỉ gian hàng không được vượt quá 255 ký tự.', 400);
  }

  const coords = validateCoordinates(latitude, longitude, false);

  let cleanPhone = undefined;
  if (phone !== undefined && phone !== null && phone !== '') {
    cleanPhone = validatePhone(phone, false);
  }

  return {
    address: trimmedAddress,
    city: city.trim(),
    ward: ward ? ward.trim() : '',
    latitude: coords.latitude,
    longitude: coords.longitude,
    phone: cleanPhone,
  };
};

/**
 * Validate partial payload for updating branch store information
 */
export const validateUpdateShopInfoInput = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError('Dữ liệu yêu cầu phải là một object.', 400);
  }

  const result = {};

  if (body.name !== undefined) {
    const trimmed = body.name?.trim();
    if (!trimmed || trimmed.length < 3 || trimmed.length > 100) {
      throw validationError('Tên gian hàng phải từ 3 đến 100 ký tự.', 400);
    }
    result.name = trimmed;
  }

  if (body.description !== undefined) {
    const trimmed = body.description?.trim();
    if (!trimmed || trimmed.length < 10 || trimmed.length > 1000) {
      throw validationError('Mô tả gian hàng phải từ 10 đến 1000 ký tự.', 400);
    }
    result.description = trimmed;
  }

  if (body.phone !== undefined) {
    result.phone = validatePhone(body.phone, true);
  }

  if (body.address !== undefined) {
    const trimmed = body.address ? body.address.trim() : '';
    if (trimmed.length > 255) {
      throw validationError('Địa chỉ gian hàng không được vượt quá 255 ký tự.', 400);
    }
    result.address = trimmed;
  }

  if (body.city !== undefined) {
    result.city = body.city ? body.city.trim() : '';
  }

  if (body.ward !== undefined) {
    result.ward = body.ward ? body.ward.trim() : '';
  }

  if (body.latitude !== undefined || body.longitude !== undefined) {
    const coords = validateCoordinates(body.latitude, body.longitude, false);
    if (body.latitude !== undefined) result.latitude = coords.latitude;
    if (body.longitude !== undefined) result.longitude = coords.longitude;
  }

  if (body.imageUrl !== undefined) {
    result.imageUrl = body.imageUrl?.trim() || '';
  }

  if (body.bannerUrl !== undefined) {
    result.bannerUrl = body.bannerUrl?.trim() || '';
  }

  if (body.openingHours !== undefined) {
    result.openingHours = body.openingHours?.trim() || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)';
  }

  if (body.status !== undefined) {
    const s = String(body.status).toUpperCase();
    if (!['ACTIVE', 'SUSPENDED'].includes(s)) {
      throw validationError('Trạng thái chỉ có thể là ACTIVE hoặc SUSPENDED.', 400);
    }
    result.status = s;
  }

  if (body.isHQ !== undefined) {
    result.isHQ = Boolean(body.isHQ);
  }

  if (body.managerId !== undefined) {
    if (!body.managerId || body.managerId === 'null' || body.managerId === 'none') {
      result.managerId = null;
    } else {
      validateObjectId(body.managerId, 'người quản lý (managerId)');
      result.managerId = body.managerId;
    }
  }

  return result;
};

/**
 * Validate operating status transitions
 */
export const validateOperatingStatus = (status) => {
  const allowed = ['ACTIVE', 'SUSPENDED', 'PENDING', 'REJECTED'];
  if (!status || !allowed.includes(String(status).toUpperCase())) {
    throw validationError(`Trạng thái không hợp lệ. Cho phép: ${allowed.join(', ')}`, 400);
  }
  return String(status).toUpperCase();
};

/**
 * Validate reverse geocode query parameters
 */
export const validateReverseGeocodeQuery = (query) => {
  const { lat, lng, latitude, longitude } = query || {};
  const targetLat = parseFloat(lat || latitude);
  const targetLng = parseFloat(lng || longitude);

  if (
    isNaN(targetLat) ||
    isNaN(targetLng) ||
    targetLat < -90 ||
    targetLat > 90 ||
    targetLng < -180 ||
    targetLng > 180
  ) {
    throw validationError('Tọa độ không hợp lệ (Vĩ độ phải từ -90 đến 90, Kinh độ từ -180 đến 180).', 400);
  }

  return { targetLat, targetLng };
};

