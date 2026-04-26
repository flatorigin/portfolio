// =======================================
// file: frontend/src/App.jsx
// Responsive nav:
// - Mobile: Portfolio + Explore + Dashboard + Avatar (dropdown has Edit Profile/Inbox/Website/Logout)
// - Desktop: Explore + Dashboard + Job Postings visible; GlobalInbox visible; avatar dropdown
// =======================================
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import api from "./api";
import { Container, SymbolIcon } from "./ui";
import { logout } from "./auth";
import GlobalInbox from "./components/GlobalInbox";

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const location = useLocation();
  const authed = !!localStorage.getItem("access");

  // Full-bleed layouts (e.g. profile hero full-width)
  const isFullBleed =
    pathname === "/" ||
    pathname === "/guides" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/copyright" ||
    pathname.startsWith("/profiles/") ||
    pathname.startsWith("/public/") ||
    false;

  // user + menu state
  const [me, setMe] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

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
      : "Contractor";

  const avatarInitial =
    displayName && typeof displayName === "string"
      ? displayName.trim().charAt(0).toUpperCase()
      : username
      ? username.trim().charAt(0).toUpperCase()
      : "";

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
      <header className="relative z-30 border-b border-slate-200 bg-white">
        <Container className="py-3">
          <nav className="flex items-center gap-2">
            {/* Left: Logo */}
            <Link
              to="/"
              className="mr-1 text-base font-bold tracking-tight text-slate-900"
            >
              FlatOrigin
            </Link>

            {/* Mobile center: Explore + Dashboard visible */}
            <div className="flex items-center gap-1 md:hidden">
              <NavLink to="/explore" compact>
                Explore
              </NavLink>
              <NavLink to="/work">
                Find Local Work
              </NavLink>
              <NavLink to="/dashboard" compact>
                Dashboard
              </NavLink>
            </div>

            {/* Desktop nav (Explore + Dashboard + Job Postings) */}
            <div className="ml-2 hidden items-center gap-2 md:flex">
              <NavLink to="/explore">Explore</NavLink>
              <NavLink to="/work">Find Local Work</NavLink>
              <NavLink to="/dashboard">Dashboard</NavLink>
            </div>

            {/* Right side */}
            <div
              className="relative ml-auto flex items-center gap-3"
              ref={menuRef}
            >
              {/* Desktop-only: GlobalInbox */}
              {authed && (
                <div className="hidden items-center gap-3 md:flex">
                  <NavLink to="/guides">Guides</NavLink>
                  <GlobalInbox />
                </div>
              )}

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
                    <span className="pointer-events-none absolute -bottom-1 right-0 flex h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-white text-slate-900 shadow">
                      <SymbolIcon name="keyboard_arrow_down" className="text-[14px] leading-none" />
                    </span>
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

                      {/* Public profile */}
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

                      {/* Inbox (route-based) */}
                      <button
                        type="button"
                        onClick={goInbox}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                          <SymbolIcon name="forum" className="text-[18px]" />
                        </span>
                        <span>Inbox</span>
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
                        <span>Log out</span>
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
                    <span className="pointer-events-none absolute -bottom-1 right-0 flex h-4 w-4 items-center justify-center overflow-hidden rounded-full bg-white text-slate-900 shadow">
                      <SymbolIcon name="keyboard_arrow_down" className="text-[14px] leading-none" />
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
