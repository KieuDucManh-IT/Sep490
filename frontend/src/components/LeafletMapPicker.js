import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../styles/LeafletMapPicker.css';

// SVG Icon definition matching Vestora Luxury Gold/Black branding
const createVestoraMarkerIcon = () => {
  const svgHtml = `
    <div class="vestora-pin-marker">
      <div class="vestora-pin-pulse"></div>
      <svg class="vestora-pin-svg" viewBox="0 0 384 512" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M192 0C85.961 0 0 85.961 0 192C0 327.422 172.703 500.562 180.094 507.953C183.391 511.25 187.688 512 192 512C196.312 512 200.609 511.25 203.906 507.953C211.297 500.562 384 327.422 384 192C384 85.961 298.039 0 192 0Z" fill="#171717"/>
        <path d="M192 16C94.8 16 16 94.8 16 192C16 312 165.6 470.8 192 496.4C218.4 470.8 368 312 368 192C368 94.8 289.2 16 192 16Z" fill="#D97706"/>
        <circle cx="192" cy="192" r="72" fill="#FFFFFF"/>
        <circle cx="192" cy="192" r="40" fill="#171717"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'vestora-custom-pin-container',
    iconSize: [38, 48],
    iconAnchor: [19, 48],
    popupAnchor: [0, -48],
  });
};

// Default fallback coordinates (Hanoi / Central Vietnam)
const DEFAULT_CENTER = [21.028511, 105.854167];
const DEFAULT_ZOOM = 15;

export default function LeafletMapPicker({
  latitude,
  longitude,
  onChange,
  readOnly = false,
  height = '320px',
  label = 'VỊ TRÍ CỬA HÀNG',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const isInternalMoveRef = useRef(false);

  const [currentCoords, setCurrentCoords] = useState(() => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return [lat, lng];
    }
    return DEFAULT_CENTER;
  });

  const hasCoords = !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude));

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const initialLat = parseFloat(latitude);
      const initialLng = parseFloat(longitude);
      const initCenter =
        !isNaN(initialLat) && !isNaN(initialLng)
          ? [initialLat, initialLng]
          : DEFAULT_CENTER;

      const map = L.map(mapContainerRef.current, {
        center: initCenter,
        zoom: hasCoords ? DEFAULT_ZOOM : 13,
        zoomControl: true,
        scrollWheelZoom: !readOnly,
        dragging: true,
        attributionControl: false,
      });

      // Google Maps Road Tiles (100% Free, 0 VNĐ, CDN cực nhanh tại VN, đầy đủ tên đường tiếng Việt có dấu)
      const googleRoad = L.tileLayer(
        'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
        {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '© Google Maps',
        }
      );

      // Google Maps Hybrid (Ảnh vệ tinh + tên đường)
      const googleHybrid = L.tileLayer(
        'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
        {
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
          attribution: '© Google Maps',
        }
      );

      // OpenStreetMap FR (Dự phòng quốc tế - không bị lỗi DNS getaddrinfo tại VN)
      const osmFr = L.tileLayer(
        'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
        {
          maxZoom: 20,
          subdomains: ['a', 'b', 'c'],
          attribution: '© OpenStreetMap contributors',
        }
      );

      // Thêm Google Maps đường phố làm lớp mặc định
      googleRoad.addTo(map);

      // Thêm nút chuyển đổi lớp bản đồ (Góc dưới phải)
      L.control
        .layers(
          {
            'Bản đồ đường đi': googleRoad,
            'Ảnh vệ tinh': googleHybrid,
            'OpenStreetMap FR': osmFr,
          },
          null,
          { position: 'bottomright' }
        )
        .addTo(map);

      // Create Custom Pin Marker
      const icon = createVestoraMarkerIcon();
      const marker = L.marker(initCenter, {
        icon,
        draggable: !readOnly,
        autoPan: true,
      }).addTo(map);

      // Drag event on marker
      marker.on('dragend', () => {
        if (readOnly) return;
        const pos = marker.getLatLng();
        isInternalMoveRef.current = true;
        setCurrentCoords([pos.lat, pos.lng]);
        if (onChange) {
          onChange({
            latitude: pos.lat.toFixed(6),
            longitude: pos.lng.toFixed(6),
          });
        }
      });

      // Click event on map canvas
      map.on('click', (e) => {
        if (readOnly) return;
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        isInternalMoveRef.current = true;
        setCurrentCoords([lat, lng]);
        if (onChange) {
          onChange({
            latitude: lat.toFixed(6),
            longitude: lng.toFixed(6),
          });
        }
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Invalidate size theo nhiều mốc thời gian để xử lý triệt để hiệu ứng chuyển cảnh của Bootstrap Modal (300ms)
      const timer1 = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);

      const timer2 = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 350);

      const timer3 = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 600);

      // ResizeObserver xử lý khi container thay đổi kích thước linh hoạt
      const ro = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      });
      ro.observe(mapContainerRef.current);

      // Lắng nghe sự kiện resize của window (được kích hoạt khi Modal hoàn tất hiệu ứng mở)
      const handleWindowResize = () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      };
      window.addEventListener('resize', handleWindowResize);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        window.removeEventListener('resize', handleWindowResize);
        ro.disconnect();
        map.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      };
    }
  }, [readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Synchronize external coordinates change (e.g. from GPS button, city dropdown, or props update)
  useEffect(() => {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      setCurrentCoords([lat, lng]);

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        // If the movement was triggered externally (not by local dragging), smoothly fly to target
        if (!isInternalMoveRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], DEFAULT_ZOOM, {
            duration: 1.2,
          });
        }
        isInternalMoveRef.current = false;
      }
    }
  }, [latitude, longitude]);

  // Recenter button click
  const handleRecenter = useCallback(() => {
    if (mapInstanceRef.current && markerRef.current) {
      const pos = markerRef.current.getLatLng();
      mapInstanceRef.current.setView(pos, DEFAULT_ZOOM);
    }
  }, []);

  return (
    <div
      className="leaflet-map-picker-wrapper"
      style={{ height }}
      onMouseEnter={() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }}
    >
      {/* Top Header Floating Glassmorphic Overlay */}
      <div className="leaflet-map-overlay-top">
        <div className={`leaflet-map-badge ${hasCoords ? 'gold' : ''}`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {hasCoords && <span className="leaflet-map-badge-dot" />}
          <span>{label}</span>
          {hasCoords && (
            <span className="leaflet-map-badge-coords">
              {currentCoords[0].toFixed(4)}° N, {currentCoords[1].toFixed(4)}° E
            </span>
          )}
        </div>

        <button
          type="button"
          className="leaflet-map-recenter-btn"
          onClick={handleRecenter}
          title="Đưa góc nhìn bản đồ về tâm điểm vị trí cửa hàng"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="22" y1="12" x2="18" y2="12" />
            <line x1="6" y1="12" x2="2" y2="12" />
            <line x1="12" y1="6" x2="12" y2="2" />
            <line x1="12" y1="22" x2="12" y2="18" />
          </svg>
          <span>Về vị trí ghim</span>
        </button>
      </div>

      {/* Map DOM Element */}
      <div ref={mapContainerRef} className="leaflet-map-container" />

      {/* Bottom Hint */}
      {!readOnly && (
        <div className="leaflet-map-overlay-bottom">
          <div className="leaflet-map-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <span>
              <strong>Mẹo:</strong> Nhấp trên bản đồ hoặc kéo giữ ghim để chọn vị trí cửa hàng chính xác.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
