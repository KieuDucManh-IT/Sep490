import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Row, Col, Form, Button, Spinner } from 'react-bootstrap';
import {
  MapPin,
  Compass,
  Navigation,
  Upload,
  RotateCcw,
  Save,
  AlertCircle,
  Info,
  RefreshCw,
  Camera,
  Image as ImageIcon,
  Check,
} from 'lucide-react';
import OwnerSidebar from '../../components/OwnerSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import BranchSidebar from '../../components/BranchSidebar';
import LeafletMapPicker from '../../components/LeafletMapPicker';
import OpeningHoursInput, { parseOpeningHours, DAY_OPTIONS } from '../../components/OpeningHoursInput';
import ImageLightboxModal from '../../components/ImageLightboxModal';
import SearchableSelect from '../../components/SearchableSelect';
import { useAuth } from '../../context/AuthContext';
import {
  getMyShopApi,
  updateShopInfoApi,
  reverseGeocodeApi,
  uploadShopImageApi,
} from '../../services/shopApi';
import '../../styles/ShopDashboard.css';
import '../../styles/ShopBranches.css';

/**
 * Normalize Vietnamese administrative division names for diacritics-insensitive matching
 */
const cleanName = (str) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(thanh pho|tinh|quan|huyen|thi xa|phuong|xa|thi tran|tp\.?)\s+/gi, '')
    .trim();

const FALLBACK_PROVINCES = [
  { code: 1, name: 'Thành phố Hà Nội' },
  { code: 4, name: 'Tỉnh Cao Bằng' },
  { code: 8, name: 'Tỉnh Tuyên Quang' },
  { code: 11, name: 'Tỉnh Điện Biên' },
  { code: 12, name: 'Tỉnh Lai Châu' },
  { code: 14, name: 'Tỉnh Sơn La' },
  { code: 15, name: 'Tỉnh Lào Cai' },
  { code: 19, name: 'Tỉnh Thái Nguyên' },
  { code: 20, name: 'Tỉnh Lạng Sơn' },
  { code: 22, name: 'Thành phố Quảng Ninh' },
  { code: 24, name: 'Thành phố Bắc Ninh' },
  { code: 25, name: 'Tỉnh Phú Thọ' },
  { code: 31, name: 'Thành phố Hải Phòng' },
  { code: 33, name: 'Tỉnh Hưng Yên' },
  { code: 37, name: 'Tỉnh Ninh Bình' },
  { code: 38, name: 'Tỉnh Thanh Hóa' },
  { code: 40, name: 'Tỉnh Nghệ An' },
  { code: 42, name: 'Tỉnh Hà Tĩnh' },
  { code: 44, name: 'Tỉnh Quảng Trị' },
  { code: 46, name: 'Thành phố Huế' },
  { code: 48, name: 'Thành phố Đà Nẵng' },
  { code: 51, name: 'Tỉnh Quảng Ngãi' },
  { code: 52, name: 'Tỉnh Gia Lai' },
  { code: 56, name: 'Tỉnh Khánh Hòa' },
  { code: 66, name: 'Tỉnh Đắk Lắk' },
  { code: 68, name: 'Tỉnh Lâm Đồng' },
  { code: 75, name: 'Thành phố Đồng Nai' },
  { code: 79, name: 'Thành phố Hồ Chí Minh' },
  { code: 80, name: 'Tỉnh Tây Ninh' },
  { code: 82, name: 'Tỉnh Đồng Tháp' },
  { code: 86, name: 'Tỉnh Vĩnh Long' },
  { code: 91, name: 'Tỉnh An Giang' },
  { code: 92, name: 'Thành phố Cần Thơ' },
  { code: 96, name: 'Tỉnh Cà Mau' },
];

