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
    .replace(/đ/gi, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(tp\.?|t\.?|h\.?|q\.?|p\.?|tx\.?|tt\.?|xa|phuong|quan|huyen|thanh pho)\s+/i, '')
    .replace(/[\s\-_,.]/g, '');

const normalizeRawAscii = (str) =>
  String(str || '')
    .replace(/đ/gi, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Tự động chuyển đổi Tọa độ GPS (Vĩ độ, Kinh độ) của Cửa hàng sang mã Tỉnh/Huyện/Xã GHN
 * Hỗ trợ chuyển đổi mã v3 (1000000 Hà Nội) sang v2 phục vụ truy vấn quận huyện
 */
export const resolveGpsToGhn = async (latitude, longitude, fallbackInfo = {}) => {
  const rawProvId = fallbackInfo.provinceId ? Number(fallbackInfo.provinceId) : null;
  let matchedProvinceId = rawProvId && rawProvId >= 1000000
    ? (rawProvId === 1000000 ? 201 : null)
    : rawProvId;
  let matchedDistrictId = fallbackInfo.districtId ? Number(fallbackInfo.districtId) : null;
  let matchedWardCode = fallbackInfo.wardCode ? String(fallbackInfo.wardCode) : '';
  let matchedDistrictName = fallbackInfo.districtName || '';

  // Nếu cửa hàng đã có sẵn đầy đủ mã GHN, trả về ngay
  if (matchedProvinceId && matchedDistrictId && matchedWardCode) {
    return {
      provinceId: matchedProvinceId,
      districtId: matchedDistrictId,
      wardCode: matchedWardCode,
      districtName: matchedDistrictName,
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

    // Kết hợp địa chỉ text (đã chuẩn hóa không dấu + đ -> d) để so khớp chính xác
    const combinedRaw = `${fallbackInfo.address || ''} ${geoCity} ${geoDistrict} ${geoWard}`;
    const cleanCombined = cleanString(combinedRaw);

    // 1. So khớp Tỉnh / Thành phố
    const provinces = await ghnService.getProvinces();
    if (!matchedProvinceId && Array.isArray(provinces)) {
      const cleanCity = cleanString(geoCity);
      let foundProv = cleanCity
        ? provinces.find((p) => {
            const pClean = cleanString(p.ProvinceName);
            const extMatch =
              Array.isArray(p.NameExtension) &&
              p.NameExtension.some((ext) => {
                const extClean = cleanString(ext);
                return extClean && extClean === cleanCity;
              });
            return (
              pClean === cleanCity ||
              (pClean.length > 2 && cleanCity.length > 2 && (cleanCity.includes(pClean) || pClean.includes(cleanCity))) ||
              extMatch
            );
          })
        : null;

      if (!foundProv && cleanCombined) {
        foundProv = provinces.find((p) => {
          const pClean = cleanString(p.ProvinceName);
          return pClean.length > 2 && cleanCombined.includes(pClean);
        });
      }

      if (foundProv) {
        matchedProvinceId = foundProv.ProvinceID;
      } else if (cleanCombined.includes('hochiminh') || cleanCombined.includes('tphcm') || cleanCombined.includes('saigon')) {
        matchedProvinceId = 202; // TP.HCM
      } else if (cleanCombined.includes('hanoi')) {
        matchedProvinceId = 201; // Hà Nội
      }
    }

    // Ánh xạ provinceId v3 sang v2 để tra cứu District GHN (Hà Nội v3 là 1000000 -> v2 là 201)
    const v2ProvinceId = matchedProvinceId === 1000000 ? 201 : matchedProvinceId;

    // 2. So khớp Quận / Huyện theo Tỉnh
    if (!matchedDistrictId && v2ProvinceId) {
      try {
        const districts = await ghnService.getDistricts(v2ProvinceId);
        if (Array.isArray(districts) && districts.length > 0) {
          const cleanGeoDist = cleanString(geoDistrict);
          const combinedSpaced = ` ${normalizeRawAscii(combinedRaw)} `;
          const foundDist = districts.find((d) => {
            const dClean = cleanString(d.DistrictName);
            const dFullAscii = normalizeRawAscii(d.DistrictName);
            const fullPhraseMatch = dFullAscii.length > 2 && combinedSpaced.includes(` ${dFullAscii} `);
            const extMatch =
              Array.isArray(d.NameExtension) &&
              d.NameExtension.some((ext) => {
                const extClean = cleanString(ext);
                return extClean.length > 2 && cleanCombined.includes(extClean);
              });
            return (
              (cleanGeoDist && dClean && (dClean === cleanGeoDist || (dClean.length > 2 && cleanGeoDist.includes(dClean)))) ||
              (dClean.length > 2 && cleanCombined.includes(dClean)) ||
              fullPhraseMatch ||
              extMatch
            );
          });

          if (foundDist) {
            matchedDistrictId = foundDist.DistrictID;
            matchedDistrictName = foundDist.DistrictName;
          }
        }
      } catch {}
    }

    // 2.1 Tra cứu Quận/Huyện từ Phường/Xã (nếu có xã mà chưa xác định được quận)
    if (!matchedDistrictId && v2ProvinceId && (geoWard || fallbackInfo.ward || fallbackInfo.wardCode)) {
      try {
        const provWards = await ghnService.getWardsByProvince(v2ProvinceId);
        if (Array.isArray(provWards) && provWards.length > 0) {
          const targetWard = cleanString(geoWard || fallbackInfo.ward);
          const targetCode = String(fallbackInfo.wardCode || '').trim().toLowerCase();
          const foundWard = provWards.find((w) => {
            const wName = cleanString(w.WardName);
            const wCode = String(w.WardCode || '').toLowerCase();
            return (
              (targetCode && wCode === targetCode) ||
              (targetWard && wName && (wName === targetWard || (targetWard.length > 2 && wName.length > 2 && (targetWard.includes(wName) || wName.includes(targetWard)))))
            );
          });
          if (foundWard) {
            matchedDistrictId = foundWard.DistrictID;
            matchedDistrictName = foundWard.DistrictName;
            if (!matchedWardCode) matchedWardCode = String(foundWard.WardCode);
          }
        }
      } catch {}
    }

    // Fallback cho Hà Nội nếu chưa xác định được District
    if (
      !matchedDistrictId &&
      (v2ProvinceId === 201 || matchedProvinceId === 1000000)
    ) {
      matchedDistrictId = 1488; // Ba Đình, Hà Nội
      matchedDistrictName = 'Quận Ba Đình';
    }

    // 3. So khớp Phường / Xã theo Quận (v2)
    if (!matchedWardCode && matchedDistrictId) {
      try {
        const wards = await ghnService.getWards(matchedDistrictId);
        if (Array.isArray(wards) && wards.length > 0) {
          const cleanGeoWard = cleanString(geoWard);
          const foundWard = wards.find((w) => {
            const wClean = cleanString(w.WardName);
            const extMatch =
              Array.isArray(w.NameExtension) &&
              w.NameExtension.some((ext) => {
                const extClean = cleanString(ext);
                return extClean.length > 2 && cleanCombined.includes(extClean);
              });
            return (
              (cleanGeoWard && wClean && (wClean === cleanGeoWard || (wClean.length > 2 && cleanGeoWard.includes(wClean)))) ||
              (wClean.length > 2 && cleanCombined.includes(wClean)) ||
              extMatch
            );
          });

          if (foundWard) {
            matchedWardCode = String(foundWard.WardCode);
          }
        }
      } catch {}
    }
  } catch {
    // Không log lỗi ra console
  }

  return {
    provinceId: matchedProvinceId || null,
    districtId: matchedDistrictId || null,
    wardCode: matchedWardCode || null,
    districtName: matchedDistrictName || '',
  };
};
