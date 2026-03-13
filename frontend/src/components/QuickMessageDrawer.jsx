// ============================================================================
// file: frontend/src/components/QuickMessageDrawer.jsx
// Right-side quick message drawer (no page refresh)
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { Button } from "../ui";

function toInitial(nameOrUsername) {
  const s = (nameOrUsername || "").trim();
  return s ? s[0].toUpperCase() : "U";
}

export default function QuickMessageDrawer({
  open,
  onClose,
  recipientUsername,
  recipientDisplayName,
}) {
  const [threadId, setThreadId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const scrollerRef = useRef(null);

  const authed = !!localStorage.getItem("access");
  const meUsername = localStorage.getItem("username") || "";

  const title = useMemo(() => {
    return recipientDisplayName || recipientUsername || "Message";
  }, [recipientDisplayName, recipientUsername]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Lock scroll behind modal
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Start thread when opened
  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!open) return;

      setError("");
      setThreadId(null);
      setMessages([]);
      setText("");

      if (!authed) {
        setError("Please log in to send messages.");
        return;
      }
      if (!recipientUsername) {
        setError("Missing recipient username.");
        return;
      }

      setLoading(true);
      try {
        // ✅ backend: POST /api/messages/start/ -> { thread_id }
        const { data } = await api.post("/messages/start/", {
          username: recipientUsername,
        });
        if (cancelled) return;

        const tid = data?.thread_id;
        if (!tid) throw new Error("No thread_id returned from server.");
        setThreadId(tid);

        // ✅ backend: GET /api/messages/threads/<id>/messages/
        const resp = await api.get(`/messages/threads/${tid}/messages/`);
        if (cancelled) return;
        setMessages(Array.isArray(resp.data) ? resp.data : []);
      } catch (e) {
        console.error("[QuickMessageDrawer] start failed", e?.response || e);
        if (!cancelled) {
          setError(
            e?.response?.data?.detail ||
              e?.message ||
              "Could not open messages."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [open, authed, recipientUsername]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  async function sendMessage() {
    const body = (text || "").trim();
    if (!body || !threadId || sending) return;

    setSending(true);
    setError("");

    // optimistic message
    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender_username: meUsername,
      text: body,
      created_at: new Date().toISOString(),
      _optimistic: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");

    try {
      const { data } = await api.post(
        `/messages/threads/${threadId}/messages/`,
        { text: body }
      );

      // replace optimistic with real
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? data : m))
      );

      // Let inbox refresh if it listens to events
      window.dispatchEvent(new CustomEvent("inbox:changed"));
    } catch (e) {
      console.error("[QuickMessageDrawer] send failed", e?.response || e);
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(body); // restore text
      setError(
        e?.response?.data?.detail || e?.message || "Failed to send message."
      );
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      {/* backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close messages"
      />

      {/* drawer */}
      <aside className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {title}
            </div>
            <div className="truncate text-[11px] text-slate-500">
              @{recipientUsername}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="flex h-[calc(100%-116px)] flex-col">
          <div
            ref={scrollerRef}
            className="flex-1 overflow-y-auto px-4 py-4"
          >
            {loading ? (
              <div className="text-sm text-slate-500">Loading…</div>
            ) : error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-slate-500">
                No messages yet. Say hello 👋
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => {
                  const mine =
                    (m.sender_username || "").toLowerCase() ===
                    (meUsername || "").toLowerCase();

                  return (
                    <div
                      key={m.id}
                      className={
                        "flex " + (mine ? "justify-end" : "justify-start")
                      }
                    >
                      <div
                        className={
                          "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed " +
                          (mine
                            ? "bg-slate-900 text-white"
                            : "bg-slate-100 text-slate-900")
                        }
                      >
                        {!mine && (
                          <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-500">
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-slate-700">
                              {toInitial(recipientDisplayName || recipientUsername)}
                            </span>
                            <span className="truncate">{recipientDisplayName || recipientUsername}</span>
                          </div>
                        )}
                        <div>{m.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* composer */}
          <div className="border-t border-slate-200 p-3">
            <div className="flex items-end gap-2">
              <textarea
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                placeholder={
                  authed ? "Type a message…" : "Log in to send a message…"
                }
                value={text}
                disabled={!authed || loading}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <Button
                type="button"
                onClick={sendMessage}
                disabled={!authed || loading || sending || !text.trim()}
              >
                Send
              </Button>
            </div>

            <div className="mt-1 text-[11px] text-slate-500">
              Enter = send · Shift+Enter = new line
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}