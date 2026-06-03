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

function FeatureStrip() {
  const features = [
    ["edit_square", "Organize Ideas", "Upload photos, add notes and measurements."],
    ["lock", "Private or Public", "Control who can see your project."],
    ["fact_check", "Compare Bids", "Review proposals side by side with clarity."],
    ["chat_bubble", "Message Easily", "Chat with contractors all in one place."],
  ];

  return (
    <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {features.map(([icon, title, copy]) => (
        <div key={title}>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white">
            <SymbolIcon name={icon} className="text-[22px]" />
          </span>
          <h3 className="mt-5 text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-slate-500">{copy}</p>
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
        <Container className="py-10 sm:py-14">
          <section className="max-w-3xl">
            <Badge className="border-[#E4E6EE] bg-[#F6F7FB] font-semibold uppercase tracking-[0.12em] text-slate-600">
              For homeowners
            </Badge>
            <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Plan your home project with clarity
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              Save ideas, organize project details, compare bids, and communicate with contractors - all in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to={primaryCtaPath}>
                <Button className="h-12 px-8 text-base">
                  {primaryCtaLabel}
                </Button>
              </Link>
              <Link
                to="/explore"
                className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Browse Real Projects
              </Link>
            </div>
            <button className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                <SymbolIcon name="play_arrow" className="ml-0.5 text-[16px] text-slate-600" />
              </span>
              Watch how it works
            </button>
          </section>

          <section id="how-it-works" className="mt-20 rounded-3xl bg-slate-50 px-6 py-12 sm:px-10 sm:py-16">
            <h2 className="mb-10 text-center text-2xl font-bold tracking-tight text-slate-900">How it works</h2>
            <FeatureStrip />
          </section>

          <section className="mt-20">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Projects people hire for
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {projectCards.map((project) => (
                <Link
                  key={project.title}
                  to="/explore"
                  className="group"
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-xl">
                    <img 
                      src={project.image} 
                      alt="" 
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105" 
                    />
                  </div>
                  <div className="mt-3">
                    <div className="font-semibold text-slate-900">{project.title}</div>
                    <div className="mt-0.5 text-sm text-slate-500">{project.location}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-20">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Helpful before you hire</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {guides.map(([icon, title, copy]) => (
                <Link
                  key={title}
                  to="/guides"
                  className="group"
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition group-hover:bg-slate-900 group-hover:text-white">
                    <SymbolIcon name={icon} className="text-[22px]" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-500">{copy}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 transition group-hover:gap-2.5">
                    Read guide
                    <SymbolIcon name="arrow_forward" className="text-[16px]" />
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-20 rounded-3xl bg-slate-900 p-8 sm:p-12">
            <div className="flex flex-col items-center text-center">
              <h2 className="max-w-md text-3xl font-bold text-white">Ready to start your next project?</h2>
              <p className="mt-4 max-w-md text-base text-slate-400">
                Create your free account and bring your project to life.
              </p>
              <Link to={primaryCtaPath} className="mt-8">
                <Button className="h-12 bg-white px-8 text-base text-slate-900 hover:bg-slate-100">
                  {authed
                    ? onboardingComplete
                      ? "Open Dashboard"
                      : "Continue Homeowner Setup"
                    : "Create Free Account"}
                </Button>
              </Link>
              <p className="mt-4 text-sm text-slate-400">
                {authed ? "Ready to continue? " : "Already have an account? "}
                <Link to={authed ? "/explore" : "/login"} className="font-medium text-white hover:underline">
                  {authed ? "Explore projects" : "Sign in"}
                </Link>
              </p>
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
