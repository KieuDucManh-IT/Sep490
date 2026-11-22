import { useState, useEffect, useCallback } from 'react';
import {
  getGHNProvincesApi,
  getGHNNewProvincesApi,
  getGHNNewWardsApi,
  getGHNDistrictsApi,
  getGHNWardsApi,
  getGHNWardsByProvinceApi,
} from '../../../services/shippingApi';
import { autoMatchWard } from '../shippingUtils';

/**
 * Custom hook quản lý danh mục địa giới hành chính GHN (Hỗ trợ GHN v3 2-tier và fallback v2)
 * Gom chung logic tải Tỉnh/Thành -> tải gộp Phường/Xã trực thuộc -> auto-match địa chỉ
 */
export function useAdministrativeDivisions(enabled = true) {
  const [provinces, setProvinces] = useState([]);
  const [wards, setWards] = useState([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [wardCode, setWardCode] = useState('');

  // 1. Tải danh mục Tỉnh/Thành (ưu tiên GHN v3 mới nhất)
  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;

    getGHNNewProvincesApi()
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        if (list.length > 0) {
          const normalized = list.map((p) => ({
            ...p,
            _id: p._id || p.ProvinceID,
            ProvinceID: p._id || p.ProvinceID,
            name: p.name || p.ProvinceName,
            ProvinceName: p.name || p.ProvinceName,
          }));
          setProvinces(normalized);
          return;
        }
        throw new Error('Danh mục v3 trống, fallback v2');
      })
      .catch(() => {
        getGHNProvincesApi()
          .then((res) => {
            if (!isMounted) return;
            if (res?.success && Array.isArray(res.data)) {
              const normalized = res.data.map((p) => ({
                ...p,
                _id: p.ProvinceID,
                ProvinceID: p.ProvinceID,
                name: p.ProvinceName,
                ProvinceName: p.ProvinceName,
              }));
              setProvinces(normalized);
            }
          })
          .catch((err) => console.error('Lỗi tải danh mục Tỉnh/Thành:', err));
      });

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  // 2. Đổi Tỉnh -> Tải danh sách Phường/Xã (hỗ trợ cả GHN v3 và GHN v2)
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
        const isV3 = Number(pId) >= 1000000;

        if (isV3) {
          try {
            // GHN v3: Tải trực tiếp danh sách Phường/Xã mới theo provinceId
            const res = await getGHNNewWardsApi(pId);
            const rawList = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
            flattenedWards = rawList.map((w) => ({
              ...w,
              _id: w._id,
              name: w.name,
              WardCode: String(w._id),
              WardName: w.name,
              DistrictID: '',
              label: w.name,
              isNewAddress: true,
            }));
          } catch (v3Err) {
            console.warn('Lỗi tải Phường/Xã v3:', v3Err);
          }
        }

        // Fallback sang v2 nếu không phải v3 hoặc v3 không có dữ liệu
        if (flattenedWards.length === 0 && !isV3) {
          try {
            const res = await getGHNWardsByProvinceApi(pId);
            if (res?.success && Array.isArray(res.data)) {
              flattenedWards = res.data.map((w) => ({
                ...w,
                _id: w.WardCode,
                name: w.WardName,
                WardCode: String(w.WardCode),
                WardName: w.WardName,
                label: w.label || (w.DistrictName ? `${w.WardName} (${w.DistrictName})` : w.WardName),
              }));
            }
          } catch {
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
        }

        flattenedWards.sort((a, b) => (a.WardName || a.name || '').localeCompare(b.WardName || b.name || '', 'vi'));
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
            setWardCode(String(matchedWard.WardCode || matchedWard._id));
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
      const selected = wards.find((w) => String(w.WardCode || w._id) === String(wCode));
      if (selected?.DistrictID) {
        setDistrictId(String(selected.DistrictID));
      } else {
        setDistrictId('');
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
