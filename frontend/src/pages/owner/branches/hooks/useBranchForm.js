import { useState, useCallback } from 'react';
import { INITIAL_BRANCH_FORM_DATA, PROVINCE_DEFAULT_COORDS, FALLBACK_PROVINCES } from '../utils/branchConstants';
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
      const fallbackCoords = getProvinceCoords(branchToEdit.city) || PROVINCE_DEFAULT_COORDS['Thành phố Hà Nội'];
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
        latitude: branchToEdit.latitude != null ? String(branchToEdit.latitude) : fallbackCoords.lat.toFixed(6),
        longitude: branchToEdit.longitude != null ? String(branchToEdit.longitude) : fallbackCoords.lng.toFixed(6),
        managerId: branchToEdit.managerId?._id ? String(branchToEdit.managerId._id) : '',
        isHQ: Boolean(branchToEdit.isHQ),
        status: branchToEdit.status || 'ACTIVE',
      });
      if (branchToEdit.city) {
        fetchWardsByProvince(branchToEdit.city);
      }
    } else {
      // Khởi tạo chi nhánh mới: Gán sẵn tọa độ mặc định chuẩn (Hà Nội) để bản đồ và form đồng bộ tức thì
      setFormData({
        ...INITIAL_BRANCH_FORM_DATA,
        latitude: '21.028511',
        longitude: '105.854167',
      });
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
    const provName = provinceName || provinceOption?.value || provinceOption?.label || provinceOption?.name || '';
    const newCoords = getProvinceCoords(provName);

    setFormData((prev) => {
      const nextData = {
        ...prev,
        city: provName,
        ward: '',
      };

      // Tự động đồng bộ tọa độ trung tâm của Tỉnh/Thành phố mới chọn vào form và di chuyển bản đồ
      if (newCoords) {
        nextData.latitude = newCoords.lat.toFixed(6);
        nextData.longitude = newCoords.lng.toFixed(6);
      }

      return nextData;
    });

    setFormErrors((prev) => ({
      ...prev,
      city: '',
      ...(newCoords ? { coordinates: '' } : {}),
    }));

    await fetchWardsByProvince(provName, provinceOption);
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

        const availableProvinces = provinces && provinces.length > 0 ? provinces : FALLBACK_PROVINCES;
        if (geoCity && availableProvinces.length > 0) {
          const cleanCityTarget = cleanName(geoCity);

          const matchedProvince = availableProvinces.find((p) => {
            const cleanP = cleanName(p.name);
            return cleanP === cleanCityTarget || cleanCityTarget.includes(cleanP) || cleanP.includes(cleanCityTarget);
          });

          if (matchedProvince) {
            setFormData((prev) => ({
              ...prev,
              city: matchedProvince.name,
              ward: prev.city === matchedProvince.name ? prev.ward : '',
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

  // Lấy tọa độ vị trí hiện tại của thiết bị (Đồng bộ theo logic chuẩn của Branch Manager)
  const handleGetDeviceLocation = useCallback(() => {
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      const fallback = getProvinceCoords(formData.city) || PROVINCE_DEFAULT_COORDS['Thành phố Hà Nội'];
      setFormData((prev) => ({
        ...prev,
        latitude: fallback.lat.toFixed(6),
        longitude: fallback.lng.toFixed(6),
      }));
      showToast('Trình duyệt yêu cầu HTTPS để lấy GPS. Đã định vị theo trung tâm Tỉnh/Thành.', 'info');
      return;
    }

    if (!navigator.geolocation) {
      const fallback = getProvinceCoords(formData.city) || PROVINCE_DEFAULT_COORDS['Thành phố Hà Nội'];
      setFormData((prev) => ({
        ...prev,
        latitude: fallback.lat.toFixed(6),
        longitude: fallback.lng.toFixed(6),
      }));
      showToast('Trình duyệt không hỗ trợ định vị GPS. Đã định vị theo trung tâm Tỉnh/Thành.', 'info');
      return;
    }

    setIsLocating(true);

    const onPositionSuccess = async (pos) => {
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
          const availableProvinces = provinces && provinces.length > 0 ? provinces : FALLBACK_PROVINCES;
          if (geoCity && availableProvinces.length > 0) {
            const cleanCityTarget = cleanName(geoCity);
            const matchedProv = availableProvinces.find((p) => {
              const pClean = cleanName(p.name);
              return pClean === cleanCityTarget || cleanCityTarget.includes(pClean) || pClean.includes(cleanCityTarget);
            });

            if (matchedProv) {
              setFormData((prev) => ({
                ...prev,
                city: matchedProv.name,
                ward: prev.city === matchedProv.name ? prev.ward : '',
                ...(street && !prev.address ? { address: street } : {}),
              }));
              setFormErrors((prev) => ({
                ...prev,
                coordinates: '',
                city: '',
                ...(street ? { address: '' } : {}),
              }));

              const wardList = await fetchWardsByProvince(matchedProv.name, matchedProv);

              if (geoWard && Array.isArray(wardList) && wardList.length > 0) {
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
    };

    const onPositionError = (err) => {
      // Nếu không phải bị từ chối quyền (code !== 1), thử lại với độ chính xác WiFi mạng (cho PC/Laptop)
      if (err.code !== 1) {
        navigator.geolocation.getCurrentPosition(
          onPositionSuccess,
          (retryErr) => {
            setIsLocating(false);
            const fallback = getProvinceCoords(formData.city) || PROVINCE_DEFAULT_COORDS['Thành phố Hà Nội'];
            setFormData((prev) => ({
              ...prev,
              latitude: fallback.lat.toFixed(6),
              longitude: fallback.lng.toFixed(6),
            }));
            showToast(
              retryErr.code === 1
                ? 'Quyền truy cập vị trí bị từ chối. Đã lấy vị trí trung tâm Tỉnh/Thành.'
                : 'Không thể xác định vị trí GPS. Đã lấy vị trí trung tâm Tỉnh/Thành.',
              'info'
            );
          },
          { timeout: 10000, enableHighAccuracy: false }
        );
        return;
      }

      setIsLocating(false);
      const fallback = getProvinceCoords(formData.city) || PROVINCE_DEFAULT_COORDS['Thành phố Hà Nội'];
      setFormData((prev) => ({
        ...prev,
        latitude: fallback.lat.toFixed(6),
        longitude: fallback.lng.toFixed(6),
      }));
      showToast('Quyền truy cập vị trí bị từ chối. Đã lấy vị trí trung tâm Tỉnh/Thành.', 'info');
    };

    navigator.geolocation.getCurrentPosition(
      onPositionSuccess,
      onPositionError,
      { timeout: 10000, enableHighAccuracy: true }
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
      const cleanPhone = (formData.phone || '').trim().replace(/\s+/g, '').replace(/^\+84/, '0');
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        phone: cleanPhone,
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
