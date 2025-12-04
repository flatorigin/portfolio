// frontend/src/pages/PublicProfile.jsx
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import api from "../api";
import { Card } from "../ui";

function buildMapSrc(location) {
  if (!location) return null;
  const q = encodeURIComponent(location);
  // Center map on ZIP / city; z=11 is a “regional” zoom
  return `https://www.google.com/maps?q=${q}&z=11&output=embed`;
}

export default function PublicProfile() {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const [{ data: prof }, { data: proj }] = await Promise.all([
          api.get(`/profiles/${username}/`),
          api.get(`/projects/?owner=${username}`),
        ]);

        if (!alive) return;

        setProfile(prof);
        const arr = Array.isArray(proj) ? proj : [];
        setProjects(
          arr.filter(
            (p) => p.owner_username === username && p.is_public
          )
        );
      } catch (err) {
        console.error("[PublicProfile] load error", err);
        if (alive) {
          setProfile(null);
          setProjects([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [username]);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading profile…</p>;
  }

  if (!profile) {
    return (
      <p className="text-sm text-slate-600">
        This profile could not be found.
      </p>
    );
  }

  const mapSrc = buildMapSrc(profile.service_location);
  const radiusLabel =
    profile.coverage_radius_miles != null
      ? `${profile.coverage_radius_miles} mile${
          profile.coverage_radius_miles === 1 ? "" : "s"
        }`
      : null;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <header className="flex flex-wrap items-center gap-4">
        {profile.avatar_url && (
          <img
            src={profile.avatar_url}
            alt={profile.display_name || profile.username}
            className="h-20 w-20 rounded-full object-cover"
          />
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-slate-900">
            {profile.display_name || profile.username}
          </h1>
          {profile.bio && (
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {profile.bio}
            </p>
          )}
        </div>
      </header>

      {/* CONTACT + SERVICE AREA + MAP */}
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Contact + service text */}
          <div className="space-y-3">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Contact
              </div>
              <p className="text-sm text-slate-700">
                <span className="font-medium">Email:</span>{" "}
                {profile.contact_email || "—"}
              </p>
              <p className="text-sm text-slate-700">
                <span className="font-medium">Phone:</span>{" "}
                {profile.contact_phone || "—"}
              </p>
            </div>

            {(profile.service_location || radiusLabel) && (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Service area
                </div>
                <p className="text-sm text-slate-700">
                  {profile.service_location ? (
                    <>
                      Serving{" "}
                      {radiusLabel ? (
                        <span>{radiusLabel} around </span>
                      ) : (
                        "around "
                      )}
                      <span className="font-medium">
                        {profile.service_location}
                      </span>
                      .
                    </>
                  ) : (
                    "Service area not specified."
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Tip: in Edit Profile, use a ZIP code (e.g. 19063) or city
                  name for the service location so the map can find it.
                </p>
              </div>
            )}
          </div>

          {/* Map */}
          {mapSrc && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <div className="h-64 w-full">
                <iframe
                  title="Service area map"
                  src={mapSrc}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* PROJECTS */}
      <section>
        <h2 className="mb-3 text-base font-semibold text-slate-900">
          Projects
        </h2>

        {projects.length === 0 ? (
          <p className="text-sm text-slate-600">
            No public projects yet.
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                {p.cover_image && (
                  <img
                    src={p.cover_image}
                    alt={p.title || "project cover"}
                    className="h-40 w-full object-cover"
                  />
                )}
                <div className="p-3">
                  <h3 className="mb-1 text-sm font-semibold text-slate-900">
                    {p.title}
                  </h3>
                  <p className="line-clamp-2 text-xs text-slate-600">
                    {p.summary || "No description provided."}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
