import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import api from "../api";
import { Button, Container, SymbolIcon } from "../ui";
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
    cta: "Get Started",
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
    cta: "Get Started",
    to: "/contractor",
    image: contractorIllustration,
  },
];

const whyFeatures = [
  ["shield", "No Middlemen", "Connect directly with homeowners or contractors without paying referral fees or commissions."],
  ["payments", "Free to Use", "FlatOrigin is completely free for homeowners. Contractors pay no listing fees."],
  ["schedule", "Save Time", "Streamlined process helps you find the right match faster than traditional methods."],
  ["star", "Quality Focus", "Detailed project descriptions and portfolios ensure better matches and outcomes."],
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
            {!authed ? (
              <Link
                to="/register"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Get Started
              </Link>
            ) : null}
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
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{card.intro}</p>

          <div className="mt-4 flex-1 space-y-2">
            {card.features.map((feature) => (
              <div key={feature} className="flex items-start gap-2">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-50">
                  <SymbolIcon name="check" className="text-[12px] text-red-400" />
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
        <Container className="py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Find the right contractor for your next project
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-slate-500">
              FlatOrigin connects homeowners and contractors around real projects - no middlemen, no hassle.
            </p>
          </div>

          <div className="mx-auto mt-10 grid w-full max-w-3xl gap-5 sm:grid-cols-2">
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
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Why Choose FlatOrigin</h2>
          <p className="mx-auto mt-3 max-w-lg text-slate-500">Built different from traditional contractor marketplaces</p>
        </div>
        <div className="mx-auto mt-12 grid max-w-5xl gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4">
          {whyFeatures.map(([icon, title, copy]) => (
            <div key={title} className="text-center">
              <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-400">
                <SymbolIcon name={icon} className="text-[24px]" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-900 py-16">
        <Container>
          <div className="flex flex-col items-center text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Ready to get started?</h2>
            <p className="mt-3 max-w-md text-slate-400">
              Join thousands of homeowners and contractors already using FlatOrigin.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/homeowner">
                <Button className="h-11 bg-white px-6 text-slate-900 hover:bg-slate-100">
                  Post Your Project
                </Button>
              </Link>
              <Link
                to="/contractor"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-600 px-6 text-sm font-medium text-white transition hover:border-slate-500 hover:bg-slate-800"
              >
                Join as Contractor
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
