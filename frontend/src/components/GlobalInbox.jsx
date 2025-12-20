// =======================================
// file: frontend/src/components/GlobalInbox.jsx
// Small inbox dropdown in the header
// =======================================
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Card } from "../ui";

export default function GlobalInbox() {
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meUsername, setMeUsername] = useState("");

  const navigate = useNavigate();

  const meLower = (meUsername || "").toLowerCase();

  // ---- fetch current user once ----
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/users/me/");
        setMeUsername(data.username || data.user?.username || "");
      } catch (err) {
        console.warn("[GlobalInbox] /users/me/ failed, using localStorage", err);
        const local = localStorage.getItem("username") || "";
        setMeUsername(local);
      }
    })();
  }, []);

  // ---- helper to find counterpart (other person) ----
  const counterpartFor = (thread) => {
    if (!thread) return null;

    const ownerProfile = thread.owner_profile || {};
    const clientProfile = thread.client_profile || {};

    const ownerUsernameRaw =
      thread.owner_username || ownerProfile.username || "";
    const clientUsernameRaw =
      thread.client_username || clientProfile.username || "";

    const ownerLower = ownerUsernameRaw.toLowerCase();
    const clientLower = clientUsernameRaw.toLowerCase();

    const ownerDisplay =
      ownerProfile.display_name || ownerUsernameRaw || "User";
    const clientDisplay =
      clientProfile.display_name || clientUsernameRaw || "User";

    // If I'm the owner, counterpart is the client
    if (meLower && ownerLower === meLower) {
      return {
        username: clientUsernameRaw,
        display_name: clientDisplay,
      };
    }

    // If I'm the client, counterpart is the owner
    if (meLower && clientLower === meLower) {
      return {
        username: ownerUsernameRaw,
        display_name: ownerDisplay,
      };
    }

    // fallback: treat client as counterpart
    return {
      username: clientUsernameRaw,
      display_name: clientDisplay,
    };
  };

  // ---- fetch threads when dropdown opens ----
  useEffect(() => {
    if (!open) return;

    let alive = true;
    setLoading(true);

    api
      .get("/inbox/threads/")
      .then(({ data }) => {
        if (!alive) return;
        const arr = Array.isArray(data) ? data : [];
        setThreads(arr);
      })
      .catch((err) => {
        console.error("[GlobalInbox] failed to load threads", err);
        if (alive) setThreads([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open]);

  const receivedMessages = useMemo(() => {
    const items = [];
    threads.forEach((thread) => {
      const received = Array.isArray(thread.received_messages)
        ? thread.received_messages
        : [];
      const counterpart = counterpartFor(thread);
      received.forEach((message) => {
        items.push({
          threadId: thread.id,
          message,
          counterpart,
        });
      });
    });

    return items.sort((a, b) => {
      const aTime = a.message?.created_at || "";
      const bTime = b.message?.created_at || "";
      return (bTime || "").localeCompare(aTime || "");
    });
  }, [threads, meLower]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
      >
        Inbox
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80">
          <Card className="overflow-hidden border border-slate-200 p-0 shadow-lg">
            <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Messages
            </div>

            {loading ? (
              <div className="p-3 text-xs text-slate-500">Loading…</div>
            ) : receivedMessages.length === 0 ? (
              <div className="p-3 text-xs text-slate-500">
                No received messages yet.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {receivedMessages.map((item) => {
                  const name =
                    item.counterpart?.display_name ||
                    item.counterpart?.username ||
                    "User";
                  const preview = item.message?.text || "(attachment)";
                  const timeLabel = item.message?.created_at
                    ? new Date(item.message.created_at).toLocaleTimeString(
                        [],
                        {
                          hour: "numeric",
                          minute: "2-digit",
                        }
                      )
                    : "";

                  return (
                    <button
                      key={item.message?.id || `${item.threadId}-message`}
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        navigate(`/messages/${item.threadId}`);
                      }}
                      className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      {/* name of the OTHER person */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-xs font-semibold text-slate-900">
                          {name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {timeLabel}
                        </div>
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-600">
                        {preview}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
