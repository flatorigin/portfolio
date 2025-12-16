// =======================================
// file: frontend/src/App.jsx
// Layout + nav polish; <Outlet /> retained
// =======================================
import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { Container, Button, GhostButton } from "./ui";
import { logout } from "./auth";
import GlobalInbox from "./components/GlobalInbox";

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const authed = !!localStorage.getItem("access");

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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
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

            <div className="ml-auto flex items-center gap-2">
              {authed && <GlobalInbox />}

              {!authed ? (
                <>
                  <GhostButton as="a">
                    <Link to="/login">Login</Link>
                  </GhostButton>
                  <Button as="a" className="px-3 py-1.5">
                    <Link to="/register">Register</Link>
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  className="px-3 py-1.5"
                >
                  Logout
                </Button>
              )}
            </div>
          </nav>
        </Container>
      </header>

      <main className={pathname.startsWith("/profiles/") ? "" : "py-6"}>
        {pathname.startsWith("/profiles/") ? (
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
