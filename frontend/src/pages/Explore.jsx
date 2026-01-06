// =======================================
// file: frontend/src/pages/Explore.jsx
// Uses ProjectImage.order to choose the cover (order=0)
// =======================================
import { useEffect, useState, useMemo } from "react";
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

function extractImageId(it) {
  if (!it || typeof it === "string") return null;
  const raw = it.id ?? it.pk ?? it.image_id ?? null;
  return raw == null ? null : Number(raw);
}

function extractOrder(it) {
  if (!it || typeof it === "string") return null;
  const raw = it.order ?? it.sort_order ?? null;
  return raw == null ? null : Number(raw);
}

export default function Explore() {
  const [projects, setProjects] = useState([]);
  // thumbs[projectId] = { cover: string|null, thumbs: string[] }
  const [thumbs, setThumbs] = useState({});
  const [loading, setLoading] = useState(true);

  // 🔍 filter state
  const [filters, setFilters] = useState({
    name: "",
    location: "",
    minSqf: "",
    maxSqf: "",
    minBudget: "",
    maxBudget: "",
  });

  const navigate = useNavigate();

  const authed = !!localStorage.getItem("access");
  const me = localStorage.getItem("username") || "";
  const isOwner = (p) =>
    typeof p.is_owner === "boolean" ? p.is_owner : (p.owner_username || "") === me;

  useEffect(() => {
    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const { data } = await api.get("/projects/");
        if (!alive) return;

        const arr = Array.isArray(data) ? data : [];
        setProjects(arr);

        const entries = await Promise.all(
          arr.map(async (p) => {
            try {
              const { data: imgs } = await api
                .get(`/projects/${p.id}/images/`)
                .catch(() => ({ data: [] }));

              const list = Array.isArray(imgs) ? imgs : [];
              const mapped = list
                .map((it) => ({
                  id: extractImageId(it),
                  url: extractImageUrl(it),
                  order: extractOrder(it),
                }))
                .filter((x) => !!x.url);

              // ✅ cover = image with order===0, else first
              const cover =
                mapped.find((x) => Number(x.order) === 0)?.url ||
                mapped[0]?.url ||
                null;

              const thumbUrls = mapped.slice(0, 3).map((x) => x.url);

              return [p.id, { cover, thumbs: thumbUrls }];
            } catch {
              return [p.id, { cover: null, thumbs: [] }];
            }
          })
        );

        if (alive) setThumbs(Object.fromEntries(entries));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // 🔍 filter logic
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const name = (p.title || "").toLowerCase();
      const loc = (p.location || "").toLowerCase();
      const sqf = Number(p.sqf ?? 0) || 0;
      const budget = Number(p.budget ?? 0) || 0;

      if (filters.name.trim() && !name.includes(filters.name.toLowerCase().trim()))
        return false;

      if (filters.location.trim() && !loc.includes(filters.location.toLowerCase().trim()))
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
        <SectionTitle>Explore</SectionTitle>
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
        <SectionTitle>Explore</SectionTitle>
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
      <SectionTitle>Explore</SectionTitle>

      {/* 🔍 Filter bar */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <div className="mb-1 text-xs font-medium text-slate-500">Project name</div>
            <Input value={filters.name} onChange={updateFilter("name")} placeholder="e.g. Kitchen remodel" />
          </div>

          <div className="flex-1 min-w-[160px]">
            <div className="mb-1 text-xs font-medium text-slate-500">Location</div>
            <Input value={filters.location} onChange={updateFilter("location")} placeholder="City, area, etc." />
          </div>

          <div className="flex-1 min-w-[160px]">
            <div className="mb-1 text-xs font-medium text-slate-500">Sqf (min / max)</div>
            <div className="flex gap-2">
              <Input type="number" inputMode="numeric" value={filters.minSqf} onChange={updateFilter("minSqf")} placeholder="Min" />
              <Input type="number" inputMode="numeric" value={filters.maxSqf} onChange={updateFilter("maxSqf")} placeholder="Max" />
            </div>
          </div>

          <div className="flex-1 min-w-[160px]">
            <div className="mb-1 text-xs font-medium text-slate-500">Budget (min / max)</div>
            <div className="flex gap-2">
              <Input type="number" inputMode="numeric" value={filters.minBudget} onChange={updateFilter("minBudget")} placeholder="Min" />
              <Input type="number" inputMode="numeric" value={filters.maxBudget} onChange={updateFilter("maxBudget")} placeholder="Max" />
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
          const pack = thumbs[p.id] || { cover: null, thumbs: [] };
          const coverUrl = pack.cover;

          const card = (
            <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
              {/* Cover banner */}
              {coverUrl ? (
                <div className="relative h-44 w-full bg-slate-200">
                  <img src={coverUrl} alt={p.title || "project cover"} className="block h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                </div>
              ) : pack.thumbs.length ? (
                <div
                  className="grid gap-1 bg-slate-50 p-1"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(3, pack.thumbs.length)}, 1fr)`,
                  }}
                >
                  {pack.thumbs.map((src, i) => (
                    <img key={src + i} src={src} alt="" className="h-24 w-full rounded-md object-cover" />
                  ))}
                </div>
              ) : (
                <div className="flex h-44 w-full items-center justify-center bg-slate-100 text-sm text-slate-500">
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
                {authed && isOwner(p) && (
                  <div className="mt-3">
                    <GhostButton
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(`/dashboard?edit=${p.id}`);
                      }}
                    >
                      Edit in Dashboard
                    </GhostButton>
                  </div>
                )}
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
