import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { roleLandingPath } from "../landingRole";
import { Badge, Button, Card, Container, SymbolIcon } from "../ui";
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
            className="text-base font-bold tracking-tight text-slate-900"
          >
            FlatOrigin
          </Link>
          <div className="hidden items-center gap-2 md:flex">
            <Link
              to="/work"
              className="rounded-xl px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Find Work
            </Link>
            <a
              href="#how-it-works"
              className="rounded-xl px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              How it works
            </a>
            <Link
              to="/guides"
              className="rounded-xl px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Guides
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/homeowner"
              title="This toggle is only for viewing/previewing the other landing page."
              className="hidden h-9 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              View Homeowner Side
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

function ContractorProfilePreview() {
  const projects = [
    {
      title: "Deck Build",
      location: "Media, PA",
      specialty: "Carpentry",
      image: profileImages[1],
    },
    {
      title: "Kitchen Finish",
      location: "Media, PA",
      specialty: "Interior",
      image: profileImages[2],
    },
  ];

  return (
    <Card className="grid h-[360px] gap-4 p-5 sm:grid-cols-2">
      {projects.map((project) => (
        <div
          key={project.title}
          className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white"
        >
          <div className="h-40 bg-slate-100">
            <img
              src={project.image}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex min-h-0 flex-1 flex-col justify-center p-4">
            <div className="line-clamp-2 text-base font-semibold leading-snug text-slate-950">
              {project.title}
            </div>
            <div className="mt-2 truncate text-sm font-medium text-slate-500">
              {project.location}
            </div>
            <div className="mt-3 text-sm font-semibold text-slate-700">
              {project.specialty}
            </div>
          </div>
        </div>
      ))}
    </Card>
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
    <Card className="grid gap-4 p-5 sm:grid-cols-2">
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
            className="group flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="h-32 bg-slate-100">
              {cover ? (
                <img
                  src={cover}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  Job posting
                </div>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <div className="line-clamp-2 text-base font-semibold leading-snug text-slate-950">
                {loading && !jobs.length ? "Loading local work..." : job.title}
              </div>
              <div className="mt-2 truncate text-sm font-medium text-slate-500">
                {job.location || "Local project"}
              </div>
              {budget ? (
                <div className="mt-2 text-sm font-semibold text-slate-700">
                  {budget}
                </div>
              ) : null}
              {summary ? (
                <div className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
                  {summary}
                </div>
              ) : null}
            </div>
          </Link>
        );
      })}
    </Card>
  );
}

