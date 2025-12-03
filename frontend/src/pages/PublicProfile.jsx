// =======================================
// file: frontend/src/pages/PublicProfile.jsx
// Public profile at /u/:username
// =======================================
import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api";
import { Card } from "../ui";

export default function PublicProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");

    async function load() {
      try {
        const [profRes, projRes] = await Promise.all([
          api.get(`/profiles/${encodeURIComponent(username)}/`),
          api.get(`/projects/?owner=${encodeURIComponent(username)}`),
        ]);

        if (!alive) return;

        setProfile(profRes.data || null);

        const arr = Array.isArray(projRes.data) ? projRes.data : [];
        setProjects(
          arr.filter(
            (p) => p.owner_username === username && p.is_public
          )
        );
      } catch (err) {
        if (!alive) return;
        console.error("[PublicProfile] load error", err?.response || err);
        setError("Unable to load this profile.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [username]);

  if (loading) {
    return <p className="text-sm text-slate-600">Loading profile…</p>;
  }

  if (error || !profile) {
    return (
      <p className="text-sm text-red-600">
        {error || "Profile not found."}
      </p>
    );
  }

  const displayName = profile.display_name || profile.username;
  const avatarSrc = profile.avatar_url || profile.logo || "";
  const initial = displayName?.charAt(0)?.toUpperCase() || "?";

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <header className="flex items-center gap-4">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={displayName}
            className="h-20 w-20 rounded-full border border-slate-200 object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-2xl font-semibold text-slate-700">
            {initial}
          </div>
        )}

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            {displayName}
          </h1>
          {profile.service_location && (
            <div className="text-sm text-slate-600">
              {profile.service_location}
            </div>
          )}
        </div>
      </header>

      {/* CONTACT CARD */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          Contact
        </h2>
        <Card className="max-w-sm p-4">
          <div className="space-y-1 text-sm text-slate-700">
            <div>
              <span className="font-semibold">Email:</span>{" "}
              {profile.contact_email || "—"}
            </div>
            <div>
              <span className="font-semibold">Phone:</span>{" "}
              {profile.contact_phone || "—"}
            </div>
          </div>
        </Card>
      </section>

      {/* MESSAGE LABEL (you can hook a form or CTA here later) */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          Message this profile
        </h2>
        <p className="text-xs text-slate-500">
          Start a private conversation from any project page using the
          “Private inquiries” box.
        </p>
      </section>

      {/* PROJECTS GRID */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Projects
        </h2>

        {projects.length === 0 ? (
          <p className="text-sm text-slate-600">
            No public projects yet.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="block text-inherit no-underline"
              >
                <Card className="overflow-hidden">
                  {p.cover_image && (
                    <img
                      src={p.cover_image}
                      alt={p.title || "Project cover"}
                      className="h-40 w-full object-cover"
                    />
                  )}
                  <div className="p-3">
                    <h3 className="mb-1 text-sm font-semibold text-slate-900">
                      {p.title}
                    </h3>
                    <p className="line-clamp-2 text-xs text-slate-600">
                      {p.summary}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
