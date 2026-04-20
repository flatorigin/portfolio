// ============================================================================
// file: frontend/src/components/ServiceAreaMap.jsx
// Google Maps (js-api-loader v2) + geocoding (ZIP or City, ST) + radius circle
// Safe loader init, clearer error states, no fake-key fallback
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_CENTER,
  geocodeLocationQuery,
  getGoogleMapsApiKey,
  isPlaceholderGoogleMapsKey,
  loadGoogleMaps,
  milesToMeters,
  normalizeLocationQuery,
} from "../lib/googleMaps";

export default function ServiceAreaMap({
  locationQuery,
  radiusMiles,
  heightClassName = "h-64",
  className = "",
  deferUpdatesUntilSave = false,
  savedLocationQuery,
  savedRadiusMiles,
  resolvedCenter,
}) {
  const apiKey = getGoogleMapsApiKey();

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const isMapReadyRef = useRef(false);
  const lastResolvedCenterRef = useRef(DEFAULT_CENTER);
  const lastResolvedQueryRef = useRef("");
  const geocodeRunRef = useRef(0);

  const [status, setStatus] = useState({ kind: "idle", message: "" });

  const effectiveQuery = deferUpdatesUntilSave
    ? (savedLocationQuery || locationQuery)
    : locationQuery;
  const effectiveRadius = deferUpdatesUntilSave
    ? (savedRadiusMiles || radiusMiles)
    : radiusMiles;

  const normalizedQuery = useMemo(
    () => normalizeLocationQuery(effectiveQuery),
    [effectiveQuery]
  );
  const radiusMeters = useMemo(
    () => milesToMeters(effectiveRadius),
    [effectiveRadius]
  );
  const hasResolvedCenter =
    Number.isFinite(resolvedCenter?.lat) && Number.isFinite(resolvedCenter?.lng);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (typeof window === "undefined") return;

      if (isPlaceholderGoogleMapsKey(apiKey)) {
        setStatus({
          kind: "error",
          message:
            "Invalid or missing Google Maps API key. Set VITE_GOOGLE_MAPS_API_KEY to a real key and restart the frontend.",
        });
        return;
      }

      try {
        setStatus({ kind: "loading", message: "Loading Google Maps…" });
        const { Map } = await loadGoogleMaps();

        if (cancelled) return;
        if (!containerRef.current) return;

        if (!mapRef.current) {
          const initialCenter = hasResolvedCenter ? resolvedCenter : DEFAULT_CENTER;
          const map = new Map(containerRef.current, {
            center: initialCenter,
            zoom: 10,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });

          mapRef.current = map;

          markerRef.current = new window.google.maps.Marker({
            map,
            position: initialCenter,
          });

          circleRef.current = new window.google.maps.Circle({
            map,
            center: initialCenter,
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
    if (!isMapReadyRef.current) return;
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;

    circleRef.current.setRadius(radiusMeters || 0);

    if (!hasResolvedCenter) return;

    lastResolvedCenterRef.current = resolvedCenter;
    lastResolvedQueryRef.current = normalizedQuery || "__resolved_center__";
    markerRef.current.setPosition(resolvedCenter);
    circleRef.current.setCenter(resolvedCenter);

    if (radiusMeters > 0) {
      const bounds = circleRef.current.getBounds();
      if (bounds) {
        mapRef.current.fitBounds(bounds);
      } else {
        mapRef.current.setCenter(resolvedCenter);
        mapRef.current.setZoom(12);
      }
    } else {
      mapRef.current.setCenter(resolvedCenter);
      mapRef.current.setZoom(12);
    }

    setStatus((current) =>
      current.kind === "error" ? current : { kind: "ready", message: "" }
    );
  }, [hasResolvedCenter, normalizedQuery, radiusMeters, resolvedCenter]);

  useEffect(() => {
    let cancelled = false;
    const runId = ++geocodeRunRef.current;

    async function geocodeAndUpdate() {
      if (!isMapReadyRef.current) return;
      if (!mapRef.current || !markerRef.current || !circleRef.current) {
        return;
      }

      const isStale = () => cancelled || geocodeRunRef.current !== runId;

      circleRef.current.setRadius(radiusMeters || 0);

      if (hasResolvedCenter) {
        if (!cancelled) {
          setStatus((current) =>
            current.kind === "error" ? current : { kind: "ready", message: "" }
          );
        }
        return;
      }

      if (!normalizedQuery) {
        if (isStale()) return;
        const hasResolvedLocation = Boolean(lastResolvedQueryRef.current);
        if (!hasResolvedLocation) {
          markerRef.current.setPosition(DEFAULT_CENTER);
          circleRef.current.setCenter(DEFAULT_CENTER);
          mapRef.current.setCenter(DEFAULT_CENTER);
          mapRef.current.setZoom(10);
        }

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

        const result = await geocodeLocationQuery(normalizedQuery);
        if (isStale()) return;
        const center = result?.center;
        if (!center) return;
        if (isStale()) return;
        lastResolvedCenterRef.current = center;
        lastResolvedQueryRef.current = normalizedQuery;

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
  }, [hasResolvedCenter, normalizedQuery, radiusMeters]);

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
