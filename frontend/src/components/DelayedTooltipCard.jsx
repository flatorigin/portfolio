import { useRef, useState } from "react";

export default function DelayedTooltipCard({ children, tooltip }) {
  const [showTip, setShowTip] = useState(false);
  const timerRef = useRef(null);

  const start = () => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowTip(true), 1000); // 1s delay
  };

  const stop = () => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    setShowTip(false);
  };

  return (
    <div
      className="relative"
      onMouseEnter={start}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      onTouchCancel={stop}
    >
      {children}

      {showTip && (
        <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-[280px] rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
          {tooltip}
        </div>
      )}
    </div>
  );
}