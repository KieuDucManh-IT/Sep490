import { useState, useEffect, useRef, useCallback } from 'react';
import { FALLBACK_PROVINCES } from '../utils/branchConstants';

export function useProvincesWards() {
  const [provinces, setProvinces] = useState([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);

  const [wards, setWards] = useState([]);
  const [loadingWards, setLoadingWards] = useState(false);

  // Bộ nhớ đệm lưu danh sách phường theo mã tỉnh: { [provinceCode]: wardList }
  const wardCache = useRef({});

  useEffect(() => {
    let isMounted = true;
    setLoadingProvinces(true);

    fetch('https://provinces.open-api.vn/api/v2/p/')
      .then((res) => {
        if (!res.ok) throw new Error('Network response error');
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setProvinces(Array.isArray(data) && data.length > 0 ? data : FALLBACK_PROVINCES);
        }
      })
      .catch(() => {
        if (isMounted) setProvinces(FALLBACK_PROVINCES);
      })
      .finally(() => {
        if (isMounted) setLoadingProvinces(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchWardsByProvince = useCallback(async (provinceName, provinceOption) => {
    const currentProvinces = provinces.length > 0 ? provinces : FALLBACK_PROVINCES;

    let provinceCode = null;
    if (provinceOption && provinceOption.code) {
      provinceCode = provinceOption.code;
    } else {
      const matched = currentProvinces.find((p) => p.name === provinceName);
      if (matched) {
        provinceCode = matched.code;
      }
    }

    if (!provinceCode) {
      setWards([]);
      return [];
    }

    // Trả về từ cache nếu tỉnh đã từng được tải
    if (wardCache.current[provinceCode]) {
      const cachedWards = wardCache.current[provinceCode];
      setWards(cachedWards);
      return cachedWards;
    }

    setLoadingWards(true);
    try {
      const response = await fetch(`https://provinces.open-api.vn/api/v2/p/${provinceCode}?depth=2`);
      const data = await response.json();
      const wardList = data?.wards || [];

      wardCache.current[provinceCode] = wardList;
      setWards(wardList);
      return wardList;
    } catch {
      setWards([]);
      return [];
    } finally {
      setLoadingWards(false);
    }
  }, [provinces]);

  return {
    provinces,
    wards,
    setWards,
    loadingProvinces,
    loadingWards,
    fetchWardsByProvince,
  };
}
