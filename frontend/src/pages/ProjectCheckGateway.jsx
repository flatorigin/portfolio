import { Link } from "react-router-dom";
import { Card, Container, SymbolIcon } from "../ui";

const checkCards = [
  {
    label: "For homeowners",
    title: "Check your project before you hire.",
    text: "See what details are missing before you contact contractors or turn it into a real project post.",
    cta: "Start Homeowner Project Check",
    to: "/project-check/homeowner",
    icon: "home",
  },
  {
    label: "For contractors",
    title: "Check a lead before you quote.",
    text: "Review whether a project has enough information before spending time on an estimate.",
    cta: "Start Contractor Lead Check",
    to: "/project-check/contractor",
    icon: "business_center",
  },
];

export default function ProjectCheckGateway() {
  return (
    <div className="min-h-screen bg-[#FBF9F7] text-slate-900">
      <Container className="py-8 sm:py-12">
        <section className="mx-auto flex min-h-[calc(100vh-180px)] max-w-5xl flex-col justify-center">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Free public tools
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-5xl">
              What do you want to check?
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600">
              Use FlatOrigin without signing up to prepare a clearer project or review a lead before quoting.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {checkCards.map((card) => (
              <Link key={card.to} to={card.to} className="group block text-inherit no-underline">
                <Card className="flex min-h-[310px] flex-col p-6 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:p-8">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 shadow-xs">
                    <SymbolIcon name={card.icon} className="text-[24px]" />
                  </div>
                  <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {card.label}
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight text-slate-950">
                    {card.title}
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-slate-600">{card.text}</p>
                  <span className="mt-auto inline-flex h-11 w-full items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-medium text-white shadow-xs transition group-hover:bg-slate-800">
                    {card.cta}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </Container>
    </div>
  );
}
