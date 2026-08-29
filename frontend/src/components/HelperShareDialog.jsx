import { useEffect, useMemo, useState } from "react";
import { SymbolIcon } from "../ui";
import { buildHelperShareData } from "../utils/helperShare";

function ShareAction({ href, icon, label, onClick, external = false }) {
  const className = "flex h-12 min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-900/15";
  if (href) {
    return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className={className}>
      <SymbolIcon name={icon} className="shrink-0 text-[20px] text-slate-500" />
      <span className="truncate">{label}</span>
    </a>;
  }
  return <button type="button" className={className} onClick={onClick}>
    <SymbolIcon name={icon} className="shrink-0 text-[20px] text-slate-500" />
    <span className="truncate">{label}</span>
  </button>;
}

export default function HelperShareDialog({ helper, onClose }) {
  const [feedback, setFeedback] = useState("");
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const share = useMemo(() => buildHelperShareData(helper, origin), [helper, origin]);
  const nativeShareAvailable = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => event.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(share.url);
      else {
        const textarea = document.createElement("textarea");
        textarea.value = share.url;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setFeedback("Link copied.");
    } catch {
      setFeedback("Could not copy the link.");
    }
  }

  async function openNativeShare() {
    try {
      await navigator.share(share.nativePayload);
      setFeedback("Shared.");
    } catch (error) {
      if (error?.name !== "AbortError") setFeedback("Could not open sharing options.");
    }
  }

  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="helper-share-title" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
    <div className="w-full max-w-md rounded-lg bg-white shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div className="min-w-0">
          <h2 id="helper-share-title" className="text-lg font-semibold text-slate-950">Share helper</h2>
          <p className="mt-1 truncate text-sm text-slate-500">{helper.full_name}</p>
        </div>
        <button type="button" onClick={onClose} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Close share options">
          <SymbolIcon name="close" className="text-[20px]" />
        </button>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 gap-2">
          <ShareAction icon="content_copy" label="Copy link" onClick={copyLink} />
          <ShareAction href={share.smsUrl} icon="sms" label="Text" />
          <ShareAction href={share.emailUrl} icon="mail" label="Email" />
          <ShareAction href={share.facebookUrl} icon="public" label="Facebook" external />
          <ShareAction href={share.nextdoorUrl} icon="diversity_3" label="Nextdoor" external />
          {nativeShareAvailable ? <ShareAction icon="ios_share" label="More" onClick={openNativeShare} /> : null}
        </div>
        <div className="mt-4 flex min-w-0 items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <SymbolIcon name="link" className="shrink-0 text-[18px] text-slate-400" />
          <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{share.url}</span>
        </div>
        <div className="mt-2 min-h-5 text-xs text-slate-500" aria-live="polite">{feedback}</div>
      </div>
    </div>
  </div>;
}
