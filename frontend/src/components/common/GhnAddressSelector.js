import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapPin, Loader2, ChevronDown, Check, X, Search } from 'lucide-react';
import {
  getGHNProvincesApi,
  getGHNDistrictsApi,
  getGHNWardsApi,
} from '../../services/shippingApi';

export function normalizeVietnamese(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

/**
 * Autocomplete Input Component
 * Gõ từ khóa tìm kiếm nhanh, gợi ý tức thì, hỗ trợ phím mũi tên và Enter
 */
function AutocompleteField({
  label,
  value,
  options = [],
  placeholder = 'Gõ để tìm kiếm...',
  disabled = false,
  loading = false,
  onSelect,
  inputRef,
  required = false,
  icon,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Tìm option đã chọn hiện tại
  const selectedOption = useMemo(() => {
    if (!value) return null;
    return options.find((opt) => String(opt.value) === String(value)) || null;
  }, [options, value]);

  // Đồng bộ searchTerm với tên của selectedOption khi không mở dropdown
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm(selectedOption ? selectedOption.label : '');
    }
  }, [selectedOption, isOpen]);

  // Lọc options theo từ khóa gõ
  const filteredOptions = useMemo(() => {
    if (!searchTerm || !String(searchTerm).trim()) {
      return options;
    }
    const cleanSearch = normalizeVietnamese(searchTerm);
    return options.filter((opt) => {
      const cleanLabel = normalizeVietnamese(opt.label);
      const cleanSub = opt.subLabel ? normalizeVietnamese(opt.subLabel) : '';
      return cleanLabel.includes(cleanSearch) || cleanSub.includes(cleanSearch);
    });
  }, [options, searchTerm]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        // Nếu gõ dở dang mà không chọn -> khôi phục lại giá trị đã chọn trước đó
        setSearchTerm(selectedOption ? selectedOption.label : '');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [selectedOption]);

  // Tự động cuộn đến phần tử đang highlight bằng phím mũi tên
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex];
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex]);

  const handleFocus = () => {
    if (!disabled && !loading) {
      setIsOpen(true);
      setHighlightedIndex(-1);
    }
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(0);
    // Nếu xóa trắng ô input -> kích hoạt bỏ chọn
    if (!e.target.value.trim() && value) {
      onSelect(null);
    }
  };

  const handleSelectOption = (opt) => {
    onSelect(opt);
    setSearchTerm(opt.label);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setSearchTerm('');
    onSelect(null);
    setIsOpen(true);
    setHighlightedIndex(-1);
    inputRef?.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (disabled || loading) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(filteredOptions.length - 1);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        e.preventDefault();
        handleSelectOption(filteredOptions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm(selectedOption ? selectedOption.label : '');
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        position: 'relative',
        width: '100%',
      }}
    >
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: '#71717A',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {icon}
        {label} {required && '*'}
      </label>

      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Đang tải dữ liệu...' : placeholder}
          disabled={disabled || loading}
          autoComplete="off"
          style={{
            width: '100%',
            padding: '10px 36px 10px 12px',
            backgroundColor: disabled ? '#F8F7F4' : '#FFFFFF',
            border: isOpen ? '1.5px solid #C5A880' : '1px solid #E5E0D8',
            borderRadius: 6,
            fontSize: 14,
            color: disabled ? '#A1A1AA' : '#171717',
            outline: 'none',
            boxShadow: isOpen ? '0 0 0 3px rgba(197, 168, 128, 0.15)' : 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />

        <div
          style={{
            position: 'absolute',
            right: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {loading ? (
            <Loader2
              size={15}
              style={{
                color: '#C5A880',
                animation: 'spin 1s linear infinite',
              }}
            />
          ) : selectedOption && !disabled ? (
            <button
              type="button"
              onClick={handleClear}
              title="Xóa lựa chọn"
              style={{
                background: 'none',
                border: 'none',
                padding: 2,
                cursor: 'pointer',
                color: '#A1A1AA',
                display: 'flex',
                alignItems: 'center',
                borderRadius: 4,
              }}
            >
              <X size={14} />
            </button>
          ) : (
            <ChevronDown
              size={15}
              style={{
                color: '#A1A1AA',
                transform: isOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && !disabled && !loading && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E0D8',
            borderRadius: 8,
            boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.12)',
            zIndex: 1050,
            maxHeight: 230,
            overflowY: 'auto',
            animation: 'fadeIn 0.12s ease-out',
          }}
          ref={listRef}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => {
              const isSelected = String(opt.value) === String(value);
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={opt.value}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Giữ focus không bị mất
                    handleSelectOption(opt);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    padding: '9px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: 13.5,
                    backgroundColor: isHighlighted
                      ? '#F8F7F4'
                      : isSelected
                      ? '#FBF9F5'
                      : 'transparent',
                    color: isSelected ? '#171717' : '#27272A',
                    fontWeight: isSelected ? 600 : 400,
                    borderBottom:
                      idx === filteredOptions.length - 1
                        ? 'none'
                        : '1px solid #F4F4F5',
                    transition: 'background-color 0.1s',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span>{opt.label}</span>
                    {opt.subLabel && (
                      <span style={{ fontSize: 11.5, color: '#A1A1AA' }}>
                        {opt.subLabel}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check size={14} style={{ color: '#C5A880', flexShrink: 0 }} />
                  )}
                </div>
              );
            })
          ) : (
            <div
              style={{
                padding: '14px 12px',
                textAlign: 'center',
                color: '#A1A1AA',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Search size={14} />
              <span>Không tìm thấy "{searchTerm}"</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * GhnAddressSelector — Bộ chọn địa giới hành chính GHN gõ gợi ý thông minh
 */
export default function GhnAddressSelector({
  provinceId = '',
  districtId = '',
  wardCode = '',
  onChange,
  disabled = false,
  required = true,
}) {
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  const districtsCache = useRef(new Map());
  const wardsCache = useRef(new Map());

  const districtInputRef = useRef(null);
  const wardInputRef = useRef(null);

  // 1. Tải danh mục Tỉnh/Thành phố từ GHN API
  useEffect(() => {
    let isMounted = true;
    setLoadingProvinces(true);

    getGHNProvincesApi()
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        setProvinces(list);
      })
      .catch((err) => {
        console.error('Lỗi khi tải danh sách Tỉnh/Thành từ GHN:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingProvinces(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Tải danh mục Quận/Huyện khi provinceId thay đổi
  useEffect(() => {
    if (!provinceId) {
      setDistricts([]);
      setWards([]);
      return;
    }

    const pId = Number(provinceId);
    if (districtsCache.current.has(pId)) {
      setDistricts(districtsCache.current.get(pId));
      return;
    }

    let isMounted = true;
    setLoadingDistricts(true);

    getGHNDistrictsApi(pId)
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        districtsCache.current.set(pId, list);
        setDistricts(list);
      })
      .catch((err) => {
        console.error(`Lỗi khi tải Quận/Huyện của tỉnh ${provinceId}:`, err);
        if (isMounted) setDistricts([]);
      })
      .finally(() => {
        if (isMounted) setLoadingDistricts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [provinceId]);

  // 3. Tải danh mục Phường/Xã khi districtId thay đổi
  useEffect(() => {
    if (!districtId) {
      setWards([]);
      return;
    }

    const dId = Number(districtId);
    if (wardsCache.current.has(dId)) {
      setWards(wardsCache.current.get(dId));
      return;
    }

    let isMounted = true;
    setLoadingWards(true);

    getGHNWardsApi(dId)
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        wardsCache.current.set(dId, list);
        setWards(list);
      })
      .catch((err) => {
        console.error(`Lỗi khi tải Phường/Xã của quận ${districtId}:`, err);
        if (isMounted) setWards([]);
      })
      .finally(() => {
        if (isMounted) setLoadingWards(false);
      });

    return () => {
      isMounted = false;
    };
  }, [districtId]);

  // Format options
  const provinceOptions = useMemo(
    () =>
      provinces.map((p) => ({
        value: String(p.ProvinceID),
        label: p.ProvinceName,
        raw: p,
      })),
    [provinces]
  );

  const districtOptions = useMemo(
    () =>
      districts.map((d) => ({
        value: String(d.DistrictID),
        label: d.DistrictName,
        raw: d,
      })),
    [districts]
  );

  const wardOptions = useMemo(
    () =>
      wards.map((w) => ({
        value: String(w.WardCode),
        label: w.WardName,
        raw: w,
      })),
    [wards]
  );

  // Xử lý khi chọn Tỉnh/Thành
  const handleProvinceSelect = useCallback(
    (opt) => {
      if (!opt) {
        onChange?.({
          provinceId: null,
          city: '',
          districtId: null,
          district: '',
          wardCode: '',
          ward: '',
        });
        return;
      }

      const pId = Number(opt.value);
      onChange?.({
        provinceId: pId,
        city: opt.label,
        districtId: null,
        district: '',
        wardCode: '',
        ward: '',
      });

      // Tự động focus sang ô Quận/Huyện để khách gõ tiếp
      setTimeout(() => {
        districtInputRef.current?.focus();
      }, 50);
    },
    [onChange]
  );

  // Xử lý khi chọn Quận/Huyện
  const handleDistrictSelect = useCallback(
    (opt) => {
      const currentCity =
        provinces.find((p) => Number(p.ProvinceID) === Number(provinceId))
          ?.ProvinceName || '';

      if (!opt) {
        onChange?.({
          provinceId: Number(provinceId) || null,
          city: currentCity,
          districtId: null,
          district: '',
          wardCode: '',
          ward: '',
        });
        return;
      }

      const dId = Number(opt.value);
      onChange?.({
        provinceId: Number(provinceId) || null,
        city: currentCity,
        districtId: dId,
        district: opt.label,
        wardCode: '',
        ward: '',
      });

      // Tự động focus sang ô Phường/Xã để khách gõ tiếp
      setTimeout(() => {
        wardInputRef.current?.focus();
      }, 50);
    },
    [provinceId, provinces, onChange]
  );

  // Xử lý khi chọn Phường/Xã
  const handleWardSelect = useCallback(
    (opt) => {
      const currentCity =
        provinces.find((p) => Number(p.ProvinceID) === Number(provinceId))
          ?.ProvinceName || '';
      const currentDistrict =
        districts.find((d) => Number(d.DistrictID) === Number(districtId))
          ?.DistrictName || '';

      if (!opt) {
        onChange?.({
          provinceId: Number(provinceId) || null,
          city: currentCity,
          districtId: Number(districtId) || null,
          district: currentDistrict,
          wardCode: '',
          ward: '',
        });
        return;
      }

      onChange?.({
        provinceId: Number(provinceId) || null,
        city: currentCity,
        districtId: Number(districtId) || null,
        district: currentDistrict,
        wardCode: String(opt.value),
        ward: opt.label,
      });
    },
    [provinceId, districtId, provinces, districts, onChange]
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        width: '100%',
      }}
    >
      {/* 1. Tỉnh / Thành phố */}
      <AutocompleteField
        label="Tỉnh / Thành phố"
        icon={<MapPin size={12} style={{ color: '#C5A880' }} />}
        value={provinceId}
        options={provinceOptions}
        placeholder="Gõ tìm Tỉnh/Thành..."
        disabled={disabled}
        loading={loadingProvinces}
        onSelect={handleProvinceSelect}
        required={required}
      />

      {/* 2. Quận / Huyện */}
      <AutocompleteField
        inputRef={districtInputRef}
        label="Quận / Huyện"
        value={districtId}
        options={districtOptions}
        placeholder={!provinceId ? 'Chọn Tỉnh/Thành trước' : 'Gõ tìm Quận/Huyện...'}
        disabled={disabled || !provinceId}
        loading={loadingDistricts}
        onSelect={handleDistrictSelect}
        required={required}
      />

      {/* 3. Phường / Xã */}
      <AutocompleteField
        inputRef={wardInputRef}
        label="Phường / Xã"
        value={wardCode}
        options={wardOptions}
        placeholder={!districtId ? 'Chọn Quận/Huyện trước' : 'Gõ tìm Phường/Xã...'}
        disabled={disabled || !districtId}
        loading={loadingWards}
        onSelect={handleWardSelect}
        required={required}
      />
    </div>
  );
}
