/**
 * Utility functions for geo-coordinate calculations & distance formatting
 * 100% Free & Zero external dependency
 */

/**
 * Validates whether latitude and longitude are valid numbers within coordinate bounds
 */
export const isValidCoordinate = (lat, lng) => {
  if (lat == null || lng == null) return false;
  const pLat = typeof lat === 'number' ? lat : parseFloat(lat);
  const pLng = typeof lng === 'number' ? lng : parseFloat(lng);
  if (!Number.isFinite(pLat) || !Number.isFinite(pLng)) return false;
  if (pLat < -90 || pLat > 90 || pLng < -180 || pLng > 180) return false;
  return true;
};

/**
 * Calculates straight-line great-circle distance (Haversine formula) in kilometers.
 * @returns {number|null} distance in km rounded to 1 decimal place, or null if coordinates invalid.
 */
export const calculateHaversineDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return null;
  }

  const pLat1 = typeof lat1 === 'number' ? lat1 : parseFloat(lat1);
  const pLon1 = typeof lon1 === 'number' ? lon1 : parseFloat(lon1);
  const pLat2 = typeof lat2 === 'number' ? lat2 : parseFloat(lat2);
  const pLon2 = typeof lon2 === 'number' ? lon2 : parseFloat(lon2);

  if (pLat1 === pLat2 && pLon1 === pLon2) return 0;

  const R = 6371; // Earth's mean radius in kilometers
  const dLat = ((pLat2 - pLat1) * Math.PI) / 180;
  const dLon = ((pLon2 - pLon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pLat1 * Math.PI) / 180) *
      Math.cos((pLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
};

/**
 * Estimates actual road travel distance by applying the Vietnam urban road tortuosity multiplier (1.25x).
 * @param {number} haversineKm - Great circle distance in km
 * @returns {number|null}
 */
export const estimateRoadDistanceKm = (haversineKm) => {
  if (haversineKm == null || !Number.isFinite(haversineKm)) return null;
  return Math.round(haversineKm * 1.25 * 10) / 10;
};

/**
 * Estimates travel time in minutes based on road distance and average urban traffic speed.
 * @param {number} roadDistanceKm - Distance in km
 * @param {number} avgSpeedKmH - Average speed in km/h (default: 25 km/h)
 * @returns {number|null}
 */
export const estimateTravelTimeMinutes = (roadDistanceKm, avgSpeedKmH = 25) => {
  if (roadDistanceKm == null || !Number.isFinite(roadDistanceKm)) return null;
  const minutes = (roadDistanceKm / avgSpeedKmH) * 60;
  return Math.max(2, Math.round(minutes));
};

/**
 * Formats distance nicely for display (e.g., '850 m' or '3.2 km')
 * @param {number} distanceKm
 * @returns {string}
 */
export const formatDistanceLabel = (distanceKm) => {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return 'Chưa xác định';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

/**
 * Formats travel time label (e.g., '~5 phút')
 * @param {number} minutes
 * @returns {string}
 */
export const formatTravelTimeLabel = (minutes) => {
  if (minutes == null || !Number.isFinite(minutes)) return '';
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `~${hours}h ${mins}p` : `~${hours}h`;
  }
  return `~${minutes} phút`;
};
