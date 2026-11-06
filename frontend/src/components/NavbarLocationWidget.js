import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  ChevronDown,
  Crosshair,
  Loader2,
  Search,
  Check,
  AlertCircle,
} from 'lucide-react';
import { getUserLocation, setUserLocation } from '../utils/userLocation';
import { PROVINCE_DEFAULT_COORDS } from '../pages/owner/branches/utils/branchConstants';
import { reverseGeocodeApi } from '../services/shopApi';

const ALL_PROVINCES = Object.keys(PROVINCE_DEFAULT_COORDS)
  .filter((name) => !name.startsWith('Thành phố '))
  .sort((a, b) => a.localeCompare(b, 'vi'));

export default function NavbarLocationWidget() {
  const [currentLocation, setCurrentLocation] = useState(getUserLocation);
  const [isOpen, setIsOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const popoverRef = useRef(null);

  useEffect(() => {
    const handleUpdate = () => {
      setCurrentLocation(getUserLocation());
    };
    window.addEventListener('userLocationChanged', handleUpdate);
    return () => window.removeEventListener('userLocationChanged', handleUpdate);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelectCity = (city) => {
    setUserLocation({ city, isExactGps: false });
    setIsOpen(false);
    setSearchTerm('');
    setErrorMessage(null);
  };

  const handleQuickGps = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Trình duyệt của bạn không hỗ trợ định vị Geolocation.');
      return;
    }

    setLocating(true);
    setErrorMessage(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          let detectedCity = '';
          try {
            const res = await reverseGeocodeApi(latitude, longitude);
            if (res?.success && res.data?.city) {
              detectedCity = res.data.city;
            }
          } catch (_) {}

          setUserLocation({
            city: detectedCity || currentLocation.city,
            latitude,
            longitude,
            isExactGps: true,
          });
          setIsOpen(false);
          setSearchTerm('');
        } catch (err) {
          console.warn('Lỗi xử lý GPS:', err);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        setErrorMessage(
          err.code === 1
            ? 'Quyền định vị bị từ chối. Vui lòng chọn Tỉnh/Thành từ danh sách.'
            : 'Không thể nhận tín hiệu GPS lúc này.'
        );
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  const filteredProvinces = ALL_PROVINCES.filter((p) =>
    p.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="navbar-location-wrapper" ref={popoverRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="navbar-location-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Chọn khu vực của bạn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: 'rgba(197, 168, 128, 0.1)',
          border: '1px solid rgba(197, 168, 128, 0.4)',
          borderRadius: '999px',
          padding: '5px 12px',
          fontSize: '12.5px',
          fontWeight: '600',
          color: '#C5A880',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
      >
        <MapPin size={13} color="#C5A880" />
        <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentLocation?.shortCity || currentLocation?.city || 'Hà Nội'}
        </span>
        <ChevronDown size={12} style={{ opacity: 0.7 }} />
      </button>

      {isOpen && (
        <div
          className="navbar-location-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '280px',
            background: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #E5E0D8',
            zIndex: 1050,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          {/* Header */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f4f4f5' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#18181b', marginBottom: '8px' }}>
              Chọn khu vực của bạn
            </div>

            {/* GPS Fast Action Button */}
            <button
              type="button"
              onClick={handleQuickGps}
              disabled={locating}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: '#FAF5EE',
                border: '1px solid #E8DECF',
                borderRadius: '8px',
                color: '#96723D',
                fontSize: '12px',
                fontWeight: '600',
                cursor: locating ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              {locating ? <Loader2 size={13} className="spin" /> : <Crosshair size={13} />}
              <span>{locating ? 'Đang định vị GPS...' : 'Lấy vị trí hiện tại (GPS)'}</span>
            </button>

            {errorMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#DC2626',
                  fontSize: '11px',
                  marginTop: '8px',
                  lineHeight: 1.3,
                }}
              >
                <AlertCircle size={13} style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Search Box */}
          <div style={{ padding: '10px 14px 6px' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={13}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#a1a1aa',
                }}
              />
              <input
                type="text"
                placeholder="Tìm Tỉnh / Thành phố..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 28px',
                  fontSize: '12px',
                  border: '1px solid #E5E0D8',
                  borderRadius: '6px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* 63 Provinces Scroll List */}
          <div
            style={{
              maxHeight: '220px',
              overflowY: 'auto',
              padding: '0 8px 8px',
            }}
          >
            {filteredProvinces.length > 0 ? (
              filteredProvinces.map((p) => {
                const isSelected =
                  currentLocation?.shortCity === p || currentLocation?.city?.includes(p);
                return (
                  <div
                    key={p}
                    onClick={() => handleSelectCity(p)}
                    style={{
                      padding: '7px 10px',
                      fontSize: '12.5px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      color: isSelected ? '#C5A880' : '#18181b',
                      background: isSelected ? '#FAF5EE' : 'transparent',
                      fontWeight: isSelected ? '700' : '400',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f4f4f5';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <span>{p}</span>
                    {isSelected && <Check size={13} color="#C5A880" />}
                  </div>
                );
              })
            ) : (
              <div style={{ padding: '12px', textAlign: 'center', color: '#a1a1aa', fontSize: '12px' }}>
                Không tìm thấy tỉnh thành phù hợp
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
