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
import { Card, Button, Badge, SymbolIcon } from "../ui";
import MessageComposer from "../components/MessageComposer";
import ReportContentButton from "../components/ReportContentButton";
import { canDeletePersistedMessage } from "../lib/messages";

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
  const bid = thread?.bid || null;
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
    bid,
    hasNewBid,
    unreadCount,
    projectTitle: thread?.project_title || "",
    statusLabel: bid?.status_label || "",
  };
}

function roleLabel(profileType) {
  if (profileType === "contractor") return "Contractor";
  if (profileType === "homeowner") return "Homeowner";
  return "Member";
}

function formatConversationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function ConversationAvatar({ person, className = "h-10 w-10", textClassName = "text-sm" }) {
  const name = person?.display_name || person?.username || "User";
  const avatarUrl = toSafeUrl(person?.avatar_url || "");

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 font-semibold text-slate-700 ${className}`}
      aria-hidden="true"
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={textClassName}>{name.trim().charAt(0).toUpperCase() || "U"}</span>
      )}
    </span>
  );
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
  const activeThreadIdRef = useRef(null);
  const messageFetchSequenceRef = useRef(0);

  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [threadSearch, setThreadSearch] = useState("");
  const [threadFilter, setThreadFilter] = useState("all");
  const [threadError, setThreadError] = useState("");

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
  const [messageError, setMessageError] = useState("");

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

  const counterpartFor = (thread) => {
    if (!thread) return null;
    if (thread.counterpart) return thread.counterpart;

    const ownerProfile = thread.owner_profile || {};
    const clientProfile = thread.client_profile || {};

    const ownerUsernameRaw = thread.owner_username || ownerProfile.username || "";
    const clientUsernameRaw = thread.client_username || clientProfile.username || "";

    const ownerLower = ownerUsernameRaw.toLowerCase();
    const clientLower = clientUsernameRaw.toLowerCase();

    const ownerDisplay = ownerProfile.display_name || ownerUsernameRaw || "User";
    const clientDisplay = clientProfile.display_name || clientUsernameRaw || "User";
    const ownerAvatar = ownerProfile.avatar_url || "";
    const clientAvatar = clientProfile.avatar_url || "";
    const ownerType = ownerProfile.profile_type || "";
    const clientType = clientProfile.profile_type || "";

    if (meLower && ownerLower === meLower) {
      return {
        username: clientUsernameRaw,
        display_name: clientDisplay,
        avatar_url: clientAvatar,
        profile_type: clientType,
      };
    }
    if (meLower && clientLower === meLower) {
      return {
        username: ownerUsernameRaw,
        display_name: ownerDisplay,
        avatar_url: ownerAvatar,
        profile_type: ownerType,
      };
    }
    return {
      username: clientUsernameRaw,
      display_name: clientDisplay,
      avatar_url: clientAvatar,
      profile_type: clientType,
    };
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
  const latestConvertibleMessage = useMemo(
    () =>
      [...messages]
        .reverse()
        .find(
          (message) =>
            (message?.text || "").trim() &&
            (message?.sender_username || "").toLowerCase() !== meLower
        ) || null,
    [messages, meLower]
  );

  const unreadActivityCount = useMemo(
    () =>
      threads.reduce(
        (total, thread) =>
          total + Number(thread?.unread_count || 0) + Number(thread?.bid_unread_count || 0),
        0
      ),
    [threads]
  );

  const filteredThreads = useMemo(() => {
    const query = threadSearch.trim().toLowerCase();
    return threads.filter((thread) => {
      if (threadFilter === "unread" && !thread.is_unread && !thread.has_new_bid) return false;
      if (threadFilter === "requests" && !thread.is_request) return false;

      if (!query) return true;
      const person = counterpartFor(thread);
      const searchable = [
        person?.display_name,
        person?.username,
        person?.profile_type,
        thread.project_title,
        thread.latest_message?.text,
        thread.latest_message?.attachment_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [threads, threadFilter, threadSearch, meLower]);

  const fetchThreads = useCallback(async () => {
    setLoadingThreads(true);
    setThreadError("");
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
      if (isMountedRef.current) {
        setThreadError("Unable to load your conversations. Please try again.");
      }
    } finally {
      if (isMountedRef.current) setLoadingThreads(false);
    }
  }, [threadIdParam]);

  const markThreadRead = useCallback(async (id) => {
    const thread = threads.find((item) => String(item.id) === String(id));
    if (!thread || (!thread.is_unread && !thread.has_new_bid)) return;

    setThreads((current) =>
      current.map((item) =>
        String(item.id) === String(id)
          ? { ...item, unread_count: 0, is_unread: false, has_new_bid: false, bid_unread_count: 0 }
          : item
      )
    );

    try {
      const { data } = await api.post(`/inbox/threads/${id}/read/`);
      if (!isMountedRef.current) return;
      setThreads((current) =>
        current.map((item) => (String(item.id) === String(id) ? data : item))
      );
      window.dispatchEvent(new CustomEvent("inbox:changed"));
    } catch (err) {
      console.error("[MessagesThread] failed to mark thread read", err?.response || err);
      fetchThreads();
    }
  }, [threads, fetchThreads]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    const refreshThreads = () => {
      fetchThreads();
    };
    const refreshOnVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchThreads();
      }
    };

    window.addEventListener("focus", refreshThreads);
    window.addEventListener("inbox:changed", refreshThreads);
    document.addEventListener("visibilitychange", refreshOnVisible);

    const interval = setInterval(refreshThreads, 60000);

    return () => {
      window.removeEventListener("focus", refreshThreads);
      window.removeEventListener("inbox:changed", refreshThreads);
      document.removeEventListener("visibilitychange", refreshOnVisible);
      clearInterval(interval);
    };
  }, [fetchThreads]);

  useEffect(() => {
    activeThreadIdRef.current = activeThread?.id || null;
    messageFetchSequenceRef.current += 1;
    setMessages([]);
    setReplyTo(null);
    setMessageError("");
    setLoadingMessages(false);
  }, [activeThread?.id]);

  const fetchMessages = useCallback(
    async ({ silent = false } = {}) => {
      const requestedThreadId = activeThread?.id;
      if (!requestedThreadId) {
        if (isMountedRef.current) setMessages([]);
        return;
      }

      const requestSequence = ++messageFetchSequenceRef.current;
      if (!silent) {
        setLoadingMessages(true);
        setMessageError("");
      }

      try {
        const { data } = await api.get(
          `/messages/threads/${requestedThreadId}/messages/`
        );
        const arr = (Array.isArray(data) ? data : []).filter(
          (message) => String(message?.thread) === String(requestedThreadId)
        );
        if (
          !isMountedRef.current
          || requestSequence !== messageFetchSequenceRef.current
          || String(activeThreadIdRef.current) !== String(requestedThreadId)
        ) return;
        setMessages(arr);
      } catch (err) {
        console.error(
          "[MessagesThread] failed to load messages",
          err?.response || err
        );
        if (
          !silent
          && isMountedRef.current
          && requestSequence === messageFetchSequenceRef.current
          && String(activeThreadIdRef.current) === String(requestedThreadId)
        ) {
          setMessageError("Unable to load this conversation. Please try again.");
        }
      } finally {
        if (
          !silent
          && isMountedRef.current
          && requestSequence === messageFetchSequenceRef.current
          && String(activeThreadIdRef.current) === String(requestedThreadId)
        ) setLoadingMessages(false);
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

  useEffect(() => {
    if (!activeThread?.id || messages.length === 0) return;
    markThreadRead(activeThread.id);
  }, [activeThread?.id, messages]);

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
    <div className="space-y-4 py-6">
      <header
        className={[
          "items-end justify-between gap-4",
          activeThreadId ? "hidden md:flex" : "flex",
        ].join(" ")}
      >
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-950">Inbox</h1>
            {unreadActivityCount > 0 ? (
              <Badge className="border-sky-200 bg-sky-50 font-semibold text-sky-800">
                {unreadActivityCount} unread
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Keep project questions, bids, and updates together.
          </p>
        </div>
      </header>

      <div className="flex items-start gap-4">
      <div
        className={[
          "w-full md:w-80 md:shrink-0",
          activeThreadId ? "hidden md:block" : "block",
        ].join(" ")}
      >
        <Card className="flex h-[calc(100vh-210px)] min-h-[420px] flex-col overflow-hidden p-0">
          <div className="space-y-3 border-b border-slate-200 p-3">
            <label className="relative block">
              <span className="sr-only">Search conversations</span>
              <SymbolIcon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[19px] text-slate-400"
              />
              <input
                type="search"
                value={threadSearch}
                onChange={(event) => setThreadSearch(event.target.value)}
                placeholder="Search conversations"
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
              />
            </label>

            <div className="grid grid-cols-3 rounded-lg bg-slate-100 p-1" aria-label="Conversation filters">
              {[
                { value: "all", label: "All" },
                { value: "unread", label: "Unread" },
                { value: "requests", label: "Requests" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setThreadFilter(option.value)}
                  className={[
                    "h-8 rounded-md px-2 text-xs font-medium",
                    threadFilter === option.value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {threadError ? (
            <div className="border-b border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              <div>{threadError}</div>
              <button type="button" onClick={fetchThreads} className="mt-1 font-semibold underline">
                Try again
              </button>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingThreads && threads.length === 0 ? (
              <div className="space-y-3 p-3" aria-label="Loading conversations">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-20 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : threads.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-5 py-8 text-center">
                <SymbolIcon name="forum" className="text-[32px] text-slate-300" />
                <div className="mt-3 text-sm font-semibold text-slate-800">No conversations yet</div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Explore projects and profiles to start a relevant conversation.
                </p>
                <Link
                  to={meProfileType === "contractor" ? "/work" : "/explore"}
                  className="mt-4 text-xs font-semibold text-sky-700 hover:text-sky-900"
                >
                  {meProfileType === "contractor" ? "Find local work" : "Explore projects"}
                </Link>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-5 py-8 text-center">
                <SymbolIcon name="search_off" className="text-[30px] text-slate-300" />
                <div className="mt-2 text-sm font-semibold text-slate-800">No matching conversations</div>
                <button
                  type="button"
                  onClick={() => {
                    setThreadSearch("");
                    setThreadFilter("all");
                  }}
                  className="mt-3 text-xs font-semibold text-sky-700 hover:text-sky-900"
                >
                  Clear search and filters
                </button>
              </div>
            ) : (
              filteredThreads.map((t) => {
                const cp = counterpartFor(t);
                const name = cp?.display_name || cp?.username || "User";
                const bidMeta = getThreadBidMeta(t);

                const latest = t.latest_message || null;
                const latestFromMe = (latest?.sender_username || "").toLowerCase() === meLower;
                const latestPreview =
                  latest?.text || latest?.attachment_name || "No messages yet";
                const unreadCount = Number(t.unread_count || 0);
                const isUnread = !!t.is_unread;

                const isActive = String(t.id) === String(activeThreadId);

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openThread(t.id)}
                    className={[
                      "block w-full border-b border-slate-100 px-3 py-3 text-left",
                      isActive ? "bg-slate-100" : "bg-white hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <ConversationAvatar person={cp} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className={`truncate text-sm ${isUnread ? "font-semibold text-slate-950" : "font-medium text-slate-800"}`}>
                              {name}
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-500">
                              {roleLabel(cp?.profile_type)}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span className="text-[10px] text-slate-400">
                              {formatConversationTime(latest?.created_at || t.updated_at)}
                            </span>
                            {isUnread ? (
                              <span className="flex min-w-[18px] items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-semibold leading-[18px] text-white">
                                {unreadCount > 9 ? "9+" : unreadCount}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {t.project_title ? (
                          <div className="mt-2 flex items-center gap-1 truncate text-[11px] font-medium text-slate-600">
                            <SymbolIcon name="home_repair_service" className="text-[14px] text-slate-400" />
                            <span className="truncate">{t.project_title}</span>
                          </div>
                        ) : null}

                        <div className={`mt-1 truncate text-xs ${isUnread ? "font-medium text-slate-800" : "text-slate-500"}`}>
                          {latestFromMe ? "You: " : ""}{latestPreview}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {t.is_request ? (
                            <Badge className="border-amber-200 bg-amber-50 text-[10px] font-semibold text-amber-800">
                              Request
                            </Badge>
                          ) : null}
                          {bidMeta.hasNewBid ? (
                            <Badge className="border-emerald-200 bg-emerald-50 text-[10px] font-semibold text-emerald-800">
                              New bid
                            </Badge>
                          ) : bidMeta.statusLabel ? (
                            <Badge className="text-[10px] text-slate-600">
                              Bid: {bidMeta.statusLabel}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
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
        <Card className="flex h-[calc(100dvh-100px)] min-h-[420px] flex-col p-4 md:h-[calc(100vh-210px)]">
          {!activeThread ? (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
              Select a conversation from the left.
            </div>
          ) : (
            <>
              <div className="mb-3 space-y-3 border-b border-slate-200 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      type="button"
                      onClick={closeMobileThread}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 md:hidden"
                      aria-label="Back to conversations"
                    >
                      <SymbolIcon name="arrow_back" className="text-[21px]" />
                    </button>

                    <ConversationAvatar person={counterpart} />
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
                      <div className="mt-0.5 text-xs text-slate-500">
                        {roleLabel(counterpart?.profile_type)}
                      </div>
                    </div>
                  </div>

                  {activeThread?.id ? (
                    <ReportContentButton
                      targetType="message_thread"
                      targetId={activeThread.id}
                      subject={counterpart?.username ? `Conversation with ${counterpart.username}` : "Conversation"}
                      label="Report conversation"
                      defaultReportType="harassment"
                      className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    />
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeThread?.project ? (
                    <Link
                      to={`/projects/${activeThread.project}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <SymbolIcon name="home_repair_service" className="text-[17px]" />
                      <span className="max-w-[220px] truncate">
                        {activeThreadBidMeta.bid
                          ? meProfileType === "homeowner"
                            ? "Review bid"
                            : "View bid"
                          : "View project"}
                      </span>
                    </Link>
                  ) : null}

                  {activeThread?.project_title ? (
                    <span className="max-w-full truncate text-xs text-slate-500">
                      {activeThread.project_title}
                    </span>
                  ) : null}

                  {activeThreadBidMeta.hasNewBid ? (
                    <Badge className="border-emerald-200 bg-emerald-50 font-semibold text-emerald-800">
                      New bid
                    </Badge>
                  ) : activeThreadBidMeta.statusLabel ? (
                    <Badge>Bid: {activeThreadBidMeta.statusLabel}</Badge>
                  ) : null}

                  {canUseBidConversion && !activeThreadBidMeta.bid && latestConvertibleMessage ? (
                    <button
                      type="button"
                      onClick={() => handlePrefillBid(latestConvertibleMessage)}
                      disabled={convertingMessageId === latestConvertibleMessage.id}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      <SymbolIcon name="request_quote" className="text-[17px]" />
                      {convertingMessageId === latestConvertibleMessage.id ? "Preparing..." : "Prepare bid"}
                    </button>
                  ) : null}

                  {canUseProjectConversion && latestConvertibleMessage ? (
                    <button
                      type="button"
                      onClick={() => handlePrefillProject(latestConvertibleMessage)}
                      disabled={convertingMessageId === latestConvertibleMessage.id}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      <SymbolIcon name="add_home_work" className="text-[17px]" />
                      {convertingMessageId === latestConvertibleMessage.id ? "Preparing..." : "Create project"}
                    </button>
                  ) : null}
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
                {messageError ? (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <div>{messageError}</div>
                    <button
                      type="button"
                      onClick={() => fetchMessages({ silent: false })}
                      className="mt-1 font-semibold underline"
                    >
                      Try again
                    </button>
                  </div>
                ) : null}
                {loadingMessages ? (
                  <p className="text-xs text-slate-500">Loading messages…</p>
                ) : messages.length === 0 && !messageError ? (
                  <p className="text-xs text-slate-500">No messages yet.</p>
                ) : messages.length > 0 ? (
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

                    const canDelete = canDeletePersistedMessage(m, fromMe);

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

                            {!fromMe ? (
                              <ReportContentButton
                                targetType="private_message"
                                targetId={m.id}
                                subject="Direct message"
                                defaultReportType="harassment"
                                label="Report"
                                className="text-[11px] text-slate-500 hover:text-slate-800"
                              />
                            ) : null}

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

                            {canDelete ? (
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
                ) : null}
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
