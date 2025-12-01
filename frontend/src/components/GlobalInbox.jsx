// =======================================
// file: frontend/src/components/GlobalInbox.jsx
// Dropdown inbox + unread badge on button
// =======================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { Button } from "../ui";

function Avatar({ profile }) {
  if (!profile?.avatar_url) {
    return (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
        {profile?.display_name?.charAt(0)?.toUpperCase() || "?"}
      </div>
    );
  }
  return (
    <img
      src={profile.avatar_url}
      alt={profile.display_name || ""}
      className="h-9 w-9 rounded-full object-cover"
    />
  );
}

export default function GlobalInbox() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useRef(null);
  const authed = !!localStorage.getItem("access");

  // ----- Click outside to close -----
  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // ----- Shared fetch function -----
  const fetchThreads = useCallback(async () => {
    if (!authed) return;
    setError("");
    try {
      const { data } = await api.get("/inbox/threads/");
      setThreads(Array.isArray(data) ? data : []);
    } catch (err) {
      // don't spam errors, just keep it simple
      setError("Unable to load your inbox.");
      setThreads([]);
    }
  }, [authed]);

  // ----- Load when dropdown opens -----
  useEffect(() => {
    if (!open || !authed) return;
    setLoading(true);
    (async () => {
      await fetchThreads();
      setLoading(false);
    })();
  }, [open, authed, fetchThreads]);

  // ----- Background refresh for badge (poll + focus) -----
  useEffect(() => {
    if (!authed) return;

    let cancelled = false;

    async function refresh() {
      if (cancelled) return;
      await fetchThreads();
    }

    // initial
    refresh();

    // poll every 15s
    const interval = setInterval(refresh, 15000);

    // refresh when window gains focus
    window.addEventListener("focus", refresh);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [authed, fetchThreads]);

  // ----- Unread count for badge -----
  const unreadCount = useMemo(() => {
    // 🔧 Adjust this logic to match your API shape.
    // If each thread has `unread_count`, this works out of the box:
    return threads.reduce((sum, t) => sum + (t.unread_count || 0), 0);

    // If your backend instead gives e.g. `t.has_unread`, use:
    // return threads.reduce((sum, t) => sum + (t.has_unread ? 1 : 0), 0);
  }, [threads]);

  if (!authed) return null;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        type="button"
        className="relative px-3 py-1.5"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Inbox</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">
              Private inbox
            </div>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-700"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>

          {loading ? (
            <p className="text-xs text-slate-500">Loading…</p>
          ) : error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : threads.length === 0 ? (
            <p className="text-xs text-slate-500">
              No private conversations yet.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {threads.map((t) => {
                const currentUsername = localStorage.getItem("username");
                const defaultOwner =
                  t.owner_profile || { display_name: t.owner_username };
                const defaultClient =
                  t.client_profile || { display_name: t.client_username };
                const counterpart =
                  currentUsername && t.owner_username === currentUsername
                    ? defaultClient
                    : defaultOwner;

                return (
                  <button
                    key={t.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-100 px-2 py-2 text-left hover:border-slate-200 hover:bg-slate-50"
                    onClick={() => {
                      setOpen(false);
                      navigate(`/projects/${t.project}`);
                    }}
                  >
                    <Avatar profile={counterpart} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-800">
                        {counterpart.display_name ||
                          counterpart.username ||
                          "Company"}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {t.latest_message?.text ||
                          t.latest_message?.attachment_name ||
                          "Open conversation"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-2 text-right text-[11px] text-slate-500">
            <Link to="/" className="underline">
              View projects
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
