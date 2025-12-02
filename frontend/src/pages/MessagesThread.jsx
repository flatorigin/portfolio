// =======================================
// file: frontend/src/pages/MessagesThread.jsx
// Inbox page: left = people list, right = conversation
// =======================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import { Card, Button, Textarea } from "../ui";

export default function MessagesThread() {
  // optional route: /messages/:threadId
  const { threadId: threadIdParam } = useParams();

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [readThreadIds, setReadThreadIds] = useState(new Set());

  // Logged-in user (so logic works for both Mokko & Artin)
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
          console.warn("[MessagesThread] failed to fetch me", err1, err2);
          const localUsername = localStorage.getItem("username") || "";
          setMeUsername(localUsername);
        }
      }
    })();
  }, []);

  const meLower = (meUsername || "").toLowerCase();

  // ---------- Helpers ----------

  // The currently selected conversation
  const activeThread = useMemo(
    () =>
      threads.find((t) => String(t.id) === String(activeThreadId)) || null,
    [threads, activeThreadId]
  );

  // Mark thread as read (local session only)
  const markThreadRead = (id) => {
    setReadThreadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // "Counterpart" = the other person in this thread (for left list + header)
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

    // Fallback: treat client as counterpart (typical owner inbox case)
    return {
      username: clientUsernameRaw,
      display_name: clientDisplay,
    };
  };

  const counterpart = useMemo(
    () => counterpartFor(activeThread),
    [activeThread, meLower]
  );

  // ---------- Fetch threads (left column list) ----------

  const fetchThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const { data } = await api.get("/inbox/threads/");
      const arr = Array.isArray(data) ? data : [];
      setThreads(arr);

      // choose which thread to show:
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

  // ---------- Fetch messages (right column body) ----------

  const fetchMessages = useCallback(
    async ({ silent = false } = {}) => {
      if (!activeThread) {
        setMessages([]);
        return;
      }

      const projectId = activeThread.project;
      if (!projectId) {
        setMessages([]);
        return;
      }

      if (!silent) {
        setLoadingMessages(true);
      }

      try {
        const { data } = await api.get(
          `/projects/${projectId}/threads/${activeThread.id}/messages/`
        );
        const arr = Array.isArray(data) ? data : [];

        // Only update state if there's actually a change
        setMessages((prev) => {
          if (
            prev.length === arr.length &&
            prev[prev.length - 1]?.id === arr[arr.length - 1]?.id
          ) {
            return prev; // no change → no re-render
          }
          return arr;
        });
      } catch (err) {
        console.error("[MessagesThread] failed to load messages", err);
        if (!silent) {
          setMessages([]);
        }
      } finally {
        if (!silent) {
          setLoadingMessages(false);
        }
      }
    },
    [activeThread]
  );

  useEffect(() => {
    if (!activeThread) {
      setMessages([]);
      return;
    }

    // Initial load with spinner
    fetchMessages({ silent: false });

    // Background polling every 8s, silently
    const id = setInterval(() => {
      fetchMessages({ silent: true });
    }, 8000);

    return () => clearInterval(id);
  }, [activeThread, fetchMessages]);

  // ---------- Send new message into active conversation ----------

  const handleSend = async (e) => {
    e.preventDefault();
    if (!activeThread || !messageText.trim()) return;

    const projectId = activeThread.project;
    if (!projectId) return;

    setSending(true);
    try {
      await api.post(
        `/projects/${projectId}/threads/${activeThread.id}/messages/`,
        { text: messageText.trim() }
      );
      setMessageText("");
      await fetchMessages();
    } catch (err) {
      console.error("[MessagesThread] send error", err);
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  // ---------- Render ----------

  return (
    // 🔹 Two columns, always side by side
    <div className="flex items-start gap-4">
      {/* LEFT COLUMN: fixed width */}
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
                No private conversations yet.
              </div>
            ) : (
              threads.map((t) => {
                const cp = counterpartFor(t);
                const name = cp?.display_name || cp?.username || "User";

                const latest = t.latest_message || null;

                // Date stamp (last message date)
                const dateLabel = latest?.created_at
                  ? new Date(latest.created_at).toLocaleDateString()
                  : "";

                // Is the latest message from me?
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
                    {/* Name: bold if unread, same size */}
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

                    {/* Date stamp under the name */}
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

      {/* RIGHT COLUMN: flex-1 main conversation area */}
      <div className="flex-1">
        <Card className="flex h-[calc(100vh-140px)] min-h-[320px] flex-col p-4">
          {!activeThread ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Select a conversation from the left.
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="text-sm font-semibold text-slate-900">
                  {counterpart ? (
                    <Link
                      to={
                        counterpart.username
                          ? `/profiles/${counterpart.username}`
                          : "#"
                      }
                      className="text-slate-900 hover:underline"
                    >
                      {counterpart.display_name || counterpart.username || "Conversation"}
                    </Link>
                  ) : (
                    "Conversation"
                  )}
                </div>
              </div>

              {/* MESSAGE BODY: other person left, me right */}
              <div className="mb-3 flex-1 overflow-y-auto rounded-xl bg-slate-50 p-3">
                {loadingMessages ? (
                  <p className="text-xs text-slate-500">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No messages yet. Say hi!
                  </p>
                ) : (
                  messages.map((m) => {
                    if (!activeThread) return null;

                    const fromMe =
                      m.sender_username &&
                      m.sender_username.toLowerCase() === meLower;

                    const alignClass = fromMe
                      ? "justify-end"
                      : "justify-start";

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

              {/* INPUT */}
              <form onSubmit={handleSend} className="space-y-2">
                <Textarea
                  rows={2}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message…"
                  className="min-h-[70px]"
                />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="submit"
                    disabled={!messageText.trim() || sending}
                  >
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
