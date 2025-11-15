// file: src/pages/ProjectGallery.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";

// Helper: make relative media paths absolute based on api.baseURL
function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/,"");
  // If base is like http://host/api/, strip trailing /api to get host for media
  const originish = base.replace(/\/api\/?$/,"");
  if (raw.startsWith("/")) return `${originish}${raw}`;
  return `${originish}/${raw}`;
}

export default function ProjectGallery() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [images, setImages] = useState([]);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

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
          .map((it) => (typeof it === "string" ? it : it?.url || it?.src || it?.image || it?.file || ""))
          .filter(Boolean)
          .map(toUrl);
        setImages(urls);
      } catch {
        setProject(null);
        setImages([]);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  const next = useCallback(() => setIdx((i) => (images.length ? (i + 1) % images.length : 0)), [images.length]);
  const prev = useCallback(() => setIdx((i) => (images.length ? (i - 1 + images.length) % images.length : 0)), [images.length]);

  // keyboard nav in modal
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

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold">{project?.title || "Project"}</h2>
        <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">← Back to Explore</Link>
      </div>

      {project?.summary && <p className="mb-4 text-slate-700">{project.summary}</p>}
      <div className="mb-6 text-sm text-slate-600">{project?.owner_username && <>by {project.owner_username}</>}</div>

      {images.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-6 text-center text-slate-600">
          No media found for this project.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {images.map((src, i) => (
            <button
              key={src + i}
              type="button"
              onClick={() => { setIdx(i); setOpen(true); }}
              className="group overflow-hidden rounded-xl border border-slate-200 bg-white"
              aria-label={`Open image ${i + 1}`}
            >
              <img
                src={src}
                alt={`image ${i + 1}`}
                className="block h-[160px] w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              />
            </button>
          ))}
        </div>
      )}

      {open && images[idx] && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="relative flex max-h-[85vh] max-w-[90vw] items-center justify-center" onClick={(e)=>e.stopPropagation()}>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous"
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full rounded-full border border-white/40 px-3 py-1 text-white/90 hover:text-white"
            >‹</button>

            <img
              src={images[idx]}
              alt={`large ${idx + 1}`}
              className="h-[320px] max-h-[80vh] w-auto max-w-[90vw] rounded-xl bg-black/50 shadow-2xl"
              style={{ objectFit: "contain" }}
            />

            <button
              type="button"
              onClick={next}
              aria-label="Next"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full rounded-full border border-white/40 px-3 py-1 text-white/90 hover:text-white"
            >›</button>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute -right-4 -top-4 rounded-full border border-white/40 px-2 py-1 text-white/90 hover:text-white"
            >✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

