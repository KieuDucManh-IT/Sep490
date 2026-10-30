import { useState, useCallback } from 'react';
import { INITIAL_BRANCH_FORM_DATA, PROVINCE_DEFAULT_COORDS } from '../utils/branchConstants';
import { cleanName, getProvinceCoords, validateBranchForm } from '../utils/branchHelpers';
import {
  createBranchApi,
  updateBranchInfoApi,
  uploadShopImageApi,
  reverseGeocodeApi,
} from '../../../../services/shopApi';

export function useBranchForm({ provinces, fetchWardsByProvince, setWards, showToast, onSuccess }) {
  const [formData, setFormData] = useState(INITIAL_BRANCH_FORM_DATA);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [isLocating, setIsLocating] = useState(false);
  const [isSyncingAddress, setIsSyncingAddress] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);

  const resetForm = useCallback((branchToEdit = null) => {
    if (branchToEdit) {
      setFormData({
        name: branchToEdit.name || '',
        imageUrl: branchToEdit.imageUrl || branchToEdit.avatarUrl || '',
        bannerUrl: branchToEdit.bannerUrl || INITIAL_BRANCH_FORM_DATA.bannerUrl,
        phone: branchToEdit.phone || '',
        openingHours: branchToEdit.openingHours || INITIAL_BRANCH_FORM_DATA.openingHours,
        description: branchToEdit.description || '',
        address: branchToEdit.address || '',
        city: branchToEdit.city || 'Thành phố Hà Nội',
        ward: branchToEdit.ward || '',
        latitude: branchToEdit.latitude != null ? String(branchToEdit.latitude) : '',
        longitude: branchToEdit.longitude != null ? String(branchToEdit.longitude) : '',
        managerId: branchToEdit.managerId?._id ? String(branchToEdit.managerId._id) : '',
        isHQ: Boolean(branchToEdit.isHQ),
        status: branchToEdit.status || 'ACTIVE',
      });
      if (branchToEdit.city) {
        fetchWardsByProvince(branchToEdit.city);
      }
    } else {
      setFormData(INITIAL_BRANCH_FORM_DATA);
      if (fetchWardsByProvince) {
        fetchWardsByProvince('Thành phố Hà Nội');
      }
    }
    setFormErrors({});
  }, [fetchWardsByProvince]);

  const handleFieldChange = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    setFormErrors((prev) => {
      if (prev[field]) {
        const nextErrors = { ...prev };
        delete nextErrors[field];
        return nextErrors;
      }
      return prev;
    });
  }, []);

  const handleProvinceChange = useCallback(async (provinceName, provinceOption) => {
    const fallbackCoords = getProvinceCoords(provinceName);

    setFormData((prev) => {
      const nextData = {
        ...prev,
        city: provinceName,
        ward: '',
      };

      const hasCoords = prev.latitude && prev.longitude;
      if (!hasCoords && fallbackCoords) {
        nextData.latitude = fallbackCoords.lat.toFixed(6);
        nextData.longitude = fallbackCoords.lng.toFixed(6);
      }

      return nextData;
    });

    setFormErrors((prev) => ({ ...prev, city: '' }));
    await fetchWardsByProvince(provinceName, provinceOption);
  }, [fetchWardsByProvince]);

  const handleMapLocationChange = useCallback(({ latitude, longitude }) => {
    setFormData((prev) => ({
      ...prev,
      latitude: String(latitude),
      longitude: String(longitude),
    }));

    setFormErrors((prev) => ({ ...prev, coordinates: '' }));
  }, []);

  // Tự động đối soát và điền Tỉnh/Thành, Phường/Xã từ vị trí ghim trên bản đồ
  const handleSyncAddressFromPin = useCallback(async () => {
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      showToast('Vui lòng chọn vị trí trên bản đồ trước.', 'warning');
      return;
    }

    setIsSyncingAddress(true);
    try {
      const response = await reverseGeocodeApi(lat, lng);

      if (response?.success && response.data) {
        const { city: geoCity, ward: geoWard, street } = response.data;

        if (geoCity && provinces.length > 0) {
          const cleanCityTarget = cleanName(geoCity);

          const matchedProvince = provinces.find((p) => {
            const cleanP = cleanName(p.name);
            return cleanP === cleanCityTarget || cleanCityTarget.includes(cleanP) || cleanP.includes(cleanCityTarget);
          });

          if (matchedProvince) {
            setFormData((prev) => ({
              ...prev,
              city: matchedProvince.name,
              ...(street && !prev.address ? { address: street } : {}),
            }));

            setFormErrors((prev) => ({
              ...prev,
              city: '',
              coordinates: '',
              ...(street ? { address: '' } : {}),
            }));

            const wardList = await fetchWardsByProvince(matchedProvince.name, matchedProvince);

            if (geoWard && Array.isArray(wardList) && wardList.length > 0) {
              const cleanWardTarget = cleanName(geoWard);
              const matchedWard = wardList.find((w) => {
                const cleanW = cleanName(w.name);
                return cleanW === cleanWardTarget || cleanWardTarget.includes(cleanW) || cleanW.includes(cleanWardTarget);
              });

              if (matchedWard) {
                setFormData((prev) => ({
                  ...prev,
                  ward: matchedWard.name,
                }));
              }
            }

            showToast(`Đã xác định địa chỉ theo vị trí đã chọn: ${matchedProvince.name}!`, 'success');
            return;
          }
        }

        showToast('Đã tìm thấy địa chỉ theo vị trí đã chọn.', 'success');
      } else {
        showToast('Chưa tìm được tên phường/xã cho vị trí này.', 'info');
      }
    } catch {
      showToast('Không thể tự động tìm địa chỉ cho vị trí này.', 'warning');
    } finally {
      setIsSyncingAddress(false);
    }
  }, [formData.latitude, formData.longitude, provinces, fetchWardsByProvince, showToast]);

  // Lấy tọa độ vị trí hiện tại của thiết bị
  const handleGetDeviceLocation = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('Thiết bị hoặc trình duyệt chưa hỗ trợ định vị vị trí.', 'warning');
      return;
    }

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;

        setFormData((prev) => ({
          ...prev,
          latitude: currentLat.toFixed(6),
          longitude: currentLng.toFixed(6),
        }));

        setFormErrors((prev) => ({ ...prev, coordinates: '' }));

        try {
          const res = await reverseGeocodeApi(currentLat, currentLng);
          if (res?.success && res.data) {
            const { city: geoCity, ward: geoWard, street } = res.data;

            if (geoCity && provinces.length > 0) {
              const cleanCityTarget = cleanName(geoCity);
              const matchedProvince = provinces.find((p) => {
                const cleanP = cleanName(p.name);
                return cleanP === cleanCityTarget || cleanCityTarget.includes(cleanP) || cleanP.includes(cleanCityTarget);
              });

              if (matchedProvince) {
                setFormData((prev) => ({
                  ...prev,
                  city: matchedProvince.name,
                  ...(street ? { address: street } : {}),
                }));

                const wardList = await fetchWardsByProvince(matchedProvince.name, matchedProvince);
                if (geoWard && Array.isArray(wardList) && wardList.length > 0) {
                  const cleanWardTarget = cleanName(geoWard);
                  const matchedWard = wardList.find((w) => {
                    const cleanW = cleanName(w.name);
                    return cleanW === cleanWardTarget || cleanWardTarget.includes(cleanW) || cleanW.includes(cleanWardTarget);
                  });
                  if (matchedWard) {
                    setFormData((prev) => ({ ...prev, ward: matchedWard.name }));
                  }
                }

                showToast(`Đã xác định vị trí hiện tại: ${matchedProvince.name}!`, 'success');
                return;
              }
            }
            showToast('Đã lấy vị trí hiện tại thành công.', 'success');
          }
        } catch {
          showToast('Đã lấy vị trí hiện tại.', 'info');
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        setIsLocating(false);
        const fallback = getProvinceCoords(formData.city) || PROVINCE_DEFAULT_COORDS['Thành phố Hà Nội'];

        setFormData((prev) => ({
          ...prev,
          latitude: fallback.lat.toFixed(6),
          longitude: fallback.lng.toFixed(6),
        }));

        if (error.code === 1) {
          showToast('Bạn đã từ chối quyền truy cập vị trí. Đã chuyển về vị trí mặc định.', 'warning');
        } else {
          showToast('Không thể lấy vị trí thiết bị. Đã chuyển về vị trí mặc định.', 'warning');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [formData.city, provinces, fetchWardsByProvince, showToast]);

  // Xử lý nén và tải ảnh Logo hoặc Ảnh bìa chi nhánh
  const handleProcessUploadFile = useCallback(async (file, imageType) => {
    if (!file) return;

    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      showToast('Kích thước ảnh không được vượt quá 10MB.', 'warning');
      return;
    }

    const setUploading = imageType === 'banner' ? setUploadingBanner : setUploadingAvatar;
    setUploading(true);

    try {
      const temporaryUrl = URL.createObjectURL(file);
      if (imageType === 'banner') {
        setFormData((prev) => ({ ...prev, bannerUrl: temporaryUrl }));
      } else {
        setFormData((prev) => ({ ...prev, imageUrl: temporaryUrl }));
      }

      const uploadResponse = await uploadShopImageApi(file, imageType);

      if (uploadResponse?.success && uploadResponse.url) {
        if (imageType === 'banner') {
          setFormData((prev) => ({ ...prev, bannerUrl: uploadResponse.url }));
        } else {
          setFormData((prev) => ({ ...prev, imageUrl: uploadResponse.url }));
        }
        showToast(
          imageType === 'banner'
            ? 'Tải ảnh bìa cửa hàng thành công!'
            : 'Tải logo chi nhánh thành công!',
          'success'
        );
      } else {
        throw new Error(uploadResponse?.message || 'Không nhận được đường dẫn ảnh sau khi tải.');
      }
    } catch (err) {
      showToast('Lỗi khi tải ảnh: ' + (err.message || 'Lỗi mạng.'), 'warning');
    } finally {
      setUploading(false);
    }
  }, [showToast]);

  const handleSubmitForm = useCallback(async (activeBranchId, isEditMode) => {
    const errors = validateBranchForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('Vui lòng kiểm tra lại các trường thông tin bị thiếu hoặc không hợp lệ.', 'warning');
      return false;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        ward: formData.ward.trim(),
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        imageUrl: formData.imageUrl.trim(),
        bannerUrl: formData.bannerUrl.trim(),
        openingHours: formData.openingHours.trim(),
        status: formData.status,
        isHQ: Boolean(formData.isHQ),
        managerId: formData.managerId && formData.managerId !== 'none' ? formData.managerId : null,
      };

      let response;
      if (isEditMode) {
        response = await updateBranchInfoApi(activeBranchId, payload);
      } else {
        response = await createBranchApi(payload);
      }

      if (response?.success) {
        showToast(
          response.message || (isEditMode ? 'Cập nhật chi nhánh thành công!' : 'Tạo mới chi nhánh thành công!'),
          'success'
        );
        if (onSuccess) {
          await onSuccess();
        }
        return true;
      } else {
        throw new Error(response?.message || 'Thao tác không thành công.');
      }
    } catch (err) {
      showToast(err.message || 'Có lỗi xảy ra khi lưu chi nhánh.', 'warning');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [formData, showToast, onSuccess]);

  return {
    formData,
    setFormData,
    formErrors,
    setFormErrors,
    submitting,
    isLocating,
    isSyncingAddress,
    uploadingAvatar,
    uploadingBanner,
    isDraggingBanner,
    setIsDraggingBanner,
    resetForm,
    handleFieldChange,
    handleProvinceChange,
    handleMapLocationChange,
    handleSyncAddressFromPin,
    handleGetDeviceLocation,
    handleProcessUploadFile,
    handleSubmitForm,
  };
}
