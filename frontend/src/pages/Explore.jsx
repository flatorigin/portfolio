// =======================================
// file: frontend/src/pages/Explore.jsx
// Card UX: hover, meta/badge, empty & loading states
// =======================================
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { SectionTitle, Badge, Card, GhostButton } from "../ui";

export default function Explore() {
  const [projects, setProjects] = useState([]);
  const [thumbs, setThumbs] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const authed = !!localStorage.getItem("access");
  const me = localStorage.getItem("username") || "";
  const isOwner = (p) =>
    typeof p.is_owner === "boolean" ? p.is_owner : (p.owner_username || "") === me;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .get("/projects/")
      .then(async ({ data }) => {
        if (!alive) return;
        const arr = Array.isArray(data) ? data : [];
        setProjects(arr);

        const entries = await Promise.all(
          arr.map(async (p) => {
            try {
              const { data: imgs } = await api.get(`/projects/${p.id}/images/`);
              const urls = (imgs || [])
                .map((it) => (typeof it === "string" ? it : it?.url || it?.src || it?.image || null))
                .filter(Boolean)
                .slice(0, 3);
              return [p.id, urls];
            } catch {
              return [p.id, []];
            }
          })
        );
        if (alive) setThumbs(Object.fromEntries(entries));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

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
              <GhostButton onClick={() => navigate("/dashboard")}>Create your first project →</GhostButton>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle>Explore</SectionTitle>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-5">
        {projects.map((p) => {
          const t = thumbs[p.id] || [];
          const card = (
            <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
              {/* Cover or thumb strip */}
              {p.cover_image ? (
                <img
                  src={p.cover_image}
                  alt={p.title || "project cover"}
                  className="block h-44 w-full object-cover"
                />
              ) : t.length ? (
                <div
                  className="grid gap-1 bg-slate-50 p-1"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(3, t.length)}, 1fr)`,
                  }}
                >
                  {t.map((src, i) => (
                    <img
                      key={src + i}
                      src={src}
                      alt=""
                      className="h-24 w-full rounded-md object-cover"
                    />
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
                    <GhostButton onClick={(e) => { e.preventDefault(); navigate(`/dashboard?edit=${p.id}`); }}>
                      Edit in Dashboard
                    </GhostButton>
                  </div>
                )}
              </div>
            </Card>
          );

          return (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              className="block text-inherit no-underline"
            >
              {card}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

