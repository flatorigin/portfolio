import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import { Button, Container } from "../ui";

const homeownerGuideCategories = [
  {
    id: "planning",
    title: "Planning a Project",
    intro: "Get the job clear before you ask anyone to price it.",
    guides: [
      {
        title: "Write a clear project summary",
        points: [
          "Name the room or area involved, such as kitchen, deck, bath, flooring, or exterior.",
          "Describe what should change, not just what is broken.",
          "Add the result you want: repair, replace, refinish, install, or full remodel.",
          "Mention if the work is urgent or tied to another project.",
        ],
      },
      {
        title: "Add useful measurements",
        points: [
          "Include square footage when you know it.",
          "For linear work, include approximate length, width, or number of units.",
          "For rooms, include the room count and whether furniture or fixtures need to move.",
          "If you are not sure, say that the measurement is approximate.",
        ],
      },
      {
        title: "Decide what is included",
        points: [
          "Say whether materials are included or contractor-supplied.",
          "Mention cleanup, disposal, moving items, protection, and patching.",
          "Call out finishes, brands, special details, or matching existing work.",
          "If you expect permits, inspections, or licensed work, say that clearly.",
        ],
      },
    ],
  },
  {
    id: "posting",
    title: "Creating a Better Job Post",
    intro: "Better information helps contractors send better bids.",
    guides: [
      {
        title: "What every job post should include",
        points: [
          "Project title and a short summary.",
          "Location or service area.",
          "Budget range if you have one.",
          "Photos that show the current condition.",
          "Expected timeline or deadline.",
          "Any known constraints, such as access, parking, permits, or building rules.",
        ],
      },
      {
        title: "Public vs private job posts",
        points: [
          "Use public job posts when you want multiple contractors to discover and bid.",
          "Use private invites when you already know who you want to ask.",
          "Private jobs should include enough detail for the invited contractor to respond without guessing.",
          "Avoid sending the same vague private request to many people.",
        ],
      },
      {
        title: "Photos that help bidding",
        points: [
          "Use wide shots to show the whole area.",
          "Add close-ups of damage, corners, seams, fixtures, or hidden problem areas.",
          "Include at least one photo that shows scale.",
          "Do not rely on inspiration images alone. Show the real space too.",
        ],
      },
    ],
  },
  {
    id: "bids",
    title: "Understanding Bids",
    intro: "Compare scope, timing, and terms, not just the lowest number.",
    guides: [
      {
        title: "How to compare two bids",
        points: [
          "Check if both bids cover the same scope.",
          "Compare what is included and excluded.",
          "Look at payment terms and timeline.",
          "Check whether materials, cleanup, permits, and disposal are clearly addressed.",
          "Ask for revision if the bid is missing an important detail.",
        ],
      },
      {
        title: "Fixed price vs estimate range",
        points: [
          "Fixed price is clearer when the scope is already known.",
          "Estimate range is useful when hidden conditions could change the final cost.",
          "A range should explain what could make the price move up or down.",
          "If a range is too wide, ask the contractor what information would narrow it.",
        ],
      },
      {
        title: "What to ask before accepting",
        points: [
          "What is included in the bid?",
          "What is excluded?",
          "Who handles materials?",
          "Who handles permits or inspections?",
          "What is the expected schedule?",
          "How are deposits and payments handled?",
        ],
      },
    ],
  },
  {
    id: "project-helpers",
    title: "Using Project Helpers",
    intro: "Use local extra hands for support work without treating FlatOrigin as the hiring party.",
    guides: [
      {
        title: "When a project helper may be useful",
        points: [
          "Consider helpers for cleanup, material moving, demolition support, painting prep, landscaping help, or one-day project support.",
          "Use helpers for simple extra-hand needs, not work that requires a licensed contractor, permit holder, or professional trade responsibility.",
          "Keep the main contractor scope separate from helper tasks so responsibilities stay clear.",
          "Confirm availability, timing, payment, and expectations directly before anyone starts work.",
        ],
      },
      {
        title: "How to contact helpers responsibly",
        points: [
          "Use the phone or email shown on the helper listing and communicate directly outside FlatOrigin.",
          "Ask what types of work they are comfortable doing and what tools, transportation, or supervision they need.",
          "Confirm whether the helper is available for weekdays, evenings, weekends, part-time, full-time, or one-day help.",
          "Do not assume insurance, licensing, background checks, or work quality have been verified by FlatOrigin.",
        ],
      },
      {
        title: "What to clarify before hiring extra help",
        points: [
          "Write down the task, expected hours, location, rate, payment timing, and who provides tools or materials.",
          "Confirm site access, parking, cleanup expectations, safety limitations, and who is supervising the work.",
          "If the work touches electrical, plumbing, roofing, structural framing, permits, or hazardous material, confirm whether a licensed professional is required.",
          "FlatOrigin only displays the directory listing. Hiring, payment, agreements, and disputes happen directly between you and the helper.",
        ],
      },
    ],
  },
  {
    id: "examples",
    title: "Example Job Posts",
    intro: "A clear post helps contractors understand the work faster.",
    guides: [
      {
        title: "Weak flooring post",
        points: [
          "Need new floors. Looking for prices.",
          "Why it is weak: no material, area, timeline, photos, or scope.",
        ],
      },
      {
        title: "Better flooring post",
        points: [
          "Replace about 700 sq ft of hardwood flooring on the first floor.",
          "Existing flooring should be removed and hauled away.",
          "Homeowner is considering white oak or similar material.",
          "Work should include installation, basic trim touch-up, and cleanup.",
          "Target timeline is within 3 to 5 weeks.",
        ],
      },
      {
        title: "Better bathroom post",
        points: [
          "Repaint bathroom walls and ceiling, repair small wall patches, and repaint trim.",
          "Bathroom is about 8 ft by 10 ft.",
          "Materials can be contractor-supplied if included in bid.",
          "Homeowner needs cleanup included and wants work completed in one week if possible.",
        ],
      },
    ],
  },
];

