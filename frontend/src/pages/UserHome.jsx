// =======================================
// file: frontend/src/pages/UserHome.jsx
// Immersive user home page with banner + projects
// =======================================
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import { Card, Button, GhostButton } from "../ui";

function Avatar({ src, fallback }) {
  if (src) {
    return (
      <img
        src={src}
        alt={fallback}
        className="h-16 w-16 rounded-2xl object-cover shadow-lg ring-2 ring-white/70"
      />
    );
  }

  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-xl font-semibold text-white shadow-lg ring-2 ring-white/70">
      {fallback?.charAt(0)?.toUpperCase() || "?"}
    </div>
  );
}

function ProjectCard({ project }) {
  return (
    <Link
      to={`/projects/${project.id}`}
      className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl"
    >
      {project.cover_image ? (
        <div className="relative h-44 overflow-hidden">
          <img
            src={project.cover_image}
            alt={project.title || "Project cover"}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/15 to-transparent" />
        </div>
      ) : (
        <div className="flex h-44 items-center justify-center bg-slate-100 text-slate-400">
          No image
        </div>
      )}

      <div className="space-y-2 p-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium">
            {project.owner_username || "Profile"}
          </span>
          {project.location && <span>{project.location}</span>}
        </div>
        <h3 className="line-clamp-1 text-lg font-semibold text-slate-900">
          {project.title}
        </h3>
        <p className="line-clamp-2 text-sm text-slate-600">
          {project.summary || "No summary provided yet."}
        </p>
      </div>
    </Link>
  );
}

export default function UserHome() {
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

        const visible = Array.isArray(projData)
          ? projData.filter(
              (p) =>
                p.owner_username === username &&
                (p.is_public === undefined || p.is_public === true)
            )
          : [];

        setProfile(prof);
        setProjects(visible);
      } catch (err) {
        console.error("[UserHome] failed to load", err);
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

  const displayName = profile?.display_name || profile?.username || username;
  const heroVisual = useMemo(() => {
    const cover = projects.find((p) => p.cover_image);
    return cover?.cover_image || profile?.avatar_url || profile?.logo || null;
  }, [projects, profile]);

  if (loading && !profile) {
    return (
      <div className="space-y-4">
        <div className="h-64 animate-pulse rounded-3xl bg-slate-200" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <Card className="p-6 text-center text-sm text-slate-600">
        Profile not found. 
        <Link to="/" className="text-blue-600 hover:underline">
          Back to Explore
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 text-white shadow-xl">
        <div className="relative isolate">
          {heroVisual ? (
            <img
              src={heroVisual}
              alt="Hero visual"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-800" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/50" />

          <div className="relative px-8 py-10 md:px-12 md:py-14">
            <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="flex items-center gap-4 md:items-start">
                <Avatar src={profile.avatar_url || profile.logo} fallback={displayName} />
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-200/80">
                    Portfolio of
                  </p>
                  <h1 className="text-3xl font-bold leading-tight md:text-4xl">
                    {displayName}
                  </h1>
                  {profile.service_location && (
                    <p className="text-sm text-slate-200/80">
                      Based in {profile.service_location}
                      {profile.coverage_radius_miles
                        ? ` · ~${profile.coverage_radius_miles} mile radius`
                        : ""}
                    </p>
                  )}
                  {profile.bio && (
                    <p className="max-w-2xl text-sm text-slate-100/90">
                      {profile.bio}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-200/80">
                    <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                      @{profile.username}
                    </span>
                    <span className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white">
                      {projects.length} project{projects.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {profile.contact_email && (
                  <Button
                    as="a"
                    href={`mailto:${profile.contact_email}`}
                    className="bg-white text-slate-900 hover:opacity-90"
                  >
                    Email {displayName}
                  </Button>
                )}
                {profile.contact_phone && (
                  <GhostButton
                    as="a"
                    href={`tel:${profile.contact_phone}`}
                    className="border-white/60 bg-white/10 text-white hover:bg-white/20"
                  >
                    Call {profile.contact_phone}
                  </GhostButton>
                )}
                <GhostButton as="a" href="#projects" className="border-white/60 bg-white/10 text-white hover:bg-white/20">
                  View projects ↓
                </GhostButton>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="projects" className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-slate-900">Projects by {displayName}</h2>
          <p className="text-sm text-slate-600">
            A curated selection of {profile.display_name || profile.username}'s work.
          </p>
        </div>

        {projects.length === 0 ? (
          <Card className="p-6 text-sm text-slate-600">
            No public projects yet.
          </Card>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-5">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}