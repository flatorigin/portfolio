// =======================================
// file: frontend/src/pages/Explore.jsx
// Uses ProjectImage.order to choose the cover (order=0)
// + Favorites (Save button) for other users' projects
// Favorites reactive; projects stable.
// =======================================
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { SectionTitle, Badge, Card, Button, Input, GhostButton } from "../ui";

// normalize urls (same spirit as ProjectDetail)
function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

function extractImageUrl(it) {
  if (!it) return "";
  if (typeof it === "string") return toUrl(it);
  return toUrl(it.url || it.src || it.image || it.file || "");
}

function extractOrder(it) {
  if (!it || typeof it === "string") return null;
  const raw = it.order ?? it.sort_order ?? null;
  return raw == null ? null : Number(raw);
}

function buildThumbPack(project) {
  const images = Array.isArray(project?.images) ? project.images : [];
  const mapped = images
    .map((it) => ({
      url: extractImageUrl(it),
      order: extractOrder(it),
    }))
    .filter((x) => !!x.url);

  const cover =
    toUrl(project?.cover_image_url || "") ||
    mapped.find((x) => Number(x.order) === 0)?.url ||
    mapped[0]?.url ||
    null;

  return {
    cover,
    thumbs: mapped.slice(0, 3).map((x) => x.url),
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
       const { data } = await api.get("/projects/");
       if (!alive) return;

       const arr = Array.isArray(data) ? data : [];

       // ✅ Explore = only PUBLIC + NOT job postings
       const exploreProjects = arr.filter(
         (p) =>
           (p?.is_public === undefined || p?.is_public === true) &&
           !p?.is_job_posting
       );

       setProjects(exploreProjects);
       setLikeCounts(
         Object.fromEntries(
           exploreProjects.map((p) => [p.id, Number(p?.like_count || 0)])
         )
       );
       setLikeMap(
         Object.fromEntries(
           exploreProjects.map((p) => [p.id, !!p?.liked_by_me])
         )
       );
     } catch (e) {
       console.error("[Explore] projects fetch failed", e?.response || e);
       if (alive) setProjects([]);
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

  const updateFilter = (key) => (e) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, [key]: value }));
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

  if (!projects.length) {
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
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <div className="mb-1 text-xs font-medium text-slate-500">Project name</div>
            <Input
              value={filters.name}
              onChange={updateFilter("name")}
              placeholder="e.g. Kitchen remodel"
            />
          </div>

          <div className="flex-1 min-w-[160px]">
            <div className="mb-1 text-xs font-medium text-slate-500">Location</div>
            <Input
              value={filters.location}
              onChange={updateFilter("location")}
              placeholder="City, area, etc."
            />
          </div>

          <div className="flex-1 min-w-[160px]">
            <div className="mb-1 text-xs font-medium text-slate-500">Sqf (min / max)</div>
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="numeric"
                value={filters.minSqf}
                onChange={updateFilter("minSqf")}
                placeholder="Min"
              />
              <Input
                type="number"
                inputMode="numeric"
                value={filters.maxSqf}
                onChange={updateFilter("maxSqf")}
                placeholder="Max"
              />
            </div>
          </div>

          <div className="flex-1 min-w-[160px]">
            <div className="mb-1 text-xs font-medium text-slate-500">
              Budget (min / max)
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                inputMode="numeric"
                value={filters.minBudget}
                onChange={updateFilter("minBudget")}
                placeholder="Min"
              />
              <Input
                type="number"
                inputMode="numeric"
                value={filters.maxBudget}
                onChange={updateFilter("maxBudget")}
                placeholder="Max"
              />
            </div>
          </div>

          <div className="self-center mt-5">
            <Button
              type="button"
              onClick={() =>
                setFilters({
                  name: "",
                  location: "",
                  minSqf: "",
                  maxSqf: "",
                  minBudget: "",
                  maxBudget: "",
                })
              }
            >
              Clear filters
            </Button>
          </div>
        </div>

        <div className="mt-2 text-xs text-slate-500">
          Showing {filteredProjects.length} of {projects.length} projects
        </div>
      </Card>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
        {filteredProjects.map((p) => {
          const pack = buildThumbPack(p);
          const coverUrl = pack.cover;

          const saved = !!favMap[p.id];
          const canSave = authed && !isOwner(p);
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
                    {pack.thumbs.map((src, i) => (
                      <img
                        key={src + i}
                        src={src}
                        alt=""
                        className="h-24 w-full rounded-md object-cover"
                      />
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

                <div className="mt-2 text-xs text-slate-500">by {p.owner_username}</div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 hover:bg-slate-100"
                    onClick={(e) => toggleLike(e, p)}
                    disabled={!canSave || likeBusyId === p.id}
                  >
                    <span aria-hidden>{liked ? "♥" : "♡"}</span>
                    <span>{likeCount}</span>
                  </button>
                </div>

                {/* ✅ Bottom button row (consistent placement/style) */}
                {authed && isOwner(p) ? (
                  <div className="mt-3">
                    <GhostButton
                      className="w-full justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/dashboard?edit=${p.id}`);
                      }}
                    >
                      Edit in Dashboard
                    </GhostButton>
                  </div>
                ) : canSave ? (
                  <div className="mt-3">
                    <GhostButton
                      className="w-full justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                      onClick={(e) => toggleFavorite(e, p)}
                      disabled={favBusyId === p.id}
                    >
                      {favBusyId === p.id ? "Saving…" : saved ? "Saved" : "Save"}
                    </GhostButton>
                  </div>
                ) : null}
              </div>
            </Card>
          );

          return (
            <Link key={p.id} to={`/projects/${p.id}`} className="block text-inherit no-underline">
              {card}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