const contractorGuideCategories = [
  {
    id: "profile",
    title: "Build a Strong Profile",
    intro: "Make it easy for homeowners to understand what you do and where you work.",
    guides: [
      {
        title: "Make your profile easier to hire from",
        points: [
          "Use a clear business or display name.",
          "Add service area and trade focus.",
          "Show finished work with clear project titles.",
          "Use captions to explain what you did and what problem you solved.",
          "Keep contact details and messaging preferences current.",
        ],
      },
      {
        title: "Choose useful specialties",
        points: [
          "Use specialties homeowners actually search for, such as decks, flooring, painting, kitchens, trim, or fencing.",
          "Avoid listing every possible task if it weakens the focus of your profile.",
          "Put your strongest services first.",
          "Match specialties to the type of work shown in your portfolio.",
        ],
      },
      {
        title: "Show work that builds confidence",
        points: [
          "Use clear before, during, and after photos when possible.",
          "Keep the cover image focused on the finished result.",
          "Add enough context for the homeowner to understand the scope.",
          "Avoid using only inspiration images. Real completed work is stronger.",
        ],
      },
    ],
  },
  {
    id: "bidding",
    title: "Bidding on Projects",
    intro: "Use clear bid details to help homeowners compare without guessing.",
    guides: [
      {
        title: "Write a bid homeowners can compare",
        points: [
          "Use a realistic price type.",
          "Explain your approach in plain language.",
          "List what is included and excluded.",
          "Give a timeline you can stand behind.",
          "Add payment terms and a valid-until date.",
        ],
      },
      {
        title: "Ask before you price unclear work",
        points: [
          "Ask for missing measurements, photos, access details, or finish expectations.",
          "Separate unknown conditions from known scope.",
          "Explain what could change the final price.",
          "Update the bid if the homeowner clarifies the scope.",
        ],
      },
      {
        title: "Keep scope and price connected",
        points: [
          "Make sure the price matches the exact work described.",
          "Call out material assumptions.",
          "Mention cleanup, disposal, and protection if they are included.",
          "Do not bury important exclusions in vague language.",
        ],
      },
    ],
  },
  {
    id: "messaging",
    title: "Project Communication",
    intro: "Keep conversations tied to the project so decisions stay organized.",
    guides: [
      {
        title: "Use messaging for clarification",
        points: [
          "Ask project-specific questions before changing your bid.",
          "Keep negotiation tied to the project.",
          "Summarize changes clearly if the owner asks for a revision.",
          "Avoid moving important scope decisions into scattered messages without updating the bid.",
        ],
      },
      {
        title: "Send helpful follow-ups",
        points: [
          "Confirm the next step after a homeowner replies.",
          "Keep scheduling notes specific.",
          "Reference the project area, materials, or requested scope so the message is easy to connect.",
          "Use short, direct messages when a decision is needed.",
        ],
      },
      {
        title: "Protect trust before the first visit",
        points: [
          "Be clear about whether the first visit is free or paid.",
          "Mention what information you need before visiting.",
          "Avoid overpromising before seeing hidden conditions.",
          "Keep your profile, photos, and bid details consistent.",
        ],
      },
    ],
  },
  {
    id: "local-work",
    title: "Finding Local Work",
    intro: "Use location and specialty focus to find projects that match your business.",
    guides: [
      {
        title: "Focus on the right service area",
        points: [
          "Keep your location and service area accurate.",
          "Prioritize projects that fit your travel range.",
          "Use your profile text to explain where you usually work.",
          "Update your location if your business moves or expands.",
        ],
      },
      {
        title: "Choose projects that fit your strengths",
        points: [
          "Match the project category to your strongest specialties.",
          "Look for posts with enough detail to price responsibly.",
          "Ask follow-up questions when photos or measurements are missing.",
          "Pass on work that does not fit your license, insurance, or trade focus.",
        ],
      },
    ],
  },
  {
    id: "project-helpers",
    title: "Working With Project Helpers",
    intro: "Use helpers as extra support while keeping scope, responsibility, and payment clear.",
    guides: [
      {
        title: "When helpers can support your work",
        points: [
          "Use helpers for extra hands on cleanup, material moving, prep, demolition support, landscaping help, or other non-specialized support tasks.",
          "Keep helpers separate from licensed or insured trade work unless you are directly supervising and the arrangement is appropriate for the job.",
          "Do not use helper listings as a substitute for employees, subcontractor agreements, insurance review, or required licensing.",
          "Confirm whether the helper is available for the schedule, site conditions, and physical requirements before relying on them.",
        ],
      },
      {
        title: "Set expectations before bringing someone to a site",
        points: [
          "Explain the task, location, expected hours, tools needed, who supervises the work, and how payment will happen.",
          "Clarify safety rules, site access, parking, cleanup, and what the helper should not touch.",
          "Keep communication and payment direct between you and the helper. FlatOrigin does not manage scheduling, payroll, contracts, or disputes.",
          "If a helper will be near active construction work, make sure the site lead understands who is responsible for supervision and safety.",
        ],
      },
      {
        title: "Protect your reputation",
        points: [
          "Only bring helpers onto projects when the homeowner understands their role.",
          "Do not let helper tasks blur the scope or quality standard of your contractor bid.",
          "If the work requires a licensed trade, permit, or specialized insurance, use the appropriate professional instead of general help.",
          "Keep the project owner informed if extra help changes the schedule, access needs, or site expectations.",
        ],
      },
    ],
  },
];

