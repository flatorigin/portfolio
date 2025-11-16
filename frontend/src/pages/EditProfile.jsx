// frontend/src/pages/ProfileEdit.jsx
import { useEffect, useState } from "react";
import api from "../api";

// why: normalize /media/... to full URL
function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? origin + raw : origin + "/" + raw;
}

export default function ProfileEdit() {
  // Logo state
  const [me, setMe] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Project draft (local only)
  const [projectDraft, setProjectDraft] = useState({
    name: "",
    location: "",
    budget: "",
    sqf: "",
    highlights: "",
  });
  const [draftSaved, setDraftSaved] = useState("");

  // Load profile + local draft
  useEffect(() => {
    let alive = true;
    api.get("/users/me/").then(({ data }) => alive && setMe(data)).catch(() => {});
    try {
      const raw = localStorage.getItem("draftProject");
      if (raw) {
        const d = JSON.parse(raw);
        setProjectDraft({
          name: d.name || "",
          location: d.location || "",
          budget: d.budget ?? "",
          sqf: d.sqf ?? "",
          highlights: d.highlights || "",
        });
      }
    } catch {}
    return () => { alive = false; };
  }, []);

  async function saveLogo() {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const { data } = await api.patch("/users/me/", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setMe(data); setFile(null);
    } catch (e) {
      setErr(e?.response?.data ? JSON.stringify(e.response.data) : String(e));
    } finally { setBusy(false); }
  }

  async function removeLogo() {
    setBusy(true); setErr("");
    try {
      const { data } = await api.patch("/users/me/", { avatar: null });
      setMe(data);
    } catch (e) {
      setErr(e?.response?.data ? JSON.stringify(e.response.data) : String(e));
    } finally { setBusy(false); }
  }

  function saveDraft() {
    const clean = {
      name: projectDraft.name.trim(),
      location: projectDraft.location.trim(),
      budget: projectDraft.budget === "" ? "" : Number(projectDraft.budget),
      sqf: projectDraft.sqf === "" ? "" : Number(projectDraft.sqf),
      highlights: projectDraft.highlights.trim(),
      _savedAt: new Date().toISOString(),
    };
    if (Number.isNaN(clean.budget)) return setDraftSaved("Budget must be a number");
    if (Number.isNaN(clean.sqf)) return setDraftSaved("Sq Ft must be a number");
    localStorage.setItem("draftProject", JSON.stringify(clean));
    setDraftSaved("Draft saved locally.");
    setTimeout(() => setDraftSaved(""), 1600);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h2 className="mb-4 text-2xl font-bold">Edit Profile</h2>

      {/* Logo block */}
      <div className="mb-6">
        <div className="mb-2 text-sm text-slate-600">Current Logo</div>
        <div className="mb-3 flex items-center gap-3">
          {me?.avatar ? (
            <>
              <img src={toUrl(me.avatar)} alt="logo" className="h-20 w-20 rounded-xl object-cover border" />
              <button
                onClick={removeLogo}
                disabled={busy}
                className="rounded-xl bg-red-600 px-3 py-2 text-white disabled:opacity-60"
              >
                Remove
              </button>
            </>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed text-xs text-slate-500">No logo</div>
          )}
        </div>

        <input
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="mb-3 block w-full rounded-xl border p-2"
        />
        <button
          onClick={saveLogo}
          disabled={busy || !file}
          className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
        >
          Save Logo
        </button>
      </div>

      {/* Project Info (local draft only) */}
      <div className="mb-2 text-sm font-semibold text-slate-700">Project Info (Draft)</div>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm text-slate-600">Project Name</label>
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            value={projectDraft.name}
            onChange={(e) => setProjectDraft({ ...projectDraft, name: e.target.value })}
            placeholder="e.g., Sunrise Residence"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Location (not address)</label>
          <input
            className="w-full rounded-xl border border-slate-300 px-3 py-2"
            value={projectDraft.location}
            onChange={(e) => setProjectDraft({ ...projectDraft, location: e.target.value })}
            placeholder="e.g., Malibu, CA"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm text-slate-600">Budget</label>
            <input
              inputMode="decimal"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={projectDraft.budget}
              onChange={(e) => setProjectDraft({ ...projectDraft, budget: e.target.value })}
              placeholder="e.g., 2500000"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-600">Square Feet</label>
            <input
              inputMode="numeric"
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={projectDraft.sqf}
              onChange={(e) => setProjectDraft({ ...projectDraft, sqf: e.target.value })}
              placeholder="e.g., 4800"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-600">Highlights (tags / text)</label>
          <textarea
            className="w-full rounded-xl border border-slate-300 px-3 py-2 min-h-24"
            value={projectDraft.highlights}
            onChange={(e) => setProjectDraft({ ...projectDraft, highlights: e.target.value })}
            placeholder="e.g., ocean view, passive house, LEED Gold"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={saveDraft}
            className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-white hover:opacity-90"
          >
            Save Project Notes (Local)
          </button>
          {draftSaved && <span className="text-sm text-green-700">{draftSaved}</span>}
        </div>
      </div>

      {err && <div className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
    </div>
  );
}
