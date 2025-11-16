// =========================================
// file: frontend/src/pages/ProjectDetail.jsx
// =========================================
import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import {
  getLocalImages,
  addLocalImages,
  filesToDataURLs,
  removeLocalImage,
  dataURLToBlob,
  willExceed,
  MAX_LOCAL_BYTES,
  setLocalImages,
} from "../lib/localGallery";

function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/,"");
  const originish = base.replace(/\/api\/?$/,"");
  return raw.startsWith("/") ? `${originish}${raw}` : `${originish}/${raw}`;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [serverImages, setServerImages] = useState([]); // [{url, caption?}]
  const [localImages, setLocalImagesState] = useState([]);   // [{url, caption}]
  const [merged, setMerged] = useState([]);                  // local + server
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  // add-local form
  const [picked, setPicked] = useState([]); // [{name, url, caption}]
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ data: meta }, { data: imgs }] = await Promise.all([
          api.get(`/projects/${id}/`),
          api.get(`/projects/${id}/images/`),
        ]);
        if (!alive) return;
        setProject(meta || null);
        const urls = (imgs || [])
          .map((x) => ({
            url: toUrl(x.url || x.image || x.src || x.file),
            caption: x.caption || "",
          }))
          .filter((x) => !!x.url);
        setServerImages(urls);
        setLocalImagesState(getLocalImages(id));
      } catch {
        if (alive) {
          setProject(null);
          setServerImages([]);
          setLocalImagesState(getLocalImages(id));
        }
      }
    })();
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    setMerged([...(localImages || []), ...(serverImages || [])]);
  }, [serverImages, localImages]);

  const next = useCallback(() => setIdx((i) => (merged.length ? (i + 1) % merged.length : 0)), [merged.length]);
  const prev = useCallback(() => setIdx((i) => (merged.length ? (i - 1 + merged.length) % merged.length : 0)), [merged.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, next, prev]);

  async function onPick(e) {
    setMsg("");
    const files = e.target.files || [];
    const asData = await filesToDataURLs(files);
    const urls = asData.map((x) => x.url);

    if (willExceed(id, urls)) {
      setMsg(`Adding these exceeds ${(MAX_LOCAL_BYTES/1024/1024).toFixed(0)}MB local limit. Remove some or pick fewer.`);
      return;
    }
    setPicked(asData.map((x) => ({ ...x, caption: "" })));
  }

  function updatePickedCaption(i, v) {
    setPicked((prev) => prev.map((it, idx) => (idx === i ? { ...it, caption: v } : it)));
  }

  async function saveToLocal() {
    if (!picked.length) return;
    setBusy(true); setMsg("");
    try {
      const res = addLocalImages(id, picked.map((x) => ({ url: x.url, caption: x.caption || "" })));
      if (!res.ok) {
        setMsg(res.message || "Could not save locally.");
        return;
      }
      setLocalImagesState(getLocalImages(id));
      setPicked([]);
      setMsg("Saved locally.");
      setTimeout(() => setMsg(""), 1500);
    } finally {
      setBusy(false);
    }
  }

  function onRemoveLocal(url) {
    removeLocalImage(id, url);
    setLocalImagesState(getLocalImages(id));
  }

  async function publishToServer() {
    // Only local images are published; server ones already exist
    if (!localImages.length) {
      setMsg("No local images to publish.");
      return;
    }
    setBusy(true); setMsg("");
    try {
      const fd = new FormData();
      localImages.forEach((it) => {
        // Convert dataURL to Blob; give a simple filename
        const blob = dataURLToBlob(it.url);
        const ext = (blob.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "");
        const fname = `local-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        fd.append("images", blob, fname);
      });
      localImages.forEach((it) => fd.append("captions", it.caption || ""));

      const { data } = await api.post(`/projects/${id}/images/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Clear local and refresh from server response
      setLocalImages(id, []); // storage clear
      setLocalImagesState([]); // state clear
      const urls = (data || []).map((x) => ({
        url: toUrl(x.url || x.image || x.src || x.file),
        caption: x.caption || "",
      }));
      setServerImages(urls);
      setMsg("Published to server.");
      setTimeout(() => setMsg(""), 1500);
    } catch (e) {
      setMsg(
        e?.response?.data
          ? `Publish failed: ${JSON.stringify(e.response.data)}`
          : `Publish failed: ${String(e)}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{project?.title || `Project #${id}`}</h2>
          {project?.summary && <div className="text-slate-600 text-sm">{project.summary}</div>}
        </div>
        <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">← Back</Link>
      </div>

      {/* LOCAL ADD: saved in browser only */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-2 font-semibold text-slate-700">Add Local Images (browser only)</div>
        <input type="file" multiple accept="image/*" onChange={onPick} className="mb-3 block w-full rounded-xl border p-2" />
        {picked.length > 0 && (
          <div className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {picked.map((it, i) => (
              <div key={i} className="rounded-xl border border-slate-200 p-3 bg-white">
                <img src={it.url} alt="" className="mb-2 h-36 w-full rounded-md object-cover" />
                <input
                  className="w-full rounded-lg border border-slate-300 px-2 py-1"
                  placeholder="Caption…"
                  value={it.caption}
                  onChange={(e) => updatePickedCaption(i, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={saveToLocal}
            disabled={busy || picked.length === 0}
            className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-60"
          >
            Save to Browser
          </button>
          <button
            onClick={publishToServer}
            disabled={busy || localImages.length === 0}
            className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-60"
            title="Uploads your local images to the server"
          >
            Publish to Server
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Local storage limit: {(MAX_LOCAL_BYTES/1024/1024).toFixed(0)}MB. Publishing sends images to the backend and clears the local copies.
        </div>
        {msg && <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">{msg}</div>}
      </div>

      {/* MERGED GALLERY */}
      {merged.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-6 text-center text-slate-600">No media found.</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {merged.map((img, i) => {
            const isLocal = !!localImages.find((x) => x.url === img.url);
            return (
              <figure key={img.url + i} className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button type="button" onClick={() => { setIdx(i); setOpen(true); }} className="block w-full">
                  <img src={img.url} alt="" className="block h-[160px] w-full object-cover transition-transform group-hover:scale-[1.02]" />
                </button>
                {img.caption && <figcaption className="px-3 py-2 text-sm text-slate-700">{img.caption}</figcaption>}
                {isLocal && (
                  <button
                    type="button"
                    onClick={() => onRemoveLocal(img.url)}
                    className="absolute right-2 top-2 rounded-lg border border-slate-200 bg-white/90 px-2 py-1 text-xs text-slate-700 hover:bg-white"
                    title="Remove local image"
                  >
                    Remove
                  </button>
                )}
              </figure>
            );
          })}
        </div>
      )}

      {open && merged[idx] && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(false)}>
          <div className="relative flex max-h-[85vh] max-w-[90vw] items-center justify-center" onClick={(e)=>e.stopPropagation()}>
            <button type="button" onClick={prev} aria-label="Prev" className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full rounded-full border border-white/40 px-3 py-1 text-white/90">‹</button>
            <img src={merged[idx].url} alt="" className="h-[360px] max-h-[80vh] w-auto max-w-[90vw] rounded-xl bg-black/40 shadow-2xl" style={{objectFit:"contain"}}/>
            {merged[idx].caption && <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-sm text-white">{merged[idx].caption}</div>}
            <button type="button" onClick={next} aria-label="Next" className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full rounded-full border border-white/40 px-3 py-1 text-white/90">›</button>
            <button type="button" onClick={()=>setOpen(false)} aria-label="Close" className="absolute -right-4 -top-4 rounded-full border border-white/40 px-2 py-1 text-white/90">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}