const homeownerQuickChecklists = [
  "Project summary",
  "Current photos",
  "Location",
  "Approximate size",
  "Budget or budget range",
  "Timeline",
  "Required expertise",
  "Permit notes",
  "Materials expectation",
  "Cleanup and disposal",
  "Helper tasks, if extra hands are needed",
  "Direct contact and payment expectations",
];

const contractorQuickChecklists = [
  "Service area",
  "Trade focus",
  "Completed project photos",
  "Project captions",
  "Specialties",
  "Bid scope",
  "Included work",
  "Excluded work",
  "Timeline",
  "Payment terms",
  "Helper support tasks",
  "Site supervision expectations",
];

const guideCopy = {
  homeowner: {
    eyebrow: "Homeowner Guides",
    title: "Practical guides for posting better projects and comparing bids.",
    intro:
      "Use these checklists and examples to describe work clearly, invite the right contractors, and compare bids with fewer surprises.",
    primaryCta: "Create a project",
    secondaryCta: "Browse job postings",
    secondaryTo: "/work",
    whyTitle: "Find the right help beyond the few people you already know.",
    whyCopy:
      "A clear job post gives homeowners and contractors a better way to match the work to the right skill set. The goal is not to push contractors into lower pricing. The goal is to understand the scope, compare real options, and use the project budget with more confidence.",
    whyCards: [
      [
        "Search beyond your circle",
        "Most people start with only the contractors they already know. Sharing a focused job post helps more relevant professionals understand the work and respond.",
      ],
      [
        "Use the budget better",
        "Comparing structured bids helps you see what is included, what is excluded, and which proposal gives the clearest value for the budget.",
      ],
      [
        "Match the right specialist",
        "Some projects need a handoff or multiple trades. Clear scope makes it easier for contractors to take the part that fits their skill set and coordinate the rest.",
      ],
      [
        "Use helpers for extra hands",
        "Project Helpers can support simple tasks like cleanup, moving materials, prep, or one-day help while you keep hiring and payment direct.",
      ],
    ],
    checklistTitle: "Before you ask for bids",
    checklistCopy:
      "You do not need every answer before posting, but the more of these you include, the easier it is for contractors to respond seriously.",
    finalTitle: "Ready to turn the guide into a real project?",
    finalCopy:
      "Start with a clear project post, add photos, choose public or private, and invite contractors when you are ready.",
    finalLink: "Browse portfolios first",
    finalLinkTo: "/explore",
  },
  contractor: {
    eyebrow: "Contractor Guides",
    title: "Practical guides for building trust and winning better-fit work.",
    intro:
      "Use these checklists to sharpen your profile, explain your bids clearly, and keep project communication organized.",
    primaryCta: "Open dashboard",
    secondaryCta: "Find local work",
    secondaryTo: "/work",
    whyTitle: "Make your work easier for homeowners to trust.",
    whyCopy:
      "A focused contractor profile and clear bid details help homeowners understand what you do, where you work, and how your proposal compares. The goal is to present real work clearly and avoid confusion before a project starts.",
    whyCards: [
      [
        "Lead with real work",
        "Completed project photos and captions show what you can actually do, not just a list of services.",
      ],
      [
        "Make bids easier to compare",
        "Clear scope, timeline, terms, and exclusions help homeowners understand the value of your proposal.",
      ],
      [
        "Stay local and relevant",
        "Accurate service areas and specialties help you focus on projects that fit your business.",
      ],
      [
        "Use helpers carefully",
        "Project Helpers can be useful for extra support, but you remain responsible for scope, safety, payment, and supervision on your jobs.",
      ],
    ],
    checklistTitle: "Before you send a bid",
    checklistCopy:
      "A stronger profile and cleaner proposal make it easier for homeowners to respond seriously.",
    finalTitle: "Ready to turn the guide into your next project?",
    finalCopy:
      "Keep your profile current, browse local work, and send clear bids when the project fits your business.",
    finalLink: "View local projects",
    finalLinkTo: "/work",
  },
};

