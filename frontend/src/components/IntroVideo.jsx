import { useEffect, useRef, useState } from "react";
import { SymbolIcon } from "../ui";

function viewerId() {
  try {
    const saved = localStorage.getItem("intro-video-viewer");
    if (saved) return saved;
    const id = crypto.randomUUID();
    localStorage.setItem("intro-video-viewer", id);
    return id;
  } catch { return crypto.randomUUID(); }
}

export default function IntroVideo({ source = "homepage" }) {
  const dialog = useRef(null);
  const player = useRef(null);
  const trigger = useRef(null);
  const shareButton = useRef(null);
  const snapshot = useRef(null);
  const last = useRef(null);
  const lastSent = useRef(0);
  const finished = useRef(false);
  const savedOverflow = useRef("");
  const savedPadding = useRef("");
  const [menu, setMenu] = useState(false);
  const [message, setMessage] = useState("");
  const [manualLink, setManualLink] = useState("");
  const video = `${import.meta.env.BASE_URL}video/flatorigin-intro.mp4`;
  const poster = `${import.meta.env.BASE_URL}video/flatorigin-intro-poster.jpg`;
  const shareUrl = () => new URL("/watch", window.location.origin).href;

  function flush() {
    if (!snapshot.current) return;
    const endpoint = `${import.meta.env.VITE_API_BASE || "/api"}/video-analytics/`;
    fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(snapshot.current), keepalive: true }).catch(() => {});
    lastSent.current = snapshot.current.watch_seconds;
  }
  function sample() {
    const el = player.current;
    if (!el || !snapshot.current) return;
    const now = performance.now();
    if (last.current && !el.seeking && document.visibilityState === "visible") {
      const elapsed = (now - last.current.time) / 1000;
      const delta = el.currentTime - last.current.position;
      if (delta > 0 && delta <= elapsed * Math.max(el.playbackRate, 1) + 0.5) {
        snapshot.current.watch_seconds += Math.min(delta, elapsed);
      }
    }
    last.current = !el.paused && !el.seeking ? { time: now, position: el.currentTime } : null;
    const seconds = snapshot.current.watch_seconds;
    if ((seconds >= 3 && lastSent.current < 3) || seconds - lastSent.current >= 5) flush();
  }
  function close() {
    sample();
    player.current?.pause();
    flush();
    snapshot.current = null;
    dialog.current?.close();
    document.body.style.overflow = savedOverflow.current;
    document.body.style.paddingRight = savedPadding.current;
    setMenu(false);
    trigger.current?.focus();
  }
  useEffect(() => {
    const leaving = () => { sample(); flush(); last.current = null; };
    window.addEventListener("pagehide", leaving);
    document.addEventListener("visibilitychange", leaving);
    return () => {
      window.removeEventListener("pagehide", leaving);
      document.removeEventListener("visibilitychange", leaving);
      player.current?.pause();
      flush();
      if (dialog.current?.open) {
        document.body.style.overflow = savedOverflow.current;
        document.body.style.paddingRight = savedPadding.current;
      }
    };
  }, []);
  function open() {
    snapshot.current = { session_id: crypto.randomUUID(), viewer_id: viewerId(), source, watch_seconds: 0, completed: false, replays: 0, share_actions: 0, copy_actions: 0, email_actions: 0 };
    last.current = null;
    lastSent.current = 0;
    finished.current = false;
    setMessage("");
    setManualLink("");
    setMenu(false);
    savedOverflow.current = document.body.style.overflow;
    savedPadding.current = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
    document.body.style.overflow = "hidden";
    dialog.current.showModal();
    player.current.currentTime = 0;
  }
  function action(name) { if (snapshot.current) { snapshot.current[name]++; flush(); } }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      action("copy_actions");
      setMessage("Link copied. Paste it into your message.");
    } catch { setManualLink(shareUrl()); setMessage("Select and copy this link."); }
    setMenu(false);
    shareButton.current?.focus();
  }
  async function share() {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({ title: "See how FlatOrigin works", url: shareUrl() });
      action("share_actions");
      setMenu(false);
      shareButton.current?.focus();
    } catch (error) { if (error.name !== "AbortError") await copyLink(); }
  }
  return (
    <>
      <button ref={trigger} type="button" onClick={open} aria-haspopup="dialog" className="inline-flex items-center gap-3 rounded-full border-2 border-slate-900 bg-white px-3 py-2 text-base font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white"><SymbolIcon name="play_arrow" className="text-[26px]" /></span>
        <span className="pr-2">See how FlatOrigin works</span>
      </button>
      <dialog ref={dialog} aria-label="FlatOrigin introduction video" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }} className="fixed inset-0 m-auto max-h-[100dvh] w-full max-w-5xl overflow-y-auto border-0 bg-transparent p-3 text-white backdrop:bg-slate-950/65 sm:p-6">
        <div className="mb-3 flex justify-end"><button autoFocus type="button" onClick={close} aria-label="Close video" className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900"><SymbolIcon name="close" /></button></div>
        <div className="relative overflow-hidden rounded-xl bg-black shadow-2xl">
          <video ref={player} controls playsInline preload="none" poster={poster} aria-label="FlatOrigin introduction" className="block max-h-[75dvh] w-full object-contain" onTimeUpdate={sample} onSeeking={() => { last.current = null; }} onSeeked={() => { last.current = null; }} onPause={() => { sample(); flush(); }} onPlay={() => {
            if (finished.current) { snapshot.current.replays++; finished.current = false; flush(); }
            last.current = { time: performance.now(), position: player.current.currentTime };
          }} onEnded={() => { sample(); finished.current = true; if (snapshot.current.watch_seconds >= player.current.duration * 0.9) snapshot.current.completed = true; flush(); }}>
            <source src={video} type="video/mp4" />
            <a href={video}>Download the video</a>
          </video>
          <div className="absolute right-2 top-2 max-w-[calc(100%-1rem)] text-slate-900">
            <button ref={shareButton} type="button" aria-label="Video sharing options" aria-expanded={menu} onClick={() => setMenu(!menu)} className="ml-auto flex items-center gap-1 rounded-lg bg-white/95 px-3 py-2 shadow"><SymbolIcon name="share" className="text-[20px]" /><SymbolIcon name="expand_more" className="text-[18px]" /></button>
            {menu && <div className="mt-1 w-44 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              <button type="button" onClick={share} className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-slate-50"><SymbolIcon name="ios_share" />Share</button>
              <button type="button" onClick={copyLink} className="flex w-full items-center gap-3 border-t px-4 py-3 text-sm hover:bg-slate-50"><SymbolIcon name="link" />Copy link</button>
            </div>}
          </div>
        </div>
        <p role="status" className="mt-2 text-sm">{message}</p>
        {manualLink && <input aria-label="Video sharing link" readOnly value={manualLink} onFocus={(event) => event.target.select()} className="w-full rounded-lg p-2 text-slate-900" />}
      </dialog>
    </>
  );
}
