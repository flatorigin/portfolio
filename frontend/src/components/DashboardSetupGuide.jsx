import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api";
import { SymbolIcon } from "../ui";

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasPlanDetails(plan) {
  const title = String(plan?.title || "").trim();
  return (
    title.length > 0 &&
    !["Untitled issue", "Untitled project plan"].includes(title) &&
    hasText(plan?.house_location) &&
    hasText(plan?.issue_summary)
  );
}

function hasPlanVisuals(plan) {
  const versions = Array.isArray(plan?.markup_data?.versions)
    ? plan.markup_data.versions
    : [];
  return (Array.isArray(plan?.images) && plan.images.length > 0) || versions.length > 0;
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

function projectIsJobPost(project) {
  const value = project?.is_job_posting;
  return value === true || value === 1 || value === "1" || value === "true";
}

function mobileViewportMatches() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 639px)").matches
  );
}

function announceGuideOpened() {
  window.dispatchEvent(new CustomEvent("dashboard-setup-guide:opened"));
}

export default function DashboardSetupGuide({
  profile,
  projects = [],
  bids = [],
  inboxThreads = [],
  onCreateProject,
}) {
  const location = useLocation();
  const role = profile?.profile_type;
  const username = profile?.username || "";
  const storageKey = username ? `dashboard-setup-guide-seen:${username}` : "";
  const [open, setOpen] = useState(() => {
    if (mobileViewportMatches()) return false;
    if (!username) return false;
    const newGuideSeen =
      localStorage.getItem(`dashboard-setup-guide-seen:${username}`) === "1";
    const previousContractorGuideSeen =
      role === "contractor" &&
      localStorage.getItem(`contractor-dashboard-guide-seen:${username}`) === "1";
    return !newGuideSeen && !previousContractorGuideSeen;
  });
  const [activeStep, setActiveStep] = useState(0);
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(role === "homeowner");
  const [isMobile, setIsMobile] = useState(mobileViewportMatches);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const syncViewport = (event) => {
      const matches = event?.matches ?? mediaQuery.matches;
      setIsMobile(matches);
      if (matches) setOpen(false);
    };

    syncViewport(mediaQuery);
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    if (role !== "homeowner") {
      setPlans([]);
      setPlansLoading(false);
      return undefined;
    }

    let active = true;
    setPlansLoading(true);
    api
      .get("/project-plans/", { params: { scope: "active" } })
      .then(({ data }) => {
        if (active) setPlans(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setPlans([]);
      })
      .finally(() => {
        if (active) setPlansLoading(false);
      });

    return () => {
      active = false;
    };
  }, [role, username]);

  const steps = useMemo(() => {
    if (role === "homeowner") {
      const firstPlan = plans.find((plan) => plan?.status !== "archived") || plans[0];
      const planPath = firstPlan?.id
        ? `/dashboard/planner/${firstPlan.id}`
        : "/dashboard";
      const hasContactDetails = Boolean(
        (hasText(profile?.contact_email) || hasText(profile?.email)) &&
          hasText(profile?.contact_phone),
      );

      return [
        {
          title: "Start a private project plan",
          description:
            "Create a private workspace before sharing anything with contractors.",
          complete: plans.length > 0,
          actionLabel: "Open planner",
          to: "/dashboard?onboarding=start-plan",
          icon: "add_home_work",
        },
        {
          title: "Describe the project",
          description:
            "Add the project name, work area, type, and a short summary of what needs to happen.",
          complete: plans.some(hasPlanDetails),
          actionLabel: firstPlan ? "Add details" : "Start a plan",
          to: `${planPath}?onboarding=${firstPlan ? "project-details" : "start-plan"}`,
          icon: "description",
        },
        {
          title: "Add visual information",
          description:
            "Upload photos, create a floor plan, or add markup when it helps explain the work.",
          complete: plans.some(hasPlanVisuals),
          actionLabel: firstPlan ? "Add visuals" : "Start a plan",
          to: `${planPath}?onboarding=${firstPlan ? "project-visuals" : "start-plan"}`,
          icon: "photo_library",
        },
        {
          title: "Complete your contact details",
          description:
            "Add your name, project area, and contact information for contractor conversations.",
          complete:
            hasText(profile?.display_name) &&
            hasText(profile?.service_location) &&
            hasContactDetails,
          actionLabel: "Complete profile",
          to: "/onboarding/homeowner",
          icon: "person",
        },
        {
          title: "Share the project",
          description:
            "Review the project packet, then publish it or invite a contractor.",
          complete: projects.some(projectIsJobPost),
          actionLabel: firstPlan ? "Review project" : "Start a plan",
          to: `${planPath}?onboarding=${firstPlan ? "share-project" : "start-plan"}`,
          icon: "send",
        },
      ];
    }

    const categories = Array.isArray(profile?.contractor_categories)
      ? profile.contractor_categories
      : [];
    const hasProfileImage = Boolean(
      profile?.avatar_url || profile?.avatar || profile?.logo,
    );
    const hasContactDetails = Boolean(
      (hasText(profile?.contact_email) || hasText(profile?.email)) &&
        hasText(profile?.contact_phone),
    );
    const hasConnection =
      bids.length > 0 ||
      inboxThreads.some((thread) =>
        isHomeownerConnection(thread, profile?.username),
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
        actionLabel: "Open setup",
        to: "/onboarding/contractor",
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
        to: "/profile/edit?onboarding=services",
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
        to: "/work?onboarding=review-work",
        icon: "assignment",
      },
      {
        title: "Make your first connection",
        description: "Submit a bid or message a homeowner about a project.",
        complete: hasConnection,
        actionLabel: "View opportunities",
        to: "/work?onboarding=make-connection",
        icon: "handshake",
      },
    ];
  }, [role, plans, profile, projects, bids, inboxThreads, onCreateProject]);

  const completedCount = steps.filter((step) => step.complete).length;
  const allComplete = steps.length > 0 && completedCount === steps.length;
  const guideTitle =
    role === "homeowner"
      ? "Get your first project ready"
      : "Build your contractor presence";

  useEffect(() => {
    if (!storageKey || !allComplete) return;
    localStorage.setItem(storageKey, "1");
    setOpen(false);
  }, [allComplete, storageKey]);

  useEffect(() => {
    if (!username || allComplete) return;
    const nextIncomplete = steps.findIndex((step) => !step.complete);
    setActiveStep(nextIncomplete >= 0 ? nextIncomplete : 0);
  }, [username, allComplete, steps]);

  useEffect(() => {
    const reopen = () => {
      const nextIncomplete = steps.findIndex((step) => !step.complete);
      setActiveStep(nextIncomplete >= 0 ? nextIncomplete : 0);
      setOpen(true);
      announceGuideOpened();
    };
    window.addEventListener("onboarding:open", reopen);
    return () => window.removeEventListener("onboarding:open", reopen);
  }, [steps]);

  useEffect(() => {
    if (sessionStorage.getItem("dashboard-setup-guide-request-open") !== "1") {
      return;
    }
    sessionStorage.removeItem("dashboard-setup-guide-request-open");
    const nextIncomplete = steps.findIndex((step) => !step.complete);
    setActiveStep(nextIncomplete >= 0 ? nextIncomplete : 0);
    setOpen(true);
    announceGuideOpened();
  }, [steps]);

  useEffect(() => {
    if (!open || !isMobile) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, isMobile]);

  if (!username || !["homeowner", "contractor"].includes(role) || plansLoading) {
    return null;
  }
  if (new URLSearchParams(location.search).has("onboarding")) return null;
  if (allComplete && !open) return null;

  const step = steps[activeStep] || steps[0];

  const minimize = () => {
    if (storageKey) localStorage.setItem(storageKey, "1");
    setOpen(false);
  };

  const reopen = () => {
    const nextIncomplete = steps.findIndex((item) => !item.complete);
    setActiveStep(nextIncomplete >= 0 ? nextIncomplete : 0);
    setOpen(true);
    announceGuideOpened();
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
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex h-12 items-center gap-2 rounded-full bg-slate-950 px-4 text-white shadow-xl transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:bottom-5 sm:right-5 sm:h-14"
        aria-label={`Open ${guideTitle.toLowerCase()}`}
        title="Open setup guide"
      >
        <SymbolIcon name="checklist" className="text-[21px] sm:text-[24px]" weight={500} />
        <span className="text-sm font-semibold sm:hidden">Setup {completedCount}/5</span>
        <span className="hidden text-sm font-semibold sm:inline">{completedCount}/5</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={minimize}
        className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] sm:hidden"
        aria-label="Close setup guide"
      />
      <aside
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[70dvh] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:bottom-5 sm:left-auto sm:right-5 sm:max-h-none sm:w-[360px] sm:rounded-xl"
        aria-label={guideTitle}
        aria-live="polite"
        role={isMobile ? "dialog" : "complementary"}
        aria-modal={isMobile ? "true" : undefined}
      >
      <div className="border-b border-slate-100 bg-slate-950 px-4 py-4 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold">{guideTitle}</div>
            <div className="mt-1 text-xs text-slate-300">
              {completedCount} of 5 completed
            </div>
          </div>
          <button
            type="button"
            onClick={minimize}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70"
            aria-label="Minimize setup guide"
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

      <div className="min-h-0 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
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
    </>
  );
}
