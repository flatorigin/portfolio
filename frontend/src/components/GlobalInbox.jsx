import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open || !authed) return;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/inbox/threads/");
        setThreads(Array.isArray(data) ? data : []);
      } catch (err) {
        setError("Unable to load your inbox.");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, authed]);

  if (!authed) return null;

  return (
    <div className="relative" ref={panelRef}>
      <Button
        type="button"
        className="px-3 py-1.5"
        onClick={() => setOpen((v) => !v)}
      >
        Inbox
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900">Private inbox</div>
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
            <p className="text-xs text-slate-500">No private conversations yet.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {threads.map((t) => {
                const currentUsername = localStorage.getItem("username");
                const defaultOwner = t.owner_profile || { display_name: t.owner_username };
                const defaultClient = t.client_profile || { display_name: t.client_username };
                const counterpart = currentUsername && t.owner_username === currentUsername
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
                        {counterpart.display_name || counterpart.username || "Company"}
                      </div>
                      <div className="truncate text-[11px] text-slate-500">
                        {t.latest_message?.text || t.latest_message?.attachment_name || "Open conversation"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-2 text-right text-[11px] text-slate-500">
            <Link to="/" className="underline">View projects</Link>
          </div>
        </div>
      )}
    </div>
  );
}