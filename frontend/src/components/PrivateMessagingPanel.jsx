// =======================================
// file: frontend/src/components/PrivateMessagingPanel.jsx
// =======================================
import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api";
import { Button, Card, Textarea } from "../ui";

const docExts = ["pdf", "doc", "docx", "xls", "xlsx"];
const imageExts = ["jpg", "jpeg", "png"];

export default function PrivateMessagingPanel({ projectId, projectOwner }) {
  const authed = !!localStorage.getItem("access");
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);

  const [loading, setLoading] = useState(false);      // only for initial load
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false); // gate spinner use

  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [messageText, setMessageText] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const canSend =
    authed && (messageText.trim().length > 0 || !!attachment);

  const validateAttachment = useCallback((file) => {
    if (!file) return true;
    const ext = (file.name || "").split(".").pop().toLowerCase();
    const size = file.size || 0;

    if (docExts.includes(ext) && size > 5 * 1024 * 1024) {
      setError("Documents must be under 5MB.");
      return false;
    }
    if (imageExts.includes(ext) && size > 3 * 1024 * 1024) {
      setError("Images must be under 3MB.");
      return false;
    }
    if (!docExts.includes(ext) && !imageExts.includes(ext)) {
      setError("Unsupported file type.");
      return false;
    }
    return true;
  }, []);

  const fetchThread = useCallback(async () => {
    if (!authed) return;
    try {
      const { data } = await api.get(`/projects/${projectId}/threads/`);
      setThread(data);
    } catch {
      setThread(null);
    }
  }, [authed, projectId]);

  const ensureThread = useCallback(async () => {
    if (!authed) {
      setError("Login to start a private message.");
      return null;
    }
    try {
      const { data } = await api.post(`/projects/${projectId}/threads/`);
      setThread(data);
      return data;
    } catch {
      setError("Unable to start the private conversation.");
      return null;
    }
  }, [authed, projectId]);

  /**
   * Fetch messages:
   * - First visible load: `silent=false` → shows "Loading messages…" once
   * - Background refreshes: `silent=true` → no spinner, only updates when changed
   */
  const fetchMessages = useCallback(
    async ({ threadOverride = null, silent = false } = {}) => {
      const current = threadOverride || thread;
      if (!current) return;

      const shouldShowSpinner = !silent && !hasLoadedOnce;

      if (shouldShowSpinner) {
        setLoading(true);
      }

      try {
        const { data } = await api.get(
          `/projects/${projectId}/threads/${current.id}/messages/`
        );
        const arr = Array.isArray(data) ? data : [];

        // Only update state if we actually have a new last message
        setMessages((prev) => {
          if (
            prev.length === arr.length &&
            prev[prev.length - 1]?.id === arr[arr.length - 1]?.id
          ) {
            return prev;
          }
          return arr;
        });
      } catch {
        if (shouldShowSpinner) {
          setMessages([]);
        }
      } finally {
        if (shouldShowSpinner) {
          setLoading(false);
          setHasLoadedOnce(true);
        }
      }
    },
    [projectId, thread, hasLoadedOnce]
  );

  // 1) Fetch/create thread on first mount
  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  // 2) Once we have a thread:
  //    - Do ONE visible load of messages
  //    - Then poll silently every 8s and only update if new content exists
  useEffect(() => {
    if (!thread) return undefined;

    // initial, visible load (shows spinner once)
    fetchMessages({ threadOverride: thread, silent: false });

    // silent background polling
    const timer = setInterval(() => {
      fetchMessages({ silent: true });
    }, 8000);

    return () => clearInterval(timer);
  }, [thread, fetchMessages]);

  const handleSend = async (e) => {
    e.preventDefault();
    setError("");

    const activeThread = thread || (await ensureThread());
    if (!activeThread) return;

    if (!messageText.trim() && !attachment) {
      setError("Write a message or add an attachment.");
      return;
    }

    if (attachment && !validateAttachment(attachment)) return;

    const form = new FormData();
    form.append("text", messageText.trim());
    if (attachment) {
      form.append("attachment", attachment);
    }

    setSending(true);
    setUploadProgress(0);
    try {
      const { data: created } = await api.post(
        `/projects/${projectId}/threads/${activeThread.id}/messages/`,
        form,
        {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (evt) => {
            if (!evt.total) return;
            setUploadProgress(Math.round((evt.loaded * 100) / evt.total));
          },
        }
      );

      // Optimistically append the new message so it appears instantly
      setMessages((prev) => [...prev, created]);

      setMessageText("");
      setAttachment(null);
      setUploadProgress(0);

      // Optional extra sync in the background (no spinner)
      fetchMessages({ threadOverride: activeThread, silent: true });
    } catch {
      setError("Failed to send the message.");
    } finally {
      setSending(false);
    }
  };

  const counterpart = useMemo(() => {
    if (!thread) return projectOwner ? { name: projectOwner } : null;
    const participant =
      thread.owner_username === projectOwner
        ? thread.client_profile || { display_name: thread.client_username }
        : thread.owner_profile || { display_name: thread.owner_username };
    return participant;
  }, [projectOwner, thread]);

  return (
    <Card className="min-h-[100px] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            Private messages
          </div>
          <p className="text-xs text-slate-500">
            Only visible to you and the project owner.
          </p>
        </div>
        {counterpart?.display_name && (
          <div className="text-xs text-slate-500">
            Chatting with {counterpart.display_name}
          </div>
        )}
      </div>

      {!authed ? (
        <p className="text-sm text-slate-600">
          Login to start a private conversation.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
            {loading ? (
              <p className="text-xs text-slate-500">Loading messages…</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-slate-500">
                Send a note to open the private channel with the owner.
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className="space-y-1 rounded-lg bg-white p-2 text-xs text-slate-700 shadow-sm"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-800">
                      {m.sender_username}
                    </span>
                    <span>
                      {m.created_at
                        ? new Date(m.created_at).toLocaleString()
                        : ""}
                    </span>
                  </div>
                  {m.text ? (
                    <p className="whitespace-pre-line text-sm">{m.text}</p>
                  ) : null}
                  {m.attachment_url && (
                    <a
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                      href={m.attachment_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      📎 {m.attachment_name || "Attachment"}
                    </a>
                  )}
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSend} className="space-y-2">
            <Textarea
              rows={2}
              value={messageText}
              onChange={(e) => {
                setError("");
                setMessageText(e.target.value);
              }}
              placeholder="Ask for a private project detail…"
              className="min-h-[100px]"
            />
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
              <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1 hover:bg-slate-100">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setError("");
                    if (!file || validateAttachment(file)) {
                      setAttachment(file);
                    }
                  }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                />
                Attach file
              </label>
              {attachment && (
                <span className="text-slate-700">{attachment.name}</span>
              )}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <span className="text-slate-500">
                  Uploading {uploadProgress}%
                </span>
              )}
              {error && <span className="text-red-600">{error}</span>}
            </div>
            <Button
              type="submit"
              disabled={!canSend || sending}
              className="w-full justify-center"
            >
              {sending
                ? "Sending…"
                : thread
                ? "Send private message"
                : "Start private chat"}
            </Button>
          </form>
        </div>
      )}
    </Card>
  );
}
