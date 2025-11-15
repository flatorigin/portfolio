// import { useEffect, useState } from "react";
// import api from "../api";
// import { useParams } from "react-router-dom";

// export default function ProjectDetail(){
//   const { id } = useParams();
//   const [p,setP] = useState(null);

//   useEffect(()=>{
//     api.get(`/projects/${id}/`).then(({data})=>setP(data));
//   },[id]);

//   if(!p) return null;
//   return (
//     <div>
//       <h2>{p.title}</h2>
//       {p.cover_image && <img src={p.cover_image} alt="" style={{width:"100%", maxHeight:420, objectFit:"cover", borderRadius:12}}/>}
//       <p>{p.summary}</p>
//       {!!p.images?.length && (
//         <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))", gap:12}}>
//           {p.images.map(img=> (
//             <figure key={img.id} style={{margin:0}}>
//               <img src={img.image} alt={img.alt_text} style={{width:"100%", borderRadius:8}}/>
//               {img.caption && <figcaption style={{fontSize:12, opacity:.7}}>{img.caption}</figcaption>}
//             </figure>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// file: src/pages/ProfileEdit.jsx
// Replace ENDPOINT + FIELD with your known-good values from curl.
import { useEffect, useMemo, useState } from "react";
import api from "../api";

const ENDPOINT = "/users/me/";     // ← your profile URL
const METHOD   = "PATCH";          // PATCH is typical; use your allowed one
const FIELD    = "avatar";         // ← exact file field name on server

function errMsg(e, fb="Failed") {
  const r = e?.response; if (!r) return e?.message || fb;
  if (typeof r.data === "string") return r.data;
  if (r.data?.detail) return String(r.data.detail);
  try {
    return Object.entries(r.data).map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(", "):String(v)}`).join(" | ") || fb;
  } catch { return fb; }
}

export default function ProfileEdit() {
  const [profile, setProfile] = useState(null);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  // 0) Log axios details to console to see what’s sent/received
  useEffect(() => {
    const reqId = api.interceptors.request.use((cfg) => {
      console.info("[logo] request", { url: cfg.url, method: cfg.method, headers: cfg.headers });
      return cfg;
    });
    const resId = api.interceptors.response.use(
      (res) => { console.info("[logo] response", { url: res.config?.url, status: res.status, data: res.data }); return res; },
      (e)   => { console.error("[logo] error", { url: e?.config?.url, status: e?.response?.status, data: e?.response?.data }); return Promise.reject(e); }
    );
    return () => { api.interceptors.request.eject(reqId); api.interceptors.response.eject(resId); };
  }, []);

  // 1) load profile
  async function load() {
    try {
      const { data } = await api.get(ENDPOINT);
      setProfile(data || null);
      // Normalize the URL prop you actually get from backend:
      const url = data?.avatar || data?.logo || data?.image || data?.avatar_url || data?.logo_url || "";
      if (url) localStorage.setItem("profile_logo", url); else localStorage.removeItem("profile_logo");
    } catch (e) {
      setError(errMsg(e, "Failed to load profile"));
    }
  }
  useEffect(() => { load(); }, []);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  const banner  = preview || profile?.avatar || profile?.logo || profile?.image || localStorage.getItem("profile_logo") || "";

  function onPick(f) {
    setError(""); setNote("");
    if (!f) return setFile(null);
    const okType = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(f.type);
    const okSize = f.size <= 5*1024*1024;
    if (!okType) return setError("Use PNG/JPG/GIF/WEBP/SVG.");
    if (!okSize) return setError("Max 5MB.");
    setFile(f);
  }

  // 2) upload
  async function saveLogo(e) {
    e.preventDefault();
    setError(""); setNote("");
    if (!file) return setError("Pick a file first.");
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append(FIELD, file, file.name);           // ← exact server field name
      await api.request({ url: ENDPOINT, method: METHOD, data: fd }); // DO NOT set Content-Type
      await load();
      setFile(null);
      setNote("Logo saved.");
    } catch (e2) {
      setError(errMsg(e2, "Failed to save logo"));
    } finally { setSaving(false); }
  }

  // 3) remove
  async function removeLogo() {
    setError(""); setNote(""); setRemoving(true);
    try {
      // a) JSON null clear (most DRF/FastAPI setups)
      try {
        await api.patch(ENDPOINT, { [FIELD]: null }, { headers: { "Content-Type": "application/json" } });
      } catch (eA) {
        // b) Multipart empty
        try {
          const fd = new FormData(); fd.append(FIELD, "");
          await api.patch(ENDPOINT, fd);
        } catch (eB) {
          // c) DELETE subroute fallback
          const base = ENDPOINT.endsWith("/") ? ENDPOINT : ENDPOINT + "/";
          const routes = [`${base}logo/`, `${base}${FIELD}/`];
          let ok = false;
          for (const r of routes) { try { await api.delete(r); ok = true; break; } catch {} }
          if (!ok) throw eB;
        }
      }
      await load();
      setNote("Logo removed.");
    } catch (e) {
      setError(errMsg(e, "Failed to remove logo"));
    } finally { setRemoving(false); }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-2 text-sm font-medium text-slate-600">Profile Logo</div>
        {banner ? (
          <div className="flex items-center gap-6">
            <img src={banner} alt="Logo" className="h-20 w-20 rounded-xl object-cover" />
            <div className="text-sm text-slate-600"><code>{METHOD} {ENDPOINT}</code> · field <code>{FIELD}</code></div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No logo yet — upload one.</div>
        )}
      </div>

      <h2 className="mb-3 text-2xl font-bold">Edit Profile</h2>
      <form onSubmit={saveLogo} className="max-w-xl space-y-4">
        <input type="file" accept="image/*" onChange={(e)=>onPick(e.target.files?.[0]||null)} className="block w-full rounded-xl border px-3 py-2" />
        <div className="flex flex-wrap gap-3">
          <button disabled={saving} className="rounded-xl bg-gray-400 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60">{saving ? "Saving…" : "Save Logo"}</button>
          <button type="button" onClick={removeLogo} disabled={removing} className="rounded-xl bg-rose-600 px-4 py-2 text-white hover:bg-rose-700 disabled:opacity-60">{removing ? "Removing…" : "Remove Logo"}</button>
        </div>
        {note && <div className="text-sm text-emerald-700">{note}</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}
      </form>
    </div>
  );
}