// =======================================
// file: frontend/src/pages/FindLocalWork.jsx
// "Find Local Work" page
// Shows ONLY published PUBLIC job postings (via backend endpoint)
// + Adds new/open bid badge on each job post card
// =======================================
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Badge, SymbolIcon } from "../ui";
import {
  getCachedLocationOrigin,
  formatDistanceMiles,
  locationParams,
  requestLocationOrigin,
} from "../utils/locationOrigin";

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
  const [locationOrigin, setLocationOrigin] = useState(getCachedLocationOrigin);
  const [filters, setFilters] = useState({
    name: "",
    location: "",
    minSqf: "",
    maxSqf: "",
    minBudget: "",
    maxBudget: "",
  });
  const [activeSearchField, setActiveSearchField] = useState("name");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let alive = true;
    requestLocationOrigin().then((origin) => {
      if (alive && origin) setLocationOrigin(origin);
    });
    return () => {
      alive = false;
    };
  }, []);

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
        const { data } = await api.get("/projects/job-postings/", {
          params: locationParams(locationOrigin),
        });
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
  }, [locationOrigin]);

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

  const activeFilterBadges = useMemo(() => {
    const badges = [];
    const trimmedName = filters.name.trim();
    const trimmedLocation = filters.location.trim();

    if (trimmedName) {
      badges.push({
        key: "name",
        label: `Project name: ${trimmedName}`,
        clear: () => setFilters((prev) => ({ ...prev, name: "" })),
      });
    }
    if (trimmedLocation) {
      badges.push({
        key: "location",
        label: `Location: ${trimmedLocation}`,
        clear: () => setFilters((prev) => ({ ...prev, location: "" })),
      });
    }
    if (filters.minSqf || filters.maxSqf) {
      const value =
        filters.minSqf && filters.maxSqf
          ? `${filters.minSqf} - ${filters.maxSqf}`
          : filters.minSqf
          ? `${filters.minSqf}+`
          : `up to ${filters.maxSqf}`;
      badges.push({
        key: "sqf",
        label: `Sqf: ${value}`,
        clear: () =>
          setFilters((prev) => ({ ...prev, minSqf: "", maxSqf: "" })),
      });
    }
    if (filters.minBudget || filters.maxBudget) {
      const value =
        filters.minBudget && filters.maxBudget
          ? `$${filters.minBudget} - $${filters.maxBudget}`
          : filters.minBudget
          ? `$${filters.minBudget}+`
          : `up to $${filters.maxBudget}`;
      badges.push({
        key: "budget",
        label: `Budget: ${value}`,
        clear: () =>
          setFilters((prev) => ({ ...prev, minBudget: "", maxBudget: "" })),
      });
    }

    return badges;
  }, [filters]);

  const hasActiveFilters = activeFilterBadges.length > 0;

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
    <div>
      {/* Hero header - full viewport width background */}
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen bg-[#F5F3EF] pb-6 pt-8">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Find Local Work</h1>
            <p className="mt-2 text-slate-500">Browse published job postings from homeowners in your area</p>
          </header>

          {/* Search bar - translucent */}
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SymbolIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400" />
              <input
                type="text"
                value={filters.name}
                onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Search jobs by name, category, or location..."
                className="h-11 w-full rounded-xl border-0 bg-white/80 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              aria-expanded={showFilters}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <SymbolIcon name="tune" className="text-[18px]" />
              Filters
            </button>
            <button
              type="button"
              disabled={!hasActiveFilters}
              onClick={clearFilters}
              className={
                "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition " +
                (hasActiveFilters
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "border border-slate-200 bg-white text-slate-400 cursor-not-allowed")
              }
            >
              Clear filters
            </button>
          </div>

          {showFilters ? (
            <div className="mb-6 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md">
              <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Search by
                  </span>
                  <select
                    value={activeSearchField}
                    onChange={(e) => setActiveSearchField(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  >
                    <option value="name">Project name</option>
                    <option value="location">Location</option>
                    <option value="sqf">Sqf</option>
                    <option value="budget">Budget</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {activeSearchLabel}
                  </span>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input
                      type={activeSearchField === "sqf" || activeSearchField === "budget" ? "number" : "text"}
                      value={activeSearchValue}
                      onChange={updateActiveSearch}
                      placeholder={activeSearchPlaceholder}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    />
                    {activeSearchField === "sqf" ? (
                      <input
                        type="number"
                        value={filters.maxSqf}
                        onChange={(e) => setFilters((prev) => ({ ...prev, maxSqf: e.target.value }))}
                        placeholder="Maximum sqf"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      />
                    ) : null}
                    {activeSearchField === "budget" ? (
                      <input
                        type="number"
                        value={filters.maxBudget}
                        onChange={(e) => setFilters((prev) => ({ ...prev, maxBudget: e.target.value }))}
                        placeholder="Maximum budget"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                      />
                    ) : null}
                  </div>
                </label>

                <button
                  type="button"
                  disabled={!hasActiveFilters}
                  onClick={clearFilters}
                  className={
                    "inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-medium transition " +
                    (hasActiveFilters
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "border border-slate-200 bg-white text-slate-400 cursor-not-allowed")
                  }
                >
                  Clear filters
                </button>
              </div>

              {activeFilterBadges.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeFilterBadges.map((badge) => (
                    <button
                      key={badge.key}
                      type="button"
                      onClick={badge.clear}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      {badge.label}
                      <SymbolIcon name="close" className="text-[14px]" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Category pills - translucent container */}
          <div className="rounded-2xl border border-white/60 bg-white/50 p-3 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearFilters}
                className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium transition ${
                  !hasActiveFilters
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-white/80 text-slate-600 hover:bg-white"
                }`}
              >
                All
              </button>
              {["Flooring", "Building", "Painting", "Concrete", "Landscaping", "Plumbing", "Electrical", "Cleaning"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilters((prev) => ({ ...prev, name: cat }))}
                  className={`inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium transition ${
                    filters.name.toLowerCase() === cat.toLowerCase()
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white/80 text-slate-600 hover:bg-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="py-6">
        {loading && <p className="text-sm text-slate-500">Loading jobs...</p>}

        {error && !loading && <p className="text-sm text-red-600">{error}</p>}

        {!loading && !error && projects.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-10 text-center text-sm text-slate-500 backdrop-blur-md">
            No job postings found yet. Check back soon.
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <>
            {/* Results count */}
            <p className="mb-4 text-sm text-slate-500">
              Showing <span className="font-medium text-slate-700">{filteredProjects.length}</span> of {projects.length} projects
            </p>

            {filteredProjects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-10 text-center text-sm text-slate-500 backdrop-blur-md">
                No job postings match those filters.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((p) => {
                  const coverSrc = pickCover(p);
                const distanceLabel = formatDistanceMiles(p.distance_miles);
                const meta = bidMeta?.[p.id] || {
                  totalCount: 0,
                  openCount: 0,
                  hasNewBid: false,
                };

                return (
                  <Link
                    key={p.id}
                    to={`/projects/${p.id}`}
                    className="group overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-md transition hover:shadow-md"
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
                        <Badge className="bg-slate-800 text-[11px] font-semibold text-white">
                          Job posting
                        </Badge>
                        {meta.hasNewBid ? (
                          <div className="relative inline-flex h-[22px] items-center pl-3">
                            <div className="absolute left-0 top-1/3 z-100 flex h-[22px] w-[22px] -translate-y-1/2 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold leading-none text-white shadow-sm">
                              {meta.openCount}
                            </div>

                            <div className="rounded-full border border-emerald-600 bg-white px-3 py-1 text-[11px] font-medium text-emerald-700 shadow-sm">
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
                        {distanceLabel ? (
                          <>
                            <span className="mx-1 text-slate-300">•</span>
                            <span className="font-semibold text-slate-600">{distanceLabel}</span>
                          </>
                        ) : null}
                      </div>

                      {(p.job_summary || p.summary) && (
                        <div className="mt-2 line-clamp-2 text-xs text-slate-600">
                          {p.job_summary || p.summary}
                        </div>
                      )}

                      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
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
    </div>
  );
}
