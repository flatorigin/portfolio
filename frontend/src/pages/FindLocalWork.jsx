// =======================================
// file: frontend/src/pages/FindLocalWork.jsx
// "Find Local Work" page
// Shows ONLY published PUBLIC job postings (via backend endpoint)
// =======================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Badge } from "../ui";

function toUrl(raw) {
  if (!raw) return "";
  if (/^(data:|blob:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

function pickCover(p) {
  return toUrl(p?.cover_image_url || "") || toUrl(p?.cover_image || "") || "";
}

export default function FindLocalWork() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const { data } = await api.get("/projects/job-postings/");
        if (cancelled) return;

        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
          ? data.results
          : [];

        const onlyPublicJobs = arr.filter(
          (p) => !!p?.is_job_posting && (p?.is_public === undefined || p?.is_public === true)
        );

        setProjects(onlyPublicJobs);
      } catch (err) {
        console.error("[FindLocalWork] load error", err?.response || err);
        if (!cancelled) {
          setError("Could not load job postings.");
          setProjects([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Find Local Work
          </h1>
          <p className="text-sm text-slate-600">
            Browse published <span className="font-medium">job postings</span>.
          </p>
        </div>
        <Link to="/" className="text-xs text-slate-600 hover:text-slate-900">
          ← Back to Explore
        </Link>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading jobs…</p>}

      {error && !loading && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && projects.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-600">
          No job postings found yet. Check back soon.
        </div>
      )}

      {!loading && !error && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const coverSrc = pickCover(p);

            return (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="relative h-44 bg-slate-100">
                  {coverSrc ? (
                    <img
                      src={coverSrc}
                      alt={p.title || "job cover"}
                      className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.png";
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
                      No image
                    </div>
                  )}

                  <div className="absolute left-3 top-3">
                    <Badge className="bg-emerald-600/95 text-[11px] font-semibold text-emerald-50">
                      Job posting
                    </Badge>
                  </div>
                </div>

                <div className="p-4">
                  <div className="truncate text-sm font-semibold text-slate-900">
                    {p.title || `Job #${p.id}`}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    {p.owner_username && <span>by {p.owner_username}</span>}
                    {p.location && (
                      <>
                        <span className="mx-1 text-slate-300">•</span>
                        <span>{p.location}</span>
                      </>
                    )}
                  </div>

                  {(p.job_summary || p.summary) && (
                    <div className="mt-2 line-clamp-2 text-xs text-slate-600">
                      {p.job_summary || p.summary}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}