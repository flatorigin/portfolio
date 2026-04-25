// =======================================
// file: frontend/src/pages/EditProfile.jsx
// Loads / updates /api/users/me/
// Shows contact info + service-area Google Map with radius circle
// Map updates ONLY after successful Save (not while typing)
// Adds direct-message opt-out modal with reason capture
// =======================================
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import AiWriteButton from "../components/AiWriteButton";
import { logout } from "../auth";
import { SectionTitle, Card, Input, Textarea, Button, GhostButton } from "../ui";
import LanguageMultiSelect from "../components/LanguageMultiSelect";
import { geocodeLocationQuery, normalizeLocationQuery } from "../lib/googleMaps";

const ServiceAreaMap = lazy(() => import("../components/ServiceAreaMap"));

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

function VerificationStatusBadge({ status, label }) {
  if (!label) return null;

  const tone =
    status === "verified"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
      : status === "pending"
      ? "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
      : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";

  return (
    <span className={["inline-flex items-center rounded-full px-3 py-1 text-sm font-medium", tone].join(" ")}>
      {label}
    </span>
  );
}

function toUrl(raw) {
  if (!raw) return "";
  if (/^(data:|blob:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

export default function EditProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    profile_type: "",
    email: "",
    email_verified: false,
    is_deactivated: false,
    deactivated_at: "",
    display_name: "",
    hero_headline: "",
    hero_blurb: "",
    service_location: "",
    service_lat: null,
    service_lng: null,
    coverage_radius_miles: "",
    contact_email: "",
    contact_phone: "",
    bio: "",
    license_number: "",
    license_state: "",
    insurance_provider: "",
    insurance_policy_number: "",
    insurance_expires_at: "",
    effective_verification_status: "unverified",
    verification_badge_label: "",
    verification_review_due_at: "",
    verification_expires_at: "",
    show_contact_email: false,
    show_contact_phone: false,
    public_profile_enabled: false,
    languages: [],
    allow_direct_messages: true,
    dm_opt_out_reason: "",
    dm_opt_out_until: "",
  });

  const [showDmOptOutModal, setShowDmOptOutModal] = useState(false);
  const [dmReasonDraft, setDmReasonDraft] = useState("");

  const complete = getProfileComplete(form);

  const [avatarPreview, setAvatarPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);

  const [bannerPreview, setBannerPreview] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProfileType, setSavingProfileType] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [securityMessage, setSecurityMessage] = useState("");
  const [securityError, setSecurityError] = useState("");
  const [sendingVerification, setSendingVerification] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deactivationBusy, setDeactivationBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    new_password_confirm: "",
  });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");

  const [savedMapModel, setSavedMapModel] = useState({
    service_location: "",
    service_lat: null,
    service_lng: null,
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
          profile_type: data.profile_type || "",
          email: data.email || "",
          email_verified: !!data.email_verified,
          is_deactivated: !!data.is_deactivated,
          deactivated_at: data.deactivated_at || "",
          display_name: data.display_name || "",
          hero_headline: data.hero_headline || "",
          hero_blurb: data.hero_blurb || "",
          service_location: data.service_location || "",
          service_lat:
            data.service_lat !== null && data.service_lat !== undefined
              ? Number(data.service_lat)
              : null,
          service_lng:
            data.service_lng !== null && data.service_lng !== undefined
              ? Number(data.service_lng)
              : null,
          coverage_radius_miles:
            data.coverage_radius_miles !== null &&
            data.coverage_radius_miles !== undefined
              ? String(data.coverage_radius_miles)
              : "",
          contact_email: data.contact_email || "",
          contact_phone: data.contact_phone || "",
          bio: data.bio || "",
          license_number: data.license_number || "",
          license_state: data.license_state || "",
          insurance_provider: data.insurance_provider || "",
          insurance_policy_number: data.insurance_policy_number || "",
          insurance_expires_at: data.insurance_expires_at || "",
          effective_verification_status: data.effective_verification_status || "unverified",
          verification_badge_label: data.verification_badge_label || "",
          verification_review_due_at: data.verification_review_due_at || "",
          verification_expires_at: data.verification_expires_at || "",
          show_contact_email: !!data.show_contact_email,
          show_contact_phone: !!data.show_contact_phone,
          public_profile_enabled: !!data.public_profile_enabled,
          languages: Array.isArray(data.languages) ? data.languages : [],
          allow_direct_messages: !!data.allow_direct_messages,
          dm_opt_out_reason: data.dm_opt_out_reason || "",
          dm_opt_out_until: data.dm_opt_out_until || "",
        };

        setForm(nextForm);

        setSavedMapModel({
          service_location: nextForm.service_location,
          service_lat: nextForm.service_lat,
          service_lng: nextForm.service_lng,
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

  const handleDirectMessageToggle = (e) => {
    const checked = e.target.checked;

    if (checked) {
      setForm((prev) => ({
        ...prev,
        allow_direct_messages: true,
        dm_opt_out_reason: "",
        dm_opt_out_until: "",
      }));
      return;
    }

    setDmReasonDraft("");
    setShowDmOptOutModal(true);
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
      const normalizedDraftLocation = normalizeLocationQuery(form.service_location);
      const normalizedSavedLocation = normalizeLocationQuery(savedMapModel.service_location);

      let resolvedCenter =
        savedMapModel.service_lat !== null &&
        savedMapModel.service_lng !== null &&
        normalizedDraftLocation &&
        normalizedDraftLocation === normalizedSavedLocation
          ? {
              lat: Number(savedMapModel.service_lat),
              lng: Number(savedMapModel.service_lng),
            }
          : null;

      if (!resolvedCenter && normalizedDraftLocation) {
        const result = await geocodeLocationQuery(normalizedDraftLocation);
        resolvedCenter = result?.center || null;
      }

      const data = new FormData();

      data.append("display_name", form.display_name || "");
      data.append("profile_type", form.profile_type || "");
      data.append("hero_headline", form.hero_headline || "");
      data.append("hero_blurb", form.hero_blurb || "");
      data.append("service_location", form.service_location || "");
      if (resolvedCenter) {
        data.append("service_lat", String(resolvedCenter.lat));
        data.append("service_lng", String(resolvedCenter.lng));
      }

      if (form.coverage_radius_miles !== "") {
        data.append("coverage_radius_miles", form.coverage_radius_miles);
      }

      data.append("contact_email", form.contact_email || "");
      data.append("contact_phone", form.contact_phone || "");
      data.append("bio", form.bio || "");
      data.append("license_number", form.license_number || "");
      data.append("license_state", form.license_state || "");
      data.append("insurance_provider", form.insurance_provider || "");
      data.append("insurance_policy_number", form.insurance_policy_number || "");
      data.append("insurance_expires_at", form.insurance_expires_at || "");
      data.append("show_contact_email", String(!!form.show_contact_email));
      data.append("show_contact_phone", String(!!form.show_contact_phone));
      data.append("public_profile_enabled", String(!!form.public_profile_enabled));
      data.append("languages", JSON.stringify(form.languages || []));
      data.append("allow_direct_messages", String(!!form.allow_direct_messages));
      data.append("dm_opt_out_reason", form.dm_opt_out_reason || "");
      data.append("dm_opt_out_until", form.dm_opt_out_until || "");

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
        profile_type: updated.profile_type ?? form.profile_type,
        email: updated.email ?? form.email,
        email_verified: updated.email_verified ?? form.email_verified,
        is_deactivated: updated.is_deactivated ?? form.is_deactivated,
        deactivated_at: updated.deactivated_at ?? form.deactivated_at,
        display_name: updated.display_name ?? form.display_name,
        hero_headline: updated.hero_headline ?? form.hero_headline,
        hero_blurb: updated.hero_blurb ?? form.hero_blurb,
        service_location: updated.service_location ?? form.service_location,
        service_lat:
          updated.service_lat !== null && updated.service_lat !== undefined
            ? Number(updated.service_lat)
            : resolvedCenter?.lat ?? form.service_lat,
        service_lng:
          updated.service_lng !== null && updated.service_lng !== undefined
            ? Number(updated.service_lng)
            : resolvedCenter?.lng ?? form.service_lng,
        coverage_radius_miles:
          updated.coverage_radius_miles !== null &&
          updated.coverage_radius_miles !== undefined
            ? String(updated.coverage_radius_miles)
            : form.coverage_radius_miles,
        contact_email: updated.contact_email ?? form.contact_email,
        contact_phone: updated.contact_phone ?? form.contact_phone,
        bio: updated.bio ?? form.bio,
        license_number: updated.license_number ?? form.license_number,
        license_state: updated.license_state ?? form.license_state,
        insurance_provider: updated.insurance_provider ?? form.insurance_provider,
        insurance_policy_number: updated.insurance_policy_number ?? form.insurance_policy_number,
        insurance_expires_at: updated.insurance_expires_at ?? form.insurance_expires_at,
        effective_verification_status:
          updated.effective_verification_status ?? form.effective_verification_status,
        verification_badge_label:
          updated.verification_badge_label ?? form.verification_badge_label,
        verification_review_due_at:
          updated.verification_review_due_at ?? form.verification_review_due_at,
        verification_expires_at:
          updated.verification_expires_at ?? form.verification_expires_at,
        show_contact_email:
          updated.show_contact_email ?? form.show_contact_email,
        show_contact_phone:
          updated.show_contact_phone ?? form.show_contact_phone,
        public_profile_enabled:
          updated.public_profile_enabled ?? form.public_profile_enabled,
        languages: Array.isArray(updated.languages)
          ? updated.languages
          : form.languages,
        allow_direct_messages:
          updated.allow_direct_messages ?? form.allow_direct_messages,
        dm_opt_out_reason:
          updated.dm_opt_out_reason ?? form.dm_opt_out_reason,
        dm_opt_out_until:
          updated.dm_opt_out_until ?? form.dm_opt_out_until,
      };

      setForm(next);

      setSavedMapModel({
        service_location: next.service_location,
        service_lat: next.service_lat,
        service_lng: next.service_lng,
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
  const profileTypeLabel =
    form.profile_type === "contractor"
      ? "Contractor"
      : form.profile_type === "homeowner"
      ? "Homeowner"
      : "";
  const isHomeownerProfile = form.profile_type === "homeowner";

  const needsProfileTypeSelection = !loading && !form.profile_type;

  const chooseProfileType = async (profileType) => {
    if (!profileType || savingProfileType) return;

    setSavingProfileType(true);
    setError("");
    setMessage("");

    try {
      const { data } = await api.patch("/users/me/", { profile_type: profileType });
      setForm((prev) => ({
        ...prev,
        profile_type: data?.profile_type || profileType,
      }));
    } catch (err) {
      console.error("[EditProfile] profile type save error", err?.response || err);
      setError("Could not save your profile type. Please try again.");
    } finally {
      setSavingProfileType(false);
    }
  };

  const renderContactVisibilitySection = () => (
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
              Public profile visible
            </div>
            <div className="text-xs text-slate-500">
              Keep this profile available on its public page.
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!form.public_profile_enabled}
            onChange={updateToggle("public_profile_enabled")}
          />
        </label>

        <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-slate-900">
              Allow direct messages
            </div>
            <div className="text-xs text-slate-500">
              Let other professionals contact you through the platform.
            </div>
          </div>
          <input
            type="checkbox"
            checked={!!form.allow_direct_messages}
            onChange={handleDirectMessageToggle}
          />
        </label>

        {!form.allow_direct_messages && form.dm_opt_out_until ? (
          <p className="mt-2 text-xs text-amber-700">
            Direct messages are paused until{" "}
            {new Date(form.dm_opt_out_until).toLocaleDateString()}.
          </p>
        ) : null}

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
  );

  const sendVerificationEmail = async () => {
    setSendingVerification(true);
    setSecurityError("");
    setSecurityMessage("");
    try {
      const { data } = await api.post("/users/me/security/send-verification/");
      setSecurityMessage(data?.detail || "Verification email sent.");
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data ||
        "Could not send verification email.";
      setSecurityError(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setSendingVerification(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setChangingPassword(true);
    setSecurityError("");
    setSecurityMessage("");
    try {
      const { data } = await api.post("/users/me/security/change-password/", passwordForm);
      setSecurityMessage(data?.detail || "Password updated successfully.");
      setPasswordForm({ current_password: "", new_password: "", new_password_confirm: "" });
      setPasswordOpen(false);
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.new_password?.[0] ||
        err?.response?.data?.new_password_confirm?.[0] ||
        err?.response?.data?.current_password?.[0] ||
        err?.response?.data ||
        "Could not change password.";
      setSecurityError(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally {
      setChangingPassword(false);
    }
  };

  const toggleDeactivated = async () => {
    const nextValue = !form.is_deactivated;
    setDeactivationBusy(true);
    setSecurityError("");
    setSecurityMessage("");
    try {
      const { data } = await api.post("/users/me/security/deactivate/", {
        is_deactivated: nextValue,
      });
      setForm((prev) => ({
        ...prev,
        is_deactivated: !!data.is_deactivated,
        deactivated_at: data.deactivated_at || "",
      }));
      setSecurityMessage(
        nextValue
          ? "Your public profile is now hidden until you turn it back on."
          : "Your public profile is visible again."
      );
    } catch (err) {
      const detail = err?.response?.data?.detail || "Could not update deactivation status.";
      setSecurityError(detail);
    } finally {
      setDeactivationBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!deletePassword) return;
    setDeleteBusy(true);
    setSecurityError("");
    try {
      await api.post("/users/me/security/delete/", { password: deletePassword });
      logout();
      navigate("/login", { replace: true });
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.password?.[0] ||
        "Could not delete this account.";
      setSecurityError(detail);
    } finally {
      setDeleteBusy(false);
    }
  };

  const accountInitial = (
    form.display_name?.trim()?.charAt(0) ||
    form.email?.trim()?.charAt(0) ||
    "U"
  ).toUpperCase();

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
                      {profileTypeLabel
                        ? `${profileTypeLabel} profile selected. Complete profiles appear more credible to visitors.`
                        : "Complete profiles appear more credible to visitors."}
                    </p>
                    {!isHomeownerProfile ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Verification badges only appear after admin review. Submitted license or insurance details do not count as verified on their own.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isHomeownerProfile ? (
                      <VerificationStatusBadge
                        status={form.effective_verification_status}
                        label={form.verification_badge_label}
                      />
                    ) : null}
                    <ProfileStatusBadge complete={complete} />
                  </div>
                </div>
              </div>

              {isHomeownerProfile ? (
                <div className="rounded-[1.5rem] border border-[#E6D8CC] bg-[#FBF9F7] p-5">
                  <h2 className="text-2xl font-semibold leading-tight text-slate-950">
                    Your homeowner profile stays private.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    The information you provide here is used for account credibility
                    and project communication only. You stay in control of what contact
                    details are shown publicly.
                  </p>
                </div>
              ) : null}

              {!isHomeownerProfile ? (
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
              ) : null}

              {!isHomeownerProfile ? (
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
              ) : null}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Display name
                </label>
                <Input
                  value={form.display_name}
                  onChange={updateField("display_name")}
                  placeholder={
                    isHomeownerProfile ? "Homeowner name" : "Business / owner name"
                  }
                />
              </div>

              {!isHomeownerProfile ? (
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
                  <AiWriteButton
                    className="mt-2"
                    feature="profile_headline"
                    payload={{
                      current_text: form.hero_headline,
                      notes: form.bio,
                    }}
                    label="Draft headline with AI"
                    onApply={(text) => setForm((prev) => ({ ...prev, hero_headline: text }))}
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
                  <AiWriteButton
                    className="mt-2"
                    feature="profile_blurb"
                    payload={{
                      current_text: form.hero_blurb,
                      notes: form.bio,
                    }}
                    label="Draft blurb with AI"
                    onApply={(text) => setForm((prev) => ({ ...prev, hero_blurb: text }))}
                  />
                </div>
              </div>
              ) : null}

              {isHomeownerProfile ? renderContactVisibilitySection() : null}
              {!isHomeownerProfile ? renderContactVisibilitySection() : null}

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
                      Service area location
                    </label>
                    <Input
                      value={form.service_location}
                      onChange={updateField("service_location")}
                      placeholder="City, region, or postal code (e.g. Media, PA or M5V 2T6)"
                      title="Enter a city, region, or postal code such as Media, PA, Toronto, ON, or M5V 2T6"
                      required
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      Map updates only after Save. U.S. ZIP codes and Canadian postal codes are supported.
                    </p>
                  </div>

                  {!isHomeownerProfile ? (
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
                  ) : null}

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
                      type="tel"
                      value={form.contact_phone}
                      onChange={updateField("contact_phone")}
                      placeholder="e.g. +1 416-555-1234"
                      required
                    />
                  </div>
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

              {!isHomeownerProfile ? (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      License and insurance
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Optional. Add the details you want reviewed. Your public profile should only show a verification badge after admin approval.
                    </p>
                  </div>
                  <VerificationStatusBadge
                    status={form.effective_verification_status}
                    label={form.verification_badge_label}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      License number
                    </label>
                    <Input
                      value={form.license_number}
                      onChange={updateField("license_number")}
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      License state / jurisdiction
                    </label>
                    <Input
                      value={form.license_state}
                      onChange={updateField("license_state")}
                      placeholder="e.g. PA"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Insurance provider
                    </label>
                    <Input
                      value={form.insurance_provider}
                      onChange={updateField("insurance_provider")}
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Insurance policy number
                    </label>
                    <Input
                      value={form.insurance_policy_number}
                      onChange={updateField("insurance_policy_number")}
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Insurance expiration
                    </label>
                    <Input
                      type="date"
                      value={form.insurance_expires_at}
                      onChange={updateField("insurance_expires_at")}
                    />
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    {form.effective_verification_status === "verified"
                      ? `Verified${form.verification_expires_at ? ` until ${new Date(form.verification_expires_at).toLocaleDateString()}` : ""}.`
                      : form.effective_verification_status === "pending"
                      ? "Verification is pending admin review."
                      : form.effective_verification_status === "expired"
                      ? "Verification has expired and needs review again."
                      : "You can submit optional license and insurance details for review."}
                    {form.verification_review_due_at ? (
                      <div className="mt-1">
                        Review due by {new Date(form.verification_review_due_at).toLocaleDateString()}.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              ) : null}

              {!isHomeownerProfile ? (
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
                <AiWriteButton
                  className="mt-2"
                  feature="profile_bio"
                  payload={{
                    current_text: form.bio,
                    notes: `${form.display_name}\n${form.service_location}`,
                    audience: "homeowners",
                  }}
                  label="Draft bio with AI"
                  onApply={(text) => setForm((prev) => ({ ...prev, bio: text }))}
                />
              </div>
              ) : null}

              {error && (
                <p className="whitespace-pre-wrap text-xs text-red-600">{error}</p>
              )}
              {message && <p className="text-xs text-emerald-600">{message}</p>}

              <Button type="submit" disabled={saving} className="mt-2">
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </Card>

          <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Account
            </div>
            <div className="flex items-center gap-3">
              {avatarPreview ? (
                <img
                  src={toUrl(avatarPreview)}
                  alt=""
                  className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {accountInitial}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {form.display_name || form.email || "Your account"}
                </div>
                <div className="truncate text-xs text-slate-500">{form.email || "No account email"}</div>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Security
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <button
                type="button"
                onClick={() => setPasswordOpen((prev) => !prev)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">Change password</div>
                  <div className="mt-1 text-xs text-slate-500">
                    Update your password any time.
                  </div>
                </div>
                <span className="text-sm text-slate-500">{passwordOpen ? "Hide" : "Open"}</span>
              </button>
              {passwordOpen ? (
                <form onSubmit={changePassword} className="mt-3 space-y-3">
                  <Input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, current_password: e.target.value }))
                    }
                    placeholder="Current password"
                  />
                  <Input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, new_password: e.target.value }))
                    }
                    placeholder="New password"
                  />
                  <Input
                    type="password"
                    value={passwordForm.new_password_confirm}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({ ...prev, new_password_confirm: e.target.value }))
                    }
                    placeholder="Confirm new password"
                  />
                  <Button type="submit" disabled={changingPassword}>
                    {changingPassword ? "Updating..." : "Change Password"}
                  </Button>
                </form>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Email</div>
                  <div className="mt-1 text-xs text-slate-500">{form.email || "No account email"}</div>
                  {!form.email_verified ? (
                    <div className="mt-2">
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
                        Not verified
                      </span>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        Verified
                      </span>
                    </div>
                  )}
                </div>
                {!form.email_verified ? (
                  <GhostButton type="button" disabled={sendingVerification} onClick={sendVerificationEmail}>
                    {sendingVerification ? "Sending..." : "Send confirmation email"}
                  </GhostButton>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
              <div className="text-sm font-semibold text-rose-900">Deactivate and delete account</div>
              <div className="mt-2 text-xs leading-5 text-rose-800">
                Deactivate hides your public profile. Delete permanently removes the account, blocks this email from registering again automatically, and is not the right tool for cleanup requests. Contact the admin if you need help.
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <GhostButton type="button" disabled={deactivationBusy} onClick={toggleDeactivated}>
                  {deactivationBusy
                    ? "Updating..."
                    : form.is_deactivated
                    ? "Reactivate profile"
                    : "Deactivate profile"}
                </GhostButton>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
                >
                  Delete account
                </button>
              </div>
            </div>

            {securityError ? <p className="whitespace-pre-wrap text-xs text-red-600">{securityError}</p> : null}
            {securityMessage ? <p className="text-xs text-emerald-600">{securityMessage}</p> : null}
          </Card>

          <Card className="space-y-3 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Service area preview
            </div>
            <p className="text-xs text-slate-600">
              Map updates only after Save (prevents jumping while typing).
            </p>

            <Suspense
              fallback={
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  Loading map…
                </div>
              }
            >
              <ServiceAreaMap
                deferUpdatesUntilSave={true}
                locationQuery={form.service_location}
                radiusMiles={form.coverage_radius_miles}
                savedLocationQuery={savedMapModel.service_location}
                savedRadiusMiles={savedMapModel.coverage_radius_miles}
                resolvedCenter={
                  savedMapModel.service_lat !== null &&
                  savedMapModel.service_lng !== null
                    ? {
                        lat: Number(savedMapModel.service_lat),
                        lng: Number(savedMapModel.service_lng),
                      }
                    : null
                }
                heightClassName="h-64"
              />
            </Suspense>
          </Card>
          </div>
        </div>
      )}

      {needsProfileTypeSelection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="max-w-xl">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4F5D83]">
                Profile setup
              </div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                Are you a contractor or a homeowner?
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Choose the profile type that fits how you plan to use FlatOrigin. We will use this to shape the edit profile form next.
              </p>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                disabled={savingProfileType}
                onClick={() => chooseProfileType("contractor")}
                className="rounded-2xl border border-slate-200 bg-[#FBF9F7] p-5 text-left transition hover:border-[#4F5D83] hover:bg-white disabled:opacity-60"
              >
                <div className="text-lg font-semibold text-slate-950">Contractor</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Build a public portfolio, get discovered, respond to real job posts, and keep project conversations organized.
                </p>
              </button>

              <button
                type="button"
                disabled={savingProfileType}
                onClick={() => chooseProfileType("homeowner")}
                className="rounded-2xl border border-slate-200 bg-[#FBF9F7] p-5 text-left transition hover:border-[#4F5D83] hover:bg-white disabled:opacity-60"
              >
                <div className="text-lg font-semibold text-slate-950">Homeowner</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Post projects, invite contractors, ask focused questions, compare bids, and keep your hiring process private.
                </p>
              </button>
            </div>

            {savingProfileType ? (
              <p className="mt-4 text-sm text-slate-500">Saving selection…</p>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {showDmOptOutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Turn off direct messages?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Messaging is the main way others can connect with you on the platform.
              Why are you turning it off?
            </p>

            <div className="mt-4 space-y-2">
              {[
                ["too_many", "Too many messages"],
                ["spam", "Spam"],
                ["not_ready", "Not ready yet"],
                ["other", "Other"],
              ].map(([value, label]) => (
                <label
                  key={value}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2"
                >
                  <input
                    type="radio"
                    name="dm_opt_out_reason"
                    value={value}
                    checked={dmReasonDraft === value}
                    onChange={(e) => setDmReasonDraft(e.target.value)}
                  />
                  <span className="text-sm text-slate-800">{label}</span>
                </label>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDmOptOutModal(false);
                  setDmReasonDraft("");
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!dmReasonDraft}
                onClick={() => {
                  const until = new Date(
                    Date.now() + 14 * 24 * 60 * 60 * 1000
                  ).toISOString();

                  setForm((prev) => ({
                    ...prev,
                    allow_direct_messages: false,
                    dm_opt_out_reason: dmReasonDraft,
                    dm_opt_out_until: until,
                  }));

                  setShowDmOptOutModal(false);
                  setDmReasonDraft("");
                }}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Turn off messaging
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete account?</h3>
            <p className="mt-2 text-sm text-slate-600">
              This permanently deletes your account. Your email may not be usable for a new registration later. If you need cleanup help, contact the admin instead of deleting the account.
            </p>
            <Input
              type="password"
              className="mt-4"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Type your password to confirm"
            />
            <div className="mt-5 flex justify-end gap-2">
              <GhostButton
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword("");
                }}
              >
                Cancel
              </GhostButton>
              <button
                type="button"
                disabled={!deletePassword || deleteBusy}
                onClick={deleteAccount}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {deleteBusy ? "Deleting..." : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
