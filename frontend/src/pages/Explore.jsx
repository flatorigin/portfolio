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
  Button,
  SymbolIcon,
} from "../ui";
import ReportContentButton from "../components/ReportContentButton";
import {
  getCachedLocationOrigin,
  formatDistanceMiles,
  locationParams,
  requestLocationOrigin,
} from "../utils/locationOrigin";

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm)(?:$|[?#])/i;

// Sample data for preview (remove in production)
const SAMPLE_PROJECTS = [
  {
    id: "sample-1",
    title: "Stairs Runner Installation",
    summary: "Custom carpet runner over existing hardwood stairs for improved safety and appearance.",
    category: "Flooring",
    owner_username: "NeyFlooring",
    location: "Media, PA",
    like_count: 12,
    view_count: 234,
    images: [{ url: "https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=600&h=400&fit=crop" }],
  },
  {
    id: "sample-2",
    title: "Deck Refacing Project",
    summary: "Complete deck reface with Trex composite decking, adding 200 sq ft of usable space.",
    category: "Building",
    owner_username: "babak",
    location: "West Chester, PA",
    like_count: 8,
    view_count: 156,
    images: [{ url: "https://images.unsplash.com/photo-1591825729269-caeb344f6df2?w=600&h=400&fit=crop" }],
  },
  {
    id: "sample-3",
    title: "Garage Floor Coating",
    summary: "High-performance Polyaspartic coating system for durable, showroom-finish.",
    category: "Concrete",
    owner_username: "Daltongrochowski",
    location: "Philadelphia, PA",
    like_count: 15,
    view_count: 312,
    images: [{ url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop" }],
  },
  {
    id: "sample-4",
    title: "Interior Painting",
    summary: "Full interior repaint with premium low-VOC paint, including trim and ceilings.",
    category: "Painting",
    owner_username: "ProPainters",
    location: "Wilmington, DE",
    like_count: 22,
    view_count: 489,
    images: [{ url: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=600&h=400&fit=crop" }],
  },
  {
    id: "sample-5",
    title: "Backyard Landscaping",
    summary: "Complete backyard transformation with patio, native plants, and irrigation system.",
    category: "Landscaping",
    owner_username: "GreenThumb",
    location: "Newark, DE",
    like_count: 31,
    view_count: 567,
    images: [{ url: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600&h=400&fit=crop" }],
  },
  {
    id: "sample-6",
    title: "Bathroom Renovation",
    summary: "Modern bathroom remodel with walk-in shower, floating vanity, and heated floors.",
    category: "Building",
    owner_username: "ModernBaths",
    location: "King of Prussia, PA",
    like_count: 45,
    view_count: 823,
    images: [{ url: "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600&h=400&fit=crop" }],
  },
];

// Sample directory listings for preview
const SAMPLE_DIRECTORY_LISTINGS = [
  {
    id: "dir-1",
    business_name: "Ace Quality Painting LLC",
    location: "Media, PA",
    specialties: ["House Painting", "Commercial Painting", "Interior Painting"],
    phone_number: "(484) 604-2256",
    website: "https://acequalitypainting.com",
    rating: 4.8,
    review_count: 24,
    distance_miles: 3.2,
  },
  {
    id: "dir-2",
    business_name: "Archadeck of Delaware County",
    location: "Media, PA",
    specialties: ["Custom Deck Design", "Pergolas", "Screen Porches"],
    phone_number: "(610) 840-6695",
    website: "https://archadeck.com",
    rating: 4.9,
    review_count: 31,
    distance_miles: 5.8,
  },
  {
    id: "dir-3",
    business_name: "Bates Landscaping",
    location: "Media, PA",
    specialties: ["Drainage Solutions", "Stormwater Management", "Landscape Pitching"],
    phone_number: "(484) 887-8678",
    website: "https://bateslandscaping.com",
    rating: 4.7,
    review_count: 15,
    distance_miles: 4.1,
  },
  {
    id: "dir-4",
    business_name: "Demeo Builders",
    location: "Media, PA",
    specialties: ["New Home Construction", "Residential Additions", "Kitchens"],
    phone_number: "(484) 832-3460",
    website: "https://demeobuilders.com",
    rating: 5.0,
    review_count: 42,
    distance_miles: 2.8,
  },
  {
    id: "dir-5",
    business_name: "Blue Frog Painting Co., LLC",
    location: "Media, PA",
    specialties: ["Interior Painting", "Exterior Painting", "Cabinet Painting"],
    phone_number: "(267) 485-5148",
    website: "https://bluefrogpainting.com",
    rating: 4.6,
    review_count: 19,
    distance_miles: 6.2,
  },
  {
    id: "dir-6",
    business_name: "Cider Mill Landscapes",
    location: "Media, PA",
    specialties: ["Garden Design & Installation", "Hardscaping", "Pergolas & Pavilions"],
    phone_number: "(484) 574-4666",
    website: "https://cidermilllandscapes.com",
    rating: 4.8,
    review_count: 27,
    distance_miles: 3.5,
  },
];

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

        setProjects(exploreItems.length ? exploreItems : SAMPLE_PROJECTS);
        const directoryItems = Array.isArray(directoryData)
          ? directoryData
          : [];
        setDirectoryListings(directoryItems.length ? directoryItems : SAMPLE_DIRECTORY_LISTINGS);
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
          setProjects(SAMPLE_PROJECTS);
          setDirectoryListings(SAMPLE_DIRECTORY_LISTINGS);
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
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Explore Projects</h1>
          <p className="mt-2 text-slate-500">Browse real projects from homeowners and contractors in your area</p>
        </header>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white animate-pulse">
              <div className="aspect-[4/3] bg-slate-200" />
              <div className="space-y-3 p-4">
                <div className="h-5 w-2/3 rounded bg-slate-200" />
                <div className="h-4 w-full rounded bg-slate-200" />
                <div className="h-4 w-1/2 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!projects.length && !directoryListings.length) {
    return (
      <div>
        <header className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Explore Projects</h1>
          <p className="mt-2 text-slate-500">Browse real projects from homeowners and contractors in your area</p>
        </header>
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-600">No projects yet.</p>
          {authed && (
            <div className="mt-4">
              <Button onClick={() => navigate("/dashboard")}>
                Create your first project
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8">
      {/* Hero header with translucent search */}
      <div className="relative bg-gradient-to-b from-slate-100 to-slate-50 px-4 pb-6 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Explore Projects</h1>
            <p className="mt-2 text-slate-500">Browse real projects from homeowners and contractors in your area</p>
          </header>

          {/* Search bar - translucent */}
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SymbolIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-slate-400" />
              <input
                type="text"
                value={filters.name}
                onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Search projects by name, category, or location..."
                className="h-11 w-full rounded-xl border-0 bg-white/80 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white/80 px-4 text-sm font-medium text-slate-700 transition hover:bg-white"
            >
              <SymbolIcon name="tune" className="text-[18px]" />
              Filters
            </button>
          </div>

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
      <div className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Results count */}
          <p className="mb-4 text-sm text-slate-500">
            Showing <span className="font-medium text-slate-700">{filteredProjects.length + filteredDirectoryListings.length}</span> projects
          </p>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
        {filteredProjects.map((p) => {
          const pack = buildThumbPack(p);
          const coverUrl = pack.cover;

          const isReferenceGallery = p._kind === "homeowner_reference_gallery";
          const saved = !!favMap[p.id];
          const canSave = authed && !isOwner(p) && !isReferenceGallery;
          const liked = !!likeMap[p.id];
          const likeCount = Number(likeCounts[p.id] ?? p.like_count ?? 0);
          const viewCount = Number(p.view_count ?? 0);

          const card = (
            <div className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:shadow-md">
              {/* Cover image with category badge */}
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt={p.title || "project cover"}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : pack.thumbs.length ? (
                  <img
                    src={pack.thumbs[0].thumb || pack.thumbs[0].url}
                    alt={p.title || "project cover"}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                    No image
                  </div>
                )}
                {/* Category badge on image */}
                {p.category ? (
                  <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-1 text-xs font-medium text-slate-700 backdrop-blur-sm">
                    {p.category}
                  </span>
                ) : null}
              </div>

              <div className="p-4">
                {/* Title */}
                <h3 className="font-semibold text-slate-900">{p.title}</h3>

                {/* Description */}
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500">
                  {p.summary || "No description"}
                </p>

                {/* Divider */}
                <div className="my-3 border-t border-slate-100" />

                {/* Footer: author, location, likes, views */}
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <span>by</span>
                    <span className="font-medium text-slate-700">{p.owner_username || "Unknown"}</span>
                  </div>
                  {p.location ? (
                    <div className="flex items-center gap-1">
                      <SymbolIcon name="location_on" className="text-[14px]" />
                      <span>{p.location}</span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    {canSave ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 transition hover:text-slate-700 disabled:opacity-50"
                        onClick={(e) => toggleLike(e, p)}
                        disabled={likeBusyId === p.id}
                        aria-label={liked ? "Unlike project" : "Like project"}
                      >
                        <SymbolIcon name="favorite" fill={liked ? 1 : 0} className="text-[16px]" />
                        <span>{likeCount}</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <SymbolIcon name="favorite" fill={liked ? 1 : 0} className="text-[16px]" />
                        <span>{likeCount}</span>
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <SymbolIcon name="visibility" className="text-[16px]" />
                      <span>{viewCount}</span>
                    </span>
                  </div>

                  {canSave ? (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                      onClick={(e) => toggleFavorite(e, p)}
                      disabled={favBusyId === p.id}
                      aria-label={saved ? "Unsave project" : "Save project"}
                    >
                      <SymbolIcon name="bookmark" fill={saved ? 1 : 0} className="text-[18px]" />
                    </button>
                  ) : authed && isOwner(p) && !isReferenceGallery ? (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/dashboard?edit=${p.id}`);
                      }}
                      aria-label="Edit project"
                    >
                      <SymbolIcon name="edit" className="text-[18px]" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
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
        </div>
      </div>

      {/* Directory Section - Full width immersive background */}
      {directoryListings.length > 0 ? (
        <div className="mt-12 border-y border-slate-200 bg-[#F6F5F1] px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                  Local Contractor Directory
                </h2>
                <p className="mt-2 text-slate-500">Verified businesses in your area</p>
              </div>
              <button
                type="button"
                className="hidden shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
              >
                View All Contractors
              </button>
            </div>

          {filteredDirectoryListings.length > 0 ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredDirectoryListings.map((listing) => {
                const specialties = Array.isArray(listing.specialties)
                  ? listing.specialties
                  : [];
                const visibleSpecialties = specialties.slice(0, 2);
                const extraCount = specialties.length - 2;
                const liked = !!directoryLikeMap[listing.id];
                const rating = listing.rating ?? 0;
                const reviewCount = listing.review_count ?? 0;

                return (
                  <div
                    key={`directory-${listing.id}`}
                    className="relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                  >
                    {/* Save/Like button - top right */}
                    <button
                      type="button"
                      className="absolute right-4 top-4 text-slate-300 transition hover:text-slate-600 disabled:opacity-50"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleDirectoryLike(e, listing);
                      }}
                      disabled={directoryLikeBusyId === listing.id}
                      aria-label={liked ? "Unlike" : "Like"}
                    >
                      <SymbolIcon name="favorite" fill={liked ? 1 : 0} className="text-[22px]" />
                    </button>

                    {/* Business name */}
                    <h3 className="pr-8 text-lg font-semibold text-slate-900">
                      {listing.business_name}
                    </h3>

                    {/* Location + Nearby badge */}
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <SymbolIcon name="location_on" className="text-[16px]" />
                        {listing.location || "Local"}
                      </span>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        Nearby
                      </span>
                    </div>

                    {/* Star rating */}
                    {rating > 0 ? (
                      <div className="mt-3 flex items-center gap-1.5">
                        <SymbolIcon name="star" fill={1} className="text-[18px] text-amber-400" />
                        <span className="font-semibold text-slate-900">{rating.toFixed(1)}</span>
                        <span className="text-sm text-slate-500">({reviewCount} reviews)</span>
                      </div>
                    ) : null}

                    {/* Specialty tags */}
                    {visibleSpecialties.length > 0 ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {visibleSpecialties.map((specialty) => (
                          <span
                            key={specialty}
                            className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                          >
                            {specialty}
                          </span>
                        ))}
                        {extraCount > 0 ? (
                          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                            +{extraCount} more
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Divider */}
                    <div className="my-4 border-t border-slate-100" />

                    {/* Footer: phone + website */}
                    <div className="flex items-center justify-between gap-3">
                      {listing.phone_number ? (
                        <a
                          href={`tel:${String(listing.phone_number).replace(/[^\d+]/g, "")}`}
                          className="inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <SymbolIcon name="call" className="text-[18px]" />
                          <span>{listing.phone_number}</span>
                        </a>
                      ) : (
                        <span />
                      )}

                      {listing.website ? (
                        <a
                          href={listing.website}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-slate-900 transition hover:text-slate-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Website
                          <SymbolIcon name="open_in_new" className="text-[16px]" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
              No approved directory listings match this search.
            </div>
          )}

          {/* Footer disclaimer */}
          <p className="mt-8 text-center text-xs text-slate-400">
            Business information may be sourced from publicly available information. Business owners may request edits or removal.
          </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
