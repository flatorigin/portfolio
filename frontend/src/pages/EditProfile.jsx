// =======================================
// EditProfile.jsx
// Loads / updates /api/users/me/
// Shows contact info + simple service-area map
// + Banner/Hero upload (for PublicProfile hero)
// =======================================
import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { SectionTitle, Card, Input, Textarea, Button } from "../ui";

function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
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

  // NEW: hero/banner state
  const [bannerPreview, setBannerPreview] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function toUrl(raw) {
    if (!raw) return "";
    // ✅ allow preview URLs
    if (/^(data:|blob:)/i.test(raw)) return raw;

    if (/^https?:\/\//i.test(raw)) return raw;
    const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
    const origin = base.replace(/\/api\/?$/, "");
    return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
  }


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

        setForm({
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
        });

        // existing logo/avatar preview
        setAvatarPreview(toUrl(data.avatar_url || data.logo || null));

        // NEW: banner preview (what PublicProfile uses)
        setBannerPreview((data.banner_url || data.banner || null));
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

  // NEW: banner uploader
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

    // Preview immediately
    const reader = new FileReader();
    reader.onload = () => setBannerPreview(reader.result);
    reader.readAsDataURL(file);

    e.target.value = "";
  };

  const clearBanner = () => {
    setBannerFile(null);
    setBannerPreview(null);
    // also clear on server by sending empty string
    // (handled in submit: we send banner_clear when preview is null & no file)
  };

  // ----------------------------
  // Save profile (PATCH /api/users/me/)
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

      if (logoFile) {
        data.append("logo", logoFile);
      }

      // NEW: include banner file if selected
      // IMPORTANT: field name must match your backend model/serializer.
      // Try "banner" first (most common). If your backend expects "banner_image" or "banner_file", rename here.
      if (bannerFile) {
        data.append("banner", bannerFile);
      }

      // If user removed banner (no file + no preview), send empty banner_url/banner to clear.
      // This works only if your backend allows blank string. If not, remove these two lines.
      if (!bannerFile && !bannerPreview) {
        data.append("banner_url", "");
        data.append("banner", "");
      }

      const resp = await api.patch("/users/me/", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const updated = resp.data || {};
      setMessage("Profile updated.");

      // keep form in sync with backend response
      setForm((prev) => ({
        ...prev,
        display_name: updated.display_name ?? prev.display_name,
        service_location: updated.service_location ?? prev.service_location,
        coverage_radius_miles:
          updated.coverage_radius_miles !== null &&
          updated.coverage_radius_miles !== undefined
            ? String(updated.coverage_radius_miles)
            : prev.coverage_radius_miles,
        contact_email: updated.contact_email ?? prev.contact_email,
        contact_phone: updated.contact_phone ?? prev.contact_phone,
        bio: updated.bio ?? prev.bio,
      }));

      if (updated.avatar_url || updated.logo) {
        setAvatarPreview(toUrl(updated.avatar_url || updated.logo));
      }

      // NEW: update banner preview from response
      if (updated.banner_url || updated.banner) {
        setBannerPreview(toUrl(updated.banner_url || updated.banner));
      }

      // reset files after save
      setLogoFile(null);
      setBannerFile(null);
    } catch (err) {
      console.error("[EditProfile] save error", err?.response || err);
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors ||
        err?.response?.data ||
        "Could not save your profile.";
      setError(
        typeof detail === "string" ? detail : JSON.stringify(detail, null, 2)
      );
    } finally {
      setSaving(false);
    }
  };

  // ----------------------------
  // Simple service-area map
  // ----------------------------
  const mapSrc =
    form.service_location.trim() !== ""
      ? `https://www.google.com/maps?q=${encodeURIComponent(
          form.service_location
        )}&output=embed`
      : null;

  const bannerPreviewSafe = useMemo(() => toUrl(bannerPreview), [bannerPreview]);

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
              {/* NEW: Hero / banner uploader */}
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

                  <label className="inline-flex cursor-pointer items-center w-fit whitespace-nowrap rounded-lg border border-slate-300 px-4 py-1 text-xs font-medium text-slate-700 hover:bg-slate-10">
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

              {/* 🔹 Logo / profile image at the top */}
              <div className="flex items-center gap-3">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
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
                    Service ZIP code
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{5}"
                    value={form.service_location}
                    onChange={updateField("service_location")}
                    placeholder="e.g. 19063"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Enter your primary ZIP code. We’ll use this to show your
                    service area on the map.
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

              {/* Messages */}
              {error && (
                <p className="whitespace-pre-wrap text-xs text-red-600">
                  {error}
                </p>
              )}
              {message && (
                <p className="text-xs text-emerald-600">{message}</p>
              )}

              <Button type="submit" disabled={saving} className="mt-2">
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </Card>

          {/* RIGHT: service-area map preview */}
          <Card className="space-y-3 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Service area preview
            </div>
            <p className="text-xs text-slate-600">
              This is a simple map preview of your{" "}
              <span className="font-medium">
                {form.service_location || "service location"}
              </span>{" "}
              {form.coverage_radius_miles && (
                <>
                  with approximately{" "}
                  <span className="font-medium">
                    {form.coverage_radius_miles}-mile
                  </span>{" "}
                  radius.
                </>
              )}
            </p>

            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              {mapSrc ? (
                <iframe
                  title="Service area map"
                  src={mapSrc}
                  className="h-64 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="flex h-64 items-center justify-center text-xs text-slate-500">
                  Enter a service location to see it on the map.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
