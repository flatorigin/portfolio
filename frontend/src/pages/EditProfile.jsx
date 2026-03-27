// =======================================
// file: frontend/src/pages/EditProfile.jsx
// Loads / updates /api/users/me/
// Shows contact info + service-area Google Map with radius circle
// Map updates ONLY after successful Save (not while typing)
// =======================================
import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { SectionTitle, Card, Input, Textarea, Button } from "../ui";
import ServiceAreaMap from "../components/ServiceAreaMap";
import LanguageMultiSelect from "../components/LanguageMultiSelect";

function getProfileComplete(form) {
  return Boolean(
    form.service_location?.trim() &&
      form.contact_email?.trim() &&
      form.contact_phone?.trim()
  );
}

function ProfileStatusBadge({ complete }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
        complete
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
          : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
      ].join(" ")}
    >
      {complete ? "Profile Complete" : "Incomplete Profile"}
    </span>
  );
}

// single source of truth for url normalization (supports blob/data previews)
function toUrl(raw) {
  if (!raw) return "";
  if (/^(data:|blob:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

export default function EditProfile() {
  const [form, setForm] = useState({
    display_name: "",
    hero_headline: "",
    hero_blurb: "",
    service_location: "",
    coverage_radius_miles: "",
    contact_email: "",
    contact_phone: "",
    bio: "",
    show_contact_email: false,
    show_contact_phone: false,
    languages: [],
  });

  const complete = getProfileComplete(form);

  const [avatarPreview, setAvatarPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);

  const [bannerPreview, setBannerPreview] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [savedMapModel, setSavedMapModel] = useState({
    service_location: "",
    coverage_radius_miles: "",
  });

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
          hero_headline: data.hero_headline || "",
          hero_blurb: data.hero_blurb || "",
          service_location: data.service_location || "",
          coverage_radius_miles:
            data.coverage_radius_miles !== null &&
            data.coverage_radius_miles !== undefined
              ? String(data.coverage_radius_miles)
              : "",
          contact_email: data.contact_email || "",
          contact_phone: data.contact_phone || "",
          bio: data.bio || "",
          show_contact_email: !!data.show_contact_email,
          show_contact_phone: !!data.show_contact_phone,
          languages: Array.isArray(data.languages) ? data.languages : [],
        };

        setForm(nextForm);

        setSavedMapModel({
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

  const updateField = (key) => (e) => {
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateToggle = (key) => (e) => {
    const checked = e.target.checked;
    setForm((prev) => ({ ...prev, [key]: checked }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const data = new FormData();

      data.append("display_name", form.display_name || "");
      data.append("hero_headline", form.hero_headline || "");
      data.append("hero_blurb", form.hero_blurb || "");
      data.append("service_location", form.service_location || "");

      if (form.coverage_radius_miles !== "") {
        data.append("coverage_radius_miles", form.coverage_radius_miles);
      }

      data.append("contact_email", form.contact_email || "");
      data.append("contact_phone", form.contact_phone || "");
      data.append("bio", form.bio || "");
      data.append("show_contact_email", String(!!form.show_contact_email));
      data.append("show_contact_phone", String(!!form.show_contact_phone));
      data.append("languages", JSON.stringify(form.languages || []));

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
        hero_headline: updated.hero_headline ?? form.hero_headline,
        hero_blurb: updated.hero_blurb ?? form.hero_blurb,
        service_location: updated.service_location ?? form.service_location,
        coverage_radius_miles:
          updated.coverage_radius_miles !== null &&
          updated.coverage_radius_miles !== undefined
            ? String(updated.coverage_radius_miles)
            : form.coverage_radius_miles,
        contact_email: updated.contact_email ?? form.contact_email,
        contact_phone: updated.contact_phone ?? form.contact_phone,
        bio: updated.bio ?? form.bio,
        show_contact_email:
          updated.show_contact_email ?? form.show_contact_email,
        show_contact_phone:
          updated.show_contact_phone ?? form.show_contact_phone,
        languages: Array.isArray(updated.languages)
          ? updated.languages
          : form.languages,
      };

      setForm(next);

      setSavedMapModel({
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

  return (
    <div>
      <SectionTitle>Edit profile</SectionTitle>

      {loading ? (
        <p className="text-sm text-slate-600">Loading your profile…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)]">
          <Card className="space-y-4 p-4">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Profile status
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Complete profiles appear more credible to visitors.
                    </p>
                  </div>
                  <ProfileStatusBadge complete={complete} />
                </div>
              </div>

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

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Hero headline
                  </label>
                  <Input
                    value={form.hero_headline}
                    onChange={updateField("hero_headline")}
                    placeholder="We’re changing the way contractors connect"
                    maxLength={120}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Short, bold line shown on your public profile hero.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Hero blurb
                  </label>
                  <Textarea
                    rows={4}
                    value={form.hero_blurb}
                    onChange={updateField("hero_blurb")}
                    placeholder="Connect directly with local pros who let their craftsmanship do the talking…"
                    className="min-h-[110px]"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Required account info
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Service area is always public. Email and phone are required for
                    your account, but you control whether they appear on your public profile.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Location (city, state) or ZIP code
                    </label>
                    <Input
                      value={form.service_location}
                      onChange={updateField("service_location")}
                      placeholder="City, ST (e.g. Media, PA) or ZIP (e.g. 19063)"
                      pattern="^\\s*(\\d{5}(-\\d{4})?|[A-Za-z][A-Za-z .'-]*,\\s*[A-Za-z]{2})\\s*$"
                      title="Enter City, ST (e.g. Media, PA) or ZIP (e.g. 19063)"
                      required
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Map updates only after Save. ZIP codes geocode as “ZIP, USA”.
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

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Contact email
                    </label>
                    <Input
                      type="email"
                      value={form.contact_email}
                      onChange={updateField("contact_email")}
                      placeholder="you@example.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Contact phone
                    </label>
                    <Input
                      value={form.contact_phone}
                      onChange={updateField("contact_phone")}
                      placeholder="e.g. 215-555-1234"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Public contact visibility
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Visitors can always contact you through platform messaging. Choose
                    whether your email or phone should also appear publicly.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        Show email publicly
                      </div>
                      <div className="text-xs text-slate-500">
                        Display an email action on your public profile.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!form.show_contact_email}
                      onChange={updateToggle("show_contact_email")}
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        Show phone publicly
                      </div>
                      <div className="text-xs text-slate-500">
                        Display a call action on your public profile.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!form.show_contact_phone}
                      onChange={updateToggle("show_contact_phone")}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Languages spoken
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Select all languages you speak. These can appear on your public profile.
                  </p>
                </div>

                <LanguageMultiSelect
                  value={form.languages}
                  onChange={(next) =>
                    setForm((prev) => ({ ...prev, languages: next }))
                  }
                />
              </div>

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

          <Card className="space-y-3 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Service area preview
            </div>
            <p className="text-xs text-slate-600">
              Map updates only after Save (prevents jumping while typing).
            </p>

            <ServiceAreaMap
              deferUpdatesUntilSave={true}
              locationQuery={form.service_location}
              radiusMiles={form.coverage_radius_miles}
              savedLocationQuery={savedMapModel.service_location}
              savedRadiusMiles={savedMapModel.coverage_radius_miles}
              heightClassName="h-64"
            />
          </Card>
        </div>
      )}
    </div>
  );
}