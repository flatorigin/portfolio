import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../api";
import { Button, Container, SymbolIcon } from "../ui";
import homeownerIllustration from "../assets/landing/homeowner.webp";
import contractorIllustration from "../assets/landing/contractor.webp";

const roleCards = [
  {
    title: "For Homeowners",
    intro: "Turn photos, notes, measurements, and markups into a clearer project before asking for pricing.",
    features: [
      "Use the Project Planner to organize scope",
      "Post public jobs or invite contractors privately",
      "Find local helpers for cleanup, prep, and extra hands",
    ],
    cta: "Plan a Project",
    to: "/homeowner",
    image: homeownerIllustration,
  },
  {
    title: "For Contractors",
    intro: "Show real work, review better project details, and respond to local opportunities that fit.",
    features: [
      "Build a focused public profile",
      "Browse local work with clearer scope",
      "Use helpers when extra support is needed",
    ],
    cta: "View Contractor Tools",
    to: "/contractor",
    image: contractorIllustration,
  },
];

const whyFeatures = [
  [
    "edit_square",
    "Start With a Plan",
    "Homeowners can turn photos, notes, measurements, and markups into a contractor-ready project brief.",
  ],
  [
    "construction",
    "Match Work to Skills",
    "Contractors can understand scope faster, and homeowners can compare profiles, bids, and project fit.",
  ],
  [
    "groups",
    "Find Extra Hands",
    "Project Helpers gives local people a simple directory for cleanup, prep, moving materials, and support work.",
  ],
  [
    "menu_book",
    "Use Practical Guides",
    "Homeowner and contractor guides help clarify scope, communication, safety, helper use, and bid expectations.",
  ],
];

const workflowSteps = [
  [
    "01",
    "Organize the project",
    "Use the Project Planner to gather photos, notes, measurements, priorities, and marked-up details.",
  ],
  [
    "02",
    "Share clearer scope",
    "Post the job publicly or invite selected contractors with a cleaner description of what needs to happen.",
  ],
  [
    "03",
    "Compare and coordinate",
    "Review profiles, bids, helper availability, and guide checklists before making direct arrangements.",
  ],
];

function GatewayNav() {
  const authed = !!localStorage.getItem("access");

  return (
    <header className="border-b border-slate-200 bg-white sticky top-0 z-50">
      <Container className="py-3">
        <nav className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-slate-900"
          >
            FlatOrigin
          </Link>
          <div className="flex items-center gap-1">
            <Link
              to="/explore"
              className="hidden px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900 sm:inline-flex"
            >
              Browse Projects
            </Link>
            <Link
              to="/project-helpers"
              className="hidden px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900 md:inline-flex"
            >
              Helpers
            </Link>
            <Link
              to="/guides"
              className="hidden px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900 sm:inline-flex"
            >
              Guides
            </Link>
            <Link
              to={authed ? "/dashboard" : "/login"}
              className="px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900"
            >
              {authed ? "Dashboard" : "Sign in"}
            </Link>
            <Link
              to="/register"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </Container>
    </header>
  );
}

