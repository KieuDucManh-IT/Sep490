import { resolveReverseGeocode } from '../shop/geoService.js';
import * as ghnService from './ghnService.js';

/**
 * Tính khoảng cách đường chim bay giữa 2 tọa độ GPS theo công thức Haversine (km)
 */
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const numLat1 = Number(lat1);
  const numLon1 = Number(lon1);
  const numLat2 = Number(lat2);
  const numLon2 = Number(lon2);

  if (isNaN(numLat1) || isNaN(numLon1) || isNaN(numLat2) || isNaN(numLon2)) return null;

  const R = 6371; // Bán kính Trái Đất (km)
  const dLat = ((numLat2 - numLat1) * Math.PI) / 180;
  const dLon = ((numLon2 - numLon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((numLat1 * Math.PI) / 180) *
      Math.cos((numLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

/**
 * Tìm Cửa hàng gần nhất với tọa độ của khách hàng
 */
export const findNearestStore = (customerCoords = {}, storeList = []) => {
  const { latitude, longitude } = customerCoords;
  if (!latitude || !longitude || !Array.isArray(storeList) || storeList.length === 0) {
    return null;
  }

  let nearestStore = null;
  let minDistance = Infinity;

  for (const store of storeList) {
    if (store.latitude && store.longitude) {
      const dist = calculateDistanceKm(latitude, longitude, store.latitude, store.longitude);
      if (dist !== null && dist < minDistance) {
        minDistance = dist;
        nearestStore = store;
      }
    }
  }

  return nearestStore ? { store: nearestStore, distanceKm: minDistance } : null;
};

/**
 * Chuẩn hóa xâu tiếng Việt không dấu để so khớp linh hoạt
 */
const cleanString = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(tp\.|t\.|h\.|q\.|p\.|tx\.|tt\.|xa|phuong|quan|huyen|thanh pho)\s+/i, '')
    .replace(/[\s\-_]/g, '');

/**
 * Tự động chuyển đổi Tọa độ GPS (Vĩ độ, Kinh độ) của Cửa hàng sang mã Tỉnh/Huyện/Xã GHN
 */
export const resolveGpsToGhn = async (latitude, longitude, fallbackInfo = {}) => {
  let matchedProvinceId = fallbackInfo.provinceId ? Number(fallbackInfo.provinceId) : null;
  let matchedDistrictId = fallbackInfo.districtId ? Number(fallbackInfo.districtId) : null;
  let matchedWardCode = fallbackInfo.wardCode ? String(fallbackInfo.wardCode) : '';

  // Nếu cửa hàng đã có sẵn đầy đủ mã GHN, trả về ngay
  if (matchedProvinceId && matchedDistrictId && matchedWardCode) {
    return {
      provinceId: matchedProvinceId,
      districtId: matchedDistrictId,
      wardCode: matchedWardCode,
    };
  }

  try {
    let geoCity = fallbackInfo.city || '';
    let geoDistrict = fallbackInfo.district || '';
    let geoWard = fallbackInfo.ward || '';

    // Nếu có tọa độ GPS -> Giải mã địa chỉ hành chính từ tọa độ
    if (latitude && longitude) {
      const geoRes = await resolveReverseGeocode(Number(latitude), Number(longitude));
      if (geoRes?.data) {
        geoCity = geoRes.data.city || geoCity;
        geoDistrict = geoRes.data.district || geoDistrict;
        geoWard = geoRes.data.ward || geoWard;
      }
    }

    // Kết hợp địa chỉ text để tăng độ chính xác so khớp
    const combinedAddress = `${fallbackInfo.address || ''} ${geoCity} ${geoDistrict} ${geoWard}`.toLowerCase();

    // 1. So khớp Tỉnh / Thành phố
    const provinces = await ghnService.getProvinces();
    if (!matchedProvinceId && Array.isArray(provinces)) {
      const cleanCity = cleanString(geoCity);
      const foundProv = provinces.find((p) => {
        const pClean = cleanString(p.ProvinceName);
        return (
          pClean === cleanCity ||
          cleanCity.includes(pClean) ||
          pClean.includes(cleanCity) ||
          (p.NameExtension && p.NameExtension.some((ext) => cleanString(ext) === cleanCity))
        );
      });

      if (foundProv) {
        matchedProvinceId = foundProv.ProvinceID;
      } else if (combinedAddress.includes('hồ chí minh') || combinedAddress.includes('hcm') || combinedAddress.includes('sài gòn')) {
        matchedProvinceId = 202; // TP.HCM
      } else {
        matchedProvinceId = 201; // Hà Nội
      }
    }

    // 2. So khớp Quận / Huyện theo Tỉnh
    if (!matchedDistrictId && matchedProvinceId) {
      const districts = await ghnService.getDistricts(matchedProvinceId);
      if (Array.isArray(districts) && districts.length > 0) {
        // Tìm theo tên quận
        const foundDist = districts.find((d) => {
          const dClean = cleanString(d.DistrictName);
          const extMatch = d.NameExtension && d.NameExtension.some((ext) => combinedAddress.includes(cleanString(ext)));
          return (
            (geoDistrict && (dClean === cleanString(geoDistrict) || cleanString(geoDistrict).includes(dClean))) ||
            combinedAddress.includes(dClean) ||
            extMatch
          );
        });

        if (foundDist) {
          matchedDistrictId = foundDist.DistrictID;
        }
      }
    }

    // 3. So khớp Phường / Xã theo Quận
    if (!matchedWardCode && matchedDistrictId) {
      const wards = await ghnService.getWards(matchedDistrictId);
      if (Array.isArray(wards) && wards.length > 0) {
        const foundWard = wards.find((w) => {
          const wClean = cleanString(w.WardName);
          const extMatch = w.NameExtension && w.NameExtension.some((ext) => combinedAddress.includes(cleanString(ext)));
          return (
            (geoWard && (wClean === cleanString(geoWard) || cleanString(geoWard).includes(wClean))) ||
            combinedAddress.includes(wClean) ||
            extMatch
          );
        });

        if (foundWard) {
          matchedWardCode = String(foundWard.WardCode);
        }
      }
    }
  } catch {
    // Không log lỗi ra console
  }

  return {
    provinceId: matchedProvinceId || null,
    districtId: matchedDistrictId || null,
    wardCode: matchedWardCode || null,
  };
};

