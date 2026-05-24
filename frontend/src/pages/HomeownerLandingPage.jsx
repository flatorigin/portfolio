import { Link } from "react-router-dom";
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

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <Container className="py-3">
        <nav className="flex items-center gap-6">
          <Link to="/" className="text-base font-bold tracking-tight text-slate-900">
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
              to="/contractors"
              className="hidden h-9 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Switch to Contractor
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
  return (
    <Card className="p-5">
      <div className="text-sm font-semibold text-slate-900">Kitchen Renovation</div>
      <div className="mt-4 flex gap-5 border-b border-slate-100 text-xs font-semibold text-slate-500">
        {["Overview", "Photos", "Files", "Bids", "Messages"].map((tab, index) => (
          <span key={tab} className={index === 0 ? "border-b-2 border-slate-900 pb-2 text-slate-900" : "pb-2"}>
            {tab}
          </span>
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <img
          src="https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=700&q=80"
          alt=""
          className="h-28 w-full rounded-xl object-cover"
        />
        <img
          src="https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=700&q=80"
          alt=""
          className="h-28 w-full rounded-xl object-cover"
        />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 border-b border-slate-100 pb-5 text-sm">
        <div>
          <div className="text-xs font-semibold text-slate-500">Budget</div>
          <div className="mt-1 font-semibold text-slate-900">$15,000 - $25,000</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-500">Status</div>
          <div className="mt-1 font-semibold text-slate-900">Planning</div>
        </div>
      </div>
      <div className="mt-5">
        <div className="text-sm font-semibold text-slate-900">Project Notes</div>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>• Open up the space</li>
          <li>• New cabinets and countertops</li>
          <li>• Better lighting</li>
        </ul>
      </div>
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
                <Link to="/register?role=homeowner">
                  <Button className="h-11 min-w-48">
                    Start a Project
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
                <Link to="/register?role=homeowner">
                  <Button className="h-11 min-w-56">
                    Create Free Account
                  </Button>
                </Link>
                <div className="mt-3 text-xs text-slate-500">
                  {localStorage.getItem("access") ? "Ready to continue? " : "Already have an account? "}
                  <Link to={localStorage.getItem("access") ? "/dashboard" : "/login"} className="font-semibold text-slate-700 hover:text-slate-950">
                    {localStorage.getItem("access") ? "Open dashboard" : "Sign in"}
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
