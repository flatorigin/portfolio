// =======================================
// file: frontend/src/App.jsx
// Layout + nav with avatar dropdown + full-bleed support + bundler icons
// =======================================
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import api from "./api";
import { Container } from "./ui";
import { logout } from "./auth";
import GlobalInbox from "./components/GlobalInbox";

// Icon assets (bundled by Vite)
// Files live at: frontend/src/assets/icons/...
import bellIcon from "./assets/icons/bell.svg";
import addIcon from "./assets/icons/add.svg";
import logoutIcon from "./assets/icons/logout.svg";
import loginIcon from "./assets/icons/login.svg";
import registerIcon from "./assets/icons/register.svg";

const ICONS = {
  bell: bellIcon,
  add: addIcon,
  logout: logoutIcon,
  login: loginIcon,
  register: registerIcon,
};

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const authed = !!localStorage.getItem("access");

  // Pages that should NOT be wrapped in <Container> (need full-bleed layouts)
  const isFullBleed =
    pathname.startsWith("/profiles/") ||
    pathname.startsWith("/public/") || // optional if you have it
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
        if (!cancelled) setMe(data);
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
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const NavLink = ({ to, children }) => {
    const active = pathname === to;
    return (
      <Link
        to={to}
        className={
          "rounded-xl px-3 py-1.5 text-sm " +
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

  const handleViewProfile = () => {
    setMenuOpen(false);
    if (username) {
      navigate(`/profiles/${username}`);
    } else {
      navigate("/dashboard");
    }
  };

  const handleAddProject = () => {
    setMenuOpen(false);
    // adjust if you have a dedicated "new project" route
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Make header float above content */}
      <header className="relative z-30 border-b border-slate-200 bg-white">
        <Container className="py-3">
          <nav className="flex items-center gap-2">
            <Link
              to="/"
              className="mr-4 text-base font-bold tracking-tight text-slate-900"
            >
              Portfolio
            </Link>

            <NavLink to="/">Explore</NavLink>
            <NavLink to="/profile/edit">Edit Profile</NavLink>
            <NavLink to="/dashboard">Dashboard</NavLink>

            {/* relative so dropdown positions under avatar */}
            <div
              className="relative ml-auto flex items-center gap-3"
              ref={menuRef}
            >
              {authed && (
                <>
                  {/* Bell icon */}
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200"
                    aria-label="Notifications"
                  >
                    <img src={ICONS.bell} alt="" className="h-4 w-4" />
                  </button>

                  {/* Existing inbox (chat bubble style) */}
                  <GlobalInbox />
                </>
              )}

              {/* Account avatar + dropdown (authed / not authed) */}
              {authed ? (
                <>
                  {/* Avatar trigger */}
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                    aria-label="Account menu"
                  >
                    {avatarInitial || "U"}
                    <span className="pointer-events-none absolute -bottom-1 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-slate-900 shadow">
                      ▾
                    </span>
                  </button>

                  {menuOpen && (
                    <div className="absolute right-0 top-11 z-50 w-64 rounded-2xl border border-slate-200 bg-white py-3 shadow-xl">
                      {/* Header: avatar + name */}
                      <div className="flex items-center gap-3 px-4 pb-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                          {avatarInitial || "U"}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            {displayName}
                          </div>
                          {locationLabel && (
                            <div className="truncate text-xs text-slate-500">
                              {locationLabel}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* View profile CTA */}
                      <div className="px-4 pb-3">
                        <button
                          type="button"
                          onClick={handleViewProfile}
                          className="w-full rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-200"
                        >
                          View profile
                        </button>
                      </div>

                      <div className="my-1 h-px bg-slate-100" />

                      {/* Add project */}
                      <button
                        type="button"
                        onClick={handleAddProject}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                          <img src={ICONS.add} alt="" className="h-4 w-4" />
                        </span>
                        <span>Add a project</span>
                      </button>

                      {/* Sign out */}
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100">
                          <img src={ICONS.logout} alt="" className="h-4 w-4" />
                        </span>
                        <span>Sign out</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Unauthed avatar trigger */}
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    className="relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                    aria-label="Account menu"
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
                          <img src={ICONS.register} alt="" className="h-4 w-4" />
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
          // Full-bleed pages render directly with no container constraint
          <Outlet />
        ) : (
          // Default: keep everything nicely centered
          <Container>
            <Outlet />
          </Container>
        )}
      </main>
    </div>
  );
}
