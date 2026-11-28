import { useState, useEffect, useCallback } from 'react';
import {
  getGHNNewProvincesApi,
  getGHNNewWardsApi,
} from '../../../services/shippingApi';
import { autoMatchWard } from '../shippingUtils';

/**
 * Custom hook quản lý danh mục địa giới hành chính GHN phiên bản V3 (Mô hình địa chỉ 2 cấp Tỉnh/Thành -> Phường/Xã)
 * Tuân thủ quy chuẩn dùng 100% API V3 cho danh mục và tạo đơn; bản V2 chỉ dùng duy nhất để tính phí COD/cước.
 */
export function useAdministrativeDivisions(enabled = true) {
  const [provinces, setProvinces] = useState([]);
  const [wards, setWards] = useState([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [wardCode, setWardCode] = useState('');

  // 1. Tải danh mục Tỉnh/Thành hoàn toàn bằng API GHN V3
  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;

    getGHNNewProvincesApi()
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const normalized = list.map((p) => ({
          ...p,
          _id: p._id,
          ProvinceID: p._id,
          name: p.name,
          ProvinceName: p.name,
        }));
        setProvinces(normalized);
      })
      .catch((err) => console.error('Lỗi tải danh mục Tỉnh/Thành GHN v3:', err));

    return () => {
      isMounted = false;
    };
  }, [enabled]);

  // 2. Chọn Tỉnh/Thành -> Tải trực tiếp danh sách Phường/Xã GHN V3 theo provinceId
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
        const res = await getGHNNewWardsApi(pId);
        const rawList = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const normalizedWards = rawList.map((w) => ({
          ...w,
          _id: w._id,
          name: w.name,
          WardCode: String(w._id),
          WardName: w.name,
          DistrictID: '',
          label: w.name,
          isNewAddress: true,
        }));

        normalizedWards.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
        setWards(normalizedWards);

        // Tự động nhận diện và chọn Phường/Xã V3 từ địa chỉ khách hàng
        if (wardHintToMatch || wardCodeHintToMatch || fullAddrToMatch) {
          const matchedWard = autoMatchWard(
            wardHintToMatch,
            wardCodeHintToMatch,
            fullAddrToMatch,
            normalizedWards
          );
          if (matchedWard) {
            setWardCode(String(matchedWard.WardCode || matchedWard._id));
          }
        }
      } catch (err) {
        console.error('Lỗi tải danh mục Phường/Xã GHN v3:', err);
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
      setDistrictId('');
    },
    []
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
