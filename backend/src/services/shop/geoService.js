const GEO_CACHE = new Map();
const MAX_GEO_CACHE_SIZE = 500;
const GEO_CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const getCachedGeo = (lat, lng) => {
  const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
  const entry = GEO_CACHE.get(cacheKey);

  if (!entry) {
    return null;
  }

  const isExpired = Date.now() - entry.timestamp > GEO_CACHE_TTL_MS;
  if (isExpired) {
    GEO_CACHE.delete(cacheKey);
    return null;
  }

  return entry.data;
};

const setCachedGeo = (lat, lng, data) => {
  const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}`;

  if (GEO_CACHE.size >= MAX_GEO_CACHE_SIZE) {
    const oldestKey = GEO_CACHE.keys().next().value;
    if (oldestKey) {
      GEO_CACHE.delete(oldestKey);
    }
  }

  GEO_CACHE.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
};

/**
 * Giải mã tọa độ GPS sang địa chỉ hành chính Việt Nam với 3 tầng dịch vụ dự phòng
 * @param {number} targetLat - Vĩ độ (-90 đến 90)
 * @param {number} targetLng - Kinh độ (-180 đến 180)
 * @returns {Promise<{ source: string, data: object }>}
 */
export const resolveReverseGeocode = async (targetLat, targetLng) => {
  // 1. Kiểm tra bộ nhớ đệm trước
  const cachedData = getCachedGeo(targetLat, targetLng);
  if (cachedData) {
    return {
      source: 'cache',
      data: {
        ...cachedData,
        latitude: targetLat,
        longitude: targetLng,
      },
    };
  }

  // 2. Tầng 1: Dịch vụ BigDataCloud (tối ưu tiếng Việt, độ trễ thấp)
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${targetLat}&longitude=${targetLng}&localityLanguage=vi`;
    const bdcRes = await fetch(bdcUrl, { signal: AbortSignal.timeout(3500) });

    if (bdcRes.ok) {
      const responseData = await bdcRes.json();
      const city = responseData.principalSubdivision || responseData.city || '';
      const ward = responseData.locality || '';

      if (city) {
        const payload = {
          latitude: targetLat,
          longitude: targetLng,
          city,
          ward,
          district: responseData.locality || '',
          country: responseData.countryName || 'Việt Nam',
        };

        setCachedGeo(targetLat, targetLng, payload);
        return {
          source: 'bigdatacloud',
          data: payload,
        };
      }
    }
  } catch (_err) {
    // Chuyển sang tầng tiếp theo
  }

  // 3. Tầng 2: Dịch vụ Photon Komoot
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${targetLat}&lon=${targetLng}`;
    const photonRes = await fetch(photonUrl, { signal: AbortSignal.timeout(3500) });

    if (photonRes.ok) {
      const photonData = await photonRes.json();
      const properties = photonData?.features?.[0]?.properties;

      if (properties) {
        const city = properties.city || properties.state || properties.county || '';
        const ward = properties.district || properties.locality || properties.name || '';
        const street = [properties.housenumber, properties.street].filter(Boolean).join(' ');

        if (city) {
          const payload = {
            latitude: targetLat,
            longitude: targetLng,
            city,
            ward,
            district: properties.district || '',
            street,
            country: properties.country || 'Việt Nam',
          };

          setCachedGeo(targetLat, targetLng, payload);
          return {
            source: 'photon',
            data: payload,
          };
        }
      }
    }
  } catch (_err) {
    // Chuyển sang tầng tiếp theo
  }

  // 4. Tầng 3: Dịch vụ OpenStreetMap Nominatim
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${targetLat}&lon=${targetLng}&format=json&accept-language=vi`;
    const nominatimRes = await fetch(nominatimUrl, {
      signal: AbortSignal.timeout(3500),
      headers: {
        'User-Agent': 'Vestora-Platform/1.0 (contact: admin@vestora.vn)',
        Accept: 'application/json',
      },
    });

    if (nominatimRes.ok) {
      const nominatimData = await nominatimRes.json();
      const address = nominatimData?.address;

      if (address) {
        const city = address.city || address.state || address.province || address.county || '';
        const ward = address.suburb || address.quarter || address.neighbourhood || address.village || '';
        const street = [address.house_number, address.road].filter(Boolean).join(' ');

        const payload = {
          latitude: targetLat,
          longitude: targetLng,
          city,
          ward,
          district: address.city_district || address.district || '',
          street,
          country: address.country || 'Việt Nam',
        };

        setCachedGeo(targetLat, targetLng, payload);
        return {
          source: 'nominatim',
          data: payload,
        };
      }
    }
  } catch (_err) {
    // Chuyển sang tầng tiếp theo
  }

  // 5. Tầng cuối cùng: Trả về tọa độ ban đầu khi ngoại tuyến
  return {
    source: 'fallback',
    data: {
      latitude: targetLat,
      longitude: targetLng,
      city: '',
      ward: '',
      district: '',
      street: '',
    },
  };
};
