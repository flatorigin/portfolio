// ============================================================================
// file: frontend/src/components/ServiceAreaMap.jsx
// Async Google Maps loader + geocoding (ZIP or City, ST) + radius circle
// Supports Railway runtime env injection via window.__ENV
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";

const DEFAULT_CENTER = { lat: 39.9526, lng: -75.1652 }; // Philadelphia fallback
const MILES_TO_METERS = 1609.344;

function getMapsKey() {
  // ✅ Railway runtime-injected key (from index.html placeholder -> start.sh sed)
  const runtimeKey =
    typeof window !== "undefined" ? window.__ENV?.VITE_GOOGLE_MAPS_API_KEY : "";

  // ✅ Local dev key (Vite build-time)
  const buildKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  return runtimeKey || buildKey || "";
}

function isZip(raw) {
  return /^\d{5}(-\d{4})?$/.test((raw || "").trim());
}

function normalizeQuery(raw) {
  const v = (raw || "").trim();
  if (!v) return "";
  // If it's a ZIP, don't add commas that confuse some geocodes; we’ll restrict country in request
  return v;
}

function milesToMeters(miles) {
  const n = Number(miles);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n * MILES_TO_METERS;
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
  const apiKey = getMapsKey();

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const geocoderRef = useRef(null);

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

  // Init map once
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!apiKey) {
        setStatus({
          kind: "error",
          message:
            "Missing Google Maps key. Set VITE_GOOGLE_MAPS_API_KEY in Railway Variables and redeploy.",
        });
        return;
      }

      try {
        setStatus({ kind: "loading", message: "Loading Google Maps…" });

        const loader = new Loader({
          apiKey,
          version: "weekly",
          // libraries optional; keep empty unless you need Places Autocomplete
          // libraries: ["places"],
        });

        const google = await loader.load();
        if (cancelled) return;
        if (!containerRef.current) return;

        mapRef.current = new google.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        geocoderRef.current = new google.maps.Geocoder();

        markerRef.current = new google.maps.Marker({
          map: mapRef.current,
          position: DEFAULT_CENTER,
        });

        circleRef.current = new google.maps.Circle({
          map: mapRef.current,
          center: DEFAULT_CENTER,
          radius: radiusMeters || 0,
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillOpacity: 0.12,
          clickable: false,
        });

        setStatus({ kind: "ready", message: "" });
      } catch (err) {
        console.error("[ServiceAreaMap] init failed", err);
        setStatus({
          kind: "error",
          message:
            err?.message ||
            "Maps failed to load. Check API key restrictions and billing.",
        });
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [apiKey]); // re-init only if key changes

  // Geocode on query/radius change
  useEffect(() => {
    async function geocodeAndUpdate() {
      if (!mapRef.current || !markerRef.current || !circleRef.current || !geocoderRef.current) {
        return;
      }

      // Always update circle radius even if query empty
      circleRef.current.setRadius(radiusMeters || 0);

      if (!normalizedQuery) {
        setStatus((s) => (s.kind === "error" ? s : { kind: "ready", message: "" }));
        return;
      }

      try {
        setStatus({ kind: "geocoding", message: "Finding location…" });

        const zipMode = isZip(normalizedQuery);

        // ✅ Stronger ZIP behavior: restrict to US
        const request = zipMode
          ? { address: normalizedQuery, componentRestrictions: { country: "us" } }
          : { address: normalizedQuery };

        const { results } = await geocoderRef.current.geocode(request);

        const first = results?.[0];
        if (!first) {
          setStatus({ kind: "error", message: "No results for that location/ZIP." });
          return;
        }

        const loc = first.geometry.location;
        const center = { lat: loc.lat(), lng: loc.lng() };

        markerRef.current.setPosition(center);
        circleRef.current.setCenter(center);

        if (radiusMeters && radiusMeters > 0) {
          const bounds = circleRef.current.getBounds?.();
          if (bounds) mapRef.current.fitBounds(bounds);

          // Prevent over-zoom for small radii
          const z = mapRef.current.getZoom?.();
          if (typeof z === "number" && z > 15) mapRef.current.setZoom(15);
        } else {
          mapRef.current.setCenter(center);
          mapRef.current.setZoom(12);
        }

        setStatus({ kind: "ready", message: "" });
      } catch (err) {
        console.error("[ServiceAreaMap] geocode failed", err);
        setStatus({
          kind: "error",
          message:
            err?.message ||
            "Geocoding failed. Ensure Geocoding API is enabled + billing is on.",
        });
      }
    }

    geocodeAndUpdate();
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
        ZIP support requires <span className="font-medium">Geocoding API</span> enabled + billing + correct HTTP referrer restrictions.
      </div>
    </div>
  );
}