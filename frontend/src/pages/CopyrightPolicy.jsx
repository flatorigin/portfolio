import { Link } from "react-router-dom";
import { Card, Container } from "../ui";

const sections = [
  {
    title: "Copyright and DMCA policy",
    body: [
      "FlatOrigin expects users to upload only material they have the right to use, display, and share.",
      "If you believe content on the platform infringes your copyright, you can submit a notice for review and takedown handling.",
    ],
  },
  {
    title: "What a notice should include",
    body: [
      "Your name and contact information.",
      "A description of the copyrighted work you believe is being infringed.",
      "The URL or specific platform location of the material you want reviewed.",
      "A statement that you have a good-faith belief the use is not authorized by the copyright owner, its agent, or the law.",
      "A statement that the information in your notice is accurate and that you are authorized to act on behalf of the copyright owner, where applicable.",
    ],
  },
  {
    title: "How FlatOrigin may respond",
    body: [
      "FlatOrigin may review the notice, request more information, remove or disable access to the reported material, preserve internal records, and notify the affected user where appropriate.",
      "In urgent or clearly supported cases, content may be restricted before a longer review is completed.",
      "FlatOrigin may also take account-level action when a complaint points to repeated misuse, misrepresentation, or repeat infringement.",
    ],
  },
  {
    title: "Repeat infringer handling",
    body: [
      "Accounts associated with repeated copyright complaints, repeated unauthorized uploads, or repeated misuse of another person’s plans, photos, branding, or portfolio work may be frozen, restricted, or permanently removed.",
      "FlatOrigin may retain internal records of copyright notices, takedown actions, related reports, and prior warnings to support repeat-infringer enforcement.",
    ],
  },
  {
    title: "Where to send a notice",
    body: [
      "Send copyright notices to copyright@flatorigin.com or through the linked intake form when available.",
      "A notice should include enough detail for FlatOrigin to identify the reported material, contact the claimant, and evaluate the request.",
    ],
  },
];

export default function CopyrightPolicy() {
  return (
    <div className="bg-[#FBF9F7] pb-20 text-slate-900">
      <section className="border-b border-[#ECE7DF] bg-[linear-gradient(180deg,#FBF9F7_0%,#F7F3EC_100%)]">
        <Container className="py-14 sm:py-18">
          <div className="max-w-4xl">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F5D83]">
              Copyright / DMCA
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              Copyright complaints need a clear intake and takedown process.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              This page outlines the platform’s intended notice-and-action process for copyrighted material, including what a complaint should contain and how repeat infringement may be handled.
            </p>
          </div>
        </Container>
      </section>

      <Container className="py-12 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card className="rounded-[1.75rem] border-[#E9E5DC] bg-white/85 p-5">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                On this page
              </div>
              <nav className="mt-4 space-y-2">
                {sections.map((section) => (
                  <a
                    key={section.title}
                    href={`#${section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-[#F3EFE8] hover:text-slate-950"
                  >
                    {section.title}
                  </a>
                ))}
              </nav>
            </Card>
          </aside>

          <div className="space-y-6">
            {sections.map((section) => (
              <Card
                key={section.title}
                id={section.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
                className="scroll-mt-28 rounded-[1.75rem] border-[#E9E5DC] bg-white p-6 sm:p-8"
              >
                <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-slate-600">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </Card>
            ))}

            <section className="rounded-[2rem] border border-[#E2DDD4] bg-[#F1ECE4] px-6 py-10 text-center sm:px-12">
              <h2 className="text-3xl font-bold tracking-tight text-slate-950">
                Pair copyright intake with moderation and audit trails.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                The policy page helps, but internal review logs, takedown handling, repeat-infringer records, and staff roles are what make the process operational.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/terms"
                  className="inline-flex min-w-[180px] items-center justify-center rounded-full bg-[#4F5D83] px-8 py-3 text-base font-semibold text-white hover:bg-[#445273]"
                >
                  View terms
                </Link>
                <Link
                  to="/privacy"
                  className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
                >
                  View privacy policy
                </Link>
              </div>
            </section>
          </div>
        </div>
      </Container>
    </div>
  );
}
