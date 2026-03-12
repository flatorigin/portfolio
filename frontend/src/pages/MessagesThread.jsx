// ============================================================================
// file: frontend/src/pages/MessagesThread.jsx
// Inbox + Thread view (responsive)
// - Mobile: thread list -> tap to open
// - Desktop: split view (list left, thread right)
// Unread state tracked locally (lastSeen per thread) until backend adds unread.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import { Card, Button, Input } from "../ui";

function safeStr(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Try multiple endpoints (your backend may expose one of these)
async function fetchThreads() {
  const tries = [
    "/messages/threads/",
    "/message-threads/",
    "/threads/",
  ];

  let lastErr = null;
  for (const url of tries) {
    try {
      const { data } = await api.get(url);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No threads endpoint worked");
}

async function fetchThreadMessages(threadId) {
  const tries = [
    `/messages/${threadId}/`,
    `/messages/threads/${threadId}/messages/`,
    `/message-threads/${threadId}/messages/`,
    `/threads/${threadId}/messages/`,
  ];

  let lastErr = null;
  for (const url of tries) {
    try {
      const { data } = await api.get(url);
      // data can be {messages:[...]} or [...]
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.messages)) return data.messages;
      return [];
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No messages endpoint worked");
}

async function sendMessage(threadId, text) {
  const payload = { text };

  const tries = [
    `/messages/threads/${threadId}/messages/`,
    `/message-threads/${threadId}/messages/`,
    `/threads/${threadId}/messages/`,
    `/messages/${threadId}/`,
  ];

  let lastErr = null;
  for (const url of tries) {
    try {
      const { data } = await api.post(url, payload);
      return data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No send endpoint worked");
}

function getCounterpartLabel(thread, meUsername) {
  // If serializer includes a helper, use it
  const cp = thread?.counterpart;
  if (cp?.display_name || cp?.username) return cp.display_name || cp.username;

  const owner = safeStr(thread?.owner_username);
  const client = safeStr(thread?.client_username);

  if (!meUsername) return owner || client || "Conversation";
  if (owner && owner.toLowerCase() === meUsername.toLowerCase()) return client || "Conversation";
  return owner || client || "Conversation";
}

function getLastSeenKey(threadId) {
  return `inbox:lastSeen:${threadId}`;
}

function isUnread(thread, threadId) {
  const lastSeen = localStorage.getItem(getLastSeenKey(threadId));
  const lastSeenMs = lastSeen ? Number(lastSeen) : 0;

  const latestTs =
    thread?.latest_message?.created_at ||
    thread?.latest_message?.timestamp ||
    thread?.updated_at ||
    thread?.created_at ||
    null;

  const latestMs = latestTs ? new Date(latestTs).getTime() : 0;
  if (!latestMs) return false;
  return latestMs > lastSeenMs;
}

export default function MessagesThread() {
  const navigate = useNavigate();
  const { threadId } = useParams(); // optional

  const [threads, setThreads] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [threadsErr, setThreadsErr] = useState("");

  const [activeId, setActiveId] = useState(threadId ? String(threadId) : "");
  const [messages, setMessages] = useState([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [msgsErr, setMsgsErr] = useState("");

  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);

  const meUsername = localStorage.getItem("username") || "";

  const listFiltered = useMemo(() => {
    // Sort by updated/latest desc
    return [...threads].sort((a, b) => {
      const ta = new Date(a?.latest_message?.created_at || a?.updated_at || a?.created_at || 0).getTime();
      const tb = new Date(b?.latest_message?.created_at || b?.updated_at || b?.created_at || 0).getTime();
      return tb - ta;
    });
  }, [threads]);

  // keep activeId in sync with URL param
  useEffect(() => {
    setActiveId(threadId ? String(threadId) : "");
  }, [threadId]);

  // Load threads
  useEffect(() => {
    let alive = true;
    setLoadingThreads(true);
    setThreadsErr("");

    (async () => {
      try {
        const data = await fetchThreads();
        if (!alive) return;
        setThreads(data);
      } catch (e) {
        console.error("[Inbox] threads load failed", e?.response || e);
        if (!alive) return;
        setThreadsErr("Could not load inbox.");
        setThreads([]);
      } finally {
        if (alive) setLoadingThreads(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Load messages when active thread changes
  useEffect(() => {
    let alive = true;

    async function run() {
      if (!activeId) {
        setMessages([]);
        setMsgsErr("");
        return;
      }

      setLoadingMsgs(true);
      setMsgsErr("");

      try {
        const data = await fetchThreadMessages(activeId);
        if (!alive) return;
        setMessages(Array.isArray(data) ? data : []);

        // mark seen locally
        localStorage.setItem(getLastSeenKey(activeId), String(Date.now()));
      } catch (e) {
        console.error("[Inbox] messages load failed", e?.response || e);
        if (!alive) return;
        setMsgsErr("Could not load messages for this conversation.");
        setMessages([]);
      } finally {
        if (alive) setLoadingMsgs(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [activeId]);

  const activeThread = useMemo(() => {
    return threads.find((t) => String(t?.id) === String(activeId)) || null;
  }, [threads, activeId]);

  const headerTitle = useMemo(() => {
    if (!activeThread) return "Inbox";
    return getCounterpartLabel(activeThread, meUsername);
  }, [activeThread, meUsername]);

  const bottomRef = useRef(null);
  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, activeId]);

  const handleOpenThread = (id) => {
    const tid = String(id);
    // Navigate so URL matches (supports refresh/share)
    navigate(`/messages/${tid}`);
  };

  const handleSend = async () => {
    const text = composer.trim();
    if (!text || !activeId) return;

    setSending(true);
    try {
      await sendMessage(activeId, text);
      setComposer("");

      // Reload messages (simple + reliable)
      const data = await fetchThreadMessages(activeId);
      setMessages(Array.isArray(data) ? data : []);
      localStorage.setItem(getLastSeenKey(activeId), String(Date.now()));
    } catch (e) {
      console.error("[Inbox] send failed", e?.response || e);
      alert("Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-xl font-semibold text-slate-900">Messages</div>
          <div className="text-sm text-slate-600">Your inbox and conversations.</div>
        </div>

        <Link to="/" className="text-xs text-slate-600 hover:text-slate-900">
          ← Back to Explore
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-[360px_minmax(0,1fr)]">
        {/* LEFT: thread list */}
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 p-3">
            <div className="text-sm font-semibold text-slate-900">Inbox</div>
            <div className="text-xs text-slate-500">
              {loadingThreads ? "Loading…" : `${threads.length} conversation${threads.length === 1 ? "" : "s"}`}
            </div>
          </div>

          <div className="max-h-[70vh] overflow-auto">
            {loadingThreads ? (
              <div className="p-4 text-sm text-slate-500">Loading inbox…</div>
            ) : threadsErr ? (
              <div className="p-4 text-sm text-red-600">{threadsErr}</div>
            ) : threads.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No conversations yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {listFiltered.map((t) => {
                  const tid = String(t.id);
                  const active = tid === String(activeId);
                  const unread = isUnread(t, tid);

                  const name = getCounterpartLabel(t, meUsername);
                  const preview = safeStr(t?.latest_message?.text || "");
                  const ts = t?.latest_message?.created_at || t?.updated_at || t?.created_at;

                  return (
                    <button
                      key={tid}
                      type="button"
                      onClick={() => handleOpenThread(tid)}
                      className={
                        "w-full px-4 py-3 text-left transition " +
                        (active ? "bg-slate-50" : "hover:bg-slate-50")
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className={
                              "truncate text-sm " +
                              (unread ? "font-semibold text-slate-900" : "font-medium text-slate-800")
                            }
                          >
                            {name}
                          </div>
                          <div className={"mt-0.5 truncate text-xs " + (unread ? "text-slate-700" : "text-slate-500")}>
                            {preview || "—"}
                          </div>
                        </div>

                        <div className="shrink-0 text-[11px] text-slate-400">
                          {fmtTime(ts)}
                        </div>
                      </div>

                      {unread && (
                        <div className="mt-2">
                          <span className="inline-flex rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                            New
                          </span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* RIGHT: conversation */}
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {headerTitle}
                </div>
                {activeThread?.project_title ? (
                  <div className="truncate text-xs text-slate-500">
                    From: {activeThread.project_title}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">
                    {activeId ? "Conversation" : "Select a conversation"}
                  </div>
                )}
              </div>

              {/* Mobile convenience: if in a thread, allow back */}
              {activeId ? (
                <Button
                  type="button"
                  variant="outline"
                  className="md:hidden"
                  onClick={() => navigate("/messages")}
                >
                  Back
                </Button>
              ) : null}
            </div>
          </div>

          {!activeId ? (
            <div className="flex h-[60vh] items-center justify-center p-6 text-sm text-slate-500">
              Pick a conversation on the left.
            </div>
          ) : (
            <>
              <div className="h-[55vh] overflow-auto p-4">
                {loadingMsgs ? (
                  <div className="text-sm text-slate-500">Loading messages…</div>
                ) : msgsErr ? (
                  <div className="text-sm text-red-600">{msgsErr}</div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-slate-500">No messages yet.</div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((m) => {
                      const mine =
                        safeStr(m?.sender_username).toLowerCase() === meUsername.toLowerCase();

                      return (
                        <div
                          key={m?.id || Math.random().toString(36).slice(2)}
                          className={"flex " + (mine ? "justify-end" : "justify-start")}
                        >
                          <div
                            className={
                              "max-w-[85%] rounded-2xl px-3 py-2 text-sm " +
                              (mine
                                ? "bg-slate-900 text-white"
                                : "bg-slate-100 text-slate-900")
                            }
                          >
                            <div className="whitespace-pre-wrap">{safeStr(m?.text)}</div>
                            <div className={"mt-1 text-[10px] " + (mine ? "text-white/70" : "text-slate-500")}>
                              {fmtTime(m?.created_at)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    placeholder="Type a message…"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                  />
                  <Button type="button" onClick={handleSend} disabled={sending || !composer.trim()}>
                    {sending ? "Sending…" : "Send"}
                  </Button>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  Tip: Press Enter to send.
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}