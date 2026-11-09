import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layers, Map as MapIcon, Maximize2, Crosshair } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { isValidCoordinate } from '../../../../utils/geoUtils';

// SVG Icon definition matching Vestora Luxury with Vibrant Orange accent
const createStoreMarkerIcon = (isSelected = false) => {
  const html = `
    <div class="vestora-radar-pin ${isSelected ? 'active' : ''}">
      <div class="vestora-pin-pulse ${isSelected ? 'pulse-active' : ''}"></div>
      <svg class="vestora-pin-svg" viewBox="0 0 384 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M192 0C85.961 0 0 85.961 0 192C0 327.422 172.703 500.562 180.094 507.953C183.391 511.25 187.688 512 192 512C196.312 512 200.609 511.25 203.906 507.953C211.297 500.562 384 327.422 384 192C384 85.961 298.039 0 192 0Z" fill="${isSelected ? '#ea580c' : '#1a1a1a'}"/>
        <path d="M192 16C94.8 16 16 94.8 16 192C16 312 165.6 470.8 192 496.4C218.4 470.8 368 312 368 192C368 94.8 289.2 16 192 16Z" fill="#ea580c"/>
        <circle cx="192" cy="192" r="72" fill="#FFFFFF"/>
        <circle cx="192" cy="192" r="40" fill="${isSelected ? '#bc4505' : '#1a1a1a'}"/>
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-store-pin-container',
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -46],
  });
};

const DEFAULT_STORE_ICON = createStoreMarkerIcon(false);
const SELECTED_STORE_ICON = createStoreMarkerIcon(true);

// Customer Location Pin with Blue Radar Pulse and Visible Badge
const createCustomerMarkerIcon = () => {
  const html = `
    <div class="customer-radar-pin">
      <div class="customer-radar-pulse"></div>
      <div class="customer-radar-pulse-outer"></div>
      <div class="customer-radar-core">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      </div>
      <div class="customer-radar-badge">Vị trí của bạn</div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-customer-pin-container',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
};

