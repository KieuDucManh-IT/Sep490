import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../../../context/AuthContext';
import {
  getMyShopApi,
  updateShopInfoApi,
  reverseGeocodeApi,
  uploadShopImageApi,
} from '../../../../services/shopApi';
import { cleanName, getProvinceCoords } from '../../branches/utils/branchHelpers';
import { PROVINCE_DEFAULT_COORDS } from '../../branches/utils/branchConstants';
import { useProvincesWards } from '../../branches/hooks/useProvincesWards';
import { INITIAL_SETTINGS_FORM_DATA, validateShopSettingsForm } from '../utils/settingsHelpers';

export function useShopSettingsForm() {
  const { user } = useAuth();
  const formRef = useRef(null);

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSyncingAddress, setIsSyncingAddress] = useState(false);
  const [toast, setToast] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const [formData, setFormData] = useState(INITIAL_SETTINGS_FORM_DATA);

  // Provinces and Wards cascade hook
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

  // 1. Tải hồ sơ gian hàng từ Backend
  const fetchMyShop = useCallback(async () => {
    try {
      setLoading(true);
      const ownerId = user?._id || user?.id || user?.UserId || null;
      const res = await getMyShopApi(ownerId);
      if (res && res.success && res.data) {
        const s = res.data;
        setShop(s);
        setFormData({
          name: s.name || '',
          description: s.description || '',
          phone: s.phone || '',
          address: s.address || '',
          city: s.city || '',
          ward: s.ward || '',
          latitude: s.latitude != null ? String(s.latitude) : '',
          longitude: s.longitude != null ? String(s.longitude) : '',
          bannerUrl: s.bannerUrl || '',
          imageUrl: s.imageUrl || '',
          openingHours: s.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
          isOpen: s.status === 'ACTIVE',
        });
      } else {
        showToast('Chưa tìm thấy hồ sơ gian hàng liên kết với tài khoản này.', 'warning');
      }
    } catch (err) {
      showToast('Không thể tải thông tin gian hàng: ' + (err.message || 'Lỗi mạng'), 'warning');
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  useEffect(() => {
    fetchMyShop();
  }, [fetchMyShop]);

  // 2. Khớp và tải phường/xã khi tỉnh thành của cửa hàng đã sẵn sàng
  useEffect(() => {
    if (!provinces.length || !formData.city) return;

    const cleanCity = cleanName(formData.city);
    const matchedProv = provinces.find((p) => {
      const pClean = cleanName(p.name);
      return pClean === cleanCity || cleanCity.includes(pClean) || pClean.includes(cleanCity);
    });

    if (matchedProv) {
      fetchWardsByProvince(matchedProv.name, matchedProv).then((wardList) => {
        if (formData.ward && wardList && wardList.length > 0) {
          const cleanTarget = cleanName(formData.ward);
          const matchedWard = wardList.find((w) => {
            const wClean = cleanName(w.name);
            return wClean === cleanTarget || cleanTarget.includes(wClean) || wClean.includes(cleanTarget);
          });
          if (matchedWard && matchedWard.name !== formData.ward) {
            setFormData((prev) => ({ ...prev, ward: matchedWard.name }));
          }
        }
      });
    }
  }, [provinces, shop, formData.city, fetchWardsByProvince]);

  // 3. Thay đổi giá trị trường dữ liệu thông thường
  const handleFieldChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => (prev[field] ? { ...prev, [field]: '' } : prev));
  }, []);

  // 4. Chọn Tỉnh / Thành phố mới
  const handleProvinceChange = useCallback(
    (cityName, opt) => {
      const provName = cityName || opt?.value || opt?.label || opt?.name || '';
      setFormErrors((prev) => (prev.city ? { ...prev, city: '' } : prev));

      const fallbackCoords = getProvinceCoords(provName);

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

  // 5. Chọn Phường / Xã mới
  const handleWardChange = useCallback((wardName, opt) => {
    const selectedWard = wardName || opt?.value || opt?.label || opt?.name || '';
    setFormData((prev) => ({
      ...prev,
      ward: selectedWard,
    }));
  }, []);

  // 6. Cập nhật vị trí ghim bản đồ Leaflet
  const handleMapLocationChange = useCallback(({ latitude, longitude }) => {
    setFormData((prev) => ({
      ...prev,
      latitude,
      longitude,
    }));
    setFormErrors((prev) => (prev.coordinates ? { ...prev, coordinates: '' } : prev));
  }, []);

  // 7. Đồng bộ địa chỉ hành chính từ tọa độ ghim bản đồ
  const handleSyncAddressFromPin = useCallback(async () => {
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      showToast('Chưa có tọa độ ghim trên bản đồ để đối soát địa chỉ.', 'warning');
      return;
    }

    setIsSyncingAddress(true);
    try {
      const geoRes = await reverseGeocodeApi(lat, lng);
      if (geoRes?.success && geoRes.data) {
        const { city: geoCity, ward: geoWard, street } = geoRes.data;
        if (geoCity && provinces.length > 0) {
          const cleanCityTarget = cleanName(geoCity);
          const matchedProv = provinces.find((p) => {
            const pClean = cleanName(p.name);
            return pClean === cleanCityTarget || cleanCityTarget.includes(pClean) || pClean.includes(cleanCityTarget);
          });

          if (matchedProv) {
            setFormData((prev) => ({
              ...prev,
              city: matchedProv.name,
              ...(street && !prev.address ? { address: street } : {}),
            }));
            setFormErrors((prev) => ({
              ...prev,
              city: '',
              ...(street ? { address: '' } : {}),
            }));

            const wardList = await fetchWardsByProvince(matchedProv.name, matchedProv);
            if (geoWard && wardList && wardList.length > 0) {
              const cleanWardTarget = cleanName(geoWard);
              const matchedWard = wardList.find((w) => {
                const wClean = cleanName(w.name);
                return wClean === cleanWardTarget || cleanWardTarget.includes(wClean) || wClean.includes(cleanWardTarget);
              });
              if (matchedWard) {
                setFormData((prev) => ({
                  ...prev,
                  ward: matchedWard.name,
                }));
              }
            }
            showToast(`Đã đồng bộ địa chỉ theo ghim: ${matchedProv.name}!`, 'success');
            return;
          }
        }
        showToast('Đã đối soát tọa độ vị trí ghim thành công.', 'success');
      } else {
        showToast('Không tìm thấy tên phường/xã tương ứng với vị trí này.', 'info');
      }
    } catch (_) {
      showToast('Không thể kết nối đến máy chủ giải mã địa chỉ.', 'warning');
    } finally {
      setIsSyncingAddress(false);
    }
  }, [formData.latitude, formData.longitude, provinces, fetchWardsByProvince, showToast]);

  // 8. Lấy tọa độ GPS từ thiết bị đang sử dụng
  const handleGetDeviceLocation = useCallback(() => {
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
      const fallback = getProvinceCoords(formData.city) || PROVINCE_DEFAULT_COORDS['Hồ Chí Minh'];
      setFormData((prev) => ({
        ...prev,
        latitude: fallback.lat.toFixed(6),
        longitude: fallback.lng.toFixed(6),
      }));
      showToast('Trình duyệt yêu cầu HTTPS để lấy GPS. Đã định vị theo trung tâm Tỉnh/Thành.', 'info');
      return;
    }

    if (!navigator.geolocation) {
      const fallback = getProvinceCoords(formData.city) || PROVINCE_DEFAULT_COORDS['Hồ Chí Minh'];
      setFormData((prev) => ({
        ...prev,
        latitude: fallback.lat.toFixed(6),
        longitude: fallback.lng.toFixed(6),
      }));
      showToast('Trình duyệt không hỗ trợ định vị GPS. Đã định vị theo trung tâm Tỉnh/Thành.', 'info');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setFormData((prev) => ({
            ...prev,
            latitude: lat.toFixed(6),
            longitude: lng.toFixed(6),
          }));
          setFormErrors((prev) => (prev.coordinates ? { ...prev, coordinates: '' } : prev));

          const geoRes = await reverseGeocodeApi(lat, lng);
          if (geoRes?.success && geoRes.data) {
            const { city: geoCity, ward: geoWard, street } = geoRes.data;
            if (geoCity && provinces.length > 0) {
              const cleanCityTarget = cleanName(geoCity);
              const matchedProv = provinces.find((p) => {
                const pClean = cleanName(p.name);
                return pClean === cleanCityTarget || cleanCityTarget.includes(pClean) || pClean.includes(cleanCityTarget);
              });

              if (matchedProv) {
                setFormData((prev) => ({
                  ...prev,
                  city: matchedProv.name,
                  ...(street && !prev.address ? { address: street } : {}),
                }));
                setFormErrors((prev) => ({
                  ...prev,
                  coordinates: '',
                  city: '',
                  ...(street ? { address: '' } : {}),
                }));

                const wardList = await fetchWardsByProvince(matchedProv.name, matchedProv);
                if (geoWard && wardList && wardList.length > 0) {
                  const cleanWardTarget = cleanName(geoWard);
                  const matchedWard = wardList.find((w) => {
                    const wClean = cleanName(w.name);
                    return wClean === cleanWardTarget || cleanWardTarget.includes(wClean) || wClean.includes(cleanWardTarget);
                  });
                  if (matchedWard) {
                    setFormData((prev) => ({
                      ...prev,
                      ward: matchedWard.name,
                    }));
                  }
                }
                showToast(`Đã lấy vị trí GPS & nhận diện: ${matchedProv.name}!`, 'success');
                return;
              }
            }
          }
          showToast('Đã lấy tọa độ GPS từ thiết bị thành công!', 'success');
        } catch (_) {
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
  }, [formData.city, provinces, fetchWardsByProvince, showToast]);

  // 9. Tải ảnh Logo hoặc Banner lên máy chủ
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

      const localPreviewUrl = URL.createObjectURL(file);
      if (imageType === 'banner') {
        setFormData((prev) => ({ ...prev, bannerUrl: localPreviewUrl }));
        setUploadingBanner(true);
      } else {
        setFormData((prev) => ({ ...prev, imageUrl: localPreviewUrl }));
        setUploadingAvatar(true);
      }

      try {
        const res = await uploadShopImageApi(file, imageType);
        if (res && res.success && res.url) {
          URL.revokeObjectURL(localPreviewUrl);
          const updateField = imageType === 'banner' ? 'bannerUrl' : 'imageUrl';
          setFormData((prev) => ({ ...prev, [updateField]: res.url }));

          if (shop?._id) {
            try {
              await updateShopInfoApi(shop._id, { [updateField]: res.url });
              setShop((prev) => (prev ? { ...prev, [updateField]: res.url } : prev));
              showToast(
                `Đã tự động lưu ảnh ${imageType === 'banner' ? 'bìa' : 'logo'} mới vào hệ thống thành công!`,
                'success'
              );
            } catch (saveErr) {
              console.warn('Auto-save image error:', saveErr?.message);
              showToast('Tải ảnh thành công. Hãy bấm "Lưu Thay Đổi" bên dưới để hoàn tất.', 'info');
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
        if (imageType === 'banner') setUploadingBanner(false);
        else setUploadingAvatar(false);
        e.target.value = '';
      }
    },
    [shop, showToast]
  );

  // 10. Kiểm tra xem form có dữ liệu thay đổi chưa lưu (isDirty)
  const isDirty = useMemo(() => {
    if (!shop) return false;
    return (
      (formData.name || '').trim() !== (shop.name || '').trim() ||
      (formData.description || '').trim() !== (shop.description || '').trim() ||
      (formData.phone || '').trim() !== (shop.phone || '').trim() ||
      (formData.address || '').trim() !== (shop.address || '').trim() ||
      (formData.city || '').trim() !== (shop.city || '').trim() ||
      (formData.ward || '').trim() !== (shop.ward || '').trim() ||
      String(formData.latitude || '') !== String(shop.latitude != null ? shop.latitude : '') ||
      String(formData.longitude || '') !== String(shop.longitude != null ? shop.longitude : '') ||
      (formData.bannerUrl || '') !== (shop.bannerUrl || '') ||
      (formData.imageUrl || '') !== (shop.imageUrl || '') ||
      (formData.openingHours || '').trim() !== (shop.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)').trim() ||
      Boolean(formData.isOpen) !== (shop.status === 'ACTIVE')
    );
  }, [formData, shop]);

  // Cảnh báo người dùng khi thoát trang nếu có thay đổi chưa lưu
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

  // 11. Hoàn tác lại trạng thái ban đầu của cửa hàng
  const handleReset = useCallback(() => {
    if (shop) {
      setFormData({
        name: shop.name || '',
        description: shop.description || '',
        phone: shop.phone || '',
        address: shop.address || '',
        city: shop.city || '',
        ward: shop.ward || '',
        latitude: shop.latitude != null ? String(shop.latitude) : '',
        longitude: shop.longitude != null ? String(shop.longitude) : '',
        bannerUrl: shop.bannerUrl || '',
        imageUrl: shop.imageUrl || '',
        openingHours: shop.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
        isOpen: shop.status === 'ACTIVE',
      });
      setFormErrors({});
      showToast('Đã hoàn tác các thay đổi chưa lưu.', 'info');
    }
  }, [shop, showToast]);

  // 12. Gửi dữ liệu cập nhật cửa hàng lên Backend
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

      const errs = validateShopSettingsForm(formData);
      setFormErrors(errs);
      if (Object.keys(errs).length > 0) {
        const firstKey = Object.keys(errs)[0];
        if (firstKey === 'coordinates') {
          document.getElementById('shop-map-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          const el = document.getElementById(`shop${firstKey.charAt(0).toUpperCase() + firstKey.slice(1)}`);
          el?.focus();
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        showToast('Vui lòng kiểm tra lại các trường thông tin bị lỗi.', 'warning');
        return;
      }

      setSaving(true);
      try {
        const cleanPhone = (formData.phone || '').trim().replace(/\s+/g, '').replace(/^\+84/, '0');
        const payload = {
          name: (formData.name || '').trim(),
          description: (formData.description || '').trim() || 'Cửa hàng thời trang dạ tiệc và thiết kế cao cấp Vestora.',
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
        if (res && res.success) {
          setShop(res.data);
          showToast('Cập nhật thông tin cửa hàng thành công!', 'success');
        } else {
          throw new Error(res?.message || 'Không thể lưu thông tin');
        }
      } catch (err) {
        showToast('Lỗi khi lưu thông tin: ' + (err.message || 'Lỗi mạng'), 'warning');
      } finally {
        setSaving(false);
      }
    },
    [shop, uploadingAvatar, uploadingBanner, formData, showToast]
  );

  return {
    shop,
    loading,
    saving,
    isLocating,
    isSyncingAddress,
    toast,
    formErrors,
    formData,
    provinces,
    wards,
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
  };
}
