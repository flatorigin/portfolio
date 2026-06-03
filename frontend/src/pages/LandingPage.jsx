import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../api";
import { Container, SymbolIcon } from "../ui";
import homeownerIllustration from "../assets/landing/homeowner.webp";
import contractorIllustration from "../assets/landing/contractor.webp";

const roleCards = [
  {
    title: "For Homeowners",
    intro: "Plan your next project and find the right contractor.",
    features: [
      "Save and organize project ideas",
      "Get bids from local contractors",
      "Keep projects private or share publicly",
    ],
    cta: "Get Started as Homeowner",
    to: "/homeowner",
    image: homeownerIllustration,
  },
  {
    title: "For Contractors",
    intro: "Showcase your work and win more projects.",
    features: [
      "Build a professional profile",
      "Display your portfolio",
      "Bid on projects in your area",
    ],
    cta: "Get Started as Contractor",
    to: "/contractor",
    image: contractorIllustration,
  },
];

function GatewayNav() {
  const authed = !!localStorage.getItem("access");

  return (
    <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <Container className="py-4">
        <nav className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-slate-900"
          >
            FlatOrigin
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/explore"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
            >
              Browse Projects
            </Link>
            <Link
              to="/project-check"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
            >
              Project Check
            </Link>
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

function RoleCard({ card }) {
  return (
    <Link to={card.to} className="group block text-inherit no-underline">
      <div className="flex min-h-[480px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-slate-300">
        <div className="aspect-[16/10] overflow-hidden rounded-xl bg-slate-50">
          <img
            src={card.image}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          />
        </div>

        <h2 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
          {card.title}
        </h2>
        <p className="mt-2 text-base leading-relaxed text-slate-600">{card.intro}</p>

        <div className="mt-5 flex-1 space-y-3">
          {card.features.map((feature) => (
            <div key={feature} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <SymbolIcon name="check" className="text-[14px] text-emerald-700" />
              </span>
              <span className="text-sm text-slate-700">{feature}</span>
            </div>
          ))}
        </div>

        <span className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white transition group-hover:bg-slate-800">
          {card.cta}
          <SymbolIcon name="arrow_forward" className="ml-2 text-[18px] transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
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
          <section className="flex min-h-[calc(100vh-200px)] flex-col justify-center py-16 sm:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Find the right contractor for your next project
              </h1>
              <p className="mx-auto mt-6 max-w-lg text-lg leading-relaxed text-slate-600">
                FlatOrigin connects homeowners and contractors around real projects - no middlemen, no hassle.
              </p>
            </div>

            <div className="mx-auto mt-12 grid w-full max-w-4xl gap-6 md:grid-cols-2">
              {roleCards.map((card) => (
                <RoleCard key={card.title} card={card} />
              ))}
            </div>

            <p className="mt-10 flex items-center justify-center gap-2 text-sm text-slate-500">
              <SymbolIcon name="swap_horiz" className="text-[18px]" />
              <span>You can switch between experiences anytime.</span>
            </p>
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