function FeatureStrip() {
  return (
    <Card id="how-it-works" className="grid overflow-hidden md:grid-cols-4">
      {features.map(([icon, title, copy]) => (
        <div
          key={title}
          className="border-slate-100 p-6 md:border-r md:last:border-r-0"
        >
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

function WebProfilePreview() {
  const portfolioItems = [
    ["Deck rebuild", "Before / after", profileImages[1]],
    ["Kitchen finish", "Completed work", profileImages[2]],
    ["Exterior refresh", "Portfolio photo", profileImages[0]],
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
          FO
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-950">
            Your public web profile
          </div>
          <div className="truncate text-xs text-slate-500">
            Portfolio, service area, specialties, and contact flow
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {portfolioItems.map(([title, label, image]) => (
          <div
            key={title}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <img src={image} alt="" className="h-28 w-full object-cover" />
            <div className="p-3">
              <div className="truncate text-sm font-semibold text-slate-950">
                {title}
              </div>
              <div className="mt-1 truncate text-xs text-slate-500">
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {["Decks", "Carpentry", "Exterior Repairs"].map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
          >
            {tag}
          </span>
        ))}
      </div>
    </Card>
  );
}

function MessagePreview() {
  return (
    <Card className="p-5">
      <div className="mb-4 text-sm font-semibold text-slate-900">
        Bathroom Remodel
      </div>
      <div className="space-y-4">
        <div className="ml-auto max-w-[76%] rounded-2xl bg-[#EEF4FF] px-4 py-3 text-sm text-slate-700">
          Can you share more photos of the current bathroom?
        </div>
        <div className="max-w-[78%] rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Sure, here are a few more.
        </div>
        <div className="flex gap-2 pl-3">
          {bathroomMessageImages.map((image) => (
            <img
              key={image}
              src={image}
              alt=""
              className="h-14 w-16 rounded-lg object-cover"
            />
          ))}
        </div>
      </div>
    </Card>
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
        <Container className="py-10 sm:py-14">
          <section className="grid items-center gap-12 lg:grid-cols-[1fr_0.82fr]">
            <div>
              <Badge className="border-[#E4E6EE] bg-[#F6F7FB] font-semibold uppercase tracking-[0.12em] text-slate-600">
                For contractors
              </Badge>
              <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
                Show real work.
                <br />
                Connect with real homeowners.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
                Build a focused public profile, showcase completed projects, and
                bid on homeowner projects directly.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to={primaryCtaPath}>
                  <Button className="h-11 min-w-56">
                    {primaryCtaLabel}
                  </Button>
                </Link>
                <Link
                  to="/work"
                  className="inline-flex h-11 min-w-44 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Explore Projects
                </Link>
              </div>
            </div>
            <ContractorProfilePreview />
          </section>

          <section className="mt-16">
            <FeatureStrip />
          </section>

          <section className="mt-16 grid gap-8 lg:grid-cols-[0.6fr_1fr]">
            <div>
              <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">
                Use your FlatOrigin profile as a public web profile
              </h2>
              <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
                Bring scattered project photos, specialties, and service details
                into one clean portfolio page you can share as your website.
              </p>
              <Link
                to={authed ? "/onboarding/contractor" : "/register?role=contractor"}
                className="mt-5 inline-flex text-sm font-medium text-slate-900"
              >
                {authed ? "Continue setup" : "Create your profile"} {"->"}
              </Link>
            </div>
            <WebProfilePreview />
          </section>

          <section className="mt-16 grid gap-8 lg:grid-cols-[0.6fr_1fr]">
            <div>
              <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">
                Find homeowner project opportunities
              </h2>
              <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
                Find local opportunities that fit your expertise. Send proposals
                and grow your business.
              </p>
              <Link
                to="/work"
                className="mt-5 inline-flex text-sm font-medium text-slate-900"
              >
                Explore Projects {"->"}
              </Link>
            </div>
            <ProjectFeedPreview />
          </section>

          <section className="mt-8 grid gap-8 lg:grid-cols-[0.6fr_1fr]">
            <div>
              <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">
                Communicate without middlemen.
              </h2>
              <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
                Keep all conversations, proposals, and updates organized in one
                place.
              </p>
              <Link
                to="/guides"
                className="mt-6 inline-flex text-sm font-medium text-slate-900"
              >
                Learn More {"->"}
              </Link>
            </div>
            <MessagePreview />
          </section>

          <section className="relative mt-8 min-h-[260px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 sm:p-10">
            <LocalMapPreview />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/35" />
            <div className="relative max-w-md">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                Built around local work
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Connect with homeowners in your area and grow your business
                locally.
              </p>
              <a
                href="#how-it-works"
                className="mt-6 inline-flex text-sm font-medium text-slate-900"
              >
                See How It Works {"->"}
              </a>
            </div>
          </section>

          <section className="mt-8 rounded-2xl border border-[#E2DDD4] bg-[#F1ECE4] p-8 sm:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">
                  Start building your contractor profile today
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Join FlatOrigin and connect with homeowners looking for your
                  expertise.
                </p>
              </div>
              <div className="text-center">
                <Link to={primaryCtaPath}>
                  <Button className="h-11 min-w-56">
                    {primaryCtaLabel}
                  </Button>
                </Link>
                <div className="mt-3 text-xs text-slate-500">
                  {authed ? "Ready to continue? " : "Already have an account? "}
                  <Link
                    to={authed ? "/work" : "/login"}
                    className="font-semibold text-slate-700 hover:text-slate-950"
                  >
                    {authed ? "Find local work" : "Sign in"}
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </Container>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <Container className="grid max-w-5xl gap-5 text-center text-sm font-semibold text-slate-500 sm:grid-cols-4">
          <div>Free to Join</div>
          <div>No Middlemen Fees</div>
          <div>Local Visibility</div>
          <div>Secure and Reliable</div>
        </Container>
      </footer>
    </div>
  );
}
