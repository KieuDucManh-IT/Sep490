import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Row, Col, Form, Button, Spinner } from 'react-bootstrap';
import {
  Building2,
  Store,
  MapPin,
  Phone,
  Clock,
  Compass,
  Navigation,
  Eye,
  Upload,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ExternalLink,
  Star,
  RefreshCw,
  Camera,
  Image as ImageIcon,
  Check,
  Sparkles,
} from 'lucide-react';
import BranchSidebar from '../../components/BranchSidebar';
import OwnerTopHeader from '../../components/OwnerTopHeader';
import LeafletMapPicker from '../../components/LeafletMapPicker';
import OpeningHoursInput, { parseOpeningHours, DAY_OPTIONS } from '../../components/OpeningHoursInput';
import ImageLightboxModal from '../../components/ImageLightboxModal';
import SearchableSelect from '../../components/SearchableSelect';
import {
  getAssignedBranchApi,
  updateShopInfoApi,
  reverseGeocodeApi,
  uploadShopImageApi,
} from '../../services/shopApi';
import '../../styles/ShopDashboard.css';
import '../../styles/ShopBranches.css';

const cleanName = (str) =>
  (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

export default function BranchSettingsPage() {
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
   * Fetch Vietnamese administrative divisions (Provinces)
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
   * Load assigned branch using Bearer Token or active branch ID
   */
  const fetchAssignedBranch = useCallback(async (targetBranchId) => {
    try {
      setLoading(true);
      const res = await getAssignedBranchApi(targetBranchId);
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
        setShop(null);
      }
    } catch (err) {
      showToast('Không thể tải thông tin chi nhánh: ' + (err.message || 'Lỗi mạng'), 'warning');
      setShop(null);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchAssignedBranch();
  }, [fetchAssignedBranch]);

  useEffect(() => {
    const handleBranchChanged = (e) => {
      fetchAssignedBranch(e.detail?.branchId);
    };
    window.addEventListener('vestora_branch_changed', handleBranchChanged);
    return () => {
      window.removeEventListener('vestora_branch_changed', handleBranchChanged);
    };
  }, [fetchAssignedBranch]);

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
      const wardList = data?.wards || [];
      wardCache.current[provCode] = wardList;
      setWards(wardList);
      matchAndSetWard(wardList, initialWardName);
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
   * Sync province selection with administrative divisions API
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinces, shop]);

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

  const handleWardChange = useCallback((wardName, opt) => {
    const selectedWard = wardName || opt?.value || opt?.label || opt?.name || '';
    setFormData((prev) => ({
      ...prev,
      ward: selectedWard,
    }));
  }, []);

  const handleMapLocationChange = useCallback(({ latitude, longitude }) => {
    setFormData((prev) => ({
      ...prev,
      latitude,
      longitude,
    }));
    setFormErrors((prev) => (prev.coordinates ? { ...prev, coordinates: '' } : prev));
  }, []);

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
   * Handle image upload (avatar or banner) to Cloudinary
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

        // Persist uploaded image URL immediately to prevent data loss on reload
        if (shop?._id) {
          try {
            await updateShopInfoApi(shop._id, { [updateField]: res.url });
            setShop((prev) => (prev ? { ...prev, [updateField]: res.url } : prev));
            showToast(`Đã tự động lưu ảnh ${imageType === 'banner' ? 'bìa' : 'logo'} mới vào hệ thống thành công!`, 'success');
          } catch (saveErr) {
            console.warn('Auto-save image error:', saveErr?.message);
            showToast(`Tải ảnh thành công. Hãy bấm "Lưu Cập Nhật Cửa Hàng" bên dưới để hoàn tất.`, 'info');
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
   * Validate branch form fields before submitting (matches OwnerBranchesPage & backend shopValidation)
   */
  const validateBranchForm = useCallback((data) => {
    const errs = {};
    const trimmedName = (data.name || '').trim();
    if (!trimmedName) {
      errs.name = 'Tên chi nhánh là bắt buộc.';
    } else if (trimmedName.length < 3 || trimmedName.length > 100) {
      errs.name = 'Tên chi nhánh phải từ 3 đến 100 ký tự.';
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
      errs.description = 'Mô tả chi nhánh phải từ 10 đến 1000 ký tự (hoặc để trống để dùng mô tả mặc định).';
    }

    return errs;
  }, []);

  /**
   * Submit store updates to backend
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

    const errs = validateBranchForm(formData);
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
      const cleanPhone = (formData.phone || '').trim().replace(/\s+/g, '').replace(/^\+84/, '0');
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
      if (res && res.success) {
        setShop(res.data);
        setFormErrors({});
        showToast('Cập nhật thông tin chi nhánh thành công!', 'success');
      } else {
        throw new Error(res?.message || 'Không thể lưu thông tin');
      }
    } catch (err) {
      showToast('Lỗi khi lưu thông tin: ' + (err.message || 'Lỗi mạng'), 'warning');
    } finally {
      setSaving(false);
    }
  }, [formData, shop, showToast, uploadingAvatar, uploadingBanner, validateBranchForm]);

  /**
   * Reset form to initial loaded shop state
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
        imageUrl: shop.imageUrl || '',
        bannerUrl: shop.bannerUrl || '',
        openingHours: shop.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
        isOpen: shop.status === 'ACTIVE',
      });
      setFormErrors({});
      showToast('Đã hoàn tác các thay đổi chưa lưu.', 'info');
    }
  }, [shop, showToast]);

  const isActive = Boolean(formData.isOpen);

  return (
    <div className="shop-dashboard-layout">
      {/* Branch Manager Sidebar */}
      <BranchSidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      <div className="admin-main-viewport">
        <OwnerTopHeader
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
          breadcrumb="Cửa Hàng & Ghim Map"
        />

        <main className="shop-main-content">
          <div className="store-mgmt-container pb-5">

          {/* Toast Notification */}
          {toast && (
            <div
              className="alert alert-dismissible fade show d-flex align-items-center justify-content-between"
              role="alert"
              style={{
                position: 'fixed',
                top: '24px',
                right: '28px',
                zIndex: 9999,
                minWidth: '340px',
                maxWidth: '480px',
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.15)',
                borderRadius: '12px',
                fontWeight: 500,
                fontSize: '13px',
                background: toast.type === 'error' ? '#FEF2F2' : toast.type === 'warning' ? '#FFFBEB' : '#F0FDF4',
                border: `1px solid ${toast.type === 'error' ? '#FECACA' : toast.type === 'warning' ? '#FDE68A' : '#BBF7D0'}`,
                color: toast.type === 'error' ? '#991B1B' : toast.type === 'warning' ? '#92400E' : '#166534',
                padding: '12px 16px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div className="d-flex align-items-center gap-2">
                {toast.type === 'error' ? (
                  <AlertCircle size={18} className="flex-shrink-0" />
                ) : toast.type === 'warning' ? (
                  <AlertTriangle size={18} className="flex-shrink-0" />
                ) : (
                  <CheckCircle2 size={18} className="flex-shrink-0" />
                )}
                <div>{toast.message}</div>
              </div>
              <button
                type="button"
                className="btn-close"
                onClick={() => setToast(null)}
                style={{ padding: '10px', fontSize: '10px' }}
                aria-label="Đóng thông báo"
              />
            </div>
          )}

          {/* Loading Indicator */}
          {loading ? (
            <div className="text-center py-5 my-5">
              <Spinner animation="border" variant="dark" role="status" className="mb-3" />
              <div className="text-muted small fw-medium">Đang xác thực và tải thông tin cửa hàng của bạn...</div>
            </div>
          ) : !shop ? (
            /* ========================================================
               EMPTY STATE: MANAGER HAS NOT BEEN ASSIGNED A BRANCH YET
               ======================================================== */
            <div className="text-center py-5">
              <div
                style={{
                  maxWidth: '560px',
                  margin: '40px auto',
                  padding: '48px 36px',
                  background: '#FFFFFF',
                  borderRadius: '20px',
                  boxShadow: '0 4px 25px rgba(0,0,0,0.06)',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '20px',
                    background: '#FEF3C7',
                    color: '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 20px auto',
                    boxShadow: '0 8px 16px -4px rgba(245, 158, 11, 0.25)',
                  }}
                >
                  <Building2 size={36} strokeWidth={1.8} />
                </div>
                <h3
                  style={{
                    fontFamily: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                    fontSize: '22px',
                    fontWeight: 700,
                    color: '#0F172A',
                    marginBottom: '12px',
                  }}
                >
                  Chưa Được Phân Công Chi Nhánh
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#64748B',
                    lineHeight: 1.6,
                    marginBottom: '28px',
                  }}
                >
                  Tài khoản của bạn hiện chưa được Chủ sở hữu chuỗi (Shop Owner) bổ nhiệm quản lý cửa hàng nào trong hệ thống VESTORA. Vui lòng liên hệ quản lý để được chỉ định chi nhánh vận hành.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline-secondary px-4 py-2 d-inline-flex align-items-center gap-2"
                    style={{ fontSize: '13px', borderRadius: '8px', fontWeight: 600 }}
                    onClick={() => fetchAssignedBranch()}
                  >
                    <RefreshCw size={14} />
                    <span>Tải Lại Dữ Liệu</span>
                  </button>
                  <Link
                    to="/"
                    className="btn btn-dark px-4 py-2 d-inline-flex align-items-center gap-2"
                    style={{ fontSize: '13px', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', background: '#0F172A' }}
                  >
                    <span>Về Cổng Khách Hàng</span>
                    <ExternalLink size={14} />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================
               STORE CONFIGURATION FORM FOR ASSIGNED BRANCH
               ======================================================== */
            <div>
              {/* Luxury Hero Store Identity Card */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: '20px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
                  overflow: 'hidden',
                  marginBottom: '28px',
                }}
              >
                {/* Store Cover Banner */}
                <div
                  style={{
                    position: 'relative',
                    height: '210px',
                    width: '100%',
                    backgroundColor: '#0F172A',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={formData.bannerUrl || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'}
                    alt="Cover Banner"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: 'brightness(0.92)',
                      cursor: 'pointer',
                      transition: 'transform 0.3s ease',
                    }}
                    onClick={() => {
                      const bannerSrc = formData.bannerUrl || shop?.bannerUrl || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80';
                      setLightboxImage({
                        url: bannerSrc,
                        title: `${formData.name || shop?.name || 'Cửa Hàng'} — Ảnh Bìa (Kích Thước Thật)`,
                      });
                    }}
                    title="Bấm để xem ảnh bìa chi tiết"
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(180deg, rgba(15,23,42,0.15) 0%, rgba(15,23,42,0.65) 100%)',
                      pointerEvents: 'none',
                    }}
                  />
                  {/* Subtle Lightbox Affordance Badge */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '14px',
                      right: '16px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(15, 23, 42, 0.65)',
                      backdropFilter: 'blur(8px)',
                      color: '#FFFFFF',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 500,
                      letterSpacing: '0.3px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      pointerEvents: 'none',
                    }}
                  >
                    <Eye size={13} strokeWidth={2} />
                    <span>Xem ảnh bìa</span>
                  </div>
                </div>

                {/* Store Info Header Section */}
                <div style={{ padding: '0 28px 24px 28px', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginTop: '-42px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '20px' }}>
                      {/* Floating Store Circular Logo */}
                      <div
                        style={{
                          width: '88px',
                          height: '88px',
                          borderRadius: '50%',
                          background: '#FFFFFF',
                          border: '4px solid #FFFFFF',
                          boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
                          overflow: 'hidden',
                          flexShrink: 0,
                          position: 'relative',
                          cursor: (formData.imageUrl || shop?.imageUrl) ? 'pointer' : 'default',
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
                        title={(formData.imageUrl || shop?.imageUrl) ? 'Bấm để xem ảnh logo chi tiết' : 'Logo Cửa Hàng'}
                      >
                        {formData.imageUrl ? (
                          <img
                            src={formData.imageUrl}
                            alt="Logo Cửa Hàng"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div className="d-flex align-items-center justify-content-center h-100 fw-bold" style={{ background: '#F1F5F9' }}>
                            <Store size={32} className="text-slate-400" />
                          </div>
                        )}
                      </div>

                      {/* Title & Micro Tags */}
                      <div style={{ marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              background: '#EEF2FF',
                              color: '#4F46E5',
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              fontWeight: 700,
                              letterSpacing: '0.5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Sparkles size={11} />
                            CHI NHÁNH PHỤ TRÁCH
                          </span>
                          {shop.isHQ && (
                            <span
                              style={{
                                fontSize: '11px',
                                background: '#FEF3C7',
                                color: '#B45309',
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <Star size={11} fill="#B45309" />
                              TRỤ SỞ CHÍNH (HQ)
                            </span>
                          )}
                        </div>
                        <h1 style={{ fontFamily: 'var(--font-title, serif)', fontSize: '26px', margin: 0, color: '#0F172A', fontWeight: 700 }}>
                          {formData.name || shop.name}
                        </h1>
                      </div>
                    </div>

                    {/* Operational Status Pill */}
                    <div style={{ marginBottom: '8px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 16px',
                          borderRadius: '9999px',
                          fontSize: '12px',
                          fontWeight: 700,
                          background: isActive ? '#ECFDF5' : '#FEF3C7',
                          color: isActive ? '#059669' : '#D97706',
                          border: `1px solid ${isActive ? '#A7F3D0' : '#FDE68A'}`,
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: isActive ? '#10B981' : '#F59E0B',
                            display: 'inline-block',
                          }}
                        />
                        {isActive ? 'ĐANG MỞ CỬA TIẾP KHÁCH' : 'TẠM NGƯNG ĐÓN TIẾP'}
                      </span>
                    </div>
                  </div>

                  {/* Quick Info Chip Row */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '14px',
                      marginTop: '22px',
                      paddingTop: '18px',
                      borderTop: '1px solid #F1F5F9',
                    }}
                  >
                    <div style={{ fontSize: '12.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={15} className="text-slate-400 flex-shrink-0" />
                      <div>
                        <strong style={{ color: '#0F172A' }}>Địa Chỉ:</strong>{' '}
                        {formData.address ? `${formData.address}, ` : ''}{formData.city || 'Chưa cập nhật'}
                      </div>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={15} className="text-slate-400 flex-shrink-0" />
                      <div>
                        <strong style={{ color: '#0F172A' }}>Hotline:</strong>{' '}
                        {formData.phone || 'Chưa cập nhật'}
                      </div>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={15} className="text-slate-400 flex-shrink-0" />
                      <div>
                        <strong style={{ color: '#0F172A' }}>Giờ Đón Khách:</strong>{' '}
                        {formData.openingHours || '09:00 - 21:30'}
                      </div>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Navigation size={15} className="text-slate-400 flex-shrink-0" />
                      <div>
                        <strong style={{ color: '#0F172A' }}>Định Vị GPS:</strong>{' '}
                        {formData.latitude && formData.longitude ? (
                          <span style={{ color: '#059669', fontWeight: 600 }}>✓ Đã Ghim Vị Trí</span>
                        ) : (
                          <span style={{ color: '#DC2626', fontWeight: 600 }}>Chưa Ghim Bản Đồ</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <Form onSubmit={handleSubmit} ref={formRef} noValidate>
                <Row className="g-4 g-xl-5">
                  {/* Left Column: Profile, Imagery, Operating Hours */}
                  <Col lg={6}>
                    {/* Card 1: Store Profile & Branding */}
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
                          <Store size={20} />
                        </div>
                        <div>
                          <h5 className="fw-bold mb-0" style={{ fontSize: '16px', color: '#0F172A' }}>
                            Thông Tin Nhận Diện Cửa Hàng
                          </h5>
                          <div className="text-muted small" style={{ fontSize: '12px' }}>
                            Hình ảnh đại diện, ảnh bìa và giới thiệu không gian phục vụ khách hàng
                          </div>
                        </div>
                      </div>

                      <input
                        type="file"
                        ref={bannerFileRef}
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        style={{ display: 'none' }}
                        onChange={(e) => handleUploadImageFile(e, 'banner')}
                      />
                      <input
                        type="file"
                        ref={avatarFileRef}
                        accept="image/png,image/jpeg,image/webp,image/jpg"
                        style={{ display: 'none' }}
                        onChange={(e) => handleUploadImageFile(e, 'avatar')}
                      />

                      {/* Media Upload Area (Logo & Banner) */}
                      <div className="mb-3 p-3" style={{ background: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                        <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom flex-wrap gap-2">
                          <div className="d-flex align-items-center gap-1 fw-semibold" style={{ fontSize: '13px', color: '#1E293B' }}>
                            <ImageIcon size={15} className="text-slate-600" />
                            <span>Hình Ảnh Nhận Diện Cửa Hàng</span>
                          </div>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#059669',
                              background: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Khi bạn tải ảnh mới, ảnh sẽ tự động được lưu ngay vào hệ thống mà không cần bấm nút Lưu bên dưới"
                          >
                            <Check size={12} strokeWidth={2.5} />
                            Tự động lưu khi tải ảnh mới
                          </span>
                        </div>
                        <Row className="g-3 align-items-center">
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
                                  Vuông 1:1, tối đa 10MB • <span style={{ color: '#059669', fontWeight: 500 }}>Tự động lưu</span>
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
                                  Tỉ lệ 16:9, tối đa 10MB • <span style={{ color: '#059669', fontWeight: 500 }}>Tự động lưu</span>
                                </div>
                              </div>
                            </div>
                          </Col>
                        </Row>
                      </div>

                      {/* Name & Phone */}
                      <Row className="g-3 mb-3">
                        <Col md={7}>
                          <Form.Group controlId="branchName">
                            <Form.Label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                              Tên Chi Nhánh Cửa Hàng <span style={{ color: '#EF4444' }}>*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              value={formData.name}
                              onChange={(e) => {
                                setFormData({ ...formData, name: e.target.value });
                                if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: '' }));
                              }}
                              isInvalid={Boolean(formErrors.name)}
                              placeholder="Ví dụ: VESTORA - Cửa Hàng Phố Huế"
                              style={{ fontSize: '13.5px', padding: '10px 14px', borderRadius: '8px' }}
                            />
                            {formErrors.name ? (
                              <div className="vestora-invalid-feedback d-block">{formErrors.name}</div>
                            ) : (
                              <Form.Text className="text-muted" style={{ fontSize: '11.5px' }}>
                                Tên hiển thị công khai trên phiếu giao nhận và bản đồ số
                              </Form.Text>
                            )}
                          </Form.Group>
                        </Col>
                        <Col md={5}>
                          <Form.Group controlId="branchPhone">
                            <Form.Label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                              Hotline Đón Tiếp <span style={{ color: '#EF4444' }}>*</span>
                            </Form.Label>
                            <Form.Control
                              type="text"
                              value={formData.phone}
                              onChange={(e) => {
                                setFormData({ ...formData, phone: e.target.value });
                                if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: '' }));
                              }}
                              isInvalid={Boolean(formErrors.phone)}
                              placeholder="0912 345 678"
                              style={{ fontSize: '13.5px', padding: '10px 14px', borderRadius: '8px' }}
                            />
                            {formErrors.phone ? (
                              <div className="vestora-invalid-feedback d-block">{formErrors.phone}</div>
                            ) : (
                              <Form.Text className="text-muted" style={{ fontSize: '11.5px' }}>
                                Số điện thoại khách liên hệ thử đồ (10 chữ số)
                              </Form.Text>
                            )}
                          </Form.Group>
                        </Col>
                      </Row>

                      {/* Description with Character Counter */}
                      <Form.Group controlId="branchDescription" className="mb-2">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <Form.Label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', margin: 0 }}>
                            Giới Thiệu Không Gian Trải Nghiệm
                          </Form.Label>
                          <span style={{ fontSize: '11.5px', color: formErrors.description ? '#EF4444' : '#94A3B8' }}>
                            {formData.description.length} / 1000 ký tự
                          </span>
                        </div>
                        <Form.Control
                          as="textarea"
                          rows={3}
                          value={formData.description}
                          maxLength={1000}
                          isInvalid={Boolean(formErrors.description)}
                          onChange={(e) => {
                            setFormData({ ...formData, description: e.target.value });
                            if (formErrors.description) setFormErrors((prev) => ({ ...prev, description: '' }));
                          }}
                          placeholder="Mô tả không gian thử đồ cao cấp, phòng VIP riêng tư, bãi đỗ ô tô, đồ uống phục vụ miễn phí..."
                          style={{ fontSize: '13.5px', borderRadius: '8px', lineHeight: 1.6, padding: '10px 14px' }}
                        />
                        {formErrors.description && (
                          <div className="vestora-invalid-feedback d-block">{formErrors.description}</div>
                        )}
                      </Form.Group>
                    </div>

                    {/* Card 2: Schedule & Operating Status */}
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
                          <Clock size={20} />
                        </div>
                        <div>
                          <h5 className="fw-bold mb-0" style={{ fontSize: '16px', color: '#0F172A' }}>
                            Lịch Hoạt Động & Tiếp Khách
                          </h5>
                          <div className="text-muted small" style={{ fontSize: '12px' }}>
                            Quy định khung giờ phục vụ và trạng thái nhận khách hẹn thử đồ tại cửa hàng
                          </div>
                        </div>
                      </div>

                      {/* Interactive Operational Status Switch Card */}
                      <div
                        style={{
                          padding: '16px 18px',
                          borderRadius: '12px',
                          background: isActive ? '#F0FDF4' : '#FFFBEB',
                          border: `1px solid ${isActive ? '#BBF7D0' : '#FDE68A'}`,
                          marginBottom: '20px',
                        }}
                      >
                        <div className="d-flex align-items-center justify-content-between gap-3">
                          <div>
                            <div className="fw-bold" style={{ fontSize: '13px', color: isActive ? '#166534' : '#92400E' }}>
                              {isActive ? '● ĐANG MỞ CỬA PHỤC VỤ KHÁCH HÀNG' : '● TẠM ĐÓNG CỬA CỬA HÀNG'}
                            </div>
                            <div style={{ fontSize: '12px', color: isActive ? '#15803D' : '#B45309', marginTop: '2px' }}>
                              {isActive
                                ? 'Khách hàng có thể tìm thấy cửa hàng trên ứng dụng và đặt lịch hẹn thử đồ trực tiếp.'
                                : 'Tạm dừng đón khách trực tiếp (ví dụ: đang nâng cấp nội thất, kiểm kê hoặc nghỉ lễ).'}
                            </div>
                          </div>
                          <Form.Check
                            type="switch"
                            id="branch-operational-switch"
                            checked={formData.isOpen}
                            onChange={(e) => setFormData({ ...formData, isOpen: e.target.checked })}
                            style={{ fontSize: '20px', cursor: 'pointer' }}
                            title="Bật/Tắt trạng thái mở cửa đón khách"
                          />
                        </div>
                      </div>

                      {/* Opening Hours Input Component */}
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
                            Định vị vị trí cửa ra vào cửa hàng để khách tìm đường và tính cước vận chuyển giao đồ
                          </div>
                        </div>
                      </div>

                      {/* Administrative Division Selects with Fast Search */}
                      <Row className="g-3 mb-3">
                        <Col md={6}>
                          <Form.Group controlId="branchCity">
                            <Form.Label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                              Tỉnh / Thành Phố <span style={{ color: '#EF4444' }}>*</span>
                            </Form.Label>
                            <SearchableSelect
                              id="branchCity"
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
                          <Form.Group controlId="branchWard">
                            <Form.Label style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Phường / Xã</Form.Label>
                            <SearchableSelect
                              id="branchWard"
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
                      <Form.Group controlId="branchAddress" className="mb-3">
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
                        id="branch-map-container"
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
                          <span>Click vào vị trí trên bản đồ để di chuyển ghim đỏ tới cửa hàng</span>
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

                {/* ========================================================
                    STICKY FLOATING ACTIONS BAR (GLASSMORPHISM)
                    ======================================================== */}
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
                        }}
                      >
                        <AlertCircle size={15} />
                        <span>Bạn có thay đổi chưa lưu trên form</span>
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '12.5px',
                          color: '#059669',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <CheckCircle2 size={15} />
                        <span>Dữ liệu cửa hàng đã được đồng bộ mới nhất</span>
                      </span>
                    )}
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary px-3 py-2 d-inline-flex align-items-center gap-1"
                      style={{ fontSize: '13px', borderRadius: '8px', fontWeight: 600 }}
                      onClick={handleReset}
                      disabled={!isDirty || saving}
                    >
                      <RotateCcw size={13} />
                      <span>Hoàn Tác</span>
                    </button>
                    <Button
                      type="submit"
                      variant="dark"
                      className="px-4 py-2 d-inline-flex align-items-center gap-2"
                      style={{
                        fontSize: '13px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        background: '#0F172A',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
                      }}
                      disabled={saving || !isDirty}
                    >
                      {saving ? (
                        <>
                          <Spinner size="sm" animation="border" />
                          <span>Đang Lưu Cập Nhật...</span>
                        </>
                      ) : (
                        <>
                          <Save size={14} />
                          <span>Lưu Cập Nhật Cửa Hàng</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Form>
            </div>
          )}
        </div>

        {/* Lightbox Modal for Image Preview */}
        <ImageLightboxModal
          show={Boolean(lightboxImage)}
          onHide={() => setLightboxImage(null)}
          imageUrl={lightboxImage?.url || (typeof lightboxImage === 'string' ? lightboxImage : '')}
          title={lightboxImage?.title || 'Xem Ảnh Kích Thước Thật'}
        />
      </main>
      </div>
    </div>
  );
}
