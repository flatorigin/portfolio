// =======================================
// file: frontend/src/pages/MessagesThread.jsx
// Inbox page: left = people list, right = conversation
// Uses DIRECT message endpoints (no project required)
// Shows request controls: Accept / Ignore / Block
// =======================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api";
import { Card, Button, Textarea } from "../ui";

export default function MessagesThread() {
  const { threadId: threadIdParam } = useParams();
  const navigate = useNavigate();

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);

  useEffect(() => {
    if (!threadIdParam) return;
    setActiveThreadId(Number(threadIdParam));
  }, [threadIdParam]);

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
        setMeUsername(data?.username || "");
      } catch {
        try {
          const { data } = await api.get("/users/me/");
          setMeUsername(data?.username || data?.user?.username || "");
        } catch {
          setMeUsername(localStorage.getItem("username") || "");
        }
      }
    })();
  }, []);

  const meLower = (meUsername || "").toLowerCase();

  const activeThread = useMemo(
    () => threads.find((t) => String(t.id) === String(activeThreadId)) || null,
    [threads, activeThreadId]
  );

  const threadIsRequest = !!activeThread?.is_request;
  const canReply = activeThread?.can_reply !== undefined ? !!activeThread.can_reply : true;

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

  const counterpart = useMemo(() => counterpartFor(activeThread), [activeThread, meLower]);

  // ---------- Fetch threads ----------
  const fetchThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const { data } = await api.get("/inbox/threads/");
      const arr = Array.isArray(data) ? data : [];
      setThreads(arr);

      setActiveThreadId((prev) => {
        if (threadIdParam) return Number(threadIdParam); // ✅ always win
        if (prev) return prev;
        return arr[0]?.id ?? null;
      });
    } catch (err) {
      console.error("[MessagesThread] failed to load threads", err?.response || err);
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
        const { data } = await api.get(`/messages/threads/${activeThread.id}/messages/`);
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

    const timer = setInterval(() => fetchMessages({ silent: true }), 8000);
    return () => clearInterval(timer);
  }, [activeThread?.id, fetchMessages]);

  // ---------- Thread actions ----------
  async function threadAction(action) {
    if (!activeThread?.id) return;
    try {
      await api.post(`/inbox/threads/${activeThread.id}/actions/`, { action });
      await fetchThreads();
      await fetchMessages({ silent: false });
    } catch (err) {
      console.error("[MessagesThread] thread action failed", err?.response || err);
      alert(err?.response?.data?.detail || "Action failed.");
    }
  }

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
      await fetchThreads();
    } catch (err) {
      const msg = err?.response?.data?.detail || err?.message || "Failed to send message.";
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
              <div className="p-3 text-xs text-slate-500">No conversations yet.</div>
            ) : (
              threads.map((t) => {
                const cp = counterpartFor(t);
                const name = cp?.display_name || cp?.username || "User";

                const latest = t.latest_message || null;
                const dateLabel = latest?.created_at ? new Date(latest.created_at).toLocaleDateString() : "";

                const latestFromMe =
                  latest?.sender_username && latest.sender_username.toLowerCase() === meLower;

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
                      navigate(`/messages/${t.id}`);
                    }}
                    className={[
                      "block w-full border-b border-slate-100 px-3 py-2 text-left text-sm",
                      isActive ? "bg-slate-100" : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div
                      className={
                        "truncate text-xs " +
                        (isUnread ? "font-semibold text-slate-900" : "font-normal text-slate-800")
                      }
                    >
                      {name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">{dateLabel || "—"}</div>
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
              <div className="mb-3 border-b border-slate-200 pb-2">
                <div className="flex items-center justify-between">
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
                </div>

                {threadIsRequest && (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="text-xs font-semibold text-amber-900">Message request</div>
                    <div className="mt-1 text-[11px] text-amber-800">
                      Accept to allow replies. Ignore to pause it for 24 hours. Block stops messages.
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" onClick={() => threadAction("accept")}>
                        Accept
                      </Button>

                      <Button type="button" variant="outline" onClick={() => threadAction("ignore")}>
                        Ignore
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50"
                        onClick={() => threadAction("block")}
                      >
                        Block
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-3 flex-1 overflow-y-auto rounded-xl bg-slate-50 p-3">
                {loadingMessages ? (
                  <p className="text-xs text-slate-500">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-slate-500">No messages yet.</p>
                ) : (
                  messages.map((m) => {
                    const fromMe = (m.sender_username || "").toLowerCase() === meLower;

                    const alignClass = fromMe ? "justify-end" : "justify-start";
                    const bubbleClass = fromMe
                      ? "rounded-br-sm bg-slate-900 text-white"
                      : "rounded-bl-sm bg-white text-slate-900";

                    const timeLabel = m.created_at
                      ? new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                      : "";

                    return (
                      <div key={m.id} className={`mb-2 flex ${alignClass}`}>
                        <div className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${bubbleClass}`}>
                          {m.text ? <p className="whitespace-pre-wrap">{m.text}</p> : null}
                          <div className={"mt-1 text-[10px] " + (fromMe ? "text-slate-300 text-right" : "text-slate-500")}>
                            {timeLabel}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <form onSubmit={handleSend} className="space-y-2">
                {!canReply ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                    You can’t reply yet. Accept the request first (or the other user ignored/blocked).
                  </div>
                ) : null}

                <Textarea
                  rows={2}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message…"
                  className="min-h-[70px]"
                  disabled={!canReply}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button type="submit" disabled={!canReply || !messageText.trim() || sending}>
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