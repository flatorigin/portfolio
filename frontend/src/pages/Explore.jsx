// =======================================
// file: frontend/src/pages/Explore.jsx
// Uses ProjectImage.order to choose the cover (order=0)
// + Favorites (Save button) for other users' projects
// Favorites reactive; projects stable.
// =======================================
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import {
  Badge,
  Card,
  Button,
  GhostButton,
  EmptyState,
  Field,
  PageHeader,
  Select,
  StickySurface,
  SymbolIcon,
} from "../ui";
import DirectoryListingCard from "../components/cards/DirectoryListingCard";
import ExploreProjectCard from "../components/cards/ExploreProjectCard";
import {
  getCachedLocationOrigin,
  formatDistanceMiles,
  locationParams,
  requestLocationOrigin,
} from "../utils/locationOrigin";

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm)(?:$|[?#])/i;
const INITIAL_VISIBLE_ITEMS = 6;
const LOAD_MORE_BATCH_SIZE = 50;

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
  const [locationOrigin, setLocationOrigin] = useState(getCachedLocationOrigin);
  const [debouncedLocationQuery, setDebouncedLocationQuery] = useState("");
  const initialLoadRef = useRef(true);

  // ✅ favorites state
  // favMap[projectId] = true/false
  const [favMap, setFavMap] = useState({});
  const [favBusyId, setFavBusyId] = useState(null);
  const [likeMap, setLikeMap] = useState({});
  const [likeCounts, setLikeCounts] = useState({});
  const [likeBusyId, setLikeBusyId] = useState(null);
  const [directoryLikeMap, setDirectoryLikeMap] = useState({});
  const [directoryLikeCounts, setDirectoryLikeCounts] = useState({});
  const [directoryLikeBusyId, setDirectoryLikeBusyId] = useState(null);
  const [visibleProjectCount, setVisibleProjectCount] = useState(INITIAL_VISIBLE_ITEMS);
  const [visibleDirectoryCount, setVisibleDirectoryCount] = useState(INITIAL_VISIBLE_ITEMS);

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
    const nextLocationQuery = filters.location.trim();
    const timer = window.setTimeout(() => {
      setDebouncedLocationQuery(
        nextLocationQuery.length >= 3 ? nextLocationQuery : "",
      );
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [filters.location]);

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
    [me],
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
    [favBusyId, favMap, isOwner],
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
          setLikeCounts((prev) => ({
            ...prev,
            [p.id]: Number(data.like_count || 0),
          }));
        }
        window.dispatchEvent(new CustomEvent("projects:liked_changed"));
      } catch (err) {
        console.error("[Explore] toggleLike failed", err?.response || err);
        setLikeMap((prev) => ({ ...prev, [p.id]: currently }));
        setLikeCounts((prev) => ({ ...prev, [p.id]: prevCount }));

        const data = err?.response?.data;
        const msg =
          data?.detail ||
          data?.message ||
          err?.message ||
          "Could not update like.";
        alert(typeof msg === "string" ? msg : JSON.stringify(msg));
      } finally {
        setLikeBusyId(null);
      }
    },
    [isOwner, likeBusyId, likeCounts, likeMap],
  );

  const toggleDirectoryLike = useCallback(
    async (e, listing) => {
      e.preventDefault();
      e.stopPropagation();

      if (!listing?.id) return;
      if (!authRef.current.authed) {
        alert("Log in to like directory listings.");
        return;
      }
      if (directoryLikeBusyId === listing.id) return;

      const currently = !!directoryLikeMap[listing.id];
      const prevCount = Number(
        directoryLikeCounts[listing.id] ?? listing.like_count ?? 0,
      );

      setDirectoryLikeBusyId(listing.id);
      setDirectoryLikeMap((prev) => ({ ...prev, [listing.id]: !currently }));
      setDirectoryLikeCounts((prev) => ({
        ...prev,
        [listing.id]: Math.max(0, prevCount + (currently ? -1 : 1)),
      }));

      try {
        const { data } = currently
          ? await api.delete(`/business-directory/${listing.id}/like/`)
          : await api.post(`/business-directory/${listing.id}/like/`);

        setDirectoryLikeMap((prev) => ({
          ...prev,
          [listing.id]: !!data?.liked,
        }));
        if (data?.like_count !== undefined) {
          setDirectoryLikeCounts((prev) => ({
            ...prev,
            [listing.id]: Number(data.like_count || 0),
          }));
        }
        window.dispatchEvent(new CustomEvent("profiles:liked_changed"));
      } catch (err) {
        console.error(
          "[Explore] toggleDirectoryLike failed",
          err?.response || err,
        );
        setDirectoryLikeMap((prev) => ({ ...prev, [listing.id]: currently }));
        setDirectoryLikeCounts((prev) => ({
          ...prev,
          [listing.id]: prevCount,
        }));

        const data = err?.response?.data;
        const msg =
          data?.detail ||
          data?.message ||
          err?.message ||
          "Could not update like.";
        alert(typeof msg === "string" ? msg : JSON.stringify(msg));
      } finally {
        setDirectoryLikeBusyId(null);
      }
    },
    [directoryLikeBusyId, directoryLikeCounts, directoryLikeMap],
  );

  // 1) Load projects once (stable)
  useEffect(() => {
    let alive = true;
    const locationQuery = debouncedLocationQuery.trim();
    if (initialLoadRef.current) {
      setLoading(true);
    }

    (async () => {
      try {
        const [{ data }, { data: homeownerRefs }, { data: directoryData }] =
          await Promise.all([
            api.get("/projects/"),
            api
              .get("/profiles/homeowner-references/")
              .catch(() => ({ data: [] })),
            api
              .get("/business-directory/", {
                params: {
                  ...locationParams(locationOrigin),
                  ...(locationQuery.length >= 3
                    ? { origin_location: locationQuery }
                    : {}),
                },
              })
              .catch(() => ({ data: [] })),
          ]);
        if (!alive) return;

        const arr = Array.isArray(data) ? data : [];

        // ✅ Explore = only PUBLIC + NOT job postings
        const exploreProjects = arr.filter(
          (p) =>
            (p?.is_public === undefined || p?.is_public === true) &&
            !p?.is_job_posting,
        );

        const referenceCards = (
          Array.isArray(homeownerRefs) ? homeownerRefs : []
        ).map((profile) => ({
          id: `homeowner-reference-${profile.username || profile.id}`,
          _kind: "homeowner_reference_gallery",
          title: `${profile.display_name || profile.username || "Homeowner"} reference gallery`,
          summary:
            profile.bio ||
            "Style and quality references shared by the homeowner.",
          category: "Reference gallery",
          location: profile.service_location || "",
          owner_username: profile.username || "",
          is_public: true,
          is_job_posting: false,
          cover_image_url: profile.cover_image_url || "",
          images: Array.isArray(profile.reference_gallery)
            ? profile.reference_gallery
            : [],
          reference_count: profile.reference_count || 0,
          profile_url: `/profiles/${profile.username}`,
        }));
        const exploreItems = [...referenceCards, ...exploreProjects];

        setProjects(exploreItems);
        const directoryItems = Array.isArray(directoryData)
          ? directoryData
          : [];
        setDirectoryListings(directoryItems);
        setDirectoryLikeCounts(
          Object.fromEntries(
            directoryItems.map((listing) => [
              listing.id,
              Number(listing?.like_count || 0),
            ]),
          ),
        );
        setDirectoryLikeMap(
          Object.fromEntries(
            directoryItems.map((listing) => [
              listing.id,
              !!listing?.liked_by_me,
            ]),
          ),
        );
        setLikeCounts(
          Object.fromEntries(
            exploreItems.map((p) => [p.id, Number(p?.like_count || 0)]),
          ),
        );
        setLikeMap(
          Object.fromEntries(exploreItems.map((p) => [p.id, !!p?.liked_by_me])),
        );
      } catch (e) {
        console.error("[Explore] projects fetch failed", e?.response || e);
        if (alive) {
          setProjects([]);
          setDirectoryListings([]);
        }
      } finally {
        if (alive) {
          setLoading(false);
          initialLoadRef.current = false;
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [locationOrigin, debouncedLocationQuery]);

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

      if (
        filters.name.trim() &&
        !name.includes(filters.name.toLowerCase().trim())
      )
        return false;

      if (
        filters.location.trim() &&
        !loc.includes(filters.location.toLowerCase().trim())
      )
        return false;

      if (filters.minSqf !== "" && sqf < Number(filters.minSqf)) return false;
      if (filters.maxSqf !== "" && sqf > Number(filters.maxSqf)) return false;

      if (filters.minBudget !== "" && budget < Number(filters.minBudget))
        return false;
      if (filters.maxBudget !== "" && budget > Number(filters.maxBudget))
        return false;

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

      const listingLocation = String(listing.location || "").toLowerCase();
      if (
        locationQuery &&
        filters.location.trim().length < 3 &&
        !listingLocation.includes(locationQuery)
      ) {
        return false;
      }
      if (hasNumericFilters) return false;
      if (!nameQuery) return true;

      const specialties = Array.isArray(listing.specialties)
        ? listing.specialties
        : [];
      const haystack = [
        listing.business_name,
        listing.location,
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
  const visibleProjects = useMemo(
    () => filteredProjects.slice(0, visibleProjectCount),
    [filteredProjects, visibleProjectCount],
  );
  const visibleDirectoryListings = useMemo(
    () => filteredDirectoryListings.slice(0, visibleDirectoryCount),
    [filteredDirectoryListings, visibleDirectoryCount],
  );
  const remainingProjectCount = Math.max(
    0,
    filteredProjects.length - visibleProjectCount,
  );
  const remainingDirectoryCount = Math.max(
    0,
    filteredDirectoryListings.length - visibleDirectoryCount,
  );

  useEffect(() => {
    setVisibleProjectCount(INITIAL_VISIBLE_ITEMS);
    setVisibleDirectoryCount(INITIAL_VISIBLE_ITEMS);
  }, [filters, debouncedLocationQuery]);

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
      if (activeSearchField === "sqf")
        return { ...prev, minSqf: value, maxSqf: "" };
      return { ...prev, minBudget: value, maxBudget: "" };
    });
  };

  if (loading) {
    return (
      <div>
        <PageHeader eyebrow="Public marketplace" title="Explore">
          Browse public projects, homeowner references, and approved local business listings.
        </PageHeader>
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
        <PageHeader eyebrow="Public marketplace" title="Explore">
          Browse public projects, homeowner references, and approved local business listings.
        </PageHeader>
        <EmptyState
          icon="search"
          title="No projects yet."
          action={
            authed ? (
              <GhostButton onClick={() => navigate("/dashboard")}>
                Create your first project
              </GhostButton>
            ) : null
          }
          className="mt-5"
        >
          Public projects and approved local listings will appear here.
        </EmptyState>
      </div>
    );
  }

  return (
    <div>
      <PageHeader eyebrow="Public marketplace" title="Explore" className="mb-5">
        Browse public projects, homeowner references, and approved local business listings.
      </PageHeader>

      {/* 🔍 Filter bar */}
      <StickySurface className="mb-5 p-5 sm:p-6">
        <div>
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-950">Search and filter</h2>
              <p className="mt-1 text-xs text-slate-500">
                Narrow results by project, location, size, or budget.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Search by" className="w-full sm:w-44">
              <div className="relative">
                <Select
                  value={activeSearchField}
                  onChange={(e) => setActiveSearchField(e.target.value)}
                  className="h-10 appearance-none pr-10 text-slate-700"
                >
                  <option value="name">Project name</option>
                  <option value="location">Location</option>
                  <option value="sqf">Sqf</option>
                  <option value="budget">Budget</option>
                </Select>

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
            </Field>
            <Field label="Search project" className="min-w-[280px] flex-1">
              <div className="flex h-10 w-full items-center rounded-lg border border-slate-300 bg-white px-3 shadow-xs transition focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200">
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
            </Field>

            <Button
              type="button"
              disabled={!hasActiveFilters}
              onClick={clearFilters}
              className={
                "h-10 whitespace-nowrap " +
                (hasActiveFilters
                  ? "bg-slate-950 text-white hover:bg-slate-800"
                  : "border border-slate-200 bg-slate-50 text-slate-300 shadow-xs hover:bg-slate-50")
              }
            >
              Clear filters
            </Button>
          </div>

          {activeFilterBadges.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {activeFilterBadges.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={filter.clear}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-white hover:text-slate-950"
                  title={`Remove ${filter.label}`}
                >
                  <span className="truncate">{filter.label}</span>
                  <SymbolIcon name="close" className="text-[15px]" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-2 text-xs text-slate-500">
            Showing {filteredProjects.length + filteredDirectoryListings.length}{" "}
            of {projects.length + directoryListings.length} items
          </div>
        </div>
      </StickySurface>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
        {visibleProjects.map((p) => {
          const pack = buildThumbPack(p);
          const isReferenceGallery = p._kind === "homeowner_reference_gallery";
          const saved = !!favMap[p.id];
          const canSave = authed && !isOwner(p) && !isReferenceGallery;
          const liked = !!likeMap[p.id];
          const likeCount = Number(likeCounts[p.id] ?? p.like_count ?? 0);

          return (
            <ExploreProjectCard
              key={p.id}
              project={p}
              pack={pack}
              to={isReferenceGallery ? p.profile_url : `/projects/${p.id}`}
              isReferenceGallery={isReferenceGallery}
              canSave={canSave}
              saved={saved}
              liked={liked}
              likeCount={likeCount}
              likeBusy={likeBusyId === p.id}
              favoriteBusy={favBusyId === p.id}
              canEdit={authed && isOwner(p) && !isReferenceGallery}
              onLike={(e) => toggleLike(e, p)}
              onFavorite={(e) => toggleFavorite(e, p)}
              onEdit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate(`/dashboard?edit=${p.id}`);
              }}
            />
          );
        })}
      </div>
      {remainingProjectCount > 0 ? (
        <div className="mt-6 flex justify-center">
          <GhostButton
            type="button"
            onClick={() =>
              setVisibleProjectCount((count) =>
                Math.min(count + LOAD_MORE_BATCH_SIZE, filteredProjects.length),
              )
            }
          >
            Show more projects
            <span className="text-slate-400">
              ({Math.min(LOAD_MORE_BATCH_SIZE, remainingProjectCount)} more)
            </span>
          </GhostButton>
        </div>
      ) : null}
      {directoryListings.length > 0 ? (
        <div className="mt-8 border-t border-slate-200 pt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Local business/contractors directory
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Approved local listings appear separately from registered project cards.
              </p>
            </div>
          </div>

          {filteredDirectoryListings.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
              {visibleDirectoryListings.map((listing) => {
                const liked = !!directoryLikeMap[listing.id];
                const likeCount = Number(
                  directoryLikeCounts[listing.id] ?? listing.like_count ?? 0,
                );
                const distanceLabel = formatDistanceMiles(
                  listing.distance_miles,
                );
                return (
                  <DirectoryListingCard
                    key={`directory-${listing.id}`}
                    listing={listing}
                    distanceLabel={distanceLabel}
                    liked={liked}
                    likeCount={likeCount}
                    likeBusy={directoryLikeBusyId === listing.id}
                    onLike={(e) => toggleDirectoryLike(e, listing)}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState icon="search" title="No matching directory listings.">
              No approved directory listings match this search.
            </EmptyState>
          )}
          {remainingDirectoryCount > 0 ? (
            <div className="mt-6 flex justify-center">
              <GhostButton
                type="button"
                onClick={() =>
                  setVisibleDirectoryCount((count) =>
                    Math.min(
                      count + LOAD_MORE_BATCH_SIZE,
                      filteredDirectoryListings.length,
                    ),
                  )
                }
              >
                Show more businesses
                <span className="text-slate-400">
                  ({Math.min(LOAD_MORE_BATCH_SIZE, remainingDirectoryCount)} more)
                </span>
              </GhostButton>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
