// =======================================
// file: frontend/src/pages/MessagesThread.jsx
// Inbox page
// Desktop: left = people list, right = conversation
// Mobile: list first, then full-screen thread view after tap
// Uses DIRECT message endpoints (no project required)
// Shows request controls: Accept / Ignore / Block
// Adds reusable MessageComposer with attachments + reply preview
// Adds:
// - reply snippet inside messages
// - attachment rendering
// - 1-minute delete window for messages/attachments
// - consistent image sizing
// =======================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api";
import { Card, Button } from "../ui";
import MessageComposer from "../components/MessageComposer";

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

export default function MessagesThread() {
  const { threadId: threadIdParam } = useParams();
  const navigate = useNavigate();

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);

  useEffect(() => {
    if (!threadIdParam) {
      setActiveThreadId(null);
      return;
    }
    setActiveThreadId(Number(threadIdParam));
  }, [threadIdParam]);

  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState([]);
  const [replyTo, setReplyTo] = useState(null);

  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const [readThreadIds, setReadThreadIds] = useState(new Set());
  const [meUsername, setMeUsername] = useState("");

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
  const canReply =
    activeThread?.can_reply !== undefined ? !!activeThread.can_reply : true;

  const markThreadRead = (id) => {
    setReadThreadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

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

  const fetchThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const { data } = await api.get("/inbox/threads/");
      const arr = Array.isArray(data) ? data : [];
      setThreads(arr);

      setActiveThreadId((prev) => {
        if (threadIdParam) return Number(threadIdParam);
        if (prev) return prev;
        return null;
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
        console.error(
          "[MessagesThread] failed to load messages",
          err?.response || err
        );
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

  async function threadAction(action) {
    if (!activeThread?.id) return;
    try {
      await api.post(`/inbox/threads/${activeThread.id}/actions/`, { action });
      await fetchThreads();
      await fetchMessages({ silent: false });
    } catch (err) {
      console.error(
        "[MessagesThread] thread action failed",
        err?.response || err
      );
      alert(err?.response?.data?.detail || "Action failed.");
    }
  }

  async function handleDeleteMessage(messageId) {
    try {
      await api.delete(`/messages/${messageId}/`);
      await fetchMessages({ silent: false });
      await fetchThreads();
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to delete message.");
    }
  }

  async function handleDeleteAttachment(att) {
    try {
      await api.delete(`/message-attachments/${att.id}/`);
      await fetchMessages({ silent: false });
      await fetchThreads();
    } catch (err) {
      alert(err?.response?.data?.detail || "Failed to remove attachment.");
    }
  }

  const handleSend = async (e) => {
    e.preventDefault();
    if (!activeThread?.id) return;

    const body = (messageText || "").trim();
    const hasText = !!body;
    const hasAttachments = composerAttachments.length > 0;

    if (!hasText && !hasAttachments) return;

    setSending(true);
    try {
      const formData = new FormData();

      formData.append("text", body);
      if (replyTo?.id) {
        formData.append("parent_message_id", String(replyTo.id));
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

      await api.post(`/messages/threads/${activeThread.id}/messages/`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMessageText("");
      setComposerAttachments([]);
      setReplyTo(null);

      await fetchMessages({ silent: false });
      await fetchThreads();
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

  const openThread = (id) => {
    setActiveThreadId(id);
    markThreadRead(id);
    navigate(`/messages/${id}`);
  };

  const closeMobileThread = () => {
    setActiveThreadId(null);
    setReplyTo(null);
    navigate("/messages");
  };

  return (
    <div className="flex items-start gap-4">
      <div
        className={[
          "w-full md:w-64 md:shrink-0",
          activeThreadId ? "hidden md:block" : "block",
        ].join(" ")}
      >
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
                    onClick={() => openThread(t.id)}
                    className={[
                      "block w-full border-b border-slate-100 px-3 py-3 text-left text-sm",
                      isActive ? "bg-slate-100" : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div
                      className={
                        "truncate text-sm " +
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

      <div
        className={[
          "w-full flex-1",
          activeThreadId ? "block" : "hidden md:block",
        ].join(" ")}
      >
        <Card className="flex h-[calc(100vh-140px)] min-h-[320px] flex-col p-4">
          {!activeThread ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Select a conversation from the left.
            </div>
          ) : (
            <>
              <div className="mb-3 border-b border-slate-200 pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center">
                    <button
                      type="button"
                      onClick={closeMobileThread}
                      className="mr-2 rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 md:hidden"
                    >
                      Back
                    </button>

                    <div className="truncate text-sm font-semibold text-slate-900">
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
                </div>

                {threadIsRequest && (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="text-xs font-semibold text-amber-900">
                      Message request
                    </div>
                    <div className="mt-1 text-[11px] text-amber-800">
                      Accept to allow replies. Ignore to pause it for 24 hours.
                      Block stops messages.
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button type="button" onClick={() => threadAction("accept")}>
                        Accept
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => threadAction("ignore")}
                      >
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

                    const replyPreview =
                      m.parent_message_preview ||
                      (m.parent_message_id
                        ? messages.find((x) => x.id === m.parent_message_id)
                        : null);

                    const canDelete =
                      m.can_delete ?? isWithinDeleteWindow(m.created_at);

                    return (
                      <div key={m.id} className={`mb-2 flex ${alignClass}`}>
                        <div className="max-w-[85%] md:max-w-[70%]">
                          <div
                            className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${bubbleClass}`}
                          >
                            <ReplySnippet message={replyPreview} mine={fromMe} />

                            {m.text ? (
                              <p className="whitespace-pre-wrap">{m.text}</p>
                            ) : null}

                            <MessageAttachments
                              attachments={m.attachments}
                              mine={fromMe}
                              canDeleteMessage={canDelete}
                              onDeleteAttachment={handleDeleteAttachment}
                            />

                            <div
                              className={
                                "mt-1 text-[10px] " +
                                (fromMe
                                  ? "text-right text-slate-300"
                                  : "text-slate-500")
                              }
                            >
                              {timeLabel}
                            </div>
                          </div>

                          <div
                            className={
                              "mt-1 flex items-center gap-3 " +
                              (fromMe ? "justify-end" : "justify-start")
                            }
                          >
                            <button
                              type="button"
                              onClick={() => setReplyTo(m)}
                              className="text-[11px] text-slate-500 hover:text-slate-800"
                            >
                              Reply
                            </button>

                            {fromMe && canDelete && m.id ? (
                              <button
                                type="button"
                                onClick={() => handleDeleteMessage(m.id)}
                                className="text-[11px] text-red-500 hover:text-red-700"
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <MessageComposer
                value={messageText}
                onChange={setMessageText}
                onSend={handleSend}
                sending={sending}
                disabled={!canReply}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                attachments={composerAttachments}
                onAttachmentsChange={setComposerAttachments}
                placeholder="Type a message…"
                allowCamera={true}
                allowImages={true}
                allowDocs={true}
                allowLinks={true}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}