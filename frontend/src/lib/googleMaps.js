import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export const DEFAULT_CENTER = { lat: 39.9526, lng: -75.1652 };
const MILES_TO_METERS = 1609.344;

let loaderConfigured = false;
let configuredKey = "";
const resolvedCenterCache = new Map();

export function normalizeLocationQuery(raw) {
  const value = (raw || "").trim();
  if (!value) return "";

  const usZip = /^\d{5}(-\d{4})?$/.test(value);
  if (usZip) return `${value}, USA`;

  const canadianPostal = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(value);
  if (canadianPostal) return `${value}, Canada`;

  return value;
}

export function milesToMeters(miles) {
  const numericMiles = Number(miles);
  if (!Number.isFinite(numericMiles) || numericMiles <= 0) return 0;
  return numericMiles * MILES_TO_METERS;
}

export function getGoogleMapsApiKey() {
  const runtimeKey =
    typeof window !== "undefined" ? window.__ENV__?.GOOGLE_MAPS_API_KEY : "";
  const viteKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  return String(runtimeKey || viteKey || "").trim();
}

export function getGoogleMapsMapId() {
  const runtimeMapId =
    typeof window !== "undefined" ? window.__ENV__?.GOOGLE_MAPS_MAP_ID : "";
  const viteMapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "";
  return String(runtimeMapId || viteMapId || "DEMO_MAP_ID").trim();
}

export function isPlaceholderGoogleMapsKey(key) {
  if (!key) return true;
  const value = key.trim().toLowerCase();
  return (
    value === "your_key_if_needed" ||
    value === "your_google_maps_api_key" ||
    value === "your_api_key" ||
    value.includes("replace_me")
  );
}

export async function loadGoogleMaps() {
  const apiKey = getGoogleMapsApiKey();
  if (isPlaceholderGoogleMapsKey(apiKey)) {
    throw new Error(
      "Invalid or missing Google Maps API key. Set VITE_GOOGLE_MAPS_API_KEY to a real key and restart the frontend."
    );
  }

  if (!loaderConfigured) {
    setOptions({
      key: apiKey,
      v: "weekly",
      libraries: ["places"],
    });
    loaderConfigured = true;
    configuredKey = apiKey;
  } else if (configuredKey !== apiKey) {
    console.warn(
      "[googleMaps] Google Maps loader already initialized with a different key. Reusing the first configured key."
    );
  }

  const [{ Map }, { Geocoder }, { AdvancedMarkerElement }] = await Promise.all([
    importLibrary("maps"),
    importLibrary("geocoding"),
    importLibrary("marker"),
  ]);

  return { Map, Geocoder, AdvancedMarkerElement };
}

export async function geocodeLocationQuery(rawQuery) {
  const normalizedQuery = normalizeLocationQuery(rawQuery);
  if (!normalizedQuery) return null;

  const cachedCenter = resolvedCenterCache.get(normalizedQuery);
  if (cachedCenter) {
    return { center: cachedCenter, normalizedQuery, fromCache: true };
  }

  const { Geocoder } = await loadGoogleMaps();
  const geocoder = new Geocoder();
  const response = await geocoder.geocode({ address: normalizedQuery });
  const firstResult = response?.results?.[0];

  if (!firstResult) {
    throw new Error("No results found for that location or ZIP code.");
  }

  const location = firstResult.geometry.location;
  const center = { lat: location.lat(), lng: location.lng() };
  resolvedCenterCache.set(normalizedQuery, center);

  return { center, normalizedQuery, fromCache: false };
}
