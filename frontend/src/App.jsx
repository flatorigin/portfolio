// =======================================
// file: frontend/src/App.jsx
// Responsive nav:
// - Mobile/Desktop: role-aware nav + avatar dropdown
// =======================================
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import api from "./api";
import { Container, SymbolIcon } from "./ui";
import { logout } from "./auth";
import { roleLandingPath } from "./landingRole";

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getInboxReadMap() {
  return safeJsonParse(localStorage.getItem("inbox_read_map") || "{}", {});
}

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const location = useLocation();
  const authed = !!localStorage.getItem("access");

  // Full-bleed layouts (e.g. profile hero full-width)
  const isFullBleed =
    pathname === "/" ||
    pathname === "/homeowner" ||
    pathname === "/contractor" ||
    pathname.startsWith("/guides") ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/copyright" ||
    pathname.startsWith("/profiles/") ||
    pathname.startsWith("/public/") ||
    false;
  const hideShellNav =
    pathname === "/" ||
    pathname === "/homeowner" ||
    pathname === "/contractor";

  // user + menu state
  const [me, setMe] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [inboxThreads, setInboxThreads] = useState([]);
  const [inboxReadMap, setInboxReadMap] = useState(() => getInboxReadMap());
  const menuRef = useRef(null);
  const inboxFetchInFlightRef = useRef(false);
  const lastInboxFetchAtRef = useRef(0);

  // --- Fetch /users/me/ when authed ---
  useEffect(() => {
    let cancelled = false;

    if (!authed) {
      setMe(null);
      return;
    }

    (async () => {
      try {
        const { data } = await api.get("/users/me/");
        if (!cancelled) {
          setMe(data);
          if (data?.username) {
            localStorage.setItem("username", data.username);
            window.dispatchEvent(new CustomEvent("auth:changed"));
          }
        }
      } catch (err) {
        console.warn("[App] /users/me/ failed", err?.response || err);
        if (!cancelled) setMe(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authed]);

  // --- Close dropdown on outside click ---
  useEffect(() => {
    if (!menuOpen) return;

    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const syncReadMap = () => {
      setInboxReadMap(getInboxReadMap());
    };

    window.addEventListener("storage", syncReadMap);
    window.addEventListener("inbox:read-map-changed", syncReadMap);

    return () => {
      window.removeEventListener("storage", syncReadMap);
      window.removeEventListener("inbox:read-map-changed", syncReadMap);
    };
  }, []);

  useEffect(() => {
    if (!authed) {
      setInboxThreads([]);
      return;
    }

    let cancelled = false;

    async function fetchInboxThreads({ force = false } = {}) {
      if (cancelled || inboxFetchInFlightRef.current) return;
      if (!force && typeof document !== "undefined" && document.hidden) return;

      const now = Date.now();
      if (!force && now - lastInboxFetchAtRef.current < 30000) return;

      inboxFetchInFlightRef.current = true;
      lastInboxFetchAtRef.current = now;
      try {
        const { data } = await api.get("/inbox/threads/");
        if (!cancelled) setInboxThreads(Array.isArray(data) ? data : []);
      } catch {
        // Keep the last successful count visible if a background refresh fails.
      } finally {
        inboxFetchInFlightRef.current = false;
      }
    }

    fetchInboxThreads({ force: true });

    const handleFocus = () => fetchInboxThreads({ force: true });
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchInboxThreads({ force: true });
      }
    };
    const handleInboxChanged = () => fetchInboxThreads({ force: true });

    const interval = setInterval(fetchInboxThreads, 60000);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("inbox:changed", handleInboxChanged);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("inbox:changed", handleInboxChanged);
    };
  }, [authed]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.gtag !== "function") {
      return;
    }

    const sanitizePath = (rawPathname) => {
      if (!rawPathname) return "/";

      if (rawPathname.startsWith("/profiles/")) return "/profiles/:username";
      if (rawPathname.startsWith("/messages/")) return "/messages/:threadId";
      if (/^\/projects\/[^/]+$/.test(rawPathname)) return "/projects/:id";
      if (/^\/dashboard\/projects\/[^/]+\/edit$/.test(rawPathname)) {
        return "/dashboard/projects/:projectId/edit";
      }

      return rawPathname;
    };

    const sanitizedPath = sanitizePath(location.pathname);
    const pageUrl = `${window.location.origin}${sanitizedPath}`;

    window.gtag("event", "page_view", {
      page_title: document.title,
      page_location: pageUrl,
      page_path: sanitizedPath,
    });
  }, [location]);

  const NavLink = ({ to, children, compact = false }) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className={
          (compact ? "px-2 py-1 text-[13px] " : "px-3 py-1.5 text-sm ") +
          "rounded-xl " +
          (active
            ? "bg-slate-900 text-white"
            : "text-slate-700 hover:bg-slate-100")
        }
      >
        {children}
      </Link>
    );
  };

  // helpers for avatar & labels
  const username = me?.username || localStorage.getItem("username") || "";
  const displayName = me?.display_name || username || "My profile";
  const profileTypeLabel =
    me?.profile_type === "homeowner"
      ? "Homeowner"
      : me?.profile_type === "contractor"
      ? "Contractor"
      : "";
  const logoPath = authed ? roleLandingPath(me?.profile_type) : "/";
  const previewPath = me?.profile_type === "homeowner" ? "/contractor" : "/homeowner";
  const previewLabel =
    me?.profile_type === "homeowner"
      ? "View Contractor Side"
      : me?.profile_type === "contractor"
      ? "View Homeowner Side"
      : "";
  const workNavLabel = me?.profile_type === "contractor" ? "Find Local Work" : "Sample Projects";

  const avatarInitial =
    displayName && typeof displayName === "string"
      ? displayName.trim().charAt(0).toUpperCase()
      : username
      ? username.trim().charAt(0).toUpperCase()
      : "";

  const meLower = normalizeUsername(username);
  const unreadInboxCount = (inboxThreads || []).reduce((sum, thread) => {
    const latest = thread?.latest_message || null;
    if (!latest?.id) return sum;
    if (normalizeUsername(latest.sender_username) === meLower) return sum;

    const lastReadId = inboxReadMap[String(thread.id)];
    return String(lastReadId || "") !== String(latest.id) ? sum + 1 : sum;
  }, 0);
  const unreadBadgeLabel = unreadInboxCount > 9 ? "9+" : String(unreadInboxCount);

  const handleSignOut = () => {
    logout();
    setMenuOpen(false);
    navigate("/login");
  };

  const goWebsite = () => {
    setMenuOpen(false);
    if (username) navigate(`/profiles/${username}`);
    else navigate("/dashboard");
  };

  const goInbox = () => {
    setMenuOpen(false);
    // ✅ your inbox route is /messages (not /inbox)
    navigate("/messages");
  };

  const goEditProfile = () => {
    setMenuOpen(false);
    navigate("/profile/edit");
  };

  return (
    <div className="min-h-screen bg-[#FBF9F7]">
      {!hideShellNav ? (
      <header className="relative z-30 border-b border-slate-200 bg-white">
        <Container className="py-3">
          <nav className="flex items-center gap-2">
            {/* Left: Logo */}
            <Link
              to={logoPath}
              className="mr-1 text-base font-bold tracking-tight text-slate-900"
            >
              FlatOrigin
            </Link>

            {/* Mobile center: role-aware nav */}
            <div className="flex items-center gap-1 md:hidden">
              <NavLink to="/explore" compact>
                Explore
              </NavLink>
              <NavLink to="/work" compact>
                {workNavLabel}
              </NavLink>
              <NavLink to="/guides" compact>
                Guides
              </NavLink>
            </div>

            {/* Desktop center: role-aware nav */}
            <div className="ml-2 hidden items-center gap-2 md:flex">
              <NavLink to="/explore">Explore</NavLink>
              <NavLink to="/work">
                {workNavLabel}
              </NavLink>
              <NavLink to="/guides">Guides</NavLink>
            </div>

            {/* Right side */}
            <div
              className="relative ml-auto flex items-center gap-3"
              ref={menuRef}
            >
              {authed && previewLabel && pathname !== "/dashboard" ? (
                <Link
                  to={previewPath}
                  title="This toggle is only for viewing/previewing the other landing page."
                  className="hidden h-9 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 lg:inline-flex"
                >
                  {previewLabel}
                </Link>
              ) : null}

              {/* Avatar dropdown */}
              {authed ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                    aria-label="Account menu"
                    aria-expanded={menuOpen ? "true" : "false"}
                  >
                    {avatarInitial || "U"}
                    {unreadInboxCount > 0 ? (
                      <span className="absolute -bottom-1 -right-1 z-10 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">
                        {unreadBadgeLabel}
                      </span>
                    ) : (
                      <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-slate-900 shadow">
                        <SymbolIcon name="keyboard_arrow_down" className="block text-[14px] leading-none" />
                      </span>
                    )}
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl border border-slate-200 bg-white py-3 shadow-xl">
                      {/* Header */}
                      <div className="flex items-center gap-3 px-4 pb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                          {avatarInitial || "U"}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {displayName}
                          </div>
                          {profileTypeLabel ? (
                            <div className="truncate text-xs font-medium text-slate-600">
                              {profileTypeLabel}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="my-1 h-px bg-slate-100" />

                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          navigate("/dashboard");
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                          <SymbolIcon name="dashboard" className="text-[18px]" />
                        </span>
                        <span>Dashboard</span>
                      </button>

                      {/* Inbox (route-based) */}
                      <button
                        type="button"
                        onClick={goInbox}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                          <SymbolIcon name="forum" className="text-[18px]" />
                        </span>
                        <span className="flex flex-1 items-center justify-between">
                          <span>Inbox</span>
                          {unreadInboxCount > 0 ? (
                            <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-[18px] text-white">
                              {unreadBadgeLabel}
                            </span>
                          ) : null}
                        </span>
                      </button>

                      {/* Edit Profile */}
                      <button
                        type="button"
                        onClick={goEditProfile}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                          <SymbolIcon name="edit" className="text-[18px]" />
                        </span>
                        <span>Edit Profile</span>
                      </button>

                      <button
                        type="button"
                        onClick={goWebsite}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                          <SymbolIcon name="public" className="text-[18px]" />
                        </span>
                        <span>Public Profile</span>
                      </button>

                      <div className="my-1 h-px bg-slate-100" />

                      {/* Log out */}
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                          <SymbolIcon name="logout" className="text-[18px]" />
                        </span>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Unauthed dropdown */}
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                    aria-label="Account menu"
                    aria-expanded={menuOpen ? "true" : "false"}
                  >
                    ?
                    <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-slate-900 shadow">
                      <SymbolIcon name="keyboard_arrow_down" className="block text-[14px] leading-none" />
                    </span>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-slate-200 bg-white py-3 shadow-xl">
                      <div className="px-4 pb-2">
                        <div className="text-sm font-semibold text-slate-900">
                          Welcome
                        </div>
                        <div className="text-xs text-slate-500">
                          Sign in to manage your projects.
                        </div>
                      </div>

                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setMenuOpen(false);
                          navigate("/login");
                        }}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                          <SymbolIcon name="login" className="text-[18px]" />
                        </span>
                        <span>Login</span>
                      </button>

                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setMenuOpen(false);
                          navigate("/register");
                        }}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                          <SymbolIcon name="person_add" className="text-[18px]" />
                        </span>
                        <span>Register</span>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </nav>
        </Container>
      </header>
      ) : null}

      <main className="w-full">
        {isFullBleed ? (
          <Outlet />
        ) : (
          <Container>
            <Outlet />
          </Container>
        )}
      </main>
    </div>
  );
}