export default function RadarMapCanvas({
  stores,
  selectedStore,
  userLocation,
  onSelectStoreFromMarker,
  onQuickGps,
}) {
  const mapContainerRef = useRef(null);
  const localMapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const storeMarkersGroupRef = useRef(null);
  const markersMapRef = useRef(new Map());
  const prevSelectedStoreIdRef = useRef(null);
  const isInitialMountRef = useRef(true);

  const [mapLayerType, setMapLayerType] = useState('roadmap');

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (localMapRef.current) return;

    const markersMap = markersMapRef.current;
    const initialLat = userLocation?.latitude || 21.028511;
    const initialLng = userLocation?.longitude || 105.854167;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: true,
      attributionControl: false,
    });

    // Google Road Tiles (100% Free, Vietnamese accented street names)
    const initialTile = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map);

    tileLayerRef.current = initialTile;
    L.control.zoom({ position: 'topright' }).addTo(map);

    const storeLayer = L.layerGroup().addTo(map);
    storeMarkersGroupRef.current = storeLayer;

    localMapRef.current = map;

    return () => {
      map.remove();
      localMapRef.current = null;
      userMarkerRef.current = null;
      storeMarkersGroupRef.current = null;
      tileLayerRef.current = null;
      markersMap.clear();
      isInitialMountRef.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Toggle Map Layer: Street Road vs Satellite Hybrid
  const handleToggleMapLayer = useCallback(() => {
    const map = localMapRef.current;
    if (!map || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current);

    const nextType = mapLayerType === 'roadmap' ? 'satellite' : 'roadmap';
    const tileUrl =
      nextType === 'satellite'
        ? 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

    const newLayer = L.tileLayer(tileUrl, {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    }).addTo(map);

    tileLayerRef.current = newLayer;
    setMapLayerType(nextType);
  }, [mapLayerType]);

  // 3. Update Customer Marker
  useEffect(() => {
    const map = localMapRef.current;
    if (!map) return;

    const uLat = userLocation?.latitude;
    const uLng = userLocation?.longitude;

    if (!isValidCoordinate(uLat, uLng)) return;

    const userPopupContent = `
      <div class="popup-inner-card" style="width: 230px; padding: 14px 16px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <div style="width: 26px; height: 26px; border-radius: 50%; background: #2563EB; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </div>
          <div>
            <div style="font-weight: 700; font-size: 13.5px; color: #171717;">Vị trí của bạn</div>
            <div style="font-size: 11px; color: ${userLocation?.isExactGps ? '#059669' : '#D97706'}; font-weight: 600;">
              ${userLocation?.isExactGps ? '● GPS chính xác' : '● Vị trí khu vực'}
            </div>
          </div>
        </div>
        <div style="font-size: 12px; color: #555; line-height: 1.4; margin-top: 6px; border-top: 1px solid #eee; padding-top: 6px;">
          ${userLocation?.city || 'Hà Nội'}
        </div>
      </div>
    `;

    if (!userMarkerRef.current || !map.hasLayer(userMarkerRef.current)) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
      }
      const marker = L.marker([uLat, uLng], {
        icon: createCustomerMarkerIcon(),
        zIndexOffset: 1000,
      }).addTo(map);

      marker.bindPopup(userPopupContent, { className: 'vestora-popup', autoPan: false });
      userMarkerRef.current = marker;
    } else {
      userMarkerRef.current.setLatLng([uLat, uLng]);
      userMarkerRef.current.setPopupContent(userPopupContent);
    }
  }, [userLocation]);

  // 4. Populate Store Markers (Runs ONLY when stores or userLocation updates)
  useEffect(() => {
    const map = localMapRef.current;
    const group = storeMarkersGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    markersMapRef.current.clear();
    prevSelectedStoreIdRef.current = null;

    const boundsPoints = [];
    if (isValidCoordinate(userLocation?.latitude, userLocation?.longitude)) {
      boundsPoints.push([userLocation.latitude, userLocation.longitude]);
    }

    stores.forEach((store) => {
      if (!store.latitude || !store.longitude) return;

      const isSelected = selectedStore?.id === store.id;
      const marker = L.marker([store.latitude, store.longitude], {
        icon: isSelected ? SELECTED_STORE_ICON : DEFAULT_STORE_ICON,
        zIndexOffset: isSelected ? 500 : 100,
      });

      const gmapsLink =
        userLocation?.latitude && userLocation?.longitude
          ? `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${store.latitude},${store.longitude}`
          : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.name + ' ' + store.address)}`;

      const popupContent = `
        <div class="popup-inner-card">
          <div class="popup-store-name">${store.name}</div>
          <div class="popup-store-dist">Cách bạn ${store.distanceLabel} (${store.travelTimeLabel})</div>
          <div class="popup-store-addr">${store.address}</div>
          <div class="popup-btn-row">
            <a href="${gmapsLink}" target="_blank" rel="noopener noreferrer" class="radar-btn-outline" style="text-align:center; text-decoration:none;">
              Mở Google Maps
            </a>
            <a href="/catalog?shop=${store.id}" class="radar-btn-gold" style="text-align:center; text-decoration:none;">
              Xem sản phẩm
            </a>
          </div>
        </div>
      `;
      marker.bindPopup(popupContent, { className: 'vestora-popup', autoPan: false });

      marker.on('click', () => {
        onSelectStoreFromMarker(store);
      });

      marker.addTo(group);
      markersMapRef.current.set(store.id, marker);
      boundsPoints.push([store.latitude, store.longitude]);
    });

    if (boundsPoints.length > 0) {
      map.fitBounds(boundsPoints, { padding: [50, 50], maxZoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores, userLocation, onSelectStoreFromMarker]);

  // 5. Silky Smooth Store Selection: In-place icon swap + smooth camera glide (no layer rebuild!)
  useEffect(() => {
    if (!selectedStore) return;
    const map = localMapRef.current;
    if (!map) return;

    const prevId = prevSelectedStoreIdRef.current;
    const currentId = selectedStore.id;

    // Reset previous selected marker to normal
    if (prevId && prevId !== currentId) {
      const prevMarker = markersMapRef.current.get(prevId);
      if (prevMarker) {
        prevMarker.setIcon(DEFAULT_STORE_ICON);
        prevMarker.setZIndexOffset(100);
      }
    }

    // Activate newly selected marker
    const currentMarker = markersMapRef.current.get(currentId);
    if (currentMarker) {
      currentMarker.setIcon(SELECTED_STORE_ICON);
      currentMarker.setZIndexOffset(500);

      // Do not fly away on initial mount so customer can see both their location and stores overview
      if (isInitialMountRef.current) {
        isInitialMountRef.current = false;
      } else {
        if (isValidCoordinate(selectedStore.latitude, selectedStore.longitude)) {
          map.flyTo([selectedStore.latitude, selectedStore.longitude], 15, {
            animate: true,
            duration: 0.55,
            easeLinearity: 0.25,
          });
          currentMarker.openPopup();
        }
      }
    }

    prevSelectedStoreIdRef.current = currentId;
  }, [selectedStore]);

  // 6. Fit all bounds
  const handleFitAllBounds = useCallback(() => {
    const map = localMapRef.current;
    if (!map) return;

    const boundsPoints = [];
    if (isValidCoordinate(userLocation?.latitude, userLocation?.longitude)) {
      boundsPoints.push([userLocation.latitude, userLocation.longitude]);
    }
    stores.forEach((store) => {
      if (isValidCoordinate(store.latitude, store.longitude)) {
        boundsPoints.push([store.latitude, store.longitude]);
      }
    });

    if (boundsPoints.length > 0) {
      map.fitBounds(boundsPoints, { padding: [50, 50], maxZoom: 15 });
    }
  }, [stores, userLocation]);

  // 7. Center on Customer Location
  const handleCenterOnUser = useCallback(() => {
    const map = localMapRef.current;
    if (!map) return;

    const uLat = userLocation?.latitude;
    const uLng = userLocation?.longitude;

    if (isValidCoordinate(uLat, uLng)) {
      map.flyTo([uLat, uLng], 15, {
        animate: true,
        duration: 0.6,
        easeLinearity: 0.25,
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.openPopup();
      }
    } else if (onQuickGps) {
      onQuickGps();
    }
  }, [userLocation, onQuickGps]);

  return (
    <section className="radar-map-wrapper" aria-label="Bản đồ tương tác showroom">
      <div ref={mapContainerRef} className="radar-leaflet-container" />

      <div className="radar-map-floating-actions" role="toolbar" aria-label="Công cụ bản đồ">
        {/* Center / Locate User */}
        <button
          type="button"
          className="radar-fab-btn radar-fab-user"
          onClick={handleCenterOnUser}
          title="Xem vị trí của bạn"
          aria-label="Xem vị trí của bạn"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Crosshair size={18} color="#2563EB" aria-hidden="true" />
        </button>

        {/* Toggle Satellite / Road view */}
        <button
          type="button"
          className="radar-fab-btn"
          onClick={handleToggleMapLayer}
          title={mapLayerType === 'roadmap' ? 'Xem ảnh vệ tinh' : 'Xem bản đồ đường phố'}
          aria-label={mapLayerType === 'roadmap' ? 'Xem ảnh vệ tinh' : 'Xem bản đồ đường phố'}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {mapLayerType === 'roadmap' ? (
            <Layers size={18} color="#C5A880" aria-hidden="true" />
          ) : (
            <MapIcon size={18} color="#C5A880" aria-hidden="true" />
          )}
        </button>

        {/* Fit all stores */}
        <button
          type="button"
          className="radar-fab-btn"
          onClick={handleFitAllBounds}
          title="Xem toàn bộ cửa hàng"
          aria-label="Xem toàn bộ cửa hàng"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Maximize2 size={18} color="#C5A880" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
