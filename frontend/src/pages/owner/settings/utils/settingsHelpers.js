import { parseOpeningHours, DAY_OPTIONS } from '../../../../components/OpeningHoursInput';

export const INITIAL_SETTINGS_FORM_DATA = {
  name: '',
  description: '',
  phone: '',
  address: '',
  city: '',
  ward: '',
  latitude: '',
  longitude: '',
  bannerUrl: '',
  imageUrl: '',
  openingHours: '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
  isOpen: true,
};

/**
 * Kiểm tra tính hợp lệ của dữ liệu form cài đặt gian hàng:
 * Xử lý tuần tự từng bước, câu lệnh điều kiện rõ ràng và dễ bảo trì.
 */
export function validateShopSettingsForm(formData) {
  const errors = {};

  // 1. Kiểm tra Tên gian hàng / cửa hàng
  const trimmedName = (formData.name || '').trim();
  if (trimmedName.length === 0) {
    errors.name = 'Tên gian hàng là bắt buộc.';
  } else if (trimmedName.length < 3 || trimmedName.length > 100) {
    errors.name = 'Tên gian hàng phải từ 3 đến 100 ký tự.';
  }

  // 2. Kiểm tra Số điện thoại Hotline
  const cleanPhone = (formData.phone || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/^\+84/, '0');
  const vietnamPhoneRegex = /^(0[35789])[0-9]{8}$/;

  if (cleanPhone.length === 0) {
    errors.phone = 'Hotline liên hệ là bắt buộc.';
  } else if (!vietnamPhoneRegex.test(cleanPhone)) {
    errors.phone = 'Số điện thoại không hợp lệ (cần 10 số, bắt đầu bằng 03, 05, 07, 08, 09).';
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
    errors.coordinates = 'Vui lòng xác định vị trí GPS (bằng nút định vị hoặc click ghim trên bản đồ).';
  } else {
    const latNumber = Number(formData.latitude);
    const lngNumber = Number(formData.longitude);

    const isLatitudeInvalid = isNaN(latNumber) || latNumber < -90 || latNumber > 90;
    const isLongitudeInvalid = isNaN(lngNumber) || lngNumber < -180 || lngNumber > 180;

    if (isLatitudeInvalid || isLongitudeInvalid) {
      errors.coordinates = 'Tọa độ GPS không hợp lệ (Vĩ độ: -90 đến 90, Kinh độ: -180 đến 180).';
    }
  }

  // 6. Kiểm tra Giờ mở cửa
  if (formData.openingHours) {
    const parsedHours = parseOpeningHours(formData.openingHours);

    if (parsedHours.fromTime && parsedHours.toTime && parsedHours.toTime <= parsedHours.fromTime) {
      errors.openingHours = 'Giờ đóng cửa phải sau giờ mở cửa.';
    } else if (parsedHours.fromDay && parsedHours.toDay) {
      const fromDayIndex = DAY_OPTIONS.indexOf(parsedHours.fromDay);
      const toDayIndex = DAY_OPTIONS.indexOf(parsedHours.toDay);

      if (fromDayIndex !== -1 && toDayIndex !== -1 && toDayIndex < fromDayIndex) {
        errors.openingHours = `Thứ kết thúc (${parsedHours.toDay}) phải sau hoặc cùng Thứ bắt đầu (${parsedHours.fromDay}) trong tuần.`;
      }
    }
  }

  // 7. Kiểm tra Mô tả gian hàng
  const trimmedDescription = (formData.description || '').trim();
  if (trimmedDescription.length > 0 && (trimmedDescription.length < 10 || trimmedDescription.length > 1000)) {
    errors.description = 'Mô tả gian hàng phải từ 10 đến 1000 ký tự (hoặc để trống để dùng mô tả mặc định).';
  }

  return errors;
}
