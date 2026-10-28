import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Row,
  Col,
  Form,
  Button,
  Spinner,
} from 'react-bootstrap';
import OwnerSidebar from '../../components/OwnerSidebar';
import BranchSidebar from '../../components/BranchSidebar';
import LeafletMapPicker from '../../components/LeafletMapPicker';
import OpeningHoursInput, { parseOpeningHours, DAY_OPTIONS } from '../../components/OpeningHoursInput';
import ImageLightboxModal from '../../components/ImageLightboxModal';
import { useAuth } from '../../context/AuthContext';
import {
  getMyShopApi,
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

export default function OwnerSettingsPage() {
  const { user } = useAuth();
  const formRef = useRef(null);

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [toast, setToast] = useState(null);

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
  const [selectedProvCode, setSelectedProvCode] = useState('');
  const [wards, setWards] = useState([]);
  const [selectedWardCode, setSelectedWardCode] = useState('');
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const wardCache = useRef({});

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const avatarFileRef = useRef(null);
  const bannerFileRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const handleUploadImageFile = async (e, imageType) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Vui lòng chọn tệp định dạng hình ảnh (PNG, JPG, WEBP, JPEG).', 'warning');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Dung lượng ảnh không được vượt quá 10MB.', 'warning');
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    if (imageType === 'avatar') {
      setFormData((prev) => ({ ...prev, imageUrl: localPreviewUrl }));
      setUploadingAvatar(true);
    } else {
      setFormData((prev) => ({ ...prev, bannerUrl: localPreviewUrl }));
      setUploadingBanner(true);
    }

    try {
      const res = await uploadShopImageApi(file, imageType);
      if (res && res.success && res.url) {
        if (imageType === 'avatar') {
          setFormData((prev) => ({ ...prev, imageUrl: res.url }));
        } else {
          setFormData((prev) => ({ ...prev, bannerUrl: res.url }));
        }
        showToast(`Đã tải lên ảnh ${imageType === 'avatar' ? 'đại diện' : 'bìa'} thành công!`, 'success');
      } else {
        throw new Error(res?.message || 'Không thể tải ảnh lên');
      }
    } catch (err) {
      showToast('Lỗi khi tải ảnh từ thiết bị: ' + (err.message || 'Lỗi mạng'), 'warning');
    } finally {
      if (imageType === 'avatar') {
        setUploadingAvatar(false);
        if (avatarFileRef.current) avatarFileRef.current.value = '';
      } else {
        setUploadingBanner(false);
        if (bannerFileRef.current) bannerFileRef.current.value = '';
      }
    }
  };

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
   * Fetch current user's shop profile from database
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
  }, [user]);

  useEffect(() => {
    fetchMyShop();
  }, [fetchMyShop]);

  useEffect(() => {
    if (!provinces.length || !formData.city) return;

    const cleanCity = cleanName(formData.city);
    const matchedProv = provinces.find((p) => {
      const pClean = cleanName(p.name);
      return pClean === cleanCity || cleanCity.includes(pClean) || pClean.includes(cleanCity);
    });

    if (matchedProv) {
      setSelectedProvCode(String(matchedProv.code));
      loadWardsForProvince(matchedProv.code, formData.ward);
    }
  }, [provinces, shop]);

  const loadWardsForProvince = async (provCode, initialWardName = '') => {
    if (!provCode) {
      setWards([]);
      setSelectedWardCode('');
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
  };

  const matchAndSetWard = (wardList, targetWardName) => {
    if (!targetWardName || !wardList.length) return;
    const cleanTarget = cleanName(targetWardName);
    const matched = wardList.find((w) => {
      const wClean = cleanName(w.name);
      return wClean === cleanTarget || cleanTarget.includes(wClean) || wClean.includes(cleanTarget);
    });
    if (matched) {
      setSelectedWardCode(String(matched.code));
    }
  };

  const handleProvinceSelect = (e) => {
    const code = e.target.value;
    setSelectedProvCode(code);
    setSelectedWardCode('');

    const prov = provinces.find((p) => String(p.code) === String(code));
    const provName = prov ? prov.name : '';
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

    loadWardsForProvince(code, '');
  };

  const handleWardSelect = (e) => {
    const code = e.target.value;
    setSelectedWardCode(code);

    const w = wards.find((item) => String(item.code) === String(code));
    const wardName = w ? w.name : '';

    setFormData((prev) => ({
      ...prev,
      ward: wardName,
    }));
  };

  const [isSyncingAddress, setIsSyncingAddress] = useState(false);

  const handleMapLocationChange = useCallback(({ latitude, longitude }) => {
    setFormData((prev) => ({
      ...prev,
      latitude,
      longitude,
    }));
  }, []);

  const handleSyncAddressFromPin = async () => {
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
            setSelectedProvCode(String(matchedProv.code));
            setFormData((prev) => ({
              ...prev,
              city: matchedProv.name,
              ...(street && !prev.address ? { address: street } : {}),
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
                setSelectedWardCode(String(matchedWard.code));
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
  };

  /**
   * Retrieve device geolocation and resolve administrative divisions
   */
  const handleGetDeviceLocation = () => {
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost') {
      const fallback = getProvinceCoords(formData.city) || PROVINCE_DEFAULT_COORDS['Hồ Chí Minh'];
      setFormData((prev) => ({
        ...prev,
        latitude: fallback.lat.toFixed(6),
        longitude: fallback.lng.toFixed(6),
      }));
      showToast('Trình duyệt yêu cầu HTTPS để lấy GPS. Đã tự động định vị theo trung tâm Tỉnh/Thành.', 'info');
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
          const { latitude, longitude } = pos.coords;
          const latFixed = latitude.toFixed(6);
          const lngFixed = longitude.toFixed(6);

          setFormData((prev) => ({
            ...prev,
            latitude: latFixed,
            longitude: lngFixed,
          }));

          try {
            const geoRes = await reverseGeocodeApi(latitude, longitude);
            if (geoRes?.success && geoRes.data) {
              const { city: geoCity, ward: geoWard } = geoRes.data;

              if (geoCity && provinces.length > 0) {
                const cleanCityTarget = cleanName(geoCity);
                const matchedProv = provinces.find((p) => {
                  const pClean = cleanName(p.name);
                  return pClean === cleanCityTarget || cleanCityTarget.includes(pClean) || pClean.includes(cleanCityTarget);
                });

                if (matchedProv) {
                  setSelectedProvCode(String(matchedProv.code));
                  setFormData((prev) => ({
                    ...prev,
                    city: matchedProv.name,
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
                      setSelectedWardCode(String(matchedWard.code));
                      setFormData((prev) => ({
                        ...prev,
                        ward: matchedWard.name,
                      }));
                    }
                  }

                  showToast(`Đã định vị thành công vị trí của bạn tại ${matchedProv.name}!`, 'success');
                } else {
                  showToast('Đã định vị tọa độ GPS thành công!', 'success');
                }
              } else {
                showToast('Đã định vị tọa độ GPS thành công!', 'success');
              }
            } else {
              showToast('Đã lấy tọa độ GPS thành công!', 'success');
            }
          } catch (_) {
            showToast('Đã lấy tọa độ GPS thành công!', 'success');
          }
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        const fallback = getProvinceCoords(formData.city);
        if (fallback) {
          setFormData((prev) => ({
            ...prev,
            latitude: fallback.lat.toFixed(6),
            longitude: fallback.lng.toFixed(6),
          }));
          showToast(`Không nhận được tín hiệu GPS thiết bị. Đã chuyển sang tọa độ trung tâm ${formData.city}!`, 'info');
          return;
        }
        let msg = 'Không thể lấy vị trí hiện tại của thiết bị.';
        if (err.code === 1) msg = 'Quyền truy cập vị trí bị từ chối. Vui lòng cho phép truy cập GPS trên trình duyệt.';
        else if (err.code === 2) msg = 'Không nhận được tín hiệu định vị GPS.';
        else if (err.code === 3) msg = 'Quá thời gian lấy vị trí GPS.';
        showToast(msg, 'warning');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  /**
   * Persist updated showroom profile and address data
   */
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (uploadingAvatar || uploadingBanner) {
      showToast('Đang tải ảnh lên hệ thống, vui lòng chờ trong giây lát...', 'warning');
      return;
    }

    if (formData.imageUrl?.startsWith('blob:') || formData.bannerUrl?.startsWith('blob:')) {
      showToast('Ảnh đang trong quá trình tải lên máy chủ, vui lòng đợi hoàn tất.', 'warning');
      return;
    }

    if (!shop?._id) {
      showToast('Không tìm thấy mã gian hàng để lưu.', 'warning');
      return;
    }

    if (!formData.name.trim() || formData.name.trim().length < 3) {
      showToast('Tên gian hàng phải từ 3 đến 100 ký tự.', 'warning');
      return;
    }

    if (!formData.city.trim()) {
      showToast('Vui lòng chọn Tỉnh / Thành phố.', 'warning');
      return;
    }

    if (formData.address.trim() && formData.address.trim().length > 255) {
      showToast('Địa chỉ chi tiết không được quá 255 ký tự.', 'warning');
      return;
    }

    if (formData.openingHours) {
      const parsedHours = parseOpeningHours(formData.openingHours);
      if (parsedHours.fromTime && parsedHours.toTime && parsedHours.toTime <= parsedHours.fromTime) {
        showToast('Giờ đóng cửa phải sau giờ mở cửa.', 'warning');
        return;
      }
      const fromIdx = DAY_OPTIONS.indexOf(parsedHours.fromDay);
      const toIdx = DAY_OPTIONS.indexOf(parsedHours.toDay);
      if (fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx) {
        showToast(`Thứ kết thúc (${parsedHours.toDay}) phải sau hoặc cùng Thứ bắt đầu (${parsedHours.fromDay}) trong tuần.`, 'warning');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || 'Chưa cập nhật mô tả',
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        ward: formData.ward.trim(),
        latitude: formData.latitude !== '' ? Number(formData.latitude) : null,
        longitude: formData.longitude !== '' ? Number(formData.longitude) : null,
        imageUrl: (formData.imageUrl || '').trim(),
        bannerUrl: (formData.bannerUrl || '').trim(),
        openingHours: formData.openingHours.trim() || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
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
  };

  /**
   * Reset form fields to previously saved shop data
   */
  const handleReset = () => {
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
        openingHours: shop.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
        isOpen: shop.status === 'ACTIVE',
      });
      showToast('Đã hoàn tác các thay đổi chưa lưu.', 'info');
    }
  };

  const isActive = Boolean(formData.isOpen);
  const isBranchManager = /branch_manager/i.test(user?.Role || '');

  return (
    <div className="shop-dashboard-layout">
      {isBranchManager ? <BranchSidebar /> : <OwnerSidebar />}

      <main className="shop-main-content">
        <div className="store-mgmt-container">
          <div className="store-mgmt-breadcrumb">
            {isBranchManager ? (
              <>
                <Link to="/branch/dashboard">Vận Hành Chi Nhánh</Link>
                <span>›</span>
                <span style={{ color: '#171717', fontWeight: 600 }}>Hồ Sơ Showroom & Ghim Bản Đồ</span>
              </>
            ) : (
              <>
                <Link to="/owner/dashboard">Tổng Quan Chuỗi</Link>
                <span>›</span>
                <Link to="/owner/branches">Quản Lý Chi Nhánh</Link>
                <span>›</span>
                <span style={{ color: '#171717', fontWeight: 600 }}>Thông Tin Cửa Hàng</span>
              </>
            )}
          </div>

          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4 border-bottom">
            <div>
              <h1 className="store-mgmt-title">
                {isBranchManager ? 'Hồ Sơ Showroom Chi Nhánh & Ghim Map' : 'Quản Lý Thông Tin Cửa Hàng'}
              </h1>
              <p className="store-mgmt-desc">
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
              <Row className="g-4 g-xl-5">
                <Col lg={6}>
                  <div className="store-edit-panel mb-5">
                    <div className="d-flex align-items-center justify-content-between pb-3 border-bottom mb-3 flex-wrap gap-2">
                      <div>
                        <h5 className="fw-bold mb-1" style={{ fontSize: '16px', color: '#171717' }}>
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

                    <div className="p-4 rounded mb-4" style={{ background: '#FAF9F6', border: '1px solid #ECE7DD' }}>
                      <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                        <div className="fw-bold text-dark" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <polyline points="21 15 16 10 5 21" />
                          </svg>
                          <span>Hình Ảnh Nhận Diện Showroom & Cửa Hàng</span>
                        </div>
                        <span className="text-muted" style={{ fontSize: '11px' }}>
                          Hỗ trợ cả ảnh ngang (16:9) và ảnh dọc điện thoại (9:16)
                        </span>
                      </div>

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

                      <div
                        onClick={() => {
                          if (uploadingAvatar || uploadingBanner) return;
                          if (formData.bannerUrl && !formData.bannerUrl.startsWith('blob:')) {
                            setLightboxImage({
                              url: formData.bannerUrl,
                              title: `${formData.name || 'Gian Hàng'} — Ảnh Bìa Showroom (Kích Thước Gốc)`,
                            });
                          }
                        }}
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '190px',
                          borderRadius: '12px',
                          overflow: 'hidden',
                          background: '#0F172A',
                          marginBottom: '12px',
                          border: '1px solid #CBD5E1',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          cursor: formData.bannerUrl ? 'pointer' : 'default',
                        }}
                        title={formData.bannerUrl ? 'Click vào ảnh để xem 100% kích thước ảnh thật' : ''}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            inset: '-15px',
                            backgroundImage: `url(${formData.bannerUrl || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: 'blur(16px) brightness(0.65)',
                            transform: 'scale(1.1)',
                          }}
                        />
                        <img
                          src={formData.bannerUrl || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'}
                          alt="Banner Preview"
                          onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=1200&q=80'; }}
                          style={{
                            position: 'relative',
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: 'center 20%',
                            filter: 'brightness(0.95)',
                          }}
                        />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(15,23,42,0.7) 0%, transparent 60%)', pointerEvents: 'none' }} />

                        {formData.bannerUrl && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '10px',
                              left: '10px',
                              zIndex: 2,
                              fontSize: '11px',
                              fontWeight: 600,
                              background: 'rgba(15, 23, 42, 0.75)',
                              backdropFilter: 'blur(6px)',
                              color: '#FFF',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              pointerEvents: 'none',
                            }}
                          >
                            <span>🔍 Click xem ảnh thật</span>
                          </div>
                        )}

                        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 3 }} onClick={(e) => e.stopPropagation()}>
                          <Button
                            type="button"
                            variant="light"
                            size="sm"
                            disabled={uploadingBanner}
                            onClick={(e) => {
                              e.stopPropagation();
                              bannerFileRef.current && bannerFileRef.current.click();
                            }}
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 600,
                              borderRadius: '8px',
                              padding: '5px 12px',
                              background: 'rgba(255, 255, 255, 0.95)',
                              backdropFilter: 'blur(6px)',
                              color: '#0F172A',
                              border: '1px solid rgba(255,255,255,0.8)',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                            }}
                          >
                            {uploadingBanner ? <Spinner size="sm" animation="border" /> : '📷 Đổi Ảnh Bìa Từ Thiết Bị'}
                          </Button>
                        </div>

                        <div style={{ position: 'absolute', bottom: '12px', left: '14px', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 3 }}>
                          <div style={{ position: 'relative' }}>
                            <img
                              src={formData.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'Shop')}&background=0F172A&color=D97706&size=120`}
                              alt="Avatar Preview"
                              onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'Shop')}&background=0F172A&color=D97706&size=120`; }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (uploadingAvatar || uploadingBanner) return;
                                if (formData.imageUrl && !formData.imageUrl.startsWith('blob:')) {
                                  setLightboxImage({
                                    url: formData.imageUrl,
                                    title: `${formData.name || 'Gian Hàng'} — Logo Đại Diện (Kích Thước Gốc)`,
                                  });
                                }
                              }}
                              title="Click để phóng to xem logo"
                              style={{
                                width: '52px',
                                height: '52px',
                                borderRadius: '12px',
                                objectFit: 'cover',
                                border: '2.5px solid #FFFFFF',
                                boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
                                background: '#0F172A',
                                cursor: formData.imageUrl ? 'pointer' : 'default',
                              }}
                            />
                            {uploadingAvatar && (
                              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Spinner size="sm" animation="border" variant="light" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div style={{ color: '#FFF', fontWeight: 700, fontSize: '13px', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                              {formData.name || 'Gian Hàng Showroom'}
                            </div>
                            <button
                              type="button"
                              disabled={uploadingAvatar}
                              onClick={(e) => {
                                e.stopPropagation();
                                avatarFileRef.current && avatarFileRef.current.click();
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#FDE68A',
                                padding: 0,
                                fontSize: '11px',
                                fontWeight: 600,
                                textDecoration: 'underline',
                                cursor: 'pointer',
                              }}
                            >
                              {uploadingAvatar ? 'Đang tải lên...' : '📁 Đổi logo / avatar (1:1)'}
                            </button>
                          </div>
                        </div>
                      </div>

                      <Row className="g-3">
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                              URL Logo / Avatar (1:1)
                            </Form.Label>
                            <Form.Control
                              type="url"
                              placeholder="Hoặc dán URL ảnh đại diện..."
                              value={formData.imageUrl}
                              onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                              style={{ fontSize: '12.5px', borderRadius: '8px', padding: '7px 12px' }}
                            />
                          </Form.Group>
                        </Col>
                        <Col md={6}>
                          <Form.Group>
                            <Form.Label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                              URL Ảnh Bìa Showroom (Banner)
                            </Form.Label>
                            <Form.Control
                              type="url"
                              placeholder="Hoặc dán URL ảnh bìa showroom..."
                              value={formData.bannerUrl}
                              onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                              style={{ fontSize: '12.5px', borderRadius: '8px', padding: '7px 12px' }}
                            />
                          </Form.Group>
                        </Col>
                      </Row>
                    </div>

                    <Row className="g-4 mb-4">
                      <Col sm={7}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold mb-1">
                            TÊN GIAN HÀNG <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="text"
                            required
                            placeholder="VD: Quý Tộc Boutique"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            style={{ fontSize: '13.5px', borderRadius: '8px', padding: '9px 12px' }}
                          />
                        </Form.Group>
                      </Col>

                      <Col sm={5}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold mb-1">
                            HOTLINE LIÊN HỆ <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Control
                            type="text"
                            required
                            placeholder="VD: 0908 123 456"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            style={{ fontSize: '13.5px', borderRadius: '8px', padding: '9px 12px' }}
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    <div className="mb-4">
                      <OpeningHoursInput
                        value={formData.openingHours}
                        onChange={(val) => setFormData((prev) => ({ ...prev, openingHours: val }))}
                      />
                    </div>

                    <Form.Group className="mb-0">
                      <Form.Label className="small fw-semibold mb-1">
                        MÔ TẢ GIỚI THIỆU GIAN HÀNG <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        required
                        placeholder="Mô tả phong cách thời trang, dòng sản phẩm chủ đạo (váy cưới, dạ hội, veston cao cấp)..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        style={{ fontSize: '13px', borderRadius: '8px', padding: '9px 12px', lineHeight: '1.5' }}
                      />
                    </Form.Group>
                  </div>

                  <div className="store-edit-panel">
                    <div className="pb-2 border-bottom mb-3">
                      <h5 className="fw-bold mb-1" style={{ fontSize: '16px', color: '#171717' }}>
                        Địa Chỉ Trưng Bày & Đón Khách
                      </h5>
                      <div className="text-muted small" style={{ fontSize: '12px' }}>
                        Địa chỉ chi tiết để khách hàng ghé showroom thử đồ và tiếp nhận hàng hóa
                      </div>
                    </div>

                    <Row className="g-4 mb-4">
                      <Col sm={6}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold mb-1">
                            TỈNH / THÀNH PHỐ <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Select
                            value={selectedProvCode}
                            onChange={handleProvinceSelect}
                            disabled={loadingProvinces}
                            style={{ fontSize: '13px', borderRadius: '8px', padding: '9px 12px' }}
                          >
                            <option value="">-- Chọn Tỉnh / Thành --</option>
                            {provinces.map((p) => (
                              <option key={p.code} value={p.code}>{p.name}</option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>

                      <Col sm={6}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold mb-1">
                            PHƯỜNG / XÃ <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Select
                            value={selectedWardCode}
                            onChange={handleWardSelect}
                            disabled={!selectedProvCode || loadingWards}
                            style={{ fontSize: '13px', borderRadius: '8px', padding: '9px 12px' }}
                          >
                            <option value="">
                              {loadingWards
                                ? 'Đang tải...'
                                : selectedProvCode
                                  ? '-- Chọn Phường / Xã --'
                                  : '-- Chọn Tỉnh trước --'}
                            </option>
                            {wards.map((w) => (
                              <option key={w.code} value={w.code}>{w.name}</option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>

                    <Form.Group className="mb-0">
                      <Form.Label className="small fw-semibold mb-1">
                        ĐỊA CHỈ CHI TIẾT (SỐ NHÀ, TÊN ĐƯỜNG)
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="VD: 124 Nguyễn Trãi"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        style={{ fontSize: '13.5px', borderRadius: '8px', padding: '9px 12px' }}
                      />
                    </Form.Group>
                  </div>
                </Col>

                <Col lg={6}>
                  <div className="store-edit-panel h-100 d-flex flex-column">
                    <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pb-2 border-bottom mb-3">
                      <div>
                        <h5 className="fw-bold mb-1" style={{ fontSize: '16px', color: '#171717' }}>
                          Vị Trí Showroom Trên Bản Đồ
                        </h5>
                        <div className="text-muted small" style={{ fontSize: '12px' }}>
                          Ghim tọa độ chính xác để hiển thị showroom trên bản đồ VESTORA
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline-dark"
                        size="sm"
                        onClick={handleGetDeviceLocation}
                        disabled={isLocating}
                        className="d-inline-flex align-items-center gap-1"
                        style={{ fontSize: '12px', fontWeight: 600, padding: '5px 12px', borderRadius: '8px' }}
                      >
                        {isLocating ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1" />
                            Đang dò...
                          </>
                        ) : (
                          <>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="22" y1="12" x2="18" y2="12" />
                              <line x1="6" y1="12" x2="2" y2="12" />
                              <line x1="12" y1="6" x2="12" y2="2" />
                              <line x1="12" y1="22" x2="12" y2="18" />
                            </svg>
                            <span>Lấy GPS Thiết Bị</span>
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="mb-3 flex-grow-1" style={{ minHeight: '420px' }}>
                      <LeafletMapPicker
                        latitude={formData.latitude}
                        longitude={formData.longitude}
                        onChange={handleMapLocationChange}
                        label={formData.name ? `${formData.name} - VỊ TRÍ SHOWROOM` : 'VỊ TRÍ SHOWROOM'}
                        height="420px"
                      />
                    </div>

                    <div className="d-flex align-items-center justify-content-between p-2 rounded mb-3 flex-wrap gap-2" style={{ background: '#FAF9F6', border: '1px solid #ECE7DD' }}>
                      <div className="d-flex align-items-center gap-2">
                        <span style={{ fontSize: '14px' }}>📍</span>
                        <span className="small text-muted" style={{ fontSize: '12px' }}>
                          Tọa độ GPS: <strong style={{ color: '#171717', fontFamily: 'monospace' }}>
                            {formData.latitude && formData.longitude
                              ? `${Number(formData.latitude).toFixed(5)}° N, ${Number(formData.longitude).toFixed(5)}° E`
                              : 'Chưa ghim tọa độ'}
                          </strong>
                        </span>
                      </div>

                      <Button
                        type="button"
                        variant="outline-secondary"
                        size="sm"
                        onClick={handleSyncAddressFromPin}
                        disabled={isSyncingAddress || !formData.latitude || !formData.longitude}
                        className="d-inline-flex align-items-center gap-1"
                        style={{ fontSize: '11.5px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px' }}
                        title="Giải mã vị trí ghim để tự động điền Tỉnh/Thành & Phường/Xã"
                      >
                        {isSyncingAddress ? 'Đang dò...' : '🔄 Điền địa chỉ theo ghim'}
                      </Button>
                    </div>

                    <div className="d-flex align-items-center justify-content-end gap-2 pt-3 border-top mt-auto">
                      <Button
                        type="button"
                        variant="outline-secondary"
                        onClick={handleReset}
                        disabled={saving}
                        style={{ fontSize: '13px', fontWeight: 600, borderRadius: '8px', padding: '9px 18px' }}
                      >
                        HỦY BỎ
                      </Button>
                      <Button
                        type="submit"
                        variant="dark"
                        disabled={saving || uploadingAvatar || uploadingBanner || !shop}
                        style={{ fontSize: '13px', fontWeight: 600, borderRadius: '8px', padding: '9px 24px', minWidth: '150px' }}
                      >
                        {saving ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1" />
                            Đang lưu...
                          </>
                        ) : uploadingAvatar || uploadingBanner ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1" />
                            Đang tải ảnh lên...
                          </>
                        ) : (
                          '💾 LƯU THAY ĐỔI'
                        )}
                      </Button>
                    </div>
                  </div>
                </Col>
              </Row>
            </Form>
          )}
        </div>
      </main>

      {toast && (
        <div className={`store-floating-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}
      <ImageLightboxModal
        show={Boolean(lightboxImage)}
        onHide={() => setLightboxImage(null)}
        imageUrl={lightboxImage?.url}
        title={lightboxImage?.title}
      />
    </div>
  );
}
