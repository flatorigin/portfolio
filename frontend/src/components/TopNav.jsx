// frontend/src/components/TopNav.jsx
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";

function NavLink({ to, label, onClick }) {
  const { pathname } = useLocation();
  const active = pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={[
        "rounded-xl px-3 py-2 text-sm font-medium transition",
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100",
      ].join(" ")}
    >
      {label}
    </Link>
  );
}

export default function TopNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full items-center justify-between px-4 py-3 md:max-w-6xl md:px-6">
        <Link to="/" className="text-lg font-semibold text-slate-900">
          Portfolio
        </Link>

        {/* Desktop menu */}
        <nav className="hidden items-center gap-2 md:flex">
          <NavLink to="/explore" label="Explore" />
          <NavLink to="/profile/edit" label="Edit Profile" />
          <NavLink to="/dashboard" label="Dashboard" />
        </nav>

        {/* Right-side actions (desktop) */}
        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/inbox"
            className="rounded-xl border px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Inbox
          </Link>
          {/* Replace with your real avatar/menu */}
          <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-900 text-white">
            M
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl border p-2 text-slate-700 hover:bg-slate-50 md:hidden"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="border-t bg-white md:hidden">
          <div className="flex flex-col gap-1 px-4 py-3">
            <NavLink to="/explore" label="Explore" onClick={() => setOpen(false)} />
            <NavLink to="/profile/edit" label="Edit Profile" onClick={() => setOpen(false)} />
            <NavLink to="/dashboard" label="Dashboard" onClick={() => setOpen(false)} />
            <div className="my-2 h-px bg-slate-100" />
            <NavLink to="/inbox" label="Inbox" onClick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </header>
  );
}