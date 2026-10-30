import React, { useState } from 'react';
import { Spinner, Button } from 'react-bootstrap';
import { reverseGeocodeApi } from '../services/shopApi';
import { PROVINCE_DEFAULT_COORDS } from '../pages/owner/branches/utils/branchConstants';
import { getProvinceCoords } from '../pages/owner/branches/utils/branchHelpers';

export { PROVINCE_DEFAULT_COORDS };
export const getProvinceCenterCoords = getProvinceCoords;

export default function GeoLocateButton({
  onClick,
  loading = false,
  onLocationFound,
  onNotify,
  currentCity = 'Thành phố Hà Nội',
  disabled = false,
  label = 'Lấy vị trí GPS',
  size = 'sm',
  className = '',
}) {
  const [internalLocating, setInternalLocating] = useState(false);
  const isLocating = loading || internalLocating;

  const notify = (msg, type = 'info') => {
    if (onNotify) onNotify(msg, type);
  };

  const handleLocate = async (e) => {
    if (disabled || isLocating) return;

    if (onClick) {
      onClick(e);
      return;
    }

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

    setInternalLocating(true);
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
          } catch (_) {}

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
          setInternalLocating(false);
        }
      },
      (err) => {
        setInternalLocating(false);
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
      { timeout: 8000, enableHighAccuracy: false }
    );
  };

  return (
    <Button
      type="button"
      variant="outline-dark"
      size={size}
      disabled={disabled || isLocating}
      onClick={handleLocate}
      className={`vestora-geolocate-btn d-inline-flex align-items-center gap-2 ${className}`}
      title="Bấm để lấy tọa độ thực tế từ GPS hoặc mạng của thiết bị"
    >
      {isLocating ? (
        <>
          <Spinner animation="border" size="sm" role="status" className="vestora-geolocate-spinner" />
          <span>Đang Định Vị...</span>
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
