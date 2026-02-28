// =======================================
// file: frontend/src/pages/EditProfile.jsx
// Loads / updates /api/users/me/
// Shows contact info + service-area Google Map with radius circle
// Map updates ONLY after successful Save (not while typing)
// =======================================
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { SectionTitle, Card, Input, Textarea, Button } from "../ui";

// single source of truth for url normalization (supports blob/data previews)
function toUrl(raw) {
  if (!raw) return "";
  if (/^(data:|blob:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

function isUsZip(raw) {
  return /^\s*\d{5}(-\d{4})?\s*$/.test(raw || "");
}

function normalizeLocationForGeocode(raw) {
  const s = (raw || "").trim();
  if (!s) return "";
  if (isUsZip(s)) {
    // ZIP hint makes results consistent
    return `${s.replace(/\s+/g, "")}, USA`;
  }
  return s;
}

function milesToMeters(miles) {
  const n = Number(miles);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n * 1609.344;
}

function loadGoogleMaps(apiKey) {
  if (!apiKey) return Promise.reject(new Error("Missing VITE_GOOGLE_MAPS_API_KEY"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);

  const existing = document.querySelector('script[data-cc="google-maps-js"]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(window.google.maps));
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps script")));
    });
  }

  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.dataset.cc = "google-maps-js";
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    s.onload = () => resolve(window.google.maps);
    s.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(s);
  });
}

