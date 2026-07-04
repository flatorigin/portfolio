import { useEffect, useMemo, useState } from "react";
import api from "../api";
import { Button, SymbolIcon } from "../ui";
import FeedbackSupportModal from "../components/FeedbackSupportModal";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf", "doc", "docx", "txt"]);

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return "";
  }
}

function statusClass(status) {
  if (status === "resolved") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "needs_more_supporting_documents") return "bg-amber-50 text-amber-700 ring-amber-200";
  if (status === "work_in_progress") return "bg-sky-50 text-sky-700 ring-sky-200";
  if (status === "removed") return "bg-slate-100 text-slate-500 ring-slate-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

function validateFiles(files) {
  if (files.length > MAX_FILES) return `Upload up to ${MAX_FILES} files.`;
  for (const file of files) {
    const ext = String(file.name || "").toLowerCase().split(".").pop();
    if (!ALLOWED_EXTENSIONS.has(ext)) return `${file.name} is not an allowed file type.`;
    if (file.size > MAX_FILE_SIZE) return `${file.name} is larger than 20MB.`;
  }
  return "";
}

function AttachmentList({ attachments = [] }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {attachments.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          <SymbolIcon name="attach_file" className="shrink-0 text-[15px]" />
          <span className="truncate">{attachment.original_name || "Attachment"}</span>
        </a>
      ))}
    </div>
  );
}

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState([]);
  const [replyError, setReplyError] = useState("");
  const [replySuccess, setReplySuccess] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => String(ticket.id) === String(selectedId)) || tickets[0] || null,
    [tickets, selectedId],
  );

  async function loadTickets({ preserveSelection = true } = {}) {
    setError("");
    setLoading(true);
    try {
      const { data } = await api.get("/feedback/");
      const list = Array.isArray(data) ? data : [];
      setTickets(list);
      if (!preserveSelection || !selectedId || !list.some((ticket) => String(ticket.id) === String(selectedId))) {
        setSelectedId(list[0]?.id || null);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not load support tickets.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTickets({ preserveSelection: false });
  }, []);

  const handleReplyFiles = (event) => {
    const files = Array.from(event.target.files || []);
    const fileError = validateFiles(files);
    setReplyError(fileError);
    setReplyFiles(fileError ? [] : files);
    if (fileError) event.target.value = "";
  };

  async function submitReply(event) {
    event.preventDefault();
    if (!selectedTicket || submittingReply) return;
    const message = replyText.trim();
    if (!message) {
      setReplyError("Reply message is required.");
      return;
    }
    const fileError = validateFiles(replyFiles);
    if (fileError) {
      setReplyError(fileError);
      return;
    }

    const payload = new FormData();
    payload.append("message", message);
    replyFiles.forEach((file) => payload.append("attachments", file));

    setSubmittingReply(true);
    setReplyError("");
    setReplySuccess("");
    try {
      await api.post(`/feedback/${selectedTicket.id}/replies/`, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setReplyText("");
      setReplyFiles([]);
      setReplySuccess("Reply added.");
      await loadTickets();
    } catch (err) {
      const data = err?.response?.data;
      setReplyError(data?.detail || data?.message?.[0] || data?.attachments?.[0] || "Could not add reply.");
    } finally {
      setSubmittingReply(false);
    }
  }

  return (
    <div className="py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Feedback &amp; Support</h1>
          <p className="mt-2 text-sm text-slate-500">
            Review your support requests and add follow-up details when needed.
          </p>
        </div>
        <Button type="button" onClick={() => setNewTicketOpen(true)} className="h-10">
          New request
        </Button>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading support tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <div className="text-sm font-semibold text-slate-900">No support tickets yet</div>
          <p className="mt-2 text-sm text-slate-500">Create a request when you need help or want to share feedback.</p>
          <Button type="button" onClick={() => setNewTicketOpen(true)} className="mt-4">
            Create request
          </Button>
        </div>
      ) : (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Your tickets
            </div>
            <div className="divide-y divide-slate-100">
              {tickets.map((ticket) => {
                const active = String(ticket.id) === String(selectedTicket?.id);
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(ticket.id);
                      setReplyError("");
                      setReplySuccess("");
                    }}
                    className={[
                      "block w-full px-4 py-3 text-left transition",
                      active ? "bg-slate-50" : "hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{ticket.subject}</div>
                        <div className="mt-1 text-xs text-slate-500">{ticket.category_label || ticket.category}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusClass(ticket.status)}`}>
                        {ticket.status_label || ticket.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{formatDate(ticket.updated_at || ticket.created_at)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedTicket ? (
            <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {selectedTicket.category_label || selectedTicket.category}
                  </div>
                  <h2 className="mt-1 truncate text-xl font-semibold text-slate-950">{selectedTicket.subject}</h2>
                  <div className="mt-1 text-xs text-slate-500">{formatDate(selectedTicket.created_at)}</div>
                </div>
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusClass(selectedTicket.status)}`}>
                  {selectedTicket.status_label || selectedTicket.status}
                </span>
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Original message</div>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{selectedTicket.message}</p>
                <AttachmentList attachments={selectedTicket.attachments || []} />
              </div>

              <div className="mt-5 space-y-3">
                <div className="text-sm font-semibold text-slate-900">Conversation</div>
                {(selectedTicket.replies || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    No replies yet.
                  </div>
                ) : (
                  (selectedTicket.replies || []).map((reply) => (
                    <div key={reply.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-slate-900">{reply.author_name}</div>
                        <div className="text-xs text-slate-400">{formatDate(reply.created_at)}</div>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-700">{reply.message}</p>
                      <AttachmentList attachments={reply.attachments || []} />
                    </div>
                  ))
                )}
              </div>

              {selectedTicket.status === "removed" ? null : (
                <form onSubmit={submitReply} className="mt-5 border-t border-slate-100 pt-4">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-medium text-slate-700">Add follow-up</span>
                    <textarea
                      value={replyText}
                      onChange={(event) => {
                        setReplyText(event.target.value);
                        setReplyError("");
                      }}
                      rows={4}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </label>

                  <div className="mt-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      <SymbolIcon name="attach_file" className="text-[18px]" />
                      Add files
                      <input
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.txt"
                        onChange={handleReplyFiles}
                        className="hidden"
                      />
                    </label>
                    {replyFiles.length ? (
                      <div className="mt-2 space-y-1 text-xs text-slate-500">
                        {replyFiles.map((file) => (
                          <div key={`${file.name}-${file.size}`} className="truncate">{file.name}</div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {replyError ? <div className="mt-2 text-sm text-rose-600">{replyError}</div> : null}
                  {replySuccess ? <div className="mt-2 text-sm text-emerald-700">{replySuccess}</div> : null}

                  <div className="mt-4 flex justify-end">
                    <Button type="submit" disabled={submittingReply}>
                      {submittingReply ? "Sending..." : "Send reply"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : null}
        </div>
      )}

      <FeedbackSupportModal
        open={newTicketOpen}
        onClose={() => {
          setNewTicketOpen(false);
          loadTickets();
        }}
      />
    </div>
  );
}
