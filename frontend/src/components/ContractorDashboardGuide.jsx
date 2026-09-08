import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SymbolIcon } from "../ui";

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isHomeownerConnection(thread, username) {
  const me = String(username || "").trim().toLowerCase();
  if (!me || !thread?.latest_message?.id) return false;

  const isOwner = String(thread.owner_username || "").trim().toLowerCase() === me;
  const isClient = String(thread.client_username || "").trim().toLowerCase() === me;
  if (!isOwner && !isClient) return false;

  const otherProfile = isOwner ? thread.client_profile : thread.owner_profile;
  const currentUserAccepted = isOwner
    ? thread.owner_has_accepted
    : thread.client_has_accepted;
  const currentUserSentLatest =
    String(thread.latest_message.sender_username || "").trim().toLowerCase() === me;

  return (
    otherProfile?.profile_type === "homeowner" &&
    (currentUserAccepted || currentUserSentLatest)
  );
}

export default function ContractorDashboardGuide({
  profile,
  projects = [],
  bids = [],
  inboxThreads = [],
  onCreateProject,
}) {
  const storageKey = profile?.username
    ? `contractor-dashboard-guide-seen:${profile.username}`
    : "";
  const [open, setOpen] = useState(() => {
    if (!profile?.username) return false;
    return localStorage.getItem(
      `contractor-dashboard-guide-seen:${profile.username}`
    ) !== "1";
  });
  const [activeStep, setActiveStep] = useState(0);

  const steps = useMemo(() => {
    const categories = Array.isArray(profile?.contractor_categories)
      ? profile.contractor_categories
      : [];
    const hasProfileImage = Boolean(
      profile?.avatar_url || profile?.avatar || profile?.logo
    );
    const hasContactDetails = Boolean(
      (hasText(profile?.contact_email) || hasText(profile?.email)) &&
        hasText(profile?.contact_phone)
    );
    const hasConnection =
      bids.length > 0 ||
      inboxThreads.some((thread) =>
        isHomeownerConnection(thread, profile?.username)
      );

    return [
      {
        title: "Complete your business profile",
        description:
          "Add your business name, profile image or logo, contact details, and description.",
        complete:
          hasText(profile?.display_name) &&
          hasProfileImage &&
          hasContactDetails &&
          hasText(profile?.bio),
        actionLabel: "Open profile",
        to: "/profile/edit",
        icon: "business_center",
      },
      {
        title: "Set services and service area",
        description:
          "Choose your trade categories and the locations your business serves.",
        complete:
          hasText(profile?.service_location) &&
          hasText(profile?.contractor_primary_category) &&
          categories.length > 0,
        actionLabel: "Set services",
        to: "/profile/edit",
        icon: "distance",
      },
      {
        title: "Add your first portfolio project",
        description:
          "Upload a completed project with images and a description. This replaces the sample dashboard.",
        complete: projects.length > 0,
        actionLabel: "Add project",
        onAction: onCreateProject,
        icon: "photo_library",
      },
      {
        title: "Review a homeowner opportunity",
        description:
          "Open a relevant job posting and review its scope, location, and requirements.",
        complete: Boolean(profile?.contractor_job_reviewed_at),
        actionLabel: "Find work",
        to: "/work",
        icon: "assignment",
      },
      {
        title: "Make your first connection",
        description:
          "Submit a bid or message a homeowner about a project.",
        complete: hasConnection,
        actionLabel: "View opportunities",
        to: "/work",
        icon: "handshake",
      },
    ];
  }, [profile, projects.length, bids.length, inboxThreads, onCreateProject]);

  const completedCount = steps.filter((step) => step.complete).length;
  const allComplete = completedCount === steps.length;

  useEffect(() => {
    if (!storageKey || !allComplete) return;
    localStorage.setItem(storageKey, "1");
    setOpen(false);
  }, [allComplete, storageKey]);

  useEffect(() => {
    if (!profile?.username || allComplete) return;
    const nextIncomplete = steps.findIndex((step) => !step.complete);
    setActiveStep(nextIncomplete >= 0 ? nextIncomplete : 0);
  }, [profile?.username, allComplete]);

  if (profile?.profile_type !== "contractor" || allComplete) return null;

  const step = steps[activeStep];

  const minimize = () => {
    if (storageKey) localStorage.setItem(storageKey, "1");
    setOpen(false);
  };

  const reopen = () => {
    const nextIncomplete = steps.findIndex((item) => !item.complete);
    setActiveStep(nextIncomplete >= 0 ? nextIncomplete : 0);
    setOpen(true);
  };

  const handleAction = () => {
    minimize();
    step.onAction?.();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={reopen}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-slate-950 px-4 text-white shadow-xl transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:bottom-5 sm:right-5"
        aria-label="Open contractor setup guide"
        title="Open contractor setup guide"
      >
        <SymbolIcon name="checklist" className="text-[24px]" weight={500} />
        <span className="text-sm font-semibold">{completedCount}/5</span>
      </button>
    );
  }

  return (
    <aside
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-4 right-4 z-40 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:bottom-5 sm:left-auto sm:right-5 sm:w-[360px]"
      aria-label="Build your contractor presence"
      aria-live="polite"
    >
      <div className="border-b border-slate-100 bg-slate-950 px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold">Build your contractor presence</div>
            <div className="mt-1 text-xs text-slate-300">
              {completedCount} of 5 completed
            </div>
          </div>
          <button
            type="button"
            onClick={minimize}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70"
            aria-label="Minimize contractor setup guide"
            title="Minimize"
          >
            <SymbolIcon name="remove" className="text-[22px]" weight={500} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2" aria-label="Checklist progress">
          {steps.map((item, index) => (
            <button
              key={item.title}
              type="button"
              onClick={() => setActiveStep(index)}
              className={`flex h-8 items-center justify-center rounded-md border text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                index === activeStep
                  ? "border-white bg-white text-slate-950"
                  : item.complete
                  ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200"
                  : "border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-400"
              }`}
              aria-label={`${item.title}${item.complete ? ", complete" : ""}`}
            >
              {item.complete ? (
                <SymbolIcon name="check" className="text-[17px]" weight={700} />
              ) : (
                index + 1
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <div className="flex gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
              step.complete
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            <SymbolIcon
              name={step.complete ? "check_circle" : step.icon}
              className="text-[24px]"
              fill={step.complete ? 1 : 0}
              weight={500}
            />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase text-slate-400">
              Step {activeStep + 1} of 5
            </div>
            <h2 className="mt-1 text-base font-semibold text-slate-950">
              {step.title}
            </h2>
            <p className="mt-2 text-sm leading-5 text-slate-600">
              {step.description}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
          {step.to ? (
            <Link
              to={step.to}
              onClick={minimize}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {step.actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleAction}
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {step.actionLabel}
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveStep((current) => Math.max(0, current - 1))}
              disabled={activeStep === 0}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Previous checklist step"
              title="Previous"
            >
              <SymbolIcon name="arrow_back" className="text-[20px]" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (activeStep === steps.length - 1) {
                  minimize();
                  return;
                }
                setActiveStep((current) => current + 1);
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {activeStep === steps.length - 1 ? "Minimize" : "Next"}
              {activeStep < steps.length - 1 ? (
                <SymbolIcon name="arrow_forward" className="text-[19px]" />
              ) : null}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
