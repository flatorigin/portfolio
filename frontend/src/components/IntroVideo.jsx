import { useState } from "react";

export default function IntroVideo() {
  const [message, setMessage] = useState("");
  const [manualLink, setManualLink] = useState("");
  const video = `${import.meta.env.BASE_URL}video/flatorigin-intro.mp4`;
  const poster = `${import.meta.env.BASE_URL}video/flatorigin-intro-poster.jpg`;
  const shareUrl = () => new URL("/watch", window.location.origin).href;
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setManualLink("");
      setMessage("Link copied. Paste it into any message or post.");
    } catch {
      setManualLink(shareUrl());
      setMessage("Select and copy the link below.");
    }
  }
  async function share() {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({ title: "See how FlatOrigin works", text: "A 51-second introduction to FlatOrigin.", url: shareUrl() });
      setMessage("");
    } catch (error) {
      if (error.name !== "AbortError") await copyLink();
    }
  }
  const buttonStyle = "rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50";
  return (
    <section aria-label="FlatOrigin introduction" className="w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <video controls playsInline preload="none" poster={poster} aria-label="FlatOrigin introduction video" className="block aspect-video w-full bg-stone-100 object-contain">
        <source src={video} type="video/mp4" />
        Your browser does not support embedded video. <a href={video}>Watch the video</a>.
      </video>
      <div className="p-5">
        <h2 className="text-lg font-semibold text-stone-900">See how FlatOrigin works</h2>
        <p className="mt-1 text-sm text-stone-600">Watch our 51-second introduction.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={share} className={buttonStyle}>Share</button>
          <button type="button" onClick={copyLink} className={buttonStyle}>Copy link</button>
          <a href={video} download="FlatOrigin-intro.mp4" className={buttonStyle}>Download video</a>
        </div>
        <p className="mt-3 text-xs leading-5 text-stone-500">Share the link in a message, or download the video to attach to a post.</p>
        <p role="status" className="mt-2 text-sm text-stone-600">{message}</p>
        {manualLink && <input aria-label="Video sharing link" readOnly value={manualLink} onFocus={(event) => event.target.select()} className="mt-2 w-full rounded-lg border border-stone-300 p-2 text-sm" />}
      </div>
    </section>
  );
}
