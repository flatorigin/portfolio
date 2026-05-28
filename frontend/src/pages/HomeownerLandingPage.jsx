import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { roleLandingPath } from "../landingRole";
import { Badge, Button, Card, Container, SymbolIcon } from "../ui";
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
  ["How to compare bids", "Understand proposals and make confident decisions."],
  ["What to ask contractors", "Use the right questions before hiring anyone."],
  ["Budget planning basics", "Plan your budget and avoid hidden costs."],
  ["What to include in a proposal", "Make sure nothing important is missed."],
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
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <Container className="py-3">
        <nav className="flex items-center gap-6">
          <Link to={authed ? roleLandingPath(profileType) : "/"} className="text-base font-bold tracking-tight text-slate-900">
            FlatOrigin
          </Link>
          <div className="hidden items-center gap-2 md:flex">
            <Link to="/explore" className="rounded-xl px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
              Browse Projects
            </Link>
            <Link to="/guides" className="rounded-xl px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
              Guides
            </Link>
            <a href="#how-it-works" className="rounded-xl px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
              How it works
            </a>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/contractor"
              title="This toggle is only for viewing/previewing the other landing page."
              className="hidden h-9 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              View Contractor Side
            </Link>
            <Link
              to={authed ? "/dashboard" : "/login"}
              className="inline-flex h-9 items-center rounded-xl bg-slate-900 px-5 text-sm font-medium text-white hover:opacity-90"
            >
              {authed ? "Dashboard" : "Sign in"}
            </Link>
          </div>
        </nav>
      </Container>
    </header>
  );
}

function ProjectPreview() {
  const jobs = [
    {
      title: "Kitchen Renovation",
      location: "Media, PA",
      budget: "$15,000 - $25,000",
      image: kitchenImage,
    },
    {
      title: "Deck Rebuild",
      location: "Media, PA",
      budget: "$8,000 - $12,000",
      image: deckImage,
    },
  ];

  return (
    <Card className="grid h-[360px] grid-rows-2 gap-4 p-5">
      {jobs.map((job) => (
        <div
          key={job.title}
          className="grid min-h-0 grid-cols-[120px_minmax(0,1fr)] gap-4 rounded-2xl border border-slate-200 bg-white p-3"
        >
          <img
            src={job.image}
            alt=""
            className="h-full min-h-0 w-full rounded-xl object-cover"
          />
          <div className="flex min-w-0 flex-col justify-center">
            <div className="truncate text-base font-semibold text-slate-950">
              {job.title}
            </div>
            <div className="mt-2 text-sm font-medium text-slate-500">
              {job.location}
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-700">
              {job.budget}
            </div>
          </div>
        </div>
      ))}
    </Card>
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
    <Card className="grid overflow-hidden md:grid-cols-4">
      {features.map(([icon, title, copy]) => (
        <div key={title} className="border-slate-100 p-6 md:border-r md:last:border-r-0">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <SymbolIcon name={icon} className="text-[22px]" />
          </span>
          <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
        </div>
      ))}
    </Card>
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
            <ProjectPreview />
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

          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Helpful before you hire</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-4">
              {guides.map(([title, copy]) => (
                <Link
                  key={title}
                  to="/guides"
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
                  <div className="mt-6 text-sm font-medium text-slate-900">Read Guide {"->"}</div>
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

      <footer className="border-t border-slate-200 bg-white py-8">
        <Container className="grid max-w-5xl gap-5 text-center text-sm font-semibold text-slate-500 sm:grid-cols-4">
          <div>100% Free to Get Started</div>
          <div>No Middlemen</div>
          <div>Local Contractors</div>
          <div>Safe and Secure</div>
        </Container>
      </footer>
    </div>
  );
}
