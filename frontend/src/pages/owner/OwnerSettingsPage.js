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
import { useAuth } from '../../context/AuthContext';
import {
  getMyShopApi,
  updateShopInfoApi,
  reverseGeocodeApi,
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

const DAY_OPTIONS = [
  'Thứ 2',
  'Thứ 3',
  'Thứ 4',
  'Thứ 5',
  'Thứ 6',
  'Thứ 7',
  'Chủ Nhật',
];

const parseOpeningHours = (hoursStr) => {
  const defaultVal = {
    fromTime: '09:00',
    toTime: '21:30',
    fromDay: 'Thứ 2',
    toDay: 'Chủ Nhật',
  };
  if (!hoursStr) return defaultVal;

  const timeMatch = hoursStr.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (timeMatch) {
    defaultVal.fromTime = timeMatch[1].padStart(5, '0');
    defaultVal.toTime = timeMatch[2].padStart(5, '0');
  }

  const daysMatch = hoursStr.match(/\((.*?)\)/);
  if (daysMatch) {
    const parts = daysMatch[1].split('-').map((s) => s.trim());
    if (parts.length === 2) {
      if (DAY_OPTIONS.includes(parts[0])) defaultVal.fromDay = parts[0];
      if (DAY_OPTIONS.includes(parts[1])) defaultVal.toDay = parts[1];
    } else if (parts.length === 1 && DAY_OPTIONS.includes(parts[0])) {
      defaultVal.fromDay = parts[0];
      defaultVal.toDay = parts[0];
    }
  }

  return defaultVal;
};

const formatOpeningHours = (fTime, tTime, fDay, tDay) => {
  const dayStr = fDay === tDay ? fDay : `${fDay} - ${tDay}`;
  return `${fTime || '09:00'} - ${tTime || '21:30'} (${dayStr})`;
};

export default function OwnerSettingsPage() {
  const { user } = useAuth();
  const formRef = useRef(null);

  const [shop, setShop] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [toast, setToast] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    phone: '',
    address: '',
    city: '',
    district: '',
    ward: '',
    latitude: '',
    longitude: '',
    imageUrl: '',
    openingHours: '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
    isOpen: true,
  });

  // 4 ô thời gian mở cửa: 2 ô time (từ - đến) & 2 ô thứ dropdown (từ - đến)
  const [fromTime, setFromTime] = useState('09:00');
  const [toTime, setToTime] = useState('21:30');
  const [fromDay, setFromDay] = useState('Thứ 2');
  const [toDay, setToDay] = useState('Chủ Nhật');

  const handleTimeChange = (newFromTime, newToTime, newFromDay, newToDay) => {
    setFromTime(newFromTime);
    setToTime(newToTime);
    setFromDay(newFromDay);
    setToDay(newToDay);
    const formatted = formatOpeningHours(newFromTime, newToTime, newFromDay, newToDay);
    setFormData((prev) => ({ ...prev, openingHours: formatted }));
  };

  // Administrative Divisions API state (open-api.vn v2)
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

  // 1. Tải danh mục 34 Tỉnh / Thành phố từ API open-api.vn v2
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

  // 2. Tải thông tin gian hàng thật từ MongoDB của Shop Owner hiện tại
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
          district: '',
          ward: s.ward || '',
          latitude: s.latitude != null ? String(s.latitude) : '',
          longitude: s.longitude != null ? String(s.longitude) : '',
          imageUrl: s.imageUrl || '',
          openingHours: s.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
          isOpen: s.status === 'ACTIVE',
        });

        const parsedHours = parseOpeningHours(s.openingHours);
        setFromTime(parsedHours.fromTime);
        setToTime(parsedHours.toTime);
        setFromDay(parsedHours.fromDay);
        setToDay(parsedHours.toDay);
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

  // 3. Khớp Tỉnh/Thành & Phường/Xã từ thông tin gian hàng vào dropdown hành chính
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 4. LẤY GPS THIẾT BỊ VÀ TỰ ĐỘNG FILL TỈNH / THÀNH & PHƯỜNG / XÃ (Có Fallback Lớp 1)
  const handleGetDeviceLocation = () => {
    // HTTPS Guard: Trình duyệt chặn Geolocation trên mạng LAN HTTP
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

          // 1. Fill ngay tọa độ GPS vào form
          setFormData((prev) => ({
            ...prev,
            latitude: latFixed,
            longitude: lngFixed,
          }));

          // 2. Reverse geocoding để xác định Tỉnh/Thành & Phường/Xã
          try {
            const geoRes = await reverseGeocodeApi(latitude, longitude);
            if (geoRes?.success && geoRes.data) {
              const { city: geoCity, ward: geoWard } = geoRes.data;

              // Đối soát và tự động fill Tỉnh/Thành
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

                  // Tải và đối soát danh sách Phường/Xã
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

  // 5. Lưu toàn bộ thông tin & địa chỉ vào cơ sở dữ liệu MongoDB
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

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

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || 'Chưa cập nhật mô tả',
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        district: '',
        ward: formData.ward.trim(),
        latitude: formData.latitude !== '' ? Number(formData.latitude) : null,
        longitude: formData.longitude !== '' ? Number(formData.longitude) : null,
        imageUrl: formData.imageUrl.trim(),
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

  const handleReset = () => {
    if (shop) {
      setFormData({
        name: shop.name || '',
        description: shop.description || '',
        phone: shop.phone || '',
        address: shop.address || '',
        city: shop.city || '',
        district: '',
        ward: shop.ward || '',
        latitude: shop.latitude != null ? String(shop.latitude) : '',
        longitude: shop.longitude != null ? String(shop.longitude) : '',
        imageUrl: shop.imageUrl || '',
        openingHours: shop.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)',
        isOpen: shop.status === 'ACTIVE',
      });

      const parsedHours = parseOpeningHours(shop.openingHours);
      setFromTime(parsedHours.fromTime);
      setToTime(parsedHours.toTime);
      setFromDay(parsedHours.fromDay);
      setToDay(parsedHours.toDay);
      showToast('Đã hoàn tác các thay đổi chưa lưu.', 'info');
    }
  };

  const isActive = Boolean(formData.isOpen);
  const isBranchManager = /branch_manager/i.test(user?.Role || '');

  return (
    <div className="shop-dashboard-layout">
      {/* Sidebar Navigation */}
      {isBranchManager ? <BranchSidebar /> : <OwnerSidebar />}

      {/* Main Content Area */}
      <main className="shop-main-content">
        <div className="store-mgmt-container">
          {/* Breadcrumb Navigation */}
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

          {/* Top Header */}
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
              <Row className="g-4">
                {/* ========================================================
                    CỘT TRÁI (COL 6): THÔNG TIN GIAN HÀNG & ĐỊA CHỈ HÀNH CHÍNH
                    ======================================================== */}
                <Col lg={6}>
                  {/* Card 1: Thông tin thương hiệu & Vận hành */}
                  <div className="store-edit-panel mb-4">
                    <div className="d-flex align-items-center justify-content-between pb-3 border-bottom mb-3 flex-wrap gap-2">
                      <div>
                        <h5 className="fw-bold mb-1" style={{ fontSize: '16px', color: '#171717' }}>
                          Hồ Sơ Gian Hàng & Liên Hệ
                        </h5>
                        <div className="text-muted small" style={{ fontSize: '12px' }}>
                          Thông tin nhận diện cửa hàng hiển thị với khách hàng
                        </div>
                      </div>

                      {/* Trạng thái hoạt động switch */}
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

                    {/* Logo/Ảnh đại diện & Tên gian hàng */}
                    <div className="d-flex align-items-center gap-3 mb-3 p-3 rounded" style={{ background: '#FAF9F6', border: '1px solid #ECE7DD' }}>
                      <img
                        src={formData.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'Shop')}&background=18181B&color=F59E0B&size=100`}
                        alt={formData.name}
                        style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #D97706', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1 }}>
                        <Form.Label className="small fw-semibold mb-1" style={{ fontSize: '11px', textTransform: 'uppercase', color: '#6B7280', letterSpacing: '0.5px' }}>
                          LINK ẢNH ĐẠI DIỆN GIAN HÀNG
                        </Form.Label>
                        <Form.Control
                          type="url"
                          placeholder="https://... (URL ảnh đại diện)"
                          value={formData.imageUrl}
                          onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                          style={{ fontSize: '13px', borderRadius: '8px', padding: '7px 12px' }}
                        />
                      </div>
                    </div>

                    <Row className="g-3 mb-3">
                      {/* Tên gian hàng */}
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

                      {/* Hotline liên hệ */}
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

                    {/* Thời gian mở cửa */}
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-semibold mb-1">
                        THỜI GIAN MỞ CỬA <span className="text-danger">*</span>
                      </Form.Label>
                      <Row className="g-2">
                        <Col sm={6}>
                          <div className="d-flex align-items-center gap-2">
                            <div style={{ flex: 1 }}>
                              <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>TỪ GIỜ</div>
                              <Form.Control
                                type="time"
                                required
                                value={fromTime}
                                onChange={(e) => handleTimeChange(e.target.value, toTime, fromDay, toDay)}
                                style={{ fontSize: '13px', borderRadius: '8px', padding: '7px 10px' }}
                                title="Giờ mở cửa"
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>ĐẾN GIỜ</div>
                              <Form.Control
                                type="time"
                                required
                                value={toTime}
                                onChange={(e) => handleTimeChange(fromTime, e.target.value, fromDay, toDay)}
                                style={{ fontSize: '13px', borderRadius: '8px', padding: '7px 10px' }}
                                title="Giờ đóng cửa"
                              />
                            </div>
                          </div>
                        </Col>

                        <Col sm={6}>
                          <div className="d-flex align-items-center gap-2">
                            <div style={{ flex: 1 }}>
                              <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>TỪ THỨ</div>
                              <Form.Select
                                value={fromDay}
                                onChange={(e) => handleTimeChange(fromTime, toTime, e.target.value, toDay)}
                                style={{ fontSize: '13px', borderRadius: '8px', padding: '7px 10px' }}
                              >
                                {DAY_OPTIONS.map((d) => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </Form.Select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>ĐẾN THỨ</div>
                              <Form.Select
                                value={toDay}
                                onChange={(e) => handleTimeChange(fromTime, toTime, fromDay, e.target.value)}
                                style={{ fontSize: '13px', borderRadius: '8px', padding: '7px 10px' }}
                              >
                                {DAY_OPTIONS.map((d) => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </Form.Select>
                            </div>
                          </div>
                        </Col>
                      </Row>
                      <div className="text-muted mt-1" style={{ fontSize: '11.5px' }}>
                        Hiển thị trên hồ sơ: <span className="fw-semibold text-dark">{formData.openingHours}</span>
                      </div>
                    </Form.Group>

                    {/* Mô tả phong cách gian hàng */}
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

                  {/* Card 2: Địa chỉ hành chính */}
                  <div className="store-edit-panel">
                    <div className="pb-2 border-bottom mb-3">
                      <h5 className="fw-bold mb-1" style={{ fontSize: '16px', color: '#171717' }}>
                        Địa Chỉ Trưng Bày & Đón Khách
                      </h5>
                      <div className="text-muted small" style={{ fontSize: '12px' }}>
                        Địa chỉ chi tiết để khách hàng ghé showroom thử đồ và tiếp nhận hàng hóa
                      </div>
                    </div>

                    {/* Tỉnh/Thành phố & Phường/Xã */}
                    <Row className="g-3 mb-3">
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

                    {/* Địa chỉ chi tiết */}
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

                {/* ========================================================
                    CỘT PHẢI (COL 6): TỌA ĐỘ VÀ BẢN ĐỒ VỊ TRÍ SHOWROOM
                    ======================================================== */}
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

                    {/* Interactive Leaflet Map - Rộng rãi, chiều cao 380px */}
                    <div className="mb-3 flex-grow-1" style={{ minHeight: '380px' }}>
                      <LeafletMapPicker
                        latitude={formData.latitude}
                        longitude={formData.longitude}
                        onChange={handleMapLocationChange}
                        label={formData.name ? `${formData.name} - VỊ TRÍ SHOWROOM` : 'VỊ TRÍ SHOWROOM'}
                        height="380px"
                      />
                    </div>

                    {/* Bar trạng thái tọa độ & Sync button */}
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

                    {/* Action Buttons */}
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
                        disabled={saving || !shop}
                        style={{ fontSize: '13px', fontWeight: 600, borderRadius: '8px', padding: '9px 24px', minWidth: '150px' }}
                      >
                        {saving ? (
                          <>
                            <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1" />
                            Đang lưu...
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

      {/* Floating Luxury Toast */}
      {toast && (
        <div className={`store-floating-toast ${toast.type}`}>
          <span>{toast.type === 'success' ? '✓' : '⚠️'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
