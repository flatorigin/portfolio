import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import { Card } from "../ui";

// small helper (same spirit as your ProjectDetail toUrl)
function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

export default function PublicProfile() {
  const { username } = useParams();
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setBusy(true);
      setError("");
      try {
        const { data } = await api.get(`/public/${username}/`);
        if (!cancelled) setPayload(data);
      } catch (err) {
        console.error("[PublicProfile] fetch failed:", err?.response || err);
        const msg =
          err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "Could not load this profile.";
        if (!cancelled)
          setError(typeof msg === "string" ? msg : JSON.stringify(msg));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [username]);

  const user = payload?.user || null;
  const projects = Array.isArray(payload?.projects) ? payload.projects : [];
  const selectedComments = Array.isArray(payload?.selected_comments)
    ? payload.selected_comments
    : [];

  const bannerStyle = useMemo(() => {
    const url = toUrl(user?.banner_url);
    if (!url) return {};
    return {
      backgroundImage: `url(${url})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }, [user?.banner_url]);

  if (busy) {
    return <div className="p-8 text-center text-slate-600">Loading…</div>;
  }

  if (error) {
    return (
      <div className="p-8 mx-auto max-w-4xl">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
        <div className="mt-4">
          <Link className="text-sm text-blue-600 hover:underline" to="/">
            ← Back to Explore
          </Link>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div className="p-8 text-center text-slate-600">Profile not found.</div>;
  }

  const displayName = user.company_name || user.full_name || user.username;

  // TEMP: local toggle (later will be backend-based)
  const enabled = localStorage.getItem("public_profile_enabled") !== "false";
  if (!enabled) {
    return (
      <div className="p-8 text-center text-slate-600">
        This profile is not public.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* FULL-WIDTH TOP BANNER (200px, spans browser width) */}
      <div className="relative w-full">
        {/* 200px banner */}
        <div
          className="h-[300px] w-full bg-slate-900"
          style={bannerStyle}
          aria-label="Profile banner"
        />

        {/* overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* banner content aligned to centered container */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-4 pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-end gap-4">
                {/* logo */}
                <div className="-mb-6 h-24 w-24 overflow-hidden rounded-2xl border border-white/40 bg-white shadow-lg">
                  {user.logo_url ? (
                    <img
                      src={toUrl(user.logo_url)}
                      alt="Company logo"
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
                    @{user.username}
                    {user.location ? (
                      <>
                        <span className="mx-2">•</span>
                        <span>{user.location}</span>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* actions */}
              <div className="flex gap-2 sm:pb-1">
                <Link
                  to="/"
                  className="rounded-full bg-white/10 px-4 py-2 text-sm text-white backdrop-blur hover:bg-white/20"
                >
                  Explore
                </Link>

                <Link
                  to={`/messages?to=${user.username}`}
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
        {/* BIO */}
        <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-2xl border border-slate-200 shadow-sm">
            <div className="p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                About
              </div>
              <div className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-slate-700">
                {user.bio ? user.bio : "No bio added yet."}
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
                  <span className="font-medium">{user.username}</span>
                </div>
                <div>
                  <span className="text-slate-500">Company:</span>{" "}
                  <span className="font-medium">{user.company_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500">Location:</span>{" "}
                  <span className="font-medium">{user.location || "—"}</span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* PROJECT GALLERY */}
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
              No projects yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => {
                const cover =
                  p?.cover_image ||
                  p?.hero_image ||
                  p?.thumbnail ||
                  (Array.isArray(p?.images) && p.images[0]?.url) ||
                  null;

                return (
                  <Link
                    key={p.id}
                    to={`/projects/${p.id}`}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="h-44 bg-slate-100">
                      {cover ? (
                        <img
                          src={toUrl(cover)}
                          alt={p.title || ""}
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
                );
              })}
            </div>
          )}
        </div>

        {/* SELECTED COMMENTS (placeholder for now, but wired) */}
        <div className="mt-12">
          <div className="mb-3 text-lg font-semibold text-slate-900">
            Selected Comments
          </div>

          {selectedComments.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              No featured comments yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {selectedComments.map((c, idx) => (
                <Card
                  key={c.id || idx}
                  className="rounded-2xl border border-slate-200 shadow-sm"
                >
                  <div className="p-5">
                    <div className="whitespace-pre-line text-sm text-slate-700">
                      {c.text}
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                      — {c.author_username || "Anonymous"}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
