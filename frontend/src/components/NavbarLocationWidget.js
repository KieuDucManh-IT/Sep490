import React, { useState, useEffect, useRef } from 'react';
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
  };

  const handleQuickGps = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ định vị Geolocation.');
      return;
    }

    setLocating(true);
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
        alert(
          err.code === 1
            ? 'Quyền truy cập vị trí bị từ chối. Bạn vui lòng chọn Tỉnh/Thành từ danh sách.'
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
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          borderRadius: '999px',
          padding: '5px 12px',
          fontSize: '12.5px',
          fontWeight: '600',
          color: '#a53a00',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
      >
        <i className="fa-solid fa-location-dot" style={{ color: '#ea580c', fontSize: '13px' }}></i>
        <span style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentLocation?.shortCity || currentLocation?.city || 'Hà Nội'}
        </span>
        <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px', opacity: 0.7 }}></i>
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
            border: '1px solid #e4e4e7',
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
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                color: '#1d4ed8',
                fontSize: '12px',
                fontWeight: '600',
                cursor: locating ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              <i className={`fa-solid ${locating ? 'fa-spinner fa-spin' : 'fa-crosshairs'}`}></i>
              <span>{locating ? 'Đang định vị GPS...' : 'Lấy vị trí hiện tại (GPS)'}</span>
            </button>
          </div>

          {/* Search Box */}
          <div style={{ padding: '10px 14px 6px' }}>
            <div style={{ position: 'relative' }}>
              <i
                className="fa-solid fa-magnifying-glass"
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '11px',
                  color: '#a1a1aa',
                }}
              ></i>
              <input
                type="text"
                placeholder="Tìm Tỉnh / Thành phố..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 28px',
                  fontSize: '12px',
                  border: '1px solid #e4e4e7',
                  borderRadius: '6px',
                  outline: 'none',
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
                      color: isSelected ? '#ea580c' : '#18181b',
                      background: isSelected ? '#fff7ed' : 'transparent',
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
                    {isSelected && <i className="fa-solid fa-check" style={{ fontSize: '11px' }}></i>}
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
