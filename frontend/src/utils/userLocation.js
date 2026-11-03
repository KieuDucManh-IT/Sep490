import { PROVINCE_DEFAULT_COORDS } from '../pages/owner/branches/utils/branchConstants';

const STORAGE_KEY = 'vestora_user_location';

export const DEFAULT_USER_LOCATION = {
  city: 'Thành phố Hà Nội',
  shortCity: 'Hà Nội',
  latitude: 21.028511,
  longitude: 105.854167,
  isExactGps: false,
};

/**
 * Đọc thông tin vị trí người dùng đã lưu từ localStorage
 */
export const getUserLocation = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_USER_LOCATION;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.city) return DEFAULT_USER_LOCATION;
    return {
      ...DEFAULT_USER_LOCATION,
      ...parsed,
    };
  } catch (_e) {
    return DEFAULT_USER_LOCATION;
  }
};

/**
 * Lưu thông tin vị trí mới và phát sự kiện đồng bộ toàn ứng dụng
 */
export const setUserLocation = (locationData) => {
  try {
    const current = getUserLocation();
    const city = locationData?.city || current.city;
    const shortCity = city.replace(/^(Thành phố|Tỉnh)\s+/i, '');

    const coords =
      locationData?.latitude != null && locationData?.longitude != null
        ? {
            latitude: parseFloat(locationData.latitude),
            longitude: parseFloat(locationData.longitude),
          }
        : PROVINCE_DEFAULT_COORDS[city] ||
          PROVINCE_DEFAULT_COORDS[shortCity] || {
            latitude: DEFAULT_USER_LOCATION.latitude,
            longitude: DEFAULT_USER_LOCATION.longitude,
          };

    const payload = {
      city,
      shortCity,
      latitude: coords.latitude || coords.lat,
      longitude: coords.longitude || coords.lng,
      isExactGps: Boolean(locationData?.isExactGps),
      updatedAt: Date.now(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    window.dispatchEvent(new Event('userLocationChanged'));
    return payload;
  } catch (_e) {
    return DEFAULT_USER_LOCATION;
  }
};