const PROVINCE_DEFAULT_COORDS = {
  'Hà Nội': { lat: 21.028511, lng: 105.854167 },
  'Thành phố Hà Nội': { lat: 21.028511, lng: 105.854167 },
  'Hồ Chí Minh': { lat: 10.776889, lng: 106.700806 },
  'Thành phố Hồ Chí Minh': { lat: 10.776889, lng: 106.700806 },
  'Đà Nẵng': { lat: 16.054407, lng: 108.202167 },
  'Thành phố Đà Nẵng': { lat: 16.054407, lng: 108.202167 },
  'Hải Phòng': { lat: 20.844912, lng: 106.688084 },
  'Thành phố Hải Phòng': { lat: 20.844912, lng: 106.688084 },
  'Cần Thơ': { lat: 10.045162, lng: 105.746857 },
  'Thành phố Cần Thơ': { lat: 10.045162, lng: 105.746857 },
  'Bình Dương': { lat: 10.980461, lng: 106.651871 },
  'Đồng Nai': { lat: 10.957413, lng: 106.842713 },
  'Thành phố Đồng Nai': { lat: 10.957413, lng: 106.842713 },
  'Quảng Ninh': { lat: 20.950454, lng: 107.073364 },
  'Thành phố Quảng Ninh': { lat: 20.950454, lng: 107.073364 },
  'Khánh Hòa': { lat: 12.238791, lng: 109.196749 },
  'Thừa Thiên Huế': { lat: 16.463713, lng: 107.590866 },
  'Thành phố Huế': { lat: 16.463713, lng: 107.590866 },
  'Lâm Đồng': { lat: 11.940419, lng: 108.458313 },
};

const getProvinceCoords = (name) => {
  if (!name) return null;
  const clean = cleanName(name);
  for (const [key, coords] of Object.entries(PROVINCE_DEFAULT_COORDS)) {
    if (cleanName(key) === clean || clean.includes(cleanName(key)) || cleanName(key).includes(clean)) {
      return coords;
    }
  }
  return null;
};

