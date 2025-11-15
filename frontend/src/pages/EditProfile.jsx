// // frontend/src/pages/EditProfile.jsx
// import { useEffect, useState } from "react";
// import api from "../api";

// export default function EditProfile(){
//   const [form,setForm]=useState({
//     display_name:"", company:"", bio:"", location:"", website:"",
//     contact_email:"", contact_phone:"", show_contact_form:true
//   });
//   const [avatar,setAvatar]=useState(null);
//   const [error, setError] = useState(null);     // ← add error state

//   useEffect(()=>{
//     api.get("/me/profile/").then(({data})=> setForm(f=>({...f, ...data})));
//   },[]);

//   // ↓↓↓ REPLACE your old submit function with this one ↓↓↓
//   const submit = async (e)=> {
//     e.preventDefault();
//     setError(null);

//     const fd = new FormData();

//     const fields = {
//       display_name: form.display_name?.trim(),
//       company: form.company?.trim(),
//       bio: form.bio?.trim(),
//       location: form.location?.trim(),
//       website: form.website?.trim(),        // include https:// if you use it
//       contact_email: form.contact_email?.trim(),
//       contact_phone: form.contact_phone?.trim(),
//       show_contact_form: !!form.show_contact_form,
//       // socials must be JSON (object). If you don’t have a UI for it yet, send {}
//       socials: JSON.stringify({})           // change later if you add socials UI
//     };

//     for (const [k, v] of Object.entries(fields)) {
//       if (typeof v === "boolean") fd.append(k, v ? "true" : "false");
//       else if (v) fd.append(k, v); // append only non-empty strings
//     }

//     if (avatar) fd.append("avatar", avatar);

//     try {
//       await api.patch("/me/profile/", fd, {
//         headers: { "Content-Type": "multipart/form-data" },
//       });
//       alert("Profile saved");
//     } catch (err) {
//       const data = err?.response?.data;
//       if (data && typeof data === "object") {
//         const msgs = Object.entries(data).map(([k, v]) =>
//           `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`
//         );
//         setError(msgs.join(" | "));
//       } else {
//         setError(err.message || "Save failed");
//       }
//       console.error("Profile save error:", data || err);
//     }
//   };
//   // ↑↑↑ end replacement ↑↑↑

//   return (
//     <form onSubmit={submit} style={{maxWidth:600}}>
//       <h2>Edit Profile</h2>

//       {/* ↓↓↓ add this error box somewhere above the button ↓↓↓ */}
//       {error && (
//         <div style={{background:"#fee", border:"1px solid #f99", padding:8, borderRadius:6, margin:"8px 0"}}>
//           {error}
//         </div>
//       )}

//       <input placeholder="Display name" value={form.display_name||""}
//              onChange={e=>setForm({...form,display_name:e.target.value})}/>
//       <input placeholder="Company" value={form.company||""}
//              onChange={e=>setForm({...form,company:e.target.value})}/>
//       <textarea placeholder="Bio" value={form.bio||""}
//                 onChange={e=>setForm({...form,bio:e.target.value})}/>
//       <input type="file" onChange={e=>setAvatar(e.target.files[0])}/>
//       <input placeholder="Website (https://…)" value={form.website||""}
//              onChange={e=>setForm({...form,website:e.target.value})}/>
//       <input placeholder="Contact email" value={form.contact_email||""}
//              onChange={e=>setForm({...form,contact_email:e.target.value})}/>
//       <input placeholder="Contact phone" value={form.contact_phone||""}
//              onChange={e=>setForm({...form,contact_phone:e.target.value})}/>
//       <label style={{display:"block", margin:"8px 0"}}>
//         <input type="checkbox" checked={!!form.show_contact_form}
//                onChange={e=>setForm({...form,show_contact_form:e.target.checked})}/>
//         Show contact form
//       </label>

//       <button>Save</button>

//       <style>{`
//         input, textarea, button { width: 100%; padding: 10px; margin: 8px 0; }
//         button { cursor: pointer; }
//         textarea { min-height: 120px; }
//       `}</style>
//     </form>
//   );
// }


// file: src/pages/ProfileEdit.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api";

/** <<< SET THESE TO YOUR WORKING VALUES >>> */
const PROFILE_ENDPOINT = "/users/me/";   // e.g. "/users/me/" or "/profile/"
const UPLOAD_METHOD   = "PATCH";         // "PATCH" (typical) or "PUT"/"POST"
const FILE_FIELD      = "avatar";        // e.g. "avatar", "logo", "image"
/** ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ */

function readServerError(err, fallback = "Request failed") {
  try {
    const res = err?.response;
    if (res?.data) {
      if (typeof res.data === "string") return res.data;
      if (res.data?.detail) return String(res.data.detail);
      const msg = Object.entries(res.data)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
        .join(" | ");
      if (msg) return msg;
    }
    if (err?.message) return err.message;
  } catch {}
  return fallback;
}

