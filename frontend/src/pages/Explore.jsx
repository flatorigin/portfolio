// / ===== file: src/pages/Explore.jsx =====
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";

export default function Explore() {
  const [projects, setProjects] = useState([]);
  const [thumbs, setThumbs] = useState({}); // { [id]: string[] }
  const navigate = useNavigate();

  const authed = !!localStorage.getItem("access");
  const me = localStorage.getItem("username") || "";
  const isOwner = (p) => (typeof p.is_owner === "boolean" ? p.is_owner : (p.owner_username || "") === me);

  useEffect(() => {
    let alive = true;
    api.get("/projects/").then(async ({ data }) => {
      if (!alive) return;
      setProjects(Array.isArray(data) ? data : []);
      // Fetch first 3 images per project in parallel; ignore failures
      const entries = await Promise.all(
        (data || []).map(async (p) => {
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
      setThumbs(Object.fromEntries(entries));
    });
    return () => { alive = false; };
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
          return (
            <div
              key={p.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                overflow: "hidden",
                background: "#fff",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Link
                to={`/projects/${p.id}`}
                style={{ textDecoration: "none", color: "inherit", display: "block" }}
              >
                {p.cover_image && (
                  <img
                    src={p.cover_image}
                    alt={p.title || "project cover"}
                    style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }}
                  />
                )}

                {/* thumbnail strip */}
                {t.length > 0 && (
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
                  <div style={{ fontWeight: 600 }}>{p.title}</div>
                  <div style={{ opacity: 0.7, fontSize: 14 }}>{p.summary}</div>
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>by {p.owner_username}</div>
                </div>
              </Link>

              {/* Edit button (only if logged in + owner) */}
              {authed && isOwner(p) && (
                <div style={{ padding: "0 16px 16px" }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/dashboard?edit=${p.id}`)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: "1px solid #d0d7de",
                      background: "#121826",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Edit in Dashboard
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}