// file: frontend/src/pages/Explore.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

export default function Explore() {
  const [projects, setProjects] = useState([]);
  const [thumbs, setThumbs] = useState({}); // { [id]: string[] }
  const navigate = useNavigate();

  const authed = !!localStorage.getItem("access");
  const me = localStorage.getItem("username") || "";
  const isOwner = (p) => (typeof p.is_owner === "boolean" ? p.is_owner : (p.owner_username || "") === me);

  // read draft from localStorage and map to a pseudo-project
  function getLocalDraft() {
    try {
      const raw = localStorage.getItem("draftProject");
      if (!raw) return null;
      const d = JSON.parse(raw);
      if (!d?.name && !d?.location && !d?.highlights && d?.budget === "" && d?.sqf === "") return null;

      return {
        id: "draft-local",
        title: d.name || "(Untitled Project)",
        summary: [
          d.location ? `Location: ${d.location}` : null,
          (d.budget !== "" && !Number.isNaN(Number(d.budget))) ? `Budget: ${Number(d.budget).toLocaleString()}` : null,
          (d.sqf !== "" && !Number.isNaN(Number(d.sqf))) ? `Sq Ft: ${Number(d.sqf).toLocaleString()}` : null,
          d.highlights ? `Highlights: ${d.highlights}` : null,
        ].filter(Boolean).join(" • "),
        owner_username: me || "you",
        _isDraft: true,
      };
    } catch {
      return null;
    }
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/projects/");
        if (!alive) return;
        const arr = Array.isArray(data) ? data : [];

        // fetch thumbnails for real projects
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
        if (!alive) return;

        // prepend local draft (if any)
        const draft = getLocalDraft();
        setProjects(draft ? [draft, ...arr] : arr);
        setThumbs(Object.fromEntries(entries));
      } catch {
        // even if API fails, still show local draft
        const draft = getLocalDraft();
        setProjects(draft ? [draft] : []);
        setThumbs({});
      }
    })();
    return () => { alive = false; };
    // re-read draft when returning to Explore
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Explore</h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))",
          gap: 16,
        }}
      >
        {projects.map((p) => {
          const t = thumbs[p.id] || [];
          const isDraft = !!p._isDraft;

          const CardInner = (
            <div
              style={{
                border: isDraft ? "2px dashed #94a3b8" : "1px solid #eee",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Drafts have no cover/thumbs */}
              {!isDraft && p.cover_image && (
                <img
                  src={p.cover_image}
                  alt={p.title || "project cover"}
                  style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
                />
              )}

              {!isDraft && t.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${Math.min(3, t.length)}, 1fr)`,
                    gap: 2,
                    padding: 2,
                    background: "#fafafa",
                    borderTop: "1px solid #f0f0f0",
                  }}
                  aria-label="project thumbnails"
                >
                  {t.map((src, i) => (
                    <img
                      key={src + i}
                      src={src}
                      alt=""
                      style={{ width: "100%", height: 70, objectFit: "cover", display: "block", borderRadius: 6 }}
                    />
                  ))}
                </div>
              )}

              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 600 }}>{p.title}</div>
                  {isDraft && (
                    <span
                      title="Only saved in your browser"
                      style={{
                        fontSize: 12,
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "#111827",
                        color: "white",
                      }}
                    >
                      Draft (Local)
                    </span>
                  )}
                </div>

                <div style={{ opacity: 0.8, fontSize: 14, marginTop: 6 }}>
                  {p.summary || <span style={{ opacity: 0.6 }}>No summary</span>}
                </div>

                {!isDraft && (
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>by {p.owner_username}</div>
                )}
                {isDraft && (
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
                    (Local draft for {p.owner_username})
                  </div>
                )}
              </div>
            </div>
          );

          // Real projects are clickable; draft is not (no backend id).
          return isDraft ? (
            <div key="draft-local" aria-label="Local Draft Project">
              {CardInner}
            </div>
          ) : (
            <Link
              key={p.id}
              to={`/projects/${p.id}`}
              style={{ textDecoration: "none", color: "inherit", display: "block" }}
            >
              {CardInner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
