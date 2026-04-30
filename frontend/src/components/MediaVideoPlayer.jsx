import { useCallback, useEffect, useRef, useState } from "react";
import { SymbolIcon } from "../ui";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function MediaVideoPlayer({ src, poster, className = "", videoClassName = "" }) {
  const videoRef = useRef(null);
  const hideTimerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    if (!videoRef.current || videoRef.current.paused || scrubbing) return;
    hideTimerRef.current = setTimeout(() => {
      setControlsVisible(false);
    }, 1600);
  }, [clearHideTimer, scrubbing]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    return clearHideTimer;
  }, [clearHideTimer]);

  useEffect(() => {
    setControlsVisible(true);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    clearHideTimer();
  }, [src, clearHideTimer]);

  useEffect(() => {
    if (playing && !scrubbing) scheduleHide();
    if (!playing) {
      clearHideTimer();
      setControlsVisible(true);
    }
  }, [playing, scrubbing, scheduleHide, clearHideTimer]);

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    setControlsVisible(true);

    if (video.paused) {
      try {
        await video.play();
      } catch {
        setPlaying(false);
      }
    } else {
      video.pause();
    }
  }

  function seekTo(value) {
    const video = videoRef.current;
    if (!video) return;
    const next = Number(value);
    video.currentTime = Number.isFinite(next) ? next : 0;
    setCurrentTime(video.currentTime);
  }

  const progressMax = duration || 0;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={"group relative h-full w-full bg-black " + className}
      onMouseMove={showControls}
      onMouseEnter={showControls}
      onTouchStart={showControls}
      onFocus={showControls}
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target === videoRef.current) showControls();
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster || undefined}
        playsInline
        className={"block h-full w-full object-contain " + videoClassName}
        onClick={togglePlayback}
        onPlay={() => {
          setPlaying(true);
          scheduleHide();
        }}
        onPause={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onEnded={() => {
          setPlaying(false);
          setControlsVisible(true);
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration || 0);
        }}
        onTimeUpdate={(e) => {
          if (!scrubbing) setCurrentTime(e.currentTarget.currentTime || 0);
        }}
      />

      <button
        type="button"
        aria-label={playing ? "Pause video" : "Play video"}
        onClick={togglePlayback}
        className={
          "absolute left-1/2 top-1/2 inline-flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg transition duration-200 hover:bg-black/70 " +
          (playing && !controlsVisible ? "pointer-events-none opacity-0" : "opacity-100")
        }
      >
        <SymbolIcon name={playing ? "pause" : "play_arrow"} fill={1} className="text-[40px]" />
      </button>

      <div
        className={
          "absolute inset-x-0 bottom-0 px-3 pb-3 pt-8 transition duration-200 " +
          (controlsVisible || !playing || scrubbing
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0")
        }
      >
        <div className="rounded-2xl bg-black/70 px-3 py-2 text-white shadow-lg backdrop-blur">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlayback}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/15"
              aria-label={playing ? "Pause video" : "Play video"}
            >
              <SymbolIcon name={playing ? "pause" : "play_arrow"} fill={1} className="text-[26px]" />
            </button>

            <div className="min-w-[3.25rem] text-right text-xs tabular-nums text-white/90">
              {formatTime(currentTime)}
            </div>

            <div className="relative flex min-w-0 flex-1 items-center">
              <div className="pointer-events-none absolute left-0 right-0 h-1 rounded-full bg-white/25">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max={progressMax}
                step="0.01"
                value={Math.min(currentTime, progressMax)}
                onPointerDown={() => {
                  setScrubbing(true);
                  setControlsVisible(true);
                  clearHideTimer();
                }}
                onPointerUp={() => {
                  setScrubbing(false);
                  scheduleHide();
                }}
                onTouchEnd={() => {
                  setScrubbing(false);
                  scheduleHide();
                }}
                onMouseUp={() => {
                  setScrubbing(false);
                  scheduleHide();
                }}
                onChange={(e) => seekTo(e.target.value)}
                className="relative z-10 h-8 w-full cursor-pointer appearance-none bg-transparent accent-white"
                aria-label="Video progress"
              />
            </div>

            <div className="min-w-[3.25rem] text-xs tabular-nums text-white/75">
              {formatTime(duration)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
