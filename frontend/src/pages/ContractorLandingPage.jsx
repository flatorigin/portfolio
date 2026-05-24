import { Link } from "react-router-dom";
import { Badge, Button, Card, Container, SymbolIcon } from "../ui";

const profileImages = [
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=500&q=80",
  "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=500&q=80",
];

const features = [
  ["construction", "Showcase Your Work", "Display completed projects and specialties."],
  ["travel_explore", "Find Local Work", "Browse homeowner projects in your area."],
  ["chat_bubble", "Communicate Directly", "Message homeowners and discuss details."],
  ["handshake", "Get Quality Leads", "Bid on projects that match your skills."],
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
            <Link to="/work" className="rounded-xl px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
              Find Work
            </Link>
            <a href="#how-it-works" className="rounded-xl px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
              How it works
            </a>
            <Link to="/register?role=contractor" className="rounded-xl px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
              Pricing
            </Link>
            <Link to="/guides" className="rounded-xl px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100">
              Guides
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link
              to="/homeowners"
              className="hidden h-9 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:inline-flex"
            >
              Switch to Homeowner
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

function ContractorProfilePreview() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-5">
        <img
          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"
          alt=""
          className="h-24 w-24 rounded-full object-cover"
        />
        <div>
          <div className="text-xl font-semibold text-slate-900">Smith Home Improvements</div>
          <div className="mt-1 text-sm font-medium text-slate-500">Decks - Carpentry - Exterior</div>
          <div className="mt-3 text-sm font-semibold text-slate-600">Media, PA</div>
          <div className="mt-2 text-sm text-slate-500">15+ Projects Completed</div>
        </div>
      </div>
      <Button className="mt-6 h-11 w-full">
        View Profile
      </Button>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {profileImages.map((image) => (
          <img key={image} src={image} alt="" className="h-24 rounded-xl object-cover" />
        ))}
      </div>
    </Card>
  );
}

function FeatureStrip() {
  return (
    <Card id="how-it-works" className="grid overflow-hidden md:grid-cols-4">
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

function ProjectFeedPreview() {
  const rows = [
    ["New Deck Construction", "Media, PA", "$8,000 - $12,000"],
    ["Bathroom Remodel", "Swarthmore, PA", "$8,000 - $16,000"],
    ["Interior Painting", "Springfield, PA", "$3,000 - $8,000"],
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 text-sm font-semibold text-slate-900">Recent Projects</div>
      <div className="mb-4 flex gap-2 text-[11px] font-semibold text-slate-500">
        {["All Categories", "Decks", "Bathrooms", "Kitchens", "Painting"].map((item) => (
          <span key={item} className="rounded-full bg-slate-50 px-3 py-1">
            {item}
          </span>
        ))}
      </div>
      <div className="space-y-4">
        {rows.map(([title, location, budget]) => (
          <div key={title} className="grid grid-cols-[52px_1fr_auto] items-center gap-3">
            <div className="h-12 rounded-lg bg-slate-100" />
            <div>
              <div className="text-sm font-semibold text-slate-900">{title}</div>
              <div className="text-xs text-slate-500">{location}</div>
              <div className="text-xs font-semibold text-slate-600">Budget: {budget}</div>
            </div>
            <span className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700">
              View Details
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function MessagePreview() {
  return (
    <Card className="p-5">
      <div className="mb-4 text-sm font-semibold text-slate-900">Bathroom Remodel</div>
      <div className="space-y-4">
        <div className="ml-auto max-w-[76%] rounded-2xl bg-[#EEF4FF] px-4 py-3 text-sm text-slate-700">
          Can you share more photos of the current bathroom?
        </div>
        <div className="max-w-[78%] rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Sure, here are a few more.
        </div>
        <div className="flex gap-2 pl-3">
          {profileImages.map((image) => (
            <img key={image} src={image} alt="" className="h-14 w-16 rounded-lg object-cover" />
          ))}
        </div>
      </div>
    </Card>
  );
}

function LocalMapPreview() {
  return (
    <Card className="relative min-h-[220px] overflow-hidden bg-slate-100">
      <div className="absolute inset-0 opacity-60">
        <div className="absolute left-0 top-16 h-px w-full rotate-6 bg-white" />
        <div className="absolute left-0 top-32 h-px w-full -rotate-6 bg-white" />
        <div className="absolute left-1/3 top-0 h-full w-px rotate-12 bg-white" />
        <div className="absolute left-2/3 top-0 h-full w-px -rotate-12 bg-white" />
      </div>
      {[
        ["20%", "45%"],
        ["45%", "62%"],
        ["62%", "38%"],
        ["78%", "55%"],
      ].map(([left, top], index) => (
        <span
          key={`${left}-${top}`}
          className="absolute flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg"
          style={{ left, top }}
        >
          <SymbolIcon name={index % 2 ? "location_on" : "person"} fill={1} className="text-[22px]" />
        </span>
      ))}
    </Card>
  );
}

export default function ContractorLandingPage() {
  return (
    <div className="bg-[#FBF9F7] text-slate-900">
      <LandingNav />
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
                Build a focused public profile, showcase completed projects, and bid on homeowner projects directly.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link to="/register?role=contractor">
                  <Button className="h-11 min-w-56">
                    Create Contractor Profile
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
                Browse projects posted by homeowners
              </h2>
              <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
                Find local opportunities that fit your expertise. Send proposals and grow your business.
              </p>
              <Link to="/work" className="mt-5 inline-flex text-sm font-medium text-slate-900">
                Explore Projects {"->"}
              </Link>
            </div>
            <ProjectFeedPreview />
          </section>

          <section className="mt-8 grid gap-8 lg:grid-cols-2">
            <MessagePreview />
            <Card className="p-8">
              <h2 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">
                Communicate without middlemen.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Keep all conversations, proposals, and updates organized in one place.
              </p>
              <Link to="/guides" className="mt-6 inline-flex text-sm font-medium text-slate-900">
                Learn More {"->"}
              </Link>
            </Card>
          </section>

          <section className="mt-8 grid gap-8 lg:grid-cols-[0.55fr_1fr]">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">Built around local work</h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Connect with homeowners in your area and grow your business locally.
              </p>
              <a href="#how-it-works" className="mt-6 inline-flex text-sm font-medium text-slate-900">
                See How It Works {"->"}
              </a>
            </div>
            <LocalMapPreview />
          </section>

          <section className="mt-8 rounded-2xl border border-[#E2DDD4] bg-[#F1ECE4] p-8 sm:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-950">Start building your contractor profile today</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Join FlatOrigin and connect with homeowners looking for your expertise.
                </p>
              </div>
              <div className="text-center">
                <Link to="/register?role=contractor">
                  <Button className="h-11 min-w-56">
                    Join as Contractor
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
          <div>Free to Join</div>
          <div>No Middlemen Fees</div>
          <div>Local Visibility</div>
          <div>Secure and Reliable</div>
        </Container>
      </footer>
    </div>
  );
}
