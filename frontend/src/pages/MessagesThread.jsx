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
// - safer URL handling
// - async cleanup guards
// - optional bid badge support if backend provides it on inbox threads
// =======================================
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api";
import { Card, Button, Badge } from "../ui";
import MessageComposer from "../components/MessageComposer";

function isWithinDeleteWindow(createdAt) {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created <= 60 * 1000;
}

function toSafeUrl(raw) {
  if (!raw) return "";
  const value = String(raw).trim();

  if (/^(blob:|data:)/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;

  const hasProtocol = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value);
  const isAllowedProtocol = /^(https?:|blob:|data:|mailto:)/i.test(value);
  if (hasProtocol && !isAllowedProtocol) return "";

  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
}

function getThreadBidMeta(thread) {
  const unreadCount =
    Number(
      thread?.bid_unread_count ??
        thread?.new_bid_count ??
        thread?.unread_bid_count ??
        0
    ) || 0;

  const hasNewBid =
    !!thread?.has_new_bid ||
    !!thread?.project_has_new_bid ||
    unreadCount > 0;

  return {
    hasNewBid,
    unreadCount,
    projectTitle: thread?.project_title || "",
  };
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
        const fileUrl = toSafeUrl(att.file_url || att.url || "");
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
            ) : isLink && fileUrl ? (
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
            ) : fileUrl ? (
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
            ) : (
              <div
                className={
                  "block rounded-xl border px-3 py-2 text-xs " +
                  (mine
                    ? "border-slate-700 bg-slate-800 text-slate-100"
                    : "border-slate-200 bg-white text-slate-700")
                }
              >
                {label}
              </div>
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

function normalizeError(err, fallback) {
  const data = err?.response?.data;

  if (typeof data === "string") return data || fallback;
  if (data?.detail) return data.detail;

  if (data && typeof data === "object") {
    const first = Object.values(data)[0];
    if (Array.isArray(first) && first.length) return String(first[0]);
    if (typeof first === "string") return first;
  }

  return err?.message || fallback;
}

function emptyBidDraftForm() {
  return {
    price_type: "fixed",
    amount: "",
    amount_min: "",
    amount_max: "",
    timeline_text: "",
    proposal_text: "",
    included_text: "",
    excluded_text: "",
    payment_terms: "",
    valid_until: "",
    attachment: null,
  };
}

function emptyProjectDraftForm() {
  return {
    title: "",
    summary: "",
    job_summary: "",
    category: "",
    location: "",
    budget: "",
    sqf: "",
    post_privacy: "public",
    compliance_confirmed: false,
  };
}

function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div className="text-lg font-semibold text-slate-950">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function DraftField({ label, helper, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-slate-800">{label}</label>
      {children}
      {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
}

export default function MessagesThread() {
  const { threadId: threadIdParam } = useParams();
  const navigate = useNavigate();
  const isMountedRef = useRef(false);

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
  const [meUsername, setMeUsername] = useState(() => localStorage.getItem("username") || "");
  const [meProfileType, setMeProfileType] = useState("");
  const [draftError, setDraftError] = useState("");
  const [convertingMessageId, setConvertingMessageId] = useState(null);
  const [bidDraftOpen, setBidDraftOpen] = useState(false);
  const [bidDraftContext, setBidDraftContext] = useState(null);
  const [bidDraftForm, setBidDraftForm] = useState(emptyBidDraftForm());
  const [bidSubmitting, setBidSubmitting] = useState(false);
  const [projectDraftOpen, setProjectDraftOpen] = useState(false);
  const [projectDraftContext, setProjectDraftContext] = useState(null);
  const [projectDraftForm, setProjectDraftForm] = useState(emptyProjectDraftForm());
  const [projectSubmitting, setProjectSubmitting] = useState(false);

  useEffect(() => {
    const syncUsername = () => {
      if (isMountedRef.current) {
        setMeUsername(localStorage.getItem("username") || "");
      }
    };
    syncUsername();
    window.addEventListener("storage", syncUsername);
    window.addEventListener("auth:changed", syncUsername);
    return () => {
      window.removeEventListener("storage", syncUsername);
      window.removeEventListener("auth:changed", syncUsername);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const token = localStorage.getItem("access");

    if (!token) {
      setMeProfileType("");
      return () => {
        alive = false;
      };
    }

    (async () => {
      try {
        const { data } = await api.get("/users/me/");
        if (alive) setMeProfileType(data?.profile_type || "");
      } catch {
        if (alive) setMeProfileType("");
      }
    })();

    return () => {
      alive = false;
    };
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

  const activeThreadBidMeta = useMemo(
    () => getThreadBidMeta(activeThread),
    [activeThread]
  );
  const canUseBidConversion = meProfileType === "contractor" && !!activeThread?.project;
  const canUseProjectConversion = meProfileType === "homeowner" && !activeThread?.project;

  const fetchThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const { data } = await api.get("/inbox/threads/");
      const arr = Array.isArray(data) ? data : [];
      if (!isMountedRef.current) return;

      setThreads(arr);
      setActiveThreadId((prev) => {
        if (threadIdParam) return Number(threadIdParam);
        if (prev) return prev;
        return null;
      });
    } catch (err) {
      console.error("[MessagesThread] failed to load threads", err?.response || err);
      if (isMountedRef.current) setThreads([]);
    } finally {
      if (isMountedRef.current) setLoadingThreads(false);
    }
  }, [threadIdParam]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const fetchMessages = useCallback(
    async ({ silent = false } = {}) => {
      if (!activeThread?.id) {
        if (isMountedRef.current) setMessages([]);
        return;
      }

      if (!silent) setLoadingMessages(true);

      try {
        const { data } = await api.get(
          `/messages/threads/${activeThread.id}/messages/`
        );
        const arr = Array.isArray(data) ? data : [];
        if (!isMountedRef.current) return;

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
        if (!silent && isMountedRef.current) setMessages([]);
      } finally {
        if (!silent && isMountedRef.current) setLoadingMessages(false);
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

  function closeBidDraftModal() {
    setBidDraftOpen(false);
    setBidDraftContext(null);
    setBidDraftForm(emptyBidDraftForm());
    setDraftError("");
  }

  function closeProjectDraftModal() {
    setProjectDraftOpen(false);
    setProjectDraftContext(null);
    setProjectDraftForm(emptyProjectDraftForm());
    setDraftError("");
  }

  async function handlePrefillBid(message) {
    if (!message?.id) return;
    setDraftError("");
    setConvertingMessageId(message.id);
    try {
      const { data } = await api.post(`/messages/${message.id}/prefill-bid/`);
      setBidDraftContext(data);
      setBidDraftForm({
        ...emptyBidDraftForm(),
        ...(data?.prefill || {}),
      });
      setBidDraftOpen(true);
    } catch (err) {
      setDraftError(normalizeError(err, "Could not prepare a bid draft from this message."));
    } finally {
      if (isMountedRef.current) setConvertingMessageId(null);
    }
  }

  async function handlePrefillProject(message) {
    if (!message?.id) return;
    setDraftError("");
    setConvertingMessageId(message.id);
    try {
      const { data } = await api.post(`/messages/${message.id}/prefill-project/`);
      setProjectDraftContext(data);
      setProjectDraftForm({
        ...emptyProjectDraftForm(),
        ...(data?.prefill || {}),
      });
      setProjectDraftOpen(true);
    } catch (err) {
      setDraftError(normalizeError(err, "Could not prepare a project draft from this message."));
    } finally {
      if (isMountedRef.current) setConvertingMessageId(null);
    }
  }

  async function submitBidDraft(event) {
    event.preventDefault();
    if (!bidDraftContext?.project_id) return;

    setBidSubmitting(true);
    setDraftError("");
    try {
      const fd = new FormData();
      fd.append("price_type", bidDraftForm.price_type);
      if (bidDraftForm.price_type === "fixed") {
        fd.append("amount", bidDraftForm.amount);
      } else {
        fd.append("amount_min", bidDraftForm.amount_min);
        fd.append("amount_max", bidDraftForm.amount_max);
      }
      fd.append("timeline_text", bidDraftForm.timeline_text || "");
      fd.append("proposal_text", bidDraftForm.proposal_text || "");
      fd.append("included_text", bidDraftForm.included_text || "");
      fd.append("excluded_text", bidDraftForm.excluded_text || "");
      fd.append("payment_terms", bidDraftForm.payment_terms || "");
      fd.append("valid_until", bidDraftForm.valid_until || "");
      if (bidDraftForm.attachment) fd.append("attachment", bidDraftForm.attachment);

      await api.post(`/projects/${bidDraftContext.project_id}/bids/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      closeBidDraftModal();
      await fetchThreads();
      navigate(`/projects/${bidDraftContext.project_id}`);
    } catch (err) {
      setDraftError(normalizeError(err, "Could not submit this bid."));
    } finally {
      if (isMountedRef.current) setBidSubmitting(false);
    }
  }

  async function submitProjectDraft(mode = "draft") {
    setProjectSubmitting(true);
    setDraftError("");
    try {
      const postPrivacy = projectDraftForm.post_privacy || "public";
      const inviteUsername = projectDraftContext?.suggested_private_invite_username || "";

      if (mode === "publish" && !projectDraftForm.compliance_confirmed) {
        throw new Error("Please confirm compliance before publishing.");
      }

      if (postPrivacy === "private" && !inviteUsername) {
        throw new Error("A private project from chat needs a contractor in this conversation to invite.");
      }

      const payload = {
        title: projectDraftForm.title || "New project draft",
        summary: projectDraftForm.summary || "",
        job_summary: projectDraftForm.job_summary || projectDraftForm.summary || "",
        category: projectDraftForm.category || "",
        location: projectDraftForm.location || "",
        budget: projectDraftForm.budget || null,
        sqf: projectDraftForm.sqf || null,
        is_job_posting: true,
        is_public: mode === "publish" && postPrivacy === "public",
        is_private: postPrivacy === "private",
        post_privacy: postPrivacy,
        compliance_confirmed: !!projectDraftForm.compliance_confirmed,
        private_contractor_usernames:
          postPrivacy === "private" && inviteUsername ? [inviteUsername] : [],
      };

      const { data } = await api.post("/projects/", payload);
      closeProjectDraftModal();
      navigate(`/projects/${data.id}`);
    } catch (err) {
      setDraftError(normalizeError(err, "Could not create this project draft."));
    } finally {
      if (isMountedRef.current) setProjectSubmitting(false);
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

      if (!isMountedRef.current) return;

      setMessageText("");
      setComposerAttachments([]);
      setReplyTo(null);

      await fetchMessages({ silent: false });
      const previewText = body || (composerAttachments.some((item) => item.kind === "link") ? "Link" : "Attachment");
      const nowIso = new Date().toISOString();
      setThreads((prev) => {
        const next = [...prev];
        const index = next.findIndex((thread) => String(thread.id) === String(activeThread.id));
        if (index === -1) return prev;
        const updated = {
          ...next[index],
          updated_at: nowIso,
          latest_message: {
            ...(next[index].latest_message || {}),
            id: `local-${Date.now()}`,
            sender_username: meUsername,
            text: body,
            attachment_name: !body && previewText === "Attachment" ? previewText : "",
            created_at: nowIso,
          },
        };
        next.splice(index, 1);
        next.unshift(updated);
        return next;
      });
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        "Failed to send message.";
      alert(typeof msg === "string" ? msg : JSON.stringify(msg));
    } finally {
      if (isMountedRef.current) setSending(false);
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
    <>
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
                const bidMeta = getThreadBidMeta(t);

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
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
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
                      </div>

                      {bidMeta.hasNewBid ? (
                        <Badge className="shrink-0 bg-emerald-600 text-white">
                          {bidMeta.unreadCount > 1
                            ? `${bidMeta.unreadCount} bids`
                            : "New Bid"}
                        </Badge>
                      ) : null}
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

                    <div className="min-w-0">
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

                      {activeThreadBidMeta.hasNewBid ? (
                        <div className="mt-0.5 flex items-center gap-2">
                          <Badge className="bg-emerald-600 text-white">
                            {activeThreadBidMeta.unreadCount > 1
                              ? `${activeThreadBidMeta.unreadCount} bids`
                              : "New Bid"}
                          </Badge>
                        </div>
                      ) : null}
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

                {draftError ? (
                  <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {draftError}
                  </div>
                ) : null}
              </div>

              <div className="mb-3 flex-1 overflow-y-auto rounded-xl bg-slate-50 p-3">
                {loadingMessages ? (
                  <p className="text-xs text-slate-500">Loading messages…</p>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-slate-500">No messages yet.</p>
                ) : (
                  <>
                    {messages.map((m) => {
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
                          {m.context_project_title ? (
                            <div
                              className={
                                "mb-1 border-b border-slate-300 pb-1 text-xs font-semibold text-slate-700 " +
                                (fromMe ? "text-right" : "text-left")
                              }
                            >
                              Project: {m.context_project_title}
                            </div>
                          ) : null}
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

                            {canUseBidConversion && (m.text || "").trim() ? (
                              <button
                                type="button"
                                onClick={() => handlePrefillBid(m)}
                                disabled={convertingMessageId === m.id}
                                className="text-[11px] font-medium text-sky-700 hover:text-sky-900 disabled:opacity-60"
                              >
                                {convertingMessageId === m.id ? "Preparing..." : "Convert to Bid"}
                              </button>
                            ) : null}

                            {canUseProjectConversion && (m.text || "").trim() ? (
                              <button
                                type="button"
                                onClick={() => handlePrefillProject(m)}
                                disabled={convertingMessageId === m.id}
                                className="text-[11px] font-medium text-sky-700 hover:text-sky-900 disabled:opacity-60"
                              >
                                {convertingMessageId === m.id ? "Preparing..." : "Create Project from Chat"}
                              </button>
                            ) : null}

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
                  })}
                  </>
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

    <Modal
      open={bidDraftOpen}
      onClose={closeBidDraftModal}
      title="Convert Message to Bid"
    >
      <form className="space-y-4" onSubmit={submitBidDraft}>
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            Pre-filled from conversation message
          </div>
          <div className="mt-1">
            This bid will be created for:{" "}
            <span className="font-semibold">{bidDraftContext?.project_title || "Project"}</span>
          </div>
        </div>

        {bidDraftContext?.source_text ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Source message
            </div>
            <div className="mt-1 whitespace-pre-wrap">{bidDraftContext.source_text}</div>
          </div>
        ) : null}

        {draftError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {draftError}
          </div>
        ) : null}

        <DraftField label="Project">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {bidDraftContext?.project_title || "Project"}
          </div>
        </DraftField>

        <DraftField label="Price type">
          <div className="flex flex-wrap gap-4">
            {[
              { value: "fixed", label: "Fixed price" },
              { value: "range", label: "Estimate range" },
            ].map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="price_type"
                  value={option.value}
                  checked={bidDraftForm.price_type === option.value}
                  onChange={(event) =>
                    setBidDraftForm((prev) => ({ ...prev, price_type: event.target.value }))
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </DraftField>

        {bidDraftForm.price_type === "fixed" ? (
          <DraftField
            label="Bid amount"
            helper="Enter the total amount you would charge for this job."
          >
            <input
              type="number"
              min="0"
              step="0.01"
              value={bidDraftForm.amount}
              onChange={(event) =>
                setBidDraftForm((prev) => ({ ...prev, amount: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              placeholder="Example: 4500"
            />
          </DraftField>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <DraftField label="Minimum amount">
              <input
                type="number"
                min="0"
                step="0.01"
                value={bidDraftForm.amount_min}
                onChange={(event) =>
                  setBidDraftForm((prev) => ({ ...prev, amount_min: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="Example: 4000"
              />
            </DraftField>
            <DraftField label="Maximum amount">
              <input
                type="number"
                min="0"
                step="0.01"
                value={bidDraftForm.amount_max}
                onChange={(event) =>
                  setBidDraftForm((prev) => ({ ...prev, amount_max: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
                placeholder="Example: 5500"
              />
            </DraftField>
          </div>
        )}

        <DraftField label="Estimated timeline">
          <input
            type="text"
            value={bidDraftForm.timeline_text}
            onChange={(event) =>
              setBidDraftForm((prev) => ({ ...prev, timeline_text: event.target.value }))
            }
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Example: 2–3 weeks"
          />
        </DraftField>

        <DraftField
          label="Proposal"
          helper="This is your main message to the owner. Explain how you would handle the project."
        >
          <textarea
            rows={6}
            value={bidDraftForm.proposal_text}
            onChange={(event) =>
              setBidDraftForm((prev) => ({ ...prev, proposal_text: event.target.value }))
            }
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Describe your approach, understanding of the job, and anything the owner should know before choosing your bid."
          />
        </DraftField>

        <DraftField label="What’s included">
          <textarea
            rows={4}
            value={bidDraftForm.included_text}
            onChange={(event) =>
              setBidDraftForm((prev) => ({ ...prev, included_text: event.target.value }))
            }
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Example: labor, installation, standard materials, site cleanup"
          />
        </DraftField>

        <DraftField label="What’s excluded">
          <textarea
            rows={4}
            value={bidDraftForm.excluded_text}
            onChange={(event) =>
              setBidDraftForm((prev) => ({ ...prev, excluded_text: event.target.value }))
            }
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Example: permit fees, specialty finishes, hidden damage repair"
          />
        </DraftField>

        <DraftField label="Payment terms">
          <textarea
            rows={3}
            value={bidDraftForm.payment_terms}
            onChange={(event) =>
              setBidDraftForm((prev) => ({ ...prev, payment_terms: event.target.value }))
            }
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Example: 30% deposit, 40% during work, 30% on completion"
          />
        </DraftField>

        <div className="grid gap-4 md:grid-cols-2">
          <DraftField label="Bid valid until">
            <input
              type="date"
              value={bidDraftForm.valid_until}
              onChange={(event) =>
                setBidDraftForm((prev) => ({ ...prev, valid_until: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            />
          </DraftField>
          <DraftField label="Attachment (optional)">
            <input
              type="file"
              onChange={(event) =>
                setBidDraftForm((prev) => ({
                  ...prev,
                  attachment: event.target.files?.[0] || null,
                }))
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            />
          </DraftField>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={closeBidDraftModal}>
            Cancel
          </Button>
          <Button type="submit" disabled={bidSubmitting}>
            {bidSubmitting ? "Sending..." : "Send Bid"}
          </Button>
        </div>
      </form>
    </Modal>

    <Modal
      open={projectDraftOpen}
      onClose={closeProjectDraftModal}
      title="Create Project from Chat"
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-950">
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">
            Pre-filled from conversation message
          </div>
          <div className="mt-1">
            Review this draft before saving or publishing. It will not be created until you confirm.
          </div>
        </div>

        {projectDraftContext?.source_text ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Source message
            </div>
            <div className="mt-1 whitespace-pre-wrap">{projectDraftContext.source_text}</div>
          </div>
        ) : null}

        {draftError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {draftError}
          </div>
        ) : null}

        <DraftField label="Project title">
          <input
            type="text"
            value={projectDraftForm.title}
            onChange={(event) =>
              setProjectDraftForm((prev) => ({ ...prev, title: event.target.value }))
            }
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Example: Kitchen cabinet refinish"
          />
        </DraftField>

        <DraftField label="Summary">
          <textarea
            rows={4}
            value={projectDraftForm.summary}
            onChange={(event) =>
              setProjectDraftForm((prev) => ({
                ...prev,
                summary: event.target.value,
                job_summary: prev.job_summary || event.target.value,
              }))
            }
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Short project summary"
          />
        </DraftField>

        <DraftField label="Detailed description">
          <textarea
            rows={6}
            value={projectDraftForm.job_summary}
            onChange={(event) =>
              setProjectDraftForm((prev) => ({ ...prev, job_summary: event.target.value }))
            }
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            placeholder="Project details, scope, constraints, and notes"
          />
        </DraftField>

        <div className="grid gap-4 md:grid-cols-2">
          <DraftField label="Category">
            <input
              type="text"
              value={projectDraftForm.category}
              onChange={(event) =>
                setProjectDraftForm((prev) => ({ ...prev, category: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              placeholder="Example: Renovation"
            />
          </DraftField>
          <DraftField label="Location">
            <input
              type="text"
              value={projectDraftForm.location}
              onChange={(event) =>
                setProjectDraftForm((prev) => ({ ...prev, location: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              placeholder="City, State"
            />
          </DraftField>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DraftField label="Budget">
            <input
              type="number"
              min="0"
              step="0.01"
              value={projectDraftForm.budget}
              onChange={(event) =>
                setProjectDraftForm((prev) => ({ ...prev, budget: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              placeholder="Example: 25000"
            />
          </DraftField>
          <DraftField label="Square feet">
            <input
              type="number"
              min="0"
              step="1"
              value={projectDraftForm.sqf}
              onChange={(event) =>
                setProjectDraftForm((prev) => ({ ...prev, sqf: event.target.value }))
              }
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              placeholder="Example: 1800"
            />
          </DraftField>
        </div>

        <DraftField label="Privacy">
          <div className="flex flex-wrap gap-4">
            {[
              { value: "public", label: "Public project" },
              { value: "private", label: "Private invite" },
            ].map((option) => (
              <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="post_privacy"
                  value={option.value}
                  checked={projectDraftForm.post_privacy === option.value}
                  onChange={(event) =>
                    setProjectDraftForm((prev) => ({ ...prev, post_privacy: event.target.value }))
                  }
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
          {projectDraftForm.post_privacy === "private" ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {projectDraftContext?.suggested_private_invite_username ? (
                <>
                  This private job will invite{" "}
                  <span className="font-semibold">
                    @{projectDraftContext.suggested_private_invite_username}
                  </span>
                  {" "}from this conversation.
                </>
              ) : (
                "This conversation does not include a contractor account to invite yet."
              )}
            </div>
          ) : null}
        </DraftField>

        <label className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={!!projectDraftForm.compliance_confirmed}
            onChange={(event) =>
              setProjectDraftForm((prev) => ({
                ...prev,
                compliance_confirmed: event.target.checked,
              }))
            }
          />
          <span>
            I understand that I am liable for the content I post and confirm it complies with platform terms and applicable laws.
          </span>
        </label>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={closeProjectDraftModal}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={projectSubmitting}
            onClick={() => submitProjectDraft("draft")}
          >
            {projectSubmitting ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            type="button"
            disabled={projectSubmitting}
            onClick={() => submitProjectDraft("publish")}
          >
            {projectSubmitting ? "Publishing..." : "Publish Project"}
          </Button>
        </div>
      </div>
    </Modal>
    </>
  );
}
