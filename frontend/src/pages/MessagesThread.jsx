// =======================================
// file: frontend/src/pages/MessagesThread.jsx
// Inbox page: left = people list, right = conversation
// Uses DIRECT message endpoints (no project required)
// =======================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import { Card, Button, Textarea } from "../ui";

export default function MessagesThread() {
  const { threadId: threadIdParam } = useParams();

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [readThreadIds, setReadThreadIds] = useState(new Set());

  const [meUsername, setMeUsername] = useState("");

  // ---------- Fetch current user (me) once ----------
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/auth/users/me/");
        setMeUsername(data.username || "");
      } catch (err1) {
        try {
          const { data } = await api.get("/users/me/");
          setMeUsername(data.username || data.user?.username || "");
        } catch (err2) {
          const localUsername = localStorage.getItem("username") || "";
          setMeUsername(localUsername);
        }
      }
    })();
  }, []);

  const meLower = (meUsername || "").toLowerCase();

  const activeThread = useMemo(
    () => threads.find((t) => String(t.id) === String(activeThreadId)) || null,
    [threads, activeThreadId]
  );

  const markThreadRead = (id) => {
    setReadThreadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Decide who the “other person” is
  const counterpartFor = (thread) => {
    if (!thread) return null;

    const ownerProfile = thread.owner_profile || {};
    const clientProfile = thread.client_profile || {};

    const ownerUsernameRaw = thread.owner_username || ownerProfile.username || "";
    const clientUsernameRaw = thread.client_username || clientProfile.username || "";

    const ownerLower = ownerUsernameRaw.toLowerCase();
    const clientLower = clientUsernameRaw.toLowerCase();

    const ownerDisplay = ownerProfile.display_name || ownerUsernameRaw || "User";
    const clientDisplay = clientProfile.display_name || clientUsernameRaw || "User";

    if (meLower && ownerLower === meLower) {
      return { username: clientUsernameRaw, display_name: clientDisplay };
    }
    if (meLower && clientLower === meLower) {
      return { username: ownerUsernameRaw, display_name: ownerDisplay };
    }
    return { username: clientUsernameRaw, display_name: clientDisplay };
  };

  const counterpart = useMemo(
    () => counterpartFor(activeThread),
    [activeThread, meLower]
  );

  // ---------- Fetch threads ----------
  const fetchThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const { data } = await api.get("/inbox/threads/");
      const arr = Array.isArray(data) ? data : [];
      setThreads(arr);

      setActiveThreadId((prev) => {
        if (prev) return prev;
        if (threadIdParam) return Number(threadIdParam);
        return arr[0]?.id ?? null;
      });
    } catch (err) {
      console.error("[MessagesThread] failed to load threads", err);
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  }, [threadIdParam]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // ---------- Fetch messages (DIRECT endpoint) ----------
  const fetchMessages = useCallback(
    async ({ silent = false } = {}) => {
      if (!activeThread?.id) {
        setMessages([]);
        return;
      }

      if (!silent) setLoadingMessages(true);

      try {
        const { data } = await api.get(
          `/messages/threads/${activeThread.id}/messages/`
        );
        const arr = Array.isArray(data) ? data : [];

        setMessages((prev) => {
          if (
            prev.length === arr.length &&
            prev[prev.length - 1]?.id === arr[arr.length - 1]?.id
          ) {
            return prev;
          }
          return arr;
        });
      } catch (err) {
        console.error("[MessagesThread] failed to load messages", err?.response || err);
        if (!silent) setMessages([]);
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    [activeThread?.id]
  );

  useEffect(() => {
    if (!activeThread?.id) {
      setMessages([]);
      return;
    }

    fetchMessages({ silent: false });

    const id = setInterval(() => {
      fetchMessages({ silent: true });
    }, 8000);

    return () => clearInterval(id);
  }, [activeThread?.id, fetchMessages]);

  // ---------- Accept request (if needed) ----------
  const acceptThread = async () => {
    if (!activeThread?.id) return;
    try {
      await api.post(`/inbox/threads/${activeThread.id}/actions/`, {
        action: "accept",
      });
      await fetchThreads();
      await fetchMessages({ silent: false });
    } catch (err) {
      console.error("[MessagesThread] accept failed", err?.response || err);
      alert("Failed to accept message request.");
    }
  };

  // ---------- Send message (DIRECT endpoint) ----------
  const handleSend = async (e) => {
    e.preventDefault();
    if (!activeThread?.id || !messageText.trim()) return;

    setSending(true);
    try {
      await api.post(`/messages/threads/${activeThread.id}/messages/`, {
        text: messageText.trim(),
      });
      setMessageText("");
      await fetchMessages({ silent: false });
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to send message.";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-start gap-4">
      {/* LEFT: thread list */}
      <div className="w-64 shrink-0">
        <Card className="h-[calc(100vh-140px)] min-h-[320px] overflow-hidden p-0">
          <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Conversations
          </div>

          <div className="h-full overflow-y-auto">
            {loadingThreads ? (
              <div className="p-3 text-xs text-slate-500">Loading…</div>
            ) : threads.length === 0 ? (
              <div className="p-3 text-xs text-slate-500">
                No conversations yet.
              </div>
            ) : (
              threads.map((t) => {
                const cp = counterpartFor(t);
                const name = cp?.display_name || cp?.username || "User";

                const latest = t.latest_message || null;
                const dateLabel = latest?.created_at
                  ? new Date(latest.created_at).toLocaleDateString()
                  : "";

                const latestFromMe =
                  latest?.sender_username &&
                  latest.sender_username.toLowerCase() === meLower;

                const hasBeenRead = readThreadIds.has(t.id);
                const isUnread = !hasBeenRead && !latestFromMe && !!latest;

                const isActive = String(t.id) === String(activeThreadId);

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveThreadId(t.id);
                      markThreadRead(t.id);
                    }}
                    className={[
                      "block w-full border-b border-slate-100 px-3 py-2 text-left text-sm",
                      isActive ? "bg-slate-100" : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div
                      className={
                        "truncate text-xs " +
                        (isUnread
                          ? "font-semibold text-slate-900"
                          : "font-normal text-slate-800")
                      }
                    >
                      {name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {dateLabel || "—"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* RIGHT: messages */}
      <div className="flex-1">
        <Card className="flex h-[calc(100vh-140px)] min-h-[320px] flex-col p-4">
          {!activeThread ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Select a conversation from the left.
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="text-sm font-semibold text-slate-900">
                  {counterpart?.username ? (
                    <Link
                      to={`/profiles/${counterpart.username}`}
                      className="text-slate-900 hover:underline"
                    >
                      {counterpart.display_name || counterpart.username}
                    </Link>
                  ) : (
                    "Conversation"
                  )}
                </div>

                {/* If your serializer sets a flag like is_request, show Accept */}
                {activeThread.is_request && (
                  <Button type="button" onClick={acceptThread}>
                    Accept
                  </Button>
                )}
              </div>

              <div className="mb-3 flex-1 overflow-y-auto rounded-xl bg-slate-50 p-3">
                {loadingMessages ? (
                  <p className="text-xs text-slate-500">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No messages yet. Say hi!
                  </p>
                ) : (
                  messages.map((m) => {
                    const fromMe =
                      (m.sender_username || "").toLowerCase() === meLower;

                    const alignClass = fromMe ? "justify-end" : "justify-start";
                    const bubbleClass = fromMe
                      ? "rounded-br-sm bg-slate-900 text-white"
                      : "rounded-bl-sm bg-white text-slate-900";

                    const timeLabel = m.created_at
                      ? new Date(m.created_at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "";

                    return (
                      <div key={m.id} className={`mb-2 flex ${alignClass}`}>
                        <div
                          className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${bubbleClass}`}
                        >
                          {m.text && (
                            <p className="whitespace-pre-wrap">{m.text}</p>
                          )}
                          <div
                            className={
                              "mt-1 text-[10px] " +
                              (fromMe
                                ? "text-slate-300 text-right"
                                : "text-slate-500")
                            }
                          >
                            {timeLabel}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSend} className="space-y-2">
                <Textarea
                  rows={2}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message…"
                  className="min-h-[70px]"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button type="submit" disabled={!messageText.trim() || sending}>
                    {sending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}