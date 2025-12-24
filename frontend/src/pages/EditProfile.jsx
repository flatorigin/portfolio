// =======================================
// EditProfile.jsx
// Loads / updates /api/users/me/
// Shows contact info + simple service-area map
// =======================================
import { useEffect, useState } from "react";
import api from "../api";
import { SectionTitle, Card, Input, Textarea, Button } from "../ui";

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
  const [heroPreview, setHeroPreview] = useState(null);
  const [heroFile, setHeroFile] = useState(null);
  const [heroWarning, setHeroWarning] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

        setAvatarPreview(data.avatar_url || data.logo || null);
        setHeroPreview(data.hero_image_url || data.hero_image || null);
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
  };

  const handleHeroChange = (e) => {
    const file = e.target.files?.[0] || null;
    setHeroFile(file);
    setHeroWarning("");
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setHeroPreview(result);
        const img = new Image();
        img.onload = () => {
          if (img.width < 1200 || img.height < 400) {
            setHeroWarning(
              `Image is ${img.width}×${img.height}. For best results, use at least 1200×400.`
            );
          }
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
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
      if (heroFile) {
        data.append("hero_image", heroFile);
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
        setAvatarPreview(updated.avatar_url || updated.logo);
      }
      if (updated.hero_image_url || updated.hero_image) {
        setHeroPreview(updated.hero_image_url || updated.hero_image);
      }
    } catch (err) {
      console.error("[EditProfile] save error", err?.response || err);
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.non_field_errors ||
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

              {/* 🔹 Hero / cover image */}
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-medium text-slate-800">
                  Profile hero image
                </p>
                <p className="text-xs text-slate-500">
                  Recommended: wide images (min 1200×400). Shows at the top of
                  your public profile.
                </p>
                <div className="mt-3">
                  {heroPreview ? (
                    <img
                      src={heroPreview}
                      alt="Current hero"
                      className="h-32 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
                      No hero image
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleHeroChange}
                    />
                    Choose hero image…
                  </label>
                  {heroWarning && (
                    <p className="text-xs text-amber-600">{heroWarning}</p>
                  )}
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
