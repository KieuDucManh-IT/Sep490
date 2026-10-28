import React, { useState } from 'react';
import { Spinner, Button } from 'react-bootstrap';
import { reverseGeocodeApi } from '../services/shopApi';

export const PROVINCE_DEFAULT_COORDS = {
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

/**
 * Look up default geographic coordinates for a given Vietnamese province name
 */
export const getProvinceCenterCoords = (name) => {
  if (!name) return null;
  const clean = name.trim().toLowerCase();
  for (const [prov, coords] of Object.entries(PROVINCE_DEFAULT_COORDS)) {
    const pClean = prov.toLowerCase();
    if (clean === pClean || clean.includes(pClean) || pClean.includes(clean)) {
      return coords;
    }
  }
  return null;
};

export default function GeoLocateButton({
  onLocationFound,
  onNotify,
  currentCity = 'Thành phố Hà Nội',
  disabled = false,
  label = 'Lấy vị trí GPS',
  size = 'sm',
  style = {},
}) {
  const [isLocating, setIsLocating] = useState(false);

  const notify = (msg, type = 'info') => {
    if (onNotify) onNotify(msg, type);
  };

  const handleLocate = () => {
    if (disabled || isLocating) return;

    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      const fallback = getProvinceCenterCoords(currentCity) || PROVINCE_DEFAULT_COORDS['Hà Nội'];
      if (onLocationFound) {
        onLocationFound({
          latitude: fallback.lat.toFixed(6),
          longitude: fallback.lng.toFixed(6),
          city: currentCity,
          isFallback: true,
        });
      }
      notify('Trình duyệt yêu cầu HTTPS để lấy GPS chính xác. Đã tự động định vị theo trung tâm Tỉnh/Thành.', 'info');
      return;
    }

    if (!navigator.geolocation) {
      const fallback = getProvinceCenterCoords(currentCity) || PROVINCE_DEFAULT_COORDS['Hà Nội'];
      if (onLocationFound) {
        onLocationFound({
          latitude: fallback.lat.toFixed(6),
          longitude: fallback.lng.toFixed(6),
          city: currentCity,
          isFallback: true,
        });
      }
      notify('Trình duyệt không hỗ trợ Geolocation. Đã định vị theo trung tâm Tỉnh/Thành.', 'info');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const latFixed = latitude.toFixed(6);
          const lngFixed = longitude.toFixed(6);

          let geoCity = '';
          let geoWard = '';
          let geoStreet = '';

          try {
            const geoRes = await reverseGeocodeApi(latitude, longitude);
            if (geoRes?.success && geoRes.data) {
              geoCity = geoRes.data.city || '';
              geoWard = geoRes.data.ward || '';
              geoStreet = geoRes.data.street || '';
            }
          } catch (_) {
          }

          if (onLocationFound) {
            onLocationFound({
              latitude: latFixed,
              longitude: lngFixed,
              city: geoCity,
              ward: geoWard,
              street: geoStreet,
              isFallback: false,
            });
          }

          notify(
            geoCity ? `Đã định vị thành công vị trí của bạn tại ${geoCity}!` : 'Đã định vị tọa độ GPS thiết bị thành công!',
            'success'
          );
        } catch (err) {
          notify(err.message || 'Lỗi khi xử lý vị trí GPS.', 'warning');
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        const fallback = getProvinceCenterCoords(currentCity) || PROVINCE_DEFAULT_COORDS['Hà Nội'];
        if (onLocationFound) {
          onLocationFound({
            latitude: fallback.lat.toFixed(6),
            longitude: fallback.lng.toFixed(6),
            city: currentCity,
            isFallback: true,
          });
        }

        let msg = 'Không thể lấy tín hiệu GPS thiết bị. Đã gán tọa độ trung tâm hành chính.';
        if (err.code === 1) msg = 'Quyền truy cập GPS bị từ chối trên trình duyệt. Đã gán tọa độ trung tâm hành chính.';
        else if (err.code === 2) msg = 'Không nhận được tín hiệu định vị GPS. Đã gán tọa độ trung tâm hành chính.';
        else if (err.code === 3) msg = 'Quá thời gian lấy vị trí GPS. Đã gán tọa độ trung tâm hành chính.';

        notify(msg, 'info');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <Button
      type="button"
      variant="outline-dark"
      size={size}
      disabled={disabled || isLocating}
      onClick={handleLocate}
      className="vestora-geolocate-btn d-inline-flex align-items-center gap-2"
      style={{
        borderRadius: '8px',
        fontWeight: 600,
        fontSize: size === 'sm' ? '12px' : '13px',
        padding: size === 'sm' ? '6px 12px' : '8px 16px',
        border: '1px solid #D97706',
        color: '#B45309',
        background: 'rgba(217, 119, 6, 0.05)',
        transition: 'all 0.2s ease',
        ...style,
      }}
      title="Bấm để lấy tọa độ thực tế từ GPS của thiết bị"
    >
      {isLocating ? (
        <>
          <Spinner animation="border" size="sm" role="status" style={{ width: '13px', height: '13px', borderWidth: '2px', color: '#D97706' }} />
          <span>Đang Định Vị GPS...</span>
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span>{label}</span>
        </>
      )}
    </Button>
  );
}
