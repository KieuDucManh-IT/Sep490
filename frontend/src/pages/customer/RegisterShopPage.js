import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import apiClient from '../../services/api';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import '../../styles/RegisterShop.css';

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

function FileUploadControl({ label, field, accept, hint, fileData, fileInfo, error, onUpload, onRemove }) {
  const inputRef = useRef(null);

  return (
    <div className="vestora-form-group">
      <label className="vestora-label">
        {label} <span className="required-dot">*</span>
      </label>
      <input
        type="file"
        ref={inputRef}
        accept={accept || "image/*,.pdf"}
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            onUpload(field, e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {!fileData ? (
        <>
          <div
            className={`vestora-file-dropzone ${error ? 'error' : ''}`}
            onClick={() => inputRef.current && inputRef.current.click()}
          >
            <div className="vestora-file-dropzone-title">Chọn tệp từ máy tính của bạn</div>
            <div className="vestora-file-dropzone-sub">
              {hint || 'Hỗ trợ định dạng JPG, PNG, WEBP, PDF (tối đa 8MB)'}
            </div>
          </div>
          {error && <span className="vestora-field-error">{error}</span>}
        </>
      ) : (
        <div className="vestora-file-selected-box">
          <div className="vestora-file-thumb">
            {fileData.startsWith('data:image') || fileData.startsWith('http') ? (
              <img src={fileData} alt={label} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '10px', color: '#737373', fontWeight: 600 }}>
                TỆP PDF
              </div>
            )}
          </div>
          <div className="vestora-file-meta">
            <div className="vestora-file-name">
              {fileInfo?.name || 'Tệp đã chọn'}
            </div>
            <div className="vestora-file-size">
              {fileInfo?.size || 'Đã tải lên từ máy'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="vestora-file-remove-btn"
              onClick={() => inputRef.current && inputRef.current.click()}
            >
              Đổi tệp
            </button>
            <button
              type="button"
              className="vestora-file-remove-btn"
              style={{ color: '#DC2626' }}
              onClick={() => onRemove(field)}
            >
              Gỡ bỏ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DocPreviewModal({ doc, onClose }) {
  if (!doc) return null;

  return (
    <div className="register-shop-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="register-shop-modal-box">
        <div className="register-shop-modal-header">
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#171717' }}>
            {doc.title}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#737373' }}
          >
            ✕
          </button>
        </div>

        <div className="register-shop-modal-body">
          {doc.url ? (
            doc.url.startsWith('data:application/pdf') ? (
              <iframe src={doc.url} title="PDF Preview" width="100%" height="450px" style={{ border: 'none' }} />
            ) : (
              <img src={doc.url} alt={doc.title} className="register-shop-modal-img" />
            )
          ) : (
            <div style={{ textAlign: 'center', color: '#737373', padding: '30px' }}>
              Không thể tải nội dung tệp.
            </div>
          )}
        </div>

        <div className="register-shop-modal-footer">
          <button type="button" className="btn-luxury-outline" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchableSelect({
  label,
  required,
  placeholder,
  searchPlaceholder,
  options = [],
  value,
  onChange,
  disabled,
  loading,
  loadingText,
  error,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const selectedOption = options.find((o) => String(o.code) === String(value));

  const removeAccents = (str) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const filteredOptions = options.filter((o) => {
    if (!searchQuery.trim()) return true;
    const cleanO = removeAccents(o.name);
    const cleanQ = removeAccents(searchQuery);
    return cleanO.includes(cleanQ);
  });

  const handleSelect = (code) => {
    onChange(code);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div className="vestora-form-group" ref={containerRef} style={{ position: 'relative' }}>
      <label className="vestora-label">
        {label} {required && <span className="required-dot">*</span>}
      </label>

      <div
        className={`vestora-combobox-trigger ${error ? 'error' : ''} ${disabled ? 'disabled' : ''} ${isOpen ? 'active' : ''}`}
        onClick={() => {
          if (!disabled && !loading) {
            setIsOpen(!isOpen);
          }
        }}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled && !loading) setIsOpen(!isOpen);
          } else if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
      >
        <div className="vestora-combobox-selected-text">
          {loading ? (
            <span style={{ color: '#737373' }}>{loadingText || 'Đang tải...'}</span>
          ) : selectedOption ? (
            <span>{selectedOption.name}</span>
          ) : (
            <span style={{ color: '#737373' }}>{placeholder}</span>
          )}
        </div>

        <div className="vestora-combobox-icons">
          {selectedOption && !disabled && (
            <button
              type="button"
              className="vestora-combobox-clear-btn"
              onClick={handleClear}
              title="Xóa lựa chọn"
            >
              ✕
            </button>
          )}
          <svg
            className={`vestora-combobox-chevron ${isOpen ? 'open' : ''}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {error && <span className="vestora-field-error">{error}</span>}

      {isOpen && !disabled && (
        <div className="vestora-combobox-dropdown">
          <div className="vestora-combobox-search-box">
            <svg
              className="vestora-combobox-search-icon"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              className="vestora-combobox-search-input"
              placeholder={searchPlaceholder || 'Gõ để tìm kiếm nhanh...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                type="button"
                className="vestora-combobox-search-clear"
                onClick={() => setSearchQuery('')}
                title="Xóa tìm kiếm"
              >
                ✕
              </button>
            )}
          </div>

          <div className="vestora-combobox-meta-bar">
            <span>Tìm thấy {filteredOptions.length} kết quả</span>
            {searchQuery && (
              <span style={{ color: '#8C6D3F' }}>Từ khóa: "{searchQuery}"</span>
            )}
          </div>

          <div className="vestora-combobox-list">
            {filteredOptions.length === 0 ? (
              <div className="vestora-combobox-empty">
                Không tìm thấy kết quả phù hợp với "{searchQuery}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = String(opt.code) === String(value);
                return (
                  <div
                    key={opt.code}
                    className={`vestora-combobox-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelect(opt.code)}
                  >
                    <span>{opt.name}</span>
                    {isSelected && (
                      <span className="vestora-combobox-check">✓</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ShowroomMapViewer({ address, ward, city, gpsCoords, onReLocate, isLocating }) {
  const fullAddress = [address, ward, city].filter(Boolean).join(', ');

  let mapQuery = '';
  let zoomLevel = 14;

  if (gpsCoords) {
    mapQuery = `${gpsCoords.lat},${gpsCoords.lng}`;
    zoomLevel = 16;
  } else if (fullAddress) {
    mapQuery = fullAddress;
    if (address && ward) zoomLevel = 16;
    else if (ward) zoomLevel = 14;
    else zoomLevel = 11;
  }

  const mapEmbedUrl = mapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&t=&z=${zoomLevel}&ie=UTF8&iwloc=&output=embed`
    : '';

  const externalMapUrl = gpsCoords
    ? `https://www.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}&z=17`
    : (mapQuery ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}` : '');

  if (!fullAddress && !gpsCoords) {
    return (
      <div className="vestora-map-placeholder">
        <div className="vestora-map-placeholder-icon">📍</div>
        <div className="vestora-map-placeholder-title">Chưa có thông tin vị trí showroom</div>
        <div className="vestora-map-placeholder-sub">
          Vui lòng chọn Tỉnh/Thành phố hoặc bấm "Lấy vị trí hiện tại" để hiển thị bản đồ định vị showroom thời gian thực.
        </div>
      </div>
    );
  }

  return (
    <div className="vestora-map-card">
      <div className="vestora-map-header">
        <div className="vestora-map-header-left">
          <span className="vestora-map-live-dot" />
          <span className="vestora-map-title">BẢN ĐỒ VỊ TRÍ SHOWROOM THỜI GIAN THỰC</span>
        </div>
        <div className="vestora-map-header-right">
          {onReLocate && (
            <button
              type="button"
              className="vestora-map-action-btn"
              onClick={onReLocate}
              disabled={isLocating}
              title="Định vị lại tọa độ GPS"
            >
              {isLocating ? 'Đang định vị...' : 'Định vị lại GPS'}
            </button>
          )}
          {externalMapUrl && (
            <a
              href={externalMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="vestora-map-action-btn primary"
              title="Mở toàn màn hình trên Google Maps"
            >
              <span>Xem trên Google Maps ↗</span>
            </a>
          )}
        </div>
      </div>

      <div className="vestora-map-frame-wrapper">
        <iframe
          title="Bản đồ định vị Showroom"
          src={mapEmbedUrl}
          className="vestora-map-iframe"
          loading="lazy"
          allowFullScreen
        />
      </div>

      <div className="vestora-map-info-panel">
        <div className="vestora-map-info-grid">
          <div className="vestora-map-info-item">
            <span className="vestora-map-info-label">ĐỊA CHỈ GHIM BẢN ĐỒ:</span>
            <span className="vestora-map-info-val bold">{fullAddress || 'Chưa có địa chỉ chi tiết'}</span>
          </div>

          <div className="vestora-map-info-item">
            <span className="vestora-map-info-label">TỌA ĐỘ GPS:</span>
            <span className="vestora-map-info-val monospace">
              {gpsCoords ? `${gpsCoords.lat.toFixed(5)}°B, ${gpsCoords.lng.toFixed(5)}°Đ` : 'Định vị tự động theo địa giới hành chính'}
            </span>
          </div>

          <div className="vestora-map-info-item">
            <span className="vestora-map-info-label">KHU VỰC HÀNH CHÍNH:</span>
            <span className="vestora-map-info-val">
              {[ward, city].filter(Boolean).join(' • ') || 'Chưa chọn'}
            </span>
          </div>

          <div className="vestora-map-info-item">
            <span className="vestora-map-info-label">TRẠNG THÁI ĐỊNH VỊ:</span>
            <span className="vestora-map-info-val status-active">
              ✓ Đã xác định vị trí hợp lệ
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterShopPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ownerName: '',
    ownerEmail: '',
    phone: '',
    address: '',
    city: '',
    district: '',
    ward: '',
    provinceCode: '',
    districtCode: '',
    wardCode: '',
    latitude: null,
    longitude: null,
    imageUrl: '',
    businessLicenseUrl: '',
    idCardFrontUrl: '',
    idCardBackUrl: '',
    agreeTerms: false,
  });

  const [fileDetails, setFileDetails] = useState({
    imageUrl: null,
    businessLicenseUrl: null,
    idCardFrontUrl: null,
    idCardBackUrl: null,
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedShop, setSubmittedShop] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState(null);
  const [gpsCoords, setGpsCoords] = useState(null);

  const [provinces, setProvinces] = useState(FALLBACK_PROVINCES);
  const [wards, setWards] = useState([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  const wardCache = useRef({});

  useEffect(() => {
    let isMounted = true;
    setLoadingProvinces(true);
    axios.get('https://provinces.open-api.vn/api/v2/p/')
      .then((res) => {
        const data = res.data;
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setProvinces(data);
        } else if (isMounted) {
          setProvinces(FALLBACK_PROVINCES);
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

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      let currentOwnerId = null;
      if (storedUser) {
        const u = JSON.parse(storedUser);
        currentOwnerId = u._id || u.UserId || null;
        setFormData((prev) => ({
          ...prev,
          ownerName: prev.ownerName || u.FullName || u.fullName || '',
          ownerEmail: prev.ownerEmail || u.Email || u.email || '',
          phone: prev.phone || u.phone || u.Phone || '',
        }));
      }

      const lastAppId = localStorage.getItem('vestora_last_shop_app_id');
      if (lastAppId) {
        apiClient.get(`/api/shops/${lastAppId}`)
          .then((data) => {
            if (data.success && data.data) {
              setSubmittedShop(data.data);
              if (data.data.latitude && data.data.longitude) {
                setGpsCoords({ lat: Number(data.data.latitude), lng: Number(data.data.longitude) });
              }
            }
          })
          .catch(() => {});
      } else if (currentOwnerId) {
        apiClient.get('/api/shops', { params: { ownerId: currentOwnerId, limit: 1 } })
          .then((data) => {
            if (data.success && Array.isArray(data.data) && data.data.length > 0) {
              const foundShop = data.data[0];
              setSubmittedShop(foundShop);
              localStorage.setItem('vestora_last_shop_app_id', foundShop._id);
              if (foundShop.latitude && foundShop.longitude) {
                setGpsCoords({ lat: Number(foundShop.latitude), lng: Number(foundShop.longitude) });
              }
            }
          })
          .catch(() => {});
      }
    } catch (_) {}
  }, []);

  const validateSingleField = (field, value) => {
    let err = '';
    switch (field) {
      case 'name':
        if (!value || !value.trim()) err = 'Tên gian hàng không được để trống.';
        else if (value.trim().length < 3) err = 'Tên gian hàng phải có ít nhất 3 ký tự.';
        else if (value.trim().length > 100) err = 'Tên gian hàng không được vượt quá 100 ký tự.';
        break;
      case 'description':
        if (!value || !value.trim()) err = 'Mô tả định vị gian hàng không được để trống.';
        else if (value.trim().length < 10) err = 'Mô tả phải có ít nhất 10 ký tự để khách hàng nhận diện.';
        break;
      case 'ownerName':
        if (!value || !value.trim()) err = 'Họ và tên chủ sở hữu không được để trống.';
        else if (value.trim().length < 2) err = 'Họ và tên phải có ít nhất 2 ký tự.';
        break;
      case 'ownerEmail':
        if (!value || !value.trim()) err = 'Email liên hệ không được để trống.';
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) err = 'Địa chỉ email không đúng định dạng (VD: example@email.com).';
        break;
      case 'phone': {
        const clean = (value || '').trim().replace(/\s+/g, '').replace(/^\+84/, '0');
        if (!clean) err = 'Số điện thoại không được để trống.';
        else if (!/^(0[35789])[0-9]{8}$/.test(clean)) {
          err = 'Số điện thoại phải gồm 10 chữ số hợp lệ của Việt Nam (bắt đầu bằng 03, 05, 07, 08, 09).';
        }
        break;
      }
      case 'city':
        if (!value || !value.trim()) err = 'Vui lòng chọn Tỉnh / Thành phố.';
        break;
      case 'ward':
        if (!value || !value.trim()) err = 'Vui lòng chọn Phường / Xã.';
        break;
      case 'address':
        if (!value || !value.trim()) err = 'Số nhà, tên đường không được để trống.';
        else if (value.trim().length < 3) err = 'Địa chỉ phải chi tiết (tối thiểu 3 ký tự).';
        else if (value.trim().length > 255) err = 'Địa chỉ không được vượt quá 255 ký tự.';
        break;
      case 'businessLicenseUrl':
        if (!value) err = 'Vui lòng tải lên ảnh hoặc tệp Giấy Phép Đăng Ký Kinh Doanh.';
        break;
      case 'idCardFrontUrl':
        if (!value) err = 'Vui lòng tải lên ảnh CCCD / Hộ chiếu mặt trước.';
        break;
      case 'idCardBackUrl':
        if (!value) err = 'Vui lòng tải lên ảnh CCCD / Hộ chiếu mặt sau.';
        break;
      case 'agreeTerms':
        if (!value) err = 'Bạn cần đồng ý với Điều Khoản Hợp Tác Gian Hàng.';
        break;
      default:
        break;
    }
    return err;
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
    if (errorMsg) setErrorMsg('');
  };

  const handleFileUpload = (field, file) => {
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setErrors((prev) => ({ ...prev, [field]: 'Chỉ hỗ trợ tệp định dạng hình ảnh (PNG, JPG, WEBP) hoặc PDF.' }));
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, [field]: 'Dung lượng tệp vượt quá giới hạn 8MB.' }));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target.result;
      setFormData((prev) => ({ ...prev, [field]: result }));
      setFileDetails((prev) => ({
        ...prev,
        [field]: {
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
        },
      }));
      setErrors((prev) => ({ ...prev, [field]: '' }));
    };
    reader.readAsDataURL(file);
  };

  const handleFileRemove = (field) => {
    setFormData((prev) => ({ ...prev, [field]: '' }));
    setFileDetails((prev) => ({ ...prev, [field]: null }));
  };

  const handleProvinceChange = async (provCode) => {
    const selectedProv = provinces.find((p) => String(p.code) === String(provCode));
    const provName = selectedProv ? selectedProv.name : '';

    setGpsCoords(null);
    setFormData((prev) => ({
      ...prev,
      city: provName,
      provinceCode: provCode,
      district: '',
      districtCode: '',
      ward: '',
      wardCode: '',
      latitude: null,
      longitude: null,
    }));

    if (errors.city) setErrors((prev) => ({ ...prev, city: '' }));
    setWards([]);

    if (!provCode) return;

    if (wardCache.current[provCode]) {
      setWards(wardCache.current[provCode]);
      return;
    }

    setLoadingWards(true);
    try {
      const res = await axios.get(`https://provinces.open-api.vn/api/v2/p/${provCode}?depth=2`);
      const list = res.data?.wards || [];
      wardCache.current[provCode] = list;
      setWards(list);
    } catch (_) {
      setWards([]);
    } finally {
      setLoadingWards(false);
    }
  };

  const handleWardChange = (wCode) => {
    const selectedWard = wards.find((w) => String(w.code) === String(wCode));
    const wardName = selectedWard ? selectedWard.name : '';

    setGpsCoords(null);
    setFormData((prev) => ({
      ...prev,
      ward: wardName,
      wardCode: wCode,
      latitude: null,
      longitude: null,
    }));

    if (errors.ward) setErrors((prev) => ({ ...prev, ward: '' }));
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus({
        type: 'error',
        text: 'Trình duyệt của bạn không hỗ trợ chức năng định vị vị trí.',
      });
      return;
    }

    setIsLocating(true);
    setLocationStatus(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setGpsCoords({ lat: latitude, lng: longitude });
        let addressResult = null;

        try {
          const res = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1&accept-language=vi`
          );
          if (res.data?.address) {
            const a = res.data.address;
            const streetParts = [];
            if (a.house_number) streetParts.push(`Số ${a.house_number}`);
            if (a.road) streetParts.push(a.road);
            else if (a.pedestrian) streetParts.push(a.pedestrian);
            else if (a.building) streetParts.push(a.building);
            else if (a.amenity) streetParts.push(a.amenity);

            const rawWard = a.quarter || a.suburb || a.neighbourhood || a.village || a.ward || '';
            const prov = a.city || a.state || a.province || '';

            let streetAddress = streetParts.join(' ').trim();
            if (!streetAddress && res.data.display_name) {
              const firstPart = res.data.display_name.split(',')[0]?.trim() || '';
              const cleanFirst = firstPart.toLowerCase();
              const isWardOrCity =
                (rawWard && cleanFirst.includes(rawWard.toLowerCase())) ||
                (prov && cleanFirst.includes(prov.toLowerCase())) ||
                /^(xã|phường|thị trấn|quận|huyện|tỉnh|tp|thành phố)\s+/i.test(firstPart);
              if (!isWardOrCity) {
                streetAddress = firstPart;
              }
            }

            addressResult = {
              address: streetAddress,
              ward: rawWard,
              city: prov,
            };
          }
        } catch (_) {
        }

        if (!addressResult) {
          try {
            const bdcRes = await axios.get(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=vi`
            );
            const bdc = bdcRes.data;
            if (bdc) {
              const bdcWard = bdc.localityInfo?.administrative?.[3]?.name || bdc.localityInfo?.administrative?.[2]?.name || '';
              const bdcCity = bdc.city || bdc.principalSubdivision || '';
              let bdcStreet = '';
              if (bdc.locality && (!bdcWard || !bdc.locality.toLowerCase().includes(bdcWard.toLowerCase()))) {
                bdcStreet = bdc.locality;
              }
              addressResult = {
                address: bdcStreet,
                ward: bdcWard,
                city: bdcCity,
              };
            }
          } catch (_) {}
        }

        setIsLocating(false);

        if (addressResult) {
          const rawCity = addressResult.city || '';
          const rawWard = addressResult.ward || '';
          const rawStreet = (addressResult.address || '').trim();

          const cleanName = (str) =>
            (str || '')
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/^(thanh pho|tinh|quan|huyen|thi xa|phuong|xa|thi tran)\s+/gi, '')
              .trim();

          let matchedProv = provinces.find((p) => {
            const pClean = cleanName(p.name);
            const cClean = cleanName(rawCity);
            return pClean === cClean || cClean.includes(pClean) || pClean.includes(cClean);
          });

          let matchedWard = null;

          if (matchedProv) {
            let wList = wardCache.current[matchedProv.code];
            if (!wList) {
              try {
                const res = await axios.get(`https://provinces.open-api.vn/api/v2/p/${matchedProv.code}?depth=2`);
                wList = res.data?.wards || [];
                wardCache.current[matchedProv.code] = wList;
              } catch (_) {
                wList = [];
              }
            }
            setWards(wList);

            if (rawWard) {
              const targetClean = cleanName(rawWard);
              matchedWard = wList.find((w) => {
                const wClean = cleanName(w.name);
                return wClean === targetClean || targetClean.includes(wClean) || wClean.includes(targetClean);
              });
            }
          }

          const cleanWardVal = cleanName(rawWard);
          const cleanCityVal = cleanName(rawCity);
          const isStreetValid = rawStreet &&
            cleanName(rawStreet) !== cleanWardVal &&
            !cleanName(rawStreet).includes(cleanWardVal) &&
            !cleanWardVal.includes(cleanName(rawStreet)) &&
            !cleanName(rawStreet).includes(cleanCityVal);

          setFormData((prev) => ({
            ...prev,
            city: matchedProv ? matchedProv.name : (rawCity || prev.city),
            provinceCode: matchedProv ? String(matchedProv.code) : prev.provinceCode,
            district: '',
            districtCode: '',
            ward: matchedWard ? matchedWard.name : (rawWard || prev.ward),
            wardCode: matchedWard ? String(matchedWard.code) : prev.wardCode,
            address: isStreetValid ? rawStreet : (prev.address || ''),
            latitude,
            longitude,
          }));

          setErrors((prev) => ({
            ...prev,
            city: '',
            ward: '',
            ...(isStreetValid ? { address: '' } : {}),
          }));

          if (isStreetValid) {
            setLocationStatus({
              type: 'success',
              text: `Đã xác định vị trí GPS chính xác (${latitude.toFixed(5)}, ${longitude.toFixed(5)}) & tự động điền địa chỉ showroom!`,
            });
          } else {
            setLocationStatus({
              type: 'success',
              text: `Đã ghim tọa độ GPS chính xác (${latitude.toFixed(5)}, ${longitude.toFixed(5)}) & chọn Tỉnh, Phường/Xã! Vui lòng nhập số nhà, tên đường chi tiết.`,
            });
          }
        } else {
          setFormData((prev) => ({
            ...prev,
            latitude,
            longitude,
          }));
          setLocationStatus({
            type: 'success',
            text: `Đã ghim tọa độ GPS chính xác (${latitude.toFixed(5)}, ${longitude.toFixed(5)}). Vui lòng chọn Tỉnh, Phường/Xã và nhập số nhà, tên đường.`,
          });
        }
      },
      (err) => {
        setIsLocating(false);
        let msg = 'Không thể lấy vị trí hiện tại.';
        if (err.code === 1) {
          msg = 'Quyền truy cập vị trí bị từ chối. Vui lòng cho phép định vị hoặc chọn từ danh sách.';
        } else if (err.code === 2) {
          msg = 'Tín hiệu GPS không khả dụng. Vui lòng chọn Tỉnh và Phường/Xã bên dưới.';
        } else if (err.code === 3) {
          msg = 'Quá thời gian lấy vị trí GPS. Vui lòng thử lại hoặc chọn thủ công.';
        }
        setLocationStatus({ type: 'error', text: msg });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const validateStep = (step) => {
    const stepErrors = {};

    if (step === 1) {
      const errName = validateSingleField('name', formData.name);
      if (errName) stepErrors.name = errName;
      const errDesc = validateSingleField('description', formData.description);
      if (errDesc) stepErrors.description = errDesc;
    }

    if (step === 2) {
      const errOwner = validateSingleField('ownerName', formData.ownerName);
      if (errOwner) stepErrors.ownerName = errOwner;
      const errEmail = validateSingleField('ownerEmail', formData.ownerEmail);
      if (errEmail) stepErrors.ownerEmail = errEmail;
      const errPhone = validateSingleField('phone', formData.phone);
      if (errPhone) stepErrors.phone = errPhone;
      const errCity = validateSingleField('city', formData.city);
      if (errCity) stepErrors.city = errCity;
      const errWard = validateSingleField('ward', formData.ward);
      if (errWard) stepErrors.ward = errWard;
      const errAddr = validateSingleField('address', formData.address);
      if (errAddr) stepErrors.address = errAddr;
    }

    if (step === 3) {
      const errLic = validateSingleField('businessLicenseUrl', formData.businessLicenseUrl);
      if (errLic) stepErrors.businessLicenseUrl = errLic;
      const errIdF = validateSingleField('idCardFrontUrl', formData.idCardFrontUrl);
      if (errIdF) stepErrors.idCardFrontUrl = errIdF;
      const errIdB = validateSingleField('idCardBackUrl', formData.idCardBackUrl);
      if (errIdB) stepErrors.idCardBackUrl = errIdB;
      const errTerms = validateSingleField('agreeTerms', formData.agreeTerms);
      if (errTerms) stepErrors.agreeTerms = errTerms;
    }

    setErrors(stepErrors);
    return Object.keys(stepErrors).length === 0;
  };

  const handleNextStep = () => {
    if (!validateStep(currentStep)) {
      setErrorMsg('Vui lòng kiểm tra và sửa các trường thông tin chưa hợp lệ bên dưới.');
      return;
    }
    setErrorMsg('');
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handlePrevStep = () => {
    setErrorMsg('');
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;
    setErrorMsg('');

    let allValid = true;
    for (let s = 1; s <= 3; s++) {
      if (!validateStep(s)) {
        setCurrentStep(s);
        setErrorMsg('Vui lòng kiểm tra và hoàn thành các trường bắt buộc trước khi nộp hồ sơ.');
        allValid = false;
        break;
      }
    }

    if (!allValid) return;

    setLoading(true);
    try {
      let storedOwnerId = null;
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        storedOwnerId = u._id || u.UserId || null;
      } catch (_) {}

      const cleanPhone = formData.phone.trim().replace(/\s+/g, '').replace(/^\+84/, '0');

      const data = await apiClient.post('/api/shops/apply', {
        ownerId: storedOwnerId,
        ownerName: formData.ownerName.trim(),
        ownerEmail: formData.ownerEmail.trim(),
        name: formData.name.trim(),
        description: formData.description.trim(),
        phone: cleanPhone,
        address: formData.address.trim(),
        city: formData.city.trim(),
        district: formData.district.trim(),
        ward: (formData.ward || '').trim(),
        latitude: formData.latitude ?? (gpsCoords ? gpsCoords.lat : null),
        longitude: formData.longitude ?? (gpsCoords ? gpsCoords.lng : null),
        imageUrl: formData.imageUrl || '',
        businessLicenseUrl: formData.businessLicenseUrl || '',
        idCardFrontUrl: formData.idCardFrontUrl || '',
        idCardBackUrl: formData.idCardBackUrl || '',
      });

      if (!data.success) {
        throw new Error(data.message || 'Không thể gửi hồ sơ, vui lòng thử lại sau.');
      }

      const returnedShop = data.data?.shop || {
        _id: data.data?.applicationCode,
        name: data.data?.shopName,
        status: data.data?.status || 'PENDING',
        createdAt: data.data?.submittedAt || new Date().toISOString(),
        ...formData,
      };

      setSubmittedShop(returnedShop);
      if (returnedShop.latitude && returnedShop.longitude) {
        setGpsCoords({ lat: Number(returnedShop.latitude), lng: Number(returnedShop.longitude) });
      }
      if (returnedShop._id) {
        localStorage.setItem('vestora_last_shop_app_id', returnedShop._id);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const respData = err.data || err.response?.data;
      if (respData?.data?.shop) {
        const existing = respData.data.shop;
        setSubmittedShop(existing);
        localStorage.setItem('vestora_last_shop_app_id', existing._id);
        if (existing.latitude && existing.longitude) {
          setGpsCoords({ lat: Number(existing.latitude), lng: Number(existing.longitude) });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (respData?.data?.existingShopId) {
        try {
          const fetchData = await apiClient.get(`/api/shops/${respData.data.existingShopId}`);
          if (fetchData.success && fetchData.data) {
            setSubmittedShop(fetchData.data);
            localStorage.setItem('vestora_last_shop_app_id', fetchData.data._id);
            if (fetchData.data.latitude && fetchData.data.longitude) {
              setGpsCoords({ lat: Number(fetchData.data.latitude), lng: Number(fetchData.data.longitude) });
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
          }
        } catch (_) {}
      }

      setErrorMsg(err.message || 'Không thể kết nối đến hệ thống, vui lòng thử lại sau.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!submittedShop?._id) return;
    setRefreshing(true);
    try {
      const data = await apiClient.get(`/api/shops/${submittedShop._id}`);
      if (data.success && data.data) {
        setSubmittedShop(data.data);
      }
    } catch (_) {
    } finally {
      setRefreshing(false);
    }
  };

  const handleResetForm = () => {
    localStorage.removeItem('vestora_last_shop_app_id');
    setSubmittedShop(null);
    setCurrentStep(1);
    setFormData({
      name: '',
      description: '',
      ownerName: '',
      ownerEmail: '',
      phone: '',
      address: '',
      city: '',
      district: '',
      ward: '',
      provinceCode: '',
      districtCode: '',
      wardCode: '',
      imageUrl: '',
      businessLicenseUrl: '',
      idCardFrontUrl: '',
      idCardBackUrl: '',
      agreeTerms: false,
    });
    setWards([]);
    setFileDetails({
      imageUrl: null,
      businessLicenseUrl: null,
      idCardFrontUrl: null,
      idCardBackUrl: null,
    });
    setErrors({});
    setErrorMsg('');
    setLocationStatus(null);
    setIsLocating(false);
    setGpsCoords(null);
  };

  const stepsConfig = [
    { id: 1, sub: 'Giai đoạn 1', name: 'Thương Hiệu & Định Vị' },
    { id: 2, sub: 'Giai đoạn 2', name: 'Chủ Sở Hữu & Liên Hệ' },
    { id: 3, sub: 'Giai đoạn 3', name: 'Hồ Sơ Pháp Lý' },
    { id: 4, sub: 'Giai đoạn 4', name: 'Xem Lại & Nộp Đơn' },
  ];

  const formatDateTime = (iso) => {
    if (!iso) return 'Vừa nộp';
    const d = new Date(iso);
    return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} — ${d.toLocaleDateString('vi-VN')}`;
  };

  const ownerDisplayName = submittedShop?.ownerId?.FullName || submittedShop?.ownerId?.fullName || submittedShop?.ownerName || formData.ownerName || 'Chủ gian hàng';
  const ownerDisplayEmail = submittedShop?.ownerId?.Email || submittedShop?.ownerId?.email || submittedShop?.ownerEmail || formData.ownerEmail || '—';

  return (
    <div className="register-shop-page">
      <Navbar />

      <section className="register-shop-hero">
        <div className="register-shop-hero-inner">
          <div className="vestora-badge-pill">GIA NHẬP HỆ THỐNG ATELIER ĐỐI TÁC</div>
          <h1 className="register-shop-hero-title">Đăng Ký Mở Gian Hàng May Đo & Cho Thuê</h1>
          <p className="register-shop-hero-desc">
            Kết nối thương hiệu cao cấp của bạn với khách hàng tinh hoa trên nền tảng VESTORA. Quy trình thẩm định hồ sơ minh bạch, chuẩn mực và chuyên nghiệp.
          </p>
        </div>
      </section>

      <main className="register-shop-workspace">
        {!submittedShop && (
          <section className="register-shop-stepper">
            <ul className="register-shop-steps-list">
              {stepsConfig.map((s) => {
                const isCompleted = currentStep > s.id;
                const isActive = currentStep === s.id;
                return (
                  <li
                    key={s.id}
                    className={`register-shop-step-node ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                    onClick={() => {
                      if (s.id < currentStep) setCurrentStep(s.id);
                    }}
                  >
                    <div className="register-shop-step-circle">
                      {s.id}
                    </div>
                    <div className="register-shop-step-info">
                      <span className="register-shop-step-sub">{s.sub}</span>
                      <span className="register-shop-step-name">{s.name}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="register-shop-stepper-progress">
              <div
                className="register-shop-stepper-bar"
                style={{ width: `${((currentStep - 1) / (stepsConfig.length - 1)) * 100}%` }}
              />
            </div>
          </section>
        )}

        {errorMsg && (
          <div className="vestora-error-banner" role="alert">
            {errorMsg}
          </div>
        )}

        {submittedShop ? (
          <section className="submitted-profile-container">
            <div className="submitted-profile-header">
              <div className="submitted-profile-title-group">
                <span className="submitted-profile-meta-tag">HỒ SƠ ĐĂNG KÝ GIAN HÀNG ĐÃ GỬI</span>
                <h2>{submittedShop.name}</h2>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className={`submitted-status-pill ${submittedShop.status ? submittedShop.status.toLowerCase() : 'pending'}`}>
                  ● {submittedShop.status === 'PENDING' ? 'Đang Chờ Duyệt' : submittedShop.status === 'ACTIVE' ? 'Đã Phê Duyệt' : 'Bị Từ Chối'}
                </span>
                <button
                  type="button"
                  className="btn-luxury-outline"
                  onClick={handleRefreshStatus}
                  disabled={refreshing}
                  style={{ padding: '6px 14px', fontSize: '11px' }}
                >
                  {refreshing ? 'Đang cập nhật...' : 'Làm mới trạng thái'}
                </button>
              </div>
            </div>

            {submittedShop.status === 'PENDING' && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', color: '#92400E' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>HỒ SƠ ĐANG CHỜ QUẢN TRỊ VIÊN DUYỆT</div>
                <div style={{ fontSize: '13px' }}>
                  Hồ sơ đăng ký. Quản trị viên VESTORA sẽ tiến hành kiểm định hồ sơ của bạn trong vòng 24 giờ.
                </div>
              </div>
            )}

            {submittedShop.status === 'REJECTED' && (
              <div style={{ background: '#FEF2F2', border: '1px solid #F87171', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', color: '#991B1B' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>HỒ SƠ KHÔNG ĐƯỢC DUYỆT</div>
                <div style={{ fontSize: '13px' }}>
                  Lý do từ chối từ Quản trị viên: <strong>{submittedShop.rejectionReason || 'Hồ sơ chưa đạt tiêu chuẩn quy định.'}</strong>
                </div>
              </div>
            )}

            {submittedShop.status === 'ACTIVE' && (
              <div style={{ background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px', color: '#065F46' }}>
                <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '4px' }}>CHÚC MỪNG GIAN HÀNG ĐÃ ĐƯỢC CẤP PHÉP</div>
                <div style={{ fontSize: '13px' }}>
                  Tài khoản của bạn đã được nâng cấp thành Shop Owner. Bạn có thể bắt đầu đăng bán và cho thuê sản phẩm ngay bây giờ.
                </div>
              </div>
            )}

            <div className="submitted-grid">
              <div className="submitted-section-card">
                <div className="submitted-section-title">THÔNG TIN GIAN HÀNG</div>
                <div className="submitted-data-row">
                  <span className="submitted-data-label">Mã hồ sơ:</span>
                  <span className="submitted-data-value" style={{ fontFamily: 'monospace' }}>{submittedShop._id}</span>
                </div>
                <div className="submitted-data-row">
                  <span className="submitted-data-label">Tên gian hàng:</span>
                  <span className="submitted-data-value">{submittedShop.name}</span>
                </div>
                <div className="submitted-data-row">
                  <span className="submitted-data-label">Ngày nộp đơn:</span>
                  <span className="submitted-data-value">{formatDateTime(submittedShop.createdAt)}</span>
                </div>
                <div className="submitted-data-row">
                  <span className="submitted-data-label">Mô tả định vị:</span>
                  <span className="submitted-data-value">{submittedShop.description}</span>
                </div>
              </div>

              <div className="submitted-section-card">
                <div className="submitted-section-title">CHỦ SỞ HỮU & LIÊN HỆ</div>
                <div className="submitted-data-row">
                  <span className="submitted-data-label">Người đại diện:</span>
                  <span className="submitted-data-value">{ownerDisplayName}</span>
                </div>
                <div className="submitted-data-row">
                  <span className="submitted-data-label">Email liên hệ:</span>
                  <span className="submitted-data-value">{ownerDisplayEmail}</span>
                </div>
                <div className="submitted-data-row">
                  <span className="submitted-data-label">Số hotline:</span>
                  <span className="submitted-data-value">{submittedShop.phone}</span>
                </div>
                <div className="submitted-data-row">
                  <span className="submitted-data-label">Địa chỉ showroom:</span>
                  <span className="submitted-data-value">
                    {[submittedShop.address, submittedShop.ward, submittedShop.district, submittedShop.city].filter(Boolean).join(', ')}
                  </span>
                </div>
                {submittedShop.latitude && submittedShop.longitude && (
                  <div className="submitted-data-row">
                    <span className="submitted-data-label">Tọa độ GPS đã ghim:</span>
                    <span className="submitted-data-value" style={{ fontFamily: 'monospace', color: '#059669', fontWeight: 600 }}>
                      📍 {Number(submittedShop.latitude).toFixed(5)}°B, {Number(submittedShop.longitude).toFixed(5)}°Đ (Chính xác)
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <ShowroomMapViewer
                address={submittedShop.address}
                ward={submittedShop.ward}
                city={submittedShop.city}
                gpsCoords={
                  submittedShop.latitude && submittedShop.longitude
                    ? { lat: Number(submittedShop.latitude), lng: Number(submittedShop.longitude) }
                    : (gpsCoords || null)
                }
              />
            </div>

            <div className="submitted-section-card" style={{ marginBottom: '28px' }}>
              <div className="submitted-section-title">TÀI LIỆU PHÁP LÝ ĐÍNH KÈM ĐÃ NỘP</div>
              <div className="submitted-docs-grid">
                <div className="submitted-doc-box">
                  <div className="submitted-doc-thumb">
                    {submittedShop.businessLicenseUrl ? (
                      submittedShop.businessLicenseUrl.startsWith('data:image') || submittedShop.businessLicenseUrl.startsWith('http') ? (
                        <img src={submittedShop.businessLicenseUrl} alt="GPKD" />
                      ) : (
                        <span className="submitted-doc-thumb-placeholder">TỆP PDF</span>
                      )
                    ) : (
                      <span className="submitted-doc-thumb-placeholder">Chưa có tệp</span>
                    )}
                  </div>
                  <div className="submitted-doc-meta">Giấy Phép ĐKKD</div>
                  {submittedShop.businessLicenseUrl && (
                    <button
                      type="button"
                      className="submitted-doc-btn"
                      onClick={() => setPreviewDoc({ title: 'Giấy Phép Đăng Ký Kinh Doanh (GPKD)', url: submittedShop.businessLicenseUrl })}
                    >
                      Xem tài liệu
                    </button>
                  )}
                </div>

                <div className="submitted-doc-box">
                  <div className="submitted-doc-thumb">
                    {submittedShop.idCardFrontUrl ? (
                      <img src={submittedShop.idCardFrontUrl} alt="CCCD Trước" />
                    ) : (
                      <span className="submitted-doc-thumb-placeholder">Chưa có tệp</span>
                    )}
                  </div>
                  <div className="submitted-doc-meta">CCCD Mặt Trước</div>
                  {submittedShop.idCardFrontUrl && (
                    <button
                      type="button"
                      className="submitted-doc-btn"
                      onClick={() => setPreviewDoc({ title: 'Căn Cước Công Dân (Mặt Trước)', url: submittedShop.idCardFrontUrl })}
                    >
                      Xem tài liệu
                    </button>
                  )}
                </div>

                <div className="submitted-doc-box">
                  <div className="submitted-doc-thumb">
                    {submittedShop.idCardBackUrl ? (
                      <img src={submittedShop.idCardBackUrl} alt="CCCD Sau" />
                    ) : (
                      <span className="submitted-doc-thumb-placeholder">Chưa có tệp</span>
                    )}
                  </div>
                  <div className="submitted-doc-meta">CCCD Mặt Sau</div>
                  {submittedShop.idCardBackUrl && (
                    <button
                      type="button"
                      className="submitted-doc-btn"
                      onClick={() => setPreviewDoc({ title: 'Căn Cước Công Dân (Mặt Sau)', url: submittedShop.idCardBackUrl })}
                    >
                      Xem tài liệu
                    </button>
                  )}
                </div>

                {submittedShop.imageUrl && (
                  <div className="submitted-doc-box">
                    <div className="submitted-doc-thumb">
                      <img src={submittedShop.imageUrl} alt="Logo Gian Hàng" />
                    </div>
                    <div className="submitted-doc-meta">Logo Gian Hàng</div>
                    <button
                      type="button"
                      className="submitted-doc-btn"
                      onClick={() => setPreviewDoc({ title: 'Ảnh Đại Diện / Logo Gian Hàng', url: submittedShop.imageUrl })}
                    >
                      Xem tài liệu
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="success-actions">
              <Link to="/admin/shops" className="btn-luxury-dark">
                Xem Tại Màn Hình Duyệt Shop Admin
              </Link>
              {submittedShop.status === 'ACTIVE' && (
                <Link to="/shop/dashboard" className="btn-luxury-dark" style={{ background: '#059669', borderColor: '#059669' }}>
                  Truy Cập Dashboard Shop
                </Link>
              )}
              <button type="button" onClick={handleResetForm} className="btn-luxury-outline">
                Nộp Hồ Sơ Mới Khác
              </button>
              <Link to="/" className="btn-luxury-outline">
                Về Trang Chủ
              </Link>
            </div>
          </section>
        ) : (
          <div className="register-shop-grid">
            <div className="register-shop-form-card">
              <div className="register-shop-form-header">
                <div>
                  <h2>{stepsConfig[currentStep - 1].name}</h2>
                  <p>Bước {currentStep} trên {stepsConfig.length} • Vui lòng nhập đầy đủ và chính xác</p>
                </div>
              </div>

              <form onSubmit={(e) => e.preventDefault()}>
                {currentStep === 1 && (
                  <div className="step-content">
                    <div className="vestora-form-group">
                      <label className="vestora-label">
                        Tên gian hàng / Atelier <span className="required-dot">*</span>
                      </label>
                      <input
                        type="text"
                        className={`vestora-input ${errors.name ? 'error' : ''}`}
                        placeholder="VD: Thanh Lịch Boutique, Maison De Haute..."
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        onBlur={() => setErrors((prev) => ({ ...prev, name: validateSingleField('name', formData.name) }))}
                        maxLength={100}
                        required
                      />
                      {errors.name ? (
                        <span className="vestora-field-error">{errors.name}</span>
                      ) : (
                        <div className="vestora-input-hint">
                          <span>Tên xuất hiện trên bảng hiệu và danh mục trang phục</span>
                          <span>{formData.name.length}/100</span>
                        </div>
                      )}
                    </div>

                    <div className="vestora-form-group">
                      <label className="vestora-label">
                        Mô tả định vị gian hàng & Phong cách <span className="required-dot">*</span>
                      </label>
                      <textarea
                        className={`vestora-textarea ${errors.description ? 'error' : ''}`}
                        placeholder="Mô tả phong cách chủ đạo, dòng sản phẩm cho thuê (váy dạ hội, tuxedo, âu phục thiết kế, áo cưới cao cấp...)"
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        onBlur={() => setErrors((prev) => ({ ...prev, description: validateSingleField('description', formData.description) }))}
                        maxLength={1000}
                        rows={4}
                        required
                      />
                      {errors.description ? (
                        <span className="vestora-field-error">{errors.description}</span>
                      ) : (
                        <div className="vestora-input-hint">
                          <span>Tối thiểu 10 ký tự để khách hàng dễ dàng nhận diện</span>
                          <span>{formData.description.length}/1000 ký tự</span>
                        </div>
                      )}
                    </div>

                    <FileUploadControl
                      label="Ảnh đại diện Showroom / Logo Gian Hàng"
                      field="imageUrl"
                      hint="Chọn tệp ảnh logo từ máy (JPG, PNG, WEBP - tối đa 8MB)"
                      fileData={formData.imageUrl}
                      fileInfo={fileDetails.imageUrl}
                      error={errors.imageUrl}
                      onUpload={handleFileUpload}
                      onRemove={handleFileRemove}
                    />
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="step-content">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div className="vestora-form-group">
                        <label className="vestora-label">
                          Họ và tên chủ sở hữu / Người đại diện <span className="required-dot">*</span>
                        </label>
                        <input
                          type="text"
                          className={`vestora-input ${errors.ownerName ? 'error' : ''}`}
                          placeholder="VD: Lê Bảo Trâm"
                          value={formData.ownerName}
                          onChange={(e) => handleInputChange('ownerName', e.target.value)}
                          onBlur={() => setErrors((prev) => ({ ...prev, ownerName: validateSingleField('ownerName', formData.ownerName) }))}
                          required
                        />
                        {errors.ownerName && <span className="vestora-field-error">{errors.ownerName}</span>}
                      </div>

                      <div className="vestora-form-group">
                        <label className="vestora-label">
                          Email nhận kết quả thẩm định <span className="required-dot">*</span>
                        </label>
                        <input
                          type="email"
                          className={`vestora-input ${errors.ownerEmail ? 'error' : ''}`}
                          placeholder="VD: lebaotram@gmail.com"
                          value={formData.ownerEmail}
                          onChange={(e) => handleInputChange('ownerEmail', e.target.value)}
                          onBlur={() => setErrors((prev) => ({ ...prev, ownerEmail: validateSingleField('ownerEmail', formData.ownerEmail) }))}
                          required
                        />
                        {errors.ownerEmail && <span className="vestora-field-error">{errors.ownerEmail}</span>}
                      </div>
                    </div>

                    <div className="vestora-form-group">
                      <label className="vestora-label">
                        Số điện thoại liên hệ (Hotline) <span className="required-dot">*</span>
                      </label>
                      <input
                        type="tel"
                        className={`vestora-input ${errors.phone ? 'error' : ''}`}
                        placeholder="VD: 0908 123 456"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        onBlur={() => setErrors((prev) => ({ ...prev, phone: validateSingleField('phone', formData.phone) }))}
                        required
                      />
                      {errors.phone ? (
                        <span className="vestora-field-error">{errors.phone}</span>
                      ) : (
                        <div className="vestora-input-hint">
                          <span>Gồm 10 số, dùng để tiếp nhận thông báo đơn thuê và kiểm duyệt viên liên hệ</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                      <SearchableSelect
                        label="Tỉnh / Thành phố"
                        required
                        placeholder="-- Chọn Tỉnh / Thành phố --"
                        searchPlaceholder="Gõ tên Tỉnh/TP để tìm nhanh..."
                        options={provinces}
                        value={formData.provinceCode || ''}
                        onChange={(code) => handleProvinceChange(code)}
                        disabled={loadingProvinces}
                        loading={loadingProvinces}
                        loadingText="Đang tải danh mục Tỉnh/TP..."
                        error={errors.city}
                      />

                      <SearchableSelect
                        label="Phường / Xã"
                        required
                        placeholder={!formData.provinceCode ? '-- Chọn Tỉnh/TP trước --' : '-- Chọn Phường / Xã --'}
                        searchPlaceholder="Gõ tên Phường/Xã để tìm nhanh..."
                        options={wards}
                        value={formData.wardCode || ''}
                        onChange={(code) => handleWardChange(code)}
                        disabled={!formData.provinceCode || loadingWards}
                        loading={loadingWards}
                        loadingText="Đang tải danh sách Phường/Xã..."
                        error={errors.ward}
                      />
                    </div>

                    <div className="vestora-form-group">
                      <div className="vestora-label-row">
                        <label className="vestora-label" style={{ margin: 0 }}>
                          Số nhà, Tên đường (Địa chỉ chi tiết) <span className="required-dot">*</span>
                        </label>
                        <button
                          type="button"
                          className="vestora-location-btn"
                          onClick={handleGetLocation}
                          disabled={isLocating}
                          title="Lấy vị trí hiện tại bằng GPS và tự động chọn Tỉnh/TP & Phường/Xã"
                        >
                          <svg
                            className={`vestora-location-icon ${isLocating ? 'spinning' : ''}`}
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          <span>{isLocating ? 'Đang định vị GPS...' : 'Lấy vị trí hiện tại'}</span>
                        </button>
                      </div>

                      <input
                        type="text"
                        className={`vestora-input ${errors.address ? 'error' : ''}`}
                        placeholder="VD: Số 24 Tràng Tiền, Tòa nhà Indochina..."
                        value={formData.address}
                        onChange={(e) => handleInputChange('address', e.target.value)}
                        onBlur={() => setErrors((prev) => ({ ...prev, address: validateSingleField('address', formData.address) }))}
                        required
                      />

                      {locationStatus && (
                        <div className={`vestora-location-status ${locationStatus.type}`}>
                          <span>●</span> {locationStatus.text}
                        </div>
                      )}

                      {errors.address ? (
                        <span className="vestora-field-error">{errors.address}</span>
                      ) : (
                        <div className="vestora-input-hint">
                          <span>Địa chỉ đón khách thử đồ trực tiếp</span>
                        </div>
                      )}
                    </div>

                    <ShowroomMapViewer
                      address={formData.address}
                      ward={formData.ward}
                      city={formData.city}
                      gpsCoords={gpsCoords}
                      onReLocate={handleGetLocation}
                      isLocating={isLocating}
                    />
                  </div>
                )}

                {currentStep === 3 && (
                  <div className="step-content">
                    <FileUploadControl
                      label="Bản chụp Giấy Phép Đăng Ký Kinh Doanh (GPKD)"
                      field="businessLicenseUrl"
                      hint="Chọn tệp GPKD từ máy (PNG, JPG, PDF - tối đa 8MB)"
                      fileData={formData.businessLicenseUrl}
                      fileInfo={fileDetails.businessLicenseUrl}
                      error={errors.businessLicenseUrl}
                      onUpload={handleFileUpload}
                      onRemove={handleFileRemove}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <FileUploadControl
                        label="Ảnh CCCD Mặt Trước"
                        field="idCardFrontUrl"
                        hint="Chọn tệp CCCD mặt trước"
                        fileData={formData.idCardFrontUrl}
                        fileInfo={fileDetails.idCardFrontUrl}
                        error={errors.idCardFrontUrl}
                        onUpload={handleFileUpload}
                        onRemove={handleFileRemove}
                      />

                      <FileUploadControl
                        label="Ảnh CCCD Mặt Sau"
                        field="idCardBackUrl"
                        hint="Chọn tệp CCCD mặt sau"
                        fileData={formData.idCardBackUrl}
                        fileInfo={fileDetails.idCardBackUrl}
                        error={errors.idCardBackUrl}
                        onUpload={handleFileUpload}
                        onRemove={handleFileRemove}
                      />
                    </div>

                    <div className={`vestora-checkbox-group ${errors.agreeTerms ? 'error' : ''}`}>
                      <input
                        type="checkbox"
                        id="agreeTerms"
                        className="vestora-checkbox"
                        checked={formData.agreeTerms}
                        onChange={(e) => handleInputChange('agreeTerms', e.target.checked)}
                        required
                      />
                      <label htmlFor="agreeTerms" className="vestora-checkbox-label">
                        Tôi cam đoan các thông tin định danh và hồ sơ cung cấp trên là hoàn toàn chính xác. Tôi đồng ý tuân thủ <strong>Quy chế vận hành sàn VESTORA Privé</strong> và cơ chế <strong>bảo chứng thanh toán Escrow</strong>.
                      </label>
                    </div>
                    {errors.agreeTerms && <span className="vestora-field-error" style={{ marginTop: '-18px', marginBottom: '20px' }}>{errors.agreeTerms}</span>}
                  </div>
                )}

                {currentStep === 4 && (
                  <div className="step-content">
                    <div style={{ background: 'var(--color-warm-bg-alt)', padding: '20px', borderRadius: '14px', border: '1px solid var(--color-border)', marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '14px', color: 'var(--color-dark)' }}>
                        Bảng Tổng Kết Hồ Sơ Đăng Ký
                      </h4>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Tên gian hàng:</span>
                          <span style={{ fontWeight: 600 }}>{formData.name || '(Chưa nhập)'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Chủ sở hữu / Người đại diện:</span>
                          <span style={{ fontWeight: 600 }}>{formData.ownerName || '(Chưa nhập)'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Email liên hệ:</span>
                          <span style={{ fontWeight: 600 }}>{formData.ownerEmail || '(Chưa nhập)'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Hotline:</span>
                          <span style={{ fontWeight: 600 }}>{formData.phone || '(Chưa nhập)'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Khu vực hành chính:</span>
                          <span style={{ fontWeight: 600 }}>
                            {[formData.ward, formData.city].filter(Boolean).join(', ') || '(Chưa chọn)'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Địa chỉ chi tiết:</span>
                          <span style={{ fontWeight: 600, textAlign: 'right', maxWidth: '320px' }}>{formData.address || '(Chưa nhập)'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Ảnh Logo Showroom:</span>
                          <span style={{ fontWeight: 600, color: formData.imageUrl ? '#059669' : 'var(--color-text-muted)' }}>
                            {fileDetails.imageUrl?.name || (formData.imageUrl ? 'Đã đính kèm tệp' : 'Chưa chọn')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border)', paddingBottom: '6px' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Giấy tờ pháp lý:</span>
                          <span style={{ color: 'var(--color-gold-dark)', fontWeight: 600 }}>
                            {formData.businessLicenseUrl && formData.idCardFrontUrl && formData.idCardBackUrl ? 'Đã tải lên đầy đủ GPKD và CCCD 2 mặt' : 'Chưa đủ giấy tờ'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>Cam kết điều khoản:</span>
                          <span style={{ color: formData.agreeTerms ? '#059669' : '#DC2626', fontWeight: 600 }}>
                            {formData.agreeTerms ? 'Đã xác nhận cam kết' : 'Chưa xác nhận'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                      <ShowroomMapViewer
                        address={formData.address}
                        ward={formData.ward}
                        city={formData.city}
                        gpsCoords={gpsCoords}
                      />
                    </div>

                    <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      Sau khi bấm "Gửi Hồ Sơ Xét Duyệt", thông tin gian hàng và chứng từ đính kèm sẽ được gửi đến ban quản lý VESTORA để tiến hành thẩm định và cấp phép hoạt động.
                    </p>
                  </div>
                )}

                <div className="register-shop-actions">
                  {currentStep > 1 ? (
                    <button
                      type="button"
                      className="btn-luxury-outline"
                      onClick={handlePrevStep}
                    >
                      Quay lại
                    </button>
                  ) : (
                    <Link to="/" className="btn-luxury-outline">
                      Hủy bỏ
                    </Link>
                  )}

                  {currentStep < 4 ? (
                    <button
                      type="button"
                      className="btn-luxury-dark"
                      onClick={handleNextStep}
                    >
                      Tiếp tục sang Bước {currentStep + 1}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn-luxury-dark"
                      disabled={loading}
                      onClick={handleSubmit}
                    >
                      {loading ? 'Đang gửi hồ sơ xét duyệt...' : 'Gửi Hồ Sơ Xét Duyệt'}
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="register-shop-preview-col">
              <div className="preview-card-wrapper">
                <div className="preview-card-header">
                  <span className="preview-card-header-tag">XEM TRƯỚC HỒ SƠ GIAN HÀNG</span>
                  <span className="preview-card-live-dot">LIVE SYNC</span>
                </div>

                <div className="preview-cover-photo" style={{ background: '#262626', minHeight: '140px' }}>
                  {formData.imageUrl ? (
                    <img src={formData.imageUrl} alt="Shop Cover" />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#737373', fontSize: '12px' }}>
                      Chưa tải ảnh bìa / logo
                    </div>
                  )}
                  <div className="preview-cover-overlay" />
                  <div className="preview-avatar-badge">
                    <div className="preview-avatar">
                      {formData.imageUrl ? (
                        <img src={formData.imageUrl} alt="Avatar" />
                      ) : (
                        formData.name ? formData.name.charAt(0).toUpperCase() : 'V'
                      )}
                    </div>
                    <span className="preview-status-pill">
                      CHỜ DUYỆT CẤP PHÉP
                    </span>
                  </div>
                </div>

                <div className="preview-card-body">
                  <h3 className="preview-shop-name">
                    {formData.name.trim() || 'Tên Gian Hàng Của Bạn'}
                  </h3>
                  <p className="preview-shop-desc">
                    {formData.description.trim() || 'Mô tả tóm tắt phong cách may đo, sản phẩm cho thuê cao cấp và trải nghiệm sang trọng tại atelier của bạn...'}
                  </p>

                  <div className="preview-details-list">
                    <div className="preview-detail-row">
                      <span className="preview-detail-label">Đại diện</span>
                      <div>
                        {formData.ownerName.trim() || 'Người đại diện (Chưa nhập)'}
                      </div>
                    </div>

                    <div className="preview-detail-row">
                      <span className="preview-detail-label">Showroom</span>
                      <div>
                        {[formData.address, formData.ward, formData.city].filter(Boolean).join(', ') || 'Địa chỉ Showroom (Chưa chọn)'}
                      </div>
                    </div>

                    <div className="preview-detail-row">
                      <span className="preview-detail-label">Hotline</span>
                      <div>
                        {formData.phone.trim() || 'Hotline tư vấn (Chưa nhập)'}
                      </div>
                    </div>

                    <div className="preview-detail-row">
                      <span className="preview-detail-label">Bảo chứng</span>
                      <div>Bảo chứng Escrow VESTORA Privé</div>
                    </div>
                  </div>
                </div>

                <div className="preview-card-footer">
                  Hồ sơ sẽ được xem xét và thẩm định bởi ban quản lý VESTORA trong vòng 24 giờ
                </div>
              </div>

              <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Đã có tài khoản gian hàng được cấp phép?{' '}
                <Link to="/shop/dashboard" style={{ color: 'var(--color-gold-dark)', fontWeight: 600 }}>
                  Truy cập Kênh Chủ Shop
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />

      {previewDoc && (
        <DocPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
