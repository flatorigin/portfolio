// ============================================================================
// file: frontend/src/components/ServiceAreaMap.jsx
// Google Maps (js-api-loader v2) + geocoding (ZIP or City, ST) + radius circle
// Safe loader init, clearer error states, no fake-key fallback
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

const DEFAULT_CENTER = { lat: 39.9526, lng: -75.1652 }; // Philadelphia fallback
const MILES_TO_METERS = 1609.344;

let loaderConfigured = false;
let configuredKey = "";

function normalizeQuery(raw) {
  const v = (raw || "").trim();
  if (!v) return "";

  const usZip = /^\d{5}(-\d{4})?$/.test(v);
  if (usZip) return `${v}, USA`;

  const canadianPostal = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(v);
  if (canadianPostal) return `${v}, Canada`;

  return v;
}

function milesToMeters(miles) {
  const n = Number(miles);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n * MILES_TO_METERS;
}

function getApiKey() {
  const runtimeKey =
    typeof window !== "undefined" ? window.__ENV__?.GOOGLE_MAPS_API_KEY : "";
  const viteKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  return String(runtimeKey || viteKey || "").trim();
}

function isPlaceholderKey(key) {
  if (!key) return true;
  const v = key.trim().toLowerCase();
  return (
    v === "your_key_if_needed" ||
    v === "your_google_maps_api_key" ||
    v === "your_api_key" ||
    v.includes("replace_me")
  );
}

export default function ServiceAreaMap({
  locationQuery,
  radiusMiles,
  heightClassName = "h-64",
  className = "",
  deferUpdatesUntilSave = false,
  savedLocationQuery,
  savedRadiusMiles,
}) {
  const apiKey = getApiKey();

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const geocoderRef = useRef(null);
  const isMapReadyRef = useRef(false);
  const lastResolvedCenterRef = useRef(DEFAULT_CENTER);

  const [status, setStatus] = useState({ kind: "idle", message: "" });

  const effectiveQuery = deferUpdatesUntilSave ? savedLocationQuery : locationQuery;
  const effectiveRadius = deferUpdatesUntilSave ? savedRadiusMiles : radiusMiles;

  const normalizedQuery = useMemo(
    () => normalizeQuery(effectiveQuery),
    [effectiveQuery]
  );
  const radiusMeters = useMemo(
    () => milesToMeters(effectiveRadius),
    [effectiveRadius]
  );

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (typeof window === "undefined") return;

      if (isPlaceholderKey(apiKey)) {
        setStatus({
          kind: "error",
          message:
            "Invalid or missing Google Maps API key. Set VITE_GOOGLE_MAPS_API_KEY to a real key and restart the frontend.",
        });
        return;
      }

      try {
        setStatus({ kind: "loading", message: "Loading Google Maps…" });

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
            "[ServiceAreaMap] Google Maps loader already initialized with a different key. Reusing the first configured key."
          );
        }

        const { Map } = await importLibrary("maps");
        const { Geocoder } = await importLibrary("geocoding");
        await importLibrary("marker");

        if (cancelled) return;
        if (!containerRef.current) return;

        if (!mapRef.current) {
          const map = new Map(containerRef.current, {
            center: DEFAULT_CENTER,
            zoom: 10,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });

          mapRef.current = map;
          geocoderRef.current = new Geocoder();

          markerRef.current = new window.google.maps.Marker({
            map,
            position: DEFAULT_CENTER,
          });

          circleRef.current = new window.google.maps.Circle({
            map,
            center: DEFAULT_CENTER,
            radius: radiusMeters || 0,
            strokeOpacity: 0.4,
            strokeWeight: 1,
            fillColor: "#93C5FD",
            fillOpacity: 0.12,
            clickable: false,
          });
        }

        isMapReadyRef.current = true;
        setStatus({ kind: "ready", message: "" });
      } catch (err) {
        console.error("[ServiceAreaMap] init failed", err);

        const message =
          err?.message?.includes("InvalidKey") ||
          err?.message?.includes("ApiNotActivated") ||
          err?.message?.includes("BillingNotEnabled")
            ? err.message
            : "Maps failed to load. Check the API key, billing, referrer restrictions, Maps JavaScript API, and Geocoding API.";

        setStatus({
          kind: "error",
          message,
        });
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  useEffect(() => {
    let cancelled = false;

    async function geocodeAndUpdate() {
      if (!isMapReadyRef.current) return;
      if (!mapRef.current || !markerRef.current || !circleRef.current || !geocoderRef.current) {
        return;
      }

      circleRef.current.setRadius(radiusMeters || 0);

      if (!normalizedQuery) {
        const fallbackCenter = lastResolvedCenterRef.current || DEFAULT_CENTER;
        markerRef.current.setPosition(fallbackCenter);
        circleRef.current.setCenter(fallbackCenter);
        mapRef.current.setCenter(fallbackCenter);
        mapRef.current.setZoom(10);

        if (!cancelled) {
          setStatus((s) =>
            s.kind === "error" ? s : { kind: "ready", message: "" }
          );
        }
        return;
      }

      try {
        if (!cancelled) {
          setStatus({ kind: "geocoding", message: "Finding location…" });
        }

        const resp = await geocoderRef.current.geocode({
          address: normalizedQuery,
        });

        const first = resp?.results?.[0];

        if (!first) {
          if (!cancelled) {
            setStatus({
              kind: "error",
              message: "No results found for that location or ZIP code.",
            });
          }
          return;
        }

        const loc = first.geometry.location;
        const center = { lat: loc.lat(), lng: loc.lng() };
        lastResolvedCenterRef.current = center;

        markerRef.current.setPosition(center);
        circleRef.current.setCenter(center);

        if (radiusMeters > 0) {
          const bounds = circleRef.current.getBounds();
          if (bounds) {
            mapRef.current.fitBounds(bounds);
          } else {
            mapRef.current.setCenter(center);
            mapRef.current.setZoom(12);
          }

          const z = mapRef.current.getZoom?.();
          if (typeof z === "number" && z > 15) {
            mapRef.current.setZoom(15);
          }
        } else {
          mapRef.current.setCenter(center);
          mapRef.current.setZoom(12);
        }

        if (!cancelled) {
          setStatus({ kind: "ready", message: "" });
        }
      } catch (err) {
        console.error("[ServiceAreaMap] geocode failed", err);

        if (!cancelled) {
          setStatus({
            kind: "error",
            message:
              err?.message ||
              "Geocoding failed. Make sure Geocoding API is enabled and billing is active.",
          });
        }
      }
    }

    geocodeAndUpdate();

    return () => {
      cancelled = true;
    };
  }, [normalizedQuery, radiusMeters]);

  const banner =
    status.kind === "error" ? (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {status.message}
      </div>
    ) : status.kind === "loading" || status.kind === "geocoding" ? (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        {status.message}
      </div>
    ) : null;

  return (
    <div className={className}>
      {banner}
      <div
        className={`mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${heightClassName}`}
      >
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <div className="mt-2 text-[11px] text-slate-500">
        Geocoding requires{" "}
        <span className="font-medium">Geocoding API</span>, billing, and correct
        HTTP referrer restrictions.
      </div>
    </div>
  );
}
