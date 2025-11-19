import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import { Badge, Card } from "../ui";

function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/,"");
  const origin = base.replace(/\/api\/?$/,"");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [images, setImages] = useState([]);
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  const fetchAll = useCallback(async () => {
    const [{ data: meta }, { data: imgs }] = await Promise.all([
      api.get(`/projects/${id}/`),
      api.get(`/projects/${id}/images/`),
    ]);
    setProject(meta || null);
    setImages(
      (imgs || [])
        .map((x) => ({
          url: toUrl(x.url || x.image || x.src || x.file),
          caption: x.caption || "",
        }))
        .filter((x) => !!x.url)
    );
  }, [id]);

  useEffect(() => {
    fetchAll().catch(() => { setProject(null); setImages([]); });
  }, [fetchAll]);

  const next = useCallback(() => setIdx((i) => (images.length ? (i + 1) % images.length : 0)), [images.length]);
  const prev = useCallback(() => setIdx((i) => (images.length ? (i - 1 + images.length) % images.length : 0)), [images.length]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm text-slate-500">
            <Link to="/" className="hover:underline">Explore</Link> <span className="mx-1">/</span> Project
          </div>
          <h1 className="truncate text-2xl font-bold text-slate-900">
            {project?.title || `Project #${id}`}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {project?.category ? <Badge>{project.category}</Badge> : null}
            {project?.owner_username && <span>by {project.owner_username}</span>}
          </div>
        </div>
        <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">← Back</Link>
      </div>

      {project?.summary && <p className="mb-4 text-slate-700">{project.summary}</p>}

      {/* meta grid */}
      {(project?.location || project?.budget || project?.sqf || project?.highlights) && (
        <Card className="mb-5 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 text-sm text-slate-700">
            {project?.location ? <div><span className="opacity-60">Location:</span> {project.location}</div> : null}
            {project?.budget ? <div><span className="opacity-60">Budget:</span> {project.budget}</div> : null}
            {project?.sqf ? <div><span className="opacity-60">Sq Ft:</span> {project.sqf}</div> : null}
            {project?.highlights ? <div className="md:col-span-4"><span className="opacity-60">Highlights:</span> {project.highlights}</div> : null}
          </div>
        </Card>
      )}

      {images.length === 0 ? (
        <div className="rounded-xl border border-slate-200 p-6 text-center text-slate-600">No media found.</div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {images.map((img, i) => (
            <figure key={img.url + i} className="group overflow-hidden rounded-xl border border-slate-200 bg-white">
              <button type="button" onClick={() => { setIdx(i); setOpen(true); }} className="block w-full">
                <img src={img.url} alt="" className="block h-[160px] w-full object-cover transition-transform group-hover:scale-[1.02]" />
              </button>
              {img.caption && <figcaption className="px-3 py-2 text-sm text-slate-700">{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {open && images[idx] && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setOpen(false)}>
          <div className="relative flex max-h-[85vh] max-w-[90vw] items-center justify-center" onClick={(e)=>e.stopPropagation()}>
            <button type="button" onClick={prev} aria-label="Prev" className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full rounded-full border border-white/40 px-3 py-1 text-white/90">‹</button>
            <img src={images[idx].url} alt="" className="h-[360px] max-h-[80vh] w-auto max-w-[90vw] rounded-xl bg-black/40 shadow-2xl" style={{objectFit:"contain"}}/>
            {images[idx].caption && <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-sm text-white">{images[idx].caption}</div>}
            <button type="button" onClick={next} aria-label="Next" className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full rounded-full border border-white/40 px-3 py-1 text-white/90">›</button>
            <button type="button" onClick={()=>setOpen(false)} aria-label="Close" className="absolute -right-4 -top-4 rounded-full border border-white/40 px-2 py-1 text-white/90">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}