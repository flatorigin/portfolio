// ============================================================================
// file: frontend/src/components/ServiceAreaMap.jsx
// Google Maps (js-api-loader v2) + geocoding (ZIP or City, ST) + radius circle
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

const DEFAULT_CENTER = { lat: 39.9526, lng: -75.1652 }; // Philadelphia fallback
const MILES_TO_METERS = 1609.344;

function normalizeQuery(raw) {
  const v = (raw || "").trim();
  if (!v) return "";

  // If it's ZIP (or ZIP+4), add USA for better geocoding
  const zip = /^\d{5}(-\d{4})?$/.test(v);
  if (zip) return `${v}, USA`;

  // If they typed City, ST keep it; otherwise append USA
  return v.includes(",") ? v : `${v}, USA`;
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
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const containerRef = useRef(null);

  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const geocoderRef = useRef(null);

  const [status, setStatus] = useState({ kind: "idle", message: "" });

  const effectiveQuery = deferUpdatesUntilSave ? savedLocationQuery : locationQuery;
  const effectiveRadius = deferUpdatesUntilSave ? savedRadiusMiles : radiusMiles;

  const normalizedQuery = useMemo(() => normalizeQuery(effectiveQuery), [effectiveQuery]);
  const radiusMeters = useMemo(() => milesToMeters(effectiveRadius), [effectiveRadius]);

  // --- Init map once ---
  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!apiKey) {
        setStatus({
          kind: "error",
          message:
            "Missing VITE_GOOGLE_MAPS_API_KEY. Add it to Railway Variables and redeploy (it must exist at build time for Vite).",
        });
        return;
      }

      try {
        setStatus({ kind: "loading", message: "Loading Google Maps…" });

        // IMPORTANT: v2 loader API
        setOptions({
          key: apiKey,
          v: "weekly",
          libraries: ["places"],
        });

        const { Map } = await importLibrary("maps");
        const { Geocoder } = await importLibrary("geocoding");
        await importLibrary("marker"); // ensures marker classes available consistently

        if (cancelled) return;
        if (!containerRef.current) return;

        const map = new Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 10,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        mapRef.current = map;
        geocoderRef.current = new Geocoder();

        markerRef.current = new google.maps.Marker({
          map,
          position: DEFAULT_CENTER,
        });

        circleRef.current = new google.maps.Circle({
          map,
          center: DEFAULT_CENTER,
          radius: radiusMeters || 0,
          strokeOpacity: 0.4,
          strokeWeight: 2,
          strokeColor: #3977F7,
          fillColor: "#93C5FD",
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
            "Maps failed to load. Check API key restrictions + billing + enabled APIs (Maps JavaScript API + Geocoding API).",
        });
      }
    }

    init();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]); // init once per key

  // --- Geocode & update circle whenever query/radius changes ---
  useEffect(() => {
    let cancelled = false;

    async function geocodeAndUpdate() {
      if (!mapRef.current || !markerRef.current || !circleRef.current || !geocoderRef.current) return;

      // Always update radius
      circleRef.current.setRadius(radiusMeters || 0);

      // If no query, just keep default center
      if (!normalizedQuery) {
        if (!cancelled) setStatus((s) => (s.kind === "error" ? s : { kind: "ready", message: "" }));
        return;
      }

      try {
        if (!cancelled) setStatus({ kind: "geocoding", message: "Finding location…" });

        const resp = await geocoderRef.current.geocode({ address: normalizedQuery });
        const first = resp?.results?.[0];

        if (!first) {
          if (!cancelled) setStatus({ kind: "error", message: "No results for that location/ZIP." });
          return;
        }

        const loc = first.geometry.location;
        const center = { lat: loc.lat(), lng: loc.lng() };

        markerRef.current.setPosition(center);
        circleRef.current.setCenter(center);

        if (radiusMeters && radiusMeters > 0) {
          const bounds = circleRef.current.getBounds();
          if (bounds) mapRef.current.fitBounds(bounds);

          // prevent over-zoom for small radii
          const z = mapRef.current.getZoom?.();
          if (typeof z === "number" && z > 15) mapRef.current.setZoom(15);
        } else {
          mapRef.current.setCenter(center);
          mapRef.current.setZoom(12);
        }

        if (!cancelled) setStatus({ kind: "ready", message: "" });
      } catch (err) {
        console.error("[ServiceAreaMap] geocode failed", err);
        if (!cancelled) {
          setStatus({
            kind: "error",
            message:
              err?.message ||
              "Geocoding failed. Ensure Geocoding API is enabled + billing is on.",
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
      <div className={`mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${heightClassName}`}>
        <div ref={containerRef} className="h-full w-full" />
      </div>
      <div className="mt-2 text-[11px] text-slate-500">
        ZIP geocoding requires <span className="font-medium">Geocoding API</span> + billing + correct HTTP referrer restrictions.
      </div>
    </div>
  );
}