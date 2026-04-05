// =======================================
// file: frontend/src/App.jsx
// Responsive nav:
// - Mobile: Portfolio + Explore + Dashboard + Avatar (dropdown has Edit Profile/Inbox/Website/Logout)
// - Desktop: Explore + Dashboard + Job Postings visible; bell + GlobalInbox visible; avatar dropdown
// =======================================
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import api from "./api";
import { Container } from "./ui";
import { logout } from "./auth";
import GlobalInbox from "./components/GlobalInbox";

// Icon assets (bundled by Vite)
import bellIcon from "./assets/icons/bell.svg";
import logoutIcon from "./assets/icons/logout.svg";
import loginIcon from "./assets/icons/login.svg";
import registerIcon from "./assets/icons/register.svg";

const ICONS = {
  bell: bellIcon,
  logout: logoutIcon,
  login: loginIcon,
  register: registerIcon,
};

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const authed = !!localStorage.getItem("access");

  // Full-bleed layouts (e.g. profile hero full-width)
  const isFullBleed =
    pathname.startsWith("/profiles/") || pathname.startsWith("/public/") || false;

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
  const locationLabel = me?.service_location || "";

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
    <div className="min-h-screen bg-slate-50">
      <header className="relative z-30 border-b border-slate-200 bg-white">
        <Container className="py-3">
          <nav className="flex items-center gap-2">
            {/* Left: Logo */}
            <Link
              to="/"
              className="mr-1 text-base font-bold tracking-tight text-slate-900"
            >
              Portfolio
            </Link>

            {/* Mobile center: Explore + Dashboard visible */}
            <div className="flex items-center gap-1 md:hidden">
              <NavLink to="/" compact>
                Explore
              </NavLink>
              <NavLink to="/dashboard" compact>
                Dashboard
              </NavLink>
            </div>

            {/* Desktop nav (Explore + Dashboard + Job Postings) */}
            <div className="ml-2 hidden items-center gap-2 md:flex">
              <NavLink to="/">Explore</NavLink>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/work">Job Postings</NavLink>
            </div>

            {/* Right side */}
            <div
              className="relative ml-auto flex items-center gap-3"
              ref={menuRef}
            >
              {/* Desktop-only: bell + GlobalInbox */}
              {authed && (
                <div className="hidden items-center gap-3 md:flex">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200"
                    aria-label="Notifications"
                  >
                    <img src={ICONS.bell} alt="" className="h-4 w-4" />
                  </button>

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
                    <span className="pointer-events-none absolute -bottom-1 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-slate-900 shadow">
                      ▾
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
                          {locationLabel ? (
                            <div className="truncate text-xs text-slate-500">
                              {locationLabel}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="my-1 h-px bg-slate-100" />

                      {/* Website (public profile) */}
                      <button
                        type="button"
                        onClick={goWebsite}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                          {/* globe */}
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M12 22a10 10 0 1 0-10-10 10 10 0 0 0 10 10Z"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                            <path
                              d="M2 12h20"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                            <path
                              d="M12 2c3 3 3 17 0 20"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                          </svg>
                        </span>
                        <span>Website</span>
                      </button>

                      {/* Edit Profile */}
                      <button
                        type="button"
                        onClick={goEditProfile}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                          {/* pencil */}
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M12 20h9"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                            <path
                              d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
                          </svg>
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
                          {/* chat bubble */}
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden="true"
                          >
                            <path
                              d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinejoin="round"
                            />
                          </svg>
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
                          <img src={ICONS.logout} alt="" className="h-4 w-4" />
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
                    <span className="pointer-events-none absolute -bottom-1 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-slate-900 shadow">
                      ▾
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
                          <img src={ICONS.login} alt="" className="h-4 w-4" />
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
                          <img
                            src={ICONS.register}
                            alt=""
                            className="h-4 w-4"
                          />
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
