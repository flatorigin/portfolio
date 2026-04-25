import { Link } from "react-router-dom";
import { Card, Container } from "../ui";

const sections = [
  {
    title: "What this page covers",
    body: [
      "This Privacy Policy explains what information FlatOrigin collects, how it is used, when it may be shared, and what controls users have over that information.",
      "It applies across account creation, public profiles, job posts, private planning tools, messaging, moderation, and security operations.",
    ],
  },
  {
    title: "Information we collect",
    body: [
      "Account information such as username, email address, password credentials, profile type, display name, and verification status.",
      "Profile and project information such as service area, portfolio media, homeowner reference images, project posts, bids, comments, and job-posting drafts.",
      "Communication data such as direct messages, attachments, moderation reports, and customer-support interactions.",
      "Operational and security records such as login activity, admin audit logs, account freezes, report handling, and moderation actions.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "To operate the platform, authenticate users, publish profiles and projects, support messaging, and provide AI-assisted drafting or planning tools.",
      "To maintain platform safety, investigate abuse, review reports, enforce policies, detect fraud, and protect the company, users, and the public.",
      "To improve the product, monitor feature usage, troubleshoot issues, and support account recovery, security, and compliance workflows.",
    ],
  },
  {
    title: "Public vs private information",
    body: [
      "Some information is intentionally public when users choose to publish it, such as portfolio content, public job postings, display names, service areas, and selected contact methods.",
      "Other information is intended to stay private or internal, including account email addresses, hidden contact details, private messages, internal moderation notes, and admin review records.",
      "Users should avoid posting sensitive personal information, payment details, access codes, or private client information in public areas of the platform.",
    ],
  },
  {
    title: "Sharing and service providers",
    body: [
      "FlatOrigin may use infrastructure, hosting, email, analytics, AI, storage, mapping, and other service providers to operate the platform.",
      "Information may be shared with service providers only as needed to run the product, deliver requested features, maintain security, or comply with legal obligations.",
      "FlatOrigin may also disclose information when reasonably necessary to investigate fraud, respond to reports, protect safety, enforce policies, or comply with valid legal requests.",
    ],
  },
  {
    title: "Retention and deletion",
    body: [
      "FlatOrigin may retain account, project, message, report, and moderation records for as long as reasonably necessary to operate the platform, investigate abuse, support disputes, maintain audit trails, and comply with legal obligations.",
      "Deleting or deactivating an account may hide or remove parts of the public profile while allowing certain security, moderation, transaction, and audit records to be retained internally.",
      "Where the platform offers account deletion, FlatOrigin may still keep limited records needed for abuse prevention, repeat-infringer handling, legal defense, or compliance requirements.",
    ],
  },
  {
    title: "Your controls",
    body: [
      "Users can update profile information, choose whether some contact details are public, manage direct-message availability, and request account deactivation or deletion through supported product flows.",
      "Questions about privacy, cleanup, or legal rights requests can be directed to privacy@flatorigin.com until a different published contact route replaces it.",
    ],
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="bg-[#FBF9F7] pb-20 text-slate-900">
      <section className="border-b border-[#ECE7DF] bg-[linear-gradient(180deg,#FBF9F7_0%,#F7F3EC_100%)]">
        <Container className="py-14 sm:py-18">
          <div className="max-w-4xl">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F5D83]">
              Privacy Policy
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              Privacy expectations should be clear before the platform scales.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              This page explains the information FlatOrigin collects, how it is used, and how platform data is handled across profiles, projects, messages, moderation, and account security.
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
                Pair privacy controls with clear product behavior.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                Terms, moderation, and privacy should work together. Users should know what is public, what is private, and what the platform may retain for safety and compliance.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/terms"
                  className="inline-flex min-w-[180px] items-center justify-center rounded-full bg-[#4F5D83] px-8 py-3 text-base font-semibold text-white hover:bg-[#445273]"
                >
                  View terms
                </Link>
                <Link
                  to="/copyright"
                  className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
                >
                  Copyright / DMCA
                </Link>
              </div>
            </section>
          </div>
        </div>
      </Container>
    </div>
  );
}
