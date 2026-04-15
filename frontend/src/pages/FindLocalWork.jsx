// =======================================
// file: frontend/src/pages/FindLocalWork.jsx
// "Find Local Work" page
// Shows ONLY published PUBLIC job postings (via backend endpoint)
// + Adds new/open bid badge on each job post card
// =======================================
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Badge } from "../ui";

function toUrl(raw) {
  if (!raw) return "";
  const value = String(raw).trim();

  if (/^(data:|blob:)/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;

  const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
  const isAllowedProtocol = /^(https?:|data:|blob:|mailto:)/i.test(value);
  if (hasProtocol && !isAllowedProtocol) return "";

  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
}

function pickCover(p) {
  return toUrl(p?.cover_image_url || "") || toUrl(p?.cover_image || "") || "";
}

function getBidSummaryMeta(bids) {
  const list = Array.isArray(bids) ? bids : [];

  const openStatuses = new Set(["pending", "revision_requested"]);
  const closedStatuses = new Set(["accepted", "declined", "withdrawn"]);

  let openCount = 0;
  const totalCount = list.length;
  let latestCreatedAt = null;

  for (const bid of list) {
    const latest = bid?.latest_version || {};
    const status = String(latest.status || bid?.status || "").toLowerCase();

    if (openStatuses.has(status)) openCount += 1;

    const createdAt =
      latest?.created_at ||
      bid?.updated_at ||
      bid?.created_at ||
      null;

    if (createdAt) {
      const ts = new Date(createdAt).getTime();
      if (Number.isFinite(ts) && (!latestCreatedAt || ts > latestCreatedAt)) {
        latestCreatedAt = ts;
      }
    }

    if (!status || (!openStatuses.has(status) && !closedStatuses.has(status))) {
      if (!closedStatuses.has(status)) openCount += 1;
    }
  }

  return {
    totalCount,
    openCount,
    hasNewBid: openCount > 0,
    latestCreatedAt,
  };
}

export default function FindLocalWork() {
  const [projects, setProjects] = useState([]);
  const [bidMeta, setBidMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingBidMeta, setLoadingBidMeta] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadBidMeta(projectsList) {
      if (!Array.isArray(projectsList) || projectsList.length === 0) {
        if (!cancelled) setBidMeta({});
        return;
      }

      setLoadingBidMeta(true);
      try {
        const entries = await Promise.all(
          projectsList.map(async (p) => {
            try {
              const { data } = await api.get(`/projects/${p.id}/bids/`);
              return [p.id, getBidSummaryMeta(data)];
            } catch (err) {
              console.warn(
                "[FindLocalWork] bid summary failed for project",
                p.id,
                err?.response || err
              );
              return [
                p.id,
                {
                  totalCount: 0,
                  openCount: 0,
                  hasNewBid: false,
                  latestCreatedAt: null,
                },
              ];
            }
          })
        );

        if (!cancelled) {
          setBidMeta(Object.fromEntries(entries));
        }
      } finally {
        if (!cancelled) setLoadingBidMeta(false);
      }
    }

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
          (p) =>
            !!p?.is_job_posting &&
            (p?.is_public === undefined || p?.is_public === true)
        );

        setProjects(onlyPublicJobs);
        await loadBidMeta(onlyPublicJobs);
      } catch (err) {
        console.error("[FindLocalWork] load error", err?.response || err);
        if (!cancelled) {
          setError("Could not load job postings.");
          setProjects([]);
          setBidMeta({});
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
    <div className="py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Find Local Work
          </h1>
          <p className="text-sm text-slate-600">
            Browse published <span className="font-medium">job postings</span>.
          </p>
        </div>
        <Link to="/explore" className="text-xs text-slate-600 hover:text-slate-900">
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
            const meta = bidMeta?.[p.id] || {
              totalCount: 0,
              openCount: 0,
              hasNewBid: false,
            };

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

                  <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                    <Badge className="bg-emerald-600/95 text-[11px] font-semibold text-emerald-50">
                      Job posting
                    </Badge>
                    {meta.hasNewBid ? (
                      <div className="relative inline-flex h-[22px] items-center pl-3">
                        <div className="absolute left-0 top-1/3 z-100 flex h-[22px] w-[22px] -translate-y-1/2 items-center justify-center rounded-full bg-[#4A3CFF] text-[11px] font-semibold leading-none text-white shadow-[0_6px_14px_rgba(74,60,255,0.28)]">
                          {meta.openCount}
                        </div>

                        <div className="rounded-full border border-indigo-600 bg-white px-3 py-1 text-[11px] font-medium text-indigo-600 shadow-sm">
                          New Bid
                        </div>
                      </div>
                    ) : null}
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

                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <div className="text-slate-600">
                        <span className="font-medium text-slate-800">
                          {loadingBidMeta && bidMeta[p.id] === undefined
                            ? "—"
                            : meta.totalCount}
                        </span>{" "}
                        total bid{meta.totalCount === 1 ? "" : "s"}
                      </div>

                      <div
                        className={
                          "font-medium " +
                          (meta.openCount > 0
                            ? "text-emerald-700"
                            : "text-slate-500")
                        }
                      >
                        {loadingBidMeta && bidMeta[p.id] === undefined
                          ? "Loading…"
                          : meta.openCount > 0
                          ? `${meta.openCount} open`
                          : "No open bids"}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
