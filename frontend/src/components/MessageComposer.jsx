import { useMemo, useRef, useState } from "react";
import { Button, Textarea, Input } from "../ui";

function AttachmentChip({ item, onRemove }) {
  const label =
    item?.kind === "link"
      ? item.url
      : item?.file?.name || item?.label || "Attachment";

  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="text-slate-400 hover:text-slate-700"
        aria-label="Remove attachment"
      >
        ×
      </button>
    </div>
  );
}

function ReplyPreview({ replyTo, onCancel }) {
  if (!replyTo) return null;

  const author = replyTo.sender_username || "User";
  const preview = (replyTo.text || "").trim() || "Attachment";

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">
            Replying to {author}
          </div>
          <div className="mt-1 truncate text-sm text-slate-700">{preview}</div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 text-slate-400 hover:text-slate-700"
          aria-label="Cancel reply"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function MessageComposer({
  value,
  onChange,
  onSend,
  sending = false,
  disabled = false,
  replyTo = null,
  onCancelReply,
  attachments = [],
  onAttachmentsChange,
  placeholder = "Type a message…",
  allowCamera = true,
  allowImages = true,
  allowDocs = true,
  allowLinks = true,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  const cameraInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const docInputRef = useRef(null);

  const canSend = useMemo(() => {
    const hasText = !!String(value || "").trim();
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    return !disabled && !sending && (hasText || hasAttachments);
  }, [value, attachments, disabled, sending]);

  function addFiles(kind, files) {
    const list = Array.from(files || []);
    if (!list.length) return;

    const next = [
      ...(Array.isArray(attachments) ? attachments : []),
      ...list.map((file) => ({ kind, file })),
    ];
    onAttachmentsChange?.(next);
    setMenuOpen(false);
  }

  function addLink() {
    const url = String(linkValue || "").trim();
    if (!url) return;

    const next = [
      ...(Array.isArray(attachments) ? attachments : []),
      { kind: "link", url },
    ];

    onAttachmentsChange?.(next);
    setLinkValue("");
    setLinkOpen(false);
    setMenuOpen(false);
  }

  function removeAttachment(index) {
    const next = [...(attachments || [])];
    next.splice(index, 1);
    onAttachmentsChange?.(next);
  }

  return (
    <form onSubmit={onSend} className="space-y-3">
      {!disabled ? null : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
          You can’t reply yet. Accept the request first, or the thread is currently restricted.
        </div>
      )}

      <ReplyPreview replyTo={replyTo} onCancel={onCancelReply} />

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                setMenuOpen((v) => !v);
                setLinkOpen(false);
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-lg text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Add attachment"
              title="Add attachment"
            >
              +
            </button>

            {menuOpen && !disabled && (
              <div className="absolute bottom-11 left-0 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                <div className="space-y-1">
                  {allowCamera && (
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Take photo
                    </button>
                  )}

                  {allowImages && (
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Image
                    </button>
                  )}

                  {allowDocs && (
                    <button
                      type="button"
                      onClick={() => docInputRef.current?.click()}
                      className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Document
                    </button>
                  )}

                  {allowLinks && (
                    <button
                      type="button"
                      onClick={() => setLinkOpen((v) => !v)}
                      className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Link
                    </button>
                  )}
                </div>

                {linkOpen && (
                  <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <Input
                      value={linkValue}
                      onChange={(e) => setLinkValue(e.target.value)}
                      placeholder="Paste a website or video link"
                    />
                    <div className="mt-2 flex justify-end">
                      <Button type="button" onClick={addLink} disabled={!linkValue.trim()}>
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                addFiles("camera", e.target.files);
                e.target.value = "";
              }}
            />

            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles("image", e.target.files);
                e.target.value = "";
              }}
            />

            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.rtf,.zip,.csv"
              multiple
              className="hidden"
              onChange={(e) => {
                addFiles("document", e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <div className="text-xs text-slate-500">
            Plain text message with attachments and reply support
          </div>
        </div>

        <div className="p-3">
          <Textarea
            rows={3}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            className="min-h-[96px] border-0 p-0 shadow-none focus-visible:ring-0"
            disabled={disabled}
          />
        </div>

        {Array.isArray(attachments) && attachments.length > 0 && (
          <div className="border-t border-slate-100 px-3 py-3">
            <div className="flex flex-wrap gap-2">
              {attachments.map((item, index) => (
                <AttachmentChip
                  key={`${item.kind}-${item.url || item.file?.name || index}-${index}`}
                  item={item}
                  onRemove={() => removeAttachment(index)}
                />
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-3 py-3">
          <Button type="submit" disabled={!canSend}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </form>
  );
}