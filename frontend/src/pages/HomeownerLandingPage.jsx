import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { roleLandingPath } from "../landingRole";
import { Badge, Container, SymbolIcon } from "../ui";
import deckImage from "../assets/landing/projects/deck.webp";
import kitchenImage from "../assets/landing/projects/kitchen.webp";
import interiorImage from "../assets/landing/projects/interior.webp";
import exteriorImage from "../assets/landing/projects/exterior.webp";
import deckProgressImage from "../assets/landing/projects/deck-progress.webp";

const projectCards = [
  {
    title: "Deck Building",
    location: "Media, PA",
    image: deckImage,
  },
  {
    title: "Kitchen Island",
    location: "Media, PA",
    image: kitchenImage,
  },
  {
    title: "Feature Wall",
    location: "Media, PA",
    image: interiorImage,
  },
  {
    title: "Exterior Materials",
    location: "Media, PA",
    image: exteriorImage,
  },
  {
    title: "Deck Framing",
    location: "Media, PA",
    image: deckProgressImage,
  },
];

const guides = [
  [
    "balance",
    "How to compare bids",
    "Understand proposals and make confident decisions.",
  ],
  [
    "forum",
    "What to ask contractors",
    "Use the right questions before hiring anyone.",
  ],
  [
    "payments",
    "Budget planning basics",
    "Plan your budget and avoid hidden costs.",
  ],
  [
    "checklist",
    "What to include in a proposal",
    "Make sure nothing important is missed.",
  ],
];

