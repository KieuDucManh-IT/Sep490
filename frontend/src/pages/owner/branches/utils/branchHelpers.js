import { PROVINCE_DEFAULT_COORDS } from './branchConstants';
import { parseOpeningHours, DAY_OPTIONS } from '../../../../components/OpeningHoursInput';

/**
 * Chuẩn hóa tên đơn vị hành chính tiếng Việt:
 * 1. Chuyển thành chữ thường
 * 2. Tách dấu thanh (NFD) và xóa dấu tiếng Việt
 * 3. Bỏ các tiền tố hành chính (thành phố, tỉnh, quận, huyện, xã, phường, thị xã...)
 * 4. Xóa khoảng trắng thừa ở hai đầu
 */
export function cleanName(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return '';
  }

  // Chuyển về chữ thường
  const lowerText = rawText.toLowerCase();

  // Bỏ dấu tiếng Việt
  const normalizedText = lowerText
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  // Xóa các tiền tố hành chính phổ biến
  const withoutPrefix = normalizedText.replace(
    /^(thanh pho|tinh|quan|huyen|thi xa|phuong|xa|thi tran|tp\.?)\s+/gi,
    ''
  );

  return withoutPrefix.trim();
}

/**
 * Tìm kiếm tọa độ trung tâm mặc định của một tỉnh/thành phố
 */
export function getProvinceCoords(provinceName) {
  if (!provinceName || typeof provinceName !== 'string') {
    return null;
  }

  const cleanedInput = cleanName(provinceName);

  // Duyệt qua danh sách tọa độ mặc định để tìm tỉnh tương ứng
  for (const [key, coords] of Object.entries(PROVINCE_DEFAULT_COORDS)) {
    const cleanedKey = cleanName(key);

    const isExactMatch = cleanedKey === cleanedInput;
    const isInputContainsProvince = cleanedInput.includes(cleanedKey);
    const isProvinceContainsInput = cleanedKey.includes(cleanedInput);

    if (isExactMatch || isInputContainsProvince || isProvinceContainsInput) {
      return coords;
    }
  }

  return null;
}

/**
 * Kiểm tra tính hợp lệ của toàn bộ form chi nhánh:
 * Viết theo từng bước rõ ràng, dễ hiểu.
 * Trả về object chứa lỗi của từng trường (nếu có).
 */
export function validateBranchForm(formData) {
  const errors = {};

  // 1. Kiểm tra Tên chi nhánh
  const trimmedName = (formData.name || '').trim();
  if (trimmedName.length === 0) {
    errors.name = 'Tên chi nhánh không được để trống.';
  } else if (trimmedName.length < 3) {
    errors.name = 'Tên chi nhánh quá ngắn, phải có ít nhất 3 ký tự.';
  } else if (trimmedName.length > 100) {
    errors.name = 'Tên chi nhánh không được vượt quá 100 ký tự.';
  }

  // 2. Kiểm tra Số điện thoại hotline
  const cleanPhone = (formData.phone || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/^\+84/, '0');
  const vietnamPhoneRegex = /^(0[35789])[0-9]{8}$/;

  if (cleanPhone.length === 0) {
    errors.phone = 'Hotline liên hệ là bắt buộc.';
  } else if (!vietnamPhoneRegex.test(cleanPhone)) {
    errors.phone = 'Số điện thoại không hợp lệ (cần 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09).';
  }

  // 3. Kiểm tra Tỉnh / Thành phố
  const selectedCity = (formData.city || '').trim();
  if (selectedCity.length === 0 || selectedCity === 'ALL') {
    errors.city = 'Vui lòng chọn Tỉnh / Thành phố.';
  }

  // 4. Kiểm tra Địa chỉ chi tiết
  const trimmedAddress = (formData.address || '').trim();
  if (trimmedAddress.length > 255) {
    errors.address = 'Địa chỉ chi tiết không được vượt quá 255 ký tự.';
  }

  // 5. Kiểm tra Tọa độ vị trí GPS
  const hasLatitude = formData.latitude !== null && formData.latitude !== undefined && formData.latitude !== '';
  const hasLongitude = formData.longitude !== null && formData.longitude !== undefined && formData.longitude !== '';

  if (!hasLatitude || !hasLongitude) {
    errors.coordinates = 'Vui lòng chọn vị trí cửa hàng trên bản đồ hoặc dùng nút lấy vị trí hiện tại.';
  } else {
    const latNumber = Number(formData.latitude);
    const lngNumber = Number(formData.longitude);

    const isLatitudeInvalid = isNaN(latNumber) || latNumber < -90 || latNumber > 90;
    const isLongitudeInvalid = isNaN(lngNumber) || lngNumber < -180 || lngNumber > 180;

    if (isLatitudeInvalid || isLongitudeInvalid) {
      errors.coordinates = 'Tọa độ vị trí không hợp lệ. Vui lòng chọn lại điểm trên bản đồ.';
    }
  }

  // 6. Kiểm tra Giờ mở cửa & Dải ngày trong tuần
  if (formData.openingHours) {
    const parsedHours = parseOpeningHours(formData.openingHours);

    // Kiểm tra giờ đóng cửa phải sau giờ mở cửa
    if (parsedHours.fromTime && parsedHours.toTime) {
      if (parsedHours.toTime <= parsedHours.fromTime) {
        errors.openingHours = 'Giờ đóng cửa phải sau giờ mở cửa.';
      }
    }

    // Kiểm tra thứ kết thúc phải sau hoặc cùng thứ bắt đầu
    if (parsedHours.fromDay && parsedHours.toDay) {
      const fromDayIndex = DAY_OPTIONS.indexOf(parsedHours.fromDay);
      const toDayIndex = DAY_OPTIONS.indexOf(parsedHours.toDay);

      if (fromDayIndex !== -1 && toDayIndex !== -1) {
        if (toDayIndex < fromDayIndex) {
          errors.openingHours = `Thứ kết thúc (${parsedHours.toDay}) phải sau hoặc cùng Thứ bắt đầu (${parsedHours.fromDay}) trong tuần.`;
        }
      }
    }
  }

  // 7. Kiểm tra Mô tả chi nhánh
  const trimmedDescription = (formData.description || '').trim();
  if (trimmedDescription.length > 0 && trimmedDescription.length < 10) {
    errors.description = 'Mô tả chi nhánh phải có ít nhất 10 ký tự.';
  } else if (trimmedDescription.length > 1000) {
    errors.description = 'Mô tả chi nhánh không được vượt quá 1000 ký tự.';
  }

  return errors;
}
