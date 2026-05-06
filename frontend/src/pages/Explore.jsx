// =======================================
// file: frontend/src/pages/Explore.jsx
// Uses ProjectImage.order to choose the cover (order=0)
// + Favorites (Save button) for other users' projects
// Favorites reactive; projects stable.
// =======================================
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { SectionTitle, Badge, Card, Button, Input, GhostButton, SymbolIcon } from "../ui";
import ReportContentButton from "../components/ReportContentButton";

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm)(?:$|[?#])/i;

// normalize urls (same spirit as ProjectDetail)
function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

function extractMediaUrl(it) {
  if (!it) return "";
  if (typeof it === "string") return toUrl(it);
  return toUrl(it.url || it.src || it.image || it.file || "");
}

function extractThumbUrl(it) {
  if (!it || typeof it === "string") return extractMediaUrl(it);
  return toUrl(it.thumbnail || it.thumb || "") || extractMediaUrl(it);
}

function extractOrder(it) {
  if (!it || typeof it === "string") return null;
  const raw = it.order ?? it.sort_order ?? null;
  return raw == null ? null : Number(raw);
}

function mediaTypeFor(it) {
  const url = extractMediaUrl(it);
  if (
    it?.media_type === "video" ||
    it?.mediaType === "video" ||
    VIDEO_EXTENSIONS.test(String(url))
  ) {
    return "video";
  }
  return "image";
}

function buildThumbPack(project) {
  const images = Array.isArray(project?.images)
    ? project.images
    : Array.isArray(project?.reference_gallery)
    ? project.reference_gallery
    : [];
  const mapped = images
    .map((it) => ({
      url: extractMediaUrl(it),
      thumb: extractThumbUrl(it),
      mediaType: mediaTypeFor(it),
      order: extractOrder(it),
    }))
    .filter((x) => !!x.url);
  const imageMapped = mapped.filter((x) => x.mediaType === "image");

  const cover =
    toUrl(project?.cover_image_url || "") ||
    imageMapped.find((x) => Number(x.order) === 0)?.url ||
    imageMapped[0]?.url ||
    null;

  return {
    cover,
    thumbs: mapped.slice(0, 3),
  };
}

// --- auth bridge ---
// Explore must re-render when auth changes (localStorage does not trigger React renders).
// We listen to both:
// 1) real "storage" events (other tabs)
// 2) a custom event your app can dispatch after login/logout
function readAuthSnapshot() {
  const access = localStorage.getItem("access") || "";
  const username = localStorage.getItem("username") || "";
  return { authed: !!access, username };
}

export default function Explore() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [directoryListings, setDirectoryListings] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ favorites state
  // favMap[projectId] = true/false
  const [favMap, setFavMap] = useState({});
  const [favBusyId, setFavBusyId] = useState(null);
  const [likeMap, setLikeMap] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [likeBusyId, setLikeBusyId] = useState(null);

  // 🔍 filter state
  const [filters, setFilters] = useState({
    name: "",
    location: "",
    minSqf: "",
    maxSqf: "",
    minBudget: "",
    maxBudget: "",
  });
  const [activeSearchField, setActiveSearchField] = useState("name");

  // ✅ reactive auth snapshot
  const [{ authed, username: me }, setAuthSnap] = useState(readAuthSnapshot);

  // Keep a ref so async callbacks can read latest values without re-binding everything
  const authRef = useRef({ authed, me });
  useEffect(() => {
    authRef.current = { authed, me };
  }, [authed, me]);

  // Listen for auth changes (same tab and other tabs)
  useEffect(() => {
    const sync = () => setAuthSnap(readAuthSnapshot());

    // other tabs
    window.addEventListener("storage", sync);

    // same tab: your app can dispatch this after login/logout
    window.addEventListener("auth:changed", sync);

    // You already dispatch favorites:changed; keep it, but also resync auth snapshot if needed
    // (harmless; some flows might update username/access together)
    window.addEventListener("favorites:changed", sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("auth:changed", sync);
      window.removeEventListener("favorites:changed", sync);
    };
  }, []);

  const isOwner = useCallback(
    (p) =>
      typeof p?.is_owner === "boolean"
        ? p.is_owner
        : (p?.owner_username || "") === (me || ""),
    [me]
  );

  // ✅ toggle favorite (save/unsave)
  const toggleFavorite = useCallback(
    async (e, p) => {
      e.preventDefault();
      e.stopPropagation();

      if (!authRef.current.authed || !p?.id) return;
      if (isOwner(p)) return;

      if (favBusyId === p.id) return;

      const currently = !!favMap[p.id];

      setFavBusyId(p.id);
      // optimistic update
      setFavMap((prev) => ({ ...prev, [p.id]: !currently }));

      try {
        if (currently) {
          await api.delete(`/projects/${p.id}/favorite/`);
        } else {
          await api.post(`/projects/${p.id}/favorite/`);
        }
        window.dispatchEvent(new CustomEvent("favorites:changed"));
      } catch (err) {
        console.error("[Explore] toggleFavorite failed", err?.response || err);
        // rollback
        setFavMap((prev) => ({ ...prev, [p.id]: currently }));

        const data = err?.response?.data;
        const msg =
          data?.detail ||
          data?.message ||
          err?.message ||
          "Could not update saved state. Please try again.";
        alert(typeof msg === "string" ? msg : JSON.stringify(msg));
      } finally {
        setFavBusyId(null);
      }
    },
    [favBusyId, favMap, isOwner]
  );

  const toggleLike = useCallback(
    async (e, p) => {
      e.preventDefault();
      e.stopPropagation();

      if (!authRef.current.authed || !p?.id) return;
      if (isOwner(p)) return;
      if (likeBusyId === p.id) return;

      const currently = !!likeMap[p.id];
      const prevCount = Number(likeCounts[p.id] ?? p.like_count ?? 0);

      setLikeBusyId(p.id);
      setLikeMap((prev) => ({ ...prev, [p.id]: !currently }));
      setLikeCounts((prev) => ({
        ...prev,
        [p.id]: Math.max(0, prevCount + (currently ? -1 : 1)),
      }));

      try {
        const { data } = currently
          ? await api.delete(`/projects/${p.id}/like/`)
          : await api.post(`/projects/${p.id}/like/`);

        setLikeMap((prev) => ({ ...prev, [p.id]: !!data?.liked }));
        if (data?.like_count !== undefined) {
          setLikeCounts((prev) => ({ ...prev, [p.id]: Number(data.like_count || 0) }));
        }
        window.dispatchEvent(new CustomEvent("projects:liked_changed"));
      } catch (err) {
        console.error("[Explore] toggleLike failed", err?.response || err);
        setLikeMap((prev) => ({ ...prev, [p.id]: currently }));
        setLikeCounts((prev) => ({ ...prev, [p.id]: prevCount }));

        const data = err?.response?.data;
        const msg = data?.detail || data?.message || err?.message || "Could not update like.";
        alert(typeof msg === "string" ? msg : JSON.stringify(msg));
      } finally {
        setLikeBusyId(null);
      }
    },
    [isOwner, likeBusyId, likeCounts, likeMap]
  );

 // 1) Load projects once (stable)
 useEffect(() => {
   let alive = true;
   setLoading(true);

	  (async () => {
	    try {
	      const [{ data }, { data: homeownerRefs }, { data: directoryData }] = await Promise.all([
	        api.get("/projects/"),
	        api.get("/profiles/homeowner-references/").catch(() => ({ data: [] })),
	        api.get("/business-directory/").catch(() => ({ data: [] })),
	      ]);
	      if (!alive) return;

       const arr = Array.isArray(data) ? data : [];

       // ✅ Explore = only PUBLIC + NOT job postings
       const exploreProjects = arr.filter(
         (p) =>
           (p?.is_public === undefined || p?.is_public === true) &&
           !p?.is_job_posting
       );

	      const referenceCards = (Array.isArray(homeownerRefs) ? homeownerRefs : []).map((profile) => ({
	        id: `homeowner-reference-${profile.username || profile.id}`,
	        _kind: "homeowner_reference_gallery",
	        title: `${profile.display_name || profile.username || "Homeowner"} reference gallery`,
	        summary: profile.bio || "Style and quality references shared by the homeowner.",
	        category: "Reference gallery",
	        location: profile.service_location || "",
	        owner_username: profile.username || "",
	        is_public: true,
	        is_job_posting: false,
	        cover_image_url: profile.cover_image_url || "",
	        images: Array.isArray(profile.reference_gallery) ? profile.reference_gallery : [],
	        reference_count: profile.reference_count || 0,
	        profile_url: `/profiles/${profile.username}`,
	      }));
	      const exploreItems = [...referenceCards, ...exploreProjects];

	      setProjects(exploreItems);
	      setDirectoryListings(Array.isArray(directoryData) ? directoryData : []);
	      setLikeCounts(
	        Object.fromEntries(
	          exploreItems.map((p) => [p.id, Number(p?.like_count || 0)])
	        )
	      );
	      setLikeMap(
	        Object.fromEntries(
	          exploreItems.map((p) => [p.id, !!p?.liked_by_me])
	        )
	      );
	     } catch (e) {
	       console.error("[Explore] projects fetch failed", e?.response || e);
	       if (alive) {
	         setProjects([]);
	         setDirectoryListings([]);
	       }
     } finally {
       if (alive) setLoading(false);
     }
   })();

   return () => {
     alive = false;
   };
	  }, []);

  // 2) Favorites reactive: update when authed changes (and when projects list changes)
  useEffect(() => {
    let alive = true;

    if (!projects.length) {
      setFavMap({});
      return;
    }

    if (!authed) {
      // logged out => clear favorites immediately
      setFavMap({});
      return;
    }

    (async () => {
      if (!alive) return;

      try {
        const { data } = await api.get("/favorites/projects/");
        if (!alive) return;

        const next = {};
        const favorites = Array.isArray(data) ? data : [];
        for (const fav of favorites) {
          const pid =
            fav?.project?.id ??
            fav?.project_id ??
            (typeof fav?.project === "number" ? fav.project : null);
          if (pid != null) next[pid] = true;
        }

        for (const project of projects) {
          if (project?.id != null && isOwner(project)) {
            next[project.id] = false;
          }
        }

        setFavMap(next);
      } catch {
        const next = {};
        for (const project of projects) {
          if (project?.id != null) next[project.id] = false;
        }
        setFavMap(next);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authed, projects, isOwner]);

  // 🔍 filter logic
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

  const filteredDirectoryListings = useMemo(() => {
    return directoryListings.filter((listing) => {
      const nameQuery = filters.name.toLowerCase().trim();
      const locationQuery = filters.location.toLowerCase().trim();
      const hasNumericFilters =
        filters.minSqf !== "" ||
        filters.maxSqf !== "" ||
        filters.minBudget !== "" ||
        filters.maxBudget !== "";

      if (locationQuery || hasNumericFilters) return false;
      if (!nameQuery) return true;

      const specialties = Array.isArray(listing.specialties) ? listing.specialties : [];
      const haystack = [
        listing.business_name,
        listing.phone_number,
        listing.website,
        ...specialties,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(nameQuery);
    });
  }, [directoryListings, filters]);

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

  if (loading) {
    return (
      <div>
        <header className="flex min-h-14 items-center mb-1">
          <SectionTitle className="!mb-0">Explore</SectionTitle>
        </header>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="overflow-hidden animate-pulse">
              <div className="h-40 bg-slate-200" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 rounded bg-slate-200" />
                <div className="h-3 w-full rounded bg-slate-200" />
                <div className="h-3 w-1/2 rounded bg-slate-200" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!projects.length && !directoryListings.length) {
    return (
      <div>
        <header className="flex min-h-14 items-center mb-1">
          <SectionTitle className="!mb-0">Explore</SectionTitle>
        </header>
        <Card className="p-6 text-center">
          <p className="text-slate-600">No projects yet.</p>
          {authed && (
            <div className="mt-3">
              <GhostButton onClick={() => navigate("/dashboard")}>
                Create your first project →
              </GhostButton>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <header className="flex min-h-14 items-center mb-1">
        <SectionTitle className="!mb-0">Explore</SectionTitle>
      </header>

      {/* 🔍 Filter bar */}
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

                {/* Custom arrow */}
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
		            Showing {filteredProjects.length + filteredDirectoryListings.length} of {projects.length + directoryListings.length} items
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
        {filteredProjects.map((p) => {
          const pack = buildThumbPack(p);
          const coverUrl = pack.cover;

	          const isReferenceGallery = p._kind === "homeowner_reference_gallery";
	          const saved = !!favMap[p.id];
	          const canSave = authed && !isOwner(p) && !isReferenceGallery;
          const liked = !!likeMap[p.id];
          const likeCount = Number(likeCounts[p.id] ?? p.like_count ?? 0);

          const card = (
            <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
              {/* Cover banner */}
              {coverUrl ? (
                <div className="relative h-44 w-full bg-slate-200">
                  <img
                    src={coverUrl}
                    alt={p.title || "project cover"}
                    className="block h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                </div>
              ) : pack.thumbs.length ? (
                <div className="relative">
                  <div
                    className="grid gap-1 bg-slate-50 p-1"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(
                        3,
                        pack.thumbs.length
                      )}, 1fr)`,
                    }}
                  >
                    {pack.thumbs.map((item, i) => (
                      <div key={(item.thumb || item.url) + i} className="relative h-24 overflow-hidden rounded-md bg-slate-100">
                        <img
                          src={item.thumb || item.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {item.mediaType === "video" ? (
                          <span className="absolute inset-0 flex items-center justify-center text-white">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60">
                              <SymbolIcon name="play_arrow" fill={1} className="text-[22px]" />
                            </span>
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="relative flex h-44 w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
                  No media
                </div>
              )}

              <div className="p-4">
                <div className="mb-1 flex items-center gap-2">
                  <div className="truncate text-base font-semibold">{p.title}</div>
                  {p.category ? <Badge>{p.category}</Badge> : null}
                </div>

                <div className="line-clamp-2 text-sm text-slate-700">
                  {p.summary || <span className="opacity-60">No summary</span>}
                </div>

	                <div className="mt-2 text-xs text-slate-500">
	                  {isReferenceGallery
	                    ? `${p.reference_count || pack.thumbs.length} reference image${Number(p.reference_count || pack.thumbs.length) === 1 ? "" : "s"}`
	                    : `by ${p.owner_username}`}
	                </div>

	                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
	                  {isReferenceGallery ? (
	                    <span className="inline-flex rounded-full px-2 py-1 font-medium text-slate-700">
	                      View profile
	                    </span>
	                  ) : canSave ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full px-2 py-1 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                      onClick={(e) => toggleLike(e, p)}
                      disabled={likeBusyId === p.id}
                      aria-label={liked ? "Unlike project" : "Like project"}
                      title={liked ? "Unlike project" : "Like project"}
                    >
                      <SymbolIcon name="favorite" fill={liked ? 1 : 0} className="text-[18px]" />
                      <span>{likeCount}</span>
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1 rounded-full px-2 py-1">
                      <SymbolIcon name="favorite" fill={liked ? 1 : 0} className="text-[18px]" />
                      <span>{likeCount}</span>
                    </div>
                  )}

                  <div className="inline-flex items-center gap-1.5">
	                    {authed && isOwner(p) && !isReferenceGallery ? (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                        aria-label="Edit project"
                        title="Edit project"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(`/dashboard?edit=${p.id}`);
                        }}
                      >
                        <SymbolIcon name="edit" className="text-[20px]" />
                      </button>
                    ) : canSave ? (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                        onClick={(e) => toggleFavorite(e, p)}
                        disabled={favBusyId === p.id}
                        aria-label={saved ? "Unsave project" : "Save project"}
                        title={saved ? "Unsave project" : "Save project"}
                      >
                        <SymbolIcon name="bookmark" fill={saved ? 1 : 0} className="text-[20px]" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          );

	          return (
	            <Link
	              key={p.id}
	              to={isReferenceGallery ? p.profile_url : `/projects/${p.id}`}
	              className="block text-inherit no-underline"
	            >
	              {card}
	            </Link>
          );
        })}
      </div>
      {directoryListings.length > 0 ? (
        <div className="mt-8 border-t border-slate-200 pt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Approved directory listings
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Submitted listings reviewed by admin.
              </p>
            </div>
          </div>

          {filteredDirectoryListings.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
              {filteredDirectoryListings.map((listing) => {
                const specialties = Array.isArray(listing.specialties) ? listing.specialties : [];
                const visibleSpecialties = specialties.slice(0, 4);
                return (
                  <Card key={`directory-${listing.id}`} className="flex min-h-[210px] flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold text-slate-950">
                          {listing.business_name}
                        </h3>
                        {listing.phone_number ? (
                          <div className="mt-2 text-sm font-medium text-slate-700">
                            {listing.phone_number}
                          </div>
                        ) : null}
                      </div>
                      <ReportContentButton
                        targetType="business_directory_listing"
                        targetId={listing.id}
                        subject={listing.business_name || "Business directory listing"}
                        label={<SymbolIcon name="flag" className="text-[16px]" />}
                        title="Report listing"
                        ariaLabel="Report listing"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                      />
                    </div>

                    {visibleSpecialties.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {visibleSpecialties.map((specialty) => (
                          <span
                            key={specialty}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            {specialty}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {listing.website ? (
                      <a
                        href={listing.website}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-auto pt-5 text-sm font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                      >
                        Visit website
                      </a>
                    ) : (
                      <div className="mt-auto pt-5 text-xs text-slate-400">Reviewed listing</div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-5 text-sm text-slate-500">
              No approved directory listings match this search.
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