export default function ProfileEdit() {
  const [profile, setProfile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(PROFILE_ENDPOINT);
        setProfile(data || null);
        if (data?.logo) localStorage.setItem("profile_logo", data.logo);
      } catch {/* non-fatal */}
    })();
  }, []);

  const previewUrl = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : ""), [logoFile]);
  const bannerUrl = previewUrl || profile?.logo || localStorage.getItem("profile_logo") || "";

  function onPick(file) {
    setError(""); setNote("");
    if (!file) return setLogoFile(null);
    const okType = /^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(file.type);
    const okSize = file.size <= 5 * 1024 * 1024;
    if (!okType) return setError("Please upload PNG/JPG/GIF/WEBP/SVG.");
    if (!okSize) return setError("Image too large (max 5MB).");
    setLogoFile(file);
  }

  async function refreshProfile() {
    try {
      const { data } = await api.get(PROFILE_ENDPOINT);
      setProfile(data || null);
      if (data?.logo) localStorage.setItem("profile_logo", data.logo);
      else localStorage.removeItem("profile_logo");
    } catch {/* ignore */}
  }

  async function saveLogo(e) {
    e.preventDefault();
    setError(""); setNote("");
    if (!logoFile) return setError("Pick an image first.");

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append(FILE_FIELD, logoFile, logoFile.name); // why: boundary set by Axios
      await api.request({ url: PROFILE_ENDPOINT, method: UPLOAD_METHOD, data: fd });
      await refreshProfile();
      setLogoFile(null);
      setNote("Logo saved.");
    } catch (e2) {
      setError(readServerError(e2, "Failed to save logo"));
    } finally {
      setSaving(false);
    }
  }

  async function removeLogo() {
    setError(""); setNote(""); setRemoving(true);
    try {
      // a) JSON null (typical)
      let removed = false;
      try {
        await api.request({
          url: PROFILE_ENDPOINT,
          method: "PATCH",
          headers: { "Content-Type": "application/json" }, // why: explicit JSON for null clear
          data: { [FILE_FIELD]: null }
        });
        removed = true;
      } catch (eA) {
        const codeA = eA?.response?.status;
        if (![400, 404, 405, 415, 422].includes(codeA)) throw eA;
        // b) Multipart empty
        try {
          const fd = new FormData();
          fd.append(FILE_FIELD, "");
          await api.request({ url: PROFILE_ENDPOINT, method: "PATCH", data: fd });
          removed = true;
        } catch (eB) {
          const codeB = eB?.response?.status;
          if (![400, 404, 405, 415, 422].includes(codeB)) throw eB;
          // c) Common DELETE subroutes
          const base = PROFILE_ENDPOINT.endsWith("/") ? PROFILE_ENDPOINT : PROFILE_ENDPOINT + "/";
          const tries = [`${base}logo/`, `${base}${FILE_FIELD}/`];
          for (const del of tries) {
            try { await api.delete(del); removed = true; break; } catch {/* keep trying */}
          }
          if (!removed) throw eB;
        }
      }
      await refreshProfile();
      setNote("Logo removed.");
    } catch (e) {
      setError(readServerError(e, "Failed to remove logo"));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Banner under top nav */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-2 text-sm font-medium text-slate-600">Profile Logo</div>
        {bannerUrl ? (
          <div className="flex items-center gap-6">
            <img src={bannerUrl} alt="Profile logo" className="h-20 w-20 rounded-xl object-cover" />
            <div className="text-sm text-slate-600">
              <code>{UPLOAD_METHOD} {PROFILE_ENDPOINT}</code> · field <code>{FILE_FIELD}</code>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            No logo yet — upload one below.
          </div>
        )}
      </div>

      <h2 className="mb-3 text-2xl font-bold">Edit Profile</h2>

      <form onSubmit={saveLogo} className="max-w-xl space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Upload Logo</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onPick(e.target.files?.[0] || null)}
            className="block w-full rounded-xl border border-slate-300 px-3 py-2"
          />
          <div className="mt-2 text-xs text-slate-500">PNG/JPG up to 5MB.</div>
        </div>

        <div className="mt-3 flex flex-wrap gap-3">
          <button
            disabled={saving}
            className="inline-flex items-center rounded-xl bg-gray-400 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Logo"}
          </button>

          <button
            type="button"
            onClick={removeLogo}
            disabled={removing}
            className="inline-flex items-center rounded-xl bg-rose-600 px-4 py-2 text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {removing ? "Removing…" : "Remove Logo"}
          </button>
        </div>

        {note && <div className="text-sm text-emerald-700">{note}</div>}
        {error && <div className="text-sm text-rose-600">{error}</div>}
      </form>
    </div>
  );
}
