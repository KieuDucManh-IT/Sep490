import { useState, useEffect, useMemo, useCallback } from 'react';
import { getShopsListApi, reverseGeocodeApi } from '../../../../services/shopApi';
import { getUserLocation, setUserLocation } from '../../../../utils/userLocation';
import {
  calculateHaversineDistanceKm,
  estimateRoadDistanceKm,
  estimateTravelTimeMinutes,
  formatDistanceLabel,
  formatTravelTimeLabel,
  isValidCoordinate,
} from '../../../../utils/geoUtils';

export const RADIUS_OPTIONS = [
  { id: 'ALL', label: 'Tất cả' },
  { id: '3km', label: 'Dưới 3 km', km: 3 },
  { id: '5km', label: 'Dưới 5 km', km: 5 },
  { id: '10km', label: 'Dưới 10 km', km: 10 },
  { id: '20km', label: 'Dưới 20 km', km: 20 },
];

/**
 * Custom hook managing all shop radar data, GPS sync, distance calculations, and filters
 */
export function useShopRadarData() {
  const [userLocation, setLocationState] = useState(getUserLocation);
  const [locating, setLocating] = useState(false);
  const [rawShops, setRawShops] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedRadius, setSelectedRadius] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStore, setSelectedStore] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  }, []);

  // 1. Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. Listen for global location changes
  useEffect(() => {
    const handleLocationChange = () => {
      setLocationState(getUserLocation());
    };
    window.addEventListener('userLocationChanged', handleLocationChange);
    return () => window.removeEventListener('userLocationChanged', handleLocationChange);
  }, []);

  // 3. Fetch shops from database
  useEffect(() => {
    let isMounted = true;
    async function loadShops() {
      try {
        setLoading(true);
        const res = await getShopsListApi({ limit: 100 });
        if (isMounted && res?.success && Array.isArray(res.data)) {
          setRawShops(res.data);
        }
      } catch (err) {
        console.error('Lỗi khi tải danh sách cửa hàng:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadShops();
    return () => {
      isMounted = false;
    };
  }, []);

  // 4. Process shops: Compute distance, road distance, travel time & sort
  const processedShops = useMemo(() => {
    const userLat = userLocation?.latitude;
    const userLng = userLocation?.longitude;
    const hasUserGps = isValidCoordinate(userLat, userLng);

    const enriched = rawShops.map((shop) => {
      const hasShopCoords = isValidCoordinate(shop.latitude, shop.longitude);
      let haversineKm = null;
      let roadDistanceKm = null;
      let travelTimeMinutes = null;

      if (hasUserGps && hasShopCoords) {
        haversineKm = calculateHaversineDistanceKm(
          userLat,
          userLng,
          shop.latitude,
          shop.longitude
        );
        roadDistanceKm = estimateRoadDistanceKm(haversineKm);
        travelTimeMinutes = estimateTravelTimeMinutes(roadDistanceKm);
      }

      return {
        id: shop._id,
        name: shop.name,
        address: [shop.address, shop.ward, shop.city].filter(Boolean).join(', ') || 'Đang cập nhật địa chỉ',
        phone: shop.phone || '0988 888 888',
        latitude: hasShopCoords ? parseFloat(shop.latitude) : null,
        longitude: hasShopCoords ? parseFloat(shop.longitude) : null,
        status: shop.status || 'ACTIVE',
        hasGps: hasShopCoords,
        haversineKm,
        roadDistanceKm,
        travelTimeMinutes,
        distanceLabel: formatDistanceLabel(roadDistanceKm),
        travelTimeLabel: formatTravelTimeLabel(travelTimeMinutes),
        imageUrl: shop.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(shop.name || 'Cửa hàng')}&background=1a1a1a&color=EA580C&size=120`,
      };
    });

    // Filter by search keyword
    const cleanSearch = debouncedSearch.trim().toLowerCase();
    const filtered = enriched.filter((s) => {
      if (!cleanSearch) return true;
      return (
        s.name.toLowerCase().includes(cleanSearch) ||
        s.address.toLowerCase().includes(cleanSearch)
      );
    });

    // Filter by radius
    const radiusConfig = RADIUS_OPTIONS.find((r) => r.id === selectedRadius);
    const radiusFiltered = filtered.filter((s) => {
      if (!radiusConfig || radiusConfig.id === 'ALL') return true;
      if (s.roadDistanceKm == null) return false;
      return s.roadDistanceKm <= radiusConfig.km;
    });

    // Sort: Nearest road distance first, then no GPS at the end
    return radiusFiltered.sort((a, b) => {
      if (a.roadDistanceKm != null && b.roadDistanceKm != null) {
        return a.roadDistanceKm - b.roadDistanceKm;
      }
      if (a.roadDistanceKm != null) return -1;
      if (b.roadDistanceKm != null) return 1;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [rawShops, userLocation, debouncedSearch, selectedRadius]);

  // Set default selected store once loaded or when current selection is filtered out
  useEffect(() => {
    if (processedShops.length === 0) {
      setSelectedStore(null);
      return;
    }
    const isCurrentStillVisible = selectedStore && processedShops.some((s) => s.id === selectedStore.id);
    if (!isCurrentStillVisible) {
      setSelectedStore(processedShops[0]);
    }
  }, [processedShops, selectedStore]);

  // 5. GPS Re-locate action
  const handleQuickGps = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('Trình duyệt của bạn chưa hỗ trợ tính năng định vị.');
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

          const updated = setUserLocation({
            city: detectedCity || userLocation.city,
            latitude,
            longitude,
            isExactGps: true,
          });
          setLocationState(updated);
          showToast('Đã định vị thành công vị trí của quý khách.');
        } catch (err) {
          console.warn('Lỗi định vị:', err);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        showToast(
          err.code === 1
            ? 'Bạn chưa cho phép quyền vị trí. Hãy bật định vị trên trình duyệt để tìm showroom gần nhất.'
            : 'Tín hiệu GPS đang chập chờn, xin vui lòng thử lại sau ít giây.'
        );
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, [userLocation?.city, showToast]);

  return {
    userLocation,
    locating,
    handleQuickGps,
    loading,
    processedShops,
    selectedRadius,
    setSelectedRadius,
    searchTerm,
    setSearchTerm,
    selectedStore,
    setSelectedStore,
    toastMessage,
    clearToast: () => setToastMessage(null),
  };
}
