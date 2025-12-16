// =======================================
// file: frontend/src/pages/PublicProfile.jsx
// Public profile + projects + contact + map
// =======================================
import { useParams, Link, useLocation, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { Card, Container } from "../ui";

// Map helper (zip / city / address → Google Maps embed)
function buildMapSrc(location) {
  if (!location) return null;
  const q = encodeURIComponent(location);
  // z=11 → nice “service area” zoom
  return `https://www.google.com/maps?q=${q}&z=11&output=embed`;
}

export default function PublicProfile() {
  const { username } = useParams();
  const location = useLocation();
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const authed = !!localStorage.getItem("access");
  const [searchParams] = useSearchParams();
  const fromProjectId =
    location.state?.fromProjectId || searchParams.get("fromProjectId") || null;

  useEffect(() => {
    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const [{ data: prof }, { data: projData }] = await Promise.all([
          api.get(`/profiles/${username}/`),
          api.get(`/projects/?owner=${username}`),
        ]);

        if (!alive) return;

        const visibleProjects = Array.isArray(projData)
          ? projData.filter(
              (p) =>
                p.owner_username === username &&
                (p.is_public === undefined || p.is_public === true)
            )
          : [];

        setProfile(prof);
        setProjects(visibleProjects);
      } catch (err) {
        console.error("[PublicProfile] failed to load", err);
        if (!alive) return;
        setProfile(null);
        setProjects([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [username]);

  const mapSrc = useMemo(
    () => buildMapSrc(profile?.service_location || ""),
    [profile]
  );

  if (loading && !profile) {
    return <div className="text-sm text-slate-500">Loading profile…</div>;
  }

  if (!profile) {
    return (
      <div className="text-sm text-slate-600">
        Profile not found.{" "}
        <Link to="/" className="text-blue-600 hover:underline">
          Back to Explore
        </Link>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username;
  const avatarSrc = profile.avatar_url || profile.logo || null;
  const coverImage =
    profile.cover_image || profile.cover_photo || profile.cover || null;

  return (
    <div className="space-y-8">
      {/* BANNER */}
      <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2">
        <div className="relative h-[300px] w-full overflow-hidden bg-slate-200">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={
              coverImage
                ? { backgroundImage: `url(${coverImage})` }
                : {
                    backgroundImage:
                      "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 40%, #94a3b8 100%)",
                  }
            }
          />
        ) : (
          <div className="absolute inset-0 bg-slate-900/20" />
          <div className="absolute left-1/2 top-[200px] w-full -translate-x-1/2">
            <Container className="flex items-center">
              <div className="rounded-full bg-white p-1 shadow-lg">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-xl font-semibold text-slate-700">
                    {displayName?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                )}
              </div>
            </Container>
          </div>
        </div>
      </div>
      {/* HEADER */}
      <header className="flex flex-wrap items-start gap-4">

        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-slate-900">
            {displayName}
          </h1>
          {profile.service_location && (
            <div className="mt-1 text-sm text-slate-600">
              Serves: {profile.service_location}
              {profile.coverage_radius_miles
                ? ` · ~${profile.coverage_radius_miles} mi radius`
                : ""}
            </div>
          )}
          {profile.bio && (
            <p className="mt-2 max-w-2xl text-sm text-slate-700">
              {profile.bio}
            </p>
          )}
          <div className="mt-2 text-xs text-slate-500">
            Profile URL:{" "}
            <span className="font-mono text-[11px]">
              /profiles/{profile.username}
            </span>
          </div>
        </div>
      </header>

      {/* CONTACT + MAP */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* Contact card */}
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">
            Contact
          </h2>
          <div className="space-y-1 text-sm text-slate-700">
            <div>
              <span className="font-medium">Email:</span>{" "}
              {profile.contact_email ? (
                <a
                  href={`mailto:${profile.contact_email}`}
                  className="text-blue-600 hover:underline"
                >
                  {profile.contact_email}
                </a>
              ) : (
                "—"
              )}
            </div>
            <div>
              <span className="font-medium">Phone:</span>{" "}
              {profile.contact_phone || "—"}
            </div>
          </div>
        </Card>

        {/* Map card */}
        {mapSrc && (
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Service area
            </h2>
            <div className="aspect-[4/3] overflow-hidden rounded-xl border border-slate-200">
              <iframe
                src={mapSrc}
                title="Service area map"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
              />
            </div>
          </Card>
        )}
      </div>

      {/* PROJECTS */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Projects</h2>

        {projects.length === 0 ? (
          <p className="text-sm text-slate-600">
            No public projects published yet.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="block text-inherit no-underline"
              >
                <Card className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
                  {p.cover_image && (
                    <img
                      src={p.cover_image}
                      alt={p.title || "project cover"}
                      className="h-40 w-full object-cover"
                    />
                  )}
                  <div className="p-3">
                    <h3 className="mb-1 truncate text-sm font-semibold text-slate-900">
                      {p.title}
                    </h3>
                    <p className="line-clamp-2 text-xs text-slate-600">
                      {p.summary || "No summary provided."}
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
