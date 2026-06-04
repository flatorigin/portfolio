import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { roleLandingPath } from "../landingRole";
import { Badge, Container, SymbolIcon } from "../ui";
import {
  getCachedLocationOrigin,
  locationParams,
  requestLocationOrigin,
} from "../utils/locationOrigin";
import bathroomMessage1 from "../assets/landing/projects/bathroom-message-1.webp";
import bathroomMessage2 from "../assets/landing/projects/bathroom-message-2.webp";
import bathroomMessage3 from "../assets/landing/projects/bathroom-message-3.webp";
import mapAvatarImage from "../assets/landing/maps/map-avatar.webp";

const profileImages = [
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=500&q=80",
];

const bathroomMessageImages = [
  bathroomMessage1,
  bathroomMessage2,
  bathroomMessage3,
];

const features = [
  [
    "construction",
    "Showcase Your Work",
    "Display completed projects and specialties.",
  ],
  [
    "travel_explore",
    "Find Local Work",
    "Browse homeowner projects in your area.",
  ],
  [
    "chat_bubble",
    "Communicate Directly",
    "Message homeowners and discuss details.",
  ],
  ["handshake", "Get Quality Leads", "Bid on projects that match your skills."],
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

function pickCover(project) {
  return (
    toUrl(project?.cover_image_url || "") ||
    toUrl(project?.cover_image || "") ||
    ""
  );
}

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
          <Link
            to={authed ? roleLandingPath(profileType) : "/"}
            className="text-lg font-bold tracking-tight text-slate-900"
          >
            FlatOrigin
          </Link>
          <div className="hidden items-center gap-1 md:flex">
            <Link
              to="/work"
              className="px-3 py-2 text-sm text-slate-600 transition hover:text-slate-900"
            >
              Find Work
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
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link
              to={authed ? "/dashboard" : "/login"}
              className="text-sm text-slate-600 transition hover:text-slate-900"
            >
              {authed ? "Dashboard" : "Sign in"}
            </Link>
            <Link
              to={authed ? "/onboarding/contractor" : "/register?role=contractor"}
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

function ContractorSetupBanner() {
  const authed = !!localStorage.getItem("access");
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!authed) {
      setShowBanner(false);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      try {
        const { data } = await api.get("/users/me/");
        if (cancelled) return;
        setShowBanner(
          data?.profile_type === "contractor" &&
            !data?.contractor_onboarding_completed_at
        );
      } catch {
        if (!cancelled) setShowBanner(false);
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

  if (!showBanner) return null;

  return (
    <div className="border-b border-slate-200 bg-white">
      <Container>
        <div className="flex min-h-20 flex-col justify-center gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">
              Continue your free contractor setup
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Finish your profile so homeowners can browse your work. No credit card required.
            </p>
          </div>
          <Link
            to="/onboarding/contractor"
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Continue contractor setup
          </Link>
        </div>
      </Container>
    </div>
  );
}

function ProjectFeedPreview() {
  const [locationOrigin, setLocationOrigin] = useState(getCachedLocationOrigin);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    requestLocationOrigin().then((origin) => {
      if (alive && origin) setLocationOrigin(origin);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadJobs() {
      setLoading(true);
      try {
        const { data } = await api.get("/projects/job-postings/", {
          params: locationParams(locationOrigin),
        });
        if (cancelled) return;

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : [];
        const activeJobs = list.filter(
          (project) =>
            !!project?.is_job_posting &&
            (project?.is_public === undefined || project.is_public === true) &&
            (project?.is_private === undefined ||
              project.is_private === false) &&
            (project?.job_is_published === undefined ||
              project.job_is_published === true),
        );

        setJobs(activeJobs.slice(0, 2));
      } catch (err) {
        console.warn(
          "[ContractorLandingPage] job preview failed",
          err?.response || err,
        );
        if (!cancelled) setJobs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadJobs();

    return () => {
      cancelled = true;
    };
  }, [locationOrigin]);

  const fallbackJobs = [
    {
      id: "fallback-deck",
      title: "Deck Construction",
      location: "Find local postings",
      budget: "",
      cover: profileImages[1],
      to: "/work",
    },
    {
      id: "fallback-remodel",
      title: "Bathroom Remodel",
      location: "Find local postings",
      budget: "",
      cover: profileImages[2],
      to: "/work",
    },
  ];

  const visibleJobs = jobs.length ? jobs : fallbackJobs;

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {visibleJobs.map((job) => {
        const cover = pickCover(job) || job.cover || "";
        const budget = job.budget
          ? `$${Number(job.budget).toLocaleString()}`
          : "";
        const summary = job.job_summary || job.summary || job.highlights || "";

        return (
          <Link
            key={job.id || job.title}
            to="/work"
            className="group"
          >
            <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Job posting
                </div>
              )}
            </div>
            <div className="mt-3">
              <div className="text-[15px] font-semibold text-slate-900">
                {loading && !jobs.length ? "Loading local work..." : job.title}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">
                {job.location || "Local project"}
              </div>
              {budget ? (
                <div className="mt-2 inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {budget}
                </div>
              ) : null}
              {summary ? (
                <div className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">
                  {summary}
                </div>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function FeatureStrip() {
  return (
    <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
      {features.map(([icon, title, copy]) => (
        <div key={title} className="text-center">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-400">
            <SymbolIcon name={icon} className="text-[24px]" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{copy}</p>
        </div>
      ))}
    </div>
  );
}

function WebProfilePreview() {
  const portfolioItems = [
    ["Deck rebuild", "Before / after", profileImages[1]],
    ["Kitchen finish", "Completed work", profileImages[2]],
    ["Exterior refresh", "Portfolio photo", profileImages[0]],
  ];

  return (
    <div className="rounded-2xl bg-slate-50 p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
          FO
        </div>
        <div className="min-w-0">
          <div className="truncate text-base font-semibold text-slate-900">
            Your public web profile
          </div>
          <div className="truncate text-sm text-slate-500">
            Portfolio, service area, specialties, and contact flow
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {portfolioItems.map(([title, label, image]) => (
          <div key={title} className="group">
            <div className="aspect-[4/3] overflow-hidden rounded-xl">
              <img src={image} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
            </div>
            <div className="mt-3">
              <div className="text-[15px] font-semibold text-slate-900">{title}</div>
              <div className="mt-0.5 text-xs text-slate-400">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-6">
        {["Decks", "Carpentry", "Exterior Repairs"].map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function MessagePreview() {
  return (
    <div className="rounded-2xl bg-slate-50 p-6">
      <div className="mb-5 text-base font-semibold text-slate-900">
        Bathroom Remodel
      </div>
      <div className="space-y-4">
        <div className="ml-auto max-w-[76%] rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
          Can you share more photos of the current bathroom?
        </div>
        <div className="max-w-[78%] rounded-2xl bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          Sure, here are a few more.
        </div>
        <div className="flex gap-2 pl-3">
          {bathroomMessageImages.map((image) => (
            <img
              key={image}
              src={image}
              alt=""
              className="h-16 w-20 rounded-lg object-cover"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LocalMapPreview() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl bg-slate-100">
      <img src={mapAvatarImage} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

export default function ContractorLandingPage() {
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

  const onboardingComplete = !!me?.contractor_onboarding_completed_at;
  const primaryCtaPath = authed
    ? onboardingComplete
      ? "/profile/edit"
      : "/onboarding/contractor"
    : "/register?role=contractor";
  const primaryCtaLabel = authed
    ? onboardingComplete
      ? "Complete your profile"
      : "Continue Contractor Setup"
    : "Create Contractor Profile";

  return (
    <div className="bg-[#FBF9F7] text-slate-900">
      <LandingNav />
      <ContractorSetupBanner />
      <main>
        <Container className="py-12 sm:py-16 lg:py-20">
          <section className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left: Content */}
            <div className="max-w-xl">
              <Badge className="border-[#E4E6EE] bg-[#F6F7FB] font-semibold uppercase tracking-[0.12em] text-slate-600">
                For contractors
              </Badge>
              <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.5rem]">
                Show real work. Connect with real homeowners.
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-slate-600">
                Build a focused public profile, showcase completed projects, and
                bid on homeowner projects directly.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  to={primaryCtaPath}
                  className="inline-flex h-12 items-center justify-center rounded-xl bg-slate-900 px-8 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  {primaryCtaLabel}
                </Link>
                <Link
                  to="/work"
                  className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Explore Projects
                </Link>
              </div>
              <div className="mt-8 flex items-center gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                    <SymbolIcon name="check" className="text-[14px] text-emerald-600" />
                  </span>
                  Free to join
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100">
                    <SymbolIcon name="check" className="text-[14px] text-emerald-600" />
                  </span>
                  No monthly fees
                </div>
              </div>
            </div>

            {/* Right: Visual */}
            <div className="relative hidden lg:block">
              <div className="relative">
                {/* Main profile card */}
                <div className="relative z-10 rounded-2xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                      JD
                    </div>
                    <div>
                      <div className="text-base font-semibold text-slate-900">Your Public Profile</div>
                      <div className="text-xs text-slate-500">Showcase your best work</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <img src={profileImages[0]} alt="" className="aspect-square rounded-lg object-cover" />
                    <img src={profileImages[1]} alt="" className="aspect-square rounded-lg object-cover" />
                    <img src={profileImages[2]} alt="" className="aspect-square rounded-lg object-cover" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["Decks", "Kitchens", "Bathrooms"].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Floating job alert card */}
                <div className="absolute -bottom-4 -left-8 z-20 rounded-xl border border-white/60 bg-white px-4 py-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                      <SymbolIcon name="work" className="text-[16px] text-blue-600" />
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-slate-900">New project nearby</div>
                      <div className="text-[11px] text-slate-500">Kitchen Remodel - 2.4 mi</div>
                    </div>
                  </div>
                </div>

                {/* Floating message card */}
                <div className="absolute -right-4 top-8 z-20 rounded-xl border border-white/60 bg-white px-4 py-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                      <SymbolIcon name="chat_bubble" className="text-[16px] text-emerald-600" />
                    </span>
                    <div>
                      <div className="text-xs font-semibold text-slate-900">Homeowner message</div>
                      <div className="text-[11px] text-slate-500">&quot;When can you start?&quot;</div>
                    </div>
                  </div>
                </div>

                {/* Background decorative element */}
                <div className="absolute -left-6 -top-6 -z-10 h-72 w-72 rounded-full bg-gradient-to-br from-blue-100/60 to-slate-100/40 blur-3xl" />
              </div>
            </div>
          </section>
        </Container>

        <section id="how-it-works" className="border-y border-slate-200 bg-[#F6F5F1] py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Why Choose FlatOrigin</h2>
            <p className="mx-auto mt-3 max-w-lg text-slate-500">Built different from traditional contractor marketplaces</p>
          </div>
          <div className="mx-auto mt-12 max-w-5xl px-4">
            <FeatureStrip />
          </div>
        </section>

        <Container>
          <section className="py-16">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Use FlatOrigin as your public web profile
            </h2>
            <p className="mt-3 max-w-xl text-slate-500">
              Bring scattered project photos, specialties, and service details
              into one clean portfolio page you can share as your website.
            </p>
            <div className="mt-6">
              <WebProfilePreview />
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Find homeowner project opportunities
            </h2>
            <p className="mt-3 max-w-xl text-slate-500">
              Find local opportunities that fit your expertise. Send proposals
              and grow your business.
            </p>
            <div className="mt-6">
              <ProjectFeedPreview />
            </div>
          </section>

          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Communicate without middlemen
            </h2>
            <p className="mt-3 max-w-xl text-slate-500">
              Keep all conversations, proposals, and updates organized in one
              place.
            </p>
            <div className="mt-6">
              <MessagePreview />
            </div>
          </section>

          <section className="relative my-16 min-h-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            <LocalMapPreview />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/30" />
            <div className="relative px-8 py-12">
              <h2 className="max-w-md text-2xl font-bold tracking-tight text-slate-900">
                Built around local work
              </h2>
              <p className="mt-3 max-w-md text-slate-500">
                Connect with homeowners in your area and grow your business
                locally.
              </p>
            </div>
          </section>
        </Container>
      </main>

      <section className="bg-slate-900 py-16">
        <Container>
          <div className="flex flex-col items-center text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to get started?</h2>
            <p className="mt-3 max-w-md text-slate-400">
              Join thousands of homeowners and contractors already using FlatOrigin.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to={primaryCtaPath}>
                <Button className="h-11 bg-white px-6 text-slate-900 hover:bg-slate-100">
                  Join as Contractor
                </Button>
              </Link>
              <Link
                to="/work"
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
                <Link to="/homeowner" className="text-slate-600 hover:text-slate-900">
                  For Homeowners
                </Link>
                <Link to="/contractor" className="text-slate-600 hover:text-slate-900">
                  For Contractors
                </Link>
                <Link to="/work" className="text-slate-600 hover:text-slate-900">
                  Find Work
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                <span className="font-semibold text-slate-900">Resources</span>
                <Link to="/guides" className="text-slate-600 hover:text-slate-900">
                  Guides
                </Link>
                <Link to="/explore" className="text-slate-600 hover:text-slate-900">
                  Browse Projects
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
