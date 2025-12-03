// =======================================
// file: frontend/src/pages/EditProfile.jsx
// =======================================
import { useEffect, useState } from "react";
import api from "../api";
import { Card, Button, Input, Textarea } from "../ui";

export default function EditProfile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // form state
  const [displayName, setDisplayName] = useState("");
  const [serviceLocation, setServiceLocation] = useState("");
  const [radiusMiles, setRadiusMiles] = useState("");
  const [bio, setBio] = useState("");

  // NEW optional contact info
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // avatar / logo
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");

  // -------- Load current profile from /users/me/ --------
  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const { data } = await api.get("/users/me/");
        if (!alive) return;

        console.log("[EditProfile] /users/me:", data);

        setDisplayName(data.display_name || "");
        setServiceLocation(data.service_location || "");
        setRadiusMiles(
          data.coverage_radius_miles === null ||
          data.coverage_radius_miles === undefined
            ? ""
            : String(data.coverage_radius_miles)
        );
        setBio(data.bio || "");

        // NEW: contact fields
        setContactEmail(data.contact_email || "");
        setContactPhone(data.contact_phone || "");

        const avatar =
          data.avatar_url || data.logo || data.avatar || "";
        setAvatarPreview(avatar);
      } catch (err) {
        if (!alive) return;
        console.error("[EditProfile] load error", err?.response || err);
        setError("Failed to load your profile.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      alive = false;
    };
  }, []);

  // -------- Save changes (PATCH /users/me/) --------
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("display_name", displayName.trim());
    formData.append("service_location", serviceLocation.trim());
    formData.append(
      "coverage_radius_miles",
      radiusMiles === "" ? "" : String(radiusMiles)
    );
    formData.append("bio", bio);

    // NEW: optional contact info
    formData.append("contact_email", contactEmail.trim());
    formData.append("contact_phone", contactPhone.trim());

    if (avatarFile) {
      formData.append("logo", avatarFile); // backend uses logo/avatar
    }

    setSaving(true);
    try {
      const { data } = await api.patch("/users/me/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setSuccess("Profile updated.");

      // sync back from response
      setDisplayName(data.display_name || "");
      setServiceLocation(data.service_location || "");
      setRadiusMiles(
        data.coverage_radius_miles === null ||
        data.coverage_radius_miles === undefined
          ? ""
          : String(data.coverage_radius_miles)
      );
      setBio(data.bio || "");
      setContactEmail(data.contact_email || "");
      setContactPhone(data.contact_phone || "");

      const avatar =
        data.avatar_url || data.logo || data.avatar || avatarPreview;
      setAvatarPreview(avatar);
      setAvatarFile(null);
    } catch (err) {
      console.error("[EditProfile] save error", err?.response || err);
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Failed to update profile.";
      setError(typeof msg === "string" ? msg : "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  }

  // -------- UI --------
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Edit Profile</h1>

      <Card className="max-w-xl space-y-4 p-4">
        {loading ? (
          <p className="text-sm text-slate-600">Loading profile…</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display name */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Display name
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Mokko Studio"
              />
            </div>

            {/* Service location */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Service location
              </label>
              <Input
                value={serviceLocation}
                onChange={(e) => setServiceLocation(e.target.value)}
                placeholder="e.g. Philadelphia, PA"
              />
            </div>

            {/* Coverage radius */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Coverage radius (miles)
              </label>
              <Input
                type="number"
                inputMode="numeric"
                value={radiusMiles}
                onChange={(e) => setRadiusMiles(e.target.value)}
                placeholder="e.g. 25"
              />
            </div>

            {/* NEW: Contact email */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Contact email <span className="text-xs text-slate-400">(optional)</span>
              </label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="e.g. hello@mokko.studio"
              />
            </div>

            {/* NEW: Contact phone */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Contact phone <span className="text-xs text-slate-400">(optional)</span>
              </label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="e.g. (555) 123-4567"
              />
            </div>

            {/* Bio */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Bio
              </label>
              <Textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people what kind of work you do…"
              />
            </div>

            {/* Avatar / logo */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Avatar / Logo
              </label>
              <div className="flex items-center gap-3">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="h-16 w-16 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-slate-300 text-xs text-slate-400">
                    No image
                  </div>
                )}

                <label className="cursor-pointer text-xs font-medium text-slate-700">
                  <span className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-50">
                    Choose file
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setAvatarFile(file || null);
                      setError("");
                      setSuccess("");
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setAvatarPreview(url);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Alerts */}
            {error && <p className="text-xs text-red-600">{error}</p>}
            {success && <p className="text-xs text-green-600">{success}</p>}

            <div className="pt-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
