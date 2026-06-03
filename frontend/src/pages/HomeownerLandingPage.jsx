import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { roleLandingPath } from "../landingRole";
import { Badge, Button, Container, SymbolIcon } from "../ui";
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
  ["balance", "How to compare bids", "Understand proposals and make confident decisions."],
  ["forum", "What to ask contractors", "Use the right questions before hiring anyone."],
  ["payments", "Budget planning basics", "Plan your budget and avoid hidden costs."],
  ["checklist", "What to include in a proposal", "Make sure nothing important is missed."],
];

function LandingNav() {
  const authed = !!localStorage.getItem("access");
  const [profileType, setProfileType] = useState("");

  useEffect(() => {
    if (!authed) return;

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

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-sm">
      <Container className="py-4">
        <nav className="flex items-center gap-6">
          <Link to={authed ? roleLandingPath(profileType) : "/"} className="text-lg font-bold tracking-tight text-slate-900">
            FlatOrigin
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            <Link to="/explore" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              Browse Projects
            </Link>
            <Link to="/guides" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              Guides
            </Link>
            <a href="#how-it-works" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              How it works
            </a>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to={authed ? "/dashboard" : "/login"}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              {authed ? "Dashboard" : "Sign in"}
            </Link>
          </div>
        </nav>
      </Container>
    </header>
  );
}

function HeroVisual() {
  return (
    <div className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200">
      <img
        src={kitchenImage}
        alt="Home renovation project"
        className="h-full w-full object-cover opacity-90"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-slate-900/30 transition group-hover:bg-slate-900/40">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-lg transition group-hover:scale-105">
          <SymbolIcon name="play_arrow" className="ml-1 text-[32px] text-slate-900" />
        </div>
      </div>
      <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-white/95 p-3 backdrop-blur-sm">
        <p className="text-xs font-medium text-slate-600">See how FlatOrigin works</p>
        <p className="mt-0.5 text-sm font-semibold text-slate-900">2 min overview</p>
      </div>
    </div>
  );
}

function FeatureStrip() {
  const features = [
    ["edit_square", "Organize Ideas", "Upload photos, add notes and measurements."],
    ["lock", "Private or Public", "Control who can see your project."],
    ["fact_check", "Compare Bids", "Review proposals side by side with clarity."],
    ["chat_bubble", "Message Easily", "Chat with contractors all in one place."],
  ];

  return (
    <div className="rounded-2xl bg-slate-900 px-6 py-10 sm:px-10 sm:py-12">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {features.map(([icon, title, copy]) => (
          <div key={title} className="text-center lg:text-left">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 text-white">
              <SymbolIcon name={icon} className="text-[24px]" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-white">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{copy}</p>
          </div>
        ))}
      </div>
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
        <Container className="py-10 sm:py-14">
          <section className="grid items-center gap-12 lg:grid-cols-[1fr_0.82fr]">
            <div>
              <Badge className="border-[#E4E6EE] bg-[#F6F7FB] font-semibold uppercase tracking-[0.12em] text-slate-600">
                For homeowners
              </Badge>
              <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
                Plan your home project with more clarity.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
                Save ideas, organize project details, compare bids, and communicate with contractors in one place.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to={primaryCtaPath}>
                  <Button className="h-11 min-w-48">
                    {primaryCtaLabel}
                  </Button>
                </Link>
                <Link
                  to="/explore"
                  className="inline-flex h-11 min-w-48 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Browse Real Projects
                </Link>
              </div>
            </div>
            <HeroVisual />
          </section>

          <section id="how-it-works" className="mt-16">
            <FeatureStrip />
          </section>

          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              See the kind of work people actually hire for
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {projectCards.map((project) => (
                <Link
                  key={project.title}
                  to="/explore"
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <img src={project.image} alt="" className="h-28 w-full object-cover" />
                  <div className="p-3">
                    <div className="text-sm font-semibold text-slate-900">{project.title}</div>
                    <div className="mt-1 text-xs font-medium text-slate-500">{project.location}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-16 rounded-2xl bg-slate-100 px-6 py-10 sm:px-10 sm:py-12">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Helpful before you hire</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {guides.map(([icon, title, copy]) => (
                <Link
                  key={title}
                  to="/guides"
                  className="group"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm transition group-hover:bg-slate-900 group-hover:text-white">
                    <SymbolIcon name={icon} className="text-[22px]" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{copy}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-slate-900 transition group-hover:gap-2">
                    Read Guide
                    <SymbolIcon name="arrow_forward" className="text-[16px]" />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-16 rounded-2xl border border-[#E2DDD4] bg-[#F1ECE4] p-8 sm:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">Ready to start your next project?</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Create your free account and bring your project to life.
                </p>
              </div>
              <div className="text-center">
                <Link to={primaryCtaPath}>
                  <Button className="h-11 min-w-56">
                    {authed
                      ? onboardingComplete
                        ? "Open Dashboard"
                        : "Continue Homeowner Setup"
                      : "Create Free Account"}
                  </Button>
                </Link>
                <div className="mt-3 text-xs text-slate-500">
                  {authed ? "Ready to continue? " : "Already have an account? "}
                  <Link to={authed ? "/explore" : "/login"} className="font-semibold text-slate-700 hover:text-slate-950">
                    {authed ? "Explore projects" : "Sign in"}
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </Container>
      </main>

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
                <Link to="/homeowner" className="text-slate-600 hover:text-slate-900">
                  For Homeowners
                </Link>
                <Link to="/contractor" className="text-slate-600 hover:text-slate-900">
                  For Contractors
                </Link>
                <Link to="/explore" className="text-slate-600 hover:text-slate-900">
                  Browse Projects
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-semibold text-slate-900">Resources</span>
                <Link to="/guides" className="text-slate-600 hover:text-slate-900">
                  Guides
                </Link>
                <Link to="/project-check" className="text-slate-600 hover:text-slate-900">
                  Project Check
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-semibold text-slate-900">Account</span>
                <Link to="/login" className="text-slate-600 hover:text-slate-900">
                  Sign in
                </Link>
                <Link to="/register" className="text-slate-600 hover:text-slate-900">
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
