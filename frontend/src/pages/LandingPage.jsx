import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Badge, Button, Card, Container } from "../ui";

function toUrl(raw) {
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = base.replace(/\/api\/?$/, "");
  return raw.startsWith("/") ? `${origin}${raw}` : `${origin}/${raw}`;
}

function extractCover(project) {
  if (!project) return "";
  if (project.cover_image_url) return toUrl(project.cover_image_url);
  const images = Array.isArray(project.images) ? project.images : [];
  const first = images[0];
  if (!first) return "";
  return toUrl(first.url || first.image || first.file || "");
}

const FALLBACK_PROJECTS = [
  {
    id: "fallback-1",
    title: "Kitchen remodeling",
    category: "Interior",
    owner_username: "Artin",
    location: "Media, PA",
    summary: "A portfolio-first way to show the craft behind a finished space.",
    cover: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "fallback-2",
    title: "Deck rebuild",
    category: "Outdoor",
    owner_username: "Serdar",
    location: "Philadelphia, PA",
    summary: "Homeowners can post work and compare serious bids side by side.",
    cover: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "fallback-3",
    title: "Bathroom renovation",
    category: "Renovation",
    owner_username: "Nima",
    location: "Toronto, ON",
    summary: "Keep project questions, bids, and follow-up in one place.",
    cover: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  },
  {
    id: "fallback-4",
    title: "Custom fireplace",
    category: "Interior",
    owner_username: "Leila",
    location: "Austin, TX",
    summary: "Real work speaks louder than a resume or a cold outreach email.",
    cover: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  },
];

function TutorialModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">Video tutorial</div>
            <div className="text-sm text-slate-500">A quick walkthrough of the platform flow.</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            aria-label="Close video tutorial"
          >
            ×
          </button>
        </div>
        <div className="p-6">
          <div className="flex aspect-video items-center justify-center rounded-[1.5rem] border border-dashed border-slate-300 bg-[#F3EFE8] text-center text-slate-600">
            <div className="max-w-md px-6">
              <div className="text-lg font-semibold text-slate-900">Tutorial placeholder</div>
              <p className="mt-2 text-sm leading-relaxed">
                Drop in a YouTube, Vimeo, or self-hosted video URL here later. The modal is already set up so you can
                swap the placeholder for the final player without changing the page layout.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShowcaseCard({ project }) {
  const cover = project.cover || extractCover(project);
  return (
    <Link
      to={typeof project.id === "number" ? `/projects/${project.id}` : "/explore"}
      className="group overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="aspect-[4/3] bg-slate-100">
        {cover ? (
          <img src={cover} alt={project.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">Project preview</div>
        )}
      </div>
      <div className="space-y-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          {project.category ? <Badge className="border-[#E4E6EE] bg-[#F6F7FB] text-slate-700">{project.category}</Badge> : null}
          {project.owner_username ? <Badge className="border-[#E4E6EE] bg-white text-slate-500">by {project.owner_username}</Badge> : null}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{project.title}</h3>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
            {project.summary || "Browse real work, compare details, and decide with more clarity."}
          </p>
        </div>
        <div className="text-sm font-medium text-slate-500">{project.location || "Project showcase"}</div>
      </div>
    </Link>
  );
}

export default function LandingPage() {
  const authed = !!localStorage.getItem("access");
  const [projects, setProjects] = useState([]);
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await api.get("/projects/");
        if (cancelled) return;
        const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
        const curated = list
          .filter((p) => (p?.is_public === undefined || p?.is_public) && !p?.is_job_posting)
          .filter((p) => !!extractCover(p))
          .slice(0, 6);
        setProjects(curated);
      } catch {
        if (!cancelled) setProjects([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const showcaseProjects = projects.length > 0 ? projects : FALLBACK_PROJECTS;
  const heroProjects = showcaseProjects.slice(0, 3);

  const metrics = useMemo(() => {
    const totalProjects = showcaseProjects.length;
    const ownerCount = new Set(
      showcaseProjects.map((p) => String(p.owner_username || "").trim()).filter(Boolean)
    ).size;

    return [
      { value: totalProjects || 12, label: "Projects shared", note: "Real work, not abstract profiles." },
      { value: ownerCount || 8, label: "Contractors featured", note: "Built around portfolios and service areas." },
      { value: 6, label: "Bids per job", note: "Keep comparisons serious and manageable." },
    ];
  }, [showcaseProjects]);

  return (
    <div className="bg-[#FBF9F7] pb-20 text-slate-900">
      <TutorialModal open={videoOpen} onClose={() => setVideoOpen(false)} />

      <section className="relative overflow-hidden border-b border-[#ECE7DF] bg-[radial-gradient(circle_at_top,#EEF3FF,transparent_42%),linear-gradient(180deg,#FBF9F7_0%,#F7F3EC_100%)]">
        <Container className="pt-12 pb-12 sm:pt-16 sm:pb-16">
          <div className="mx-auto max-w-4xl text-center">
            <Badge className="border-[#D9E2F4] bg-white/80 px-4 py-1 text-[#4F5D83] shadow-sm backdrop-blur-sm">
              For homeowners and contractors working from real projects
            </Badge>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              Show your work. Compare bids. Hire with more clarity.
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              Portfolio helps homeowners discover real project work, invite contractors, and compare structured bids
              without jumping across disconnected tools.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to={authed ? "/dashboard" : "/register"}>
                <Button className="min-w-[180px] rounded-full bg-[#4F5D83] px-8 py-3 text-base font-semibold hover:bg-[#445273]">
                  Get Started
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setVideoOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-white/60"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-900">
                  ▶
                </span>
                Watch a video tutorial
              </button>
            </div>
          </div>

          <div className="mt-12 rounded-[2rem] border border-[#E7E2D8] bg-white/70 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-4">
            <div className="grid gap-3 md:grid-cols-[1.1fr_1.4fr_1.1fr]">
              {heroProjects.map((project, idx) => (
                <div
                  key={project.id || idx}
                  className={
                    "overflow-hidden rounded-[1.5rem] bg-slate-100 " +
                    (idx === 1 ? "aspect-[16/10]" : "aspect-[4/5] md:aspect-[4/4]")
                  }
                >
                  {extractCover(project) || project.cover ? (
                    <img
                      src={extractCover(project) || project.cover}
                      alt={project.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">Project preview</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="border-b border-[#ECE7DF] py-6 sm:py-8">
        <Container>
          <div className="grid gap-4 sm:grid-cols-3">
            {metrics.map((item) => (
              <div key={item.label} className="rounded-[1.5rem] border border-[#E9E5DC] bg-white/80 px-5 py-5">
                <div className="text-3xl font-semibold tracking-tight text-slate-950">{item.value}</div>
                <div className="mt-1 text-sm font-semibold text-slate-700">{item.label}</div>
                <div className="mt-1 text-sm text-slate-500">{item.note}</div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section id="how-it-works" className="py-16 sm:py-20">
        <Container>
          <div className="max-w-2xl">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F5D83]">How it works</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              A simple workflow built around real projects
            </h2>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              ["01", "Create your profile", "Show your work and build trust."],
              ["02", "Get discovered or invite contractors", "Support both public and private job workflows."],
              ["03", "Receive bids and connect", "Compare, message, and move forward."],
            ].map(([step, title, copy]) => (
              <Card key={step} className="rounded-[1.75rem] border-[#E9E5DC] p-6">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#EEF2FB] text-sm font-semibold text-[#4F5D83]">
                  {step}
                </div>
                <h3 className="mt-5 text-xl font-semibold text-slate-900">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section className="border-y border-[#ECE7DF] bg-white/70 py-16 sm:py-20">
        <Container>
          <div className="max-w-2xl">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F5D83]">Core value</div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Built for project decisions, not generic profiles
            </h2>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              ["Portfolio-first hiring", "No resumes. No guesswork. Just real work."],
              ["Structured bidding", "Compare up to 6 serious contractors per project."],
              ["Project-based communication", "Keep conversations tied to the project."],
            ].map(([title, copy]) => (
              <Card key={title} className="rounded-[1.75rem] border-[#E9E5DC] bg-white p-6">
                <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
              </Card>
            ))}
          </div>
        </Container>
      </section>

      <section id="showcase" className="py-16 sm:py-20">
        <Container>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F5D83]">Project showcase</div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Browse the kind of work people actually hire from
              </h2>
            </div>
            <Link to="/explore" className="text-sm font-medium text-slate-600 hover:text-slate-950">
              Explore more projects →
            </Link>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {showcaseProjects.slice(0, 4).map((project, idx) => (
              <ShowcaseCard key={project.id || idx} project={project} />
            ))}
          </div>
        </Container>
      </section>

      <section className="py-8 sm:py-12">
        <Container>
          <div className="rounded-[2rem] border border-[#E2DDD4] bg-[#F1ECE4] px-6 py-10 text-center sm:px-12">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Start your first project today</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Build a portfolio, invite the right contractor, or post a job and compare bids in one place.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to={authed ? "/dashboard" : "/register"}>
                <Button className="min-w-[180px] rounded-full bg-[#4F5D83] px-8 py-3 text-base font-semibold hover:bg-[#445273]">
                  Get Started
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setVideoOpen(true)}
                className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
              >
                Watch video tutorial
              </button>
            </div>
          </div>
        </Container>
      </section>

      <footer className="border-t border-[#E7E1D7] py-8">
        <Container className="flex flex-col gap-4 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>Portfolio by FlatOrigin</div>
          <div className="flex flex-wrap items-center gap-4">
            <a href="#showcase" className="hover:text-slate-900">About</a>
            <a href="#how-it-works" className="hover:text-slate-900">How it works</a>
            <Link to="/register" className="hover:text-slate-900">Contact</Link>
            <Link to="/register" className="hover:text-slate-900">Terms</Link>
            <Link to="/register" className="hover:text-slate-900">Privacy</Link>
          </div>
        </Container>
      </footer>
    </div>
  );
}
