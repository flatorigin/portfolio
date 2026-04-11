import { Link } from "react-router-dom";
import { Button, Card, Container } from "../ui";

const guideCategories = [
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
    id: "contractors",
    title: "For Contractors",
    intro: "Use your portfolio and bid details to build trust before a homeowner calls.",
    guides: [
      {
        title: "Make your profile easier to hire from",
        points: [
          "Show finished work with clear titles.",
          "Add service area and trade focus.",
          "Use project captions to explain what you did.",
          "Keep contact details and messaging preferences current.",
        ],
      },
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
        title: "Use messaging for clarification",
        points: [
          "Ask project-specific questions before changing your bid.",
          "Keep negotiation tied to the project.",
          "Summarize changes clearly if the owner asks for a revision.",
          "Avoid moving important scope decisions into scattered messages without updating the bid.",
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

const quickChecklists = [
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
];

export default function ProjectGuides() {
  return (
    <div className="bg-[#FBF9F7] pb-20 text-slate-900">
      <section className="border-b border-[#ECE7DF] bg-[radial-gradient(circle_at_top_left,#EEF3FF,transparent_34%),linear-gradient(180deg,#FBF9F7_0%,#F7F3EC_100%)]">
        <Container className="py-14 sm:py-18">
          <div className="max-w-4xl">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F5D83]">
              Project Guides
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              Practical guides for posting better projects and comparing bids.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              Use these checklists and examples to describe work clearly, invite the right contractors, and compare bids with fewer surprises.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/dashboard">
                <Button className="rounded-full bg-[#4F5D83] px-7 py-3 text-base font-semibold hover:bg-[#445273]">
                  Create a project
                </Button>
              </Link>
              <Link
                to="/work"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-7 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
              >
                Browse job postings
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-12 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="rounded-[1.75rem] border-[#E9E5DC] bg-white/85 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Categories
              </div>
              <nav className="mt-4 space-y-2">
                <a
                  href="#why-this-matters"
                  className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-[#F3EFE8] hover:text-slate-950"
                >
                  Why this matters
                </a>
                {guideCategories.map((category) => (
                  <a
                    key={category.id}
                    href={`#${category.id}`}
                    className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-[#F3EFE8] hover:text-slate-950"
                  >
                    {category.title}
                  </a>
                ))}
              </nav>
            </Card>
          </aside>

          <div className="space-y-10">
            <section
              id="why-this-matters"
              className="rounded-[2rem] border border-[#E9E5DC] bg-white/85 p-6 shadow-sm sm:p-8"
            >
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4F5D83]">
                Why this matters
              </div>
              <h2 className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                Find the right help beyond the few people you already know.
              </h2>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
                A clear job post gives homeowners and contractors a better way to match the work to the right skill set. The goal is not to push contractors into lower pricing. The goal is to understand the scope, compare real options, and use the project budget with more confidence.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[#E9E5DC] bg-[#FBF9F7] p-5">
                  <h3 className="text-base font-semibold text-slate-950">
                    Search beyond your circle
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Most people start with only the contractors they already know. Sharing a focused job post helps more relevant professionals understand the work and respond.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E9E5DC] bg-[#FBF9F7] p-5">
                  <h3 className="text-base font-semibold text-slate-950">
                    Use the budget better
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Comparing structured bids helps you see what is included, what is excluded, and which proposal gives the clearest value for the budget.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E9E5DC] bg-[#FBF9F7] p-5">
                  <h3 className="text-base font-semibold text-slate-950">
                    Match the right specialist
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Some projects need a handoff or multiple trades. Clear scope makes it easier for contractors to take the part that fits their skill set and coordinate the rest.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-[#E9E5DC] bg-white/85 p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4F5D83]">
                    Quick checklist
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    Before you ask for bids
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    You do not need every answer before posting, but the more of these you include, the easier it is for contractors to respond seriously.
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {quickChecklists.map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-[#FBF9F7] px-4 py-3 text-sm font-medium text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </section>

            {guideCategories.map((category) => (
              <section key={category.id} id={category.id} className="scroll-mt-28">
                <div className="mb-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#4F5D83]">
                    {category.title}
                  </div>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    {category.intro}
                  </h2>
                </div>

                <div className="grid gap-5">
                  {category.guides.map((guide) => (
                    <Card key={guide.title} className="rounded-[1.75rem] border-[#E9E5DC] bg-white p-6">
                      <h3 className="text-xl font-semibold text-slate-950">{guide.title}</h3>
                      <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
                        {guide.points.map((point) => (
                          <li key={point} className="flex gap-3">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4F5D83]" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  ))}
                </div>
              </section>
            ))}

            <section className="rounded-[2rem] border border-[#E2DDD4] bg-[#F1ECE4] px-6 py-10 text-center sm:px-12">
              <h2 className="text-3xl font-bold tracking-tight text-slate-950">
                Ready to turn the guide into a real project?
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Start with a clear project post, add photos, choose public or private, and invite contractors when you are ready.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to="/dashboard">
                  <Button className="min-w-[180px] rounded-full bg-[#4F5D83] px-8 py-3 text-base font-semibold hover:bg-[#445273]">
                    Create a project
                  </Button>
                </Link>
                <Link
                  to="/explore"
                  className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
                >
                  Browse portfolios first
                </Link>
              </div>
            </section>
          </div>
        </div>
      </Container>
    </div>
  );
}
