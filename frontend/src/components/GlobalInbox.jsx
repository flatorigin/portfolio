// =======================================
// file: frontend/src/components/GlobalInbox.jsx
// Dropdown inbox + unread badge on button (local unread tracking)
// PERF FIXES:
// - no getReadMap() inside .map()
// - memoized readMap + unreadCount
// - keep last threads on error (don't nuke list)
// =======================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { Button } from "../ui";

function normalizeU(s) {
  return String(s || "").trim().toLowerCase();
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getReadMap() {
  return safeJsonParse(localStorage.getItem("inbox_read_map") || "{}", {});
}

function setReadMap(next) {
  localStorage.setItem("inbox_read_map", JSON.stringify(next || {}));
  window.dispatchEvent(new CustomEvent("inbox:read-map-changed"));
}

function markThreadLatestRead(thread) {
  const latestId = thread?.latest_message?.id;
  if (!latestId || !thread?.id) return false;
  const map = getReadMap();
  const key = String(thread.id);
  const value = String(latestId);
  if (String(map[key] || "") === value) return false;
  map[key] = value;
  setReadMap(map);
  return true;
}

// Same counterpart logic pattern as MessagesThread.jsx
function counterpartFor(thread, meLower) {
  if (!thread) return null;

  // If backend already provides counterpart, trust it
  if (thread.counterpart) {
    return {
      username: thread.counterpart.username || "",
      display_name:
        thread.counterpart.display_name ||
        thread.counterpart.username ||
        "User",
      avatar_url: thread.counterpart.avatar_url || "",
    };
  }

  const ownerProfile = thread.owner_profile || {};
  const clientProfile = thread.client_profile || {};

  const ownerUsernameRaw = thread.owner_username || ownerProfile.username || "";
  const clientUsernameRaw = thread.client_username || clientProfile.username || "";

  const ownerLower = normalizeU(ownerUsernameRaw);
  const clientLower = normalizeU(clientUsernameRaw);

  const ownerDisplay = ownerProfile.display_name || ownerUsernameRaw || "User";
  const clientDisplay = clientProfile.display_name || clientUsernameRaw || "User";

  const ownerAvatar = ownerProfile.avatar_url || ownerProfile.logo_url || "";
  const clientAvatar = clientProfile.avatar_url || clientProfile.logo_url || "";

  if (meLower && ownerLower === meLower) {
    return {
      username: clientUsernameRaw,
      display_name: clientDisplay,
      avatar_url: clientAvatar,
    };
  }
  if (meLower && clientLower === meLower) {
    return {
      username: ownerUsernameRaw,
      display_name: ownerDisplay,
      avatar_url: ownerAvatar,
    };
  }

  // fallback
  return {
    username: clientUsernameRaw,
    display_name: clientDisplay,
    avatar_url: clientAvatar,
  };
}

// “Request” gate: if I haven’t accepted yet (based on flags)
function isRequestForMe(thread, meLower) {
  if (!thread || !meLower) return false;

  const ownerLower = normalizeU(thread.owner_username);
  const clientLower = normalizeU(thread.client_username);

  const ownerAccepted = !!thread.owner_has_accepted;
  const clientAccepted = !!thread.client_has_accepted;

  if (ownerLower === meLower) return !ownerAccepted;
  if (clientLower === meLower) return !clientAccepted;

  return false;
}

export default function GlobalInbox() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [readMap, setReadMapState] = useState(() => getReadMap());
  const panelRef = useRef(null);
  const fetchInFlightRef = useRef(false);
  const lastFetchAtRef = useRef(0);

  const authed = !!localStorage.getItem("access");

  const [meUsername, setMeUsername] = useState(
    localStorage.getItem("username") || ""
  );
  const meLower = useMemo(() => normalizeU(meUsername), [meUsername]);

  useEffect(() => {
    const syncUsername = () => {
      setMeUsername(localStorage.getItem("username") || "");
    };

    window.addEventListener("storage", syncUsername);
    window.addEventListener("auth:changed", syncUsername);

    return () => {
      window.removeEventListener("storage", syncUsername);
      window.removeEventListener("auth:changed", syncUsername);
    };
  }, []);

  useEffect(() => {
    const syncReadMap = () => {
      setReadMapState(getReadMap());
    };

    window.addEventListener("storage", syncReadMap);
    window.addEventListener("inbox:read-map-changed", syncReadMap);

    return () => {
      window.removeEventListener("storage", syncReadMap);
      window.removeEventListener("inbox:read-map-changed", syncReadMap);
    };
  }, []);

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
  const fetchThreads = useCallback(async ({ force = false } = {}) => {
    if (!authed) return;
    if (!force && typeof document !== "undefined" && document.hidden) return;
    if (fetchInFlightRef.current) return;

    const now = Date.now();
    if (!force && now - lastFetchAtRef.current < 30000) return;

    fetchInFlightRef.current = true;
    lastFetchAtRef.current = now;
    setError("");
    try {
      const { data } = await api.get("/inbox/threads/");
      setThreads(Array.isArray(data) ? data : []);
    } catch {
      // PERF: keep existing threads if fetch fails (don't wipe UI)
      setError("Unable to load your inbox.");
    } finally {
      fetchInFlightRef.current = false;
    }
  }, [authed]);

  // ----- Load when dropdown opens -----
  useEffect(() => {
    if (!open || !authed) return;
    setLoading(true);
    (async () => {
      await fetchThreads({ force: true });
      setLoading(false);
    })();
  }, [open, authed, fetchThreads]);

  useEffect(() => {
    if (!open || threads.length === 0) return;

    let changed = false;
    for (const thread of threads) {
      const latest = thread?.latest_message;
      if (!latest?.id) continue;
      if (normalizeU(latest.sender_username) === meLower) continue;
      changed = markThreadLatestRead(thread) || changed;
    }

    if (changed) {
      setReadMapState(getReadMap());
    }
  }, [open, threads, meLower]);

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

    const interval = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("inbox:changed", refresh);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("inbox:changed", refresh);
    };
  }, [authed, fetchThreads]);

  // ----- Unread count (local) -----
  const unreadCount = useMemo(() => {
    return (threads || []).reduce((sum, t) => {
      const latest = t.latest_message || null;
      if (!latest?.id) return sum;

      const latestFromMe = normalizeU(latest.sender_username) === meLower;
      if (latestFromMe) return sum;

      const lastReadId = readMap[String(t.id)];
      const isUnread = String(lastReadId || "") !== String(latest.id);

      return sum + (isUnread ? 1 : 0);
    }, 0);
  }, [threads, meLower, readMap]);

  const markThreadRead = useCallback((thread) => {
    if (markThreadLatestRead(thread)) {
      setReadMapState(getReadMap());
    }
  }, []);

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

          {/* Show loading without hiding existing list */}
          {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}
          {loading ? (
            <p className="mb-2 text-xs text-slate-500">Refreshing…</p>
          ) : null}

          {threads.length === 0 ? (
            <p className="text-xs text-slate-500">No private conversations yet.</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {threads.map((t) => {
                const cp = counterpartFor(t, meLower);
                const displayName = cp?.display_name || cp?.username || "User";

                const latest = t.latest_message || null;
                const latestPreview =
                  latest?.text || latest?.attachment_name || "No messages yet";

                const requestBadge =
                  typeof t.is_request === "boolean"
                    ? t.is_request
                    : isRequestForMe(t, meLower);

                // local unread bolding (no getReadMap() here)
                const lastReadId = readMap[String(t.id)];
                const latestId = latest?.id ? String(latest.id) : "";
                const latestFromMe =
                  normalizeU(latest?.sender_username) === meLower;
                const isUnread =
                  !!latestId &&
                  !latestFromMe &&
                  String(lastReadId || "") !== latestId;

                return (
                  <div
                    key={t.id}
                    className={
                      "rounded-xl border p-2 hover:bg-slate-50 " +
                      (isUnread
                        ? "border-slate-300"
                        : "border-slate-100 hover:border-slate-200")
                    }
                  >
                    <button
                      type="button"
                      className="flex w-full flex-col items-start text-left"
                      onClick={() => {
                        markThreadRead(t);
                        setOpen(false);
                        navigate(`/messages/${t.id}`);
                      }}
                    >
                      <div className="flex w-full items-center justify-between gap-2">
                        <div
                          className={
                            "truncate text-sm " +
                            (isUnread
                              ? "font-semibold text-slate-900"
                              : "font-semibold text-slate-800")
                          }
                        >
                          {displayName}
                        </div>

                        {requestBadge && (
                          <span className="rounded-full bg-amber-100 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Request
                          </span>
                        )}
                      </div>

                      <div
                        className={
                          "mt-0.5 truncate text-[11px] " +
                          (isUnread ? "text-slate-800" : "text-slate-500")
                        }
                      >
                        {latest?.sender_username &&
                        normalizeU(latest.sender_username) !== meLower
                          ? `${latest.sender_username}: ${latestPreview}`
                          : latestPreview}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-2 text-right text-[11px] text-slate-500">
            <Link
              to="/messages"
              className="underline"
              onClick={() => {
                for (const thread of threads) {
                  const latest = thread?.latest_message;
                  if (!latest?.id) continue;
                  if (normalizeU(latest.sender_username) === meLower) continue;
                  markThreadLatestRead(thread);
                }
                setReadMapState(getReadMap());
                setOpen(false);
              }}
            >
              Open inbox
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
