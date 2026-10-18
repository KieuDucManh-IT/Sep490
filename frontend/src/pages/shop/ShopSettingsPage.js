import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Form,
  Button,
  Spinner,
} from 'react-bootstrap';
import ShopSidebar from '../../components/ShopSidebar';
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

export default function ShopSettingsPage() {
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

    setFormData((prev) => ({
      ...prev,
      city: provName,
      ward: '',
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

  // 4. LẤY GPS THIẾT BỊ VÀ TỰ ĐỘNG FILL TỈNH / THÀNH & PHƯỜNG / XÃ
  const handleGetDeviceLocation = () => {
    if (!navigator.geolocation) {
      showToast('Trình duyệt của bạn không hỗ trợ định vị GPS.', 'warning');
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
              const { city: geoCity, ward: geoWard, street: geoStreet } = geoRes.data;

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

  const fullDisplayAddress = [formData.address, formData.ward, formData.city].filter(Boolean).join(', ') || 'Chưa cập nhật địa chỉ';
  const hasGps = formData.latitude && formData.longitude && !isNaN(Number(formData.latitude)) && !isNaN(Number(formData.longitude));
  const isActive = Boolean(formData.isOpen);
  const ownerFullName = shop?.ownerId?.FullName || shop?.ownerId?.fullName || user?.fullName || user?.FullName || '';

  return (
    <div className="shop-dashboard-layout">
      {/* Sidebar Navigation */}
      <ShopSidebar />

      {/* Main Content Area */}
      <main className="shop-main-content">
        <div className="store-mgmt-container">
          {/* Breadcrumb Navigation */}
          <div className="store-mgmt-breadcrumb">
            <Link to="/shop/dashboard">Trang Chủ Shop</Link>
            <span>›</span>
            <span>Gian Hàng</span>
            <span>›</span>
            <span style={{ color: '#171717', fontWeight: 600 }}>Quản Lý Thông Tin Cửa Hàng</span>
          </div>

          {/* Top Header */}
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 mb-4">
            <div>
              <h1 className="store-mgmt-title">Quản Lý Thông Tin Cửa Hàng</h1>
              <p className="store-mgmt-desc">
                Quản lý hồ sơ thương hiệu, hotline liên hệ, địa chỉ showroom và vị trí trên bản đồ phục vụ giao nhận & khách ghé thử đồ trực tiếp.
              </p>
            </div>

            <div className="d-flex align-items-center gap-3">
              <span className={`store-pill-active ${shop?.status !== 'ACTIVE' ? 'inactive' : ''}`}>
                ● {shop?.status === 'ACTIVE' ? '1 GIAN HÀNG HOẠT ĐỘNG' : (shop?.status === 'SUSPENDED' ? 'GIAN HÀNG TẠM NGHỈ' : 'HỒ SƠ CHỜ DUYỆT')}
              </span>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5 my-5">
              <Spinner animation="border" variant="dark" role="status" className="mb-2" />
              <div className="text-muted small">Đang tải hồ sơ cửa hàng từ hệ thống...</div>
            </div>
          ) : (
            <Row className="g-4">
              {/* ========================================================
                  CỘT TRÁI (COL 7): SHOWROOM CARD & TIÊU CHUẨN THỬ ĐỒ VIP
                  ======================================================== */}
              <Col lg={7}>
                {/* Unified Shop Information Card */}
                <div className="store-showroom-card">
                  {/* Header: Avatar, Name, Badges & Status Switch */}
                  <div className="d-flex align-items-center justify-content-between flex-wrap gap-3 pb-3 border-bottom mb-3">
                    <div className="d-flex align-items-center gap-3">
                      <img
                        src={formData.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.name || 'Shop')}&background=171717&color=fff&size=80`}
                        alt={formData.name}
                        style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', border: '1px solid #ECE7DD' }}
                      />
                      <div>
                        <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                          <h4 className="fw-bold mb-0" style={{ fontSize: '18px', color: '#171717' }}>
                            {formData.name || shop?.name || 'Showroom Trụ Sở Chính'}
                          </h4>
                          <span className="store-badge-hq">TRỤ SỞ CHÍNH</span>
                        </div>
                        <span className="badge bg-light text-muted border" style={{ fontSize: '11px' }}>
                          {ownerFullName ? `Chủ sở hữu: ${ownerFullName}` : 'Gian Hàng Premium'}
                        </span>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <span style={{ fontSize: '12px', fontWeight: 600, color: isActive ? '#059669' : '#D97706' }}>
                        ● {isActive ? 'ĐANG HOẠT ĐỘNG' : 'TẠM NGHỈ'}
                      </span>
                      <Form.Check
                        type="switch"
                        id="shop-active-switch"
                        checked={formData.isOpen}
                        onChange={(e) => setFormData({ ...formData, isOpen: e.target.checked })}
                      />
                    </div>
                  </div>

                  {/* Mô tả phong cách gian hàng */}
                  <div className="p-3 rounded mb-3" style={{ background: '#F9FAFB', border: '1px solid #F3F4F6' }}>
                    <p className="text-secondary small mb-0" style={{ lineHeight: '1.6', fontSize: '13px' }}>
                      {formData.description || 'Chưa có mô tả phong cách gian hàng. Hãy cập nhật phần giới thiệu để khách hàng hiểu rõ hơn về các bộ sưu tập của bạn.'}
                    </p>
                  </div>

                  {/* Address & Contact Info Lines */}
                  <div className="store-info-line">
                    <span className="store-info-icon">📍</span>
                    <div>
                      <div className="fw-semibold text-dark">{fullDisplayAddress}</div>
                      <div className="small text-muted" style={{ fontSize: '12px' }}>
                        Tọa độ GPS: {hasGps ? `${Number(formData.latitude).toFixed(4)}° N, ${Number(formData.longitude).toFixed(4)}° E` : 'Chưa định vị tọa độ'}
                      </div>
                    </div>
                  </div>

                  <div className="store-info-line">
                    <span className="store-info-icon">🕒</span>
                    <div style={{ fontSize: '13px', color: '#4B5563' }}>
                      <span className="fw-semibold text-dark">{formData.openingHours || '09:00 - 21:30 (Thứ 2 - Chủ Nhật)'}</span> • Mở cửa đón khách thử đồ
                    </div>
                  </div>

                  <div className="store-info-line">
                    <span className="store-info-icon">📞</span>
                    <div className="fw-semibold text-dark" style={{ fontSize: '13.5px' }}>
                      Hotline: {formData.phone || shop?.phone || 'Chưa cập nhật'}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="d-flex align-items-center justify-content-end pt-3 border-top mt-2">
                    <Button
                      variant="outline-dark"
                      size="sm"
                      style={{ fontSize: '12px', fontWeight: 600, padding: '5px 14px', borderRadius: '6px' }}
                      onClick={() => {
                        if (formRef.current) {
                          formRef.current.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                    >
                      ✏️ Chỉnh Sửa
                    </Button>
                  </div>
                </div>
              </Col>

              {/* ========================================================
                  CỘT PHẢI (COL 5): FORM CẬP NHẬT THÔNG TIN CỬA HÀNG
                  ======================================================== */}
              <Col lg={5} ref={formRef}>
                <div className="store-edit-panel">
                  {/* Panel Header */}
                  <div className="mb-2">
                    <h5 className="fw-bold mb-1" style={{ fontSize: '17px', color: '#171717' }}>
                      Cập Nhật Thông Tin Cửa Hàng
                    </h5>
                  </div>
                  <p className="text-muted small mb-4" style={{ fontSize: '12.5px' }}>
                    Thông tin vị trí hiển thị trên bản đồ tìm kiếm shop của khách hàng trên toàn nền tảng VESTORA.
                  </p>

                  <Form onSubmit={handleSubmit}>
                    {/* Tên gian hàng */}
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-semibold mb-1">
                        TÊN GIAN HÀNG <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        required
                        placeholder="VD: Quý Tộc Boutique"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        style={{ fontSize: '13.5px', borderRadius: '8px', padding: '10px 14px' }}
                      />
                    </Form.Group>

                    {/* Hotline liên hệ */}
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-semibold mb-1">
                        HOTLINE LIÊN HỆ <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        required
                        placeholder="VD: 0908 123 456"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        style={{ fontSize: '13px', borderRadius: '8px', padding: '9px 12px' }}
                      />
                    </Form.Group>

                    {/* Thời gian mở cửa: 4 ô (2 ô time & 2 ô thứ dropdown) */}
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-semibold mb-1">
                        THỜI GIAN MỞ CỬA <span className="text-danger">*</span>
                      </Form.Label>
                      <Row className="g-2">
                        {/* 2 ô cho thời gian (type: time) */}
                        <Col sm={6}>
                          <div className="d-flex align-items-center gap-2">
                            <div style={{ flex: 1 }}>
                              <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>
                                TỪ GIỜ
                              </div>
                              <Form.Control
                                type="time"
                                required
                                value={fromTime}
                                onChange={(e) => handleTimeChange(e.target.value, toTime, fromDay, toDay)}
                                style={{ fontSize: '13px', borderRadius: '8px', padding: '8px 10px' }}
                                title="Từ giờ mở cửa"
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>
                                ĐẾN GIỜ
                              </div>
                              <Form.Control
                                type="time"
                                required
                                value={toTime}
                                onChange={(e) => handleTimeChange(fromTime, e.target.value, fromDay, toDay)}
                                style={{ fontSize: '13px', borderRadius: '8px', padding: '8px 10px' }}
                                title="Đến giờ đóng cửa"
                              />
                            </div>
                          </div>
                        </Col>

                        {/* 2 ô cho thứ (dropdown) */}
                        <Col sm={6}>
                          <div className="d-flex align-items-center gap-2">
                            <div style={{ flex: 1 }}>
                              <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>
                                TỪ THỨ
                              </div>
                              <Form.Select
                                value={fromDay}
                                onChange={(e) => handleTimeChange(fromTime, toTime, e.target.value, toDay)}
                                style={{ fontSize: '13px', borderRadius: '8px', padding: '8px 10px' }}
                                title="Từ ngày trong tuần"
                              >
                                {DAY_OPTIONS.map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
                                ))}
                              </Form.Select>
                            </div>
                            <div style={{ flex: 1 }}>
                              <div className="text-muted mb-1" style={{ fontSize: '11px', fontWeight: 600 }}>
                                ĐẾN THỨ
                              </div>
                              <Form.Select
                                value={toDay}
                                onChange={(e) => handleTimeChange(fromTime, toTime, fromDay, e.target.value)}
                                style={{ fontSize: '13px', borderRadius: '8px', padding: '8px 10px' }}
                                title="Đến ngày trong tuần"
                              >
                                {DAY_OPTIONS.map((d) => (
                                  <option key={d} value={d}>
                                    {d}
                                  </option>
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

                    {/* Mô tả gian hàng */}
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-semibold mb-1">
                        MÔ TẢ GIAN HÀNG <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        required
                        placeholder="Giới thiệu phong cách thiết kế, trang phục dạ hội/vest..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        style={{ fontSize: '13px', borderRadius: '8px', padding: '10px 14px' }}
                      />
                    </Form.Group>

                    {/* Địa chỉ chi tiết */}
                    <Form.Group className="mb-3">
                      <Form.Label className="small fw-semibold mb-1">
                        ĐỊA CHỈ ĐẦY ĐỦ (SỐ NHÀ, TÊN ĐƯỜNG)
                      </Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="VD: 124 Nguyễn Trãi (không bắt buộc)"
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        style={{ fontSize: '13.5px', borderRadius: '8px', padding: '10px 14px' }}
                      />
                    </Form.Group>

                    {/* Tỉnh/Thành phố & Phường/Xã (API open-api.vn v2) */}
                    <Row className="g-2 mb-3">
                      <Col sm={6}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold mb-1">
                            THÀNH PHỐ / TỈNH <span className="text-danger">*</span>
                          </Form.Label>
                          <Form.Select
                            value={selectedProvCode}
                            onChange={handleProvinceSelect}
                            disabled={loadingProvinces}
                            style={{ fontSize: '13px', borderRadius: '8px', padding: '9px 12px' }}
                          >
                            <option value="">-- Chọn Tỉnh / Thành --</option>
                            {provinces.map((p) => (
                              <option key={p.code} value={p.code}>
                                {p.name}
                              </option>
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
                              <option key={w.code} value={w.code}>
                                {w.name}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                    </Row>

                    {/* Vĩ độ & Kinh độ */}
                    <Row className="g-2 mb-3">
                      <Col sm={6}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold mb-1">VĨ ĐỘ (LATITUDE)</Form.Label>
                          <Form.Control
                            type="number"
                            step="any"
                            placeholder="VD: 10.7712"
                            value={formData.latitude}
                            onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                            style={{ fontSize: '13px', borderRadius: '8px', padding: '9px 12px' }}
                          />
                        </Form.Group>
                      </Col>

                      <Col sm={6}>
                        <Form.Group>
                          <Form.Label className="small fw-semibold mb-1">KINH ĐỘ (LONGITUDE)</Form.Label>
                          <Form.Control
                            type="number"
                            step="any"
                            placeholder="VD: 106.6924"
                            value={formData.longitude}
                            onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                            style={{ fontSize: '13px', borderRadius: '8px', padding: '9px 12px' }}
                          />
                        </Form.Group>
                      </Col>
                    </Row>

                    {/* Định vị vệ tinh bản đồ & nút GPS */}
                    <div className="mb-3">
                      <div className="d-flex align-items-center justify-content-between mb-2">
                        <span className="small fw-bold text-uppercase" style={{ fontSize: '11px', letterSpacing: '0.5px', color: '#4B5563' }}>
                          ĐỊNH VỊ VỆ TINH BẢN ĐỒ
                        </span>
                        <Button
                          type="button"
                          variant="outline-primary"
                          size="sm"
                          onClick={handleGetDeviceLocation}
                          disabled={isLocating}
                          style={{ fontSize: '12px', fontWeight: 600, padding: '4px 12px', borderRadius: '6px' }}
                        >
                          {isLocating ? (
                            <>
                              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-1" />
                              Đang định vị...
                            </>
                          ) : (
                            '🎯 TỰ ĐỘNG ĐỊNH VỊ QUA GPS'
                          )}
                        </Button>
                      </div>

                      {/* Map Preview */}
                      <div className="store-map-preview-box">
                        <iframe
                          title="Bản đồ vị trí showroom"
                          width="100%"
                          height="100%"
                          style={{ border: 0, display: 'block' }}
                          loading="lazy"
                          src={`https://maps.google.com/maps?q=${formData.latitude || encodeURIComponent(fullDisplayAddress)},${formData.longitude || ''}&hl=vi&z=15&output=embed`}
                        />
                        <div className="store-map-overlay-badge">
                          <span>📍</span>
                          <span>{formData.city ? `${formData.city} - ĐÃ GHIM` : 'VỊ TRÍ SHOWROOM'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="d-flex align-items-center justify-content-end gap-2 pt-2 border-top">
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
                  </Form>
                </div>
              </Col>
            </Row>
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
