import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  getAssignedBranchApi,
  updateShopInfoApi,
  reverseGeocodeApi,
  uploadShopImageApi,
} from '../../../../services/shopApi';
import { cleanName, getProvinceCoords } from '../../../owner/branches/utils/branchHelpers';
import { PROVINCE_DEFAULT_COORDS, FALLBACK_PROVINCES } from '../../../owner/branches/utils/branchConstants';
import { useProvincesWards } from '../../../owner/branches/hooks/useProvincesWards';
import {
  INITIAL_SETTINGS_FORM_DATA,
  validateBranchSettingsForm,
  shopToFormData,
} from '../utils/branchSettingsHelpers';

export function useBranchSettingsForm() {
  const formRef = useRef(null);

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSyncingAddress, setIsSyncingAddress] = useState(false);
  const [toast, setToast] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const [formData, setFormData] = useState(INITIAL_SETTINGS_FORM_DATA);

  const {
    provinces,
    wards,
    setWards,
    loadingProvinces,
    loadingWards,
    fetchWardsByProvince,
  } = useProvincesWards();

  const avatarFileRef = useRef(null);
  const bannerFileRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const syncBranchStorage = useCallback((updatedShop) => {
    if (!updatedShop?._id) return;
    try {
      localStorage.setItem('vestora_branch_cache', JSON.stringify(updatedShop));
      const cachedList = localStorage.getItem('vestora_managed_branches_cache');
      if (cachedList) {
        const list = JSON.parse(cachedList);
        if (Array.isArray(list)) {
          const updatedList = list.map((b) =>
            b._id?.toString() === updatedShop._id?.toString() ? { ...b, ...updatedShop } : b
          );
          localStorage.setItem('vestora_managed_branches_cache', JSON.stringify(updatedList));
        }
      }
    } catch {}
    window.dispatchEvent(
      new CustomEvent('vestora_branch_changed', {
        detail: { branch: updatedShop, branchId: updatedShop._id },
      })
    );
  }, []);

  const fetchAssignedBranch = useCallback(
    async (targetBranchId) => {
      try {
        setLoading(true);
        const res = await getAssignedBranchApi(targetBranchId);
        if (res?.success && res.data) {
          setShop(res.data);
          setFormData(shopToFormData(res.data));
        } else {
          setShop(null);
        }
      } catch (err) {
        showToast('Không thể tải thông tin chi nhánh: ' + (err.message || 'Lỗi mạng'), 'warning');
        setShop(null);
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchAssignedBranch();
  }, [fetchAssignedBranch]);

  useEffect(() => {
    const handleBranchChanged = (e) => {
      fetchAssignedBranch(e.detail?.branchId);
    };
    window.addEventListener('vestora_branch_changed', handleBranchChanged);
    return () => window.removeEventListener('vestora_branch_changed', handleBranchChanged);
  }, [fetchAssignedBranch]);

  useEffect(() => {
    if (!provinces.length || !formData.city) return;

    const cleanCity = cleanName(formData.city);
    const matchedProv = provinces.find((p) => {
      const pClean = cleanName(p.name);
      return pClean === cleanCity || cleanCity.includes(pClean) || pClean.includes(cleanCity);
    });

    if (matchedProv) {
      fetchWardsByProvince(matchedProv.name, matchedProv).then((wardList) => {
        if (formData.ward && wardList?.length > 0) {
          const cleanTarget = cleanName(formData.ward);
          const matched = wardList.find((w) => {
            const wClean = cleanName(w.name);
            return wClean === cleanTarget || cleanTarget.includes(wClean) || wClean.includes(cleanTarget);
          });
          if (matched && matched.name !== formData.ward) {
            setFormData((prev) => ({ ...prev, ward: matched.name }));
          }
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinces, shop]);

  const handleFieldChange = useCallback((fieldName, value) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setFormErrors((prev) => (prev[fieldName] ? { ...prev, [fieldName]: '' } : prev));
  }, []);

  const handleProvinceChange = useCallback(
    (cityName, opt) => {
      const provName = cityName || opt?.value || opt?.label || opt?.name || '';
      const fallbackCoords = getProvinceCoords(provName);

      setFormErrors((prev) => (prev.city ? { ...prev, city: '' } : prev));

      setFormData((prev) => ({
        ...prev,
        city: provName,
        ward: '',
        ...((!prev.latitude || !prev.longitude) && fallbackCoords
          ? {
              latitude: fallbackCoords.lat.toFixed(6),
              longitude: fallbackCoords.lng.toFixed(6),
            }
          : {}),
      }));

      fetchWardsByProvince(provName, opt);
    },
    [fetchWardsByProvince]
  );

  const handleWardChange = useCallback((wardName) => {
    setFormData((prev) => ({ ...prev, ward: wardName || '' }));
  }, []);

  const handleMapLocationChange = useCallback((coords) => {
    if (!coords) return;
    const lat = coords.latitude !== undefined ? coords.latitude : coords.lat;
    const lng = coords.longitude !== undefined ? coords.longitude : coords.lng;
    if (lat === undefined || lat === null || lng === undefined || lng === null) return;
    setFormData((prev) => ({
      ...prev,
      latitude: String(lat),
      longitude: String(lng),
    }));
    setFormErrors((prev) => (prev.coordinates ? { ...prev, coordinates: '' } : prev));
  }, []);

  const applyGeoAddress = useCallback(
    async (geoData, successMsg) => {
      const { city, ward: geoWard, street } = geoData || {};
      if (!city) return false;

      const cleanCityTarget = cleanName(city);
      const currentProvinces = provinces.length > 0 ? provinces : FALLBACK_PROVINCES;
      const matchedProv = currentProvinces.find((p) => {
        const pClean = cleanName(p.name);
        return pClean === cleanCityTarget || cleanCityTarget.includes(pClean) || pClean.includes(cleanCityTarget);
      });
      if (!matchedProv) return false;

      setFormData((prev) => ({
        ...prev,
        city: matchedProv.name,
        ...(street ? { address: street } : {}),
      }));
      setFormErrors((prev) => ({
        ...prev,
        city: '',
        coordinates: '',
        ...(street ? { address: '' } : {}),
      }));

      const wardList = await fetchWardsByProvince(matchedProv.name, matchedProv);
      if (geoWard && wardList?.length > 0) {
        const cleanWardTarget = cleanName(geoWard);
        const matchedWard = wardList.find((w) => {
          const wClean = cleanName(w.name);
          return wClean === cleanWardTarget || cleanWardTarget.includes(wClean) || wClean.includes(cleanWardTarget);
        });
        if (matchedWard) {
          setFormData((prev) => ({ ...prev, ward: matchedWard.name }));
        }
      }
      showToast(successMsg || `Đã đồng bộ địa chỉ: ${matchedProv.name}!`, 'success');
      return true;
    },
    [provinces, fetchWardsByProvince, showToast]
  );

  const handleSyncAddressFromPin = useCallback(async () => {
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      showToast('Vui lòng ghim vị trí trên bản đồ trước khi đồng bộ địa chỉ.', 'warning');
      return;
    }

    try {
      setIsSyncingAddress(true);
      const res = await reverseGeocodeApi(lat, lng);
      if (res?.success && res.data) {
        const matched = await applyGeoAddress(
          res.data,
          `Đã đồng bộ địa chỉ từ vị trí ghim: ${res.data.city || ''}!`
        );
        if (!matched) {
          showToast('Đã nhận diện tọa độ ghim, nhưng chưa đối chiếu được Tỉnh/Thành tương ứng.', 'info');
        }
      } else {
        showToast('Không tìm thấy địa giới hành chính tương ứng với vị trí này.', 'warning');
      }
    } catch {
      showToast('Không thể kết nối dịch vụ định vị địa giới hành chính.', 'warning');
    } finally {
      setIsSyncingAddress(false);
    }
  }, [formData.latitude, formData.longitude, applyGeoAddress, showToast]);

  const handleGetDeviceLocation = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('Trình duyệt của bạn không hỗ trợ định vị GPS.', 'warning');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
        setFormErrors((prev) => (prev.coordinates ? { ...prev, coordinates: '' } : prev));
        try {
          const res = await reverseGeocodeApi(lat, lng);
          if (res?.success && res.data) {
            const matched = await applyGeoAddress(
              res.data,
              `Đã lấy vị trí GPS & nhận diện: ${res.data.city || ''}!`
            );
            if (matched) return;
          }
          showToast('Đã lấy tọa độ GPS từ thiết bị thành công!', 'success');
        } catch {
          showToast('Đã lấy tọa độ thiết bị, nhưng không nhận diện được tên địa chỉ chi tiết.', 'info');
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        const fallback = getProvinceCoords(formData.city) || PROVINCE_DEFAULT_COORDS['Hồ Chí Minh'];
        setFormData((prev) => ({
          ...prev,
          latitude: fallback.lat.toFixed(6),
          longitude: fallback.lng.toFixed(6),
        }));
        showToast(
          err.code === 1
            ? 'Quyền truy cập vị trí bị từ chối. Đã lấy vị trí trung tâm Tỉnh/Thành.'
            : 'Không thể xác định vị trí GPS. Đã lấy vị trí trung tâm Tỉnh/Thành.',
          'info'
        );
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, [formData.city, applyGeoAddress, showToast]);

  const handleUploadImageFile = useCallback(
    async (e, imageType) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        showToast('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP).', 'warning');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showToast('Dung lượng ảnh không được vượt quá 10MB.', 'warning');
        return;
      }

      const updateField = imageType === 'banner' ? 'bannerUrl' : 'imageUrl';
      const setUploading = imageType === 'banner' ? setUploadingBanner : setUploadingAvatar;
      const localPreviewUrl = URL.createObjectURL(file);

      setFormData((prev) => ({ ...prev, [updateField]: localPreviewUrl }));
      setUploading(true);

      try {
        const res = await uploadShopImageApi(file, imageType);
        if (res?.success && res.url) {
          URL.revokeObjectURL(localPreviewUrl);
          setFormData((prev) => ({ ...prev, [updateField]: res.url }));

          if (shop?._id) {
            try {
              const updatedRes = await updateShopInfoApi(shop._id, { [updateField]: res.url });
              const updatedData = updatedRes?.data || { ...shop, [updateField]: res.url };
              setShop(updatedData);
              syncBranchStorage(updatedData);
              showToast(
                `Đã tự động lưu ảnh ${imageType === 'banner' ? 'bìa' : 'logo'} mới vào hệ thống thành công!`,
                'success'
              );
            } catch {
              showToast('Tải ảnh thành công. Hãy bấm "Lưu Cập Nhật Cửa Hàng" bên dưới để hoàn tất.', 'info');
            }
          } else {
            showToast(`Đã tải ảnh ${imageType === 'banner' ? 'bìa' : 'logo'} thành công!`, 'success');
          }
        } else {
          throw new Error(res?.message || 'Không thể tải ảnh lên máy chủ');
        }
      } catch (err) {
        URL.revokeObjectURL(localPreviewUrl);
        showToast('Lỗi khi tải ảnh: ' + (err.message || 'Lỗi mạng'), 'warning');
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    },
    [shop, syncBranchStorage, showToast]
  );

  const isDirty = useMemo(() => {
    if (!shop) return false;
    const initial = shopToFormData(shop);
    return (
      (formData.name || '').trim() !== initial.name.trim() ||
      (formData.description || '').trim() !== initial.description.trim() ||
      (formData.phone || '').trim() !== initial.phone.trim() ||
      (formData.address || '').trim() !== initial.address.trim() ||
      (formData.city || '').trim() !== initial.city.trim() ||
      (formData.ward || '').trim() !== initial.ward.trim() ||
      String(formData.latitude || '') !== initial.latitude ||
      String(formData.longitude || '') !== initial.longitude ||
      (formData.bannerUrl || '') !== initial.bannerUrl ||
      (formData.imageUrl || '') !== initial.imageUrl ||
      (formData.openingHours || '').trim() !== initial.openingHours.trim() ||
      Boolean(formData.isOpen) !== initial.isOpen
    );
  }, [formData, shop]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleSubmit = useCallback(
    async (e) => {
      if (e) e.preventDefault();
      if (!shop) return;

      if (uploadingAvatar || uploadingBanner) {
        showToast('Đang tải ảnh lên hệ thống, vui lòng chờ trong giây lát...', 'warning');
        return;
      }
      if (formData.imageUrl?.startsWith('blob:') || formData.bannerUrl?.startsWith('blob:')) {
        showToast('Ảnh đang trong quá trình tải lên máy chủ, vui lòng đợi hoàn tất.', 'warning');
        return;
      }

      const errs = validateBranchSettingsForm(formData);
      setFormErrors(errs);
      if (Object.keys(errs).length > 0) {
        const firstKey = Object.keys(errs)[0];
        if (firstKey === 'coordinates') {
          document.getElementById('branch-map-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          const el = document.getElementById(`branch${firstKey.charAt(0).toUpperCase() + firstKey.slice(1)}`);
          el?.focus();
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        showToast('Vui lòng kiểm tra lại các trường thông tin bị lỗi.', 'warning');
        return;
      }

      setSaving(true);
      try {
        const cleanPhone = (formData.phone || '')
          .trim()
          .replace(/\s+/g, '')
          .replace(/^\+84/, '0');
        const payload = {
          name: (formData.name || '').trim(),
          description: (formData.description || '').trim() || 'Chưa cập nhật mô tả',
          phone: cleanPhone,
          address: (formData.address || '').trim(),
          city: (formData.city || '').trim(),
          ward: (formData.ward || '').trim(),
          latitude: formData.latitude !== '' ? Number(formData.latitude) : null,
          longitude: formData.longitude !== '' ? Number(formData.longitude) : null,
          imageUrl: (formData.imageUrl || '').trim(),
          bannerUrl: (formData.bannerUrl || '').trim(),
          openingHours: (formData.openingHours || '').trim() || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
          status: formData.isOpen ? 'ACTIVE' : 'SUSPENDED',
        };

        const res = await updateShopInfoApi(shop._id, payload);
        if (res?.success && res.data) {
          setShop(res.data);
          setFormErrors({});
          syncBranchStorage(res.data);
          showToast('Cập nhật thông tin chi nhánh thành công!', 'success');
        } else {
          throw new Error(res?.message || 'Không thể lưu thông tin');
        }
      } catch (err) {
        showToast('Lỗi khi lưu thông tin: ' + (err.message || 'Lỗi mạng'), 'warning');
      } finally {
        setSaving(false);
      }
    },
    [formData, shop, showToast, syncBranchStorage, uploadingAvatar, uploadingBanner]
  );

  const handleReset = useCallback(() => {
    if (shop) {
      setFormData(shopToFormData(shop));
      setFormErrors({});
      showToast('Đã hoàn tác các thay đổi chưa lưu.', 'info');
    }
  }, [shop, showToast]);

  return {
    shop,
    loading,
    saving,
    isLocating,
    isSyncingAddress,
    toast,
    setToast,
    formErrors,
    formData,
    provinces,
    wards,
    setWards,
    loadingProvinces,
    loadingWards,
    avatarFileRef,
    bannerFileRef,
    uploadingAvatar,
    uploadingBanner,
    lightboxImage,
    setLightboxImage,
    isDirty,
    formRef,
    handleFieldChange,
    handleProvinceChange,
    handleWardChange,
    handleMapLocationChange,
    handleSyncAddressFromPin,
    handleGetDeviceLocation,
    handleUploadImageFile,
    handleReset,
    handleSubmit,
    fetchAssignedBranch,
  };
}