export default function ProjectGuides() {
  const { audience } = useParams();
  const [profileType, setProfileType] = useState("");

  const explicitAudience =
    audience === "contractors"
      ? "contractor"
      : audience === "homeowners"
      ? "homeowner"
      : "";

  useEffect(() => {
    if (explicitAudience || !localStorage.getItem("access")) {
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
  }, [explicitAudience]);

  const guideAudience = explicitAudience || (profileType === "contractor" ? "contractor" : "homeowner");
  const categories = useMemo(
    () => (guideAudience === "contractor" ? contractorGuideCategories : homeownerGuideCategories),
    [guideAudience]
  );
  const quickChecklists =
    guideAudience === "contractor" ? contractorQuickChecklists : homeownerQuickChecklists;
  const copy = guideCopy[guideAudience];

  return (
    <div className="pb-20 text-slate-900">
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-transparent">
        <Container className="py-14 sm:py-18">
          <div className="max-w-4xl">
            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
              {copy.eyebrow}
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              {copy.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              {copy.intro}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/dashboard">
                <Button className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold hover:bg-slate-800">
                  {copy.primaryCta}
                </Button>
              </Link>
              <Link
                to={copy.secondaryTo}
                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {copy.secondaryCta}
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-12 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-md">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                Categories
              </div>
              <nav className="mt-4 space-y-1">
                <a
                  href="#why-this-matters"
                  className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  Why this matters
                </a>
                {categories.map((category) => (
                  <a
                    key={category.id}
                    href={`#${category.id}`}
                    className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    {category.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <div className="space-y-10">
            <section
              id="why-this-matters"
              className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-md sm:p-8"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                Why this matters
              </div>
              <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {copy.whyTitle}
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                {copy.whyCopy}
              </p>
              <div className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {copy.whyCards.map(([title, text], index) => (
                  <div
                    key={title}
                    className="flex gap-4 border-b border-slate-200 p-5 last:border-b-0 sm:items-start"
                  >
                    <div className="flex shrink-0 flex-col items-center gap-3">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="h-full min-h-10 w-px bg-slate-200" />
                    </div>
                    <div className="min-w-0 sm:grid sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-6">
                      <h3 className="text-[15px] font-bold leading-5 text-slate-950">
                        {title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600 sm:mt-0">
                        {text}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-md sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Quick checklist
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    {copy.checklistTitle}
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    {copy.checklistCopy}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {quickChecklists.map((item) => (
                  <div key={item} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm font-medium text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </section>

            {categories.map((category) => (
              <section key={category.id} id={category.id} className="scroll-mt-28">
                <div className="mb-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    {category.title}
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                    {category.intro}
                  </h2>
                </div>

                <div className="grid gap-4">
                  {category.guides.map((guide) => (
                    <div key={guide.title} className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-sm backdrop-blur-md">
                      <h3 className="text-lg font-semibold text-slate-900">{guide.title}</h3>
                      <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
                        {guide.points.map((point) => (
                          <li key={point} className="flex gap-3">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <section className="rounded-2xl border border-slate-200 bg-slate-100 px-6 py-10 text-center sm:px-12">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {copy.finalTitle}
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                {copy.finalCopy}
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/dashboard">
                  <Button className="min-w-[180px] rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold hover:bg-slate-800">
                    {copy.primaryCta}
                  </Button>
                </Link>
                <Link
                  to={copy.finalLinkTo}
                  className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                >
                  {copy.finalLink}
                </Link>
                <Link
                  to="/project-helpers"
                  className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
                >
                  View Project Helpers
                </Link>
              </div>
            </section>
          </div>
        </div>
      </Container>
    </div>
  );
}
