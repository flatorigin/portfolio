// frontend/src/pages/PublicProfile.jsx
import { useParams, Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { Card } from "../ui";

function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

function buildMapSrc(location) {
  if (!location) return null;
  const q = encodeURIComponent(location);
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

  // ✅ Hooks MUST be above any early return
  const displayName = useMemo(() => {
    return profile?.display_name || profile?.username || "";
  }, [profile?.display_name, profile?.username]);

  const avatarSrc = useMemo(() => {
    return toUrl(profile?.logo || profile?.avatar_url || profile?.avatar || "");
  }, [profile?.logo, profile?.avatar_url, profile?.avatar]);

  const bannerStyle = useMemo(() => {
    const url = toUrl(profile?.banner_url || profile?.banner || "");
    if (!url) return {};
    return {
      backgroundImage: `url(${url})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }, [profile?.banner_url, profile?.banner]);

  const mapSrc = useMemo(() => {
    return buildMapSrc(profile?.service_location || "");
  }, [profile?.service_location]);

  // ✅ Now early returns are safe
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

  return (
    <div className="min-h-screen bg-white pt-0">
      {/* FULL-WIDTH TOP BANNER */}
      <div className="relative w-full mt-0 pt-0">
        <div
          className="h-[300px] w-full bg-slate-900"
          style={bannerStyle}
          aria-label="Profile banner"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-4 pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                <div className="-mb-6 h-24 w-24 overflow-hidden rounded-2xl border border-white/40 bg-white shadow-lg">
                  {avatarSrc ? (
                    <img
                      src={avatarSrc}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-slate-500">
                      LOGO
                    </div>
                  )}
                </div>

                <div className="text-white">
                  <div className="text-2xl font-semibold sm:text-3xl">
                    {displayName}
                  </div>
                  <div className="mt-1 text-xs text-white/80">
                    @{profile.username}
                    {profile.service_location ? (
                      <>
                        <span className="mx-2">•</span>
                        <span>{profile.service_location}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 sm:pb-1">
                <Link
                  to="/"
                  className="rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur hover:bg-white/20"
                >
                  Explore
                </Link>
                <Link
                  to={`/messages?to=${profile.username}`}
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
                >
                  Message
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-12">
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                About
              </div>
              <div className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">
                {profile.bio ? profile.bio : "No bio added yet."}
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Quick info
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <div>
                  <span className="text-slate-500">Username:</span>{" "}
                  <span className="font-medium">{profile.username}</span>
                </div>
                <div>
                  <span className="text-slate-500">Service area:</span>{" "}
                  <span className="font-medium">
                    {profile.service_location || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Email:</span>{" "}
                  {profile.contact_email ? (
                    <a
                      href={`mailto:${profile.contact_email}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {profile.contact_email}
                    </a>
                  ) : (
                    <span className="font-medium">—</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500">Phone:</span>{" "}
                  <span className="font-medium">
                    {profile.contact_phone || "—"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {mapSrc && (
          <div className="mt-8">
            <Card className="rounded-2xl border border-slate-200 shadow-sm">
              <div className="p-6">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Service area map
                </div>
                <div className="mt-4 aspect-[4/3] overflow-hidden rounded-xl border border-slate-200">
                  <iframe
                    src={mapSrc}
                    title="Service area map"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-full w-full border-0"
                  />
                </div>
              </div>
            </Card>
          </div>
        )}

        <div className="mt-10">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-900">
                Project Gallery
              </div>
              <div className="text-xs text-slate-500">
                {projects.length} project{projects.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-600">
              No public projects published yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                >
                  <div className="h-44 bg-slate-100">
                    {p.cover_image ? (
                      <img
                        src={toUrl(p.cover_image)}
                        alt={p.title || "project cover"}
                        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-slate-500">
                        No image
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {p.title || `Project #${p.id}`}
                    </div>
                    {p.summary ? (
                      <div className="mt-1 line-clamp-2 text-xs text-slate-600">
                        {p.summary}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-slate-500">
                        View details →
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
