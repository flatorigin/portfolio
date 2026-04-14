// ============================================================================
// file: frontend/src/components/QuickMessageDrawer.jsx
// Right-side quick message drawer (direct messages, no project context)
// Uses:
//   POST   /api/messages/start/                        -> { thread_id }
//   GET    /api/messages/threads/:thread_id/messages/
//   POST   /api/messages/threads/:thread_id/messages/ -> { ...message }
// Reusable composer UI:
//   - plain text
//   - plus menu for camera / image / doc / link
//   - reply preview
// Adds:
//   - attachment rendering
//   - 1-minute delete window for messages/attachments
//   - consistent image sizing
// ============================================================================
import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import MessageComposer from "./MessageComposer";

function toInitial(nameOrUsername) {
  const s = (nameOrUsername || "").trim();
  return s ? s[0].toUpperCase() : "U";
}

function isWithinDeleteWindow(createdAt) {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created <= 60 * 1000;
}

function MessageAttachments({
  attachments = [],
  mine = false,
  canDeleteMessage = false,
  onDeleteAttachment,
}) {
  if (!Array.isArray(attachments) || attachments.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {attachments.map((att, idx) => {
        const key = att.id || `${att.kind}-${att.url || att.file_url || idx}`;
        const fileUrl = att.file_url || att.url || "";
        const label = att.name || att.original_name || att.url || "Attachment";

        const isImage = att.kind === "image" || att.kind === "camera";
        const isLink = att.kind === "link";
        const canDelete = att.can_delete ?? canDeleteMessage;

        return (
          <div key={key}>
            {isImage && fileUrl ? (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="block">
                <div className="max-w-[340px]">
                  <img
                    src={fileUrl}
                    alt={label}
                    className="h-auto w-full rounded-xl border border-black/10 object-cover"
                  />
                </div>
              </a>
            ) : isLink ? (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className={
                  "block rounded-xl border px-3 py-2 text-xs underline " +
                  (mine
                    ? "border-slate-700 bg-slate-800 text-slate-100"
                    : "border-slate-200 bg-white text-slate-700")
                }
              >
                {label}
              </a>
            ) : (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className={
                  "block rounded-xl border px-3 py-2 text-xs " +
                  (mine
                    ? "border-slate-700 bg-slate-800 text-slate-100"
                    : "border-slate-200 bg-white text-slate-700")
                }
              >
                {label}
              </a>
            )}

            {canDelete && att.id ? (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => onDeleteAttachment?.(att)}
                  className="text-[11px] text-red-500 hover:text-red-700"
                >
                  Remove attachment
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function ReplySnippet({ message, mine = false }) {
  if (!message) return null;

  const sender = message.sender_username || "User";
  const text = (message.text || "").trim() || "Attachment";

  return (
    <div
      className={
        "mb-2 border-l-2 pl-3 text-[11px] " +
        (mine
          ? "border-slate-500 text-slate-200"
          : "border-slate-300 text-slate-600")
      }
    >
      <div className="font-medium">Replying to {sender}</div>
      <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap">{text}</div>
    </div>
  );
}

function normalizeErr(err) {
  const data = err?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data?.detail) return data.detail;
  if (data?.message) return data.message;
  if (err?.message) return err.message;
  return "Request failed.";
}

export default function QuickMessageDrawer({
  open,
  onClose,
  recipientUsername,
  recipientDisplayName,
  originProjectId,
  originProjectTitle,
}) {
  const [threadId, setThreadId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [composerAttachments, setComposerAttachments] = useState([]);
  const [replyTo, setReplyTo] = useState(null);

  const scrollerRef = useRef(null);
  const contextStampPendingRef = useRef(false);

  const authed = !!localStorage.getItem("access");
  const meUsername = localStorage.getItem("username") || "";

  const title = useMemo(() => {
    return recipientDisplayName || recipientUsername || "Message";
  }, [recipientDisplayName, recipientUsername]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!open) return;

      setError("");
      setThreadId(null);
      setMessages([]);
      setMessageText("");
      setComposerAttachments([]);
      setReplyTo(null);
      contextStampPendingRef.current = !!originProjectId;

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
        const payload = { username: recipientUsername };
        if (originProjectId) {
          payload.project_id = originProjectId;
        }

        const startRes = await api.post("/messages/start/", {
          ...payload,
        });
        if (cancelled) return;

        const tid = startRes?.data?.thread_id;
        if (!tid) throw new Error("No thread_id returned from server.");
        setThreadId(tid);

        const msgRes = await api.get(`/messages/threads/${tid}/messages/`);
        if (cancelled) return;

        setMessages(Array.isArray(msgRes.data) ? msgRes.data : []);
      } catch (err) {
        console.error("[QuickMessageDrawer] open failed", err?.response || err);
        if (!cancelled) setError(normalizeErr(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [open, authed, recipientUsername, originProjectId]);

  useEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  async function reloadMessages() {
    if (!threadId) return;
    const msgRes = await api.get(`/messages/threads/${threadId}/messages/`);
    setMessages(Array.isArray(msgRes.data) ? msgRes.data : []);
  }

  async function handleDeleteMessage(messageId) {
    try {
      await api.delete(`/messages/${messageId}/`);
      await reloadMessages();
      window.dispatchEvent(new CustomEvent("inbox:changed"));
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to delete message.");
    }
  }

  async function handleDeleteAttachment(att) {
    try {
      await api.delete(`/message-attachments/${att.id}/`);
      await reloadMessages();
      window.dispatchEvent(new CustomEvent("inbox:changed"));
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to remove attachment.");
    }
  }

  async function handleSend(e) {
    e?.preventDefault?.();

    const body = (messageText || "").trim();
    const hasText = !!body;
    const hasAttachments = composerAttachments.length > 0;

    if ((!hasText && !hasAttachments) || !threadId || sending) return;

    setSending(true);
    setError("");

    const optimistic = {
      id: `tmp-${Date.now()}`,
      sender_username: meUsername,
      text: body,
      created_at: new Date().toISOString(),
      context_project: contextStampPendingRef.current ? originProjectId : null,
      context_project_title: contextStampPendingRef.current
        ? originProjectTitle || ""
        : "",
      parent_message_id: replyTo?.id || null,
      parent_message_preview: replyTo
        ? {
            id: replyTo.id,
            sender_username: replyTo.sender_username || "User",
            text: replyTo.text || "",
            created_at: replyTo.created_at,
          }
        : null,
      attachments: composerAttachments.map((item) => ({
        kind: item.kind,
        url: item.url || "",
        name: item.file?.name || item.url || "Attachment",
        file_url: item.file ? URL.createObjectURL(item.file) : "",
      })),
      _optimistic: true,
    };

    setMessages((prev) => [...prev, optimistic]);
    setMessageText("");
    setComposerAttachments([]);
    setReplyTo(null);

    try {
      const formData = new FormData();

      formData.append("text", body);
      if (replyTo?.id) {
        formData.append("parent_message_id", String(replyTo.id));
      }
      if (contextStampPendingRef.current && originProjectId) {
        formData.append("context_project_id", String(originProjectId));
      }

      const links = [];

      composerAttachments.forEach((item) => {
        if (item.kind === "link" && item.url) {
          links.push({ url: item.url });
        } else if ((item.kind === "image" || item.kind === "camera") && item.file) {
          formData.append(
            item.kind === "camera" ? "camera_images" : "images",
            item.file
          );
        } else if (item.kind === "document" && item.file) {
          formData.append("documents", item.file);
        }
      });

      if (links.length) {
        formData.append("links", JSON.stringify(links));
      }

      const res = await api.post(
        `/messages/threads/${threadId}/messages/`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const real = res?.data || null;
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? real || m : m))
      );
      contextStampPendingRef.current = false;

      window.dispatchEvent(new CustomEvent("inbox:changed"));
    } catch (err) {
      console.error("[QuickMessageDrawer] send failed", err?.response || err);

      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setMessageText(body);
      setComposerAttachments(composerAttachments);
      setReplyTo(
        optimistic.parent_message_id
          ? messages.find((m) => m.id === optimistic.parent_message_id) || null
          : null
      );

      setError(normalizeErr(err));
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close messages"
      />

      <aside className="absolute right-0 top-0 h-full w-full max-w-[520px] bg-white shadow-2xl">
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

        <div className="flex h-[calc(100%-64px)] flex-col">
          <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <div className="text-sm text-slate-500">Loading…</div>
            ) : error && messages.length === 0 ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-sm text-slate-500">
                No messages yet. Say hello.
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => {
                  const mine =
                    (m.sender_username || "").toLowerCase() ===
                    (meUsername || "").toLowerCase();

                  const replyPreview =
                    m.parent_message_preview ||
                    (m.parent_message_id
                      ? messages.find((x) => x.id === m.parent_message_id)
                      : null);

                  const canDelete =
                    m.can_delete ?? isWithinDeleteWindow(m.created_at);

                  return (
                    <div
                      key={m.id}
                      className={"flex " + (mine ? "justify-end" : "justify-start")}
                    >
                      <div className="max-w-[80%]">
                        {m.context_project_title ? (
                          <div
                            className={
                              "mb-1 border-b border-slate-300 pb-1 text-xs font-semibold text-slate-700 " +
                              (mine ? "text-right" : "text-left")
                            }
                          >
                            Project: {m.context_project_title}
                          </div>
                        ) : null}
                        <div
                          className={
                            "rounded-2xl px-3 py-2 text-sm leading-relaxed " +
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
                              <span className="truncate">
                                {recipientDisplayName || recipientUsername}
                              </span>
                            </div>
                          )}

                          <ReplySnippet message={replyPreview} mine={mine} />

                          {m.text ? <div className="whitespace-pre-wrap">{m.text}</div> : null}

                          <MessageAttachments
                            attachments={m.attachments}
                            mine={mine}
                            canDeleteMessage={canDelete}
                            onDeleteAttachment={handleDeleteAttachment}
                          />
                        </div>

                        <div
                          className={
                            "mt-1 flex items-center gap-3 " +
                            (mine ? "justify-end" : "justify-start")
                          }
                        >
                          <button
                            type="button"
                            onClick={() => setReplyTo(m)}
                            className="text-[11px] text-slate-500 hover:text-slate-800"
                          >
                            Reply
                          </button>

                          {mine && canDelete && m.id ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(m.id)}
                              className="text-[11px] text-red-500 hover:text-red-700"
                            >
                              Delete
                            </button>
                          ) : null}

                          {m.created_at ? (
                            <div className="text-[10px] text-slate-400">
                              {new Date(m.created_at).toLocaleTimeString([], {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-3">
            {error && messages.length > 0 ? (
              <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <MessageComposer
              value={messageText}
              onChange={setMessageText}
              onSend={handleSend}
              sending={sending}
              disabled={!authed || loading}
              replyTo={replyTo}
              onCancelReply={() => setReplyTo(null)}
              attachments={composerAttachments}
              onAttachmentsChange={setComposerAttachments}
              placeholder={
                authed
                  ? `Message ${recipientDisplayName || recipientUsername || "user"}…`
                  : "Log in to send a message…"
              }
              allowCamera={true}
              allowImages={true}
              allowDocs={true}
              allowLinks={true}
            />

            <div className="mt-2 text-[11px] text-slate-500">
              Enter the message and use the plus button for photo, image, document, or link.
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
