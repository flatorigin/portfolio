import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../api";
import { Card, Container, SymbolIcon } from "../ui";
import homeownerIllustration from "../assets/landing/homeowner.webp";
import contractorIllustration from "../assets/landing/contractor.webp";

const roleCards = [
  {
    title: "For homeowners",
    intro: "Plan projects with more clarity.",
    features: ["Save project ideas", "Compare contractor bids", "Private or public posting"],
    cta: "Continue as Homeowner",
    to: "/homeowner",
    image: homeownerIllustration,
  },
  {
    title: "For contractors",
    intro: "Show your work professionally.",
    features: ["Public contractor profile", "Portfolio showcase", "Bid on local projects"],
    cta: "Continue as Contractor",
    to: "/contractor",
    image: contractorIllustration,
  },
];

function GatewayNav() {
  const authed = !!localStorage.getItem("access");

  return (
    <header className="border-b border-slate-200 bg-white">
      <Container className="py-3">
        <nav className="flex items-center justify-between gap-4">
          <Link to="/" className="text-base font-bold tracking-tight text-slate-900">
            FlatOrigin
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/explore"
              className="hidden rounded-xl px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 sm:inline-flex"
            >
              Browse Projects
            </Link>
            <Link
              to={authed ? "/dashboard" : "/login"}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {authed ? "Dashboard" : "Sign in"}
            </Link>
          </div>
        </nav>
      </Container>
    </header>
  );
}

function RoleCard({ card }) {
  return (
    <Link
      to={card.to}
      className="group block text-inherit no-underline"
    >
      <Card className="flex min-h-[470px] flex-col overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
        <div className="aspect-[16/10] overflow-hidden rounded-xl bg-white">
          <img
            src={card.image}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        </div>

        <h2 className="mt-6 text-2xl font-bold leading-tight tracking-tight text-slate-900">
          {card.title}
        </h2>
        <p className="mt-3 text-base leading-7 text-slate-600">{card.intro}</p>

        <div className="mt-6 space-y-3 text-sm font-medium text-slate-700">
          {card.features.map((feature) => (
            <div key={feature} className="flex items-center gap-2">
              <SymbolIcon name="check" className="text-[18px] text-slate-700" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        <span className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-medium text-white transition group-hover:opacity-90">
          {card.cta}
        </span>
      </Card>
    </Link>
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
        <Container>
          <section className="flex min-h-[calc(100vh-170px)] flex-col justify-center py-12 sm:py-16">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
                Post real projects.
                <br />
                Find real work.
                <br />
                Connect directly.
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600">
                FlatOrigin helps homeowners and contractors connect around real projects without middlemen.
              </p>
            </div>

            <div className="mx-auto mt-10 grid w-full gap-5 md:grid-cols-2">
              {roleCards.map((card) => (
                <RoleCard key={card.title} card={card} />
              ))}
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500">
              <SymbolIcon name="lock" className="text-[18px]" />
              <span>You can switch between experiences anytime.</span>
            </div>
          </section>
        </Container>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <Container className="flex flex-col gap-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="font-bold text-slate-900">
            FlatOrigin
          </Link>
          <div className="flex flex-wrap gap-4">
            <Link to="/homeowner" className="hover:text-slate-900">
              About
            </Link>
            <Link to="/homeowner#how-it-works" className="hover:text-slate-900">
              How it works
            </Link>
            <Link to="/guides" className="hover:text-slate-900">
              Guides
            </Link>
            <Link to="/register" className="hover:text-slate-900">
              Contact
            </Link>
          </div>
        </Container>
        <div className="pb-6 text-center text-xs text-slate-400">© 2026 FlatOrigin. All rights reserved.</div>
      </footer>
    </div>
  );
}
