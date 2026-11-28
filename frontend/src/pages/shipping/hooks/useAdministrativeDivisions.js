import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getGHNNewProvincesApi,
  getGHNNewWardsApi,
} from '../../../services/shippingApi';
import { autoMatchWard, filterHanoiProvinces } from '../shippingUtils';

/**
 * Custom hook quản lý danh mục địa giới hành chính GHN phiên bản V3 (Mô hình địa chỉ 2 cấp Tỉnh/Thành -> Phường/Xã)
 * Tuân thủ quy chuẩn dùng 100% API V3 cho danh mục và tạo đơn; bản V2 chỉ dùng duy nhất để tính phí COD/cước.
 */
export function useAdministrativeDivisions(enabled = true) {
  const [provinces, setProvinces] = useState([]);
  const [wards, setWards] = useState([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const [divisionsError, setDivisionsError] = useState('');
  const [provinceId, setProvinceId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const requestSeqRef = useRef(0);
  const lastWardLoadArgsRef = useRef(null);

  // 1. Tải danh mục Tỉnh/Thành hoàn toàn bằng API GHN V3
  useEffect(() => {
    if (!enabled) return;
    let isMounted = true;
    setDivisionsError('');

    getGHNNewProvincesApi()
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setProvinces(filterHanoiProvinces(list));
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Lỗi tải danh mục Tỉnh/Thành GHN v3:', err);
        setDivisionsError(err?.message || 'Không thể tải danh mục Tỉnh/Thành từ GHN.');
      });

    return () => {
      isMounted = false;
    };
  }, [enabled, reloadTick]);

  // 2. Chọn Tỉnh/Thành -> Tải trực tiếp danh sách Phường/Xã GHN V3 theo provinceId (chặn race condition)
  const handleProvinceChange = useCallback(
    async (
      provIdVal,
      wardHintToMatch = '',
      wardCodeHintToMatch = '',
      fullAddrToMatch = ''
    ) => {
      const reqId = ++requestSeqRef.current;
      const pId = typeof provIdVal === 'object' && provIdVal?.target ? provIdVal.target.value : provIdVal;
      setProvinceId(pId ? String(pId) : '');
      setDistrictId('');
      setWardCode('');
      setWards([]);
      setDivisionsError('');

      if (!pId) {
        lastWardLoadArgsRef.current = null;
        setLoadingWards(false);
        return;
      }

      lastWardLoadArgsRef.current = {
        pId,
        wardHintToMatch,
        wardCodeHintToMatch,
        fullAddrToMatch,
      };

      setLoadingWards(true);
      try {
        const res = await getGHNNewWardsApi(pId);
        if (reqId !== requestSeqRef.current) return;

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
        if (reqId !== requestSeqRef.current) return;
        console.error('Lỗi tải danh mục Phường/Xã GHN v3:', err);
        setDivisionsError(err?.message || 'Không thể tải danh mục Phường/Xã từ GHN.');
      } finally {
        if (reqId === requestSeqRef.current) {
          setLoadingWards(false);
        }
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

  // 4. Reset trạng thái và vô hiệu hóa các request phường đang chờ
  const resetDivisions = useCallback(() => {
    requestSeqRef.current += 1;
    lastWardLoadArgsRef.current = null;
    setProvinceId('');
    setDistrictId('');
    setWardCode('');
    setWards([]);
    setLoadingWards(false);
    setDivisionsError('');
  }, []);

  const reloadDivisions = useCallback(() => {
    if (provinces.length === 0) {
      setReloadTick((prev) => prev + 1);
      return;
    }
    const lastArgs = lastWardLoadArgsRef.current;
    if (lastArgs?.pId) {
      handleProvinceChange(
        lastArgs.pId,
        lastArgs.wardHintToMatch,
        lastArgs.wardCodeHintToMatch,
        lastArgs.fullAddrToMatch
      );
    }
  }, [provinces.length, handleProvinceChange]);

  return {
    provinces,
    wards,
    loadingWards,
    divisionsError,
    provinceId,
    setProvinceId,
    districtId,
    setDistrictId,
    wardCode,
    setWardCode,
    handleProvinceChange,
    handleWardChange,
    resetDivisions,
    reloadDivisions,
  };
}
