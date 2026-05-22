const LOCATION_CACHE_KEY = "flatOrigin.locationOrigin";
const LOCATION_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const COUNTRY_BOUNDS = [
  ["CA", 41, 84, -142, -52],
  ["US", 18, 72, -172, -66],
  ["MX", 14, 33, -119, -86],
  ["GB", 49, 61, -9, 2.5],
  ["IE", 51, 56, -11, -5],
];

function inferCountryCode(lat, lng) {
  for (const [code, minLat, maxLat, minLng, maxLng] of COUNTRY_BOUNDS) {
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      return code;
    }
  }
  return "";
}

function normalizeOrigin(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const countryCode = String(value?.country_code || value?.countryCode || "").trim().toUpperCase();
  return { lat, lng, country_code: countryCode || inferCountryCode(lat, lng) };
}

export function getCachedLocationOrigin() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOCATION_CACHE_KEY) || "null");
    const origin = normalizeOrigin(parsed);
    if (!origin) return null;
    const savedAt = Number(parsed?.savedAt || 0);
    if (!savedAt || Date.now() - savedAt > LOCATION_CACHE_MAX_AGE_MS) return null;
    return origin;
  } catch {
    return null;
  }
}

export function locationParams(origin) {
  const normalized = normalizeOrigin(origin);
  return normalized
    ? {
        lat: normalized.lat,
        lng: normalized.lng,
        ...(normalized.country_code ? { country_code: normalized.country_code } : {}),
      }
    : {};
}

export function formatDistanceMiles(value) {
  const miles = Number(value);
  if (!Number.isFinite(miles)) return "";
  if (miles < 0.1) return "Nearby";
  if (miles < 10) return `${miles.toFixed(1)} mi away`;
  return `${Math.round(miles)} mi away`;
}

export function requestLocationOrigin() {
  if (!("geolocation" in navigator)) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const origin = normalizeOrigin({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        if (origin) {
          localStorage.setItem(
            LOCATION_CACHE_KEY,
            JSON.stringify({ ...origin, savedAt: Date.now() })
          );
        }
        resolve(origin);
      },
      () => resolve(null),
      {
        enableHighAccuracy: false,
        maximumAge: LOCATION_CACHE_MAX_AGE_MS,
        timeout: 8000,
      }
    );
  });
}
