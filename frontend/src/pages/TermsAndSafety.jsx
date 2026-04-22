import { Link } from "react-router-dom";
import { Card, Container } from "../ui";

const sections = [
  {
    title: "Platform role",
    body: [
      "FlatOrigin provides tools for users to publish portfolios, post projects, invite contractors, submit bids, and communicate around project opportunities.",
      "The platform acts as a facilitator for introductions, project information, proposals, and communication. FlatOrigin is not a party to agreements between homeowners, contractors, profile owners, bidders, or other users.",
      "Any final agreement, including scope, price, schedule, permits, licensing, insurance, safety obligations, and legal responsibilities, must be discussed and confirmed directly between the parties outside of the platform.",
    ],
  },
  {
    title: "User content responsibility",
    body: [
      "Users are solely responsible for the content they post, upload, share, message, or submit through the platform, including portfolio images, project descriptions, job postings, comments, bids, attachments, profile information, and links.",
      "By posting content, users confirm that the content is accurate to the best of their knowledge and that they have the rights, permissions, licenses, and approvals needed to use and display it.",
      "FlatOrigin does not verify the ownership, licensing, truthfulness, completeness, quality, or legality of user-submitted content before it appears on the platform.",
    ],
  },
  {
    title: "Images, likeness, and minors",
    body: [
      "Users must not upload images of minors or children to the platform.",
      "Users must not upload images that reveal private, sensitive, or identifying information without permission from the people involved.",
      "Users are responsible for obtaining any required permission, release, or consent before posting images that include another person, a client's property, a business location, branded materials, or third-party work.",
      "Users are responsible for any copyright, trademark, license, or usage-right issues related to images, text, logos, documents, attachments, or other materials they post.",
    ],
  },
  {
    title: "Prohibited and restricted content",
    body: [
      "Users may not post, upload, message, or link to content that is sexual, exploitative, hateful, threatening, harassing, violent, or abusive.",
      "Content that targets or demeans a person or group based on race, ethnicity, national origin, religion, sex, sexual orientation, gender identity, disability, age, veteran status, family status, or other protected characteristics is not allowed.",
      "Users should avoid religious, racial, sexual, or politically inflammatory language unless it is objectively necessary to describe a lawful project requirement and is handled respectfully.",
      "Spam, scams, misleading job postings, impersonation, stolen work, fake portfolios, and fraudulent bids are not allowed.",
    ],
  },
  {
    title: "Professional conduct",
    body: [
      "FlatOrigin is intended to support a respectful and professional project community.",
      "Users should not insult, mock, shame, harass, threaten, or use harsh or sarcastic language toward another person's work, budget, decision, bid, experience level, or project choices.",
      "Disagreements should be handled in a practical and project-focused way. If a bid, comment, or project is not a good fit, users should decline or move on respectfully.",
      "The community grows best when users communicate clearly, ask relevant questions, and keep discussions tied to the project.",
    ],
  },
  {
    title: "Portfolio and project accuracy",
    body: [
      "Portfolio owners should only present work they are authorized to show and should avoid creating a misleading impression about who performed the work.",
      "Homeowners should describe job postings honestly and should not intentionally omit known conditions that materially affect the work.",
      "Contractors should submit bids that reflect the information available at the time and should clearly state assumptions, inclusions, exclusions, payment terms, and expiration dates.",
      "Bids submitted through the platform are proposals for review and discussion. Accepting a bid on the platform does not by itself create a legally binding contract.",
    ],
  },
  {
    title: "Moderation and removal",
    body: [
      "FlatOrigin may remove, hide, restrict, or disable content, accounts, comments, bids, job postings, profiles, messages, or attachments that appear to violate these terms or create risk for users or the platform.",
      "FlatOrigin may take action with or without prior notice when content appears unsafe, unlawful, misleading, abusive, infringing, or inconsistent with a respectful professional environment.",
      "Users remain responsible for their own content even if FlatOrigin does not review, remove, or moderate it immediately.",
    ],
  },
  {
    title: "No endorsement or guarantee",
    body: [
      "FlatOrigin does not endorse, guarantee, certify, or warrant any user, contractor, homeowner, project, bid, portfolio, license, insurance status, skill level, image, comment, or communication.",
      "Users should perform their own due diligence before hiring, accepting work, making payments, entering job sites, or relying on project information.",
      "Users are responsible for checking credentials, references, insurance, licensing, permit needs, local rules, and any other obligations relevant to their project.",
    ],
  },
  {
    title: "Privacy and sensitive information",
    body: [
      "Users should not post sensitive personal information, private contact details, financial information, access codes, addresses beyond what is necessary for service-area context, or confidential project documents in public areas.",
      "Private messages and attachments should still be treated carefully. Users should only share information that is necessary for the project and appropriate for the recipient.",
      "Public comments are intended for lightweight feedback and should not be used for negotiation, personal attacks, or private project details.",
    ],
  },
];

export default function TermsAndSafety() {
  return (
    <div className="bg-[#FBF9F7] pb-20 text-slate-900">
      <section className="border-b border-[#ECE7DF] bg-[linear-gradient(180deg,#FBF9F7_0%,#F7F3EC_100%)]">
        <Container className="py-14 sm:py-18">
          <div className="max-w-4xl">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F5D83]">
              Terms, Safety & Content Disclaimer
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              A professional project space depends on responsible posting.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg">
              These guidelines explain how user-submitted content, portfolios, project posts, bids, images, and community behavior should be handled on FlatOrigin.
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
                <div className="mt-4 space-y-4 text-sm leading-7 text-slate-650">
                  {section.body.map((paragraph) => (
                    <p key={paragraph} className="text-slate-600">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </Card>
            ))}

            <section className="rounded-[2rem] border border-[#E2DDD4] bg-[#F1ECE4] px-6 py-10 text-center sm:px-12">
              <h2 className="text-3xl font-bold tracking-tight text-slate-950">
                Keep every post professional and project-focused.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                If you are ready to post, make sure your content is accurate, respectful, lawful, and yours to share.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/dashboard"
                  className="inline-flex min-w-[180px] items-center justify-center rounded-full bg-[#4F5D83] px-8 py-3 text-base font-semibold text-white hover:bg-[#445273]"
                >
                  Create a project
                </Link>
                <Link
                  to="/guides"
                  className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
                >
                  Read project guides
                </Link>
              </div>
            </section>
          </div>
        </div>
      </Container>
    </div>
  );
}
