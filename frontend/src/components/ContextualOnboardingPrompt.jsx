import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SymbolIcon } from "../ui";

const TOPICS = {
  services: {
    title: "Set your services and service area",
    description:
      "Add the work you specialize in and the locations you serve so homeowners can find the right fit.",
    target: "services",
  },
  "start-plan": {
    title: "Start with a private project plan",
    description:
      "Create a private workspace first. You can organize the details before sharing anything with contractors.",
    target: "project-planner",
  },
  "project-details": {
    title: "Describe the work clearly",
    description:
      "Add a project name, work area, type, and short summary. These essentials make the rest of the packet easier to build.",
    target: "project-details",
  },
  "project-visuals": {
    title: "Add useful visual information",
    description:
      "Upload photos, create a floor plan, or mark up an image when it helps explain the work.",
    target: "project-visuals",
  },
  "share-project": {
    title: "Review before sharing",
    description:
      "When the essentials are ready, review the packet and choose whether to publish it or invite a contractor.",
    target: "share-project",
    fallbackTarget: "project-details",
  },
  "review-work": {
    title: "Review a homeowner opportunity",
    description:
      "Use the search and filters to find relevant work, then open a posting to review its scope and requirements.",
    target: "find-work",
  },
  "make-connection": {
    title: "Make your first connection",
    description:
      "Open a suitable posting to submit a bid or begin a conversation with the homeowner.",
    target: "find-work",
  },
};

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export default function ContextualOnboardingPrompt() {
  const location = useLocation();
  const navigate = useNavigate();
  const [targetElement, setTargetElement] = useState(null);
  const [targetResolved, setTargetResolved] = useState(false);
  const [position, setPosition] = useState(null);

  const topicKey = useMemo(
    () => new URLSearchParams(location.search).get("onboarding") || "",
    [location.search],
  );
  const topic = TOPICS[topicKey] || null;

  useEffect(() => {
    setTargetElement(null);
    setTargetResolved(false);
    setPosition(null);
    if (!topic?.target) return undefined;

    let attempts = 0;
    const findTarget = () => {
      const element =
        document.querySelector(`[data-onboarding-target="${topic.target}"]`) ||
        (topic.fallbackTarget
          ? document.querySelector(
              `[data-onboarding-target="${topic.fallbackTarget}"]`,
            )
          : null);
      if (element) {
        setTargetElement(element);
        setTargetResolved(true);
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      attempts += 1;
      if (attempts >= 30) {
        setTargetResolved(true);
        return true;
      }
      return false;
    };

    if (findTarget()) return undefined;
    const timer = window.setInterval(() => {
      if (findTarget()) window.clearInterval(timer);
    }, 100);

    return () => window.clearInterval(timer);
  }, [topic?.target, topic?.fallbackTarget, location.pathname]);

  useEffect(() => {
    if (!targetElement) return undefined;

    const previousOutline = targetElement.style.outline;
    const previousOutlineOffset = targetElement.style.outlineOffset;
    targetElement.style.outline = "3px solid rgb(59 130 246 / 0.4)";
    targetElement.style.outlineOffset = "6px";

    const updatePosition = () => {
      if (window.innerWidth < 768) {
        setPosition(null);
        return;
      }

      const rect = targetElement.getBoundingClientRect();
      const cardWidth = 340;
      const cardHeight = 230;
      const gap = 16;
      const margin = 16;
      let left = rect.right + gap;

      if (left + cardWidth > window.innerWidth - margin) {
        left = rect.left - cardWidth - gap;
      }

      setPosition({
        left: clamp(left, margin, window.innerWidth - cardWidth - margin),
        top: clamp(rect.top, 76, window.innerHeight - cardHeight - margin),
        width: cardWidth,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      targetElement.style.outline = previousOutline;
      targetElement.style.outlineOffset = previousOutlineOffset;
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [targetElement]);

  if (!topic || !targetResolved) return null;

  const dismiss = () => {
    const params = new URLSearchParams(location.search);
    params.delete("onboarding");
    navigate(
      {
        pathname: location.pathname,
        search: params.toString() ? `?${params.toString()}` : "",
      },
      { replace: true },
    );
  };

  return (
    <aside
      className={
        position
          ? "fixed z-50 rounded-xl border border-blue-200 bg-white p-4 shadow-2xl"
          : "fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 rounded-xl border border-blue-200 bg-white p-4 shadow-2xl md:bottom-5 md:left-auto md:right-5 md:w-[340px]"
      }
      style={position || undefined}
      aria-label={topic.title}
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <SymbolIcon name="tips_and_updates" className="text-[22px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase text-blue-700">
            Setup guide
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-950">
            {topic.title}
          </h2>
          <p className="mt-2 text-sm leading-5 text-slate-600">
            {topic.description}
          </p>
        </div>
      </div>
      <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Got it
        </button>
      </div>
    </aside>
  );
}
