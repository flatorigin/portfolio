import { useEffect, useRef, useState } from "react";
import { SymbolIcon } from "../ui";

export default function EstimateCardDialogs({ deleting, sharing, busy, error, onCancel, onDelete }) {
  const dialog = useRef(null);
  const cancel = useRef(null);
  const [feedback, setFeedback] = useState("");
  const open = Boolean(deleting || sharing);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current.showModal();
    cancel.current?.focus();
    setFeedback("");
    return () => { dialog.current?.close(); document.body.style.overflow = overflow; previous?.focus?.(); };
  }, [open]);
  if (!open) return null;
  const actionClass = "flex h-12 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400";
  return <dialog ref={dialog} aria-labelledby="estimate-dialog-title" aria-describedby="estimate-dialog-description" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border-0 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm" onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}>
    <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4"><div className="min-w-0"><h2 id="estimate-dialog-title" className="text-lg font-semibold">{deleting ? "Delete estimate?" : "Share estimate"}</h2><p className="mt-1 break-words text-sm text-slate-500">{deleting?.project_name || sharing?.name}</p></div>{!deleting && <button ref={cancel} type="button" aria-label="Close share options" onClick={onCancel} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><SymbolIcon name="close" /></button>}</header>
    <div className="p-5">
      <p id="estimate-dialog-description" className="mb-4 text-sm leading-6 text-slate-600">{deleting ? "This permanently deletes the saved estimate and disables its shared links. This cannot be undone." : "Send your client a read-only copy. Anyone with the link can view it. Share again after saving changes to update the shared version."}</p>
      {deleting ? <><div role="alert" className="mb-3 text-sm text-red-700">{error}</div><div className="flex justify-end gap-2"><button ref={cancel} autoFocus type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500">Cancel</button><button type="button" disabled={busy} onClick={onDelete} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{busy ? "Deleting…" : "Delete estimate"}</button></div></> : <>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={actionClass} onClick={async () => { try { await navigator.clipboard.writeText(sharing.url); setFeedback("Link copied."); } catch { setFeedback("Select and copy the link below."); } }}><SymbolIcon name="content_copy" />Copy link</button>
          <a className={actionClass} href={`sms:?body=${encodeURIComponent(`${sharing.name}: ${sharing.url}`)}`}><SymbolIcon name="sms" />Text</a>
          <a className={actionClass} href={`mailto:?subject=${encodeURIComponent(sharing.name)}&body=${encodeURIComponent(sharing.url)}`}><SymbolIcon name="mail" />Email</a>
          <a className={actionClass} href={sharing.url} target="_blank" rel="noreferrer"><SymbolIcon name="open_in_new" />Preview</a>
        </div>
        <input aria-label="Client estimate link" readOnly value={sharing.url} onFocus={event => event.target.select()} className="mt-4 w-full rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500" />
        <p role="status" className="mt-2 min-h-5 text-xs text-slate-500">{feedback}</p>
      </>}
    </div>
  </dialog>;
}