export default function OwnerSettingsPage() {
  const { user } = useAuth();
  const formRef = useRef(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSyncingAddress, setIsSyncingAddress] = useState(false);
  const [toast, setToast] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    address: '',
    city: '',
    ward: '',
    latitude: '',
    longitude: '',
    bannerUrl: '',
    imageUrl: '',
    openingHours: '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
    isOpen: true,
  });

  const [provinces, setProvinces] = useState(FALLBACK_PROVINCES);
  const [wards, setWards] = useState([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const wardCache = useRef({});

  const avatarFileRef = useRef(null);
  const bannerFileRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  /**
   * Fetch administrative divisions from Open API
   */
  useEffect(() => {
    let isMounted = true;
    setLoadingProvinces(true);
    fetch('https://provinces.open-api.vn/api/v2/p/')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setProvinces(data);
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

  /**
   * Load store profile for Shop Owner
   */
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
          imageUrl: s.imageUrl || s.avatarUrl || '',
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

  /**
   * Load wards for a specific province with caching
   */
  const loadWardsForProvince = useCallback(async (provCode, initialWardName = '') => {
    if (!provCode) {
      setWards([]);
      return;
    }

    if (wardCache.current[provCode]) {
      const cached = wardCache.current[provCode];
      setWards(cached);
      matchAndSetWard(cached, initialWardName);
      return;
    }

    setLoadingWards(true);
    try {
      const res = await fetch(`https://provinces.open-api.vn/api/v2/p/${provCode}?depth=2`);
      const data = await res.json();
      const list = data?.wards || [];
      wardCache.current[provCode] = list;
      setWards(list);
      matchAndSetWard(list, initialWardName);
    } catch (_) {
      setWards([]);
    } finally {
      setLoadingWards(false);
    }
  }, []);

  const matchAndSetWard = (wardList, targetWardName) => {
    if (!targetWardName || !wardList.length) return;
    const cleanTarget = cleanName(targetWardName);
    const matched = wardList.find((w) => {
      const wClean = cleanName(w.name);
      return wClean === cleanTarget || cleanTarget.includes(wClean) || wClean.includes(cleanTarget);
    });
    if (matched && matched.name !== targetWardName) {
      setFormData((prev) => ({ ...prev, ward: matched.name }));
    }
  };

  /**
   * Sync loaded store address with province & ward pickers
   */
  useEffect(() => {
    if (!provinces.length || !formData.city) return;

    const cleanCity = cleanName(formData.city);
    const matchedProv = provinces.find((p) => {
      const pClean = cleanName(p.name);
      return pClean === cleanCity || cleanCity.includes(pClean) || pClean.includes(cleanCity);
    });

    if (matchedProv) {
      loadWardsForProvince(matchedProv.code, formData.ward);
    }
  }, [provinces, shop, formData.city, formData.ward, loadWardsForProvince]);

  /**
   * Handle province change via SearchableSelect
   */
  const handleProvinceChange = useCallback((cityName, opt) => {
    const provName = cityName || opt?.value || opt?.label || opt?.name || '';
    const provList = provinces.length > 0 ? provinces : FALLBACK_PROVINCES;
    const provCode = opt?.code || provList.find((p) => p.name === provName || String(p.code) === String(provName))?.code || '';

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

    if (provCode) {
      loadWardsForProvince(provCode, '');
    } else {
      setWards([]);
    }
  }, [provinces, loadWardsForProvince]);

  /**
   * Handle ward change via SearchableSelect
   */
  const handleWardChange = useCallback((wardName, opt) => {
    const selectedWard = wardName || opt?.value || opt?.label || opt?.name || '';
    setFormData((prev) => ({
      ...prev,
      ward: selectedWard,
    }));
  }, []);

  /**
   * Map pin coordinate update callback
   */
  const handleMapLocationChange = useCallback(({ latitude, longitude }) => {
    setFormData((prev) => ({
      ...prev,
      latitude,
      longitude,
    }));
    setFormErrors((prev) => (prev.coordinates ? { ...prev, coordinates: '' } : prev));
  }, []);

  /**
   * Reverse geocode pin coordinates to deduce province, ward, and street
   */
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

            const resWards = await fetch(`https://provinces.open-api.vn/api/v2/p/${matchedProv.code}?depth=2`);
            const dataWards = await resWards.json();
            const wardList = dataWards?.wards || [];
            wardCache.current[matchedProv.code] = wardList;
            setWards(wardList);

            if (geoWard && wardList.length > 0) {
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
  }, [formData.latitude, formData.longitude, provinces, showToast]);

  /**
   * Retrieve GPS coordinates from device and reverse geocode
   */
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

                const resWards = await fetch(`https://provinces.open-api.vn/api/v2/p/${matchedProv.code}?depth=2`);
                const dataWards = await resWards.json();
                const wardList = dataWards?.wards || [];
                wardCache.current[matchedProv.code] = wardList;
                setWards(wardList);

                if (geoWard && wardList.length > 0) {
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
  }, [formData.city, provinces, showToast]);

  /**
   * Handle image upload to Cloudinary with memory cleanup
   */
  const handleUploadImageFile = useCallback(async (e, imageType) => {
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
            showToast(`Đã tự động lưu ảnh ${imageType === 'banner' ? 'bìa' : 'logo'} mới vào hệ thống thành công!`, 'success');
          } catch (saveErr) {
            console.warn('Auto-save image error:', saveErr?.message);
            showToast(`Tải ảnh thành công. Hãy bấm "Lưu Thay Đổi" bên dưới để hoàn tất.`, 'info');
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
  }, [shop, showToast]);

  /**
   * Detect unsaved changes (isDirty)
   */
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
      (formData.imageUrl || '') !== (shop.imageUrl || shop.avatarUrl || '') ||
      (formData.openingHours || '').trim() !== (shop.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)').trim() ||
      Boolean(formData.isOpen) !== (shop.status === 'ACTIVE')
    );
  }, [formData, shop]);

  /**
   * Warn user if navigating away with unsaved form edits
   */
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

  /**
   * Validate store profile inputs
   */
  const validateForm = useCallback((data) => {
    const errs = {};
    const trimmedName = (data.name || '').trim();
    if (!trimmedName) {
      errs.name = 'Tên gian hàng là bắt buộc.';
    } else if (trimmedName.length < 3 || trimmedName.length > 100) {
      errs.name = 'Tên gian hàng phải từ 3 đến 100 ký tự.';
    }

    const cleanPhone = (data.phone || '').trim().replace(/\s+/g, '').replace(/^\+84/, '0');
    const phoneRegex = /^(0[35789])[0-9]{8}$/;
    if (!cleanPhone) {
      errs.phone = 'Hotline liên hệ là bắt buộc.';
    } else if (!phoneRegex.test(cleanPhone)) {
      errs.phone = 'Số điện thoại không hợp lệ (10 số, đầu 03, 05, 07, 08, 09).';
    }

    if (!(data.city || '').trim() || data.city === 'ALL') {
      errs.city = 'Vui lòng chọn Tỉnh / Thành phố.';
    }

    const trimmedAddress = (data.address || '').trim();
    if (trimmedAddress && trimmedAddress.length > 255) {
      errs.address = 'Địa chỉ chi tiết không được vượt quá 255 ký tự.';
    }

    if (!data.latitude || !data.longitude) {
      errs.coordinates = 'Vui lòng xác định vị trí GPS (bằng nút định vị hoặc click ghim trên bản đồ).';
    } else {
      const lat = Number(data.latitude);
      const lng = Number(data.longitude);
      if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
        errs.coordinates = 'Tọa độ GPS không hợp lệ (Vĩ độ: -90 đến 90, Kinh độ: -180 đến 180).';
      }
    }

    if (data.openingHours) {
      const parsedHours = parseOpeningHours(data.openingHours);
      if (parsedHours.fromTime && parsedHours.toTime && parsedHours.toTime <= parsedHours.fromTime) {
        errs.openingHours = 'Giờ đóng cửa phải sau giờ mở cửa.';
      } else {
        const fromIdx = DAY_OPTIONS.indexOf(parsedHours.fromDay);
        const toIdx = DAY_OPTIONS.indexOf(parsedHours.toDay);
        if (fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx) {
          errs.openingHours = `Thứ kết thúc (${parsedHours.toDay}) phải sau hoặc cùng Thứ bắt đầu (${parsedHours.fromDay}) trong tuần.`;
        }
      }
    }

    const trimmedDesc = (data.description || '').trim();
    if (trimmedDesc && (trimmedDesc.length < 10 || trimmedDesc.length > 1000)) {
      errs.description = 'Mô tả gian hàng phải từ 10 đến 1000 ký tự (hoặc để trống để dùng mô tả mặc định).';
    }

    return errs;
  }, []);

  /**
   * Persist store updates to backend
   */
  const handleSubmit = useCallback(async (e) => {
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

    const errs = validateForm(formData);
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
  }, [shop, uploadingAvatar, uploadingBanner, formData, validateForm, showToast]);

  /**
   * Reset form fields to previously saved shop state
   */
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
        imageUrl: shop.imageUrl || shop.avatarUrl || '',
        openingHours: shop.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
        isOpen: shop.status === 'ACTIVE',
      });
      setFormErrors({});
      showToast('Đã hoàn tác các thay đổi chưa lưu.', 'info');
    }
  }, [shop, showToast]);

  const isActive = Boolean(formData.isOpen);
  const isBranchManager = /branch_manager/i.test(user?.Role || '');

  return (
    <div className="shop-dashboard-layout">
      {isBranchManager ? (
        <BranchSidebar />
      ) : (
        <OwnerSidebar
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
        />
      )}

      <div className="admin-main-viewport" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
        {!isBranchManager && (
          <OwnerTopHeader
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
            breadcrumb="Hồ Sơ Cửa Hàng & Ghim Map"
          />
        )}

        <main className="shop-main-content" style={{ flex: 1, padding: '24px 36px' }}>
          <div className="store-mgmt-container">
            {/* Page Header */}
            <div className="admin-page-hero d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4 border-bottom">
              <div>
                <h1 className="admin-page-title">
                  {isBranchManager ? 'Hồ Sơ Showroom Chi Nhánh & Ghim Map' : 'Quản Lý Thông Tin Cửa Hàng'}
                </h1>
                <p className="admin-page-desc">
                  {isBranchManager
                    ? 'Cập nhật hotline, giờ mở cửa, giới thiệu và định vị tọa độ GPS showroom phục vụ khách thử đồ và giao hàng.'
                    : 'Cập nhật thông tin thương hiệu, hotline liên hệ, địa chỉ và định vị showroom trên bản đồ trực quan.'}
                </p>
              </div>

              <div className="d-flex align-items-center gap-3">
                <span className={`store-pill-active ${!isActive ? 'inactive' : ''}`}>
                  ● {isActive ? 'ĐANG HOẠT ĐỘNG' : 'TẠM NGHỈ'}
                </span>
              </div>
            </div>

          {loading ? (
            <div className="text-center py-5 my-5">
              <Spinner animation="border" variant="dark" role="status" className="mb-2" />
              <div className="text-muted small">Đang tải hồ sơ cửa hàng từ hệ thống...</div>
            </div>
          ) : (
            <Form onSubmit={handleSubmit} ref={formRef}>
              <Row className="g-4">
                {/* Left Column: Brand Identity, Contact & Operating Hours */}
                <Col lg={6}>
                  <div
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '20px',
                      border: '1px solid #E2E8F0',
                      padding: '24px',
                      boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)',
                      marginBottom: '24px',
                    }}
                  >
                    <div className="d-flex align-items-center justify-content-between pb-3 border-bottom mb-3 flex-wrap gap-2">
                      <div>
                        <h5 className="fw-bold mb-1" style={{ fontSize: '16px', color: '#0F172A' }}>
                          Hồ Sơ Gian Hàng & Liên Hệ
                        </h5>
                        <div className="text-muted small" style={{ fontSize: '12px' }}>
                          Thông tin nhận diện cửa hàng hiển thị với khách hàng
                        </div>
                      </div>

                      <div className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: '12px', fontWeight: 600, color: isActive ? '#059669' : '#D97706' }}>
                          ● {isActive ? 'ĐANG MỞ CỬA' : 'TẠM DỪNG'}
                        </span>
                        <Form.Check
                          type="switch"
                          id="shop-active-switch"
                          checked={formData.isOpen}
                          onChange={(e) => setFormData({ ...formData, isOpen: e.target.checked })}
                          title="Bật/Tắt trạng thái mở cửa đón khách"
                        />
                      </div>
                    </div>

                    {/* Hidden File Inputs */}
                    <input
                      type="file"
                      ref={bannerFileRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleUploadImageFile(e, 'banner')}
                    />
                    <input
                      type="file"
                      ref={avatarFileRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleUploadImageFile(e, 'avatar')}
                    />

                    {/* Visual Media Cards */}
                    <div
                      style={{
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: '14px',
                        padding: '16px',
                        marginBottom: '18px',
                      }}
                    >
                      <Row className="g-3">
                        <Col sm={5}>
                          <div className="d-flex align-items-center gap-1 mb-2 fw-semibold" style={{ fontSize: '12.5px', color: '#334155' }}>
                            <ImageIcon size={14} className="text-slate-500" />
                            <span>Logo Cửa Hàng</span>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div
                              style={{
                                width: '46px',
                                height: '46px',
                                borderRadius: '50%',
                                overflow: 'hidden',
                                border: '1px solid #CBD5E1',
                                flexShrink: 0,
                                background: '#F1F5F9',
                                cursor: (formData.imageUrl || shop?.imageUrl) ? 'pointer' : 'default',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                              }}
                              onClick={() => {
                                const logoSrc = formData.imageUrl || shop?.imageUrl;
                                if (logoSrc) {
                                  setLightboxImage({
                                    url: logoSrc,
                                    title: `${formData.name || shop?.name || 'Cửa Hàng'} — Logo Cửa Hàng (Kích Thước Thật)`,
                                  });
                                }
                              }}
                              title={(formData.imageUrl || shop?.imageUrl) ? 'Bấm xem ảnh logo chi tiết' : 'Logo Cửa Hàng'}
                            >
                              {formData.imageUrl ? (
                                <img src={formData.imageUrl} alt="Logo Cửa Hàng" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <div className="d-flex align-items-center justify-content-center h-100 fw-bold text-muted" style={{ fontSize: '10px' }}>
                                  LOGO
                                </div>
                              )}
                            </div>
                            <div>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1"
                                style={{ fontSize: '12px', fontWeight: 600, borderRadius: '6px', padding: '5px 12px' }}
                                onClick={() => avatarFileRef.current?.click()}
                                disabled={uploadingAvatar}
                              >
                                {uploadingAvatar ? (
                                  <Spinner size="sm" animation="border" className="me-1" />
                                ) : (
                                  <Upload size={12} />
                                )}
                                <span>Đổi Logo</span>
                              </button>
                              <div className="text-muted" style={{ fontSize: '10.5px', marginTop: '2px' }}>
                                Vuông 1:1, tối đa 10MB
                              </div>
                            </div>
                          </div>
                        </Col>

                        <Col sm={7}>
                          <div className="d-flex align-items-center gap-1 mb-2 fw-semibold" style={{ fontSize: '12.5px', color: '#334155' }}>
                            <Camera size={14} className="text-slate-500" />
                            <span>Ảnh Bìa Cửa Hàng (Banner)</span>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div
                              style={{
                                width: '96px',
                                height: '52px',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                border: '1px solid #CBD5E1',
                                flexShrink: 0,
                                background: '#0F172A',
                                cursor: 'pointer',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
                              }}
                              onClick={() => {
                                const bannerSrc = formData.bannerUrl || shop?.bannerUrl || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80';
                                setLightboxImage({
                                  url: bannerSrc,
                                  title: `${formData.name || shop?.name || 'Cửa Hàng'} — Ảnh Bìa (Kích Thước Thật)`,
                                });
                              }}
                              title="Bấm xem ảnh phóng to"
                            >
                              <img
                                src={formData.bannerUrl || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'}
                                alt="Banner Cửa Hàng"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </div>
                            <div>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1"
                                style={{ fontSize: '12px', fontWeight: 600, borderRadius: '6px', padding: '5px 12px' }}
                                onClick={() => bannerFileRef.current?.click()}
                                disabled={uploadingBanner}
                              >
                                {uploadingBanner ? (
                                  <Spinner size="sm" animation="border" className="me-1" />
                                ) : (
                                  <Upload size={12} />
                                )}
                                <span>Đổi Ảnh Bìa</span>
                              </button>
                              <div className="text-muted" style={{ fontSize: '10.5px', marginTop: '2px' }}>
                                Tỉ lệ 16:9, tối đa 10MB
                              </div>
                            </div>
                          </div>
                        </Col>
                      </Row>
                    </div>

                    {/* Name & Phone */}
                    <Row className="g-3 mb-3">
                      <Col md={7}>
                        <Form.Group controlId="shopName">
                          <Form.Label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                            Tên Gian Hàng / Cửa Hàng <span style={{ color: '#EF4444' }}>*</span>
                          </Form.Label>
                          <Form.Control
                            type="text"
                            value={formData.name}
                            onChange={(e) => {
                              setFormData({ ...formData, name: e.target.value });
                              if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: '' }));
                            }}
                            isInvalid={Boolean(formErrors.name)}
                            placeholder="Ví dụ: VESTORA - Quý Tộc Boutique"
                            style={{ fontSize: '13.5px', padding: '10px 14px', borderRadius: '8px' }}
                          />
                          {formErrors.name && (
                            <div className="vestora-invalid-feedback d-block">{formErrors.name}</div>
                          )}
                        </Form.Group>
                      </Col>

                      <Col md={5}>
                        <Form.Group controlId="shopPhone">
                          <Form.Label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                            Hotline Liên Hệ <span style={{ color: '#EF4444' }}>*</span>
                          </Form.Label>
                          <Form.Control
                            type="text"
                            value={formData.phone}
                            onChange={(e) => {
                              setFormData({ ...formData, phone: e.target.value });
                              if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: '' }));
                            }}
                            isInvalid={Boolean(formErrors.phone)}
                            placeholder="Ví dụ: 0912 345 678"
                            style={{ fontSize: '13.5px', padding: '10px 14px', borderRadius: '8px' }}
                          />
                          {formErrors.phone && (
                            <div className="vestora-invalid-feedback d-block">{formErrors.phone}</div>
                          )}
                        </Form.Group>
                      </Col>
                    </Row>

                    {/* Opening Hours Input */}
                    <div className="mb-3">
                      <OpeningHoursInput
                        value={formData.openingHours}
                        onChange={(val) => {
                          setFormData((prev) => ({ ...prev, openingHours: val }));
                          if (formErrors.openingHours) setFormErrors((prev) => ({ ...prev, openingHours: '' }));
                        }}
                        isInvalid={Boolean(formErrors.openingHours)}
                        errorMessage={formErrors.openingHours}
                      />
                    </div>

                    {/* Description Textarea */}
                    <Form.Group controlId="shopDescription" className="mb-0">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <Form.Label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', margin: 0 }}>
                          Mô Tả Giới Thiệu Cửa Hàng
                        </Form.Label>
                        <span className="text-muted" style={{ fontSize: '11px' }}>
                          {(formData.description || '').length} / 1000 ký tự
                        </span>
                      </div>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={formData.description}
                        onChange={(e) => {
                          setFormData({ ...formData, description: e.target.value });
                          if (formErrors.description) setFormErrors((prev) => ({ ...prev, description: '' }));
                        }}
                        isInvalid={Boolean(formErrors.description)}
                        placeholder="Mô tả phong cách thời trang, dòng trang phục chủ đạo (dạ hội, cưới hỏi, veston cao cấp)..."
                        style={{ fontSize: '13px', padding: '10px 14px', borderRadius: '8px', lineHeight: '1.5' }}
                      />
                      {formErrors.description && (
                        <div className="vestora-invalid-feedback d-block">{formErrors.description}</div>
                      )}
                    </Form.Group>
                  </div>
                </Col>

                {/* Right Column: Address, Geolocation & Leaflet Map */}
                <Col lg={6}>
                  <div
                    style={{
                      background: '#FFFFFF',
                      borderRadius: '20px',
                      border: '1px solid #E2E8F0',
                      padding: '24px',
                      boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.04)',
                      marginBottom: '24px',
                    }}
                  >
                    <div className="pb-3 border-bottom mb-3 d-flex align-items-center gap-3">
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: '#F1F5F9',
                          color: '#0F172A',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <MapPin size={20} />
                      </div>
                      <div>
                        <h5 className="fw-bold mb-0" style={{ fontSize: '16px', color: '#0F172A' }}>
                          Địa Chỉ & Ghim Vị Trí Bản Đồ
                        </h5>
                        <div className="text-muted small" style={{ fontSize: '12px' }}>
                          Định vị vị trí cửa ra vào showroom để khách tìm đường và tính cước vận chuyển giao đồ
                        </div>
                      </div>
                    </div>

                    {/* Administrative Division Selects with Fast Search */}
                    <Row className="g-3 mb-3">
                      <Col md={6}>
                        <Form.Group controlId="shopCity">
                          <Form.Label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                            Tỉnh / Thành Phố <span style={{ color: '#EF4444' }}>*</span>
                          </Form.Label>
                          <SearchableSelect
                            id="shopCity"
                            options={(provinces.length > 0 ? provinces : FALLBACK_PROVINCES).map((p) => ({
                              value: p.name,
                              label: p.name,
                              name: p.name,
                              code: p.code,
                            }))}
                            value={formData.city || ''}
                            onChange={(val, opt) => handleProvinceChange(val, opt)}
                            placeholder={loadingProvinces ? 'Đang tải danh sách Tỉnh / Thành...' : '-- Chọn hoặc tìm Tỉnh / Thành phố --'}
                            searchPlaceholder="Gõ tìm nhanh Tỉnh / Thành phố..."
                            isInvalid={Boolean(formErrors.city)}
                            disabled={loadingProvinces}
                          />
                          {formErrors.city && (
                            <div className="vestora-invalid-feedback d-block">{formErrors.city}</div>
                          )}
                        </Form.Group>
                      </Col>

                      <Col md={6}>
                        <Form.Group controlId="shopWard">
                          <Form.Label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Phường / Xã</Form.Label>
                          <SearchableSelect
                            id="shopWard"
                            options={wards.map((w) => ({
                              value: w.name,
                              label: w.name,
                              name: w.name,
                              code: w.code,
                            }))}
                            value={formData.ward || ''}
                            onChange={(val, opt) => handleWardChange(val, opt)}
                            placeholder={
                              loadingWards
                                ? 'Đang tải danh sách Phường / Xã...'
                                : wards.length > 0
                                ? '-- Chọn hoặc tìm Phường / Xã --'
                                : formData.city
                                ? '-- Không tìm thấy Phường / Xã --'
                                : '-- Chọn Tỉnh / Thành phố trước --'
                            }
                            searchPlaceholder="Gõ tìm nhanh Phường / Xã..."
                            disabled={!formData.city || loadingWards}
                            allowClear
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    {/* Street Address */}
                    <Form.Group controlId="shopAddress" className="mb-3">
                      <Form.Label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                        Địa Chỉ Chi Tiết (Số nhà, Tên đường, Tòa nhà)
                      </Form.Label>
                      <Form.Control
                        type="text"
                        value={formData.address}
                        onChange={(e) => {
                          setFormData({ ...formData, address: e.target.value });
                          if (formErrors.address) setFormErrors((prev) => ({ ...prev, address: '' }));
                        }}
                        isInvalid={Boolean(formErrors.address)}
                        placeholder="Ví dụ: Tầng 1, Tòa nhà VESTORA, 120 Phố Huế"
                        style={{ fontSize: '13.5px', padding: '10px 14px', borderRadius: '8px' }}
                      />
                      {formErrors.address && (
                        <div className="vestora-invalid-feedback d-block">{formErrors.address}</div>
                      )}
                    </Form.Group>

                    {/* GPS Quick Action Toolbar */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginBottom: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1"
                          style={{ fontSize: '12px', borderRadius: '6px', fontWeight: 600, padding: '5px 12px' }}
                          onClick={handleGetDeviceLocation}
                          disabled={isLocating}
                        >
                          {isLocating ? <Spinner size="sm" animation="border" /> : <Navigation size={13} />}
                          <span>Lấy GPS Thiết Bị</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                        style={{ fontSize: '12px', borderRadius: '6px', fontWeight: 600, padding: '5px 12px' }}
                        onClick={handleSyncAddressFromPin}
                        disabled={isSyncingAddress || !formData.latitude || !formData.longitude}
                        title="Dịch ngược tọa độ ghim hiện tại để điền Tỉnh/Thành, Phường/Xã và Số nhà"
                      >
                        {isSyncingAddress ? <Spinner size="sm" animation="border" /> : <RefreshCw size={13} />}
                        <span>Đồng Bộ Địa Chỉ Từ Ghim</span>
                      </button>
                    </div>

                    {/* Interactive Leaflet Map Picker Container */}
                    <div
                      id="shop-map-container"
                      style={{
                        height: '350px',
                        borderRadius: '14px',
                        overflow: 'hidden',
                        border: formErrors.coordinates ? '1.5px solid #EF4444' : '1px solid #CBD5E1',
                        boxShadow: formErrors.coordinates ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : '0 2px 6px rgba(0,0,0,0.04)',
                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                      }}
                    >
                      <LeafletMapPicker
                        latitude={formData.latitude}
                        longitude={formData.longitude}
                        cityName={formData.city}
                        onChange={handleMapLocationChange}
                      />
                    </div>

                    {formErrors.coordinates && (
                      <div
                        className="vestora-invalid-feedback d-flex align-items-center gap-1 mt-2 p-2"
                        style={{
                          background: '#FEF2F2',
                          border: '1px solid #FECACA',
                          borderRadius: '8px',
                          color: '#991B1B',
                          fontSize: '12px',
                        }}
                      >
                        <AlertCircle size={15} className="flex-shrink-0 text-danger" />
                        <span>{formErrors.coordinates}</span>
                      </div>
                    )}

                    {/* Map Coordinate Chip & Guidance */}
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mt-2 pt-1">
                      <span className="text-muted d-inline-flex align-items-center gap-1" style={{ fontSize: '11.5px' }}>
                        <Info size={13} className="text-slate-400" />
                        <span>Click vào vị trí trên bản đồ để di chuyển ghim đỏ tới showroom</span>
                      </span>
                      {formData.latitude && formData.longitude && (
                        <span
                          style={{
                            fontSize: '11px',
                            background: '#F1F5F9',
                            color: '#334155',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            border: '1px solid #E2E8F0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Compass size={12} className="text-slate-400" />
                          Tọa độ: {Number(formData.latitude).toFixed(4)}, {Number(formData.longitude).toFixed(4)}
                        </span>
                      )}
                    </div>
                  </div>
                </Col>
              </Row>

              {/* Floating Actions Bar (Glassmorphic) */}
              <div
                style={{
                  position: 'sticky',
                  bottom: '16px',
                  zIndex: 100,
                  marginTop: '24px',
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(226, 232, 240, 0.9)',
                  borderRadius: '14px',
                  padding: '14px 24px',
                  boxShadow: '0 12px 30px rgba(15, 23, 42, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div className="d-flex align-items-center gap-2">
                  {isDirty ? (
                    <span
                      style={{
                        fontSize: '12.5px',
                        color: '#D97706',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#FEF3C7',
                        padding: '4px 12px',
                        borderRadius: '20px',
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} />
                      Có thay đổi chưa lưu
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: '12.5px',
                        color: '#64748B',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: '#F1F5F9',
                        padding: '4px 12px',
                        borderRadius: '20px',
                      }}
                    >
                      <Check size={13} style={{ color: '#10B981' }} />
                      Dữ liệu đã đồng bộ
                    </span>
                  )}
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                    style={{ fontSize: '13px', fontWeight: 600, padding: '7px 16px', borderRadius: '8px' }}
                    onClick={handleReset}
                    disabled={!isDirty || saving}
                  >
                    <RotateCcw size={14} />
                    <span>Hoàn Tác</span>
                  </button>

                  <button
                    type="submit"
                    className="btn btn-sm btn-dark d-inline-flex align-items-center gap-1"
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      padding: '7px 22px',
                      borderRadius: '8px',
                      background: '#0F172A',
                      borderColor: '#0F172A',
                      minWidth: '150px',
                      justifyContent: 'center',
                    }}
                    disabled={saving || !isDirty}
                  >
                    {saving ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-1" />
                        <span>Đang lưu...</span>
                      </>
                    ) : (
                      <>
                        <Save size={14} />
                        <span>Lưu Thay Đổi</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </Form>
          )}
        </div>
      </main>
      </div>

      {/* Floating Notification Toast */}
      {toast && (
        <div className={`store-floating-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Full-size Image Lightbox */}
      <ImageLightboxModal
        show={Boolean(lightboxImage)}
        onHide={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url}
        title={lightboxImage?.title}
      />
    </div>
  );
}
