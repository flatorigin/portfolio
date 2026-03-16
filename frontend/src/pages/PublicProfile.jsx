// =======================================
// file: frontend/src/pages/PublicProfile.jsx
// Public profile + projects + contact + map
// Hero/banner is read from /profiles/:username/ only (public)
// Adds: Like/Save profile button (hidden on own profile) + like count
// Fix: ALL hooks are declared before any early return
// =======================================
import { useParams, Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { Card } from "../ui";
import ServiceAreaMap from "../components/ServiceAreaMap";
import QuickMessageDrawer from "../components/QuickMessageDrawer";

function toUrl(raw) {
  if (!raw) return "";
  if (/^(data:|blob:)/i.test(raw)) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;

  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

// Try to find a hero/banner-like field on the profile object
function extractHeroFromProfile(profile) {
  if (!profile) return "";

  const explicitKeys = [
    "banner_url",
    "banner",
    "hero_url",
    "hero",
    "header_image",
    "profile_banner",
    "profile_header",
  ];

  for (const k of explicitKeys) {
    if (typeof profile[k] === "string" && profile[k].trim()) return profile[k];
  }

  for (const key of Object.keys(profile)) {
    const lower = key.toLowerCase();
    if (lower.includes("banner") || lower.includes("hero")) {
      const val = profile[key];
      if (typeof val === "string" && val.trim()) return val;
    }
  }

  return "";
}

export default function PublicProfile() {
  const { username } = useParams();

  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [coversByProject, setCoversByProject] = useState({});
  const [loading, setLoading] = useState(true);

  const [msgOpen, setMsgOpen] = useState(false);

  // Like state (MUST be above returns)
  const authed = !!localStorage.getItem("access");
  const meUsernameLower = (localStorage.getItem("username") || "").toLowerCase();

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);

  const displayName = useMemo(() => {
    return profile?.display_name || profile?.username || "";
  }, [profile?.display_name, profile?.username]);

  const avatarSrc = useMemo(() => {
    return toUrl(profile?.logo || profile?.avatar_url || profile?.avatar || "");
  }, [profile?.logo, profile?.avatar_url, profile?.avatar]);

  const bannerUrl = useMemo(() => {
    const raw = extractHeroFromProfile(profile);
    return toUrl(raw || "");
  }, [profile]);

  const bannerStyle = useMemo(() => {
    if (!bannerUrl) return {};
    return {
      backgroundImage: `url(${bannerUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }, [bannerUrl]);

  const isMine = useMemo(() => {
    return (profile?.username || "").toLowerCase() === meUsernameLower;
  }, [profile?.username, meUsernameLower]);

  async function hydrateCovers(list) {
    const entries = await Promise.all(
      (Array.isArray(list) ? list : []).map(async (p) => {
        try {
          const { data } = await api.get(`/projects/${p.id}/images/`);
          const imgs = Array.isArray(data) ? data : [];

          const mapped = imgs
            .map((it) => ({
              url: toUrl(it.url || it.image || it.src || it.file || ""),
              order: it.order ?? it.sort_order ?? null,
            }))
            .filter((x) => !!x.url);

          const cover =
            mapped.find((x) => Number(x.order) === 0)?.url ||
            mapped[0]?.url ||
            null;

          return [p.id, cover];
        } catch {
          return [p.id, null];
        }
      })
    );

    setCoversByProject(Object.fromEntries(entries));
  }

  // Load profile + projects
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

        const rawList = Array.isArray(projData)
          ? projData
          : Array.isArray(projData?.results)
          ? projData.results
          : [];

        const uname = String(username || "").toLowerCase();

        const visibleProjects = rawList.filter((p) => {
          const ownerU = String(
            p?.owner_username || p?.owner?.username || ""
          ).toLowerCase();

          const isPublic = p?.is_public === undefined ? true : !!p.is_public;
          return ownerU === uname && isPublic;
        });

        setProfile(prof);
        setProjects(visibleProjects);
        hydrateCovers(visibleProjects);

        // Seed like count from public serializer field (works for anonymous too)
        setLikeCount(Number(prof?.like_count || 0));
      } catch (err) {
        console.error("[PublicProfile] failed to load", err);
        if (!alive) return;
        setProfile(null);
        setProjects([]);
        setCoversByProject({});
        setLikeCount(0);
        setLiked(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [username]);

  // Fetch "liked by me" state (auth-only endpoint) when authed + not my profile
  useEffect(() => {
    let alive = true;

    if (!authed || !profile?.username || isMine) {
      setLiked(false);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const { data } = await api.get(`/profiles/${profile.username}/like/`);
        if (!alive) return;
        setLiked(!!data?.liked);
        // keep count in sync if backend returns it
        if (data?.like_count !== undefined) {
          setLikeCount(Number(data.like_count || 0));
        }
      } catch {
        if (!alive) return;
        setLiked(false);
        // keep likeCount as-is (from profile.like_count)
      }
    })();

    return () => {
      alive = false;
    };
  }, [authed, profile?.username, isMine]);

  async function toggleLike() {
    if (!authed || !profile?.username || likeBusy || isMine) return;

    setLikeBusy(true);
    try {
      if (liked) {
        const { data } = await api.delete(`/profiles/${profile.username}/like/`);
        setLiked(false);
        if (data?.like_count !== undefined) setLikeCount(Number(data.like_count || 0));
      } else {
        const { data } = await api.post(`/profiles/${profile.username}/like/`);
        setLiked(true);
        if (data?.like_count !== undefined) setLikeCount(Number(data.like_count || 0));
      }
      window.dispatchEvent(new CustomEvent("profiles:liked_changed"));
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not update like.");
    } finally {
      setLikeBusy(false);
    }
  }

  // ----- EARLY RETURNS (after hooks) -----
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
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* FULL-WIDTH TOP BANNER */}
      <div className="relative w-full">
        <div
          className="h-[600px] w-full bg-slate-900"
          style={bannerStyle}
          aria-label="Profile banner"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />

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

              <div className="flex flex-wrap items-center gap-2 sm:pb-1">
                {/* Like button (hidden on own profile) */}
                {!isMine ? (
                  <button
                    type="button"
                    onClick={toggleLike}
                    disabled={!authed || likeBusy}
                    className={
                      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium backdrop-blur " +
                      (liked
                        ? "bg-white text-slate-900 hover:bg-slate-100"
                        : "bg-white/10 text-white hover:bg-white/20") +
                      (!authed ? " opacity-70" : "")
                    }
                    title={!authed ? "Log in to like profiles" : "Like this profile"}
                  >
                    <span aria-hidden>{liked ? "♥" : "♡"}</span>
                    <span>{liked ? "Liked" : "Like"}</span>
                    <span className={liked ? "text-slate-700" : "text-white/80"}>
                      {Number.isFinite(likeCount) ? likeCount : 0}
                    </span>
                  </button>
                ) : null}

                {/* Message button */}
                <button
                  type="button"
                  onClick={() => setMsgOpen(true)}
                  className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
                >
                  Message
                </button>
              </div>
            </div>

            {!authed && !isMine ? (
              <div className="mt-3 text-[11px] text-white/80">
                Log in to like this profile.
              </div>
            ) : null}
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

        <div className="mt-6">
          <ServiceAreaMap
            locationQuery={profile?.service_location || ""}
            radiusMiles={profile?.coverage_radius_miles || ""}
            heightClassName="h-64"
          />
        </div>

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
              {projects.map((p) => {
                const coverSrc =
                  coversByProject[p.id] ||
                  toUrl(p.cover_image_url || "") ||
                  (p.cover_image ? toUrl(p.cover_image) : "");

                return (
                  <Link
                    key={p.id}
                    to={`/projects/${p.id}`}
                    className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="h-44 bg-slate-100">
                      {coverSrc ? (
                        <img
                          src={coverSrc}
                          alt={p.title || "project cover"}
                          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.png";
                          }}
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
      </div>

      <QuickMessageDrawer
        open={msgOpen}
        onClose={() => setMsgOpen(false)}
        recipientUsername={profile?.username}
        recipientDisplayName={displayName}
      />
    </div>
  );
}