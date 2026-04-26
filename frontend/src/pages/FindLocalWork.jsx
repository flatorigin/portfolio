// =======================================
// file: frontend/src/pages/FindLocalWork.jsx
// "Find Local Work" page
// Shows ONLY published PUBLIC job postings (via backend endpoint)
// + Adds new/open bid badge on each job post card
// =======================================
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Badge, Button, Card } from "../ui";

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
  const [filters, setFilters] = useState({
    name: "",
    location: "",
    minSqf: "",
    maxSqf: "",
    minBudget: "",
    maxBudget: "",
  });
  const [activeSearchField, setActiveSearchField] = useState("name");

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

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const name = (p.title || "").toLowerCase();
      const loc = (p.location || "").toLowerCase();
      const sqf = Number(p.sqf ?? 0) || 0;
      const budget = Number(p.budget ?? 0) || 0;

      if (filters.name.trim() && !name.includes(filters.name.toLowerCase().trim()))
        return false;

      if (
        filters.location.trim() &&
        !loc.includes(filters.location.toLowerCase().trim())
      )
        return false;

      if (filters.minSqf !== "" && sqf < Number(filters.minSqf)) return false;
      if (filters.maxSqf !== "" && sqf > Number(filters.maxSqf)) return false;

      if (filters.minBudget !== "" && budget < Number(filters.minBudget)) return false;
      if (filters.maxBudget !== "" && budget > Number(filters.maxBudget)) return false;

      return true;
    });
  }, [projects, filters]);

  const clearFilters = () => {
    setFilters({
      name: "",
      location: "",
      minSqf: "",
      maxSqf: "",
      minBudget: "",
      maxBudget: "",
    });
  };

  const activeSearchValue =
    activeSearchField === "name"
      ? filters.name
      : activeSearchField === "location"
      ? filters.location
      : activeSearchField === "sqf"
      ? filters.minSqf
      : filters.minBudget;

  const activeSearchLabel =
    activeSearchField === "name"
      ? "Project name"
      : activeSearchField === "location"
      ? "Location"
      : activeSearchField === "sqf"
      ? "Sqf"
      : "Budget";

  const activeSearchPlaceholder =
    activeSearchField === "name"
      ? "Kitchen remodel"
      : activeSearchField === "location"
      ? "City, area, etc."
      : activeSearchField === "sqf"
      ? "Minimum sqf"
      : "Minimum budget";

  const updateActiveSearch = (e) => {
    const value = e.target.value;
    setFilters((prev) => {
      if (activeSearchField === "name") return { ...prev, name: value };
      if (activeSearchField === "location") return { ...prev, location: value };
      if (activeSearchField === "sqf") return { ...prev, minSqf: value, maxSqf: "" };
      return { ...prev, minBudget: value, maxBudget: "" };
    });
  };

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
        <>
          <Card className="mb-4 p-4">
            <div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-44">
                  <div className="mb-1 text-xs font-medium text-slate-500">
                    Search by
                  </div>

                  <div className="relative">
                    <select
                      value={activeSearchField}
                      onChange={(e) => setActiveSearchField(e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-300 bg-white px-3 pr-10 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="name">Project name</option>
                      <option value="location">Location</option>
                      <option value="sqf">Sqf</option>
                      <option value="budget">Budget</option>
                    </select>

                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="min-w-[280px] flex-1">
                  <div className="mb-1 text-xs font-medium text-slate-500">
                    Search project
                  </div>
                  <div className="flex h-10 w-full items-center rounded-xl border border-slate-300 bg-white px-3 shadow-sm focus-within:border-slate-500 focus-within:ring-2 focus-within:ring-slate-200">
                    <span className="mr-1 shrink-0 whitespace-nowrap text-sm font-semibold text-slate-700">
                      {activeSearchLabel}:
                    </span>
                    <input
                      type={
                        activeSearchField === "sqf" ||
                        activeSearchField === "budget"
                          ? "number"
                          : "text"
                      }
                      inputMode={
                        activeSearchField === "sqf" ||
                        activeSearchField === "budget"
                          ? "numeric"
                          : "text"
                      }
                      value={activeSearchValue}
                      onChange={updateActiveSearch}
                      placeholder={activeSearchPlaceholder}
                      className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={clearFilters}
                  className="h-10 whitespace-nowrap"
                >
                  Clear filters
                </Button>
              </div>

              <div className="mt-2 text-xs text-slate-500">
                Showing {filteredProjects.length} of {projects.length} projects
              </div>
            </div>
          </Card>

          {filteredProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-600">
              No job postings match those filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((p) => {
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
                        <Badge className="bg-[#47576B] text-[11px] font-semibold text-white">
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
        </>
      )}
    </div>
  );
}
