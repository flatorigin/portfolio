import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../api";
import { Card, SectionTitle, Input, Textarea, Button } from "../ui";

// normalize relative media paths
function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/,"");
  const origin = base.replace(/\/api\/?$/,"");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

export default function EditProfile() {
  const [endpoint, setEndpoint] = useState("/users/me/"); // primary
  const fallbackEndpoint = "/auth/users/me/";             // djoser alt

  const [form, setForm] = useState({
    display_name: "",
    service_location: "",
    coverage_radius_miles: "",
    bio: "",
    logo: "", // url/path from API
  });
  const [logoFile, setLogoFile] = useState(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);
  const [toast, setToast] = useState({ show: false, kind: "success", msg: "" });

  const logoUrl = useMemo(() => toUrl(form.logo), [form.logo]);

  const loadMe = useCallback(async () => {
    setErr(""); setOk(false);
    try {
      const { data } = await api.get(endpoint);
      setForm({
        display_name: data?.display_name || data?.name || "",
        service_location: data?.service_location || "",
        coverage_radius_miles: data?.coverage_radius_miles ?? "",
        bio: data?.bio || "",
        logo: data?.logo || data?.logo_url || "",
      });
      setLogoFile(null);
      return;
    } catch {
      try {
        const { data } = await api.get(fallbackEndpoint);
        setEndpoint(fallbackEndpoint);
        setForm({
          display_name: data?.display_name || data?.name || "",
          service_location: data?.service_location || "",
          coverage_radius_miles: data?.coverage_radius_miles ?? "",
          bio: data?.bio || "",
          logo: data?.logo || data?.logo_url || "",
        });
        setLogoFile(null);
      } catch (e2) {
        setErr(e2?.response?.data ? JSON.stringify(e2.response.data) : String(e2));
      }
    }
  }, [endpoint]);

  useEffect(() => { loadMe(); }, [loadMe]);

  function coerceNumber(v) {
    if (v === "" || v === null || typeof v === "undefined") return "";
    const n = Number(String(v).replace(/[^\d.]+/g, ""));
    return Number.isFinite(n) ? n : "";
  }

  async function patchProfile(url, body, useMultipart) {
    if (useMultipart) {
      const fd = new FormData();
      Object.entries(body).forEach(([k, v]) => fd.append(k, v ?? ""));
      return api.patch(url, fd, { headers: { "Content-Type": "multipart/form-data" } });
    }
    return api.patch(url, body);
  }

  function broadcast(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function showToast(kind, msg, ms = 2200) {
    setToast({ show: true, kind, msg });
    setTimeout(() => setToast({ show: false, kind, msg: "" }), ms);
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true); setErr(""); setOk(false);

    // inform Dashboard (spinner)
    broadcast("profile:updating", { at: Date.now() });

    const payload = {
      display_name: form.display_name || "",
      service_location: form.service_location || "",
      coverage_radius_miles: coerceNumber(form.coverage_radius_miles),
      bio: form.bio || "",
    };
    const useMultipart = !!logoFile;
    if (logoFile) payload.logo = logoFile;

    try {
      await patchProfile(endpoint, payload, useMultipart);
      setOk(true);
      await loadMe();

      // update cache + notify
      localStorage.setItem("profile_display_name", form.display_name || "");
      if (!logoFile && form.logo) localStorage.setItem("profile_logo", form.logo);
      broadcast("profile:updated", { display_name: form.display_name, logo: form.logo });

      showToast("success", "Profile saved.");
    } catch (e1) {
      const status = e1?.response?.status;
      if ((status === 404 || status === 405) && endpoint !== fallbackEndpoint) {
        try {
          await patchProfile(fallbackEndpoint, payload, useMultipart);
          setEndpoint(fallbackEndpoint);
          setOk(true);
          await loadMe();
          localStorage.setItem("profile_display_name", form.display_name || "");
          if (!logoFile && form.logo) localStorage.setItem("profile_logo", form.logo);
          broadcast("profile:updated", { display_name: form.display_name, logo: form.logo });
          showToast("success", "Profile saved.");
        } catch (e2) {
          const msg = e2?.response?.data ? JSON.stringify(e2.response.data) : String(e2);
          setErr(msg);
          showToast("error", "Save failed.");
        }
      } else {
        const msg = e1?.response?.data ? JSON.stringify(e1.response.data) : String(e1);
        setErr(msg);
        showToast("error", "Save failed.");
      }
    } finally {
      setBusy(false);
      // always end spinner
      broadcast("profile:updated", { at: Date.now() });
    }
  }

  return (
    <div className="space-y-6">
      <SectionTitle>Edit Profile</SectionTitle>

      <Card className="relative p-5">
        <form onSubmit={save} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Identity */}
          <div className="md:col-span-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Identity</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-slate-600">Name (Company/Person)</label>
                <Input
                  value={form.display_name}
                  onChange={(e)=>setForm({...form, display_name:e.target.value})}
                  placeholder="e.g. Skivelight Studio"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-600">Logo</label>
                <input type="file" accept="image/*" onChange={(e)=>setLogoFile(e.target.files?.[0]||null)} />
                {logoFile && <div className="mt-1 text-xs text-slate-500 truncate">{logoFile.name}</div>}
                {logoUrl && !logoFile && (
                  <div className="mt-2">
                    <img src={logoUrl} alt="Logo" className="h-16 w-16 rounded-full object-cover ring-1 ring-slate-200" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Service */}
          <div className="md:col-span-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Service</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-slate-600">Location of Service</label>
                <Input
                  value={form.service_location}
                  onChange={(e)=>setForm({...form, service_location:e.target.value})}
                  placeholder="City, State"
                />
              </div>
              <div className="md:col-span-1">
                <label className="mb-1 block text-sm text-slate-600">Coverage Radius (miles)</label>
                <Input
                  inputMode="numeric"
                  value={form.coverage_radius_miles}
                  onChange={(e)=>setForm({...form, coverage_radius_miles:e.target.value})}
                  placeholder="e.g. 50"
                />
              </div>
            </div>
          </div>

          {/* About */}
          <div className="md:col-span-2">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">About</div>
            <label className="mb-1 block text-sm text-slate-600">Short Bio (optional)</label>
            <Textarea
              value={form.bio}
              onChange={(e)=>setForm({...form, bio:e.target.value})}
              placeholder="One or two sentences about the company…"
            />
          </div>

          {/* Status */}
          {err && <div className="md:col-span-2 text-sm text-red-700">{err}</div>}
          {ok && !err && <div className="md:col-span-2 text-sm text-green-700">Saved.</div>}

          <div className="md:col-span-2">
            <Button disabled={busy}>{busy ? "Saving…" : "Save Profile"}</Button>
          </div>
        </form>

        {/* Tiny Toast */}
        {toast.show && (
          <div
            className={`pointer-events-none fixed inset-x-0 bottom-4 mx-auto w-max rounded-full px-4 py-2 text-sm shadow ${toast.kind==="success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}
            role="status"
            aria-live="polite"
          >
            {toast.msg}
          </div>
        )}
      </Card>
    </div>
  );
}