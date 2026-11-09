import { useState, useEffect, useCallback } from 'react';
import {
  getGHNProvincesApi,
  getGHNDistrictsApi,
  getGHNWardsApi,
  getGHNWardsByProvinceApi,
} from '../../../services/shippingApi';
import { autoMatchWard } from '../shippingUtils';

/**
 * Custom hook quản lý danh mục địa giới hành chính GHN
 * Gom chung logic tải Tỉnh/Thành -> tải gộp Phường/Xã trực thuộc -> auto-match địa chỉ
 */
export function useAdministrativeDivisions(enabled = true) {
  const [provinces, setProvinces] = useState([]);
  const [wards, setWards] = useState([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [wardCode, setWardCode] = useState('');

  // 1. Tải danh mục Tỉnh/Thành
  useEffect(() => {
    if (!enabled) return;
    getGHNProvincesApi()
      .then((res) => {
        if (res?.success && Array.isArray(res.data)) {
          setProvinces(res.data);
        }
      })
      .catch((err) => console.error('Lỗi tải danh mục Tỉnh/Thành:', err));
  }, [enabled]);

  // 2. Đổi Tỉnh -> Tải gộp danh sách Phường/Xã thuộc mọi Quận/Huyện của Tỉnh
  const handleProvinceChange = useCallback(
    async (
      provIdVal,
      wardHintToMatch = '',
      wardCodeHintToMatch = '',
      fullAddrToMatch = ''
    ) => {
      const pId = typeof provIdVal === 'object' && provIdVal?.target ? provIdVal.target.value : provIdVal;
      setProvinceId(pId ? String(pId) : '');
      setDistrictId('');
      setWardCode('');
      setWards([]);

      if (!pId) return;

      setLoadingWards(true);
      try {
        let flattenedWards = [];
        try {
          // Tải gộp toàn bộ Phường/Xã trong 1 request duy nhất có server cache 24h
          const res = await getGHNWardsByProvinceApi(pId);
          if (res?.success && Array.isArray(res.data)) {
            flattenedWards = res.data;
          }
        } catch {
          // Fallback an toàn nếu cần
          const distRes = await getGHNDistrictsApi(pId);
          if (distRes?.success && Array.isArray(distRes.data)) {
            for (const d of distRes.data) {
              try {
                const wRes = await getGHNWardsApi(d.DistrictID);
                if (wRes?.success && Array.isArray(wRes.data)) {
                  wRes.data.forEach((w) => {
                    flattenedWards.push({
                      WardCode: String(w.WardCode),
                      WardName: w.WardName,
                      DistrictID: d.DistrictID,
                      GovernmentCode: w.GovernmentCode ? String(w.GovernmentCode) : '',
                      NameExtension: Array.isArray(w.NameExtension) ? w.NameExtension : [],
                      label: `${w.WardName} (${d.DistrictName || ''})`,
                    });
                  });
                }
              } catch {}
            }
          }
        }

        flattenedWards.sort((a, b) => a.WardName.localeCompare(b.WardName, 'vi'));
        setWards(flattenedWards);

        // Khớp tự động Phường/Xã nếu có gợi ý
        if (wardHintToMatch || wardCodeHintToMatch || fullAddrToMatch) {
          const matchedWard = autoMatchWard(
            wardHintToMatch,
            wardCodeHintToMatch,
            fullAddrToMatch,
            flattenedWards
          );
          if (matchedWard) {
            setWardCode(String(matchedWard.WardCode));
            if (matchedWard.DistrictID) {
              setDistrictId(String(matchedWard.DistrictID));
            }
          }
        }
      } catch (err) {
        console.error('Lỗi tải danh mục Phường/Xã:', err);
      } finally {
        setLoadingWards(false);
      }
    },
    []
  );

  // 3. Chọn Phường/Xã
  const handleWardChange = useCallback(
    (wardCodeVal) => {
      const wCode = typeof wardCodeVal === 'object' && wardCodeVal?.target ? wardCodeVal.target.value : wardCodeVal;
      setWardCode(wCode ? String(wCode) : '');
      const selected = wards.find((w) => String(w.WardCode) === String(wCode));
      if (selected?.DistrictID) {
        setDistrictId(String(selected.DistrictID));
      }
    },
    [wards]
  );

  // 4. Reset trạng thái
  const resetDivisions = useCallback(() => {
    setProvinceId('');
    setDistrictId('');
    setWardCode('');
    setWards([]);
  }, []);

  return {
    provinces,
    wards,
    loadingWards,
    provinceId,
    setProvinceId,
    districtId,
    setDistrictId,
    wardCode,
    setWardCode,
    handleProvinceChange,
    handleWardChange,
    resetDivisions,
  };
}