function toUrl(raw) {
  if (!raw) return "";
  const value = String(raw).trim();
  if (/^(data:|blob:)/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;

  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return value.startsWith("/") ? `${origin}${value}` : `${origin}/${value}`;
}

function LandingNav() {
  const authed = !!localStorage.getItem("access");
  const [profile, setProfile] = useState(null);
  const profileType = profile?.profile_type || "";
  const displayName = profile?.display_name || profile?.username || "Account";
  const avatarInitial = displayName.trim().charAt(0).toUpperCase() || "U";

  useEffect(() => {
    if (!authed) return;

    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get("/users/me/");
        if (!cancelled) setProfile(data || null);
      } catch {
        if (!cancelled) setProfile(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authed]);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <Container className="py-3">
        <nav className="flex items-center gap-6">
          <Link
            to={authed ? roleLandingPath(profileType) : "/"}
            className="text-lg font-bold tracking-tight text-slate-900"
          >
            FlatOrigin
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            <Link
              to="/explore"
              className="px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900"
            >
              Browse Projects
            </Link>
            <a
              href="#how-it-works"
              className="px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900"
            >
              How It Works
            </a>
            <Link
              to="/guides"
              className="px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900"
            >
              Guides
            </Link>
            <Link
              to="/local-promotions"
              className="px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900"
            >
              Deals
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {authed ? (
              <>
                <Link
                  to="/contractor"
                  title="This toggle is only for viewing/previewing the other landing page."
                  className="hidden h-9 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:inline-flex"
                >
                  View Contractor Side
                </Link>
                <Link
                  to="/dashboard"
                  aria-label="Open dashboard"
                  title={displayName}
                  className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-900 font-sans text-xs font-semibold leading-none text-white shadow-sm transition hover:bg-slate-800"
                >
                  <span className="block leading-none">{avatarInitial}</span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-slate-600 transition hover:text-slate-900"
                >
                  Sign in
                </Link>
                <Link
                  to="/register?role=homeowner"
                  className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </nav>
      </Container>
    </header>
  );
}

function FeatureStrip() {
  const features = [
    [
      "edit_square",
      "Highlighted Project Planner",
      "Build a contractor-ready project packet with photos, notes, markup, and measurements.",
    ],
    ["lock", "Private or Public", "Control who can see your project."],
    [
      "fact_check",
      "Compare Bids",
      "Review proposals side by side with clarity.",
    ],
    [
      "chat_bubble",
      "Message Easily",
      "Chat with contractors all in one place.",
    ],
  ];

  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {features.map(([icon, title, copy]) => (
        <div key={title} className="text-center">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-400">
            <SymbolIcon name={icon} className="text-[24px]" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-slate-900">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{copy}</p>
        </div>
      ))}
    </div>
  );
}

export default function HomeownerLandingPage() {
  const authed = !!localStorage.getItem("access");
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (!authed) {
      setMe(null);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      try {
        const { data } = await api.get("/users/me/");
        if (!cancelled) setMe(data);
      } catch {
        if (!cancelled) setMe(null);
      }
    }

    loadProfile();

    const handleProfileChanged = () => loadProfile();
    window.addEventListener("profile:changed", handleProfileChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("profile:changed", handleProfileChanged);
    };
  }, [authed]);

  const onboardingComplete = !!me?.homeowner_onboarding_completed_at;
  const primaryCtaPath = authed
    ? onboardingComplete
      ? "/dashboard"
      : "/onboarding/homeowner"
    : "/register?role=homeowner";
  const primaryCtaLabel = authed
    ? onboardingComplete
      ? "Start a Project"
      : "Continue Homeowner Setup"
    : "Start a Project";

  return (
    <div className="bg-[#FBF9F7] text-slate-900">
      <LandingNav />
      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50/80 via-transparent to-rose-50/50" />
          <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-amber-100/40 to-orange-100/30 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-slate-100/60 to-amber-50/40 blur-3xl" />

          <Container className="relative py-16 sm:py-20 lg:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
              {/* Left: Content */}
              <div className="max-w-xl">
                <Badge className="border-amber-200/60 bg-amber-50 font-semibold uppercase tracking-[0.12em] text-amber-700">
                  Highlighted homeowner feature
                </Badge>
                <h1 className="mt-5 text-balance text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.5rem]">
                  Organize your project with the Project Planner
                </h1>
                <p className="mt-6 text-pretty text-lg leading-relaxed text-slate-600">
                  Easily turn photos, notes, measurements, and markups into a
                  clear, contractor-ready plan before you reach out for pricing.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    to={primaryCtaPath}
                    className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-900 px-8 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 hover:shadow-md"
                  >
                    {primaryCtaLabel}
                  </Link>
                  <Link
                    to="/explore"
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Browse Real Projects
                  </Link>
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                      <SymbolIcon
                        name="check"
                        className="text-[14px] text-emerald-600"
                      />
                    </span>
                    Free to start
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                      <SymbolIcon
                        name="check"
                        className="text-[14px] text-emerald-600"
                      />
                    </span>
                    No credit card
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                      <SymbolIcon
                        name="check"
                        className="text-[14px] text-emerald-600"
                      />
                    </span>
                    Cancel anytime
                  </div>
                </div>
              </div>

              {/* Right: Visual - Project Preview Stack */}
              <div className="relative">
                {/* Mobile/Tablet: Horizontal scroll preview */}
                <div className="lg:hidden">
                  <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
                    {projectCards.slice(0, 3).map((project) => (
                      <div
                        key={project.title}
                        className="flex-shrink-0 w-[200px] overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-lg backdrop-blur-sm"
                      >
                        <img
                          src={project.image}
                          alt=""
                          className="h-32 w-full object-cover"
                        />
                        <div className="p-3">
                          <div className="text-sm font-semibold text-slate-900">
                            {project.title}
                          </div>
                          <div className="text-xs text-slate-500">
                            {project.location}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desktop: Stacked cards layout */}
                <div className="relative hidden lg:block">
                  {/* Main project card */}
                  <div className="relative z-10 rounded-2xl border border-white/60 bg-white/90 p-5 shadow-xl backdrop-blur-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900">
                          <SymbolIcon
                            name="home"
                            className="text-[18px] text-white"
                          />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            Kitchen Remodel
                          </div>
                          <div className="text-xs text-slate-500">
                            Media, PA
                          </div>
                        </div>
                      </div>
                      <Badge className="bg-emerald-50 text-emerald-700">
                        3 bids
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <img
                        src={kitchenImage}
                        alt=""
                        className="aspect-square rounded-xl object-cover"
                      />
                      <img
                        src={interiorImage}
                        alt=""
                        className="aspect-square rounded-xl object-cover"
                      />
                      <img
                        src={deckImage}
                        alt=""
                        className="aspect-square rounded-xl object-cover"
                      />
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <div className="text-sm text-slate-600">
                        Budget estimate
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        $15,000 - $25,000
                      </div>
                    </div>
                  </div>

                  {/* Floating notification card */}
                  <div className="absolute -bottom-3 -left-6 z-20 rounded-xl border border-white/70 bg-white px-4 py-3 shadow-lg">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
                        <SymbolIcon
                          name="check"
                          className="text-[18px] text-emerald-600"
                        />
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          New bid received
                        </div>
                        <div className="text-[11px] text-slate-500">
                          From ABC Contractors
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Floating stats card */}
                  <div className="absolute -right-4 top-8 z-20 rounded-xl border border-white/70 bg-white px-4 py-3 shadow-lg">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100">
                        <SymbolIcon
                          name="trending_up"
                          className="text-[18px] text-amber-600"
                        />
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          Contractor-ready plan
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Photos, notes, and markup
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Background card (depth effect) */}
                  <div className="absolute -right-3 top-4 -z-10 h-full w-full rounded-2xl border border-slate-200/50 bg-white/40" />
                </div>
              </div>
            </div>
          </Container>
        </section>

        <section
          id="how-it-works"
          className="border-y border-slate-200 bg-[#F6F5F1] py-16"
        >
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Why Choose FlatOrigin
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-500">
              Start with a clearer project packet, then compare contractors with less guesswork.
            </p>
          </div>
          <div className="mx-auto mt-12 max-w-5xl px-4">
            <FeatureStrip />
          </div>
        </section>

        <Container>
          <section className="py-16">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Projects people hire for
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
              {projectCards.map((project) => (
                <Link
                  key={project.title}
                  to="/explore"
                  className="group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:shadow-md"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={project.image}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <div className="font-semibold text-slate-900">
                      {project.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {project.location}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="pb-16">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Helpful before you hire
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {guides.map(([icon, title, copy]) => (
                <Link
                  key={title}
                  to="/guides"
                  className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:shadow-md"
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-400">
                    <SymbolIcon name={icon} className="text-[18px]" />
                  </span>
                  <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-500">
                    {copy}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </Container>
      </main>

      <section className="bg-slate-900 py-16">
        <Container>
          <div className="flex flex-col items-center text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="mt-3 max-w-md text-slate-400">
              Join thousands of homeowners and contractors already using
              FlatOrigin.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to={primaryCtaPath}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-6 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
              >
                Post Your Project
              </Link>
              <Link
                to="/explore"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-600 px-6 text-sm font-medium text-white transition hover:border-slate-500 hover:bg-slate-800"
              >
                Browse Projects
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
                Connecting homeowners with quality contractors since 2026.
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