export default function EditProfile() {
  const [form, setForm] = useState({
    display_name: "",
    service_location: "",
    coverage_radius_miles: "",
    contact_email: "",
    contact_phone: "",
    bio: "",
  });

  const [avatarPreview, setAvatarPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);

  // Hero/banner state
  const [bannerPreview, setBannerPreview] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ✅ Map model updates only after load/save
  const [mapModel, setMapModel] = useState({
    service_location: "",
    coverage_radius_miles: "",
  });

  // --- Map refs/state ---
  const mapDivRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapErr, setMapErr] = useState("");

  // ✅ Debug info so ZIP issues aren’t silent
  const [geoDebug, setGeoDebug] = useState({
    status: "",
    formattedAddress: "",
    query: "",
  });

  const MIN_ZOOM = 8;
  const MAX_ZOOM = 14;

  // ----------------------------
  // Load current profile: /api/users/me/
  // ----------------------------
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    setMessage("");

    api
      .get("/users/me/")
      .then(({ data }) => {
        if (!alive) return;

        const nextForm = {
          display_name: data.display_name || "",
          service_location: data.service_location || "",
          coverage_radius_miles:
            data.coverage_radius_miles !== null &&
            data.coverage_radius_miles !== undefined
              ? String(data.coverage_radius_miles)
              : "",
          contact_email: data.contact_email || "",
          contact_phone: data.contact_phone || "",
          bio: data.bio || "",
        };

        setForm(nextForm);

        // ✅ map updates from loaded values (not from typing)
        setMapModel({
          service_location: nextForm.service_location,
          coverage_radius_miles: nextForm.coverage_radius_miles,
        });

        setAvatarPreview(
          toUrl(data.logo || data.logo_url || data.avatar_url || "") || null
        );

        setBannerPreview(toUrl(data.banner_url || data.banner || "") || null);
      })
      .catch((err) => {
        console.error("[EditProfile] load error", err?.response || err);
        setError("Could not load your profile.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  // ----------------------------
  // Init Google Maps once
  // ----------------------------
  useEffect(() => {
    let alive = true;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (!alive) return;
        if (!mapDivRef.current) return;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapDivRef.current, {
            center: { lat: 39.9526, lng: -75.1652 },
            zoom: 10,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });

          markerRef.current = new maps.Marker({ map: mapRef.current });
        }

        setMapReady(true);
        setMapErr("");
      })
      .catch((e) => {
        console.error("[EditProfile] Maps load failed:", e);
        if (!alive) return;
        setMapErr(
          e?.message ||
            "Could not load Google Maps. Check VITE_GOOGLE_MAPS_API_KEY and domain restrictions."
        );
      });

    return () => {
      alive = false;
    };
  }, []);

  // ----------------------------
  // Draw/refresh map from mapModel ONLY (after load/save)
  // ----------------------------
  useEffect(() => {
    if (!mapReady) return;

    const maps = window.google?.maps;
    const map = mapRef.current;
    if (!maps || !map) return;

    const raw = mapModel.service_location || "";
    const query = normalizeLocationForGeocode(raw);

    if (!query) {
      setGeoDebug({ status: "", formattedAddress: "", query: "" });
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      return;
    }

    const radiusMeters = milesToMeters(mapModel.coverage_radius_miles);
    const geocoder = new maps.Geocoder();

    setGeoDebug((prev) => ({ ...prev, query }));

    geocoder.geocode({ address: query, region: "us" }, (results, status) => {
      setGeoDebug({
        status: String(status || ""),
        formattedAddress: results?.[0]?.formatted_address || "",
        query,
      });

      if (status !== "OK" || !results?.length) {
        // ✅ This is where ZIP failures usually show: REQUEST_DENIED / ZERO_RESULTS / INVALID_REQUEST
        console.warn("[EditProfile] geocode failed:", status, query);
        return;
      }

      const loc = results[0].geometry.location;
      const center = { lat: loc.lat(), lng: loc.lng() };

      map.setCenter(center);
      map.setZoom(isUsZip(raw) ? 12 : 11);

      markerRef.current?.setPosition(center);

      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }

      if (radiusMeters > 0) {
        circleRef.current = new maps.Circle({
          map,
          center,
          radius: radiusMeters,
          strokeOpacity: 0.7,
          strokeWeight: 2,
          fillOpacity: 0.12,
        });

        const bounds = circleRef.current.getBounds?.();
        if (bounds) map.fitBounds(bounds);
      }

      // ✅ Clamp zoom (after fitBounds changes it)
      window.setTimeout(() => {
        const z = map.getZoom?.();
        if (typeof z !== "number") return;
        if (z < MIN_ZOOM) map.setZoom(MIN_ZOOM);
        if (z > MAX_ZOOM) map.setZoom(MAX_ZOOM);
      }, 0);
    });
  }, [mapReady, mapModel.service_location, mapModel.coverage_radius_miles]);

  // ----------------------------
  // Form helpers
  // ----------------------------
  const updateField = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setLogoFile(file);

    if (file) {
      const reader = new FileReader();
      reader.onload = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(file);
    }

    e.target.value = "";
  };

  const handleBannerChange = (e) => {
    const file = e.target.files?.[0] || null;
    setBannerFile(file);

    if (!file) {
      e.target.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (jpg/png/webp) for the hero banner.");
      setBannerFile(null);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setBannerPreview(reader.result);
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const clearBanner = () => {
    setBannerFile(null);
    setBannerPreview(null);
  };

  // ----------------------------
  // Save profile (PATCH /api/users/me/)
  // ✅ after successful save -> update mapModel so map moves
  // ----------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = new FormData();
      data.append("display_name", form.display_name || "");
      data.append("service_location", form.service_location || "");
      if (form.coverage_radius_miles !== "") {
        data.append("coverage_radius_miles", form.coverage_radius_miles);
      }
      data.append("contact_email", form.contact_email || "");
      data.append("contact_phone", form.contact_phone || "");
      data.append("bio", form.bio || "");

      if (logoFile) data.append("logo", logoFile);
      if (bannerFile) data.append("banner", bannerFile);

      if (!bannerFile && !bannerPreview) {
        data.append("banner_url", "");
        data.append("banner", "");
      }

      const resp = await api.patch("/users/me/", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const updated = resp.data || {};
      setMessage("Profile updated.");

      const next = {
        display_name: updated.display_name ?? form.display_name,
        service_location: updated.service_location ?? form.service_location,
        coverage_radius_miles:
          updated.coverage_radius_miles !== null &&
          updated.coverage_radius_miles !== undefined
            ? String(updated.coverage_radius_miles)
            : form.coverage_radius_miles,
        contact_email: updated.contact_email ?? form.contact_email,
        contact_phone: updated.contact_phone ?? form.contact_phone,
        bio: updated.bio ?? form.bio,
      };

      setForm(next);

      // ✅ critical: map updates only after save
      setMapModel({
        service_location: next.service_location,
        coverage_radius_miles: next.coverage_radius_miles,
      });

      if (updated.logo || updated.logo_url || updated.avatar_url) {
        setAvatarPreview(
          toUrl(updated.logo || updated.logo_url || updated.avatar_url) || null
        );
      }
      if (updated.banner_url || updated.banner) {
        setBannerPreview(toUrl(updated.banner_url || updated.banner) || null);
      }

      setLogoFile(null);
      setBannerFile(null);
    } catch (err) {
      console.error("[EditProfile] save error", err?.response || err);
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors ||
        err?.response?.data ||
        "Could not save your profile.";
      setError(typeof detail === "string" ? detail : JSON.stringify(detail, null, 2));
    } finally {
      setSaving(false);
    }
  };

  const bannerPreviewSafe = useMemo(() => toUrl(bannerPreview), [bannerPreview]);
  const radiusLabel =
    mapModel.coverage_radius_miles && Number(mapModel.coverage_radius_miles) > 0
      ? `${mapModel.coverage_radius_miles} mi radius`
      : "No radius set";

  return (
    <div>
      <SectionTitle>Edit profile</SectionTitle>

      {loading ? (
        <p className="text-sm text-slate-600">Loading your profile…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
          {/* LEFT: form */}
          <Card className="space-y-4 p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Hero / banner uploader */}
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      Hero banner (public profile header)
                    </p>
                    <p className="text-xs text-slate-500">
                      This image will show at the top of your public profile page.
                      Recommended: wide image (e.g. 1600×600).
                    </p>
                  </div>

                  <label className="inline-flex w-fit cursor-pointer items-center whitespace-nowrap rounded-lg border border-slate-300 px-4 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleBannerChange}
                    />
                    Choose hero image…
                  </label>
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                  <div
                    className="h-[180px] w-full bg-slate-900"
                    style={
                      bannerPreviewSafe
                        ? {
                            backgroundImage: `url(${bannerPreviewSafe})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : {}
                    }
                  />
                  {!bannerPreviewSafe && (
                    <div className="px-3 py-2 text-xs text-slate-600">
                      No hero banner set yet.
                    </div>
                  )}
                </div>

                {bannerPreviewSafe ? (
                  <button
                    type="button"
                    onClick={clearBanner}
                    className="mt-2 text-xs font-medium text-slate-600 hover:underline"
                  >
                    Remove hero banner
                  </button>
                ) : null}
              </div>

              {/* Logo */}
              <div className="flex items-center gap-3">
                {avatarPreview ? (
                  <img
                    src={toUrl(avatarPreview)}
                    alt="Current logo"
                    className="h-16 w-16 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-slate-300 text-xs text-slate-400">
                    No logo
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Logo / profile image
                  </p>
                  <p className="text-xs text-slate-500">
                    This will be shown on your public profile and projects.
                  </p>
                  <label className="mt-2 inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                    Choose image…
                  </label>
                </div>
              </div>

              {/* Identity */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Display name
                </label>
                <Input
                  value={form.display_name}
                  onChange={updateField("display_name")}
                  placeholder="Business / owner name"
                />
              </div>

              {/* Service area */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Location(city, state) or ZIP code
                  </label>
                  <Input
                    value={form.service_location}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        service_location: e.target.value,
                      }))
                    }
                    placeholder="City, ST (e.g. Media, PA) or ZIP (e.g. 19063)"
                    pattern="^\s*(\d{5}(-\d{4})?|[A-Za-z][A-Za-z .'-]*,\s*[A-Za-z]{2})\s*$"
                    title="Enter City, ST (e.g. Media, PA) or ZIP (e.g. 19063)"
                    required
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Map updates after Save. ZIP codes geocode as “ZIP, USA”.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Coverage radius (miles)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.coverage_radius_miles}
                    onChange={updateField("coverage_radius_miles")}
                    placeholder="e.g. 10"
                  />
                </div>
              </div>

              {/* Contact info */}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Public contact email
                  </label>
                  <Input
                    type="email"
                    value={form.contact_email}
                    onChange={updateField("contact_email")}
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Public phone
                  </label>
                  <Input
                    value={form.contact_phone}
                    onChange={updateField("contact_phone")}
                    placeholder="e.g. 215-555-1234"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Bio / about
                </label>
                <Textarea
                  rows={5}
                  value={form.bio}
                  onChange={updateField("bio")}
                  placeholder="Tell homeowners what you do and how you work…"
                  className="min-h-[140px]"
                />
              </div>

              {error && (
                <p className="whitespace-pre-wrap text-xs text-red-600">{error}</p>
              )}
              {message && <p className="text-xs text-emerald-600">{message}</p>}

              <Button type="submit" disabled={saving} className="mt-2">
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </Card>

          {/* RIGHT: map preview */}
          <Card className="space-y-3 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Service area preview
            </div>

            {mapErr ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {mapErr}
              </div>
            ) : null}

            {/* ✅ Debug block to catch ZIP geocode failures */}
            {geoDebug.query ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-700">
                <div className="font-semibold text-slate-800">Map debug</div>
                <div className="mt-1">
                  <span className="opacity-70">Geocode query:</span>{" "}
                  <span className="font-mono">{geoDebug.query}</span>
                </div>
                <div>
                  <span className="opacity-70">Status:</span>{" "}
                  <span className="font-mono">{geoDebug.status || "-"}</span>
                </div>
                <div>
                  <span className="opacity-70">Result:</span>{" "}
                  <span className="font-mono">{geoDebug.formattedAddress || "-"}</span>
                </div>
              </div>
            ) : null}

            <div className="relative mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {/* Tooltip */}
              <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-800 shadow-sm">
                {radiusLabel}
              </div>

              <div ref={mapDivRef} className="h-64 w-full" />
            </div>

            {!import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? (
              <p className="text-[11px] text-slate-500">
                Missing <span className="font-mono">VITE_GOOGLE_MAPS_API_KEY</span>.
                Add it to Railway Variables and redeploy.
              </p>
            ) : null}

            <p className="text-[11px] text-slate-500">
              Map updates only after Save. (This prevents jumping while typing.)
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}