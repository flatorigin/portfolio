// =======================================
// file: frontend/src/pages/PublicProfile.jsx
// Public profile + projects + contact + map
// Hero/banner is read from /profiles/:username/ only (public)
// Adds: Like/Save profile button (hidden on own profile) + like count
// Adds: Hero headline + blurb on banner
// Fix: ALL hooks are declared before any early return
// Contact card uses member-since + languages + filtered public contact info
// =======================================
import { useParams, Link } from "react-router-dom";
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import api from "../api";
import { Card } from "../ui";

const ServiceAreaMap = lazy(() => import("../components/ServiceAreaMap"));
const QuickMessageDrawer = lazy(() => import("../components/QuickMessageDrawer"));

function DisabledActionWithTooltip({ label, message }) {
  return (
    <div className="group relative">
      <button
        type="button"
        disabled
        className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-400"
      >
        {label}
      </button>

      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
        {message}
      </div>
    </div>
  );
}

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
  const [loading, setLoading] = useState(true);

  const [msgOpen, setMsgOpen] = useState(false);
  const [messageContext, setMessageContext] = useState(null);

  // Like state (MUST be above returns)
  const authed = !!localStorage.getItem("access");
  const meUsernameLower = (localStorage.getItem("username") || "").toLowerCase();

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeBusy, setLikeBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const shouldRenderMap = Boolean(profile?.service_location);
  const isHomeownerProfile = profile?.profile_type === "homeowner";

  const displayName = useMemo(() => {
    return profile?.display_name || profile?.username || "";
  }, [profile?.display_name, profile?.username]);

  const avatarSrc = useMemo(() => {
    return toUrl(
      profile?.logo_url ||
        profile?.logo ||
        profile?.avatar_url ||
        profile?.avatar ||
        ""
    );
  }, [profile?.logo_url, profile?.logo, profile?.avatar_url, profile?.avatar]);

  const bannerUrl = useMemo(() => {
    const raw = extractHeroFromProfile(profile);
    return toUrl(raw || "");
  }, [profile]);

  const heroHeadline = useMemo(() => {
    return (
      (profile?.hero_headline || "").trim() ||
      "We’re changing the way contractors connect"
    );
  }, [profile?.hero_headline]);

  const heroBlurb = useMemo(() => {
    return (
      (profile?.hero_blurb || "").trim() ||
      "Connect directly with local pros who let their craftsmanship do the talking through full portfolios and transparent contact info. Skip the middleman and the sales pitches—just real conversations with contractors ready to bridge the gap on your specific project. Browse, ask questions, and hire the right expert for your home without the usual hassle."
    );
  }, [profile?.hero_blurb]);

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

  const memberSince = useMemo(() => {
    return (
      profile?.member_since_label ||
      profile?.member_since ||
      profile?.joined_label ||
      "—"
    );
  }, [profile?.member_since_label, profile?.member_since, profile?.joined_label]);

  const jobPostingProjects = useMemo(() => {
    return projects.filter((p) => !!p?.is_job_posting);
  }, [projects]);

  const languagesDisplay = useMemo(() => {
    if (profile?.languages_display?.trim()) return profile.languages_display.trim();
    if (Array.isArray(profile?.languages) && profile.languages.length > 0) {
      return profile.languages.filter(Boolean).join(", ");
    }
    return "—";
  }, [profile?.languages_display, profile?.languages]);

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

        // Seed like count from public serializer field
        setLikeCount(Number(prof?.like_count || 0));
        setLiked(!!prof?.liked_by_me);
        setSaved(!!prof?.saved_by_me);
      } catch (err) {
        console.error("[PublicProfile] failed to load", err);
        if (!alive) return;
        setProfile(null);
        setProjects([]);
        setLikeCount(0);
        setLiked(false);
        setSaved(false);
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
        if (data?.like_count !== undefined) {
          setLikeCount(Number(data.like_count || 0));
        }
      } catch {
        if (!alive) return;
        setLiked(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authed, profile?.username, isMine]);

  useEffect(() => {
    let alive = true;

    if (!authed || !profile?.username || isMine) {
      setSaved(false);
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const { data } = await api.get(`/profiles/${profile.username}/save/`);
        if (!alive) return;
        setSaved(!!data?.saved);
      } catch {
        if (!alive) return;
        setSaved(false);
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
        if (data?.like_count !== undefined) {
          setLikeCount(Number(data.like_count || 0));
        }
      } else {
        const { data } = await api.post(`/profiles/${profile.username}/like/`);
        setLiked(true);
        if (data?.like_count !== undefined) {
          setLikeCount(Number(data.like_count || 0));
        }
      }
      window.dispatchEvent(new CustomEvent("profiles:liked_changed"));
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not update like.");
    } finally {
      setLikeBusy(false);
    }
  }

  async function toggleSave() {
    if (!authed || !profile?.username || saveBusy || isMine) return;

    setSaveBusy(true);
    try {
      if (saved) {
        const { data } = await api.delete(`/profiles/${profile.username}/save/`);
        setSaved(!!data?.saved);
      } else {
        const { data } = await api.post(`/profiles/${profile.username}/save/`);
        setSaved(!!data?.saved);
      }
      window.dispatchEvent(new CustomEvent("profiles:saved_changed"));
    } catch (e) {
      alert(e?.response?.data?.detail || "Could not update saved state.");
    } finally {
      setSaveBusy(false);
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
        <Link to="/explore" className="text-blue-600 hover:underline">
          Back to Explore
        </Link>
      </div>
    );
  }

  if (isHomeownerProfile && jobPostingProjects.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-slate-600">
        This homeowner profile is private until there is a public job posting.
        {" "}
        <Link to="/work" className="text-blue-600 hover:underline">
          Browse job postings
        </Link>
      </div>
    );
  }

  if (isHomeownerProfile) {
    return (
      <div className="min-h-screen bg-[#FBF9F7]">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid gap-6 md:grid-cols-[1.25fr_0.75fr]">
            <Card className="rounded-2xl border border-slate-200 shadow-sm">
              <div className="p-6">
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-slate-900">
                      Job Postings
                    </div>
                    <div className="text-xs text-slate-500">
                      {jobPostingProjects.length} public job posting
                      {jobPostingProjects.length === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  {jobPostingProjects.map((p) => {
                    const coverSrc =
                      toUrl(p.cover_image_url || "") ||
                      (p.cover_image ? toUrl(p.cover_image) : "");

                    return (
                      <div
                        key={p.id}
                        className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                      >
                        <Link to={`/projects/${p.id}`} className="block">
                          <div className="h-44 bg-slate-100">
                            {coverSrc ? (
                              <img
                                src={coverSrc}
                                alt={p.title || "job posting cover"}
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
                            {p.summary || p.job_summary ? (
                              <div className="mt-1 line-clamp-2 text-xs text-slate-600">
                                {p.summary || p.job_summary}
                              </div>
                            ) : (
                              <div className="mt-1 text-xs text-slate-500">
                                View details →
                              </div>
                            )}
                          </div>
                        </Link>

                        <div className="flex gap-2 border-t border-slate-100 p-4 pt-3">
                          <Link
                            to={`/projects/${p.id}`}
                            className="flex-1 rounded-xl border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            View job
                          </Link>
                          {!isMine ? (
                            <button
                              type="button"
                              onClick={() => {
                                setMessageContext({
                                  projectId: p.id,
                                  projectTitle: p.title || `Project #${p.id}`,
                                });
                                setMsgOpen(true);
                              }}
                              disabled={!profile.allow_direct_messages}
                              className={[
                                "flex-1 rounded-xl px-4 py-2 text-sm font-medium transition",
                                profile.allow_direct_messages
                                  ? "bg-sky-600 text-white hover:bg-sky-700"
                                  : "cursor-not-allowed bg-slate-200 text-slate-400",
                              ].join(" ")}
                            >
                              Message
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border border-slate-200 shadow-sm">
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Contact
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">
                      {profile.display_name || profile.username}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Since {memberSince}
                    </p>
                  </div>

                  <span
                    className={[
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                      profile.profile_status === "complete"
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                        : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
                    ].join(" ")}
                  >
                    {profile.profile_status === "complete"
                      ? "Profile Complete"
                      : "Incomplete Profile"}
                  </span>
                </div>

                <div className="mt-5 overflow-hidden rounded-2xl bg-white">
                  <div className="px-6 py-5">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Languages
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-900">
                      {languagesDisplay}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (profile.allow_direct_messages) {
                        setMessageContext(null);
                        setMsgOpen(true);
                      }
                    }}
                    disabled={!profile.allow_direct_messages || isMine}
                    className={[
                      "w-full rounded-xl px-4 py-3 text-sm font-medium transition",
                      profile.allow_direct_messages && !isMine
                        ? "bg-sky-600 text-white hover:bg-sky-700"
                        : "cursor-not-allowed bg-slate-200 text-slate-400",
                    ].join(" ")}
                  >
                    Message
                  </button>

                  {profile.contact_email ? (
                    <a
                      href={`mailto:${profile.contact_email}`}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Email
                    </a>
                  ) : null}

                  {profile.contact_phone ? (
                    <a
                      href={`tel:${profile.contact_phone}`}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Call
                    </a>
                  ) : null}
                </div>
              </div>
            </Card>
          </div>
        </div>

        {msgOpen ? (
          <Suspense fallback={null}>
            <QuickMessageDrawer
              open={msgOpen}
              onClose={() => setMsgOpen(false)}
              recipientUsername={profile?.username}
              recipientDisplayName={displayName}
              originProjectId={messageContext?.projectId}
              originProjectTitle={messageContext?.projectTitle}
            />
          </Suspense>
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FBF9F7]">
      {/* FULL-WIDTH TOP BANNER */}
      <div className="relative w-full">
        <div
          className="h-[600px] w-full bg-slate-900"
          style={bannerStyle}
          aria-label="Profile banner"
        />

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

        {/* HERO OVERLAY */}
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-4 pb-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              {/* LEFT: headline + blurb + identity */}
              <div className="min-w-0">
                <div className="max-w-2xl pb-[30px] text-white">
                  <div className="text-3xl font-extrabold leading-tight sm:text-5xl">
                    {heroHeadline}
                  </div>
                  <div className="mt-3 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-[15px] -mb-[-20px]">
                    {heroBlurb}
                  </div>
                </div>

                <div className="flex items-end gap-4 -mb-[30px]">
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

                  <div className="min-w-0 text-white">
                    <div className="truncate text-2xl font-semibold sm:text-3xl">
                      {displayName}
                    </div>
                    <div className="mt-1 truncate text-xs text-white/80">
                      @{profile.username}
                      {profile.service_location ? (
                        <>
                          <span className="mx-2">•</span>
                          <span className="truncate">{profile.service_location}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: actions */}
              <div className="flex flex-wrap items-center gap-2 sm:pb-1">
                {!isMine ? (
                  <>
                    {memberSince && memberSince !== "—" ? (
                      <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur">
                        Since {memberSince}
                      </div>
                    ) : null}

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

                    <button
                      type="button"
                      onClick={toggleSave}
                      disabled={!authed || saveBusy}
                      className={
                        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium backdrop-blur " +
                        (saved
                          ? "bg-white text-slate-900 hover:bg-slate-100"
                          : "bg-white/10 text-white hover:bg-white/20") +
                        (!authed ? " opacity-70" : "")
                      }
                      title={!authed ? "Log in to save profiles" : "Save this profile"}
                    >
                      <span aria-hidden>{saved ? "🔖" : "📑"}</span>
                      <span>{saved ? "Saved" : "Save"}</span>
                    </button>
                  </>
                ) : memberSince && memberSince !== "—" ? (
                  <div className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur">
                    Since {memberSince}
                  </div>
                ) : null}
              </div>
            </div>

            {!authed && !isMine ? (
              <div className="mt-3 text-[11px] text-white/80">
                Log in to like or save this profile.
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">
                    {profile.display_name || profile.username}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Since {memberSince}
                  </p>
                </div>

                <span
                  className={[
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                    profile.profile_status === "complete"
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                      : "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
                  ].join(" ")}
                >
                  {profile.profile_status === "complete"
                    ? "Profile Complete"
                    : "Incomplete Profile"}
                </span>
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl bg-white">
                <div className="grid sm:grid-cols-3">
                  <div className="px-6 py-5">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Username
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-900">
                      {profile.username}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 px-6 py-5 sm:border-l sm:border-t-0">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Service area
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-900">
                      {profile.service_location || "—"}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 px-6 py-5 sm:border-l sm:border-t-0">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Languages
                    </div>
                    <div className="mt-2 text-sm font-medium text-slate-900">
                      {languagesDisplay}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="group relative">
                  <button
                    type="button"
                    onClick={() => {
                      if (profile.allow_direct_messages) setMsgOpen(true);
                    }}
                    disabled={!profile.allow_direct_messages}
                    className={[
                      "w-full rounded-xl px-4 py-3 text-sm font-medium transition",
                      profile.allow_direct_messages
                        ? "bg-sky-600 text-white hover:bg-sky-700"
                        : "cursor-not-allowed bg-slate-200 text-slate-400",
                    ].join(" ")}
                  >
                    Message
                  </button>

                  {!profile.allow_direct_messages && (
                    <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      This user has not opted in to receive direct messages.
                    </div>
                  )}
                </div>

                {profile.contact_email ? (
                  <a
                    href={`mailto:${profile.contact_email}`}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Email
                  </a>
                ) : (
                  <div className="group relative">
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-400"
                    >
                      Email
                    </button>

                    <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      This user has not opted in to share their email publicly.
                    </div>
                  </div>
                )}

                {profile.contact_phone ? (
                  <a
                    href={`tel:${profile.contact_phone}`}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Call
                  </a>
                ) : (
                  <div className="group relative">
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-400"
                    >
                      Call
                    </button>

                    <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-center text-xs text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                      This user has not opted in to receive calls.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {shouldRenderMap ? (
          <div className="mt-6">
            <Suspense
              fallback={
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  Loading map…
                </div>
              }
            >
              <ServiceAreaMap
                locationQuery={profile?.service_location || ""}
                radiusMiles={profile?.coverage_radius_miles || ""}
                heightClassName="h-64"
              />
            </Suspense>
          </div>
        ) : null}

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

      {msgOpen ? (
        <Suspense fallback={null}>
          <QuickMessageDrawer
            open={msgOpen}
            onClose={() => setMsgOpen(false)}
            recipientUsername={profile?.username}
            recipientDisplayName={displayName}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
