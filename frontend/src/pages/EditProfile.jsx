// ============================================================================
// file: frontend/src/pages/EditProfile.jsx
// ============================================================================
import { useEffect, useState } from "react";
import api from "../api";
import { SectionTitle, Card, Input, Textarea, Button } from "../ui";

// Flexible profile endpoints (works with /users/me/, /me/, /profiles/me/, /profile/me/)
const ME_ENDPOINTS = ["/users/me/", "/me/", "/profiles/me/", "/profile/me/"];

async function getMe() {
  let lastErr;
  for (const url of ME_ENDPOINTS) {
    try {
      const res = await api.get(url);
      res._url = url;
      return res;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function patchMe(payload) {
  let lastErr;
  for (const url of ME_ENDPOINTS) {
    try {
      const res = await api.patch(url, payload);
      res._url = url;
      return res;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function normalizeLocationFrom(me) {
  if (!me) return "";
  if (typeof me.location === "string" && me.location.trim()) return me.location.trim();
  const locObj =
    (me.location && typeof me.location === "object" && me.location) ||
    (me.profile?.location && typeof me.profile.location === "object" && me.profile.location) ||
    null;
  const parts = [
    me.city ?? locObj?.city,
    me.state ?? me.region ?? locObj?.state ?? locObj?.region,
    me.country ?? locObj?.country,
  ].filter(Boolean);
  if (parts.length) return parts.join(", ");
  if (typeof me.profile?.location === "string") return me.profile.location.trim();
  return "";
}

async function saveLocationSmart(loc) {
  const location = String(loc || "").trim();
  if (!location) return "";
  const [cityPart = "", rest = ""] = location.split(",");
  const city = cityPart.trim();
  const state = (rest || "").trim();

  const attempts = [
    { payload: { location }, pick: (d) => d?.location },
    { payload: { profile: { location } }, pick: (d) => d?.profile?.location },
    {
      payload: { ...(city ? { city } : {}), ...(state ? { state } : {}) },
      pick: (d) => [d?.city || d?.profile?.city, d?.state || d?.profile?.state || d?.region || d?.profile?.region, d?.country || d?.profile?.country]
        .filter(Boolean).join(", "),
    },
  ];

  for (const t of attempts) {
    try {
      await patchMe(t.payload);
      const { data } = await getMe();
      const got = t.pick(data);
      if (got && String(got).trim()) {
        return normalizeLocationFrom(data); // why: keep both pages consistent
      }
    } catch { /* try next */ }
  }
  throw new Error("Location save failed (no accepted payloads).");
}

export default function EditProfile() {
  const [form, setForm] = useState({ display_name: "", bio: "", location: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (!token) return; // why: avoid pre-login calls
    (async () => {
      try {
        const { data } = await getMe();
        setForm({
          display_name: data?.display_name || data?.name || "",
          bio: data?.bio || data?.profile?.bio || "",
          location: normalizeLocationFrom(data),
        });
      } catch {
        setMsg("Failed to load profile.");
      }
    })();
  }, []);

  async function onSave(e) {
    e?.preventDefault?.();
    setBusy(true);
    setMsg("");
    try {
      await patchMe({
        display_name: form.display_name || "",
        bio: form.bio || "",
      });

      const normalized = await saveLocationSmart(form.location);

      localStorage.setItem("profile_display_name", form.display_name || "");
      localStorage.setItem("profile_location", normalized || "");
      window.dispatchEvent(new CustomEvent("profile:updated", {
        detail: { display_name: form.display_name || "", location: normalized || "" },
      }));
      setMsg("Profile saved.");
    } catch (e) {
      const body = e?.response?.data ? JSON.stringify(e.response.data) : e?.message || String(e);
      setMsg(`Save failed: ${body}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle>Edit Profile</SectionTitle>
      <Card className="p-5">
        <form onSubmit={onSave} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-600">Company Name</label>
            <Input value={form.display_name} onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-600">Location</label>
            <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="City, State" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm text-slate-600">Bio</label>
            <Textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            {msg && <div className="text-sm text-slate-600">{msg}</div>}
            <Button disabled={busy}>Save</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}