function RoleCard({ card }) {
  return (
    <Link to={card.to} className="group block text-inherit no-underline">
      <div className="flex min-h-[420px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:shadow-md">
        <div className="aspect-[16/10] overflow-hidden">
          <img
            src={card.image}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {card.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {card.intro}
          </p>

          <div className="mt-4 flex-1 space-y-2">
            {card.features.map((feature) => (
              <div key={feature} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-50">
                  <SymbolIcon
                    name="check"
                    className="text-[12px] text-red-400"
                  />
                </span>
                <span className="text-sm text-slate-600">{feature}</span>
              </div>
            ))}
          </div>

          <span className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 text-sm font-medium text-white transition group-hover:bg-slate-800">
            {card.cta}
            <SymbolIcon name="arrow_forward" className="ml-2 text-[16px]" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function IntroVideoPlaceholder() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm">
      <div className="aspect-video">
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-950 shadow-sm">
            <SymbolIcon name="play_arrow" className="text-[36px]" fill={1} />
          </div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">
            Intro Video
          </div>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
            Placeholder for a short FlatOrigin walkthrough showing project planning,
            contractor review, and helper discovery.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-400">
        Future embed: homepage intro video
      </div>
    </div>
  );
}

export default function LandingPage() {
  const authed = !!localStorage.getItem("access");
  const [profileType, setProfileType] = useState(authed ? null : "");

  useEffect(() => {
    if (!authed) {
      setProfileType("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get("/users/me/");
        if (!cancelled) setProfileType(data?.profile_type || "");
      } catch {
        if (!cancelled) setProfileType("");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authed]);

  if (authed && profileType === null) {
    return (
      <div className="min-h-screen bg-[#FBF9F7] text-slate-900">
        <GatewayNav />
        <Container className="py-16 text-sm text-slate-500">Loading…</Container>
      </div>
    );
  }

  if (authed && (profileType === "homeowner" || profileType === "contractor")) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-[#FBF9F7] text-slate-900">
      <GatewayNav />

      <main>
        <Container className="py-14 sm:py-18">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)] lg:items-center">
            <div>
              <div className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Project planning, local contractors, and extra hands
              </div>
              <h1 className="mt-5 max-w-3xl text-balance text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Organize the project before the pricing conversation starts.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                FlatOrigin helps homeowners create clearer project details, contractors
                review better scope, and local helpers list themselves for project support.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to="/homeowner">
                  <Button className="h-11 rounded-xl bg-slate-950 px-6 text-sm font-semibold hover:bg-slate-800">
                    Start as Homeowner
                  </Button>
                </Link>
                <Link
                  to="/contractor"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Join as Contractor
                </Link>
                <Link
                  to="/project-helpers"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  View Project Helpers
                </Link>
              </div>
            </div>
            <IntroVideoPlaceholder />
          </div>

          <div className="mx-auto mt-12 grid w-full gap-5 sm:grid-cols-2">
            {roleCards.map((card) => (
              <RoleCard key={card.title} card={card} />
            ))}
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-400">
            <SymbolIcon name="swap_horiz" className="text-[18px]" />
            <span>You can switch between experiences anytime.</span>
          </p>
        </Container>
      </main>

      <section className="border-y border-slate-200 bg-[#F6F5F1] py-16">
        <Container>
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Built around better project context.
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              FlatOrigin is not only a profile directory. It is a practical way to
              organize project details, compare options, and find the right local support.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {whyFeatures.map(([icon, title, copy]) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <SymbolIcon name={icon} className="text-[23px]" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {copy}
                </p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-white py-16">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                How it works
              </div>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                From rough idea to clearer next step.
              </h2>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              {workflowSteps.map(([number, title, copy]) => (
                <div
                  key={number}
                  className="grid gap-4 border-b border-slate-200 bg-white p-5 last:border-b-0 sm:grid-cols-[72px_220px_minmax(0,1fr)] sm:items-start"
                >
                  <div className="text-sm font-bold text-slate-400">{number}</div>
                  <div className="font-semibold text-slate-950">{title}</div>
                  <div className="text-sm leading-6 text-slate-600">{copy}</div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-slate-900 py-16">
        <Container>
          <div className="flex flex-col items-center text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ready to make the project clearer?
            </h2>
            <p className="mt-3 max-w-md text-slate-400">
              Start with a project plan, browse contractors, or list yourself as a local helper.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/homeowner">
                <Button className="h-11 bg-white px-6 !text-slate-900 hover:bg-slate-100">
                  Plan Your Project
                </Button>
              </Link>
              <Link
                to="/contractor"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-600 px-6 text-sm font-medium text-white transition hover:border-slate-500 hover:bg-slate-800"
              >
                Join as Contractor
              </Link>
              <Link
                to="/project-helpers"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-600 px-6 text-sm font-medium text-white transition hover:border-slate-500 hover:bg-slate-800"
              >
                List as Helper
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <Container className="py-10">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Link to="/" className="text-lg font-bold text-slate-900">
                FlatOrigin
              </Link>
              <p className="mt-2 max-w-xs text-sm text-slate-500">
                Project planning, local contractor discovery, and helper listings for real home projects.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm">
              <div className="flex flex-col gap-3">
                <span className="font-semibold text-slate-900">Product</span>
                <Link
                  to="/homeowner"
                  className="text-slate-600 hover:text-slate-900"
                >
                  For Homeowners
                </Link>
                <Link
                  to="/contractor"
                  className="text-slate-600 hover:text-slate-900"
                >
                  For Contractors
                </Link>
                <Link
                  to="/explore"
                  className="text-slate-600 hover:text-slate-900"
                >
                  Browse Projects
                </Link>
                <Link
                  to="/project-helpers"
                  className="text-slate-600 hover:text-slate-900"
                >
                  Project Helpers
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-semibold text-slate-900">Resources</span>
                <Link
                  to="/guides"
                  className="text-slate-600 hover:text-slate-900"
                >
                  Guides
                </Link>
                <Link
                  to="/project-check"
                  className="text-slate-600 hover:text-slate-900"
                >
                  Project Check
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-semibold text-slate-900">Account</span>
                <Link
                  to="/login"
                  className="text-slate-600 hover:text-slate-900"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="text-slate-600 hover:text-slate-900"
                >
                  Create account
                </Link>
              </div>
            </div>
          </div>
        </Container>
        <div className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
          © 2026 FlatOrigin. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
